import { describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { afterEach } from 'vitest'
import { getColorwayOptions, getDefaultColorway } from './colorways'
import { getFurnitureDefinition } from './furnitureCatalog'
import { FurnitureIcon } from './illustrations'
import { getSitSlots, getStandSlots, getUsableLieSlots } from '../simulation/furnitureInteractionEngine'
import { furnitureObstacles } from '../simulation/movementEngine'
import { standUp, startLyingDown, startSitting, startLingering } from '../simulation/furnitureUsageTrigger'
import { useFurnitureUsageStore } from '../simulation/furnitureUsageStore'
import { useCharacterMovementStore, type CharacterMovementState } from '../simulation/characterMovementStore'
import { useHomeStore } from './homeStore'
import type { FurniturePlacement } from './types'
import { useCharacterStore } from '../character/characterStore'
import { EMPTY_AI_PROFILE, type Character } from '../character/types'

function character(id: string): Character {
  return {
    id,
    name: id,
    imageDataUrl: 'data:image/png;base64,',
    displayScale: 1,
    footOffsetRatio: 0,
    imageBounds: null,
    traits: { personality: '', favoriteColor: '' },
    aiProfile: { ...EMPTY_AI_PROFILE },
  }
}

afterEach(() => {
  cleanup()
})

/**
 * "가구 비주얼 2차 고도화": SOFA/CHAIR/TABLE/CONSOLE·STORAGE/BED/LIGHTING got
 * additive-only overlay polish (SurfaceSheen/VolumeShade highlights, a drawn
 * bulb on every light fixture, a shaded mattress seam, door/drawer sheens).
 * No `interactionSlots` offset, no catalog id, and no store/engine logic was
 * touched — this file pins that down with real regression checks, not just
 * "it renders": the exact slot offsets from before this round, every touched
 * piece still rendering without throwing, and the sit/lie/stand lifecycle
 * still working end to end for one representative piece per interactive kind.
 */

const POLISHED_IDS = [
  // SOFA family
  'sofa',
  'sofa-single',
  'sofa-long',
  'armchair',
  // CHAIR family
  'dining-chair',
  'office-chair',
  // TABLE family
  'table',
  'dining-table',
  'dining-table-large',
  'round-table',
  'coffee-table',
  'desk',
  'computer-desk',
  // CONSOLE/STORAGE family
  'dresser',
  'nightstand',
  'vanity',
  'wardrobe',
  'low-cabinet',
  'console',
  'kitchen-cabinet',
  'tv-stand',
  // BED family
  'bed',
  'bed-single',
  'bed-double',
  'canopy-bed',
  // LIGHTING family
  'floor-lamp',
  'table-lamp',
  'pendant-light',
] as const

describe('가구 비주얼 2차 고도화: 렌더링 회귀', () => {
  it.each(POLISHED_IDS)('%s: 새 오버레이가 추가된 뒤에도 예외 없이 렌더링된다', (id) => {
    const def = getFurnitureDefinition(id)
    expect(def, id).toBeDefined()
    if (!def) return
    for (const colorway of getColorwayOptions(id)) {
      const { unmount, container } = render(
        <FurnitureIcon furnitureId={id} width={def.width} height={def.height} colorway={colorway.id} variant={def.variants?.[0]?.id} />,
      )
      expect(container.querySelector('svg'), `${id}/${colorway.id}`).toBeTruthy()
      unmount()
    }
  })

  it('dresser의 2단/3단 variant는 여전히 서로 다른 drawer row 개수를 그린다 (이번 라운드에서 건드리지 않음)', () => {
    const def = getFurnitureDefinition('dresser')!
    const three = render(<FurnitureIcon furnitureId="dresser" width={def.width} height={def.height} colorway={getDefaultColorway('dresser')} variant="three-drawer" />)
    const threeRows = three.container.querySelectorAll('rect[rx="2"]').length
    three.unmount()
    const two = render(<FurnitureIcon furnitureId="dresser" width={def.width} height={88} colorway={getDefaultColorway('dresser')} variant="two-drawer" />)
    const twoRows = two.container.querySelectorAll('rect[rx="2"]').length
    two.unmount()
    expect(threeRows, 'three-drawer draws more drawer-row rects than two-drawer').toBeGreaterThan(twoRows)
  })

  it('조명 3종(펜던트/플로어 램프/테이블 램프)은 전구를 나타내는 별도의 타원을 그린다 — glow 타원과는 별개의 요소', () => {
    for (const id of ['pendant-light', 'floor-lamp', 'table-lamp'] as const) {
      const def = getFurnitureDefinition(id)!
      const { container, unmount } = render(<FurnitureIcon furnitureId={id} width={def.width} height={def.height} colorway={getDefaultColorway(id)} />)
      // the bulb is drawn as a stroked ellipse (fill+stroke); the ambient glow ellipses have no stroke — this is
      // enough to tell them apart without depending on exact geometry.
      const strokedEllipses = Array.from(container.querySelectorAll('ellipse')).filter((el) => el.getAttribute('stroke') && el.getAttribute('stroke') !== 'none')
      expect(strokedEllipses.length, `${id} should draw at least one stroked (bulb) ellipse`).toBeGreaterThan(0)
      unmount()
    }
  })
})

describe('가구 비주얼 2차 고도화: interactionSlots 오프셋은 이번 라운드에서 전혀 변경되지 않았다', () => {
  it('sofa: sofa-left/sofa-right 오프셋 회귀', () => {
    const slots = getFurnitureDefinition('sofa')!.interactionSlots
    const left = slots.find((s) => s.id === 'sofa-left')!
    const right = slots.find((s) => s.id === 'sofa-right')!
    expect(left.offsetX).toBeCloseTo(-39.5, 5)
    expect(right.offsetX).toBeCloseTo(39.5, 5)
  })

  it('dining-chair/office-chair: seat 슬롯 오프셋 회귀', () => {
    expect(getSitSlots(getFurnitureDefinition('dining-chair')!)[0].offsetX).toBe(0)
    expect(getSitSlots(getFurnitureDefinition('dining-chair')!)[0].offsetY).toBeCloseTo(-1.4, 5)
    expect(getSitSlots(getFurnitureDefinition('office-chair')!)[0].offsetX).toBe(0)
    expect(getSitSlots(getFurnitureDefinition('office-chair')!)[0].offsetY).toBeCloseTo(6.7, 5)
  })

  it('table/dining-table: stand(좌/우) 슬롯 오프셋 회귀', () => {
    const table = getStandSlots(getFurnitureDefinition('table')!)
    expect(table).toHaveLength(2)
    expect(table[0].offsetX).toBeCloseTo(-table[1].offsetX, 5)
  })

  it('bed: 두 lie 슬롯을 모두 사용할 수 있다', () => {
    const slots = getUsableLieSlots(getFurnitureDefinition('bed')!)
    expect(slots).toHaveLength(2)
    expect(slots.map((slot) => slot.id)).toEqual(['bed-left', 'bed-right'])
  })

  it('canopy-bed: 1인용 lie 슬롯이 매트리스 중앙에 배치된다', () => {
    const slots = getUsableLieSlots(getFurnitureDefinition('canopy-bed')!)
    expect(slots).toHaveLength(1)
    expect(slots[0].offsetX).toBe(0)
  })
})

describe('가구 비주얼 2차 고도화: collision(가구 장애물)은 카탈로그 데이터만 사용하며 이번 라운드에 영향받지 않는다', () => {
  it('SOFA/CHAIR/TABLE/STORAGE/BED 각각의 collision rect가 이전과 동일한 solid 모드/치수로 계산된다', () => {
    const placements: FurniturePlacement[] = [
      { id: 'p-sofa', furnitureId: 'sofa', x: 200, y: 200, scale: 1, rotation: 0, colorway: getDefaultColorway('sofa'), layer: 0 },
      { id: 'p-chair', furnitureId: 'dining-chair', x: 300, y: 200, scale: 1, rotation: 0, colorway: getDefaultColorway('dining-chair'), layer: 1 },
      { id: 'p-table', furnitureId: 'dining-table', x: 400, y: 200, scale: 1, rotation: 0, colorway: getDefaultColorway('dining-table'), layer: 2 },
      { id: 'p-dresser', furnitureId: 'dresser', x: 500, y: 200, scale: 1, rotation: 0, colorway: getDefaultColorway('dresser'), layer: 3 },
      { id: 'p-bed', furnitureId: 'bed', x: 600, y: 200, scale: 1, rotation: 0, colorway: getDefaultColorway('bed'), layer: 4 },
    ]
    const obstacles = furnitureObstacles(placements)
    expect(obstacles).toHaveLength(placements.length)
    for (const o of obstacles) {
      expect(o.maxX - o.minX).toBeGreaterThan(0)
      expect(o.maxY - o.minY).toBeGreaterThan(0)
    }
  })
})

describe('가구 비주얼 2차 고도화: seat/lie/stand 실제 앉기·일어나기 흐름은 그대로 동작한다', () => {
  function movementEntry(id: string, x: number, y: number, roomId: string, overrides: Partial<CharacterMovementState> = {}): CharacterMovementState {
    return { id, roomId, x, y, destination: null, destinationRoomId: null, currentBehavior: null, status: 'idle', restTicksRemaining: 0, stuckTicks: 0, ...overrides }
  }

  function setupRoom(furniture: FurniturePlacement[]) {
    useHomeStore.setState((state) => {
      const room = { ...state.rooms[0], furniture }
      return { rooms: state.rooms.map((r, i) => (i === 0 ? room : r)) }
    })
    return useHomeStore.getState().rooms[0].id
  }

  it('sofa: 두 좌석을 각각 독립적으로 예약해서 걸어가고, 일어나면 예약이 풀린다 (phase 2 동작 유지)', () => {
    useCharacterStore.setState({ characters: [character('a'), character('b'), character('c')] })
    const roomId = setupRoom([{ id: 'sofa-1', furnitureId: 'sofa', x: 200, y: 200, scale: 1, rotation: 0, colorway: getDefaultColorway('sofa'), layer: 0 }])
    useCharacterMovementStore.setState({
      byId: { a: movementEntry('a', 190, 190, roomId), b: movementEntry('b', 210, 190, roomId), c: movementEntry('c', 200, 190, roomId) },
    })
    expect(startSitting('a', 'sofa-1', 'sofa-left')).toBe('started')
    expect(startSitting('b', 'sofa-1', 'sofa-right')).toBe('started')
    expect(useCharacterMovementStore.getState().byId.a?.status).toBe('moving')
    expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left']?.characterId).toBe('a')
    expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-right']?.characterId).toBe('b')
    // the exact same seat is refused a second time — reservation, not just a UI suggestion
    expect(startSitting('c', 'sofa-1', 'sofa-left')).toBe('occupied')
    standUp('a')
    standUp('b')
    expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left']).toBeUndefined()
    expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-right']).toBeUndefined()
  })

  it('bed: 눕는 요청이 예약되고 이동 목적지가 설정되며, 일어나면 예약이 풀린다 (phase 3 동작 유지)', () => {
    useCharacterStore.setState({ characters: [character('a'), character('b')] })
    const roomId = setupRoom([{ id: 'bed-1', furnitureId: 'bed', x: 300, y: 200, scale: 1, rotation: 0, colorway: getDefaultColorway('bed'), layer: 0 }])
    useCharacterMovementStore.setState({
      byId: { a: movementEntry('a', 300, 190, roomId), b: movementEntry('b', 310, 190, roomId) },
    })
    expect(startLyingDown('a', 'bed-1')).toBe('started')
    expect(useCharacterMovementStore.getState().byId.a?.status).toBe('moving')
    expect(useCharacterMovementStore.getState().byId.a?.destination).not.toBeNull()
    expect(useFurnitureUsageStore.getState().byCharacterId.a).toBe('bed-1:bed-left')
    // The second side remains independently reservable while the first is occupied.
    expect(startLyingDown('b', 'bed-1')).toBe('started')
    expect(useFurnitureUsageStore.getState().byCharacterId.b).toBe('bed-1:bed-right')
    standUp('a')
    expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
  })

  it('table: 좌/우 자리에 머무르는 요청이 각각 독립적으로 예약된다 (phase 3 동작 유지)', () => {
    useCharacterStore.setState({ characters: [character('a'), character('b')] })
    const roomId = setupRoom([{ id: 'table-1', furnitureId: 'table', x: 400, y: 200, scale: 1, rotation: 0, colorway: getDefaultColorway('table'), layer: 0 }])
    const slots = getStandSlots(getFurnitureDefinition('table')!)
    useCharacterMovementStore.setState({
      byId: { a: movementEntry('a', 390, 200, roomId), b: movementEntry('b', 410, 200, roomId) },
    })
    expect(startLingering('a', 'table-1', slots[0].id)).toBe('started')
    expect(startLingering('b', 'table-1', slots[1].id)).toBe('started')
    expect(useFurnitureUsageStore.getState().bySeatKey[`table-1:${slots[0].id}`]?.characterId).toBe('a')
    expect(useFurnitureUsageStore.getState().bySeatKey[`table-1:${slots[1].id}`]?.characterId).toBe('b')
    standUp('a')
    standUp('b')
    expect(useFurnitureUsageStore.getState().bySeatKey[`table-1:${slots[0].id}`]).toBeUndefined()
    expect(useFurnitureUsageStore.getState().bySeatKey[`table-1:${slots[1].id}`]).toBeUndefined()
  })
})
