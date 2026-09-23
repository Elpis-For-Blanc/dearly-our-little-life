import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { useCharacterStore } from '../character/characterStore'
import { CharacterList } from '../character/CharacterList'
import { EMPTY_AI_PROFILE, type Character } from '../character/types'
import { BUBBLE_REVEAL_INTERVAL_MS } from '../dialogue/autoDialogueConfig'
import { startManualConversation } from '../dialogue/autoDialogueTrigger'
import { useDialogueFrequencyStore } from '../dialogue/dialogueFrequencyStore'
import { useDialogueStore } from '../dialogue/dialogueStore'
import { useRelationshipStore } from '../dialogue/relationshipStore'
import { useMonologueFrequencyStore } from '../dialogue/monologueFrequencyStore'
import { useMonologueStore } from '../dialogue/monologueStore'
import { getFurnitureDefinition } from '../home/furnitureCatalog'
import { useHomeStore } from '../home/homeStore'
import { FurniturePropertiesPanel } from '../home/FurniturePropertiesPanel'
import { RoomTabs } from '../home/RoomTabs'
import type { FurniturePlacement } from '../home/types'
import { useCharacterMovementStore, type CharacterMovementState } from './characterMovementStore'
import { FurnitureUsagePanel } from './FurnitureUsagePanel'
import { getSitSlots, resolveApproachPoint, resolveSeatPosition } from './furnitureInteractionEngine'
import { useFurnitureUsageStore } from './furnitureUsageStore'
import { evictPlacementUsage, standUp, startSitting } from './furnitureUsageTrigger'
import { MAX_FURNITURE_APPROACH_TICKS, MOVEMENT_TICK_MS } from './movementConfig'
import { useSimulationStore } from './simulationStore'
import { useCharacterMovementSimulation } from './useCharacterMovementSimulation'

const SOFA = getFurnitureDefinition('sofa')!
const SOFA_SLOTS = getSitSlots(SOFA) // [sofa-left, sofa-right]
const CHAIR = getFurnitureDefinition('dining-chair')!
const CHAIR_SLOT = getSitSlots(CHAIR)[0] // 'seat'

function character(id: string, name = id): Character {
  return {
    id,
    name,
    imageDataUrl: 'data:image/png;base64,',
    displayScale: 1,
    footOffsetRatio: 0,
    imageBounds: null,
    traits: { personality: '', favoriteColor: '' },
    aiProfile: { ...EMPTY_AI_PROFILE },
  }
}

function movementEntry(id: string, x: number, y: number, roomId: string, overrides: Partial<CharacterMovementState> = {}): CharacterMovementState {
  return { id, roomId, x, y, destination: null, destinationRoomId: null, currentBehavior: null, status: 'idle', restTicksRemaining: 0, stuckTicks: 0, ...overrides }
}

function sofaPlacement(id: string, x = 360, y = 340, overrides: Partial<FurniturePlacement> = {}): FurniturePlacement {
  return { id, furnitureId: 'sofa', x, y, scale: 1, rotation: 0, colorway: 'rose', layer: 0, ...overrides }
}

/** Placed well clear of sofaPlacement's default footprint (x∈[248,472], y∈[292,388]) so the two never interfere. */
function chairPlacement(id: string, x = 560, y = 340, overrides: Partial<FurniturePlacement> = {}): FurniturePlacement {
  return { id, furnitureId: 'dining-chair', x, y, scale: 1, rotation: 0, colorway: 'natural', layer: 0, ...overrides }
}

/**
 * A starting spot that is NOT inside the sofa's or the chair's own solid
 * collision rect — a character that starts *inside* an obstacle would
 * misfire the "blocked, pick a random destination instead" branch on its
 * very first movement tick, discarding the approach point before it ever
 * takes a real step. Every "already walking to / seated on" test starts here.
 */
const SAFE_START_X = 120
const SAFE_START_Y = 150

function situationRef() {
  return { current: { time: '', place: '', actionA: '', actionB: '' } }
}

let roomId: string
let room2Id: string

function resetAll() {
  localStorage.clear()
  const room = useHomeStore.getInitialState().rooms[0]
  useHomeStore.setState({
    rooms: [{ ...room, furniture: [sofaPlacement('sofa-1'), chairPlacement('chair-1')] }],
    activeDecorateRoomId: room.id,
    activeLiveRoomId: room.id,
    selectedFurnitureId: null,
  })
  roomId = room.id
  room2Id = useHomeStore.getState().addRoom('bedroom', '침실', 'empty')
  useCharacterStore.setState({ characters: [] })
  useCharacterMovementStore.setState({ byId: {} })
  useFurnitureUsageStore.getState().reset()
  useDialogueStore.setState({ entries: [], activeConversations: {}, lastConversationEndAtByPair: {}, recentAutoLineIdsByCharacter: {}, recentDefaultBundleIdsByPair: {}, activeBubbleByCharacter: {} })
  useDialogueFrequencyStore.setState({ mode: 'quiet' })
  useMonologueFrequencyStore.setState({ mode: 'off' })
  useMonologueStore.getState().reset()
  useRelationshipStore.setState({ defaultRelationshipType: 'close', relationshipsByPair: {} })
  useSimulationStore.setState({ isRunning: true, tick: 0 })
}

/** Advances the movement tick until `predicate` is true or `maxTicks` elapses; returns whether it succeeded. */
async function advanceUntil(predicate: () => boolean, maxTicks: number): Promise<boolean> {
  for (let i = 0; i < maxTicks; i++) {
    if (predicate()) return true
    await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
  }
  return predicate()
}

function seated(id: string): boolean {
  return useCharacterMovementStore.getState().byId[id]?.status === 'seated'
}

/** Sits `id` on `placementId`'s `slotId` (or the first free one) and waits for arrival; throws (via the assertion) if it never sits — every test that needs a pre-seated character uses this instead of duplicating the walk/wait dance. */
async function sitAndWait(id: string, placementId: string, slotId?: string): Promise<void> {
  const outcome = startSitting(id, placementId, slotId)
  expect(outcome).toBe('started')
  expect(await advanceUntil(() => seated(id), 80)).toBe(true)
}

describe('furniture interaction (phase 2): independent 2-seat sofa + ordinary chairs', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetAll()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('2인용 소파: 독립적인 좌석 사용', () => {
    it('소파 좌석 2개 동시 사용: two characters end up seated at their own distinct slot positions at the same time', async () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 20, SAFE_START_Y, roomId) },
      })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))

      expect(startSitting('a', 'sofa-1', 'sofa-left')).toBe('started')
      expect(startSitting('b', 'sofa-1', 'sofa-right')).toBe('started')
      expect(await advanceUntil(() => seated('a') && seated('b'), 80)).toBe(true)

      const placement = useHomeStore.getState().rooms.find((r) => r.id === roomId)!.furniture.find((f) => f.id === 'sofa-1')!
      const leftSeat = resolveSeatPosition(placement, SOFA_SLOTS[0])
      const rightSeat = resolveSeatPosition(placement, SOFA_SLOTS[1])
      const ea = useCharacterMovementStore.getState().byId.a
      const eb = useCharacterMovementStore.getState().byId.b
      expect(ea.x).toBeCloseTo(leftSeat.x, 3)
      expect(ea.y).toBeCloseTo(leftSeat.y, 3)
      expect(eb.x).toBeCloseTo(rightSeat.x, 3)
      expect(eb.y).toBeCloseTo(rightSeat.y, 3)
      // The two seats are far enough apart on screen that the sprites never overlap.
      expect(Math.abs(ea.x - eb.x)).toBeGreaterThan(60)
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left'].characterId).toBe('a')
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-right'].characterId).toBe('b')
    })

    it('동일 좌석에 대한 동시 요청은 한 명만 성공한다', () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, roomId), b: movementEntry('b', 310, 300, roomId) } })
      expect(startSitting('a', 'sofa-1', 'sofa-left')).toBe('started')
      expect(startSitting('b', 'sofa-1', 'sofa-left')).toBe('occupied') // same exact seat, second request refused
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left'].characterId).toBe('a')
      // The OTHER seat is still completely free — b isn't blocked from the sofa altogether, just that one seat.
      expect(startSitting('b', 'sofa-1', 'sofa-right')).toBe('started')
    })

    it('두 좌석 모두 사용 중이면 새로운 착석 요청(좌석 미지정, 자동 선택)을 거절한다', () => {
      useCharacterStore.setState({ characters: [character('a'), character('b'), character('c')] })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', 300, 300, roomId), b: movementEntry('b', 305, 300, roomId), c: movementEntry('c', 310, 300, roomId) },
      })
      expect(startSitting('a', 'sofa-1', 'sofa-left')).toBe('started')
      expect(startSitting('b', 'sofa-1', 'sofa-right')).toBe('started')
      expect(startSitting('c', 'sofa-1')).toBe('occupied') // no slotId given — every seat on this sofa is taken
      expect(startSitting('c', 'sofa-1', 'sofa-left')).toBe('occupied')
      expect(startSitting('c', 'sofa-1', 'sofa-right')).toBe('occupied')
    })

    it('한 명만 일어나기: standing up one seat never disturbs the other', async () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 20, SAFE_START_Y, roomId) },
      })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      await sitAndWait('a', 'sofa-1', 'sofa-left')
      await sitAndWait('b', 'sofa-1', 'sofa-right')

      standUp('a')
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left']).toBeUndefined()
      expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle')
      // b is completely unaffected — still seated, reservation intact.
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-right']?.characterId).toBe('b')
      expect(useCharacterMovementStore.getState().byId.b.status).toBe('seated')
    })

    it('한 명이 삭제돼도 다른 캐릭터의 착석은 유지된다', async () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 20, SAFE_START_Y, roomId) },
      })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      await sitAndWait('a', 'sofa-1', 'sofa-left')
      await sitAndWait('b', 'sofa-1', 'sofa-right')

      render(<CharacterList />)
      const row = screen.getByText('a').closest<HTMLElement>('.character-list-item')!
      fireEvent.click(within(row).getByRole('button', { name: '삭제' }))

      expect(useCharacterStore.getState().characters.map((c) => c.id)).toEqual(['b'])
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left']).toBeUndefined()
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-right']?.characterId).toBe('b')
      expect(useCharacterMovementStore.getState().byId.b.status).toBe('seated')
    })

    it('소파 삭제 시 두 좌석 모두 안전하게 정리된다', async () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 20, SAFE_START_Y, roomId) },
      })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      await sitAndWait('a', 'sofa-1', 'sofa-left')
      await sitAndWait('b', 'sofa-1', 'sofa-right')

      evictPlacementUsage('sofa-1')
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left']).toBeUndefined()
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-right']).toBeUndefined()
      expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle')
      expect(useCharacterMovementStore.getState().byId.b.status).toBe('idle')
    })

    it('실제 삭제 버튼을 통해 지워도 두 좌석 모두 정리된다', async () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 20, SAFE_START_Y, roomId) },
      })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      await sitAndWait('a', 'sofa-1', 'sofa-left')
      await sitAndWait('b', 'sofa-1', 'sofa-right')

      useHomeStore.getState().selectFurniture('sofa-1')
      render(<FurniturePropertiesPanel />)
      fireEvent.click(screen.getByRole('button', { name: '삭제' }))

      expect(useHomeStore.getState().rooms.find((r) => r.id === roomId)!.furniture.find((f) => f.id === 'sofa-1')).toBeUndefined()
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left']).toBeUndefined()
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-right']).toBeUndefined()
      expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle')
      expect(useCharacterMovementStore.getState().byId.b.status).toBe('idle')
    })

    it('소파 이동·회전 시 두 좌석 모두 정리되고, 좌표는 배치 변환을 그대로 따른다', async () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 20, SAFE_START_Y, roomId) },
      })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      await sitAndWait('a', 'sofa-1', 'sofa-left')
      await sitAndWait('b', 'sofa-1', 'sofa-right')

      evictPlacementUsage('sofa-1') // exactly what FurnitureItem's drag-end / FurniturePropertiesPanel's rotate toggle do first
      useHomeStore.setState({ activeDecorateRoomId: roomId })
      useHomeStore.getState().moveFurniture('sofa-1', 500, 200)
      useHomeStore.getState().updateFurniture('sofa-1', { rotation: 180 })

      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left']).toBeUndefined()
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-right']).toBeUndefined()
      expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle')
      expect(useCharacterMovementStore.getState().byId.b.status).toBe('idle')

      // The new seat coordinates follow the moved+rotated placement exactly — recomputed, never stale.
      const moved = useHomeStore.getState().rooms.find((r) => r.id === roomId)!.furniture.find((f) => f.id === 'sofa-1')!
      const newLeft = resolveSeatPosition(moved, SOFA_SLOTS[0])
      const newRight = resolveSeatPosition(moved, SOFA_SLOTS[1])
      expect(newLeft.x).toBeCloseTo(500 + 39.5) // mirrored: left slot's offsetX (-39.5) flips to +39.5
      expect(newRight.x).toBeCloseTo(500 - 39.5)
      expect(newLeft.y).toBeCloseTo(200 - 9.1)
    })

    it('이미 앉아 있는 캐릭터를 다른(빈) 좌석으로 옮기면 기존 좌석이 해제된 뒤 새 좌석이 예약된다', async () => {
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      await sitAndWait('a', 'sofa-1', 'sofa-left')

      expect(startSitting('a', 'sofa-1', 'sofa-right')).toBe('started')
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left']).toBeUndefined() // old seat released immediately
      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBe('sofa-1:sofa-right')
      expect(await advanceUntil(() => seated('a'), 80)).toBe(true)
      const placement = useHomeStore.getState().rooms.find((r) => r.id === roomId)!.furniture.find((f) => f.id === 'sofa-1')!
      const rightSeat = resolveSeatPosition(placement, SOFA_SLOTS[1])
      expect(useCharacterMovementStore.getState().byId.a.x).toBeCloseTo(rightSeat.x, 3)
    })

    it('targeting the seat a character is ALREADY on (or walking to) is a harmless no-op', async () => {
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      await sitAndWait('a', 'sofa-1', 'sofa-left')

      expect(startSitting('a', 'sofa-1', 'sofa-left')).toBe('started')
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left']?.characterId).toBe('a')
      expect(useCharacterMovementStore.getState().byId.a.status).toBe('seated') // never disturbed
    })
  })

  describe('의자 상호작용', () => {
    it('의자 착석 및 일어나기: walks to the chair, sits at its own derived seat position, then stands up safely', async () => {
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      await sitAndWait('a', 'chair-1')

      const placement = useHomeStore.getState().rooms.find((r) => r.id === roomId)!.furniture.find((f) => f.id === 'chair-1')!
      const seat = resolveSeatPosition(placement, CHAIR_SLOT)
      const entry = useCharacterMovementStore.getState().byId.a
      expect(entry.x).toBeCloseTo(seat.x, 3)
      expect(entry.y).toBeCloseTo(seat.y, 3)

      standUp('a')
      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
      const approach = resolveApproachPoint(placement, CHAIR, CHAIR_SLOT)
      const afterStand = useCharacterMovementStore.getState().byId.a
      expect(afterStand.status).toBe('idle')
      expect(afterStand.x).toBeCloseTo(approach.x, 3)
      expect(afterStand.y).toBeCloseTo(approach.y, 3)
    })

    it('의자 삭제: evicts the sitter and resets their movement state', async () => {
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      await sitAndWait('a', 'chair-1')

      evictPlacementUsage('chair-1')
      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
      expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle')
    })

    it('의자로 접근 중 취소하면 예약이 해제되고 다시 자유롭게 움직인다', async () => {
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      expect(startSitting('a', 'chair-1')).toBe('started')
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS * 2) // still en route

      standUp('a')
      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
      expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle')
      for (let i = 0; i < 30; i++) await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
      expect(useCharacterMovementStore.getState().byId.a.status).not.toBe('seated')
    })

    it('의자 이동·회전 시 안전하게 정리된다', async () => {
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      await sitAndWait('a', 'chair-1')

      evictPlacementUsage('chair-1')
      useHomeStore.setState({ activeDecorateRoomId: roomId })
      useHomeStore.getState().moveFurniture('chair-1', 200, 380)
      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
      expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle')
    })

    it('소파와 의자는 같은 예약/상태 전환 로직을 공유한다 — 동시에 각각 사용해도 서로 간섭하지 않는다', async () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 20, SAFE_START_Y, roomId) },
      })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      await sitAndWait('a', 'sofa-1', 'sofa-left')
      await sitAndWait('b', 'chair-1')

      standUp('b')
      expect(useCharacterMovementStore.getState().byId.b.status).toBe('idle')
      // a's sofa seat is completely unaffected by b's chair use or standing up.
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left']?.characterId).toBe('a')
      expect(useCharacterMovementStore.getState().byId.a.status).toBe('seated')
    })
  })

  describe('접근 실패 / 타임아웃 (좌석 단위로 재검증)', () => {
    it('같은 방에 없으면 즉시 거부되고 어떤 좌석도 예약되지 않는다', () => {
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, room2Id) } })
      expect(startSitting('a', 'sofa-1', 'sofa-left')).toBe('not_same_room')
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left']).toBeUndefined()
      expect(startSitting('a', 'chair-1')).toBe('not_same_room')
      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
    })

    it('접근이 끝내 완료되지 않으면 타임아웃으로 좌석 예약이 해제된다', async () => {
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId, { destination: { x: 690, y: 400 }, status: 'moving' }) },
      })
      useFurnitureUsageStore.getState().reserve({ characterId: 'a', placementId: 'sofa-1', roomId, slotId: 'sofa-left' })
      for (let i = 0; i < MAX_FURNITURE_APPROACH_TICKS; i++) useFurnitureUsageStore.getState().incrementApproachTicks('a')

      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)

      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left']).toBeUndefined()
      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
      expect(useCharacterMovementStore.getState().byId.a.status).not.toBe('seated')
    })
  })

  describe('수동 이동 및 대화 상태 충돌 방지', () => {
    it('일어나기(수동 이동 명령)는 즉시 이동 규칙을 재개시킨다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1) // avoids the (real, valid) 'rest' behavior so the very next tick deterministically sets a destination
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 100, 100, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      startSitting('a', 'sofa-1', 'sofa-left')
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS * 2)

      standUp('a')
      expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle')
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
      expect(useCharacterMovementStore.getState().byId.a.destination).not.toBeNull()
    })

    it('두 좌석이 모두 찬 상태에서 한쪽과 대화가 시작되면 그 캐릭터만 일어나고, 다른 좌석은 그대로 유지된다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useCharacterStore.setState({ characters: [character('a'), character('b'), character('c')] })
      useCharacterMovementStore.setState({
        byId: {
          a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId),
          b: movementEntry('b', SAFE_START_X + 20, SAFE_START_Y, roomId),
          c: movementEntry('c', SAFE_START_X + 40, SAFE_START_Y, roomId),
        },
      })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      await sitAndWait('a', 'sofa-1', 'sofa-left')
      await sitAndWait('b', 'sofa-1', 'sofa-right')

      const mountedRef = { current: true }
      const outcomePromise = startManualConversation('a', 'c', { current: { time: '', place: '', actionA: '', actionB: '' } }, mountedRef)
      await vi.advanceTimersByTimeAsync(0)
      expect(useCharacterMovementStore.getState().byId.a.status).toBe('talking')
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left']).toBeUndefined() // a stood up
      // b's seat is completely undisturbed by a's conversation.
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-right']?.characterId).toBe('b')
      expect(useCharacterMovementStore.getState().byId.b.status).toBe('seated')

      await vi.advanceTimersByTimeAsync(BUBBLE_REVEAL_INTERVAL_MS * 6)
      await outcomePromise
      expect(['idle', 'moving']).toContain(useCharacterMovementStore.getState().byId.a.status)
      expect(useCharacterMovementStore.getState().byId.b.status).toBe('seated') // still, throughout
    })
  })

  describe('방 삭제 — 두 좌석 모두 정리', () => {
    it('RoomTabs 재배치 흐름은 방에 있는 두 착석 캐릭터의 좌석을 모두 해제한다', async () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 20, SAFE_START_Y, roomId) },
      })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      await sitAndWait('a', 'sofa-1', 'sofa-left')
      await sitAndWait('b', 'sofa-1', 'sofa-right')

      render(<RoomTabs activeRoomId={roomId} onSelectRoom={() => {}} />)
      fireEvent.click(screen.getByRole('button', { name: `${useHomeStore.getState().rooms.find((r) => r.id === roomId)!.name} 삭제` }))
      fireEvent.change(screen.getByLabelText('캐릭터를 옮길 방'), { target: { value: room2Id } })
      fireEvent.click(screen.getByRole('button', { name: '삭제' }))

      expect(useHomeStore.getState().rooms.map((r) => r.id)).toEqual([room2Id])
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left']).toBeUndefined()
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-right']).toBeUndefined()
      expect(useCharacterMovementStore.getState().byId.a.roomId).toBe(room2Id)
      expect(useCharacterMovementStore.getState().byId.b.roomId).toBe(room2Id)
      expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle')
      expect(useCharacterMovementStore.getState().byId.b.status).toBe('idle')
    })

    it('orphan-rescue 경로(RoomTabs를 거치지 않은 방 삭제)도 두 좌석을 모두 정리한다', async () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 20, SAFE_START_Y, roomId) },
      })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      await sitAndWait('a', 'sofa-1', 'sofa-left')
      await sitAndWait('b', 'sofa-1', 'sofa-right')

      useHomeStore.setState({ activeLiveRoomId: room2Id })
      useHomeStore.getState().removeRoom(roomId)
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)

      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left']).toBeUndefined()
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-right']).toBeUndefined()
      expect(useCharacterMovementStore.getState().byId.a.roomId).toBe(room2Id)
      expect(useCharacterMovementStore.getState().byId.b.roomId).toBe(room2Id)
    })
  })

  describe('FurnitureUsagePanel (사용자 조작 UI, 좌석별)', () => {
    beforeEach(() => cleanup())

    it('소파 선택 시 두 좌석이 각각 표시되고, 빈 좌석마다 독립적으로 앉힐 수 있다', () => {
      useCharacterStore.setState({ characters: [character('a', '밀로'), character('b', '루나')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, roomId), b: movementEntry('b', 310, 300, roomId) } })
      render(<FurnitureUsagePanel roomId={roomId} placementId="sofa-1" onClose={() => {}} />)

      expect(screen.getByText('왼쪽 좌석')).toBeInTheDocument()
      expect(screen.getByText('오른쪽 좌석')).toBeInTheDocument()
      const buttons = screen.getAllByRole('button', { name: '앉기' })
      expect(buttons).toHaveLength(2)

      fireEvent.change(screen.getByLabelText('앉을 캐릭터'), { target: { value: 'b' } })
      fireEvent.click(buttons[1]) // 오른쪽 좌석
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-right'].characterId).toBe('b')
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left']).toBeUndefined()
    })

    it('한쪽 좌석이 이미 찼어도 다른 캐릭터가 빈 좌석에 접근할 수 있다', () => {
      useCharacterStore.setState({ characters: [character('a', '밀로'), character('b', '루나')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, roomId), b: movementEntry('b', 310, 300, roomId) } })
      useFurnitureUsageStore.getState().reserve({ characterId: 'a', placementId: 'sofa-1', roomId, slotId: 'sofa-left' })
      useFurnitureUsageStore.getState().markSeated('a')
      useCharacterMovementStore.setState((state) => ({ byId: { ...state.byId, a: { ...state.byId.a, status: 'seated' } } }))

      render(<FurnitureUsagePanel roomId={roomId} placementId="sofa-1" onClose={() => {}} />)
      expect(screen.getByText('밀로이(가) 앉아 있어요')).toBeInTheDocument()
      const sitButtons = screen.getAllByRole('button', { name: '앉기' })
      expect(sitButtons).toHaveLength(1) // only the empty (오른쪽) seat offers 앉기
      fireEvent.click(sitButtons[0])
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-right'].characterId).toBe('b')
    })

    it('좌석별로 사용 중인 캐릭터를 확인할 수 있고, 각각 독립적으로 일어날 수 있다', async () => {
      useCharacterStore.setState({ characters: [character('a', '밀로'), character('b', '루나')] })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 20, SAFE_START_Y, roomId) },
      })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      await sitAndWait('a', 'sofa-1', 'sofa-left')
      await sitAndWait('b', 'sofa-1', 'sofa-right')

      render(<FurnitureUsagePanel roomId={roomId} placementId="sofa-1" onClose={() => {}} />)
      expect(screen.getByText('밀로이(가) 앉아 있어요')).toBeInTheDocument()
      expect(screen.getByText('루나이(가) 앉아 있어요')).toBeInTheDocument()

      fireEvent.click(screen.getAllByRole('button', { name: '일어나기' })[0])
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left']).toBeUndefined()
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-right']?.characterId).toBe('b') // untouched
    })

    it('의자 선택 시 캐릭터를 지정하고 좌석 1개에 앉힐 수 있다', () => {
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, roomId) } })
      render(<FurnitureUsagePanel roomId={roomId} placementId="chair-1" onClose={() => {}} />)

      expect(screen.getByText('좌석')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: '앉기' }))
      expect(useFurnitureUsageStore.getState().bySeatKey['chair-1:seat'].characterId).toBe('a')
    })

    it('사용 불가능한 좌석의 사유를 안내한다 — 후보가 없는 방', () => {
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, room2Id) } }) // a different room
      render(<FurnitureUsagePanel roomId={roomId} placementId="chair-1" onClose={() => {}} />)
      expect(screen.getByText('이 방에서 지금 앉을 수 있는 캐릭터가 없어요.')).toBeInTheDocument()
    })
  })

  describe('저장 데이터 재로드', () => {
    it('두 가구(소파·의자)의 배치·색상은 보존되고, 좌석 사용 상태는 항상 초기화된다', async () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 20, SAFE_START_Y, roomId) },
      })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      await sitAndWait('a', 'sofa-1', 'sofa-left')
      await sitAndWait('b', 'chair-1')
      useHomeStore.getState().updateFurniture('sofa-1', { colorway: 'sage' })

      const savedHome = localStorage.getItem('dearly-home')
      expect(savedHome).toContain('sofa-1')
      expect(savedHome).toContain('chair-1')
      expect(savedHome).not.toContain('approachTicks')
      expect(savedHome).not.toContain('bySeatKey')

      useFurnitureUsageStore.getState().reset()
      await useHomeStore.persist.rehydrate()

      expect(useFurnitureUsageStore.getState().bySeatKey).toEqual({})
      expect(useFurnitureUsageStore.getState().byCharacterId).toEqual({})
      const reloadedRoom = useHomeStore.getState().rooms.find((r) => r.id === roomId)!
      expect(reloadedRoom.furniture.find((f) => f.id === 'sofa-1')?.colorway).toBe('sage')
      expect(reloadedRoom.furniture.find((f) => f.id === 'chair-1')?.furnitureId).toBe('dining-chair')
    })
  })

  describe('회귀: 기존 1인용 소파 동작', () => {
    it('slotId를 생략하면 (기존 호출부와 동일하게) 첫 번째로 비어있는 좌석이 자동 선택된다', async () => {
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      await sitAndWait('a', 'sofa-1') // no slotId — same call shape phase 1's tests and call sites always used

      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBe('sofa-1:sofa-left')
      const placement = useHomeStore.getState().rooms.find((r) => r.id === roomId)!.furniture.find((f) => f.id === 'sofa-1')!
      const expectedSeat = resolveSeatPosition(placement, SOFA_SLOTS[0])
      expect(useCharacterMovementStore.getState().byId.a.x).toBeCloseTo(expectedSeat.x, 3)
    })

    it('한 명만 앉아 있을 때는 그 좌석 목표대로 정확히 착석하고 일어나면 안전한 위치로 돌아온다', async () => {
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      await sitAndWait('a', 'sofa-1')

      const seatedAt = { ...useCharacterMovementStore.getState().byId.a }
      for (let i = 0; i < 30; i++) await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
      const stillSeated = useCharacterMovementStore.getState().byId.a
      expect(stillSeated.status).toBe('seated')
      expect(stillSeated.x).toBeCloseTo(seatedAt.x)
      expect(stillSeated.y).toBeCloseTo(seatedAt.y)

      standUp('a')
      expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle')
      const positions = new Set<string>()
      for (let i = 0; i < 40; i++) {
        await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
        positions.add(`${useCharacterMovementStore.getState().byId.a.x},${useCharacterMovementStore.getState().byId.a.y}`)
      }
      expect(positions.size).toBeGreaterThan(1) // genuinely resumes wandering
    })
  })
})
