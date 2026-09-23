import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import { useCharacterStore } from '../character/characterStore'
import { EMPTY_AI_PROFILE, type Character } from '../character/types'
import { useHomeStore } from '../home/homeStore'
import { LiveRoomView } from '../simulation/LiveRoomView'
import { useCharacterMovementStore, type CharacterMovementState } from '../simulation/characterMovementStore'
import { MOVEMENT_TICK_MS } from '../simulation/movementConfig'
import { useSimulationStore } from '../simulation/simulationStore'
import { useCharacterMovementSimulation } from '../simulation/useCharacterMovementSimulation'
import { BUBBLE_REVEAL_INTERVAL_MS, MAX_BUNDLE_LINES } from './autoDialogueConfig'
import { startManualConversation } from './autoDialogueTrigger'
import { useDialogueFrequencyStore } from './dialogueFrequencyStore'
import { useDialogueStore } from './dialogueStore'
import {
  DEFAULT_MONOLOGUE_FREQUENCY,
  MIN_MONOLOGUE_COOLDOWN_MS,
  MONOLOGUE_DISPLAY_MS,
  MONOLOGUE_FREQUENCY_ORDER,
  ROOM_ARRIVAL_WINDOW_MS,
  type MonologueFrequencyMode,
} from './monologueConfig'
import { useMonologueFrequencyStore } from './monologueFrequencyStore'
import { useMonologueStore } from './monologueStore'
import { deriveMonologueActivity, runMonologuePass } from './monologueTrigger'

function character(id: string, overrides: Partial<Character['aiProfile']> = {}): Character {
  return {
    id,
    name: `이름-${id}`,
    imageDataUrl: 'data:image/png;base64,',
    displayScale: 1,
    footOffsetRatio: 0,
    imageBounds: null,
    traits: { personality: '', favoriteColor: '' },
    aiProfile: { ...EMPTY_AI_PROFILE, ...overrides },
  }
}

function movementEntry(id: string, roomId: string, overrides: Partial<CharacterMovementState> = {}): CharacterMovementState {
  return { id, roomId, x: 300, y: 350, destination: null, destinationRoomId: null, currentBehavior: null, status: 'idle', restTicksRemaining: 0, stuckTicks: 0, ...overrides }
}

function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

const HOUR = 12
let roomId: string

function setup(ids: string[], mode: MonologueFrequencyMode = 'veryFrequent') {
  useCharacterStore.setState({ characters: ids.map((id) => character(id)) })
  useCharacterMovementStore.setState({ byId: Object.fromEntries(ids.map((id) => [id, movementEntry(id, roomId)])) })
  useMonologueFrequencyStore.setState({ mode })
}

beforeEach(() => {
  localStorage.clear()
  const room = useHomeStore.getInitialState().rooms[0]
  roomId = room.id
  useHomeStore.setState({ rooms: [{ ...room, furniture: [] }], activeDecorateRoomId: room.id, activeLiveRoomId: room.id, selectedFurnitureId: null })
  useDialogueStore.setState({
    entries: [],
    activeConversations: {},
    lastConversationEndAtByPair: {},
    recentAutoLineIdsByCharacter: {},
    recentDefaultBundleIdsByPair: {},
    activeBubbleByCharacter: {},
  })
  useDialogueFrequencyStore.setState({ mode: 'quiet' })
  useMonologueStore.getState().reset()
  useMonologueFrequencyStore.setState({ mode: DEFAULT_MONOLOGUE_FREQUENCY })
  useSimulationStore.setState({ isRunning: true, tick: 0 })
  useCharacterMovementStore.setState({ byId: {} })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('runMonologuePass', () => {
  it('a character with no registered example lines still mutters a line from the default library', () => {
    setup(['a'])
    runMonologuePass(1_000_000, HOUR, () => 0)
    const active = useMonologueStore.getState().activeByCharacter.a
    expect(active).toBeDefined()
    expect(active.text.length).toBeGreaterThan(0)
    expect(active.expiresAt).toBe(1_000_000 + MONOLOGUE_DISPLAY_MS)
  })

  it('끄기 never starts a monologue, and switching to it clears one already showing', () => {
    setup(['a', 'b'], 'off')
    for (let i = 0; i < 200; i++) runMonologuePass(1_000_000 + i * MOVEMENT_TICK_MS, HOUR, () => 0)
    expect(useMonologueStore.getState().activeByCharacter).toEqual({})

    useMonologueStore.getState().showMonologue('a', 'x', '텍스트', 1_000_000, MONOLOGUE_DISPLAY_MS)
    runMonologuePass(1_000_100, HOUR, () => 0)
    expect(useMonologueStore.getState().activeByCharacter.a).toBeUndefined()
  })

  it('the bubble ends by itself once its display time has passed', () => {
    setup(['a'])
    runMonologuePass(1_000_000, HOUR, () => 0)
    runMonologuePass(1_000_000 + MONOLOGUE_DISPLAY_MS - 1, HOUR, () => 0.999)
    expect(useMonologueStore.getState().activeByCharacter.a).toBeDefined()
    runMonologuePass(1_000_000 + MONOLOGUE_DISPLAY_MS, HOUR, () => 0.999)
    expect(useMonologueStore.getState().activeByCharacter.a).toBeUndefined()
  })

  it('the five frequency levels produce a strictly increasing number of monologues over the same simulated time', () => {
    const counts: number[] = []
    for (const mode of MONOLOGUE_FREQUENCY_ORDER) {
      setup(['a'], mode)
      useMonologueStore.getState().reset()
      const random = seeded(5)
      let started = 0
      let lastStart = -1
      for (let i = 0; i < 4 * 60 * 30; i++) {
        runMonologuePass(1_000_000 + i * MOVEMENT_TICK_MS, HOUR, random) // 30 simulated minutes
        const active = useMonologueStore.getState().activeByCharacter.a
        if (active && active.startedAt !== lastStart) {
          started++
          lastStart = active.startedAt
        }
      }
      counts.push(started)
    }
    expect(counts[0]).toBe(0)
    expect(counts[1]).toBeGreaterThan(0)
    expect(counts[1]).toBeLessThan(counts[2])
    expect(counts[2]).toBeLessThan(counts[3])
    expect(counts[3]).toBeLessThan(counts[4])
  })

  it('never exceeds the minimum cooldown between one character\'s monologues, even in 매우 자주', () => {
    setup(['a'], 'veryFrequent')
    const starts: number[] = []
    let last = -1
    for (let i = 0; i < 4 * 60 * 5; i++) {
      const now = 1_000_000 + i * MOVEMENT_TICK_MS
      runMonologuePass(now, HOUR, () => 0)
      const active = useMonologueStore.getState().activeByCharacter.a
      if (active && active.startedAt !== last) {
        starts.push(active.startedAt)
        last = active.startedAt
      }
    }
    expect(starts.length).toBeGreaterThan(1)
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(MIN_MONOLOGUE_COOLDOWN_MS)
  })

  it('cooldowns are tracked per character: a character that just spoke waits while another that has not yet spoken is free', () => {
    setup(['a', 'b'], 'normal')
    useMonologueStore.setState({ lastMonologueAtByCharacter: { a: 1_000_000 - 1000 } })
    runMonologuePass(1_000_000, HOUR, () => 0)
    expect(useMonologueStore.getState().activeByCharacter.a).toBeUndefined()
    expect(useMonologueStore.getState().activeByCharacter.b).toBeDefined()
  })

  it('records recent line ids per character and never repeats a line back-to-back', () => {
    setup(['a'], 'veryFrequent')
    const random = seeded(9)
    const ids: string[] = []
    let last = -1
    for (let i = 0; i < 4 * 60 * 20; i++) {
      runMonologuePass(1_000_000 + i * MOVEMENT_TICK_MS, HOUR, random)
      const active = useMonologueStore.getState().activeByCharacter.a
      if (active && active.startedAt !== last) {
        ids.push(active.lineId)
        last = active.startedAt
      }
    }
    expect(ids.length).toBeGreaterThan(10)
    for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1])
    expect(useMonologueStore.getState().recentLineIdsByCharacter.a?.length).toBeGreaterThan(0)
  })

  it('keeps monologue recency separate from the two-person dialogue recency records', () => {
    setup(['a'])
    runMonologuePass(1_000_000, HOUR, () => 0)
    expect(useDialogueStore.getState().recentAutoLineIdsByCharacter).toEqual({})
    expect(useDialogueStore.getState().recentDefaultBundleIdsByPair).toEqual({})
    expect(useDialogueStore.getState().activeBubbleByCharacter).toEqual({})
  })

  it('never fires for a character in a conversation, but others (even nearby) can still mutter', () => {
    setup(['a', 'b', 'c'])
    useDialogueStore.getState().startConversation(['a', 'b'])
    runMonologuePass(1_000_000, HOUR, () => 0)
    const active = useMonologueStore.getState().activeByCharacter
    expect(active.a).toBeUndefined()
    expect(active.b).toBeUndefined()
    expect(active.c).toBeDefined()
  })

  it('a talking character never mutters, and an existing monologue is dropped', () => {
    setup(['a'])
    useMonologueStore.getState().showMonologue('a', 'x', '텍스트', 1_000_000, MONOLOGUE_DISPLAY_MS)
    useCharacterMovementStore.getState().setStatus('a', 'talking')
    runMonologuePass(1_000_100, HOUR, () => 0)
    expect(useMonologueStore.getState().activeByCharacter.a).toBeUndefined()
  })

  it('five characters each mutter independently at the same time', () => {
    const ids = ['a', 'b', 'c', 'd', 'e']
    setup(ids)
    runMonologuePass(1_000_000, HOUR, () => 0)
    const active = useMonologueStore.getState().activeByCharacter
    expect(Object.keys(active).sort()).toEqual(ids)
    expect(Object.keys(useMonologueStore.getState().lastMonologueAtByCharacter).sort()).toEqual(ids)
  })

  it('the activity fed to the engine comes from real state: arrival window, resting, moving, otherwise idle', () => {
    const now = 1_000_000
    expect(deriveMonologueActivity(movementEntry('a', roomId, { status: 'moving' }), undefined, now)).toBe('wandering')
    expect(deriveMonologueActivity(movementEntry('a', roomId, { restTicksRemaining: 3 }), undefined, now)).toBe('resting')
    expect(deriveMonologueActivity(movementEntry('a', roomId), undefined, now)).toBe('idle')
    expect(deriveMonologueActivity(movementEntry('a', roomId, { status: 'moving' }), now - 1000, now)).toBe('roomArrival')
    expect(deriveMonologueActivity(movementEntry('a', roomId, { status: 'moving' }), now - ROOM_ARRIVAL_WINDOW_MS, now)).toBe('wandering')
  })
})

describe('monologue frequency setting persistence', () => {
  it('saves only the mode, and restores it after a reload', async () => {
    useMonologueFrequencyStore.getState().setMode('frequent')
    const saved = JSON.parse(localStorage.getItem('dearly-monologue-frequency') ?? '{}')
    expect(saved.state).toEqual({ mode: 'frequent' })

    useMonologueFrequencyStore.setState({ mode: 'off' })
    localStorage.setItem('dearly-monologue-frequency', JSON.stringify({ state: { mode: 'veryFrequent' }, version: 0 }))
    await useMonologueFrequencyStore.persist.rehydrate()
    expect(useMonologueFrequencyStore.getState().mode).toBe('veryFrequent')
  })

  it('falls back to 보통 when the saved data lacks the setting or holds something invalid', async () => {
    for (const raw of [JSON.stringify({ state: {}, version: 0 }), JSON.stringify({ state: { mode: 'bogus' }, version: 0 }), JSON.stringify({ state: { mode: 42 }, version: 0 })]) {
      useMonologueFrequencyStore.setState({ mode: 'off' })
      localStorage.setItem('dearly-monologue-frequency', raw)
      await useMonologueFrequencyStore.persist.rehydrate()
      expect(useMonologueFrequencyStore.getState().mode).toBe('normal')
    }
    expect(DEFAULT_MONOLOGUE_FREQUENCY).toBe('normal')
  })

  it('does not persist any transient monologue state', () => {
    useMonologueStore.getState().showMonologue('a', 'x', '텍스트', 1, 100)
    useMonologueFrequencyStore.getState().setMode('rare')
    const stored = localStorage.getItem('dearly-monologue-frequency') ?? ''
    expect(stored).not.toContain('텍스트')
    expect(stored).not.toContain('lastMonologueAt')
    expect(stored).not.toContain('recentLineIds')
  })
})

describe('conversation priority', () => {
  it('starting a conversation ends both participants\' monologue bubbles at once', async () => {
    vi.useFakeTimers()
    setup(['a', 'b', 'c'])
    const now = Date.now()
    for (const id of ['a', 'b', 'c']) useMonologueStore.getState().showMonologue(id, 'x', `혼잣말-${id}`, now, 60_000)
    const mountedRef = { current: true }
    const situationRef = { current: { time: '', place: '', actionA: '', actionB: '' } }

    const done = startManualConversation('a', 'b', situationRef, mountedRef)
    const active = useMonologueStore.getState().activeByCharacter
    expect(active.a).toBeUndefined()
    expect(active.b).toBeUndefined()
    expect(active.c).toBeDefined() // an uninvolved neighbour is untouched

    await vi.advanceTimersByTimeAsync(BUBBLE_REVEAL_INTERVAL_MS * (MAX_BUNDLE_LINES + 1))
    await done
  })
})

describe('with the live tick loop', () => {
  it('movement keeps going while a monologue is showing, and the monologue is not cut short by walking', async () => {
    vi.useFakeTimers()
    setup(['a'], 'off') // 'off' here only so no *new* monologue is rolled; we plant one below
    useMonologueFrequencyStore.setState({ mode: 'rare' })
    const now = Date.now()
    useMonologueStore.getState().showMonologue('a', 'x', '걸으면서 중얼', now, 10 * 60_000)
    useMonologueStore.setState({ lastMonologueAtByCharacter: { a: now } }) // still on cooldown, so nothing replaces it

    renderHook(() => useCharacterMovementSimulation({ time: '', place: '', actionA: '', actionB: '' }))
    const positions = new Set<string>()
    for (let i = 0; i < 60; i++) {
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
      const entry = useCharacterMovementStore.getState().byId.a
      if (entry) positions.add(`${entry.x},${entry.y}`)
    }
    expect(positions.size).toBeGreaterThan(1)
    expect(useMonologueStore.getState().activeByCharacter.a?.text).toBe('걸으면서 중얼')
  })

  it('does not start monologues while the simulation is paused, and does when running', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    setup(['a'], 'veryFrequent')
    useSimulationStore.setState({ isRunning: false })
    renderHook(() => useCharacterMovementSimulation({ time: '', place: '', actionA: '', actionB: '' }))

    await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS * 20)
    expect(useMonologueStore.getState().activeByCharacter).toEqual({})

    act(() => useSimulationStore.setState({ isRunning: true }))
    await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS * 20)
    expect(useMonologueStore.getState().activeByCharacter.a).toBeDefined()
  })

  it('changing rooms marks an arrival, without disturbing the character\'s own movement state', async () => {
    vi.useFakeTimers()
    const room2Id = useHomeStore.getState().addRoom('bedroom', '침실', 'empty')
    setup(['a'], 'off')
    const room = useHomeStore.getState().rooms[0]
    useCharacterMovementStore.setState({
      byId: { a: movementEntry('a', roomId, { x: room.doorway.exitPosition.x, y: room.doorway.exitPosition.y, destination: room.doorway.exitPosition, destinationRoomId: room2Id }) },
    })
    renderHook(() => useCharacterMovementSimulation({ time: '', place: '', actionA: '', actionB: '' }))
    // Exactly one tick: every room's doorway is the same point, so a later tick could legitimately roll changeRoom and hop straight back.
    await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)

    expect(useCharacterMovementStore.getState().byId.a.roomId).toBe(room2Id)
    expect(useMonologueStore.getState().lastRoomArrivalAtByCharacter.a).toBeDefined()
  })
})

describe('room visibility', () => {
  it('a monologue in another room is not shown in the observed room, and appears once that room is observed', () => {
    const room2Id = useHomeStore.getState().addRoom('bedroom', '침실', 'empty')
    useCharacterStore.setState({ characters: [character('a'), character('b')] })
    useCharacterMovementStore.setState({ byId: { a: movementEntry('a', roomId), b: movementEntry('b', room2Id) } })
    useMonologueStore.getState().showMonologue('a', 'x', '여기 방의 혼잣말', 1, 60_000)
    useMonologueStore.getState().showMonologue('b', 'y', '다른 방의 혼잣말', 1, 60_000)

    render(<LiveRoomView />)
    expect(screen.getByText('여기 방의 혼잣말')).toBeInTheDocument()
    expect(screen.queryByText('다른 방의 혼잣말')).not.toBeInTheDocument()

    act(() => useHomeStore.getState().setActiveLiveRoom(room2Id))
    expect(screen.getByText('다른 방의 혼잣말')).toBeInTheDocument()
    expect(screen.queryByText('여기 방의 혼잣말')).not.toBeInTheDocument()
  })

  it('never shows a monologue bubble and a conversation bubble on the same character; the conversation wins', () => {
    useCharacterStore.setState({ characters: [character('a')] })
    useCharacterMovementStore.setState({ byId: { a: movementEntry('a', roomId) } })
    useMonologueStore.getState().showMonologue('a', 'x', '혼잣말 문장', 1, 60_000)
    render(<LiveRoomView />)
    expect(screen.getByText('혼잣말 문장')).toBeInTheDocument()
    expect(document.querySelector('.character-token-monologue')).not.toBeNull()

    act(() => useDialogueStore.getState().setActiveBubble('a', '대화 문장'))
    expect(screen.getByText('대화 문장')).toBeInTheDocument()
    expect(screen.queryByText('혼잣말 문장')).not.toBeInTheDocument()
    expect(document.querySelectorAll('.character-token-bubble')).toHaveLength(1)
    expect(document.querySelector('.character-token-monologue')).toBeNull()
  })
})
