import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import App from './App'
import { BGM_TRACKS } from '../features/bgm/bgmConfig'
import { bgmAudioElement } from '../features/bgm/bgmAudioElement'
import { useBgmStore } from '../features/bgm/bgmStore'
import { useCharacterStore } from '../features/character/characterStore'
import { EMPTY_AI_PROFILE, type Character } from '../features/character/types'
import { endActiveConversationsFor } from '../features/dialogue/autoDialogueTrigger'
import { useDialogueFrequencyStore } from '../features/dialogue/dialogueFrequencyStore'
import { useDialogueStore } from '../features/dialogue/dialogueStore'
import { useMonologueFrequencyStore } from '../features/dialogue/monologueFrequencyStore'
import { useMonologueStore } from '../features/dialogue/monologueStore'
import { useRelationshipStore } from '../features/dialogue/relationshipStore'
import { useSituationCategoryStore } from '../features/dialogue/situationCategoryStore'
import { getActiveDecorateRoom, useHomeStore } from '../features/home/homeStore'
import { ROOM_HEIGHT, ROOM_WIDTH } from '../features/home/roomLayout'
import { LiveRoomView } from '../features/simulation/LiveRoomView'
import { useCharacterMovementStore, type CharacterMovementState } from '../features/simulation/characterMovementStore'
import { MAX_STUCK_TICKS, MOVEMENT_TICK_MS } from '../features/simulation/movementConfig'
import { useSimulationStore } from '../features/simulation/simulationStore'
import { useCharacterMovementSimulation } from '../features/simulation/useCharacterMovementSimulation'
import type { FurniturePlacement } from '../features/home/types'

const situation = { time: '', place: '', actionA: '', actionB: '' }

function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function character(id: string, tags: string[] = []): Character {
  return {
    id,
    name: `이름-${id}`,
    imageDataUrl: `data:image/png;base64,PNG-${id}`,
    displayScale: 1,
    footOffsetRatio: 0,
    imageBounds: null,
    traits: { personality: '', favoriteColor: '' },
    aiProfile: { ...EMPTY_AI_PROFILE, personalityTags: tags },
  }
}

function placement(id: string, furnitureId: string, x: number, y: number, extra: Partial<FurniturePlacement> = {}): FurniturePlacement {
  return { id, furnitureId, x, y, scale: 1, rotation: 0, colorway: 'cream', layer: 0, ...extra }
}

function resetAll() {
  localStorage.clear()
  const room = useHomeStore.getInitialState().rooms[0]
  useHomeStore.setState({ rooms: [{ ...room, furniture: [] }], activeDecorateRoomId: room.id, activeLiveRoomId: room.id, selectedFurnitureId: null })
  useCharacterStore.setState({ characters: [] })
  useCharacterMovementStore.setState({ byId: {} })
  useDialogueStore.setState({ entries: [], activeConversations: {}, lastConversationEndAtByPair: {}, recentAutoLineIdsByCharacter: {}, recentDefaultBundleIdsByPair: {}, activeBubbleByCharacter: {} })
  useMonologueStore.getState().reset()
  useRelationshipStore.setState({ defaultRelationshipType: 'close', relationshipsByPair: {} })
  useSimulationStore.setState({ isRunning: true, tick: 0 })
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** Every write here goes to jsdom's own localStorage, wiped per test — never a real user's data. */
describe('saved data: damaged entries never take the healthy ones with them', () => {
  beforeEach(resetAll)

  const goodRoomA = () => {
    const base = useHomeStore.getInitialState().rooms[0]
    return { ...base, id: 'A', name: '거실', furniture: [placement('f1', 'sofa', 200, 300, { colors: { body: '#171717' } }), placement('f2', 'rug', 300, 380, { variant: 'heart' })] }
  }
  const goodRoomB = () => ({ ...useHomeStore.getInitialState().rooms[0], id: 'B', kind: 'bedroom' as const, name: '침실', furniture: [placement('g1', 'bed', 400, 300)] })

  async function loadHome(rooms: unknown, version = 5) {
    localStorage.setItem('dearly-home', JSON.stringify({ state: { rooms, activeDecorateRoomId: 'B', activeLiveRoomId: 'A' }, version }))
    await useHomeStore.persist.rehydrate()
    return useHomeStore.getState()
  }

  it('rooms: null/garbage/id-less/duplicate rooms are skipped, the healthy rooms load intact', async () => {
    const state = await loadHome([null, 'x', 42, { name: '아이디 없음' }, goodRoomA(), { ...goodRoomA(), name: '중복' }, goodRoomB()])
    expect(state.rooms.map((r) => r.id)).toEqual(['A', 'B'])
    expect(state.rooms[0].name).toBe('거실')
    expect(state.rooms[0].furniture).toEqual(goodRoomA().furniture)
    expect(state.rooms[1].furniture).toEqual(goodRoomB().furniture)
    expect(state.activeDecorateRoomId).toBe('B')
    expect(state.activeLiveRoomId).toBe('A')
  })

  it('furniture: null/garbage/id-less/duplicate placements are skipped, the healthy ones keep every field', async () => {
    const room = { ...goodRoomA(), furniture: [null, 7, { furnitureId: 'sofa' }, { id: 'nofurn' }, ...goodRoomA().furniture, placement('f1', 'table', 1, 1)] }
    const state = await loadHome([room, goodRoomB()])
    expect(state.rooms[0].furniture).toEqual(goodRoomA().furniture)
  })

  it('a non-array rooms/furniture value degrades to the default room / an empty room, never a crash', async () => {
    expect((await loadHome('nope')).rooms).toHaveLength(1)
    const state = await loadHome([{ ...goodRoomA(), furniture: 'nope' }, goodRoomB()])
    expect(state.rooms.map((r) => r.id)).toEqual(['A', 'B'])
    expect(state.rooms[0].furniture).toEqual([])
    expect(state.rooms[1].furniture).toEqual(goodRoomB().furniture)
  })

  it('the same holds through every older-version migration path (v3 and v4 saves)', async () => {
    for (const version of [3, 4]) {
      const state = await loadHome([null, goodRoomA(), goodRoomB()], version)
      expect(state.rooms.map((r) => r.id), `v${version}`).toEqual(['A', 'B'])
    }
  })

  it('characters: a damaged entry, a missing list or a bad dialogue line never drops the healthy characters, their PNG or their lines', async () => {
    const good1 = character('c1', ['calm'])
    good1.aiProfile.dialogueLines = [{ id: 'l1', categoryId: 'casual-chat', situationNote: '', text: '안녕', emotion: 'neutral', tags: [], isFallback: false }]
    const good2 = character('c2')
    const dirty1 = { ...good1, aiProfile: { ...good1.aiProfile, dialogueLines: [null, 5, ...good1.aiProfile.dialogueLines, { id: 'bad' }] } }
    localStorage.setItem('dearly-characters', JSON.stringify({ state: { characters: [null, 'x', { name: '아이디 없음' }, dirty1, { ...good1, name: '중복' }, good2] }, version: 0 }))
    await useCharacterStore.persist.rehydrate()
    const loaded = useCharacterStore.getState().characters
    expect(loaded.map((c) => c.id)).toEqual(['c1', 'c2'])
    expect(loaded[0].imageDataUrl).toBe('data:image/png;base64,PNG-c1')
    expect(loaded[0].aiProfile.personalityTags).toEqual(['calm'])
    expect(loaded[0].aiProfile.dialogueLines.map((l) => l.id)).toEqual(['l1'])

    localStorage.setItem('dearly-characters', JSON.stringify({ state: { characters: 'nope' }, version: 0 }))
    await useCharacterStore.persist.rehydrate()
    expect(useCharacterStore.getState().characters).toEqual([])
  })

  it('custom situation categories: junk entries are dropped, real ones kept, a non-list becomes empty', async () => {
    localStorage.setItem('dearly-situation-categories', JSON.stringify({ state: { customCategories: [null, 3, { id: 'x' }, { id: 'k1', label: '산책' }] }, version: 0 }))
    await useSituationCategoryStore.persist.rehydrate()
    expect(useSituationCategoryStore.getState().customCategories).toEqual([{ id: 'k1', label: '산책' }])
    localStorage.setItem('dearly-situation-categories', JSON.stringify({ state: { customCategories: 'nope' }, version: 0 }))
    await useSituationCategoryStore.persist.rehydrate()
    expect(useSituationCategoryStore.getState().customCategories).toEqual([])
  })

  it('unparseable storage text leaves the defaults in place instead of crashing the store', async () => {
    for (const [key, store] of [['dearly-home', useHomeStore], ['dearly-characters', useCharacterStore], ['dearly-relationship', useRelationshipStore], ['dearly-dialogue-frequency', useDialogueFrequencyStore], ['dearly-monologue-frequency', useMonologueFrequencyStore]] as const) {
      localStorage.setItem(key, '{not json')
      await expect(store.persist.rehydrate()).resolves.not.toThrow()
    }
    expect(useHomeStore.getState().rooms.length).toBeGreaterThan(0)
  })
})

describe('migrations are safe to repeat', () => {
  beforeEach(resetAll)

  it('running the home migrate/normalize again on its own output changes nothing (no duplicates, nothing reset)', () => {
    const base = useHomeStore.getInitialState().rooms[0]
    const rooms = [
      { ...base, id: 'A', furniture: [placement('f1', 'sofa', 1, 2, { colors: { body: '#171717' }, patterns: { cushion: { type: 'star', baseColor: '#ffffff', color: '#000000', size: 3 } } }), placement('f2', 'rug', 3, 4, { variant: 'circle' })] },
      { ...base, id: 'B', furniture: [] },
    ]
    const migrate = useHomeStore.persist.getOptions().migrate!
    for (const version of [0, 2, 3, 4, 5]) {
      const legacy = version < 3 ? { furniture: rooms[0].furniture, wallpaper: rooms[0].wallpaper, floor: rooms[0].floor, showWindow: false, showRug: false } : { rooms, activeDecorateRoomId: 'A', activeLiveRoomId: 'B' }
      const once = migrate(legacy, version) as { rooms: unknown[] }
      const twice = migrate(once, 5) as { rooms: unknown[] }
      const thrice = migrate(twice, 3) as { rooms: unknown[] }
      expect(twice, `v${version}`).toEqual(once)
      expect(thrice, `v${version}`).toEqual(once)
    }
  })

  it('reloading the same save repeatedly is stable: identical state every time, nothing added or lost', async () => {
    const base = useHomeStore.getInitialState().rooms[0]
    const blob = JSON.stringify({ state: { rooms: [{ ...base, id: 'A', furniture: [placement('f1', 'wardrobe', 100, 200, { colors: { door: '#581D32' } })] }, { ...base, id: 'B' }], activeDecorateRoomId: 'A', activeLiveRoomId: 'B' }, version: 5 })
    localStorage.setItem('dearly-home', blob)
    await useHomeStore.persist.rehydrate()
    const first = JSON.stringify(useHomeStore.getState().rooms)
    for (let i = 0; i < 3; i++) {
      localStorage.setItem('dearly-home', JSON.stringify({ state: JSON.parse(localStorage.getItem('dearly-home')!).state, version: 5 }))
      await useHomeStore.persist.rehydrate()
      expect(JSON.stringify(useHomeStore.getState().rooms)).toBe(first)
    }
  })

  it('an old (v3) save with 5 rooms keeps all 5 rooms, names and furniture through the current migration', async () => {
    const base = useHomeStore.getInitialState().rooms[0]
    const rooms = ['A', 'B', 'C', 'D', 'E'].map((id, i) => ({ ...base, id, name: `방${i}`, furniture: [placement(`f${i}`, 'sofa', 100 + i * 10, 300)] }))
    localStorage.setItem('dearly-home', JSON.stringify({ state: { rooms, activeDecorateRoomId: 'C', activeLiveRoomId: 'E' }, version: 3 }))
    await useHomeStore.persist.rehydrate()
    const state = useHomeStore.getState()
    expect(state.rooms.map((r) => [r.id, r.name, r.furniture.length])).toEqual([['A', '방0', 1], ['B', '방1', 1], ['C', '방2', 1], ['D', '방3', 1], ['E', '방4', 1]])
    expect(state.activeDecorateRoomId).toBe('C')
  })
})

describe('a character whose room disappears is brought back, not lost', () => {
  beforeEach(resetAll)

  it('the tick relocates an orphaned character into an existing room, and it is visible there', async () => {
    vi.useFakeTimers()
    const first = useHomeStore.getState().rooms[0].id
    const second = useHomeStore.getState().addRoom('bedroom', '침실', 'empty')
    useCharacterStore.setState({ characters: [character('a'), character('b')] })
    const entry = (id: string, roomId: string): CharacterMovementState => ({ id, roomId, x: 300, y: 350, destination: null, destinationRoomId: null, currentBehavior: null, status: 'idle', restTicksRemaining: 0, stuckTicks: 0 })
    useCharacterMovementStore.setState({ byId: { a: entry('a', first), b: entry('b', second) } })
    useDialogueFrequencyStore.setState({ mode: 'quiet' })
    useMonologueFrequencyStore.setState({ mode: 'off' })

    useHomeStore.getState().removeRoom(second) // the character in it is left pointing at a room that no longer exists
    renderHook(() => useCharacterMovementSimulation(situation))
    await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS * 3)

    const b = useCharacterMovementStore.getState().byId.b
    expect(useHomeStore.getState().rooms.map((r) => r.id)).toContain(b.roomId)
    expect(b.destinationRoomId).toBeNull()

    render(<LiveRoomView />)
    expect(screen.getAllByText(/이름-/)).toHaveLength(2) // both characters render in the one remaining room
  })

  it('a character walking toward a room that gets deleted just stays where it is and picks something new', async () => {
    vi.useFakeTimers()
    const first = useHomeStore.getState().rooms[0].id
    const second = useHomeStore.getState().addRoom('bedroom', '침실', 'empty')
    const room = useHomeStore.getState().rooms[0]
    useCharacterStore.setState({ characters: [character('a')] })
    useCharacterMovementStore.setState({
      byId: { a: { id: 'a', roomId: first, x: room.doorway.exitPosition.x, y: room.doorway.exitPosition.y, destination: room.doorway.exitPosition, destinationRoomId: second, currentBehavior: 'changeRoom', status: 'moving', restTicksRemaining: 0, stuckTicks: 0 } },
    })
    useDialogueFrequencyStore.setState({ mode: 'quiet' })
    useMonologueFrequencyStore.setState({ mode: 'off' })
    useHomeStore.getState().removeRoom(second)
    renderHook(() => useCharacterMovementSimulation(situation))
    await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS * 6)
    const a = useCharacterMovementStore.getState().byId.a
    expect(a.roomId).toBe(first)
    expect(a.destinationRoomId).not.toBe(second)
  })
})

describe('five characters living across five rooms', () => {
  beforeEach(resetAll)

  // Several seeds: the run is deterministic per seed, so a failure is reproducible, and different seeds reach different meetings/doorway collisions.
  it.each([20260921, 7, 991, 31337, 424242])('runs 20 simulated minutes with conversations, monologues, room changes, a character removal and a room deletion — every invariant holding each tick (seed %i)', async (seed) => {
    vi.useFakeTimers()
    // Pinned: without this, `vi.useFakeTimers()` starts the fake clock at whatever the *real* wall-clock time
    // happens to be, so `new Date().getHours()` (movementEngine.ts's roomKindBiasForHour, monologue time-band
    // gating) varies with whenever the suite is actually run — a real, latent source of nondeterminism in a test
    // whose whole point is "seeded = reproducible". Found while investigating an otherwise-unexplained failure of
    // seed 991's `roomsVisited.size > 1` assertion: identical seed, identical code, but a different real-world hour
    // at run time shifted the room-change bias enough to occasionally keep every character in its starting room for
    // the whole 20 simulated minutes. 15:00 is a neutral daytime hour (not a mealtime/night bias window).
    vi.setSystemTime(new Date('2026-01-15T15:00:00'))
    vi.spyOn(Math, 'random').mockImplementation(seeded(seed))

    // 5 rooms with a few obstacles (one right at the shared doorway spot) and non-blocking rugs/wall decor.
    const first = useHomeStore.getState().rooms[0].id
    const roomIds = [first, ...['bedroom', 'kitchen', 'study', 'hobby'].map((kind, i) => useHomeStore.getState().addRoom(kind as 'bedroom', `방${i}`, 'empty'))]
    expect(roomIds).toHaveLength(5)
    const doorway = useHomeStore.getState().rooms[0].doorway.exitPosition
    roomIds.forEach((roomId, i) => {
      useHomeStore.getState().setActiveDecorateRoom(roomId)
      useHomeStore.getState().addFurniture(placement(`rug${i}`, 'rug', 360, 380, { layer: -1, variant: ['ellipse', 'circle', 'rect', 'heart'][i % 4] }))
      useHomeStore.getState().addFurniture(placement(`clock${i}`, 'wall-clock', 200, 100))
      if (i % 2 === 0) useHomeStore.getState().addFurniture(placement(`sofa${i}`, 'sofa-long', doorway.x, doorway.y - 60, { colors: { body: '#171717' } }))
      if (i % 2 === 1) useHomeStore.getState().addFurniture(placement(`ward${i}`, 'wardrobe', 500, 330))
    })
    useHomeStore.getState().setActiveDecorateRoom(first)
    useHomeStore.getState().setActiveLiveRoom(first)

    const ids = ['c1', 'c2', 'c3', 'c4', 'c5']
    useCharacterStore.setState({ characters: ids.map((id) => character(id, ['curious', 'energetic', 'sociable'])) })
    useRelationshipStore.getState().setRelationshipType('c1', 'c2', 'romantic')
    useRelationshipStore.getState().setRelationshipType('c3', 'c4', 'married')
    useDialogueFrequencyStore.setState({ mode: 'rowdy' })
    useMonologueFrequencyStore.setState({ mode: 'veryFrequent' })

    renderHook(() => useCharacterMovementSimulation(situation))

    const lastMoveAt: Record<string, { key: string; tick: number }> = {}
    const roomsVisited = new Set<string>()
    const distinctPositions: Record<string, Set<string>> = {}
    let sawConversation = false
    let sawMonologue = false
    let liveIds = [...ids]
    let liveRooms = [...roomIds]
    const TICKS = 4800 // 20 simulated minutes

    for (let tick = 1; tick <= TICKS; tick++) {
      // The removals happen *before* this tick runs, so the tick's own sync/cleanup is what the invariants below observe.
      if (tick === 1500) {
        // Removing a character mid-simulation — mirrors CharacterList.tsx's handleRemove exactly (end its
        // conversations immediately, drop its monologue history, then remove it), so a character deleted while
        // mid-conversation can never leave the survivor's bubble/movement/busy-lock dangling.
        act(() => {
          endActiveConversationsFor('c5')
          useMonologueStore.getState().forgetCharacter('c5')
          useCharacterStore.getState().removeCharacter('c5')
        })
        liveIds = ids.filter((id) => id !== 'c5')
      }
      if (tick === 2500) {
        // The room-deletion flow RoomTabs performs: end each occupant's conversation, then relocate it to the target room's doorway, then remove the room.
        const doomed = liveRooms[3]
        const target = useHomeStore.getState().rooms.find((r) => r.id === liveRooms[0])!
        for (const [id, entry] of Object.entries(useCharacterMovementStore.getState().byId)) {
          if (entry.roomId === doomed) {
            endActiveConversationsFor(id)
            useCharacterMovementStore.getState().moveCharacterToRoom(id, target.id, target.doorway.entryPosition)
          }
        }
        act(() => useHomeStore.getState().removeRoom(doomed))
        liveRooms = liveRooms.filter((id) => id !== doomed)
      }

      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)

      const movement = useCharacterMovementStore.getState().byId
      const dialogue = useDialogueStore.getState()
      const monologue = useMonologueStore.getState()

      // (a) the runtime state is exactly the living characters, each in an existing room
      expect(Object.keys(movement).sort(), `tick ${tick}`).toEqual([...liveIds].sort())
      for (const [id, e] of Object.entries(movement)) {
        expect(liveRooms, `tick ${tick} ${id} room`).toContain(e.roomId)
        expect(Number.isFinite(e.x) && Number.isFinite(e.y), `tick ${tick} ${id} finite`).toBe(true)
        expect(e.x).toBeGreaterThanOrEqual(0)
        expect(e.x).toBeLessThanOrEqual(ROOM_WIDTH)
        expect(e.y).toBeGreaterThanOrEqual(0)
        expect(e.y).toBeLessThanOrEqual(ROOM_HEIGHT)
        expect(e.stuckTicks, `tick ${tick} ${id} stuck`).toBeLessThanOrEqual(MAX_STUCK_TICKS)
        if (e.destinationRoomId) expect(e.destinationRoomId).not.toBe(e.roomId)
        roomsVisited.add(e.roomId)
        ;(distinctPositions[id] ??= new Set()).add(`${Math.round(e.x)},${Math.round(e.y)}`)

        // (b) no character stays frozen: outside of talking/resting, it must keep changing position
        const key = `${e.x},${e.y},${e.roomId}`
        const frozen = e.status === 'talking' || e.restTicksRemaining > 0
        if (!lastMoveAt[id] || lastMoveAt[id].key !== key || frozen) lastMoveAt[id] = { key, tick }
        expect(tick - lastMoveAt[id].tick, `tick ${tick}: ${id} froze at ${key}`).toBeLessThan(160)
      }

      // (c) nobody is in two conversations; talkers share a room and are 'talking'
      const seen = new Set<string>()
      for (const participants of Object.values(dialogue.activeConversations)) {
        sawConversation = true
        // Every participant of a live conversation must be a real, tracked character sharing one room and marked 'talking' —
        // unconditionally now: endActiveConversationsFor (called above, exactly as CharacterList.tsx/RoomTabs.tsx do) guarantees
        // a removed-or-relocated character's conversation ends immediately, so no dangling/desynced participant ever reaches here.
        const rooms = new Set(participants.map((p) => movement[p]?.roomId))
        expect(rooms.size, `tick ${tick} conversation spans rooms`).toBe(1)
        for (const p of participants) {
          expect(seen.has(p), `tick ${tick}: ${p} in two conversations`).toBe(false)
          seen.add(p)
          expect(movement[p], `tick ${tick}: ${p} missing`).toBeDefined()
          expect(movement[p].status, `tick ${tick}: ${p}`).toBe('talking')
        }
      }

      // (d) a monologue never coexists with a conversation for the same character, and only living characters have one
      for (const id of Object.keys(monologue.activeByCharacter)) {
        sawMonologue = true
        if (liveIds.includes(id)) {
          expect(seen.has(id), `tick ${tick}: ${id} mutters while talking`).toBe(false)
          expect(dialogue.activeBubbleByCharacter[id], `tick ${tick}: ${id} has both bubbles`).toBeUndefined()
        }
      }
    }

    // liveness: the run really exercised everything
    expect(sawConversation).toBe(true)
    expect(sawMonologue).toBe(true)
    expect(roomsVisited.size).toBeGreaterThan(1)
    for (const id of liveIds) expect(distinctPositions[id].size, `${id} moved`).toBeGreaterThan(30)
    expect(useHomeStore.getState().rooms).toHaveLength(4)
    // everything the characters said was appended, never replaced
    expect(useDialogueStore.getState().entries.length).toBeGreaterThan(0)
    // furniture that must never block did not: the rugs and wall clocks left no obstacles behind
    expect(getActiveDecorateRoom(useHomeStore.getState()).furniture.filter((f) => f.furnitureId === 'rug' || f.furnitureId === 'wall-clock')).toHaveLength(2)
  }, 120_000)
})

describe('BGM assets and the app shell', () => {
  const TIME_BANDS = ['morning', 'daytime', 'evening', 'night']

  it('every enabled registered track points at an MP3 that really exists in public/music, with unique ids', () => {
    // Only the list of file names is read (glob keys) — the MP3s themselves are never opened, changed or deleted.
    const files = Object.keys(import.meta.glob('/public/music/*.mp3')).map((path) => path.split('/').pop())
    const enabled = BGM_TRACKS.filter((t) => t.enabled)
    expect(enabled.length).toBeGreaterThan(0)
    expect(new Set(BGM_TRACKS.map((t) => t.id)).size).toBe(BGM_TRACKS.length)
    for (const track of enabled) {
      expect(files, `${track.id} -> public/music/${track.fileName}`).toContain(track.fileName)
      expect([...TIME_BANDS, 'common']).toContain(track.band)
    }
  })

  it('each of the four time bands has an enabled track, so every hour of the day has music', () => {
    for (const band of TIME_BANDS) expect(BGM_TRACKS.some((t) => t.enabled && t.band === band), band).toBe(true)
  })

  it('the app creates exactly one Audio element anywhere in its source', () => {
    const sources = import.meta.glob(['../**/*.ts', '../**/*.tsx', '!../**/*.test.ts', '!../**/*.test.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    const hits = Object.entries(sources).filter(([, text]) => /new Audio\(/.test(text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')))
    expect(hits.map(([path]) => path)).toEqual(['../features/bgm/bgmAudioElement.ts'])
  })

  it('boots (also under StrictMode), moves through every screen, and keeps the one BGM player and audio element throughout', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    resetAll()
    useCharacterStore.setState({ characters: [character('a'), character('b')] })
    useDialogueFrequencyStore.setState({ mode: 'quiet' })
    useMonologueFrequencyStore.setState({ mode: 'off' })
    useBgmStore.setState({ volume: 0.4, muted: false, bgmEnabled: true })
    const audio = bgmAudioElement

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    for (const label of ['집 꾸미기', '함께 생활하기', '캐릭터 설정', '함께 생활하기']) {
      fireEvent.click(screen.getByRole('button', { name: label }))
      expect(screen.getByRole('button', { name: 'BGM 켜짐' }), label).toBeInTheDocument()
      expect(bgmAudioElement).toBe(audio)
    }
    expect(useBgmStore.getState().volume).toBe(0.4) // settings survive screen switches
    expect(document.querySelectorAll('audio')).toHaveLength(0) // the element is never mounted twice into the page
  })

  /**
   * The real user flow the save/load UI-placement fix was about: clicking
   * the actual top-nav "캐릭터 설정" button (not just rendering `SetupScreen`
   * directly, and not just checking a component's name) must show the
   * 저장/불러오기 buttons, and the 집 꾸미기 screen — where they used to live
   * by mistake — must not show them at all, so there's never a duplicate.
   */
  it('the top-nav "캐릭터 설정" button opens the real screen with 저장/불러오기; 집 꾸미기 has none', () => {
    resetAll()
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '캐릭터 설정' }))
    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '불러오기' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '집 꾸미기' }))
    expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '불러오기' })).not.toBeInTheDocument()
  })
})
