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
import { createDefaultNeeds } from '../needs/needsConfig'
import { useNeedsStore } from '../needs/needsStore'
import { useAutoFurnitureUseSettingsStore } from '../simulation/autoFurnitureUseSettingsStore'
import { useAutoFurnitureUseStore } from '../simulation/autoFurnitureUseStore'
import { useCharacterMovementStore, type CharacterMovementState } from '../simulation/characterMovementStore'
import { useFurnitureUsageStore } from '../simulation/furnitureUsageStore'
import { evictPlacementUsage } from '../simulation/furnitureUsageTrigger'
import { CHARACTER_RADIUS, MOVEMENT_TICK_MS } from '../simulation/movementConfig'
import { useSimulationStore } from '../simulation/simulationStore'
import { useCharacterMovementSimulation } from '../simulation/useCharacterMovementSimulation'
import { restoreSaveData } from '../save/saveRestore'
import { serializeSaveData } from '../save/saveSerializer'
import { distanceBetween } from '../simulation/movementEngine'
import {
  CHARACTER_INTERACTION_COOLDOWN_MS,
  CHARACTER_INTERACTION_RETRY_COOLDOWN_MS,
  FREEFORM_INTERACTION_DISTANCE,
  MAX_INTERACTION_APPROACH_TICKS,
} from './characterInteractionConfig'
import { useCharacterInteractionSettingsStore } from './characterInteractionSettingsStore'
import { useCharacterInteractionStore } from './characterInteractionStore'
import { endActiveCharacterInteractionsFor, startManualCharacterInteraction } from './characterInteractionTrigger'

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
  useCharacterInteractionStore.getState().reset()
  useCharacterInteractionSettingsStore.setState({ enabled: false })
  useNeedsStore.setState({ byId: {} })
}

async function advanceUntil(predicate: () => boolean, maxTicks: number): Promise<boolean> {
  for (let i = 0; i < maxTicks; i++) {
    if (predicate()) return true
    await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
  }
  return predicate()
}

function status(id: string): string | undefined {
  return useCharacterMovementStore.getState().byId[id]?.status
}

function inSession(id: string): boolean {
  return useCharacterInteractionStore.getState().isCharacterBusy(id)
}

function sessionOf(id: string) {
  const sessionId = useCharacterInteractionStore.getState().byCharacterId[id]
  return sessionId ? useCharacterInteractionStore.getState().sessions[sessionId] : undefined
}

function liveDistance(idA: string, idB: string): number {
  const a = useCharacterMovementStore.getState().byId[idA]
  const b = useCharacterMovementStore.getState().byId[idB]
  return distanceBetween({ x: a.x, y: a.y }, { x: b.x, y: b.y })
}

function seatFullNeeds(overrides: Record<string, number> = {}) {
  return { ...createDefaultNeeds(() => 1), ...overrides } // random()=1 -> every need at NEED_DEFAULT_MAX (85), comfortably non-critical
}

describe('캐릭터끼리 상호작용 시스템 (생활 시뮬레이션 2단계)', () => {
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
      expect(useCharacterInteractionSettingsStore.getState().enabled).toBe(false)
    })

    it('켜면 localStorage에 저장된다', () => {
      useCharacterInteractionSettingsStore.getState().setEnabled(true)
      expect(localStorage.getItem('dearly-character-interaction')).toContain('"enabled":true')
    })

    it('Live 화면의 토글 버튼으로 켜고 끌 수 있다', () => {
      useCharacterStore.setState({ characters: [character('a', '밀로'), character('b', '루나')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, roomId), b: movementEntry('b', 310, 300, roomId) } })
      render(<LiveScreen />)

      const toggle = screen.getByRole('button', { name: '캐릭터 상호작용 꺼짐' })
      fireEvent.click(toggle)
      expect(useCharacterInteractionSettingsStore.getState().enabled).toBe(true)
      expect(screen.getByRole('button', { name: '캐릭터 상호작용 켜짐' })).toBeInTheDocument()
    })
  })

  describe('1. 두 캐릭터가 같은 방에 있고 조건이 맞으면 자동으로 상호작용이 시작된다', () => {
    it('설정이 켜져 있고, 확률이 항상 성공하면 idle한 두 캐릭터 사이에 상호작용이 생성된다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useCharacterInteractionSettingsStore.getState().setEnabled(true)
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useNeedsStore.setState({ byId: { a: seatFullNeeds(), b: seatFullNeeds() } })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 15, SAFE_START_Y, roomId) },
      })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      expect(await advanceUntil(() => inSession('a') && inSession('b'), 20)).toBe(true)
    })

    it('설정이 꺼져 있으면 확률이 항상 성공해도 시작되지 않는다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useNeedsStore.setState({ byId: { a: seatFullNeeds(), b: seatFullNeeds() } })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 15, SAFE_START_Y, roomId) },
      })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      for (let i = 0; i < 30; i++) await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
      expect(inSession('a')).toBe(false)
      expect(inSession('b')).toBe(false)
    })
  })

  describe('2. 캐릭터가 1명뿐이면 상호작용이 생성되지 않는다', () => {
    it('등록된 캐릭터가 한 명이면 자동 패스가 아무 것도 하지 않는다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useCharacterInteractionSettingsStore.getState().setEnabled(true)
      useCharacterStore.setState({ characters: [character('a')] })
      useNeedsStore.setState({ byId: { a: seatFullNeeds() } })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      for (let i = 0; i < 20; i++) await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
      expect(inSession('a')).toBe(false)
    })
  })

  describe('3. 같은 캐릭터끼리는 상호작용할 수 없다', () => {
    it('manual 호출이 same_character를 반환한다', () => {
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, roomId) } })
      expect(startManualCharacterInteraction('hug', 'a', 'a')).toBe('same_character')
    })
  })

  describe('4. 한 캐릭터가 이미 다른 상호작용/대화 중이면 두 번째에 참여할 수 없다 (동시 요청 포함)', () => {
    it('이미 상호작용 세션에 참여 중인 캐릭터는 세 번째 캐릭터와 새 상호작용을 시작할 수 없다', () => {
      useCharacterStore.setState({ characters: [character('a'), character('b'), character('c')] })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', 300, 300, roomId), b: movementEntry('b', 310, 300, roomId), c: movementEntry('c', 320, 300, roomId) },
      })
      expect(startManualCharacterInteraction('holdHands', 'a', 'b')).toBe('started')
      expect(startManualCharacterInteraction('hug', 'a', 'c')).toBe('busy')
      expect(startManualCharacterInteraction('hug', 'b', 'c')).toBe('busy')
    })

    it('동시(같은 틱) 요청 — 두 번째 manual 호출이 먼저 것을 방해하지 않고 안전하게 실패한다', () => {
      useCharacterStore.setState({ characters: [character('a'), character('b'), character('c'), character('d')] })
      useCharacterMovementStore.setState({
        byId: {
          a: movementEntry('a', 300, 300, roomId),
          b: movementEntry('b', 310, 300, roomId),
          c: movementEntry('c', 320, 300, roomId),
          d: movementEntry('d', 330, 300, roomId),
        },
      })
      expect(startManualCharacterInteraction('stayTogether', 'a', 'b')).toBe('started')
      // 'a' is already committed — a second overlapping request naming it must fail, never silently steal it.
      expect(startManualCharacterInteraction('stayTogether', 'a', 'd')).toBe('busy')
      // Disjoint pair is unaffected.
      expect(startManualCharacterInteraction('stayTogether', 'c', 'd')).toBe('started')
    })
  })

  describe('5. talk은 기존 대화 엔진을 그대로 재사용한다', () => {
    it('상호작용 세션 중인 캐릭터는 manual 대화하기(startManualConversation)로도 시작할 수 없다 — 두 시스템이 서로의 busy를 인식한다', async () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, roomId), b: movementEntry('b', 310, 300, roomId) } })
      expect(startManualCharacterInteraction('hug', 'a', 'b')).toBe('started')

      const outcome = await startManualConversation('a', 'b', situationRefValue(), { current: true })
      expect(outcome).toBe('busy')
    })

    it('talk 시작 시 characterInteractionStore에는 세션이 생기지 않는다 — 기존 dialogueStore가 전담한다', () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, roomId), b: movementEntry('b', 310, 300, roomId) } })
      useDialogueStore.getState().startConversation(['a', 'b'])
      expect(inSession('a')).toBe(false)
      expect(inSession('b')).toBe(false)
    })
  })

  describe('6. stayTogether — 접근, 근접 도달, 유지, 사회적 욕구 점진 회복, 종료', () => {
    it('멀리 떨어진 두 캐릭터를 manual로 시작하면 A가 B에게 걸어가 가까워진 뒤 active로 전환되고, 유지 시간이 지나면 idle로 돌아온다', async () => {
      // Manual start deliberately isn't gated by the automatic idle-candidate check, so this test can place the two
      // characters genuinely far apart (150 vs. 600) to exercise the real approach-then-hold loop. Math.random is
      // mocked to 0 so `pickApproachDestination`'s own angle/fallback rolls are deterministic (angle 0 places the
      // approach point directly on B's near side, never an unrelated random fallback point).
      vi.spyOn(Math, 'random').mockReturnValue(0)
      // No furniture in the way — this test is about the approach-then-hold loop itself, not obstacle avoidance.
      useHomeStore.setState((state) => ({ rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, furniture: [] } : r)) }))
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useNeedsStore.setState({ byId: { a: seatFullNeeds({ social: 50 }), b: seatFullNeeds({ social: 50 }) } })
      // Both on the real walkable floor band (y=380, well below FLOOR_TOP_Y) — only x differs, so the approach is a
      // plain horizontal walk with no floor-bounds clamping distorting the target point.
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', 150, 380, roomId), b: movementEntry('b', 600, 380, roomId) },
      })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      expect(startManualCharacterInteraction('stayTogether', 'a', 'b')).toBe('started')
      expect(await advanceUntil(() => status('a') === 'interacting' && status('b') === 'interacting', 60)).toBe(true)

      // Eventually walks close enough and the session ends naturally, returning both to idle.
      expect(await advanceUntil(() => !inSession('a'), 100)).toBe(true)
      expect(status('a')).toBe('idle')
      expect(status('b')).toBe('idle')
      // Social recovered for both, incrementally during the active phase (not left untouched at the default 50).
      expect(useNeedsStore.getState().byId.a.social).toBeGreaterThan(50)
      expect(useNeedsStore.getState().byId.b.social).toBeGreaterThan(50)
    })
  })

  describe('7 & 8. hug / holdHands — 짧은 지속시간, 종료 시 사회적 욕구 일괄 회복', () => {
    it('hug: manual로 시작하면 근접해 있으므로 즉시 active로 전환되고, 종료 후 두 캐릭터 모두 사회적 욕구가 회복된다', async () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useNeedsStore.setState({ byId: { a: seatFullNeeds({ social: 40 }), b: seatFullNeeds({ social: 40 }) } })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, roomId), b: movementEntry('b', 305, 300, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      expect(startManualCharacterInteraction('hug', 'a', 'b')).toBe('started')
      expect(await advanceUntil(() => !inSession('a'), 40)).toBe(true)
      expect(useNeedsStore.getState().byId.a.social).toBeGreaterThan(40)
      expect(useNeedsStore.getState().byId.b.social).toBeGreaterThan(40)
      expect(status('a')).toBe('idle')
      expect(status('b')).toBe('idle')
    })

    it('holdHands: manual로 시작하면 종료 후 두 캐릭터 모두 사회적 욕구가 회복된다', async () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useNeedsStore.setState({ byId: { a: seatFullNeeds({ social: 40 }), b: seatFullNeeds({ social: 40 }) } })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, roomId), b: movementEntry('b', 305, 300, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      expect(startManualCharacterInteraction('holdHands', 'a', 'b')).toBe('started')
      expect(await advanceUntil(() => !inSession('a'), 60)).toBe(true)
      expect(useNeedsStore.getState().byId.a.social).toBeGreaterThan(40)
      expect(useNeedsStore.getState().byId.b.social).toBeGreaterThan(40)
    })
  })

  describe('9. sitTogether — 실제 좌석 슬롯(sofa-left/right)을 그대로 재사용한다', () => {
    it('두 좌석 모두 furnitureUsageStore에 실제로 예약/점유되고, 이동 상태는 seated가 된다', async () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 15, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      expect(startManualCharacterInteraction('sitTogether', 'a', 'b')).toBe('started')
      expect(await advanceUntil(() => status('a') === 'seated' && status('b') === 'seated', 60)).toBe(true)

      const seatA = useFurnitureUsageStore.getState().byCharacterId.a
      const seatB = useFurnitureUsageStore.getState().byCharacterId.b
      expect(new Set([seatA, seatB])).toEqual(new Set(['sofa-1:sofa-left', 'sofa-1:sofa-right']))
    })

    it('세션 종료 후 두 좌석 모두 해제되고 idle로 돌아온다', async () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useNeedsStore.setState({ byId: { a: seatFullNeeds({ social: 40 }), b: seatFullNeeds({ social: 40 }) } })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 15, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      expect(startManualCharacterInteraction('sitTogether', 'a', 'b')).toBe('started')
      expect(await advanceUntil(() => status('a') === 'seated' && status('b') === 'seated', 60)).toBe(true)
      expect(await advanceUntil(() => !inSession('a'), 60)).toBe(true)

      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
      expect(useFurnitureUsageStore.getState().byCharacterId.b).toBeUndefined()
      expect(status('a')).toBe('idle')
      expect(status('b')).toBe('idle')
      expect(useNeedsStore.getState().byId.a.social).toBeGreaterThan(40)
      expect(useNeedsStore.getState().byId.b.social).toBeGreaterThan(40)
    })
  })

  describe('10. 좌석 부족 시 안전하게 실패한다', () => {
    it('2인용 좌석이 있는 가구가 하나도 없으면 sitTogether는 no_seats_available을 반환하고 아무도 앉지 않는다', () => {
      useHomeStore.setState((state) => ({ rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, furniture: [chairPlacement('chair-1'), chairPlacement('chair-2', 200, 200)] } : r)) }))
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, roomId), b: movementEntry('b', 310, 300, roomId) } })

      expect(startManualCharacterInteraction('sitTogether', 'a', 'b')).toBe('no_seats_available')
      expect(inSession('a')).toBe(false)
      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
    })

    it('소파 한쪽 좌석이 이미 다른 캐릭터로 차 있으면 sitTogether는 그 소파를 후보에서 제외하고 실패한다', () => {
      useHomeStore.setState((state) => ({ rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, furniture: [sofaPlacement('sofa-1')] } : r)) }))
      useFurnitureUsageStore.getState().reserve({ characterId: 'x', placementId: 'sofa-1', roomId, slotId: 'sofa-left' })
      useFurnitureUsageStore.getState().markSeated('x')
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', 300, 300, roomId), b: movementEntry('b', 310, 300, roomId), x: movementEntry('x', 400, 400, roomId, { status: 'seated' }) },
      })

      expect(startManualCharacterInteraction('sitTogether', 'a', 'b')).toBe('no_seats_available')
      expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left'].characterId).toBe('x') // untouched
    })
  })

  describe('13. 배고픔/기력이 위급하면 캐릭터 상호작용보다 우선한다', () => {
    it('기력이 위급한 캐릭터는 확률이 항상 성공해도 자동으로 상호작용을 시작하지 않는다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useCharacterInteractionSettingsStore.getState().setEnabled(true)
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useNeedsStore.setState({ byId: { a: seatFullNeeds({ energy: 10 }), b: seatFullNeeds() } })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 15, SAFE_START_Y, roomId) },
      })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      for (let i = 0; i < 30; i++) await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
      expect(inSession('a')).toBe(false)
    })

    it('manual 요청은 위급 욕구 게이트의 영향을 받지 않는다 — 명시적 사용자 클릭은 항상 시도된다', () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useNeedsStore.setState({ byId: { a: seatFullNeeds({ hunger: 5 }), b: seatFullNeeds() } })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, roomId), b: movementEntry('b', 310, 300, roomId) } })
      expect(startManualCharacterInteraction('hug', 'a', 'b')).toBe('started')
    })
  })

  describe('14. 쿨다운이 작동한다', () => {
    it('상호작용이 끝난 직후에는 같은 쌍이 즉시 다시 자동으로 시작하지 않는다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useCharacterInteractionSettingsStore.getState().setEnabled(true)
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useNeedsStore.setState({ byId: { a: seatFullNeeds(), b: seatFullNeeds() } })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, roomId), b: movementEntry('b', 305, 300, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      expect(await advanceUntil(() => inSession('a'), 20)).toBe(true)
      expect(await advanceUntil(() => !inSession('a'), 60)).toBe(true)

      for (let i = 0; i < Math.floor(CHARACTER_INTERACTION_COOLDOWN_MS / MOVEMENT_TICK_MS / 2); i++) {
        await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
        expect(inSession('a')).toBe(false)
      }
    })

    it('실패 후에는 더 짧은 재시도 쿨다운이 적용된다', () => {
      useCharacterInteractionStore.getState().markFailedForPair('a|b', Date.now())
      const stillCoolingDown = Date.now() - (useCharacterInteractionStore.getState().lastFailedAtByPair['a|b'] ?? 0) < CHARACTER_INTERACTION_RETRY_COOLDOWN_MS
      expect(stillCoolingDown).toBe(true)
    })
  })

  describe('15. 캐릭터 삭제 시 상호작용이 정리된다', () => {
    it('상호작용 중인 캐릭터를 삭제하면 세션이 즉시 끝나고 생존한 상대는 idle로 돌아온다', () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, roomId), b: movementEntry('b', 305, 300, roomId) } })
      expect(startManualCharacterInteraction('hug', 'a', 'b')).toBe('started')

      render(<CharacterList />)
      const row = screen.getByText('a').closest<HTMLElement>('.character-list-item')!
      fireEvent.click(within(row).getByRole('button', { name: '삭제' }))

      expect(useCharacterStore.getState().characters.map((c) => c.id)).toEqual(['b'])
      expect(inSession('b')).toBe(false)
      expect(status('b')).toBe('idle')
    })

    it('endActiveCharacterInteractionsFor는 세션이 없는 캐릭터에 대해 안전한 no-op이다', () => {
      expect(() => endActiveCharacterInteractionsFor('nobody')).not.toThrow()
    })
  })

  describe('16. 방 삭제 시 상호작용이 정리된다', () => {
    it('sitTogether 중인 방을 삭제하면 좌석이 해제되고 두 캐릭터 모두 새 방으로 안전하게 옮겨진다', async () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 15, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))
      expect(startManualCharacterInteraction('sitTogether', 'a', 'b')).toBe('started')
      expect(await advanceUntil(() => status('a') === 'seated' && status('b') === 'seated', 60)).toBe(true)

      render(<RoomTabs activeRoomId={roomId} onSelectRoom={() => {}} />)
      fireEvent.click(screen.getByRole('button', { name: `${useHomeStore.getState().rooms.find((r) => r.id === roomId)!.name} 삭제` }))
      fireEvent.change(screen.getByLabelText('캐릭터를 옮길 방'), { target: { value: room2Id } })
      fireEvent.click(screen.getByRole('button', { name: '삭제' }))

      expect(useCharacterMovementStore.getState().byId.a.roomId).toBe(room2Id)
      expect(useCharacterMovementStore.getState().byId.b.roomId).toBe(room2Id)
      expect(inSession('a')).toBe(false)
      expect(inSession('b')).toBe(false)
      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
      expect(status('a')).toBe('idle')
      expect(status('b')).toBe('idle')
    })
  })

  describe('17. 저장/불러오기 후 상호작용 런타임 상태가 없다', () => {
    it('상호작용 중에 저장하고 다시 불러오면 세션이 남지 않고 모든 캐릭터가 idle이다', async () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, roomId), b: movementEntry('b', 305, 300, roomId) } })
      expect(startManualCharacterInteraction('hug', 'a', 'b')).toBe('started')
      expect(inSession('a')).toBe(true)

      const saveData = serializeSaveData()
      restoreSaveData(saveData)

      expect(useCharacterInteractionStore.getState().sessions).toEqual({})
      expect(useCharacterInteractionStore.getState().byCharacterId).toEqual({})
      expect(status('a')).toBe('idle')
      expect(status('b')).toBe('idle')
    })

    it('저장 데이터에는 상호작용 런타임 상태가 전혀 포함되지 않는다', () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, roomId), b: movementEntry('b', 305, 300, roomId) } })
      startManualCharacterInteraction('hug', 'a', 'b')

      const saveData = serializeSaveData()
      const serialized = JSON.stringify(saveData)
      expect(serialized).not.toContain('characterAId')
      expect(serialized).not.toContain('socialRecoveryApplied')
    })

    it('설정(켜짐/꺼짐) 저장 데이터에는 세션/쿨다운 런타임 상태가 없다 — enabled만 저장된다', () => {
      useCharacterInteractionSettingsStore.getState().setEnabled(true)
      const saved = localStorage.getItem('dearly-character-interaction')
      expect(saved).toContain('"enabled":true')
      expect(saved).not.toContain('sessions')
      expect(saved).not.toContain('byCharacterId')
    })
  })

  describe('18. Live 화면에 현재 상호작용 상태가 표시된다', () => {
    it('hug 중인 캐릭터의 상태 문구가 함께 생활하기 화면에 나타난다', async () => {
      useCharacterStore.setState({ characters: [character('a', '밀로'), character('b', '루나')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, roomId), b: movementEntry('b', 305, 300, roomId) } })
      render(<LiveScreen />)

      expect(startManualCharacterInteraction('hug', 'a', 'b')).toBe('started')
      await vi.advanceTimersByTimeAsync(0)

      const panel = screen.getByLabelText('캐릭터 상태')
      expect(within(panel).getByText('루나를 안아주고 있어요')).toBeInTheDocument()
      expect(within(panel).getByText('밀로를 안아주고 있어요')).toBeInTheDocument()
    })
  })

  describe('19. 수동 UI가 자동과 동일한 엔진을 사용한다', () => {
    it('CharacterInteractionPanel의 "같이 앉기" 버튼을 누르면 startManualCharacterInteraction과 동일하게 실제 좌석을 예약한다', async () => {
      useCharacterStore.setState({ characters: [character('a', '밀로'), character('b', '루나')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 15, SAFE_START_Y, roomId) } })
      render(<LiveScreen />)

      fireEvent.click(screen.getByRole('button', { name: '캐릭터 상호작용: 같이 앉기' }))
      expect(await advanceUntil(() => status('a') === 'seated' && status('b') === 'seated', 60)).toBe(true)
      const seatA = useFurnitureUsageStore.getState().byCharacterId.a
      expect(seatA === 'sofa-1:sofa-left' || seatA === 'sofa-1:sofa-right').toBe(true)
    })

    it('모든 상대가 이미 바쁘면 버튼이 비활성화된다', () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, roomId), b: movementEntry('b', 305, 300, roomId) } })
      startManualCharacterInteraction('hug', 'a', 'b') // both already busy
      render(<LiveScreen />)
      expect(screen.getByRole('button', { name: '캐릭터 상호작용: 안아주기' })).toBeDisabled()
    })
  })

  describe('20. 가구 삭제·이동 시 sitTogether가 안전하게 정리된다', () => {
    it('sitTogether 중 소파가 삭제되면 두 캐릭터 모두 안전하게 idle로 돌아온다', async () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 15, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))
      expect(startManualCharacterInteraction('sitTogether', 'a', 'b')).toBe('started')
      expect(await advanceUntil(() => status('a') === 'seated' && status('b') === 'seated', 60)).toBe(true)

      useHomeStore.getState().selectFurniture('sofa-1')
      useHomeStore.setState({ activeDecorateRoomId: roomId })
      render(<FurniturePropertiesPanel />)
      fireEvent.click(screen.getByRole('button', { name: '삭제' }))

      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
      expect(inSession('a')).toBe(false)
      expect(inSession('b')).toBe(false)
      // Freed to resume ordinary wandering immediately — not necessarily still 'idle' one tick later (the ordinary
      // wander loop may have already picked a new destination and taken a step), same "resumes normally" pattern
      // autoFurnitureUse.test.tsx's own post-cleanup assertions use.
      expect(['idle', 'moving']).toContain(status('a'))
      expect(['idle', 'moving']).toContain(status('b'))
    })

    it('sitTogether 중 소파가 이동/회전되면 안전하게 정리된다', async () => {
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 15, SAFE_START_Y, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))
      expect(startManualCharacterInteraction('sitTogether', 'a', 'b')).toBe('started')
      expect(await advanceUntil(() => status('a') === 'seated' && status('b') === 'seated', 60)).toBe(true)

      evictPlacementUsage('sofa-1') // exactly what FurnitureItem's drag-end does first
      useHomeStore.setState({ activeDecorateRoomId: roomId })
      useHomeStore.getState().moveFurniture('sofa-1', 500, 200)

      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
      expect(inSession('a')).toBe(false)
      expect(inSession('b')).toBe(false)
    })
  })

  describe('21. 자동 가구 사용과 충돌하지 않는다', () => {
    it('둘 다 켜져 있어도 한 캐릭터가 동시에 두 시스템 모두에 잡히지 않는다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useCharacterInteractionSettingsStore.getState().setEnabled(true)
      useAutoFurnitureUseSettingsStore.getState().setEnabled(true)
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useNeedsStore.setState({ byId: { a: seatFullNeeds(), b: seatFullNeeds() } })
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', SAFE_START_X, SAFE_START_Y, roomId), b: movementEntry('b', SAFE_START_X + 15, SAFE_START_Y, roomId) },
      })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      for (let i = 0; i < 40; i++) {
        await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
        // Never both an auto-furniture-use session AND a character-interaction session for the same character at once.
        const autoActive = useAutoFurnitureUseStore.getState().activeByCharacter.a !== undefined
        const interactionActive = inSession('a')
        expect(autoActive && interactionActive).toBe(false)
      }
    })
  })

  describe('22. hug/holdHands 자연스러운 접근 (거리 기반 approaching → active 전환)', () => {
    it('hug: 멀리서 시작 → 서로 접근 → 붙음 → hug — 즉시 active로 들어가지 않고, 실제로 가까워진 뒤에만 active가 된다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useHomeStore.setState((state) => ({ rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, furniture: [] } : r)) }))
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useNeedsStore.setState({ byId: { a: seatFullNeeds({ social: 40 }), b: seatFullNeeds({ social: 40 }) } })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 150, 380, roomId), b: movementEntry('b', 600, 380, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      expect(startManualCharacterInteraction('hug', 'a', 'b')).toBe('started')
      // Not immediately active — starts far apart, well beyond hug's own finalDistance.
      expect(sessionOf('a')?.phase).toBe('approaching')
      expect(liveDistance('a', 'b')).toBeGreaterThan(FREEFORM_INTERACTION_DISTANCE.hug.finalDistance)

      // Genuinely walks closer over multiple ticks (not a teleport) — position actually changes tick by tick.
      const positionsSeen = new Set<string>()
      for (let i = 0; i < 40 && sessionOf('a')?.phase === 'approaching'; i++) {
        await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
        const a = useCharacterMovementStore.getState().byId.a
        positionsSeen.add(`${Math.round(a.x)},${Math.round(a.y)}`)
      }
      expect(positionsSeen.size).toBeGreaterThan(3) // moved through several distinct positions while approaching

      expect(await advanceUntil(() => sessionOf('a')?.phase === 'active', 40)).toBe(true)
      // Real arrival: close enough to visually overlap (hug), but not exactly on top of each other (never teleported to coincide).
      const finalDist = liveDistance('a', 'b')
      expect(finalDist).toBeLessThanOrEqual(FREEFORM_INTERACTION_DISTANCE.hug.finalDistance)
      expect(finalDist).toBeGreaterThan(0)
      // Facing resolved once arrived, since hug's facingMode is 'faceEachOther'.
      expect(sessionOf('a')?.facing).not.toBeNull()

      expect(await advanceUntil(() => !inSession('a'), 30)).toBe(true)
      expect(status('a')).toBe('idle')
      expect(status('b')).toBe('idle')
      expect(useNeedsStore.getState().byId.a.social).toBeGreaterThan(40)
      expect(useNeedsStore.getState().byId.b.social).toBeGreaterThan(40)
    })

    it('holdHands: 멀리서 시작 → 서로 접근 → 적정 거리(팔을 뻗은 정도) → 손잡기', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useHomeStore.setState((state) => ({ rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, furniture: [] } : r)) }))
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 150, 380, roomId), b: movementEntry('b', 600, 380, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      expect(startManualCharacterInteraction('holdHands', 'a', 'b')).toBe('started')
      expect(sessionOf('a')?.phase).toBe('approaching')

      expect(await advanceUntil(() => sessionOf('a')?.phase === 'active', 60)).toBe(true)
      const finalDist = liveDistance('a', 'b')
      // Arm's-reach range: close enough to hold hands, but bodies never overlap (unlike hug, stays above the
      // ordinary character-vs-character collision floor, so no partner-collision exception was even needed to reach it).
      expect(finalDist).toBeLessThanOrEqual(FREEFORM_INTERACTION_DISTANCE.holdHands.finalDistance)
      expect(finalDist).toBeGreaterThan(CHARACTER_RADIUS * 2)
      expect(sessionOf('a')?.facing).not.toBeNull()
    })

    it('이미 가까운 상태에서 실행하면 걷지 않고 곧바로(다음 틱 안에) active로 전환된다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useHomeStore.setState((state) => ({ rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, furniture: [] } : r)) }))
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      const closeDistance = FREEFORM_INTERACTION_DISTANCE.hug.finalDistance - 2
      useCharacterMovementStore.setState({
        byId: { a: movementEntry('a', 400, 380, roomId), b: movementEntry('b', 400 + closeDistance, 380, roomId) },
      })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      expect(startManualCharacterInteraction('hug', 'a', 'b')).toBe('started')
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
      expect(sessionOf('a')?.phase).toBe('active')
    })

    it('접근 중 상대가 이동하면 목적지가 상대의 새 위치를 따라가지만, 상대가 가만히 있는 동안에는 목적지를 매 틱 재설정하지 않는다(떨림 방지)', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useHomeStore.setState((state) => ({ rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, furniture: [] } : r)) }))
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 150, 380, roomId), b: movementEntry('b', 600, 380, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      expect(startManualCharacterInteraction('holdHands', 'a', 'b')).toBe('started')
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
      const destAfterFirstTick = useCharacterMovementStore.getState().byId.a.destination

      // B stays put — the very next tick must not have picked a new destination (no jitter).
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
      const destAfterSecondTick = useCharacterMovementStore.getState().byId.a.destination
      expect(destAfterSecondTick).toEqual(destAfterFirstTick)

      // B genuinely moves (well beyond the recompute tolerance) — the next tick must update the destination to follow.
      useCharacterMovementStore.getState().setPosition('b', { x: 300, y: 380 })
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
      const destAfterMove = useCharacterMovementStore.getState().byId.a.destination
      expect(destAfterMove).not.toEqual(destAfterSecondTick)
      // The new destination is aimed at B's *new* position (300), approachDistance short of it — not the stale target (600).
      expect(destAfterMove!.x).toBeCloseTo(300 - FREEFORM_INTERACTION_DISTANCE.holdHands.approachDistance, 0)
    })

    it('접근이 불가능하면(가구로 완전히 막힘) 일정 시간 내 취소되고, 두 캐릭터 모두 interacting에 영구히 갇히지 않는다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      // A wide, solid wall of furniture directly between the two characters, spanning far more than the room's own
      // width at their shared y — genuinely unreachable, not merely slow (see FurniturePlacement scale note below).
      const wall: FurniturePlacement = { id: 'wall', furnitureId: 'sofa', x: 400, y: 380, scale: 3, rotation: 0, colorway: 'rose', layer: 0 }
      useHomeStore.setState((state) => ({ rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, furniture: [wall] } : r)) }))
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 100, 380, roomId), b: movementEntry('b', 680, 380, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      expect(startManualCharacterInteraction('hug', 'a', 'b')).toBe('started')
      for (let i = 0; i < MAX_INTERACTION_APPROACH_TICKS + 2; i++) await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)

      expect(inSession('a')).toBe(false)
      expect(inSession('b')).toBe(false)
      expect(status('a')).toBe('idle')
      expect(status('b')).toBe('idle')
      // Treated as a failure (shorter retry cooldown), never a success.
      expect(useCharacterInteractionStore.getState().lastFailedAtByPair['a|b']).toBeDefined()
      expect(useCharacterInteractionStore.getState().lastEndedAtByPair['a|b']).toBeUndefined()
    })

    it('상호작용 중 취소(예: 캐릭터 삭제와 같은 외부 정리)가 호출되면 접근 중이던 두 캐릭터 모두 즉시 idle로 풀려난다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useHomeStore.setState((state) => ({ rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, furniture: [] } : r)) }))
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 150, 380, roomId), b: movementEntry('b', 600, 380, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      expect(startManualCharacterInteraction('hug', 'a', 'b')).toBe('started')
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS * 3)
      expect(sessionOf('a')?.phase).toBe('approaching') // still mid-approach, not yet active

      endActiveCharacterInteractionsFor('a')
      expect(inSession('a')).toBe(false)
      expect(inSession('b')).toBe(false)
      expect(status('a')).toBe('idle')
      expect(status('b')).toBe('idle')
    })

    it('상호작용 종료 후에는 자동 이동(autonomous wandering)이 정상적으로 재개된다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useHomeStore.setState((state) => ({ rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, furniture: [] } : r)) }))
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 150, 380, roomId), b: movementEntry('b', 600, 380, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      expect(startManualCharacterInteraction('hug', 'a', 'b')).toBe('started')
      expect(await advanceUntil(() => !inSession('a'), 80)).toBe(true)

      for (let i = 0; i < 20; i++) {
        await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
        expect(['idle', 'moving']).toContain(status('a'))
        expect(status('a')).not.toBe('interacting')
      }
    })

    it('회귀: stayTogether는 이전과 동일한 근접 거리(48)에서 그대로 active가 된다 — 이번 변경은 hug/holdHands에만 영향을 준다', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      useHomeStore.setState((state) => ({ rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, furniture: [] } : r)) }))
      useCharacterStore.setState({ characters: [character('a'), character('b')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 150, 380, roomId), b: movementEntry('b', 600, 380, roomId) } })
      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      expect(startManualCharacterInteraction('stayTogether', 'a', 'b')).toBe('started')
      expect(await advanceUntil(() => sessionOf('a')?.phase === 'active', 60)).toBe(true)
      expect(liveDistance('a', 'b')).toBeLessThanOrEqual(FREEFORM_INTERACTION_DISTANCE.stayTogether.finalDistance)
      expect(sessionOf('a')?.facing).toBeNull() // stayTogether never resolves facing
    })
  })
})
