import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import { LiveScreen } from '../../app/LiveScreen'
import { useCharacterStore } from '../character/characterStore'
import { CharacterList } from '../character/CharacterList'
import { EMPTY_AI_PROFILE, type Character } from '../character/types'
import { startManualConversation } from '../dialogue/autoDialogueTrigger'
import { useDialogueFrequencyStore } from '../dialogue/dialogueFrequencyStore'
import { useDialogueStore } from '../dialogue/dialogueStore'
import { useMonologueFrequencyStore } from '../dialogue/monologueFrequencyStore'
import { useMonologueStore } from '../dialogue/monologueStore'
import { useRelationshipStore } from '../dialogue/relationshipStore'
import { useHomeStore } from '../home/homeStore'
import { RoomTabs } from '../home/RoomTabs'
import { FurniturePropertiesPanel } from '../home/FurniturePropertiesPanel'
import type { FurniturePlacement } from '../home/types'
import { useAutoFurnitureUseSettingsStore } from './autoFurnitureUseSettingsStore'
import { useAutoFurnitureUseStore } from './autoFurnitureUseStore'
import { AUTO_FURNITURE_USE_COOLDOWN_MS, AUTO_FURNITURE_USE_MIN_HOLD_MS, AUTO_FURNITURE_USE_RETRY_COOLDOWN_MS } from './autoFurnitureUseConfig'
import { useCharacterMovementStore, type CharacterMovementState } from './characterMovementStore'
import { useFurnitureUsageStore } from './furnitureUsageStore'
import { evictPlacementUsage, startSitting } from './furnitureUsageTrigger'
import { MAX_FURNITURE_APPROACH_TICKS, MOVEMENT_TICK_MS } from './movementConfig'
import { useSimulationStore } from './simulationStore'
import { useCharacterMovementSimulation } from './useCharacterMovementSimulation'

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

function chairPlacement(id: string, x = 560, y = 340, overrides: Partial<FurniturePlacement> = {}): FurniturePlacement {
  return { id, furnitureId: 'dining-chair', x, y, scale: 1, rotation: 0, colorway: 'natural', layer: 0, ...overrides }
}

const SAFE_START_X = 120
const SAFE_START_Y = 150

function situationRefValue() {
  return { current: { time: '', place: '', actionA: '', actionB: '' } }
}

let roomId: string
let room2Id: string
let emptyRoomId: string

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
  room2Id = useHomeStore.getState().addRoom('bedroom', '침실', 'default')
  emptyRoomId = useHomeStore.getState().addRoom('study', '서재', 'empty')
  useCharacterStore.setState({ characters: [] })
  useCharacterMovementStore.setState({ byId: {} })
  useFurnitureUsageStore.getState().reset()
  useDialogueStore.setState({ entries: [], activeConversations: {}, lastConversationEndAtByPair: {}, recentAutoLineIdsByCharacter: {}, recentDefaultBundleIdsByPair: {}, activeBubbleByCharacter: {} })
  useDialogueFrequencyStore.setState({ mode: 'quiet' })
  useMonologueFrequencyStore.setState({ mode: 'off' })
  useMonologueStore.getState().reset()
  useRelationshipStore.setState({ defaultRelationshipType: 'close', relationshipsByPair: {} })
  useSimulationStore.setState({ isRunning: true, tick: 0 })
  useAutoFurnitureUseStore.getState().reset()
  useAutoFurnitureUseSettingsStore.setState({ enabled: false })
}

async function advanceUntil(predicate: () => boolean, maxTicks: number): Promise<boolean> {
  for (let i = 0; i < maxTicks; i++) {
    if (predicate()) return true
    await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
  }
  return predicate()
}

function occupied(id: string): boolean {
  const status = useCharacterMovementStore.getState().byId[id]?.status
  return status === 'seated' || status === 'lying' || status === 'lingering'
}

/** Ticks for "a cooldown of this length elapses, plus a full walk across the room to a newly-picked piece of furniture" — generous on purpose (mirrors this codebase's existing `advanceUntil(..., 80)` walk-only budgets) so the test measures real behavior, not a razor-thin timing assumption. */
function cooldownPlusWalkTicks(cooldownMs: number): number {
  return Math.ceil(cooldownMs / MOVEMENT_TICK_MS) + 80
}

describe('자동 가구 사용 (4차): 시작 조건, 종료, 쿨다운, 정리', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetAll()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('설정: 기본값·저장·전역 on/off', () => {
    it('기본값은 꺼짐이다', () => {
      expect(useAutoFurnitureUseSettingsStore.getState().enabled).toBe(false)
    })

    it('켜면 localStorage에 저장된다', () => {
      useAutoFurnitureUseSettingsStore.getState().setEnabled(true)
      const saved = localStorage.getItem('dearly-auto-furniture-use')
      expect(saved).toContain('"enabled":true')
    })

    it('저장된 켜짐 값을 rehydrate하면 그대로 복원된다 (새로고침 시나리오)', async () => {
      // Writes a known-good persisted payload directly to storage — as a real page reload would find it — and
      // rehydrates from it, rather than going through setState (which would itself write back through persist and
      // so couldn't distinguish "read correctly from storage" from "still holds whatever was last set in memory").
      localStorage.setItem('dearly-auto-furniture-use', JSON.stringify({ state: { enabled: true }, version: 0 }))
      await useAutoFurnitureUseSettingsStore.persist.rehydrate()
      expect(useAutoFurnitureUseSettingsStore.getState().enabled).toBe(true)
    })

    it('손상되었거나 없는 저장 데이터는 꺼짐으로 안전하게 대체된다', async () => {
      localStorage.setItem('dearly-auto-furniture-use', '{"state":{"enabled":"켜짐"},"version":0}') // not a real boolean
      await useAutoFurnitureUseSettingsStore.persist.rehydrate()
      expect(useAutoFurnitureUseSettingsStore.getState().enabled).toBe(false)
    })

    it('Live 화면의 토글 버튼으로 켜고 끌 수 있다', () => {
      useCharacterStore.setState({ characters: [character('a', '밀로'), character('b', '루나')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, roomId), b: movementEntry('b', 310, 300, roomId) } })
      render(<LiveScreen />)

      // aria-label distinguishes this from the room-lighting toggle, which shares the same visible "꺼짐"/"켜짐" text.
      const toggle = screen.getByRole('button', { name: '자동 가구 사용 꺼짐' })
      fireEvent.click(toggle)
      expect(useAutoFurnitureUseSettingsStore.getState().enabled).toBe(true)
      expect(screen.getByRole('button', { name: '자동 가구 사용 켜짐' })).toBeInTheDocument()
    })
  })

  describe('시작 조건 & 가구 선택', () => {
    it('설정이 꺼져 있으면 확률이 항상 성공해도 자동 행동이 시작되지 않는다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      for (let i = 0; i < 40; i++) await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
      expect(occupied('a')).toBe(false)
      expect(useAutoFurnitureUseStore.getState().activeByCharacter.a).toBeUndefined()
      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
    })

    it('켜져 있으면 유효한 가구가 자동으로 선택되어 실제로 걸어가 사용 상태가 된다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useAutoFurnitureUseSettingsStore.getState().setEnabled(true)
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      expect(await advanceUntil(() => occupied('a'), 60)).toBe(true)
      const seatKey = useFurnitureUsageStore.getState().byCharacterId.a
      expect(seatKey).toBeDefined()
      const auto = useAutoFurnitureUseStore.getState().activeByCharacter.a
      expect(auto).toBeDefined()
      expect(auto?.standUpAt).not.toBeNull()
      expect(`${auto?.placementId}:${auto?.slotId}`).toBe(seatKey)
    })

    it('이미 예약/점유된 좌석은 자동 선택 후보에서 제외된다 — 다른 캐릭터의 좌석을 침범하지 않는다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useAutoFurnitureUseSettingsStore.getState().setEnabled(true)
      // Manually reserve the sofa's left seat for 'x' first — the auto candidate list must never include it.
      useFurnitureUsageStore.getState().reserve({ characterId: 'x', placementId: 'sofa-1', roomId, slotId: 'sofa-left' })
      useFurnitureUsageStore.getState().markSeated('x')
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), x: movementEntry('x', 400, 400, roomId, { status: 'seated' }) },
      })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      expect(await advanceUntil(() => occupied('a'), 60)).toBe(true)
      const seatKey = useFurnitureUsageStore.getState().byCharacterId.a
      expect(seatKey).not.toBe('sofa-1:sofa-left')
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left'].characterId).toBe('x') // untouched
    })

    it('2인용 소파: 두 캐릭터가 각각 자동으로 서로 다른 좌석을 동시에 사용할 수 있다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useAutoFurnitureUseSettingsStore.getState().setEnabled(true)
      useHomeStore.setState((state) => ({
        rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, furniture: [sofaPlacement('sofa-1')] } : r)), // sofa only, so both auto-picks land on it
      }))
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 15, SAFE_START_Y, roomId) },
      })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      expect(await advanceUntil(() => occupied('a') && occupied('b'), 60)).toBe(true)
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left']).toBeDefined()
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-right']).toBeDefined()
      const occupants = [useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left'].characterId, useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-right'].characterId]
      expect(new Set(occupants)).toEqual(new Set(['a', 'b'])) // one each, never both on the same seat
    })

    it('같은 방에 사용 가능한 가구가 없으면 무한 재시도 없이 조용히 대기한다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useAutoFurnitureUseSettingsStore.getState().setEnabled(true)
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, emptyRoomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      for (let i = 0; i < 40; i++) await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
      expect(occupied('a')).toBe(false)
      expect(useAutoFurnitureUseStore.getState().activeByCharacter.a).toBeUndefined()
    })
  })

  describe('종료 및 쿨다운', () => {
    it('일정 시간 사용 후 자동으로 일어나 일반 이동/대기 상태로 복귀한다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0) // also forces the hold duration to its minimum (AUTO_FURNITURE_USE_MIN_HOLD_MS)
      useAutoFurnitureUseSettingsStore.getState().setEnabled(true)
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      expect(await advanceUntil(() => occupied('a'), 60)).toBe(true)
      expect(await advanceUntil(() => !occupied('a'), Math.ceil(AUTO_FURNITURE_USE_MIN_HOLD_MS / MOVEMENT_TICK_MS) + 5)).toBe(true)

      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
      expect(useAutoFurnitureUseStore.getState().activeByCharacter.a).toBeUndefined()
      expect(useAutoFurnitureUseStore.getState().lastEndedAtByCharacter.a).toBeDefined()
      expect(['idle', 'moving']).toContain(useCharacterMovementStore.getState().byId.a.status)

      // Genuinely resumes ordinary wandering afterward, not frozen.
      const positions = new Set<string>()
      for (let i = 0; i < 30; i++) {
        await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
        const e = useCharacterMovementStore.getState().byId.a
        positions.add(`${e.x},${e.y}`)
      }
      expect(positions.size).toBeGreaterThan(1)
    })

    it('사용 종료 직후에는 쿨다운 때문에 같은 캐릭터가 즉시 다시 시작하지 않는다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useAutoFurnitureUseSettingsStore.getState().setEnabled(true)
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      expect(await advanceUntil(() => occupied('a'), 60)).toBe(true)
      expect(await advanceUntil(() => !occupied('a'), Math.ceil(AUTO_FURNITURE_USE_MIN_HOLD_MS / MOVEMENT_TICK_MS) + 5)).toBe(true)

      // Well within the cooldown window — random still forces the roll to succeed every tick, so only the cooldown
      // gate can be what's preventing a restart.
      for (let i = 0; i < Math.floor(AUTO_FURNITURE_USE_COOLDOWN_MS / MOVEMENT_TICK_MS / 2); i++) {
        await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
        expect(occupied('a')).toBe(false)
      }

      // Once the cooldown fully elapses, a new session can start again.
      expect(await advanceUntil(() => occupied('a'), cooldownPlusWalkTicks(AUTO_FURNITURE_USE_COOLDOWN_MS))).toBe(true)
    })

    it('캐릭터별 쿨다운은 서로 독립적이다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useAutoFurnitureUseSettingsStore.getState().setEnabled(true)
      // Directly seed 'a' as having just finished an auto session (endAuto itself is a no-op without a real active
      // session, by design — see reconcile's own guard — so a still-cooling-down character is set up here directly).
      useAutoFurnitureUseStore.setState({ lastEndedAtByCharacter: { a: Date.now() } })
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 15, SAFE_START_Y, roomId) },
      })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      expect(await advanceUntil(() => occupied('b'), 60)).toBe(true)
      expect(occupied('a')).toBe(false) // still cooling down, unaffected by b's own session
    })
  })

  describe('반복 억제 (최근 사용 가구 회피)', () => {
    it('직전에 사용한 가구를 다시 선택하지 않고, 다른 가구가 있으면 그쪽을 고른다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0) // always picks index 0 of the surviving candidate pool
      useAutoFurnitureUseSettingsStore.getState().setEnabled(true)
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      expect(await advanceUntil(() => occupied('a'), 60)).toBe(true)
      const firstPlacementId = useAutoFurnitureUseStore.getState().activeByCharacter.a?.placementId
      expect(firstPlacementId).toBe('sofa-1') // sofa-left is candidate index 0 in room.furniture order

      expect(await advanceUntil(() => !occupied('a'), Math.ceil(AUTO_FURNITURE_USE_MIN_HOLD_MS / MOVEMENT_TICK_MS) + 5)).toBe(true)
      expect(await advanceUntil(() => occupied('a'), cooldownPlusWalkTicks(AUTO_FURNITURE_USE_COOLDOWN_MS))).toBe(true)

      const secondPlacementId = useAutoFurnitureUseStore.getState().activeByCharacter.a?.placementId
      expect(secondPlacementId).toBe('chair-1') // sofa-1 is soft-excluded this time, so the chair is picked instead
    })

    it('방에 가구가 하나뿐이면, 최근에 그 가구를 썼어도 쿨다운 이후 다시 선택된다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useAutoFurnitureUseSettingsStore.getState().setEnabled(true)
      useHomeStore.setState((state) => ({ rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, furniture: [chairPlacement('chair-1')] } : r)) }))
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      expect(await advanceUntil(() => occupied('a'), 60)).toBe(true)
      expect(await advanceUntil(() => !occupied('a'), Math.ceil(AUTO_FURNITURE_USE_MIN_HOLD_MS / MOVEMENT_TICK_MS) + 5)).toBe(true)
      expect(await advanceUntil(() => occupied('a'), cooldownPlusWalkTicks(AUTO_FURNITURE_USE_COOLDOWN_MS))).toBe(true)
      expect(useAutoFurnitureUseStore.getState().activeByCharacter.a?.placementId).toBe('chair-1')
    })
  })

  describe('접근 실패 시 안전한 재시도', () => {
    it('접근이 타임아웃되면 실패로 처리되어 더 짧은 재시도 쿨다운이 적용된다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useAutoFurnitureUseSettingsStore.getState().setEnabled(true)
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId, { destination: { x: 690, y: 400 }, status: 'moving' }) },
      })
      // Simulate an auto session that's already been walking for the full timeout window without arriving.
      useFurnitureUsageStore.getState().reserve({ characterId: 'a', placementId: 'sofa-1', roomId, slotId: 'sofa-left' })
      useAutoFurnitureUseStore.getState().startAuto('a', 'sofa-1', 'sofa-left', roomId)
      for (let i = 0; i < MAX_FURNITURE_APPROACH_TICKS; i++) useFurnitureUsageStore.getState().incrementApproachTicks('a')

      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)

      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined() // the movement tick's own timeout released it
      expect(useAutoFurnitureUseStore.getState().activeByCharacter.a).toBeUndefined() // reconciled away, not left stale
      expect(useAutoFurnitureUseStore.getState().lastFailedAtByCharacter.a).toBeDefined()
      expect(useAutoFurnitureUseStore.getState().lastEndedAtByCharacter.a).toBeUndefined() // never a success

      // Immediately after, the roll is refused (still within the shorter retry cooldown), so no attempt restarts yet.
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
      expect(useAutoFurnitureUseStore.getState().activeByCharacter.a).toBeUndefined()

      // Once the shorter retry cooldown elapses, a fresh attempt is allowed again.
      expect(await advanceUntil(() => occupied('a'), cooldownPlusWalkTicks(AUTO_FURNITURE_USE_RETRY_COOLDOWN_MS))).toBe(true)
    })
  })

  describe('수동 명령 및 대화 우선순위', () => {
    it('수동으로 이미 가구를 사용 중인 캐릭터는 자동 행동 대상에서 제외된다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))
      expect(startSitting('a', 'chair-1')).toBe('started')
      expect(await advanceUntil(() => occupied('a'), 60)).toBe(true)

      useAutoFurnitureUseSettingsStore.getState().setEnabled(true) // turning it on now must not disturb the manual session
      for (let i = 0; i < 20; i++) await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)

      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBe('chair-1:seat') // untouched, still the manual seat
      expect(useAutoFurnitureUseStore.getState().activeByCharacter.a).toBeUndefined() // was never claimed as an auto session
    })

    it('자동 사용 중 수동으로 다른 가구에 재배정하면 자동 추적이 안전하게 정리되고, 이동은 새 목표를 그대로 따른다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useAutoFurnitureUseSettingsStore.getState().setEnabled(true)
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))
      expect(await advanceUntil(() => occupied('a'), 60)).toBe(true)
      expect(useAutoFurnitureUseStore.getState().activeByCharacter.a?.placementId).toBe('sofa-1')

      expect(startSitting('a', 'chair-1')).toBe('started') // manual override to a different piece
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS) // one auto pass sees the mismatch and reconciles

      expect(useAutoFurnitureUseStore.getState().activeByCharacter.a).toBeUndefined()
      expect(await advanceUntil(() => occupied('a'), 60)).toBe(true)
      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBe('chair-1:seat') // the manual command won
    })

    it('자동 사용 중 대화가 시작되면 즉시 일어나 대화에 참여하고, 자동 추적도 안전하게 정리된다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useAutoFurnitureUseSettingsStore.getState().setEnabled(true)
      useCharacterStore.setState({ characters: [character('a'), character('c')] })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), c: movementEntry('c', 500, 100, roomId) },
      })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))
      expect(await advanceUntil(() => occupied('a'), 60)).toBe(true)

      const mountedRef = { current: true }
      const outcomePromise = startManualConversation('a', 'c', { current: { time: '', place: '', actionA: '', actionB: '' } }, mountedRef)
      await vi.advanceTimersByTimeAsync(0)

      expect(useCharacterMovementStore.getState().byId.a.status).toBe('talking')
      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined() // stood up by runConversation itself

      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS) // let one auto pass reconcile the now-stale tracking
      expect(useAutoFurnitureUseStore.getState().activeByCharacter.a).toBeUndefined()
      expect(useAutoFurnitureUseStore.getState().lastEndedAtByCharacter.a).toBeDefined()

      await vi.advanceTimersByTimeAsync(20_000)
      await outcomePromise
      expect(useCharacterMovementStore.getState().byId.a.status).not.toBe('talking')
    })
  })

  describe('가구 삭제·이동·회전 시 정리', () => {
    it('자동 사용 중 가구가 삭제되면 안전하게 정리되고, 이후 다시 자동 행동을 시도할 수 있다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useAutoFurnitureUseSettingsStore.getState().setEnabled(true)
      useHomeStore.setState((state) => ({ rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, furniture: [chairPlacement('chair-1')] } : r)) }))
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))
      expect(await advanceUntil(() => occupied('a'), 60)).toBe(true)

      useHomeStore.getState().selectFurniture('chair-1')
      useHomeStore.setState({ activeDecorateRoomId: roomId })
      render(<FurniturePropertiesPanel />)
      fireEvent.click(screen.getByRole('button', { name: '삭제' }))

      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
      expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle')
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
      expect(useAutoFurnitureUseStore.getState().activeByCharacter.a).toBeUndefined()

      // Re-add furniture and confirm auto behavior isn't permanently broken by this. The character had already
      // succeeded in sitting before the deletion (not a failed approach), so the *normal* success cooldown applies
      // here, not the shorter retry one — matches reconcile()'s own documented "did get to use it for a while"
      // classification.
      useHomeStore.getState().addFurniture(chairPlacement('chair-2'))
      expect(await advanceUntil(() => occupied('a'), cooldownPlusWalkTicks(AUTO_FURNITURE_USE_COOLDOWN_MS))).toBe(true)
    })

    it('자동 사용 중 가구가 이동/회전되면 안전하게 정리된다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useAutoFurnitureUseSettingsStore.getState().setEnabled(true)
      useHomeStore.setState((state) => ({ rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, furniture: [sofaPlacement('sofa-1')] } : r)) }))
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))
      expect(await advanceUntil(() => occupied('a'), 60)).toBe(true)

      evictPlacementUsage('sofa-1') // exactly what FurnitureItem's drag-end does first
      useHomeStore.setState({ activeDecorateRoomId: roomId })
      useHomeStore.getState().moveFurniture('sofa-1', 500, 200)
      useHomeStore.getState().updateFurniture('sofa-1', { rotation: 180 })

      expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle')
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
      expect(useAutoFurnitureUseStore.getState().activeByCharacter.a).toBeUndefined()
    })
  })

  describe('캐릭터 삭제 시 정리', () => {
    it('자동 사용 중인 캐릭터를 삭제해도 autoFurnitureUseStore에 잔여 기록이 남지 않는다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useAutoFurnitureUseSettingsStore.getState().setEnabled(true)
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 15, SAFE_START_Y, roomId) },
      })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))
      expect(await advanceUntil(() => occupied('a'), 60)).toBe(true)

      render(<CharacterList />)
      const row = screen.getByText('a').closest<HTMLElement>('.character-list-item')!
      fireEvent.click(within(row).getByRole('button', { name: '삭제' }))

      expect(useCharacterStore.getState().characters.map((c) => c.id)).toEqual(['b'])
      expect(useAutoFurnitureUseStore.getState().activeByCharacter.a).toBeUndefined()
      expect(useAutoFurnitureUseStore.getState().lastEndedAtByCharacter.a).toBeUndefined() // forgotten entirely, not just cleared active
      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
    })
  })

  describe('방 삭제 시 정리', () => {
    it('자동 사용 중인 캐릭터가 있는 방을 삭제해도 안전하게 재배치되고, 자동 추적이 정리된다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useAutoFurnitureUseSettingsStore.getState().setEnabled(true)
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))
      expect(await advanceUntil(() => occupied('a'), 60)).toBe(true)

      render(<RoomTabs activeRoomId={roomId} onSelectRoom={() => {}} />)
      fireEvent.click(screen.getByRole('button', { name: `${useHomeStore.getState().rooms.find((r) => r.id === roomId)!.name} 삭제` }))
      fireEvent.change(screen.getByLabelText('캐릭터를 옮길 방'), { target: { value: room2Id } })
      fireEvent.click(screen.getByRole('button', { name: '삭제' }))

      expect(useCharacterMovementStore.getState().byId.a.roomId).toBe(room2Id)
      expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle')
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
      expect(useAutoFurnitureUseStore.getState().activeByCharacter.a).toBeUndefined()
    })
  })

  describe('자동 대화와 충돌하지 않는다', () => {
    it('다른 두 캐릭터의 자동 대화가 진행되는 동안에도, 자동 가구 사용 중인 캐릭터는 그대로 방해받지 않는다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useAutoFurnitureUseSettingsStore.getState().setEnabled(true)
      useDialogueFrequencyStore.setState({ mode: 'rowdy' }) // near-certain to start a conversation on encounter
      useCharacterStore.setState({ characters: [character('a'), character('b'), character('c')] })
      useCharacterMovementStore.setState({
        byId: {
          a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId),
          b: movementEntry('b', 500, 100, roomId),
          c: movementEntry('c', 505, 100, roomId), // already encountering each other, separate from 'a'
        },
      })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      expect(await advanceUntil(() => occupied('a'), 60)).toBe(true)
      const seatKeyBefore = useFurnitureUsageStore.getState().byCharacterId.a
      for (let i = 0; i < 10; i++) await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
      // 'a' is completely unaffected by whatever happened between b and c.
      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBe(seatKeyBefore)
      expect(occupied('a')).toBe(true)
    })
  })

  describe('저장 데이터: 자동 가구 사용의 런타임 상태는 저장되지 않는다', () => {
    it('진행 중인 자동 세션/쿨다운은 dearly-home에도, dearly-auto-furniture-use에도 남지 않는다 — 설정값만 저장된다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useAutoFurnitureUseSettingsStore.getState().setEnabled(true)
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))
      expect(await advanceUntil(() => occupied('a'), 60)).toBe(true)

      const savedHome = localStorage.getItem('dearly-home')
      expect(savedHome).not.toContain('activeByCharacter')
      expect(savedHome).not.toContain('standUpAt')

      const savedSetting = localStorage.getItem('dearly-auto-furniture-use')
      expect(savedSetting).toContain('"enabled":true')
      expect(savedSetting).not.toContain('activeByCharacter')
      expect(savedSetting).not.toContain('lastEndedAtByCharacter')
    })
  })
})
