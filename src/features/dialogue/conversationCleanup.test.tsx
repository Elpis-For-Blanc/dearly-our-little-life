import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import { useCharacterStore } from '../character/characterStore'
import { CharacterList } from '../character/CharacterList'
import { EMPTY_AI_PROFILE, type Character, type CharacterDialogueLine } from '../character/types'
import { useHomeStore } from '../home/homeStore'
import { RoomTabs } from '../home/RoomTabs'
import { useCharacterMovementStore, type CharacterMovementState } from '../simulation/characterMovementStore'
import { MOVEMENT_TICK_MS } from '../simulation/movementConfig'
import { useSimulationStore } from '../simulation/simulationStore'
import { useCharacterMovementSimulation } from '../simulation/useCharacterMovementSimulation'
import { BUBBLE_REVEAL_INTERVAL_MS, MAX_BUNDLE_LINES, MIN_BUNDLE_LINES } from './autoDialogueConfig'
import { endActiveConversationsFor, startManualConversation } from './autoDialogueTrigger'
import { useDialogueFrequencyStore } from './dialogueFrequencyStore'
import { useDialogueStore } from './dialogueStore'
import { useMonologueFrequencyStore } from './monologueFrequencyStore'
import { useMonologueStore } from './monologueStore'
import { useRelationshipStore } from './relationshipStore'

/**
 * Reproduction + fix verification for the two bugs found by the phase-5/6
 * stress test: a character (or its room) disappearing mid-conversation used
 * to leave the survivor's conversation state dangling until the interrupted
 * conversation's own async reveal loop happened to finish on its own, several
 * seconds later. The real fix is `endActiveConversationsFor` (autoDialogueTrigger.ts)
 * plus a "did someone already end this conversation?" guard in
 * `runConversation`'s own cleanup — see CLAUDE.md. These tests fail against
 * the pre-fix code (verified while developing the fix) and must keep passing
 * against the real production call sites, not a simplified stand-in.
 */

function line(id: string, text: string): CharacterDialogueLine {
  return { id, categoryId: 'casual-chat', situationNote: '', text, emotion: 'neutral', tags: [], isFallback: false }
}

/** Enough distinct lines that a 2-4 line bundle never runs out of fresh candidates across repeated conversations in one test. */
function character(id: string): Character {
  return {
    id,
    name: `이름-${id}`,
    imageDataUrl: 'data:image/png;base64,',
    displayScale: 1,
    footOffsetRatio: 0,
    imageBounds: null,
    traits: { personality: '', favoriteColor: '' },
    aiProfile: { ...EMPTY_AI_PROFILE, dialogueLines: Array.from({ length: 12 }, (_, i) => line(`${id}-l${i}`, `${id}의 대사 ${i}`)) },
  }
}

function entry(id: string, roomId: string, overrides: Partial<CharacterMovementState> = {}): CharacterMovementState {
  return { id, roomId, x: 300, y: 350, destination: null, destinationRoomId: null, currentBehavior: null, status: 'idle', restTicksRemaining: 0, stuckTicks: 0, ...overrides }
}

let roomA: string
let roomB: string

function resetAll() {
  localStorage.clear()
  const room = useHomeStore.getInitialState().rooms[0]
  roomA = room.id
  useHomeStore.setState({ rooms: [{ ...room, furniture: [] }], activeDecorateRoomId: room.id, activeLiveRoomId: room.id, selectedFurnitureId: null })
  roomB = useHomeStore.getState().addRoom('bedroom', '침실', 'empty')
  useCharacterStore.setState({ characters: [] })
  useCharacterMovementStore.setState({ byId: {} })
  useDialogueStore.setState({ entries: [], activeConversations: {}, lastConversationEndAtByPair: {}, recentAutoLineIdsByCharacter: {}, recentDefaultBundleIdsByPair: {}, activeBubbleByCharacter: {} })
  useMonologueStore.getState().reset()
  useMonologueFrequencyStore.setState({ mode: 'off' })
  useDialogueFrequencyStore.setState({ mode: 'quiet' })
  useRelationshipStore.setState({ defaultRelationshipType: 'close', relationshipsByPair: {} })
  useSimulationStore.setState({ isRunning: true, tick: 0 })
}

const situationRef = { current: { time: '', place: '', actionA: '', actionB: '' } }
const mountedRef = { current: true }

/**
 * Starts a conversation and advances exactly one bubble-reveal interval, so
 * it is verifiably mid-flight (not finished) when the test then interrupts
 * it. Returns the still-pending promise, wrapped in an object — an `async`
 * function returning a bare thenable would have its own returned promise
 * *adopt* that thenable's state (the standard Promise resolution procedure),
 * so `await startAndPause(...)` would silently block until the whole
 * conversation finishes instead of just until this one interval elapses.
 */
async function startAndPause(idA: string, idB: string) {
  const promise = startManualConversation(idA, idB, situationRef, mountedRef)
  await vi.advanceTimersByTimeAsync(BUBBLE_REVEAL_INTERVAL_MS) // first line delivered, more still to come for a >1-line bundle
  return { promise }
}

function finishAllPending() {
  return vi.advanceTimersByTimeAsync(BUBBLE_REVEAL_INTERVAL_MS * (MAX_BUNDLE_LINES + 2))
}

beforeEach(() => {
  vi.useFakeTimers()
  resetAll()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('bug 1: character deleted mid-conversation', () => {
  beforeEach(() => {
    useCharacterStore.setState({ characters: [character('a'), character('b'), character('c')] })
    useCharacterMovementStore.setState({ byId: { a: entry('a', roomA, { status: 'talking' }), b: entry('b', roomA, { status: 'talking' }), c: entry('c', roomA) } })
  })

  it('reproduces the raw bug against a naive removeCharacter-only deletion (no cleanup call)', async () => {
    const { promise: pending } = await startAndPause('a', 'b')
    act(() => useCharacterStore.getState().removeCharacter('a')) // naive: nothing tells the conversation system 'a' is gone
    await vi.advanceTimersByTimeAsync(0)

    // The bug: nothing told the conversation system 'a' is gone, so it's still listed as a participant and 'b' is
    // stuck "busy" — with no movement tick running in this test, characterMovementStore hasn't even pruned 'a' yet
    // (that only happens reactively via syncCharacterIds), which is exactly why a passive "it'll clean up on its own
    // eventually" approach isn't good enough: nothing drives that cleanup until the *next* real tick or an idle
    // conversation timeout, neither of which is immediate.
    const stillListed = Object.values(useDialogueStore.getState().activeConversations).some((p) => p.includes('a'))
    expect(stillListed).toBe(true)
    expect(useDialogueStore.getState().isCharacterBusy('b')).toBe(true)

    await finishAllPending()
    await pending
  })

  it('endActiveConversationsFor ends the conversation immediately: gone from activeConversations, both bubbles cleared, survivor movement recovered', async () => {
    const { promise: pending } = await startAndPause('a', 'b')
    expect(useDialogueStore.getState().activeBubbleByCharacter.a).toBeDefined() // the conversation is genuinely in progress

    act(() => {
      endActiveConversationsFor('a')
      useMonologueStore.getState().forgetCharacter('a')
      useCharacterStore.getState().removeCharacter('a')
    })

    expect(Object.values(useDialogueStore.getState().activeConversations).some((p) => p.includes('a') || p.includes('b'))).toBe(false)
    expect(useDialogueStore.getState().activeBubbleByCharacter.a).toBeUndefined()
    expect(useDialogueStore.getState().activeBubbleByCharacter.b).toBeUndefined()
    expect(useDialogueStore.getState().isCharacterBusy('b')).toBe(false)
    const b = useCharacterMovementStore.getState().byId.b
    expect(b.status).toBe('idle')
    expect(b.destination).toBeNull()
    expect(b.destinationRoomId).toBeNull()
    expect(b.currentBehavior).toBeNull()

    await finishAllPending()
    await pending
  })

  it('the survivor can start a brand-new conversation immediately — not several seconds later', async () => {
    const { promise: pending } = await startAndPause('a', 'b')
    act(() => {
      endActiveConversationsFor('a')
      useCharacterStore.getState().removeCharacter('a')
    })

    // Fire the new conversation without awaiting it directly (it depends on fake timers to ever settle) — start it,
    // advance the clock, then read the result.
    const outcomePromise = startManualConversation('b', 'c', situationRef, mountedRef)
    await vi.advanceTimersByTimeAsync(0) // past the synchronous "is either participant busy?" check
    expect(useDialogueStore.getState().isCharacterBusy('b')).toBe(true) // started, not rejected as 'busy'
    await finishAllPending()
    expect(await outcomePromise).not.toBe('busy')
    await pending
  })

  it("the interrupted conversation's own delayed cleanup never clobbers the survivor's new conversation (the stillActive guard)", async () => {
    // Forces every bundle in this test to the shortest (2-line) length, so the two conversations' timing is exact
    // instead of depending on Math.random's real, unseeded bundle-length roll.
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const { promise: pending } = await startAndPause('a', 'b') // t=0 -> t=1 interval; (a,b) has now delivered both its lines and is in its final delay
    act(() => {
      endActiveConversationsFor('a')
      useCharacterStore.getState().removeCharacter('a')
    })

    // b immediately starts a real new conversation with c (t=1 interval -> t=2 intervals). At t=2, (a,b)'s own delay
    // completes and its finally runs (guarded, no-op — already ended above) in the very same tick that (b,c)
    // delivers its own second (and, for a 2-line bundle, last) line — the exact interleaving that used to clobber it.
    const { promise: newPromise } = await startAndPause('b', 'c')
    expect(useDialogueStore.getState().activeBubbleByCharacter.b).toBeDefined()
    const conversationIdForBC = Object.keys(useDialogueStore.getState().activeConversations).find((id) => useDialogueStore.getState().activeConversations[id].includes('b'))
    expect(conversationIdForBC).toBeDefined()

    // If the old cleanup were not guarded, its unconditional reset would have already fired for 'b' here and wiped the new conversation.
    expect(useDialogueStore.getState().activeConversations[conversationIdForBC!]).toEqual(['b', 'c'])
    expect(useCharacterMovementStore.getState().byId.b.status).toBe('talking')

    await finishAllPending()
    await pending
    await newPromise
  })

  it('removing a character through the real CharacterList delete button performs the same immediate cleanup', async () => {
    const { promise: pending } = await startAndPause('a', 'b')
    render(<CharacterList />)
    const row = screen.getByText('이름-a').closest<HTMLElement>('.character-list-item')!
    fireEvent.click(within(row).getByRole('button', { name: '삭제' }))

    expect(useCharacterStore.getState().characters.map((c) => c.id)).toEqual(['b', 'c'])
    expect(Object.values(useDialogueStore.getState().activeConversations).some((p) => p.includes('b'))).toBe(false)
    expect(useCharacterMovementStore.getState().byId.b.status).toBe('idle')
    expect(useDialogueStore.getState().isCharacterBusy('b')).toBe(false)

    await finishAllPending()
    await pending
  })

  it("dropping the deleted character's monologue history leaves no reference behind", () => {
    useMonologueStore.getState().showMonologue('a', 'x', '텍스트', Date.now(), 60_000)
    useMonologueStore.getState().markRoomArrival('a', Date.now())
    useMonologueStore.getState().forgetCharacter('a')
    const state = useMonologueStore.getState()
    expect('a' in state.activeByCharacter).toBe(false)
    expect('a' in state.lastMonologueAtByCharacter).toBe(false)
    expect('a' in state.recentLineIdsByCharacter).toBe(false)
    expect('a' in state.lastRoomArrivalAtByCharacter).toBe(false)
  })

  it('the movement tick keeps running normally for the survivor after a mid-conversation deletion (no freeze)', async () => {
    const { promise: pending } = await startAndPause('a', 'b') // a genuine conversation, so there's a real activeConversations entry for endActiveConversationsFor to actually find and end
    act(() => {
      endActiveConversationsFor('a')
      useCharacterStore.getState().removeCharacter('a')
    })
    renderHook(() => useCharacterMovementSimulation(situationRef.current))
    const positions = new Set<string>()
    for (let i = 0; i < 60; i++) {
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
      const e = useCharacterMovementStore.getState().byId.b
      if (e) positions.add(`${e.x},${e.y}`)
    }
    expect(positions.size).toBeGreaterThan(1)

    await finishAllPending()
    await pending
  })
})

describe('bug 2: the room a conversation is happening in gets deleted', () => {
  beforeEach(() => {
    useCharacterStore.setState({ characters: [character('a'), character('b'), character('c')] })
    useCharacterMovementStore.setState({ byId: { a: entry('a', roomA, { status: 'talking' }), b: entry('b', roomA, { status: 'talking' }), c: entry('c', roomB) } })
  })

  it('reproduces the raw bug: relocating without ending the conversation first desyncs status from dialogueStore', async () => {
    const { promise: pending } = await startAndPause('a', 'b')
    const target = useHomeStore.getState().rooms.find((r) => r.id === roomB)!
    // The naive, pre-fix order: relocate first, do nothing about the conversation.
    act(() => useCharacterMovementStore.getState().moveCharacterToRoom('a', target.id, target.doorway.entryPosition))

    expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle') // desynced: still "busy" per dialogueStore below
    expect(useDialogueStore.getState().isCharacterBusy('a')).toBe(true)

    await finishAllPending()
    await pending
  })

  it('ending the conversation before relocating (the real RoomTabs order) leaves both participants consistent and both free to move/talk again', async () => {
    const { promise: pending } = await startAndPause('a', 'b')
    const target = useHomeStore.getState().rooms.find((r) => r.id === roomB)!

    act(() => {
      endActiveConversationsFor('a')
      useCharacterMovementStore.getState().moveCharacterToRoom('a', target.id, target.doorway.entryPosition)
    })

    expect(useDialogueStore.getState().isCharacterBusy('a')).toBe(false)
    expect(useDialogueStore.getState().isCharacterBusy('b')).toBe(false)
    const a = useCharacterMovementStore.getState().byId.a
    expect(a.roomId).toBe(target.id)
    expect(a.status).toBe('idle')
    expect(a.destinationRoomId).toBeNull()
    const b = useCharacterMovementStore.getState().byId.b
    expect(b.status).toBe('idle')
    expect(b.destination).toBeNull()

    const outcomePromise = startManualConversation('a', 'c', situationRef, mountedRef)
    await vi.advanceTimersByTimeAsync(0)
    expect(useDialogueStore.getState().isCharacterBusy('a')).toBe(true)
    await finishAllPending()
    expect(await outcomePromise).not.toBe('busy')
    await pending
  })

  it('the real RoomTabs delete-room UI flow ends conversations before relocating occupants', async () => {
    const { promise: pending } = await startAndPause('a', 'b')
    render(<RoomTabs activeRoomId={roomA} onSelectRoom={() => {}} />)

    // fireEvent, not userEvent — this project's fake-timer tests avoid userEvent's own internal delays hanging
    // alongside an unrelated pending conversation's real (fake-timer-backed) setTimeout chain.
    fireEvent.click(screen.getByRole('button', { name: `${useHomeStore.getState().rooms.find((r) => r.id === roomA)!.name} 삭제` }))
    fireEvent.change(screen.getByLabelText('캐릭터를 옮길 방'), { target: { value: roomB } })
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))

    expect(useHomeStore.getState().rooms.map((r) => r.id)).toEqual([roomB])
    expect(Object.values(useDialogueStore.getState().activeConversations).some((p) => p.includes('a') || p.includes('b'))).toBe(false)
    expect(useCharacterMovementStore.getState().byId.a.roomId).toBe(roomB)
    expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle')
    expect(useCharacterMovementStore.getState().byId.b.status).toBe('idle')

    await finishAllPending()
    await pending
  })

  it("a room deleted programmatically (bypassing RoomTabs) is still caught by the movement tick's own orphan rescue, which ends the conversation before relocating", async () => {
    const { promise: pending } = await startAndPause('a', 'b')
    renderHook(() => useCharacterMovementSimulation(situationRef.current))

    act(() => useHomeStore.getState().removeRoom(roomA)) // no manual relocation at all — 'a' and 'b' are now orphaned mid-conversation
    await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)

    expect(Object.values(useDialogueStore.getState().activeConversations).some((p) => p.includes('a') || p.includes('b'))).toBe(false)
    for (const id of ['a', 'b']) {
      const e = useCharacterMovementStore.getState().byId[id]
      expect(useHomeStore.getState().rooms.map((r) => r.id)).toContain(e.roomId)
      // Freed within the very same tick that rescued them: the per-character movement loop (which runs right after the
      // rescue, in this same tick) already saw status 'idle' and picked a fresh destination — 'moving' here is proof
      // the freeze is gone, not a sign it didn't work. The next block confirms they keep moving over more ticks.
      expect(e.status, id).not.toBe('talking')
    }
    expect(useDialogueStore.getState().isCharacterBusy('a')).toBe(false)
    expect(useDialogueStore.getState().isCharacterBusy('b')).toBe(false)

    // Both keep moving and can talk again afterwards.
    const positions = new Set<string>()
    for (let i = 0; i < 60; i++) {
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
      const e = useCharacterMovementStore.getState().byId.a
      positions.add(`${e.x},${e.y}`)
    }
    expect(positions.size).toBeGreaterThan(1)

    await finishAllPending()
    await pending
  })

  it('relocating consistently ends the conversation for BOTH participants even though only one triggers the relocation loop', async () => {
    const { promise: pending } = await startAndPause('a', 'b')
    const target = useHomeStore.getState().rooms.find((r) => r.id === roomB)!
    act(() => {
      // Mirrors RoomTabs: every occupant of the doomed room gets the same end-then-relocate treatment, not just one side.
      for (const id of ['a', 'b']) {
        endActiveConversationsFor(id)
        useCharacterMovementStore.getState().moveCharacterToRoom(id, target.id, target.doorway.entryPosition)
      }
    })
    expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle')
    expect(useCharacterMovementStore.getState().byId.b.status).toBe('idle')
    expect(Object.keys(useDialogueStore.getState().activeConversations)).toHaveLength(0)
    await finishAllPending()
    await pending
  })
})

describe('normal (uninterrupted) conversations are unaffected by the guard', () => {
  it('a conversation nobody interrupts still ends and cleans up exactly as before', async () => {
    useCharacterStore.setState({ characters: [character('a'), character('b')] })
    useCharacterMovementStore.setState({ byId: { a: entry('a', roomA), b: entry('b', roomA) } })
    const outcome = await (async () => {
      const p = startManualConversation('a', 'b', situationRef, mountedRef)
      await finishAllPending()
      return p
    })()
    expect(outcome).toBe('started')
    expect(Object.keys(useDialogueStore.getState().activeConversations)).toHaveLength(0)
    expect(useDialogueStore.getState().activeBubbleByCharacter).toEqual({})
    expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle')
    expect(useCharacterMovementStore.getState().byId.b.status).toBe('idle')
    expect(useDialogueStore.getState().entries.length).toBeGreaterThanOrEqual(MIN_BUNDLE_LINES)
  })
})
