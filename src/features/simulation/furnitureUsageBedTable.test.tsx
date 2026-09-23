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
import { useCharacterMovementStore, type CharacterMovementState, type MovementStatus } from './characterMovementStore'
import { FurnitureUsagePanel } from './FurnitureUsagePanel'
import { furnitureObstacles } from './movementEngine'
import { getPrimaryLieSlot, getStandSlots, resolveApproachPoint, resolveSeatPosition, resolveStandDestination, resolveWalkDestination } from './furnitureInteractionEngine'
import { useFurnitureUsageStore } from './furnitureUsageStore'
import { evictPlacementUsage, standUp, startLingering, startLyingDown } from './furnitureUsageTrigger'
import { MAX_FURNITURE_APPROACH_TICKS, MOVEMENT_TICK_MS } from './movementConfig'
import { useSimulationStore } from './simulationStore'
import { useCharacterMovementSimulation } from './useCharacterMovementSimulation'

const BED = getFurnitureDefinition('bed')!
const BED_LIE_SLOT = getPrimaryLieSlot(BED)!
const TABLE = getFurnitureDefinition('table')!
const TABLE_STAND_SLOTS = getStandSlots(TABLE) // [table-left, table-right]

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

function bedPlacement(id: string, x = 150, y = 300, overrides: Partial<FurniturePlacement> = {}): FurniturePlacement {
  return { id, furnitureId: 'bed', x, y, scale: 1, rotation: 0, colorway: 'blush', layer: 0, ...overrides }
}

function tablePlacement(id: string, x = 550, y = 340, overrides: Partial<FurniturePlacement> = {}): FurniturePlacement {
  return { id, furnitureId: 'table', x, y, scale: 1, rotation: 0, colorway: 'natural', layer: 0, ...overrides }
}

/** Neither inside the default bed's nor the default table's own collision rect. */
const SAFE_START_X = 350
const SAFE_START_Y = 420

function situationRef() {
  return { current: { time: '', place: '', actionA: '', actionB: '' } }
}

let roomId: string
let room2Id: string

function resetAll() {
  localStorage.clear()
  const room = useHomeStore.getInitialState().rooms[0]
  useHomeStore.setState({
    rooms: [{ ...room, furniture: [bedPlacement('bed-1'), tablePlacement('table-1')] }],
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

async function advanceUntil(predicate: () => boolean, maxTicks: number): Promise<boolean> {
  for (let i = 0; i < maxTicks; i++) {
    if (predicate()) return true
    await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
  }
  return predicate()
}

function statusOf(id: string): MovementStatus | undefined {
  return useCharacterMovementStore.getState().byId[id]?.status
}

/** True once the character has actually arrived and is occupying (not just walking toward) a slot of the given status. */
function reached(id: string, status: MovementStatus): boolean {
  return statusOf(id) === status
}

describe('furniture interaction (phase 3): bed (눕기) and table (머무르기)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetAll()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('침대: 접근·눕기·일어나기', () => {
    it('침대 접근·눕기: walks to the bed via the real, collision-checked movement engine and ends up lying at the resolved lie-slot position', async () => {
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))

      expect(startLyingDown('a', 'bed-1')).toBe('started')
      expect(useCharacterMovementStore.getState().byId.a.status).toBe('moving')
      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBe('bed-1:bed-left')

      const seenPositions = new Set<string>()
      const arrived = await advanceUntil(() => {
        const e = useCharacterMovementStore.getState().byId.a
        seenPositions.add(`${e.x},${e.y}`)
        return reached('a', 'lying')
      }, 80)

      expect(arrived).toBe(true)
      expect(seenPositions.size).toBeGreaterThan(2) // genuinely walked, not teleported
      const placement = useHomeStore.getState().rooms.find((r) => r.id === roomId)!.furniture.find((f) => f.id === 'bed-1')!
      const expectedSpot = resolveSeatPosition(placement, BED_LIE_SLOT)
      const entry = useCharacterMovementStore.getState().byId.a
      expect(entry.x).toBeCloseTo(expectedSpot.x, 3)
      expect(entry.y).toBeCloseTo(expectedSpot.y, 3)
      expect(entry.status).not.toBe('seated') // lying is its own, distinct status — never conflated with sofa/chair sitting
      expect(useFurnitureUsageStore.getState().bySeatKey['bed-1:bed-left'].status).toBe('seated') // the store's own generic "occupying" label — unrelated to characterMovementStore's kind-specific status
    })

    it('일어나기: releases the bed and repositions to a safe point outside it, then resumes ordinary wandering', async () => {
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      startLyingDown('a', 'bed-1')
      expect(await advanceUntil(() => reached('a', 'lying'), 80)).toBe(true)

      standUp('a')
      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
      const afterStand = useCharacterMovementStore.getState().byId.a
      expect(afterStand.status).toBe('idle')
      const placement = useHomeStore.getState().rooms.find((r) => r.id === roomId)!.furniture.find((f) => f.id === 'bed-1')!
      const approach = resolveApproachPoint(placement, BED, BED_LIE_SLOT)
      expect(afterStand.x).toBeCloseTo(approach.x, 3)
      expect(afterStand.y).toBeCloseTo(approach.y, 3)

      const positions = new Set<string>()
      for (let i = 0; i < 40; i++) {
        await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
        positions.add(`${useCharacterMovementStore.getState().byId.a.x},${useCharacterMovementStore.getState().byId.a.y}`)
      }
      expect(positions.size).toBeGreaterThan(1)
    })

    it('침대 사용 중 중복 요청 차단: a second character cannot lie down on an already-occupied bed', () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, roomId), b: movementEntry('b', 310, 300, roomId) } })
      expect(startLyingDown('a', 'bed-1')).toBe('started')
      expect(startLyingDown('b', 'bed-1')).toBe('occupied')
      expect(useFurnitureUsageStore.getState().bySeatKey['bed-1:bed-left'].characterId).toBe('a')
      expect(useCharacterMovementStore.getState().byId.b.status).toBe('idle') // untouched
    })

    it('한 캐릭터가 눕는 기능만 구현됨: the bed exposes exactly one usable lie slot even though its data has two (bed-left/bed-right), so a second simultaneous occupant is never possible regardless of which slot might be free', () => {
      expect(BED.interactionSlots.filter((s) => s.kind === 'lie')).toHaveLength(2) // real data, both derived from pillow centers
      expect(getStandSlots(BED)).toHaveLength(0)
      // getPrimaryLieSlot only ever returns the first — startLyingDown never accepts a slotId at all, so the second slot is structurally unreachable this phase.
      expect(getPrimaryLieSlot(BED)?.id).toBe('bed-left')
    })

    it('침대 접근 실패 시 상태 정리: 같은 방에 없으면 즉시 거부되고 예약이 만들어지지 않는다', () => {
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, room2Id) } })
      expect(startLyingDown('a', 'bed-1')).toBe('not_same_room')
      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
      expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle')
    })

    it('침대 접근 실패 시 상태 정리: 접근이 끝내 완료되지 않으면 타임아웃으로 예약이 해제된다', async () => {
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId, { destination: { x: 690, y: 400 }, status: 'moving' }) },
      })
      useFurnitureUsageStore.getState().reserve({ characterId: 'a', placementId: 'bed-1', roomId, slotId: 'bed-left' })
      for (let i = 0; i < MAX_FURNITURE_APPROACH_TICKS; i++) useFurnitureUsageStore.getState().incrementApproachTicks('a')

      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)

      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
      expect(useCharacterMovementStore.getState().byId.a.status).not.toBe('lying')
    })

    it('침대 방향·크기 변경 시 위치 처리: 회전하면 좌우가 뒤집히고, 스케일하면 오프셋도 함께 스케일된다', () => {
      const base = bedPlacement('bed-1')
      const rotated = { ...base, rotation: 180 as const }
      const scaled = { ...base, scale: 1.2 }
      const normal = resolveSeatPosition(base, BED_LIE_SLOT)
      const mirrored = resolveSeatPosition(rotated, BED_LIE_SLOT)
      const bigger = resolveSeatPosition(scaled, BED_LIE_SLOT)
      expect(mirrored.x - base.x).toBeCloseTo(-(normal.x - base.x))
      expect(mirrored.y).toBeCloseTo(normal.y)
      expect(bigger.x - base.x).toBeCloseTo((normal.x - base.x) * 1.2)
    })

    it('침대 이동·회전 시: 사용 중이던 캐릭터가 안전하게 정리된다', async () => {
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      startLyingDown('a', 'bed-1')
      expect(await advanceUntil(() => reached('a', 'lying'), 80)).toBe(true)

      evictPlacementUsage('bed-1') // exactly what FurniturePropertiesPanel's rotation toggle / FurnitureItem's drag-end do first
      useHomeStore.setState({ activeDecorateRoomId: roomId })
      useHomeStore.getState().updateFurniture('bed-1', { rotation: 180 })

      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
      expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle')
    })
  })

  describe('테이블: 접근·머무르기·종료', () => {
    it('테이블 접근·머무르기: walks to a stand slot and starts lingering there — a status genuinely distinct from sitting/lying', async () => {
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))

      expect(startLingering('a', 'table-1', 'table-right')).toBe('started')
      const seen = new Set<string>()
      const arrived = await advanceUntil(() => {
        const e = useCharacterMovementStore.getState().byId.a
        seen.add(`${e.x},${e.y}`)
        return reached('a', 'lingering')
      }, 80)
      expect(arrived).toBe(true)
      expect(seen.size).toBeGreaterThan(2)

      const placement = useHomeStore.getState().rooms.find((r) => r.id === roomId)!.furniture.find((f) => f.id === 'table-1')!
      const expectedDestination = resolveWalkDestination(placement, TABLE, TABLE_STAND_SLOTS[1])
      const entry = useCharacterMovementStore.getState().byId.a
      expect(entry.x).toBeCloseTo(expectedDestination.x, 3)
      expect(entry.y).toBeCloseTo(expectedDestination.y, 3)
      expect(entry.status).not.toBe('seated')
      expect(entry.status).not.toBe('lying')
    })

    it('머무르기 종료: releases the table and returns to idle WITHOUT repositioning — a linger spot is already outside the furniture, so there is nowhere safer to move to', async () => {
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      startLingering('a', 'table-1', 'table-right')
      expect(await advanceUntil(() => reached('a', 'lingering'), 80)).toBe(true)
      const lingeringAt = { ...useCharacterMovementStore.getState().byId.a }

      standUp('a')
      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
      const afterEnd = useCharacterMovementStore.getState().byId.a
      expect(afterEnd.status).toBe('idle')
      expect(afterEnd.x).toBeCloseTo(lingeringAt.x)
      expect(afterEnd.y).toBeCloseTo(lingeringAt.y)
    })

    it('테이블의 두 자리는 독립적으로 사용할 수 있다 — 동시에 두 캐릭터가 머무를 수 있고, 한쪽 종료가 다른 쪽을 건드리지 않는다', async () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 20, SAFE_START_Y, roomId) },
      })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      expect(startLingering('a', 'table-1', 'table-left')).toBe('started')
      expect(startLingering('b', 'table-1', 'table-right')).toBe('started')
      expect(await advanceUntil(() => reached('a', 'lingering') && reached('b', 'lingering'), 80)).toBe(true)

      standUp('a')
      expect(useFurnitureUsageStore.getState().bySeatKey['table-1:table-left']).toBeUndefined()
      expect(useFurnitureUsageStore.getState().bySeatKey['table-1:table-right']?.characterId).toBe('b')
      expect(useCharacterMovementStore.getState().byId.b.status).toBe('lingering')
    })

    it('동일 지점에 대한 동시 요청은 한 명만 성공한다', () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, roomId), b: movementEntry('b', 310, 300, roomId) } })
      expect(startLingering('a', 'table-1', 'table-left')).toBe('started')
      expect(startLingering('b', 'table-1', 'table-left')).toBe('occupied') // same exact spot, refused
      expect(useFurnitureUsageStore.getState().bySeatKey['table-1:table-left'].characterId).toBe('a')
      // The other spot is completely unaffected — b isn't blocked from the table altogether, just that one side.
      expect(startLingering('b', 'table-1', 'table-right')).toBe('started')
    })

    it('회전 후 좌표: 테이블을 180도 회전하면 왼쪽/오른쪽 지점의 실제 위치가 서로 뒤바뀐다', () => {
      const base = tablePlacement('table-1')
      const rotated = { ...base, rotation: 180 as const }
      const [leftSlot, rightSlot] = TABLE_STAND_SLOTS
      const normalLeft = resolveSeatPosition(base, leftSlot)
      const rotatedLeft = resolveSeatPosition(rotated, leftSlot)
      const normalRight = resolveSeatPosition(base, rightSlot)
      // Rotating mirrors the X offset — the slot still *called* "left" in code now resolves to where "right" used to be, and vice versa.
      expect(rotatedLeft.x).toBeCloseTo(normalRight.x, 3)
      expect(rotatedLeft.y).toBeCloseTo(normalLeft.y, 3)
      // Scaling (independent of rotation) scales the offset from the table's own center proportionally.
      const scaled = { ...base, scale: 1.2 }
      const scaledLeft = resolveSeatPosition(scaled, leftSlot)
      expect(scaledLeft.x - base.x).toBeCloseTo((normalLeft.x - base.x) * 1.2, 3)
    })

    it('다른 가구가 접근 지점을 막고 있으면 "사용할 수 없는 지점"으로 표시된다 (벽이 아니라 다른 가구로 인한 차단)', () => {
      // A second table placed exactly where table-1's right-side spot would resolve to.
      const table1 = tablePlacement('table-1', 300, 340)
      const [, rightSlot] = TABLE_STAND_SLOTS
      const rightSpot = resolveSeatPosition(table1, rightSlot)
      const blocker: FurniturePlacement = { id: 'blocker-1', furnitureId: 'side-table', x: rightSpot.x, y: rightSpot.y, scale: 1, rotation: 0, colorway: 'natural', layer: 1 }
      useHomeStore.setState({ rooms: useHomeStore.getState().rooms.map((r) => (r.id === roomId ? { ...r, furniture: [table1, blocker] } : r)) })
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 400, 400, roomId) } })

      render(<FurnitureUsagePanel roomId={roomId} placementId="table-1" onClose={() => {}} />)
      expect(screen.getByText('이 자리는 다른 가구나 캐릭터에 막혀 있어서 사용할 수 없어요.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '다가가기' })).toBeInTheDocument() // the left spot is unaffected
    })

    it('테이블 접근 지점 장애물 충돌: 근처에 다른 가구가 있어도 결국 도착한다 (강제 통과 메커니즘 재사용)', async () => {
      const blockers: FurniturePlacement[] = Array.from({ length: 4 }, (_, i) => ({
        id: `blocker-${i}`, furnitureId: 'side-table', x: 540 + (i % 2) * 30, y: 400 + Math.floor(i / 2) * 30, scale: 1, rotation: 0, colorway: 'natural', layer: 1,
      }))
      useHomeStore.setState({ rooms: useHomeStore.getState().rooms.map((r) => (r.id === roomId ? { ...r, furniture: [...r.furniture, ...blockers] } : r)) })
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))

      expect(startLingering('a', 'table-1', 'table-right')).toBe('started')
      expect(await advanceUntil(() => reached('a', 'lingering'), 80)).toBe(true)
    })

    it('테이블 안으로 캐릭터가 들어가지 않는지 확인: 정상적으로 배치된 테이블은 두 자리 모두 충돌 영역 밖에 있다', () => {
      const placement = tablePlacement('table-1') // the default (550, 340) — comfortably clear of every room edge
      for (const slot of TABLE_STAND_SLOTS) {
        const { point, clearOfFootprint } = resolveStandDestination(placement, TABLE, slot)
        expect(clearOfFootprint, slot.id).toBe(true)
        const [obstacle] = furnitureObstacles([placement])
        const insideFootprint = point.x > obstacle.minX && point.x < obstacle.maxX && point.y > obstacle.minY && point.y < obstacle.maxY
        expect(insideFootprint, slot.id).toBe(false)
      }
    })

    it('벽에 바짝 붙은 테이블: 자리를 확보할 수 없는 지점은 "사용할 수 없는 지점"으로 정직하게 보고되고, 캐릭터를 그리로 보내지 않는다', () => {
      // table.x=64 is the smallest x clampToRoom itself ever allows for this table (its own left edge touches the
      // room's left wall) — a placement a user can genuinely reach by dragging it there, not a contrived value. At
      // that position there is no point left between the wall and the table's own far edge, so pushing "further
      // out" can only re-clamp back to the same wall-adjacent point, still inside the footprint — this is reported
      // honestly via clearOfFootprint: false rather than papering over it with a position that overlaps the table.
      const flushLeft = tablePlacement('table-1', 64, 380)
      const [leftSlot] = TABLE_STAND_SLOTS
      const { clearOfFootprint } = resolveStandDestination(flushLeft, TABLE, leftSlot)
      expect(clearOfFootprint).toBe(false)

      // The UI-level consequence: FurnitureUsagePanel refuses to offer this specific slot and explains why, instead
      // of letting the user send a character on an impossible walk. (The room's other furniture, e.g. the bed, is
      // removed here so its own footprint can't incidentally block the *right* slot too — this test isolates the
      // wall-proximity case specifically.)
      useHomeStore.setState({ rooms: useHomeStore.getState().rooms.map((r) => (r.id === roomId ? { ...r, furniture: [flushLeft] } : r)) })
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 400, 400, roomId) } })
      render(<FurnitureUsagePanel roomId={roomId} placementId="table-1" onClose={() => {}} />)
      expect(screen.getByText('이 자리는 다른 가구나 캐릭터에 막혀 있어서 사용할 수 없어요.')).toBeInTheDocument()
      // The other (right) side is completely unaffected — still offers 다가가기 normally.
      expect(screen.getByRole('button', { name: '다가가기' })).toBeInTheDocument()
    })

    it('접근 도중 취소: standing up mid-approach cancels cleanly and never ends up lingering afterward', async () => {
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      startLingering('a', 'table-1', 'table-right')
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS * 2)
      expect(useFurnitureUsageStore.getState().bySeatKey['table-1:table-right']?.status).toBe('approaching')

      standUp('a')
      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
      expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle')
      for (let i = 0; i < 30; i++) await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
      expect(useCharacterMovementStore.getState().byId.a.status).not.toBe('lingering')
    })
  })

  describe('삭제·방 삭제 (공통 정리 로직이 침대/테이블에도 그대로 연결된다)', () => {
    it('캐릭터 삭제: 실제 삭제 버튼(CharacterList)을 통해 지워도 침대 예약이 정리된다', async () => {
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      startLyingDown('a', 'bed-1')
      expect(await advanceUntil(() => reached('a', 'lying'), 80)).toBe(true)

      render(<CharacterList />)
      const row = screen.getByText('a').closest<HTMLElement>('.character-list-item')!
      fireEvent.click(within(row).getByRole('button', { name: '삭제' }))

      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
      expect(useHomeStore.getState().rooms.find((r) => r.id === roomId)!.furniture.find((f) => f.id === 'bed-1')).toBeDefined() // the bed itself is untouched
    })

    it('가구 삭제: 실제 삭제 버튼(FurniturePropertiesPanel)으로 테이블을 지우면 두 좌석 모두 정리된다', async () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 20, SAFE_START_Y, roomId) },
      })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      startLingering('a', 'table-1', 'table-left')
      startLingering('b', 'table-1', 'table-right')
      expect(await advanceUntil(() => reached('a', 'lingering') && reached('b', 'lingering'), 80)).toBe(true)

      useHomeStore.getState().selectFurniture('table-1')
      render(<FurniturePropertiesPanel />)
      fireEvent.click(screen.getByRole('button', { name: '삭제' }))

      expect(useHomeStore.getState().rooms.find((r) => r.id === roomId)!.furniture.find((f) => f.id === 'table-1')).toBeUndefined()
      expect(useFurnitureUsageStore.getState().bySeatKey['table-1:table-left']).toBeUndefined()
      expect(useFurnitureUsageStore.getState().bySeatKey['table-1:table-right']).toBeUndefined()
      expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle')
      expect(useCharacterMovementStore.getState().byId.b.status).toBe('idle')
    })

    it('방 삭제: RoomTabs 재배치 흐름이 침대/테이블 사용자를 모두 해제한 뒤 새 방으로 옮긴다', async () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 20, SAFE_START_Y, roomId) },
      })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      startLyingDown('a', 'bed-1')
      startLingering('b', 'table-1', 'table-right')
      expect(await advanceUntil(() => reached('a', 'lying') && reached('b', 'lingering'), 80)).toBe(true)

      render(<RoomTabs activeRoomId={roomId} onSelectRoom={() => {}} />)
      fireEvent.click(screen.getByRole('button', { name: `${useHomeStore.getState().rooms.find((r) => r.id === roomId)!.name} 삭제` }))
      fireEvent.change(screen.getByLabelText('캐릭터를 옮길 방'), { target: { value: room2Id } })
      fireEvent.click(screen.getByRole('button', { name: '삭제' }))

      expect(useHomeStore.getState().rooms.map((r) => r.id)).toEqual([room2Id])
      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
      expect(useFurnitureUsageStore.getState().byCharacterId.b).toBeUndefined()
      expect(useCharacterMovementStore.getState().byId.a.roomId).toBe(room2Id)
      expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle')
      expect(useCharacterMovementStore.getState().byId.b.status).toBe('idle')
    })
  })

  describe('수동 이동 및 대화와의 충돌', () => {
    it('일어나기(수동 이동 명령)는 침대에서도 즉시 이동 규칙을 재개시킨다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1) // avoids the (real, valid) 'rest' behavior so the very next tick deterministically sets a destination
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      startLyingDown('a', 'bed-1')
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS * 2)

      standUp('a')
      expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle')
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
      expect(useCharacterMovementStore.getState().byId.a.destination).not.toBeNull()
    })

    it('대화가 시작되면 눕거나 머무르던 캐릭터가 먼저 일어난다 (기존 standUp 훅이 그대로 적용됨)', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 20, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      startLyingDown('a', 'bed-1')
      expect(await advanceUntil(() => reached('a', 'lying'), 80)).toBe(true)

      const mountedRef = { current: true }
      const outcomePromise = startManualConversation('a', 'b', { current: { time: '', place: '', actionA: '', actionB: '' } }, mountedRef)
      await vi.advanceTimersByTimeAsync(0)
      expect(useCharacterMovementStore.getState().byId.a.status).toBe('talking')
      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined() // stood up, reservation released

      await vi.advanceTimersByTimeAsync(BUBBLE_REVEAL_INTERVAL_MS * 6)
      await outcomePromise
      expect(['idle', 'moving']).toContain(useCharacterMovementStore.getState().byId.a.status)
    })
  })

  describe('FurnitureUsagePanel — 침대/테이블 전용 UI', () => {
    beforeEach(() => cleanup())

    it('침대: 캐릭터 선택 → 눕기, 사용 중인 캐릭터 표시, 일어나기', async () => {
      useCharacterStore.setState({ characters: [character('a', '밀로'), character('b', '루나')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, roomId), b: movementEntry('b', 310, 300, roomId) } })
      render(<FurnitureUsagePanel roomId={roomId} placementId="bed-1" onClose={() => {}} />)

      expect(screen.getByLabelText('누울 캐릭터')).toBeInTheDocument()
      fireEvent.change(screen.getByLabelText('누울 캐릭터'), { target: { value: 'b' } })
      fireEvent.click(screen.getByRole('button', { name: '눕기' }))
      expect(useFurnitureUsageStore.getState().byCharacterId.b).toBe('bed-1:bed-left')

      useFurnitureUsageStore.getState().markSeated('b')
      cleanup()
      render(<FurnitureUsagePanel roomId={roomId} placementId="bed-1" onClose={() => {}} />)
      expect(screen.getByText('루나이(가) 누워 있어요')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '일어나기' })).toBeInTheDocument()
    })

    it('테이블: 캐릭터 선택 → 다가가기, 머무르기 종료', () => {
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, roomId) } })
      render(<FurnitureUsagePanel roomId={roomId} placementId="table-1" onClose={() => {}} />)

      const goButtons = screen.getAllByRole('button', { name: '다가가기' })
      expect(goButtons).toHaveLength(2) // north + south
      fireEvent.click(goButtons[0])
      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBe('table-1:table-left')

      useFurnitureUsageStore.getState().markSeated('a')
      cleanup()
      render(<FurnitureUsagePanel roomId={roomId} placementId="table-1" onClose={() => {}} />)
      expect(screen.getByRole('button', { name: '머무르기 종료' })).toBeInTheDocument()
    })

    it('사용할 수 없는 가구/접근 경로가 없을 때 실패 이유를 안내한다', () => {
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, room2Id) } }) // different room
      render(<FurnitureUsagePanel roomId={roomId} placementId="bed-1" onClose={() => {}} />)
      expect(screen.getByText('이 방에서 지금 누울 수 있는 캐릭터가 없어요.')).toBeInTheDocument()
    })

    it('기존 소파·의자 패널은 변경되지 않았다 — "앉기"/"일어나기" 문구와 동작이 그대로다', () => {
      useCharacterStore.setState({ characters: [character('a')] })
      useHomeStore.setState({
        rooms: useHomeStore.getState().rooms.map((r) => (r.id === roomId ? { ...r, furniture: [...r.furniture, { id: 'sofa-1', furnitureId: 'sofa', x: 360, y: 200, scale: 1, rotation: 0 as const, colorway: 'rose', layer: 0 }] } : r)),
      })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, roomId) } })
      render(<FurnitureUsagePanel roomId={roomId} placementId="sofa-1" onClose={() => {}} />)
      expect(screen.getAllByRole('button', { name: '앉기' })).toHaveLength(2)
    })
  })

  describe('저장 데이터 재로드', () => {
    it('침대·테이블의 배치/색상은 보존되고, 사용 상태는 항상 초기화된다 — 스키마 마이그레이션도 필요 없다', async () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 20, SAFE_START_Y, roomId) },
      })
      renderHook(() => useCharacterMovementSimulation(situationRef().current))
      startLyingDown('a', 'bed-1')
      startLingering('b', 'table-1', 'table-right')
      expect(await advanceUntil(() => reached('a', 'lying') && reached('b', 'lingering'), 80)).toBe(true)
      useHomeStore.getState().updateFurniture('bed-1', { colorway: 'sage' })

      const savedHome = localStorage.getItem('dearly-home')
      expect(savedHome).toContain('bed-1')
      expect(savedHome).toContain('table-1')
      expect(savedHome).not.toContain('bySeatKey')

      useFurnitureUsageStore.getState().reset()
      await useHomeStore.persist.rehydrate()

      expect(useFurnitureUsageStore.getState().bySeatKey).toEqual({})
      const reloadedRoom = useHomeStore.getState().rooms.find((r) => r.id === roomId)!
      expect(reloadedRoom.furniture.find((f) => f.id === 'bed-1')?.colorway).toBe('sage')
      expect(reloadedRoom.furniture.find((f) => f.id === 'table-1')?.furnitureId).toBe('table')
    })
  })
})
