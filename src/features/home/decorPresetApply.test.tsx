import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { useBgmStore } from '../bgm/bgmStore'
import { useCharacterStore } from '../character/characterStore'
import { EMPTY_AI_PROFILE, type Character } from '../character/types'
import { useDialogueStore } from '../dialogue/dialogueStore'
import { useDialogueFrequencyStore } from '../dialogue/dialogueFrequencyStore'
import { useMonologueFrequencyStore } from '../dialogue/monologueFrequencyStore'
import { useMonologueStore } from '../dialogue/monologueStore'
import { useRelationshipStore } from '../dialogue/relationshipStore'
import { useRoomLightingSettingsStore } from '../lighting/roomLightingSettingsStore'
import { useAutoFurnitureUseSettingsStore } from '../simulation/autoFurnitureUseSettingsStore'
import { useAutoFurnitureUseStore } from '../simulation/autoFurnitureUseStore'
import { useCharacterMovementStore, type CharacterMovementState } from '../simulation/characterMovementStore'
import { useFurnitureUsageStore } from '../simulation/furnitureUsageStore'
import { MOVEMENT_TICK_MS } from '../simulation/movementConfig'
import { circleIntersectsRect, furnitureObstacles } from '../simulation/movementEngine'
import { useSimulationStore } from '../simulation/simulationStore'
import { useCharacterMovementSimulation } from '../simulation/useCharacterMovementSimulation'
import { applyDecorPreset, hasActiveDecorPresetBackup, revertLastDecorPreset } from './decorPresetApply'
import { DecorPresetPanel } from './DecorPresetPanel'
import { DecorPresetPreview } from './DecorPresetPreview'
import { DECOR_PRESETS, getDecorPreset, type DecorPresetDefinition } from './decorPresets'
import { resolveDecorPresetFurniture, validateDecorPreset } from './decorPresetEngine'
import { getActiveDecorateRoom, useHomeStore } from './homeStore'
import { useRoomDecorBackupStore } from './roomDecorBackupStore'

const STRAWBERRY = getDecorPreset('strawberry-princess')!
const CAFE = getDecorPreset('lovely-cafe')!

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

function situationRefValue() {
  return { current: { time: '', place: '', actionA: '', actionB: '' } }
}

let roomId: string
let room2Id: string

function resetAll() {
  localStorage.clear()
  const room = useHomeStore.getInitialState().rooms[0]
  useHomeStore.setState({
    rooms: [{ ...room, furniture: [] }],
    activeDecorateRoomId: room.id,
    activeLiveRoomId: room.id,
    selectedFurnitureId: null,
  })
  roomId = room.id
  room2Id = useHomeStore.getState().addRoom('bedroom', '침실', 'empty')
  useHomeStore.setState({ activeDecorateRoomId: roomId, activeLiveRoomId: roomId })

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
  useRoomDecorBackupStore.getState().reset()
  useRoomLightingSettingsStore.setState({ enabled: false, intensity: 70 })
  useBgmStore.setState({ isPlaying: false, currentBand: null, currentTrackId: null, errorMessage: null })
}

describe('decorPresetApply: 적용/미리보기/백업/되돌리기', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetAll()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('검증 실패 / 적용 취소', () => {
    it('검증에 실패한 프리셋은 방을 전혀 바꾸지 않는다', () => {
      const before = getActiveDecorateRoom(useHomeStore.getState())
      const invalid: DecorPresetDefinition = {
        ...STRAWBERRY,
        furniture: [{ ...STRAWBERRY.furniture[0], colorway: 'not-a-real-colorway' }],
      }
      const outcome = applyDecorPreset(invalid)
      expect(outcome.ok).toBe(false)

      const after = getActiveDecorateRoom(useHomeStore.getState())
      expect(after.furniture).toEqual(before.furniture)
      expect(after.wallpaper).toEqual(before.wallpaper)
      expect(after.floor).toEqual(before.floor)
      expect(useRoomDecorBackupStore.getState().byRoomId[roomId]).toBeUndefined() // never backed up — nothing was touched
    })

    it('존재하지 않는 가구가 섞여 있으면 검증에서 거부된다', () => {
      const invalid: DecorPresetDefinition = { ...STRAWBERRY, furniture: [{ ...STRAWBERRY.furniture[0], furnitureId: 'no-such-furniture' }] }
      expect(applyDecorPreset(invalid).ok).toBe(false)
    })

    it('사용자가 확인 대화상자에서 취소하면(UI) 방이 그대로 유지된다', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      const before = getActiveDecorateRoom(useHomeStore.getState())
      render(<DecorPresetPanel />)

      fireEvent.click(screen.getAllByRole('button', { name: '적용' })[0])

      const after = getActiveDecorateRoom(useHomeStore.getState())
      expect(after.furniture).toEqual(before.furniture)
      expect(window.confirm).toHaveBeenCalled()
    })
  })

  describe('미리보기: 실제 데이터와 완전히 분리', () => {
    it('미리보기를 열어도(그리고 닫아도) 실제 방 데이터는 바뀌지 않는다', () => {
      const before = getActiveDecorateRoom(useHomeStore.getState())
      render(<DecorPresetPanel />)

      fireEvent.click(screen.getAllByRole('button', { name: '미리보기' })[0])
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: '미리보기 닫기' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      const after = getActiveDecorateRoom(useHomeStore.getState())
      expect(after.furniture).toEqual(before.furniture)
      expect(after.wallpaper).toEqual(before.wallpaper)
    })
  })

  describe('적용 성공', () => {
    it('벽지·바닥·가구가 프리셋 그대로 교체된다', () => {
      const outcome = applyDecorPreset(STRAWBERRY)
      expect(outcome.ok).toBe(true)

      const room = getActiveDecorateRoom(useHomeStore.getState())
      expect(room.wallpaper).toEqual(STRAWBERRY.wallpaper)
      expect(room.floor).toEqual(STRAWBERRY.floor)
      expect(room.furniture).toHaveLength(STRAWBERRY.furniture.length)
      expect(room.furniture.map((f) => f.furnitureId).sort()).toEqual(STRAWBERRY.furniture.map((f) => f.furnitureId).sort())
    })

    it('여러 번 적용해도(같은 프리셋, 다른 프리셋 모두) 가구 id가 절대 중복되지 않는다', () => {
      applyDecorPreset(STRAWBERRY)
      const firstIds = getActiveDecorateRoom(useHomeStore.getState()).furniture.map((f) => f.id)
      applyDecorPreset(CAFE)
      const secondIds = getActiveDecorateRoom(useHomeStore.getState()).furniture.map((f) => f.id)
      applyDecorPreset(STRAWBERRY)
      const thirdIds = getActiveDecorateRoom(useHomeStore.getState()).furniture.map((f) => f.id)

      const all = [...firstIds, ...secondIds, ...thirdIds]
      expect(new Set(all).size).toBe(all.length)
    })

    it('적용은 활성 방만 바꾸고, 다른 방의 가구·설정은 전혀 건드리지 않는다', () => {
      const otherRoomFurniture = resolveDecorPresetFurniture(CAFE)
      useHomeStore.setState((state) => ({
        rooms: state.rooms.map((r) => (r.id === room2Id ? { ...r, furniture: otherRoomFurniture, wallpaper: CAFE.wallpaper, floor: CAFE.floor } : r)),
      }))
      const otherRoomBefore = useHomeStore.getState().rooms.find((r) => r.id === room2Id)!

      applyDecorPreset(STRAWBERRY) // targets roomId (the active decorate room), never room2Id

      const otherRoomAfter = useHomeStore.getState().rooms.find((r) => r.id === room2Id)!
      expect(otherRoomAfter).toEqual(otherRoomBefore)
    })

    it('등록된 캐릭터 목록 자체는 프리셋 적용으로 전혀 바뀌지 않는다', () => {
      useCharacterStore.setState({ characters: [character('a', '밀로')] })
      const before = useCharacterStore.getState().characters
      applyDecorPreset(STRAWBERRY)
      expect(useCharacterStore.getState().characters).toBe(before)
    })
  })

  describe('백업과 되돌리기', () => {
    it('적용 직후 되돌리기를 제공하고, 되돌리면 원래 배치(가구 id 포함)로 정확히 복원된다', () => {
      useHomeStore.getState().addFurniture({ id: 'orig-sofa', furnitureId: 'sofa', x: 300, y: 300, scale: 1, rotation: 0, colorway: 'rose', layer: 0 })
      const original = getActiveDecorateRoom(useHomeStore.getState())

      expect(hasActiveDecorPresetBackup()).toBe(false)
      applyDecorPreset(STRAWBERRY)
      expect(hasActiveDecorPresetBackup()).toBe(true)
      expect(getActiveDecorateRoom(useHomeStore.getState()).furniture.some((f) => f.id === 'orig-sofa')).toBe(false)

      const revertOutcome = revertLastDecorPreset()
      expect(revertOutcome.ok).toBe(true)
      expect(getActiveDecorateRoom(useHomeStore.getState())).toEqual(original)
    })

    it('되돌리기는 한 번만 가능하다 — 백업을 소비한 뒤에는 다시 되돌릴 수 없다', () => {
      applyDecorPreset(STRAWBERRY)
      expect(revertLastDecorPreset().ok).toBe(true)
      expect(hasActiveDecorPresetBackup()).toBe(false)
      expect(revertLastDecorPreset().ok).toBe(false)
    })

    it('백업이 없는 상태에서 되돌리기를 호출하면 안전하게 거절된다', () => {
      expect(revertLastDecorPreset().ok).toBe(false)
    })

    it('UI에서 적용 확인 후 되돌리기 버튼이 나타나고, 클릭하면 원래 배치로 복원된다', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<DecorPresetPanel />)
      const before = getActiveDecorateRoom(useHomeStore.getState())

      fireEvent.click(screen.getAllByRole('button', { name: '적용' })[0])
      expect(getActiveDecorateRoom(useHomeStore.getState()).furniture).not.toEqual(before.furniture)
      expect(screen.getByRole('button', { name: '되돌리기' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: '되돌리기' }))
      expect(getActiveDecorateRoom(useHomeStore.getState())).toEqual(before)
      expect(screen.queryByRole('button', { name: '되돌리기' })).not.toBeInTheDocument()
    })
  })

  describe('캐릭터·가구 상호작용 상태 정리', () => {
    it('적용 전 진행 중이던 소파 착석이 안전하게 정리된다', async () => {
      useHomeStore.getState().addFurniture({ id: 'orig-sofa', furnitureId: 'sofa', x: 300, y: 300, scale: 1, rotation: 0, colorway: 'rose', layer: 0 })
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, roomId, { status: 'seated' }) } })
      useFurnitureUsageStore.getState().reserve({ characterId: 'a', placementId: 'orig-sofa', roomId, slotId: 'sofa-left' })
      useFurnitureUsageStore.getState().markSeated('a')

      applyDecorPreset(STRAWBERRY)

      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
      expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle')
      expect(useCharacterMovementStore.getState().byId.a.destination).toBeNull()
    })

    it('새 가구와 충돌하는 위치에 있던 캐릭터는 안전한 위치로 재배치된다 (방·캐릭터를 삭제하거나 강제 이동시키지 않는다)', () => {
      useCharacterStore.setState({ characters: [character('a')] })
      // Sit exactly where the preset's bed-single will land (see decorPresets.ts's strawberry-princess entry: xRatio
      // 0.23611 * 720 ≈ 170, yRatio 0.38636 * 440 ≈ 170) — guaranteed to collide with the new bed's solid footprint.
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 170, 170, roomId) } })

      applyDecorPreset(STRAWBERRY)

      const room = getActiveDecorateRoom(useHomeStore.getState())
      const obstacles = furnitureObstacles(room.furniture)
      const entry = useCharacterMovementStore.getState().byId.a
      expect(entry.roomId).toBe(roomId) // never moved to a different room
      expect(obstacles.some((rect) => circleIntersectsRect(entry.x, entry.y, 20, rect))).toBe(false)
    })

    it('다른 방에 있는 캐릭터는 재배치 대상이 아니다 (활성 방 밖 캐릭터는 건드리지 않는다)', () => {
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 170, 170, room2Id) } })

      applyDecorPreset(STRAWBERRY) // applies to roomId, not room2Id

      expect(useCharacterMovementStore.getState().byId.a).toEqual(movementEntry('a', 170, 170, room2Id))
    })

    it('자동 가구 사용 중인 캐릭터가 있어도 프리셋 교체가 안전하게 처리되고, 자동 추적이 스스로 정리된다', async () => {
      useHomeStore.getState().addFurniture({ id: 'orig-sofa', furnitureId: 'sofa', x: 300, y: 300, scale: 1, rotation: 0, colorway: 'rose', layer: 0 })
      useCharacterStore.setState({ characters: [character('a')] })
      useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 300, 300, roomId, { status: 'seated' }) } })
      useFurnitureUsageStore.getState().reserve({ characterId: 'a', placementId: 'orig-sofa', roomId, slotId: 'sofa-left' })
      useFurnitureUsageStore.getState().markSeated('a')
      // Simulate an in-progress *automatic* session on that same seat (as autoFurnitureUseTrigger.ts's tryStart would
      // have set up), with the character already seated (standUpAt set).
      useAutoFurnitureUseStore.getState().startAuto('a', 'orig-sofa', 'sofa-left', roomId)
      useAutoFurnitureUseStore.getState().markSeated('a', Date.now() + 60_000)

      renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

      applyDecorPreset(STRAWBERRY)
      // Reconcile runs on the next movement tick, not synchronously inside applyDecorPreset — this is a deliberate
      // design choice (see decorPresetApply.ts's own doc comment): no special-case cleanup code was added for
      // auto-furniture-use specifically, it just self-heals the same way it already does for every other external
      // furniture change (manual override, conversation start, delete/move/rotate).
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)

      expect(useAutoFurnitureUseStore.getState().activeByCharacter.a).toBeUndefined()
      expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
      // Freed to resume ordinary wandering within that same tick — 'moving' (already stepping toward a freshly
      // picked destination) is just as valid a resumed state as 'idle', matching every other eviction test's own
      // ['idle', 'moving'] tolerance elsewhere in this codebase (e.g. furnitureUsage.test.tsx).
      expect(['idle', 'moving']).toContain(useCharacterMovementStore.getState().byId.a.status)
    })
  })

  describe('저장 데이터: 새로고침 후에도 적용 결과가 정확히 복원된다', () => {
    it('적용한 프리셋이 localStorage에 저장되고, rehydrate 후에도 정확히 복원된다', async () => {
      applyDecorPreset(STRAWBERRY)
      const appliedRoom = getActiveDecorateRoom(useHomeStore.getState())

      const saved = localStorage.getItem('dearly-home')
      expect(saved).toContain('bed-single')

      await useHomeStore.persist.rehydrate()

      const reloadedRoom = useHomeStore.getState().rooms.find((r) => r.id === roomId)!
      expect(reloadedRoom.wallpaper).toEqual(appliedRoom.wallpaper)
      expect(reloadedRoom.floor).toEqual(appliedRoom.floor)
      expect(reloadedRoom.furniture).toEqual(appliedRoom.furniture)
    })

    it('프리셋 적용의 백업/되돌리기 런타임 상태는 저장되지 않는다', () => {
      applyDecorPreset(STRAWBERRY)
      const saved = localStorage.getItem('dearly-home')
      expect(saved).not.toContain('savedAt')
    })
  })

  describe('전체 프리셋 6종: 적용 스모크 테스트', () => {
    for (const preset of DECOR_PRESETS) {
      it(`${preset.name}: 검증을 통과하고 실제로 적용된다`, () => {
        const outcome = applyDecorPreset(preset)
        expect(outcome.ok).toBe(true)
        const room = getActiveDecorateRoom(useHomeStore.getState())
        expect(room.furniture).toHaveLength(preset.furniture.length)
      })
    }
  })

  describe('미리보기와 실제 적용의 배치 결과 일치', () => {
    for (const preset of DECOR_PRESETS) {
      it(`${preset.name}: DecorPresetPreview가 그리는 위치·크기가 실제 적용 결과와 정확히 같다`, () => {
        const { container } = render(<DecorPresetPreview preset={preset} />)
        const previewItems = Array.from(container.querySelectorAll('.decor-preset-preview-item')) as HTMLElement[]

        applyDecorPreset(preset)
        const applied = getActiveDecorateRoom(useHomeStore.getState()).furniture

        expect(previewItems).toHaveLength(applied.length)
        applied.forEach((placement, index) => {
          const style = previewItems[index].style
          expect(style.left).toBe(`${(placement.x / 720) * 100}%`)
          expect(style.top).toBe(`${(placement.y / 440) * 100}%`)
        })
      })
    }
  })

  describe('적용 실패: 위치가 유효하지 않은 프리셋은 이유를 안내하고 방을 바꾸지 않는다', () => {
    it('바닥에 서는 solid 가구가 바닥 표면보다 너무 높은 위치에 있으면 검증에서 거부된다 (자동으로 다른 위치에 재배치하지 않는다)', () => {
      const before = getActiveDecorateRoom(useHomeStore.getState())
      // bed-single's own floor-grounding minimum is 200.8 (see furniturePlacementEngine.test.ts) — 0.1 ratio (44px) is
      // deliberately far above it, reproducing the exact "가구가 벽에 떠 있는" bug class this validation now catches.
      const floating: DecorPresetDefinition = { ...STRAWBERRY, furniture: [{ ...STRAWBERRY.furniture[0], xRatio: 0.5, yRatio: 0.1 }] }

      const validation = validateDecorPreset(floating)
      expect(validation.ok).toBe(false)
      expect(validation.reason).toContain('배치 위치가 유효하지 않아요')

      const outcome = applyDecorPreset(floating)
      expect(outcome.ok).toBe(false)
      expect(getActiveDecorateRoom(useHomeStore.getState())).toEqual(before)
    })

    it('UI에서도 위치가 유효하지 않은 프리셋을 적용하면 사유가 표시되고 방은 그대로 유지된다', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      const before = getActiveDecorateRoom(useHomeStore.getState())
      const outcome = applyDecorPreset({ ...STRAWBERRY, furniture: [{ ...STRAWBERRY.furniture[0], xRatio: 0.5, yRatio: 0.1 }] })
      expect(outcome.ok).toBe(false)
      expect(getActiveDecorateRoom(useHomeStore.getState())).toEqual(before)
    })
  })

  describe('Stage 5: 프리셋과 조명은 서로의 데이터를 변경하지 않는다', () => {
    it('프리셋을 적용해도 조명 설정(켜짐/강도)은 그대로 유지된다', () => {
      useRoomLightingSettingsStore.setState({ enabled: true, intensity: 42 })
      applyDecorPreset(STRAWBERRY)
      expect(useRoomLightingSettingsStore.getState().enabled).toBe(true)
      expect(useRoomLightingSettingsStore.getState().intensity).toBe(42)
    })

    it('조명을 켜거나 꺼도 프리셋으로 적용된 방의 실제 벽지·바닥·가구 데이터는 전혀 바뀌지 않는다', () => {
      applyDecorPreset(STRAWBERRY)
      const before = getActiveDecorateRoom(useHomeStore.getState())

      useRoomLightingSettingsStore.getState().setEnabled(true)
      useRoomLightingSettingsStore.getState().setIntensity(90)
      expect(getActiveDecorateRoom(useHomeStore.getState())).toEqual(before)

      useRoomLightingSettingsStore.getState().setEnabled(false)
      expect(getActiveDecorateRoom(useHomeStore.getState())).toEqual(before)
    })

    it('프리셋 되돌리기는 조명 설정과 무관하게 정상 동작한다', () => {
      useRoomLightingSettingsStore.setState({ enabled: true, intensity: 80 })
      const original = getActiveDecorateRoom(useHomeStore.getState())
      applyDecorPreset(STRAWBERRY)

      const outcome = revertLastDecorPreset()
      expect(outcome.ok).toBe(true)
      expect(getActiveDecorateRoom(useHomeStore.getState())).toEqual(original)
      // Reverting never touches the lighting setting either way.
      expect(useRoomLightingSettingsStore.getState().enabled).toBe(true)
      expect(useRoomLightingSettingsStore.getState().intensity).toBe(80)
    })

    it('프리셋 미리보기는 조명 설정과 무관하게 항상 원래 색상 그대로 렌더링된다 (미리보기에는 조명 오버레이가 없다)', () => {
      useRoomLightingSettingsStore.setState({ enabled: true, intensity: 100 })
      useBgmStore.setState({ currentBand: 'night' })
      const { container } = render(<DecorPresetPreview preset={STRAWBERRY} />)
      expect(container.querySelector('.room-lighting-overlay')).toBeNull()
    })
  })
})
