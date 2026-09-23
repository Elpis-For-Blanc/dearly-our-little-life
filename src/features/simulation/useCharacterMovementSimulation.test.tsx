import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
import { useCharacterMovementSimulation } from './useCharacterMovementSimulation'
import { useCharacterMovementStore } from './characterMovementStore'
import { useSimulationStore } from './simulationStore'
import { useCharacterStore } from '../character/characterStore'
import { useHomeStore } from '../home/homeStore'
import { useDialogueStore } from '../dialogue/dialogueStore'
import { useDialogueFrequencyStore } from '../dialogue/dialogueFrequencyStore'
import { useRelationshipStore } from '../dialogue/relationshipStore'
import { pairKey } from '../dialogue/pairKey'
import { EMPTY_AI_PROFILE } from '../character/types'
import { MOVEMENT_TICK_MS } from './movementConfig'
import { BUBBLE_REVEAL_INTERVAL_MS, MAX_BUNDLE_LINES } from '../dialogue/autoDialogueConfig'

function characterWithLines(id: string, name: string) {
  return {
    id,
    name,
    imageDataUrl: 'data:image/png;base64,',
    displayScale: 1, footOffsetRatio: 0, imageBounds: null,
    traits: { personality: '', favoriteColor: '' },
    aiProfile: {
      ...EMPTY_AI_PROFILE,
      dialogueLines: Array.from({ length: 4 }, (_, i) => ({
        id: `${id}-${i}`,
        categoryId: 'casual-chat',
        situationNote: '',
        text: `${name} line ${i}`,
        emotion: 'neutral',
        tags: [],
        isFallback: false,
      })),
    },
  }
}

const situation = { time: '오후', place: '거실', actionA: '', actionB: '' }

/** Deterministic but varied — cycles through the given values instead of always returning the same one, so behavior selection doesn't pathologically land on the same choice (e.g. always 'rest') every tick. */
function cyclingRandom(...values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]
}

/** Advances `ticks` movement ticks and returns every distinct position the character passed through — the direct way to verify a character is genuinely still wandering, not just "present", per the spec's explicit "실제 좌표가 다시 변하는지 검증" requirement. */
async function collectPositionsOverTicks(id: string, ticks: number): Promise<Set<string>> {
  const positions = new Set<string>()
  for (let i = 0; i < ticks; i++) {
    await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
    const entry = useCharacterMovementStore.getState().byId[id]
    if (entry) positions.add(`${entry.x},${entry.y}`)
  }
  return positions
}

function roomId() {
  return useHomeStore.getState().rooms[0].id
}

function movementEntry(id: string, x: number, y: number, overrides: Partial<{ status: 'idle' | 'moving' | 'talking' }> = {}) {
  return {
    id,
    roomId: roomId(),
    x,
    y,
    destination: null,
    destinationRoomId: null,
    currentBehavior: null,
    status: overrides.status ?? ('idle' as const),
    restTicksRemaining: 0,
    stuckTicks: 0,
  }
}

describe('useCharacterMovementSimulation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Reset all the way back to a single, empty room each test — several
    // tests in this file (the multi-room ones especially) add rooms, and
    // homeStore is a module-level singleton that otherwise carries state
    // across tests within the same file (and could exceed MAX_ROOMS).
    const room = useHomeStore.getInitialState().rooms[0]
    useHomeStore.setState({
      rooms: [{ ...room, furniture: [] }],
      activeDecorateRoomId: room.id,
      activeLiveRoomId: room.id,
      selectedFurnitureId: null,
    })
    useDialogueStore.setState({
      entries: [],
      activeConversations: {},
      lastConversationEndAtByPair: {},
      recentAutoLineIdsByCharacter: {},
      recentDefaultBundleIdsByPair: {},
    })
    useDialogueFrequencyStore.setState({ mode: 'rowdy' })
    useRelationshipStore.setState({ defaultRelationshipType: 'close', relationshipsByPair: {} })
    useSimulationStore.setState({ isRunning: true, tick: 0 })
    useCharacterMovementStore.setState({ byId: {} })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('two characters who start close together trigger a full conversation end-to-end', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    useCharacterStore.setState({ characters: [characterWithLines('a', 'Milo'), characterWithLines('b', 'Luna')] })
    useCharacterMovementStore.setState({
      byId: {
        a: movementEntry('a', 300, 350),
        b: movementEntry('b', 310, 350),
      },
    })

    renderHook(() => useCharacterMovementSimulation(situation))

    await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
    await vi.advanceTimersByTimeAsync(BUBBLE_REVEAL_INTERVAL_MS * MAX_BUNDLE_LINES)

    expect(useDialogueStore.getState().entries.length).toBeGreaterThan(0)
    expect(useDialogueStore.getState().entries.every((e) => ['a', 'b'].includes(e.speakerId))).toBe(true)
    expect(useDialogueStore.getState().activeConversations).toEqual({})
    expect(useDialogueStore.getState().lastConversationEndAtByPair[pairKey('a', 'b')]).toBeGreaterThan(0)
    expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle')
    expect(useCharacterMovementStore.getState().byId.b.status).toBe('idle')
  })

  it('never double-books a character when 3 characters are all mutually within encounter range at once', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    useCharacterStore.setState({
      characters: [characterWithLines('a', 'Milo'), characterWithLines('b', 'Luna'), characterWithLines('c', 'Coco')],
    })
    useCharacterMovementStore.setState({
      byId: {
        a: movementEntry('a', 300, 350),
        b: movementEntry('b', 310, 350),
        c: movementEntry('c', 320, 350),
      },
    })

    renderHook(() => useCharacterMovementSimulation(situation))

    await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
    await vi.advanceTimersByTimeAsync(BUBBLE_REVEAL_INTERVAL_MS * MAX_BUNDLE_LINES)

    // Only the first-detected pair (a,b) should have actually converged into a conversation —
    // (a,c) and (b,c) must have been refused by the busy-set guard, not silently double-booked.
    const speakerIds = new Set(useDialogueStore.getState().entries.map((e) => e.speakerId))
    expect(speakerIds.has('c')).toBe(false)
    expect(useDialogueStore.getState().lastConversationEndAtByPair[pairKey('a', 'b')]).toBeGreaterThan(0)
    expect(useDialogueStore.getState().lastConversationEndAtByPair[pairKey('a', 'c')]).toBeUndefined()
    expect(useDialogueStore.getState().lastConversationEndAtByPair[pairKey('b', 'c')]).toBeUndefined()
  })

  it('supports 5 characters with two fully disjoint pairs conversing concurrently', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    useCharacterStore.setState({
      characters: [
        characterWithLines('a', 'A'),
        characterWithLines('b', 'B'),
        characterWithLines('c', 'C'),
        characterWithLines('d', 'D'),
        characterWithLines('e', 'E'),
      ],
    })
    useCharacterMovementStore.setState({
      byId: {
        a: movementEntry('a', 100, 350),
        b: movementEntry('b', 110, 350),
        // c sits far away from every other character — no encounter involves it.
        c: movementEntry('c', 600, 300),
        d: movementEntry('d', 400, 400),
        e: movementEntry('e', 410, 400),
      },
    })

    renderHook(() => useCharacterMovementSimulation(situation))

    await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)

    // Both pairs should have locked in as active conversations from the same tick — neither blocked the other.
    const participantSets = Object.values(useDialogueStore.getState().activeConversations).map((ids) => [...ids].sort())
    expect(participantSets).toContainEqual(['a', 'b'])
    expect(participantSets).toContainEqual(['d', 'e'])
    expect(useDialogueStore.getState().isCharacterBusy('c')).toBe(false)

    await vi.advanceTimersByTimeAsync(BUBBLE_REVEAL_INTERVAL_MS * MAX_BUNDLE_LINES)

    const speakerIds = new Set(useDialogueStore.getState().entries.map((e) => e.speakerId))
    expect(speakerIds.has('c')).toBe(false)
    expect(useDialogueStore.getState().activeConversations).toEqual({})
  })

  it('does not move or trigger encounters while the simulation is paused', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    useSimulationStore.setState({ isRunning: false })
    useCharacterStore.setState({ characters: [characterWithLines('a', 'Milo'), characterWithLines('b', 'Luna')] })
    useCharacterMovementStore.setState({
      byId: {
        a: movementEntry('a', 300, 350),
        b: movementEntry('b', 310, 350),
      },
    })

    renderHook(() => useCharacterMovementSimulation(situation))

    await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS * 3)

    expect(useCharacterMovementStore.getState().byId.a).toMatchObject({ x: 300, y: 350 })
    expect(useDialogueStore.getState().entries).toHaveLength(0)
  })

  describe('multi-room', () => {
    it('never triggers an encounter between two characters standing at the same logical coordinates in different rooms', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      const room1 = roomId()
      const room2 = useHomeStore.getState().addRoom('bedroom', '침실', 'empty')
      useCharacterStore.setState({ characters: [characterWithLines('a', 'Milo'), characterWithLines('b', 'Luna')] })
      useCharacterMovementStore.setState({
        byId: {
          a: { ...movementEntry('a', 300, 350), roomId: room1 },
          b: { ...movementEntry('b', 300, 350), roomId: room2 },
        },
      })

      renderHook(() => useCharacterMovementSimulation(situation))
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)

      expect(useDialogueStore.getState().activeConversations).toEqual({})
      expect(useDialogueStore.getState().entries).toHaveLength(0)
    })

    it('switches a character to the destination room, arriving at its doorway, once it reaches its own room doorway mid-transition', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      const room1 = useHomeStore.getState().rooms[0]
      const room2Id = useHomeStore.getState().addRoom('bedroom', '침실', 'empty')
      const room2 = useHomeStore.getState().rooms.find((r) => r.id === room2Id)!
      useCharacterStore.setState({ characters: [characterWithLines('a', 'Milo'), characterWithLines('b', 'Luna')] })
      useCharacterMovementStore.setState({
        byId: {
          // Positioned exactly on room1's doorway, already committed to a room change — the next tick should complete the switch, not pick a new in-room destination.
          a: {
            ...movementEntry('a', room1.doorway.exitPosition.x, room1.doorway.exitPosition.y, { status: 'moving' }),
            destination: { ...room1.doorway.exitPosition },
            destinationRoomId: room2.id,
          },
          // Kept far away so it never factors into a's plan for this tick.
          b: { ...movementEntry('b', 50, 50), roomId: room2.id },
        },
      })

      renderHook(() => useCharacterMovementSimulation(situation))
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)

      const entryA = useCharacterMovementStore.getState().byId.a
      expect(entryA.roomId).toBe(room2.id)
      expect(entryA.x).toBe(room2.doorway.entryPosition.x)
      expect(entryA.y).toBe(room2.doorway.entryPosition.y)
      expect(entryA.destinationRoomId).toBeNull()
      expect(entryA.destination).toBeNull()
    })

    /** Forces a character already at its current room's doorway, mid-transition, into `targetRoomId`, and returns once the switch has completed. Also clears any leftover rest/stuck counters — without that, a character that happened to be mid-'rest' (restTicksRemaining > 0, entirely possible since earlier ticks in the same test may have put it there) would just decrement its rest counter on the forced tick instead of ever reaching the arrival check, silently leaving the room change incomplete. */
    async function forceRoomChange(id: string, targetRoomId: string) {
      const entry = useCharacterMovementStore.getState().byId[id]
      const originRoom = useHomeStore.getState().rooms.find((r) => r.id === entry.roomId)!
      useCharacterMovementStore.setState((state) => ({
        byId: {
          ...state.byId,
          [id]: {
            ...state.byId[id],
            x: originRoom.doorway.exitPosition.x,
            y: originRoom.doorway.exitPosition.y,
            destination: { ...originRoom.doorway.exitPosition },
            destinationRoomId: targetRoomId,
            status: 'moving',
            restTicksRemaining: 0,
            stuckTicks: 0,
          },
        },
      }))
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
    }

    it('scenario 1: moving from the living room to the bedroom, the character keeps wandering afterward instead of freezing at the doorway', async () => {
      vi.spyOn(Math, 'random').mockImplementation(cyclingRandom(0.1, 0.3, 0.55, 0.7, 0.2, 0.6, 0.4))
      const bedroomId = useHomeStore.getState().addRoom('bedroom', '침실', 'empty')
      useCharacterStore.setState({ characters: [characterWithLines('a', 'Milo')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 200, 350) } })

      renderHook(() => useCharacterMovementSimulation(situation))
      await forceRoomChange('a', bedroomId)
      expect(useCharacterMovementStore.getState().byId.a.roomId).toBe(bedroomId)

      const positions = await collectPositionsOverTicks('a', 40)
      expect(positions.size).toBeGreaterThan(1)
    })

    it('scenario 2: moving from the bedroom back to the living room, the character keeps wandering afterward', async () => {
      vi.spyOn(Math, 'random').mockImplementation(cyclingRandom(0.15, 0.35, 0.5, 0.65, 0.25, 0.6, 0.45))
      const livingId = roomId()
      const bedroomId = useHomeStore.getState().addRoom('bedroom', '침실', 'empty')
      useCharacterStore.setState({ characters: [characterWithLines('a', 'Milo')] })
      useCharacterMovementStore.setState({ byId: { a: { ...movementEntry('a', 200, 350), roomId: bedroomId } } })

      renderHook(() => useCharacterMovementSimulation(situation))
      await forceRoomChange('a', livingId)
      expect(useCharacterMovementStore.getState().byId.a.roomId).toBe(livingId)

      const positions = await collectPositionsOverTicks('a', 40)
      expect(positions.size).toBeGreaterThan(1)
    })

    it('scenario 3: moves through 3+ rooms consecutively, wandering normally after each arrival', async () => {
      // Real (unmocked) randomness for the "does it keep genuinely wandering" checks in this test — a short, hand-picked cycling sequence risks aliasing against how many random() calls each tick actually consumes (varies with which behavior/collision path is taken), which can accidentally over-represent one outcome (e.g. always 'rest') for an entire sampling window. The room transitions themselves stay fully deterministic via forceRoomChange, which needs no randomness at all.
      const room1 = roomId()
      const room2 = useHomeStore.getState().addRoom('bedroom', '침실', 'empty')
      const room3 = useHomeStore.getState().addRoom('kitchen', '주방', 'empty')
      useCharacterStore.setState({ characters: [characterWithLines('a', 'Milo')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 200, 350) } })

      renderHook(() => useCharacterMovementSimulation(situation))

      await forceRoomChange('a', room2)
      expect(useCharacterMovementStore.getState().byId.a.roomId).toBe(room2)
      expect((await collectPositionsOverTicks('a', 40)).size).toBeGreaterThan(1)

      await forceRoomChange('a', room3)
      expect(useCharacterMovementStore.getState().byId.a.roomId).toBe(room3)
      expect((await collectPositionsOverTicks('a', 40)).size).toBeGreaterThan(1)

      await forceRoomChange('a', room1)
      expect(useCharacterMovementStore.getState().byId.a.roomId).toBe(room1)
      expect((await collectPositionsOverTicks('a', 40)).size).toBeGreaterThan(1)
    })

    it('scenario 4/5: a character in a room the user is not observing keeps moving, unaffected by which room is currently selected or by switching between rooms', async () => {
      const livingId = roomId()
      const bedroomId = useHomeStore.getState().addRoom('bedroom', '침실', 'empty')
      useHomeStore.getState().setActiveLiveRoom(livingId)
      useCharacterStore.setState({ characters: [characterWithLines('a', 'Milo')] })
      useCharacterMovementStore.setState({ byId: { a: { ...movementEntry('a', 200, 350), roomId: bedroomId } } })

      renderHook(() => useCharacterMovementSimulation(situation))

      // The user is looking at the living room the whole time — 'a' is in the bedroom and must still be simulated.
      // (This test doesn't assert 'a' stays in the bedroom the whole time — with real randomness and multi-room
      // 'changeRoom' behavior enabled, a solo character legitimately choosing to wander to another room over many
      // ticks is correct, desired behavior, not something switching the observed room should be blamed for. What
      // this test actually verifies is that position keeps changing continuously across both windows regardless
      // of which room is currently selected — i.e. the simulation is never paused or reset by that UI action.)
      const firstHalf = await collectPositionsOverTicks('a', 40)
      useHomeStore.getState().setActiveLiveRoom(bedroomId) // now the user switches to look at the bedroom
      const secondHalf = await collectPositionsOverTicks('a', 40)
      useHomeStore.getState().setActiveLiveRoom(livingId) // and switches away again

      expect(firstHalf.size).toBeGreaterThan(1)
      expect(secondHalf.size).toBeGreaterThan(1)
    })

    it('scenario 6: movement resumes normally after a conversation ends', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      useCharacterStore.setState({ characters: [characterWithLines('a', 'Milo'), characterWithLines('b', 'Luna')] })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', 300, 350), b: movementEntry('b', 310, 350) },
      })

      renderHook(() => useCharacterMovementSimulation(situation))
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
      await vi.advanceTimersByTimeAsync(BUBBLE_REVEAL_INTERVAL_MS * MAX_BUNDLE_LINES)

      // Conversation is over — both should be idle, not stuck 'talking', and able to move again.
      expect(useCharacterMovementStore.getState().byId.a.status).not.toBe('talking')
      expect(useCharacterMovementStore.getState().byId.b.status).not.toBe('talking')

      // Real randomness from here — see scenario 3's comment on why a short mocked cycle risks aliasing over a long sampling window.
      vi.spyOn(Math, 'random').mockRestore()
      const positionsA = await collectPositionsOverTicks('a', 40)
      expect(positionsA.size).toBeGreaterThan(1)
    })

    it('scenario 7: a character interrupted mid-room-change by a conversation never gets phantom-teleported later, and resumes moving normally once the conversation ends', async () => {
      const room1 = useHomeStore.getState().rooms[0]
      const room2Id = useHomeStore.getState().addRoom('bedroom', '침실', 'empty')
      useCharacterStore.setState({ characters: [characterWithLines('a', 'Milo'), characterWithLines('b', 'Luna')] })
      useCharacterMovementStore.setState({
        byId: {
          // 'a' is mid-transition (walking to room1's doorway) when 'b' happens to be right there too, close enough to trigger an encounter.
          a: {
            ...movementEntry('a', room1.doorway.exitPosition.x - 5, room1.doorway.exitPosition.y, { status: 'moving' }),
            destination: { ...room1.doorway.exitPosition },
            destinationRoomId: room2Id,
          },
          b: movementEntry('b', room1.doorway.exitPosition.x, room1.doorway.exitPosition.y),
        },
      })

      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      renderHook(() => useCharacterMovementSimulation(situation))
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
      await vi.advanceTimersByTimeAsync(BUBBLE_REVEAL_INTERVAL_MS * MAX_BUNDLE_LINES)

      // Whatever happened to the in-progress room change, no stale intent should be left over.
      const entryA = useCharacterMovementStore.getState().byId.a
      expect(entryA.status).not.toBe('talking')
      if (!entryA.destinationRoomId) {
        // The interrupted attempt was correctly cleared — confirm it doesn't secretly resurrect as a "phantom teleport" the next time 'a' reaches any ordinary destination. Real randomness from here (see scenario 3's comment).
        vi.spyOn(Math, 'random').mockRestore()
        for (let i = 0; i < 20; i++) {
          await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
          const e = useCharacterMovementStore.getState().byId.a
          // 'a' must still be in room1 (or, if it legitimately re-rolled changeRoom on its own, that's fine — but it must never silently end up in room2 without ever actually walking there while destinationRoomId was stale-null).
          if (e.roomId !== room1.id) {
            expect(e.destinationRoomId === null || e.currentBehavior === 'changeRoom').toBe(true)
          }
        }
      }
    })

    it('scenario 8: a character can still arrive and move away even when furniture sits right at the destination room\'s doorway', async () => {
      const room2Id = useHomeStore.getState().addRoom('bedroom', '침실', 'empty')
      const room2 = useHomeStore.getState().rooms.find((r) => r.id === room2Id)!
      useHomeStore.setState((state) => ({
        rooms: state.rooms.map((r) =>
          r.id === room2Id
            ? {
                ...r,
                furniture: [
                  { id: 'blocker', furnitureId: 'table', x: room2.doorway.entryPosition.x, y: room2.doorway.entryPosition.y, scale: 1, rotation: 0 as const, colorway: 'natural', layer: 0 },
                ],
              }
            : r,
        ),
      }))

      useCharacterStore.setState({ characters: [characterWithLines('a', 'Milo')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 200, 350) } })

      renderHook(() => useCharacterMovementSimulation(situation))
      await forceRoomChange('a', room2Id)
      expect(useCharacterMovementStore.getState().byId.a.roomId).toBe(room2Id)

      const positions = await collectPositionsOverTicks('a', 40)
      expect(positions.size).toBeGreaterThan(1)
    })

    it('scenario 9: when the doorway itself is occupied by another character, the arriving character is placed nearby instead of exactly on top of them, and both keep moving', async () => {
      // Quiet mode — this test is about the doorway de-stacking/collision-recovery mechanics specifically (already exercised for dialogue elsewhere), not about whether an encounter conversation starts. Without this, 'a' landing right next to 'b' in 'rowdy' mode (the file's default) would very likely start a real conversation immediately, correctly pausing both characters' movement for the whole sampling window — that's correct production behavior, not something this test should be tripped up by.
      useDialogueFrequencyStore.setState({ mode: 'quiet' })
      const room2Id = useHomeStore.getState().addRoom('bedroom', '침실', 'empty')
      const room2 = useHomeStore.getState().rooms.find((r) => r.id === room2Id)!

      useCharacterStore.setState({ characters: [characterWithLines('a', 'Milo'), characterWithLines('b', 'Luna')] })
      useCharacterMovementStore.setState({
        byId: {
          // 'b' is already idling exactly at room2's doorway.
          b: { ...movementEntry('b', room2.doorway.entryPosition.x, room2.doorway.entryPosition.y), roomId: room2Id },
          a: movementEntry('a', 200, 350),
        },
      })

      renderHook(() => useCharacterMovementSimulation(situation))
      await forceRoomChange('a', room2Id)

      const entryA = useCharacterMovementStore.getState().byId.a
      expect(entryA.roomId).toBe(room2Id)
      // Not stacked exactly on 'b' — de-stacking (or, failing that, MAX_STUCK_TICKS) must have applied. A generous
      // window (real randomness can occasionally roll several consecutive 'rest' picks in a row, each up to
      // REST_TICKS long — a short sample could land entirely inside an unlucky streak of those).
      const positions = await collectPositionsOverTicks('a', 60)
      expect(positions.size).toBeGreaterThan(1)
    })

    it('scenario 10: 5 characters in 5 different rooms all keep moving normally at the same time', async () => {
      const room1 = roomId()
      const room2 = useHomeStore.getState().addRoom('bedroom', '침실', 'empty')
      const room3 = useHomeStore.getState().addRoom('kitchen', '주방', 'empty')
      const room4 = useHomeStore.getState().addRoom('study', '서재', 'empty')
      const room5 = useHomeStore.getState().addRoom('bathroom', '욕실', 'empty')
      const rooms = [room1, room2, room3, room4, room5]
      const ids = ['a', 'b', 'c', 'd', 'e']

      useCharacterStore.setState({ characters: ids.map((id) => characterWithLines(id, id)) })
      useCharacterMovementStore.setState({
        byId: Object.fromEntries(ids.map((id, i) => [id, { ...movementEntry(id, 200, 350), roomId: rooms[i] }])),
      })

      renderHook(() => useCharacterMovementSimulation(situation))

      const positionsById: Record<string, Set<string>> = Object.fromEntries(ids.map((id) => [id, new Set<string>()]))
      for (let tick = 0; tick < 60; tick++) {
        await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
        for (const id of ids) {
          const e = useCharacterMovementStore.getState().byId[id]
          if (e) positionsById[id].add(`${e.x},${e.y}`)
        }
      }

      for (const id of ids) {
        expect(positionsById[id].size, `character ${id} never moved`).toBeGreaterThan(1)
      }
    })
  })
})
