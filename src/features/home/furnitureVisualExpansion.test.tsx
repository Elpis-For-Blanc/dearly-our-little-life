import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, renderHook, screen } from '@testing-library/react'
import { useCharacterStore } from '../character/characterStore'
import { EMPTY_AI_PROFILE, type Character } from '../character/types'
import { useDialogueFrequencyStore } from '../dialogue/dialogueFrequencyStore'
import { useDialogueStore } from '../dialogue/dialogueStore'
import { useMonologueFrequencyStore } from '../dialogue/monologueFrequencyStore'
import { useMonologueStore } from '../dialogue/monologueStore'
import { isInteractableFurniture, getSitSlots, getStandSlots, getUsableLieSlots } from '../simulation/furnitureInteractionEngine'
import { useCharacterMovementStore, type CharacterMovementState } from '../simulation/characterMovementStore'
import { useFurnitureUsageStore } from '../simulation/furnitureUsageStore'
import { standUp, startLingering, startLyingDown } from '../simulation/furnitureUsageTrigger'
import { furnitureObstacles } from '../simulation/movementEngine'
import { MOVEMENT_TICK_MS } from '../simulation/movementConfig'
import { useSimulationStore } from '../simulation/simulationStore'
import { useCharacterMovementSimulation } from '../simulation/useCharacterMovementSimulation'
import { getColorwayOptions, getDefaultColorway } from './colorways'
import { FurnitureCatalog } from './FurnitureCatalogPanel'
import { getFurnitureDefinition, FURNITURE_CATALOG } from './furnitureCatalog'
import { getActiveDecorateRoom, useHomeStore } from './homeStore'
import { FurnitureIcon } from './illustrations'
import type { FurniturePlacement } from './types'

const NEW_PIECE_IDS = ['dresser', 'candle', 'canopy-bed', 'round-table'] as const
const NEW_PIECE_LABELS: Record<(typeof NEW_PIECE_IDS)[number], string> = {
  dresser: '서랍장',
  candle: '캔들',
  'canopy-bed': '캐노피 침대',
  'round-table': '원형 테이블',
}

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

describe('신규 가구 카탈로그: 데이터 유효성', () => {
  it('전체 카탈로그에 4종이 정확히 한 번씩 존재한다', () => {
    for (const id of NEW_PIECE_IDS) {
      expect(FURNITURE_CATALOG.filter((f) => f.id === id)).toHaveLength(1)
    }
  })

  it('dresser/candle은 장식 전용이다 (상호작용 슬롯 없음)', () => {
    expect(getFurnitureDefinition('dresser')?.interactionSlots).toEqual([])
    expect(getFurnitureDefinition('candle')?.interactionSlots).toEqual([])
    expect(isInteractableFurniture('dresser')).toBe(false)
    expect(isInteractableFurniture('candle')).toBe(false)
  })

  it('candle은 lightSource로 표시되고, 조명이 아닌 기존 가구는 이 필드가 없다 (기존 데이터 무변경)', () => {
    expect(getFurnitureDefinition('candle')?.lightSource).toBe(true)
    // floor-lamp/table-lamp also carry lightSource as of the furniture-variety-expansion phase 2's interactionType
    // classifier (furnitureInteractionType.ts) — they were always real light fixtures with their own drawn glow, so
    // the metadata was extended to match rather than left inconsistent; see that phase's own test coverage.
    for (const id of ['sofa', 'table', 'bed', 'plant', 'rug', 'window', 'dresser', 'canopy-bed', 'round-table']) {
      expect(getFurnitureDefinition(id)?.lightSource, id).toBeUndefined()
    }
  })

  it('canopy-bed는 기존 침대와 동일한 lie 상호작용 구조(getUsableLieSlots)를 그대로 재사용한다', () => {
    const def = getFurnitureDefinition('canopy-bed')!
    expect(def.zone).toBe('floor')
    expect(def.collision.mode).toBe('solid')
    const lieSlots = getUsableLieSlots(def)
    expect(lieSlots).toHaveLength(1)
    expect(lieSlots[0].kind).toBe('lie')
    expect(lieSlots[0].offsetX).toBe(0)
    expect(isInteractableFurniture('canopy-bed')).toBe(true)
  })

  it('round-table은 기존 테이블과 동일한 stand 슬롯 구조(tableSideSlots)를 그대로 재사용한다', () => {
    const def = getFurnitureDefinition('round-table')!
    const standSlots = getStandSlots(def)
    expect(standSlots.map((s) => s.id)).toEqual(['table-left', 'table-right'])
    expect(standSlots[0].offsetX).toBeLessThan(0)
    expect(standSlots[1].offsetX).toBeGreaterThan(0)
    expect(standSlots[0].offsetX).toBe(-standSlots[1].offsetX) // symmetric, same formula as the original table/dining-table
    expect(getSitSlots(def)).toEqual([])
    expect(isInteractableFurniture('round-table')).toBe(true)
  })

  it('4종 모두 실제 색상 옵션과 색상 파트를 가진다 (프리셋·속성 패널에서 바로 쓸 수 있다)', () => {
    for (const id of NEW_PIECE_IDS) {
      expect(getColorwayOptions(id).length, id).toBeGreaterThan(0)
      expect(getFurnitureDefinition(id)!.colorParts.length, id).toBeGreaterThan(0)
    }
  })

  it('신규 가구의 모든 solid 충돌 영역이 실제 방 크기 안에서 유효한 사각형을 만든다', () => {
    const placements: FurniturePlacement[] = NEW_PIECE_IDS.map((id, i) => ({
      id: `new-${id}`,
      furnitureId: id,
      x: 200 + i * 120,
      y: 320,
      scale: 1,
      rotation: 0,
      colorway: getDefaultColorway(id),
      layer: i,
    }))
    const obstacles = furnitureObstacles(placements)
    // dresser, canopy-bed, round-table are solid; candle is collision:none.
    expect(obstacles.length).toBe(3)
    for (const rect of obstacles) {
      expect(rect.minX).toBeLessThan(rect.maxX)
      expect(rect.minY).toBeLessThan(rect.maxY)
    }
  })
})

describe('신규 가구 일러스트: 렌더링', () => {
  afterEach(() => cleanup())

  it('4종 모두 예외 없이 렌더링되고, 올바른 접근성 라벨을 가진다', () => {
    for (const id of NEW_PIECE_IDS) {
      const def = getFurnitureDefinition(id)!
      const { unmount } = render(<FurnitureIcon furnitureId={id} width={def.width} height={def.height} colorway={getDefaultColorway(id)} />)
      expect(screen.getByRole('img', { name: NEW_PIECE_LABELS[id] })).toBeInTheDocument()
      unmount()
    }
  })

  it('좌우 반전(180도 mirror) 컨테이너 안에서도 빈 SVG 없이 정상 렌더링된다', () => {
    for (const id of NEW_PIECE_IDS) {
      const def = getFurnitureDefinition(id)!
      const { container, unmount } = render(
        <div style={{ transform: 'scaleX(-1)' }}>
          <FurnitureIcon furnitureId={id} width={def.width} height={def.height} colorway={getDefaultColorway(id)} />
        </div>,
      )
      const svg = container.querySelector('svg')
      expect(svg).not.toBeNull()
      expect(svg!.children.length).toBeGreaterThan(0)
      unmount()
    }
  })

  it('캐릭터 등록 화면 미리보기 크기(작은 크기)에서도 정상 렌더링된다', () => {
    for (const id of NEW_PIECE_IDS) {
      const def = getFurnitureDefinition(id)!
      const { unmount } = render(<FurnitureIcon furnitureId={id} width={def.width * 0.3} height={def.height * 0.3} colorway={getDefaultColorway(id)} />)
      expect(screen.getByRole('img', { name: NEW_PIECE_LABELS[id] })).toBeInTheDocument()
      unmount()
    }
  })
})

describe('가구 카탈로그 UI: 상호작용 가능 배지', () => {
  beforeEach(() => {
    localStorage.clear()
    const roomId = useHomeStore.getState().activeDecorateRoomId
    useHomeStore.setState((state) => ({ rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, furniture: [] } : r)) }))
  })
  afterEach(() => cleanup())

  it('상호작용 가능한 가구(소파 등)에만 "사용 가능" 배지가 표시된다', () => {
    render(<FurnitureCatalog />)
    const sofaCard = screen.getByText('소파').closest('.furniture-card')!
    const plantCard = screen.getByText('화분').closest('.furniture-card')!
    expect(sofaCard.querySelector('.furniture-card-badge')).not.toBeNull()
    expect(plantCard.querySelector('.furniture-card-badge')).toBeNull()
  })

  it('신규 상호작용 가구(캐노피 침대·원형 테이블)에도 배지가 표시되고, 장식 전용 신규 가구(서랍장·캔들)에는 표시되지 않는다', () => {
    render(<FurnitureCatalog />)
    expect(screen.getByText('캐노피 침대').closest('.furniture-card')!.querySelector('.furniture-card-badge')).not.toBeNull()
    expect(screen.getByText('원형 테이블').closest('.furniture-card')!.querySelector('.furniture-card-badge')).not.toBeNull()
    expect(screen.getByText('서랍장').closest('.furniture-card')!.querySelector('.furniture-card-badge')).toBeNull()
    expect(screen.getByText('캔들').closest('.furniture-card')!.querySelector('.furniture-card-badge')).toBeNull()
  })
})

describe('신규 장식 가구: 배치·회전·저장·복원 (기존 가구와 동일한 파이프라인)', () => {
  beforeEach(() => {
    localStorage.clear()
    const room = useHomeStore.getInitialState().rooms[0]
    useHomeStore.setState({ rooms: [{ ...room, furniture: [] }], activeDecorateRoomId: room.id, activeLiveRoomId: room.id, selectedFurnitureId: null })
  })

  it('서랍장·캔들을 배치하고 회전한 뒤, 새로고침(rehydrate) 후에도 정확히 복원된다', async () => {
    useHomeStore.getState().addFurniture({ id: 'dresser-1', furnitureId: 'dresser', x: 300, y: 330, scale: 1, rotation: 0, colorway: getDefaultColorway('dresser'), layer: 0 })
    useHomeStore.getState().addFurniture({ id: 'candle-1', furnitureId: 'candle', x: 400, y: 340, scale: 1.2, rotation: 0, colorway: getDefaultColorway('candle'), layer: 1 })
    useHomeStore.getState().updateFurniture('dresser-1', { rotation: 180 })

    const before = getActiveDecorateRoom(useHomeStore.getState()).furniture
    expect(before.find((f) => f.id === 'dresser-1')?.rotation).toBe(180)
    expect(before.find((f) => f.id === 'candle-1')?.scale).toBe(1.2)

    await useHomeStore.persist.rehydrate()
    const after = getActiveDecorateRoom(useHomeStore.getState()).furniture
    expect(after).toEqual(before)
  })
})

describe('신규 상호작용 가구: 기존 가구 사용 엔진을 그대로 재사용하는 실제 흐름', () => {
  let roomId: string
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    const room = useHomeStore.getInitialState().rooms[0]
    useHomeStore.setState({
      rooms: [{ ...room, furniture: [{ id: 'bed-1', furnitureId: 'canopy-bed', x: 200, y: 320, scale: 1, rotation: 0, colorway: getDefaultColorway('canopy-bed'), layer: 0 }] }],
      activeDecorateRoomId: room.id,
      activeLiveRoomId: room.id,
      selectedFurnitureId: null,
    })
    roomId = room.id
    useCharacterStore.setState({ characters: [] })
    useCharacterMovementStore.setState({ byId: {} })
    useFurnitureUsageStore.getState().reset()
    useSimulationStore.setState({ isRunning: true, tick: 0 })
    // Both interaction tests below start two characters close together — without this, an unrelated real
    // auto-dialogue encounter (or monologue) can randomly fire and block movement via 'talking', occasionally
    // starving the walk-to-furniture assertions of enough ticks. Every other furniture-usage test file in this
    // project already isolates this the same way.
    useDialogueStore.setState({ entries: [], activeConversations: {}, lastConversationEndAtByPair: {}, recentAutoLineIdsByCharacter: {}, recentDefaultBundleIdsByPair: {}, activeBubbleByCharacter: {} })
    useDialogueFrequencyStore.setState({ mode: 'quiet' })
    useMonologueFrequencyStore.setState({ mode: 'off' })
    useMonologueStore.getState().reset()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  async function advanceUntil(predicate: () => boolean, maxTicks: number): Promise<boolean> {
    for (let i = 0; i < maxTicks; i++) {
      if (predicate()) return true
      await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
    }
    return predicate()
  }

  it('캐노피 침대: 기존 startLyingDown/standUp 함수 그대로 걸어가 눕고, 다시 일어난다', async () => {
    useCharacterStore.setState({ characters: [character('a')] })
    useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 120, 150, roomId) } })
    renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

    expect(startLyingDown('a', 'bed-1')).toBe('started')
    expect(await advanceUntil(() => useCharacterMovementStore.getState().byId.a.status === 'lying', 80)).toBe(true)
    expect(useFurnitureUsageStore.getState().byCharacterId.a).toBe('bed-1:lie')

    standUp('a')
    expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle')
    expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
  })

  it('원형 테이블: 기존 startLingering 함수 그대로 양옆에 두 캐릭터가 동시에 머무를 수 있다', async () => {
    useHomeStore.setState((state) => ({
      rooms: state.rooms.map((r) => ({ ...r, furniture: [{ id: 'table-1', furnitureId: 'round-table', x: 400, y: 320, scale: 1, rotation: 0, colorway: getDefaultColorway('round-table'), layer: 0 }] })),
    }))
    useCharacterStore.setState({ characters: [character('a'), character('b')] })
    useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 120, 150, roomId), b: movementEntry('b', 140, 150, roomId) } })
    renderHook(() => useCharacterMovementSimulation(situationRefValue().current))

    expect(startLingering('a', 'table-1', 'table-left')).toBe('started')
    expect(startLingering('b', 'table-1', 'table-right')).toBe('started')
    expect(
      await advanceUntil(() => useCharacterMovementStore.getState().byId.a.status === 'lingering' && useCharacterMovementStore.getState().byId.b.status === 'lingering', 80),
    ).toBe(true)

    standUp('a')
    expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle')
    expect(useCharacterMovementStore.getState().byId.b.status).toBe('lingering') // untouched, independent slot
  })
})
