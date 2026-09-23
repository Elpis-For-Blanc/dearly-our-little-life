import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, renderHook, screen } from '@testing-library/react'
import { useCharacterStore } from '../character/characterStore'
import { EMPTY_AI_PROFILE, type Character } from '../character/types'
import { useDialogueFrequencyStore } from '../dialogue/dialogueFrequencyStore'
import { useDialogueStore } from '../dialogue/dialogueStore'
import { useMonologueFrequencyStore } from '../dialogue/monologueFrequencyStore'
import { useMonologueStore } from '../dialogue/monologueStore'
import { getSitSlots, getStandSlots, isInteractableFurniture, isSittableFurniture } from '../simulation/furnitureInteractionEngine'
import { useCharacterMovementStore, type CharacterMovementState } from '../simulation/characterMovementStore'
import { useFurnitureUsageStore } from '../simulation/furnitureUsageStore'
import { standUp, startSitting } from '../simulation/furnitureUsageTrigger'
import { furnitureObstacles } from '../simulation/movementEngine'
import { MOVEMENT_TICK_MS } from '../simulation/movementConfig'
import { useSimulationStore } from '../simulation/simulationStore'
import { useCharacterMovementSimulation } from '../simulation/useCharacterMovementSimulation'
import { getColorwayOptions, getDefaultColorway } from './colorways'
import { FurnitureCatalog } from './FurnitureCatalogPanel'
import { FURNITURE_CATALOG, getFurnitureDefinition, isValidVariant } from './furnitureCatalog'
import { classifyInteractionType } from './furnitureInteractionType'
import { useHomeStore } from './homeStore'
import { FurnitureIcon } from './illustrations'
import type { FurniturePlacement } from './types'

const SEAT_IDS = ['bedroom-bench', 'dining-bench', 'ottoman'] as const
const TABLE_NO_SLOT_IDS = ['computer-desk', 'coffee-table', 'side-table', 'desk'] as const
const STORAGE_IDS = ['low-cabinet', 'console', 'dresser', 'wardrobe', 'bookshelf'] as const
const DECOR_WALL_IDS = ['wall-mirror', 'display-shelf', 'pendant-light'] as const
const NEW_PHASE2_IDS = [
  'bedroom-bench',
  'dining-bench',
  'ottoman',
  'computer-desk',
  'low-cabinet',
  'console',
  'pendant-light',
  'wall-mirror',
  'display-shelf',
  'dining-table-large',
] as const

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

describe('interactionType 분류: seat/table/storage/decor/lighting가 실제 데이터와 일치한다', () => {
  it('전체 카탈로그가 예외 없이 분류되고, 알 수 없는 값을 반환하지 않는다', () => {
    for (const definition of FURNITURE_CATALOG) {
      const label = classifyInteractionType(definition)
      expect(['seat', 'lie', 'table', 'storage', 'lighting', 'decor'], definition.id).toContain(label)
    }
  })

  it('seat로 분류된 가구는 실제로 앉을 수 있는 슬롯을 가진다 (좌석 후보 오분류 없음)', () => {
    for (const definition of FURNITURE_CATALOG) {
      if (classifyInteractionType(definition) === 'seat') {
        expect(getSitSlots(definition).length, definition.id).toBeGreaterThan(0)
      }
    }
  })

  it('신규 seat 가구(벤치·오토만)는 seat로, table/storage/decor 가구는 seat로 절대 분류되지 않는다', () => {
    for (const id of SEAT_IDS) expect(classifyInteractionType(getFurnitureDefinition(id)!), id).toBe('seat')
    for (const id of [...TABLE_NO_SLOT_IDS, ...STORAGE_IDS, ...DECOR_WALL_IDS]) {
      expect(classifyInteractionType(getFurnitureDefinition(id)!), id).not.toBe('seat')
    }
  })

  it('테이블류(슬롯 없는 desk 계열 포함)는 table로 분류된다', () => {
    for (const id of TABLE_NO_SLOT_IDS) expect(classifyInteractionType(getFurnitureDefinition(id)!), id).toBe('table')
    expect(classifyInteractionType(getFurnitureDefinition('dining-table-large')!)).toBe('table') // has real stand slots
  })

  it('수납 가구는 storage로 분류된다', () => {
    for (const id of STORAGE_IDS) expect(classifyInteractionType(getFurnitureDefinition(id)!), id).toBe('storage')
  })

  it('조명(lightSource) 가구는 lighting으로 분류된다', () => {
    expect(classifyInteractionType(getFurnitureDefinition('pendant-light')!)).toBe('lighting')
    expect(classifyInteractionType(getFurnitureDefinition('candle')!)).toBe('lighting')
    expect(classifyInteractionType(getFurnitureDefinition('floor-lamp')!)).toBe('lighting')
  })

  it('non-seat 가구(수납·장식·조명·테이블)는 isSittableFurniture에서도 일관되게 false다 — 자동/수동 착석 후보가 될 수 없다', () => {
    for (const id of [...TABLE_NO_SLOT_IDS, ...STORAGE_IDS, ...DECOR_WALL_IDS, 'pendant-light', 'candle']) {
      expect(isSittableFurniture(id), id).toBe(false)
      expect(isInteractableFurniture(id), id).toBe(false)
    }
  })
})

describe('신규 가구(2차 확장) 카탈로그 데이터', () => {
  it('10개 신규 id가 카탈로그에 정확히 한 번씩 존재한다', () => {
    for (const id of NEW_PHASE2_IDS) expect(FURNITURE_CATALOG.filter((f) => f.id === id), id).toHaveLength(1)
  })

  it('벤치/오토만은 sit 슬롯을 가지며, dining-bench는 소파처럼 독립된 두 좌석을 가진다', () => {
    const bench = getFurnitureDefinition('bedroom-bench')!
    expect(getSitSlots(bench)).toHaveLength(1)
    const diningBench = getFurnitureDefinition('dining-bench')!
    const seats = getSitSlots(diningBench)
    expect(seats.map((s) => s.id)).toEqual(['bench-left', 'bench-right'])
    expect(seats[0].offsetX).toBe(-seats[1].offsetX)
    const ottoman = getFurnitureDefinition('ottoman')!
    expect(getSitSlots(ottoman)).toHaveLength(1)
  })

  it('dining-table-large는 dining-table과 독립적인, 자기 자신의 width로부터 유도된 stand 슬롯을 가진다', () => {
    const large = getFurnitureDefinition('dining-table-large')!
    const small = getFurnitureDefinition('dining-table')!
    const largeSlots = getStandSlots(large)
    const smallSlots = getStandSlots(small)
    expect(largeSlots.map((s) => s.id)).toEqual(['table-left', 'table-right'])
    // offset = width/2 + 26 (tableSideSlots's own formula) — must differ since the two tables have different widths.
    expect(Math.abs(largeSlots[0].offsetX)).toBe(large.width / 2 + 26)
    expect(Math.abs(largeSlots[0].offsetX)).toBeGreaterThan(Math.abs(smallSlots[0].offsetX))
  })

  it('펜던트/벽거울/장식 선반은 wall 영역이고 상호작용 슬롯이 없다', () => {
    for (const id of DECOR_WALL_IDS) {
      const def = getFurnitureDefinition(id)!
      expect(def.zone, id).toBe('wall')
      expect(def.interactionSlots, id).toEqual([])
    }
  })

  it('낮은 수납장/콘솔/컴퓨터 책상은 실제 색상 옵션을 가지며 상호작용 슬롯이 없다', () => {
    for (const id of ['low-cabinet', 'console', 'computer-desk']) {
      expect(getColorwayOptions(id).length, id).toBeGreaterThan(0)
      expect(getFurnitureDefinition(id)!.interactionSlots, id).toEqual([])
    }
  })

  it('모든 신규 가구가 실제 캔버스 안에서 유효한 크기·스케일 범위를 가진다', () => {
    for (const id of NEW_PHASE2_IDS) {
      const def = getFurnitureDefinition(id)!
      expect(def.width, id).toBeGreaterThan(0)
      expect(def.height, id).toBeGreaterThan(0)
      expect(def.minScale, id).toBeLessThan(def.maxScale)
    }
  })
})

describe('variant 시스템: catalog 데이터만으로 새 형태를 만든다 (기존 상호작용 가구는 안전하게 제외)', () => {
  it('서랍장은 2단/3단 variant를 가지며, 기본값은 기존(3단) 크기와 정확히 같다', () => {
    const def = getFurnitureDefinition('dresser')!
    expect(def.variants?.map((v) => v.id)).toEqual(['three-drawer', 'two-drawer'])
    expect(def.variants![0].width).toBe(def.width)
    expect(def.variants![0].height).toBe(def.height)
    expect(isValidVariant(def, 'two-drawer')).toBe(true)
    expect(isValidVariant(def, 'not-a-real-variant')).toBe(false)
  })

  it('서랍장 variant는 실제로 다른 서랍 개수를 그린다 (단순 리사이즈가 아니라 진짜 다른 그림)', () => {
    const def = getFurnitureDefinition('dresser')!
    const threeDrawer = render(<FurnitureIcon furnitureId="dresser" width={def.width} height={def.height} colorway={getDefaultColorway('dresser')} variant="three-drawer" />)
    const threeKnobs = threeDrawer.container.querySelectorAll('circle').length
    cleanup()
    const twoDrawer = render(<FurnitureIcon furnitureId="dresser" width={def.width} height={88} colorway={getDefaultColorway('dresser')} variant="two-drawer" />)
    const twoKnobs = twoDrawer.container.querySelectorAll('circle').length
    cleanup()
    expect(threeKnobs).toBe(6) // 3 rows × 2 knobs
    expect(twoKnobs).toBe(4) // 2 rows × 2 knobs
  })

  it('화분은 보통/큰 화분 variant를 가지며, 큰 화분은 실제로 더 큰 footprint를 만든다', () => {
    const def = getFurnitureDefinition('plant')!
    expect(def.variants?.map((v) => v.id)).toEqual(['medium', 'large'])
    const large = def.variants!.find((v) => v.id === 'large')!
    expect(large.width).toBeGreaterThan(def.width)
    expect(large.height).toBeGreaterThan(def.height)
  })

  it('interactionSlots가 있는 가구(dining-table-large 등)에는 크기를 바꾸는 variants를 절대 추가하지 않는다 — 슬롯 오프셋이 base width에 고정되어 있어 안전하지 않다', () => {
    for (const id of ['table', 'dining-table', 'dining-table-large', 'round-table', 'canopy-bed', 'bed', 'bed-single', 'bed-double']) {
      const def = getFurnitureDefinition(id)!
      if (def.interactionSlots.length > 0) expect(def.variants, id).toBeUndefined()
    }
  })
})

describe('가구 카탈로그 UI: 수납 카테고리', () => {
  beforeEach(() => {
    localStorage.clear()
    const roomId = useHomeStore.getState().activeDecorateRoomId
    useHomeStore.setState((state) => ({ rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, furniture: [] } : r)) }))
  })
  afterEach(() => cleanup())

  it('수납 카테고리 섹션이 렌더링되고 낮은 수납장·콘솔을 포함한다', () => {
    render(<FurnitureCatalog />)
    // "수납" also appears once per storage-category card as its own type label — this checks the section heading specifically.
    expect(screen.getByRole('heading', { name: '수납' })).toBeInTheDocument()
    expect(screen.getByText('낮은 수납장')).toBeInTheDocument()
    expect(screen.getByText('콘솔')).toBeInTheDocument()
  })
})

describe('신규 가구 렌더링: 예외 없이 그려지고 회전에도 안전하다', () => {
  afterEach(() => cleanup())

  it('10개 모두 예외 없이 렌더링된다', () => {
    for (const id of NEW_PHASE2_IDS) {
      const def = getFurnitureDefinition(id)!
      const { unmount } = render(<FurnitureIcon furnitureId={id} width={def.width} height={def.height} colorway={getDefaultColorway(id)} />)
      unmount()
    }
  })

  it('좌우 반전 상태에서도 빈 SVG 없이 렌더링된다', () => {
    for (const id of NEW_PHASE2_IDS) {
      const def = getFurnitureDefinition(id)!
      const { container, unmount } = render(
        <div style={{ transform: 'scaleX(-1)' }}>
          <FurnitureIcon furnitureId={id} width={def.width} height={def.height} colorway={getDefaultColorway(id)} />
        </div>,
      )
      expect(container.querySelector('svg')!.children.length).toBeGreaterThan(0)
      unmount()
    }
  })
})

describe('큰 가구(6인용 식탁·캐노피 침대)의 충돌 영역', () => {
  it('실제 방 크기 안에서 서로 겹치지 않게 배치할 수 있고, collision rect가 유효하다', () => {
    const placements: FurniturePlacement[] = [
      { id: 'p1', furnitureId: 'dining-table-large', x: 200, y: 300, scale: 1, rotation: 0, colorway: getDefaultColorway('dining-table-large'), layer: 0 },
      { id: 'p2', furnitureId: 'canopy-bed', x: 550, y: 320, scale: 1, rotation: 0, colorway: getDefaultColorway('canopy-bed'), layer: 1 },
    ]
    const obstacles = furnitureObstacles(placements)
    expect(obstacles).toHaveLength(2)
    const [a, b] = obstacles
    const overlapsX = a.minX < b.maxX && a.maxX > b.minX
    const overlapsY = a.minY < b.maxY && a.maxY > b.minY
    expect(overlapsX && overlapsY).toBe(false)
    for (const rect of obstacles) {
      expect(rect.minX).toBeLessThan(rect.maxX)
      expect(rect.minY).toBeLessThan(rect.maxY)
      expect(rect.minX).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('신규 seat 가구: 기존 착석/일어나기 엔진 그대로 재사용', () => {
  let roomId: string
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    const room = useHomeStore.getInitialState().rooms[0]
    useHomeStore.setState({
      rooms: [
        {
          ...room,
          furniture: [{ id: 'bench-1', furnitureId: 'bedroom-bench', x: 300, y: 330, scale: 1, rotation: 0, colorway: getDefaultColorway('bedroom-bench'), layer: 0 }],
        },
      ],
      activeDecorateRoomId: room.id,
      activeLiveRoomId: room.id,
      selectedFurnitureId: null,
    })
    roomId = room.id
    useCharacterStore.setState({ characters: [] })
    useCharacterMovementStore.setState({ byId: {} })
    useFurnitureUsageStore.getState().reset()
    useSimulationStore.setState({ isRunning: true, tick: 0 })
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

  it('벤치: 기존 startSitting/standUp 함수 그대로 걸어가 앉고, 다시 일어난다', async () => {
    useCharacterStore.setState({ characters: [character('a')] })
    useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 120, 150, roomId) } })
    renderHook(() => useCharacterMovementSimulation({ time: '', place: '', actionA: '', actionB: '' }))

    expect(startSitting('a', 'bench-1')).toBe('started')
    expect(await advanceUntil(() => useCharacterMovementStore.getState().byId.a.status === 'seated', 80)).toBe(true)
    expect(useFurnitureUsageStore.getState().byCharacterId.a).toBe('bench-1:seat')

    standUp('a')
    expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle')
    expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
  })
})
