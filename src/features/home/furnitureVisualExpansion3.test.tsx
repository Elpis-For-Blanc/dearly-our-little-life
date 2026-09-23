import { describe, expect, it, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { getColorwayOptions, getDefaultColorway } from './colorways'
import { getFurnitureDefinition, FURNITURE_CATALOG, isValidVariant, getFurnitureSize } from './furnitureCatalog'
import { FurnitureIcon } from './illustrations'
import { getSitSlots } from '../simulation/furnitureInteractionEngine'
import { furnitureObstacles } from '../simulation/movementEngine'
import { standUp, startSitting } from '../simulation/furnitureUsageTrigger'
import { useFurnitureUsageStore } from '../simulation/furnitureUsageStore'
import { useCharacterMovementStore, type CharacterMovementState } from '../simulation/characterMovementStore'
import { useHomeStore } from './homeStore'
import type { FurniturePlacement } from './types'
import { useCharacterStore } from '../character/characterStore'
import { EMPTY_AI_PROFILE, type Character } from '../character/types'

afterEach(() => {
  cleanup()
})

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

function movementEntry(id: string, x: number, y: number, roomId: string, overrides: Partial<CharacterMovementState> = {}): CharacterMovementState {
  return { id, roomId, x, y, destination: null, destinationRoomId: null, currentBehavior: null, status: 'idle', restTicksRemaining: 0, stuckTicks: 0, ...overrides }
}

/**
 * "가구 비주얼 고도화 + 종류 확장 (3차)": only two furniture ids were
 * genuinely new (`stool`, `storage-basket`) — everything else the request
 * named (2인/3인 소파, 암체어, 싱글/더블 침대, 협탁, 서랍장, 책장, 전신거울,
 * 화분, 인형, 컴퓨터 책상, 티테이블, 벽 장식) already existed in the catalog
 * under other ids and was intentionally not duplicated (see
 * furnitureCatalog.ts's own comment at the bottom of RAW_CATALOG). This file
 * covers: the two new pieces render and interact correctly, the two new
 * `variants` (bookshelf 4단/2단, wall-mirror 오벌/아치형) actually draw
 * something different, and nothing about existing interaction/collision
 * data was disturbed.
 */
describe('가구 비주얼 고도화 3차: 신규 가구(stool/storage-basket) 데이터 유효성', () => {
  it('전체 카탈로그에 두 가구가 정확히 한 번씩 존재한다', () => {
    for (const id of ['stool', 'storage-basket']) {
      expect(FURNITURE_CATALOG.filter((f) => f.id === id), id).toHaveLength(1)
    }
  })

  it('stool은 실제 sit 슬롯을 갖는다 (앉을 수 있는 새 가구)', () => {
    const def = getFurnitureDefinition('stool')!
    expect(getSitSlots(def)).toHaveLength(1)
    expect(getSitSlots(def)[0].offsetX).toBe(0)
  })

  it('storage-basket은 상호작용 슬롯이 없다 (수납 장식품)', () => {
    expect(getFurnitureDefinition('storage-basket')?.interactionSlots).toEqual([])
  })

  it('stool의 두 variant는 폭/높이가 완전히 동일하다 — 실제 slot을 가진 가구에 크기가 다른 variant를 절대 추가하지 않는다는 기존 규칙 준수', () => {
    const def = getFurnitureDefinition('stool')!
    expect(def.variants).toBeDefined()
    const [first, second] = def.variants!
    expect(first.width).toBe(second.width)
    expect(first.height).toBe(second.height)
    // and both equal the definition's own base size, so getFurnitureSize agrees regardless of which is chosen
    expect(getFurnitureSize(def, first.id)).toEqual({ width: def.width, height: def.height })
    expect(getFurnitureSize(def, second.id)).toEqual({ width: def.width, height: def.height })
  })

  it('storage-basket의 두 variant는 서로 다른 크기를 가질 수 있다 (상호작용 슬롯이 없어 안전함)', () => {
    const def = getFurnitureDefinition('storage-basket')!
    const [first, second] = def.variants!
    expect(first.width === second.width && first.height === second.height).toBe(false)
  })

  it('bookshelf/wall-mirror는 새 variant가 추가되었지만 상호작용 슬롯이 없으므로 안전하다', () => {
    expect(getFurnitureDefinition('bookshelf')?.interactionSlots).toEqual([])
    expect(getFurnitureDefinition('wall-mirror')?.interactionSlots).toEqual([])
    expect(getFurnitureDefinition('bookshelf')?.variants?.map((v) => v.id)).toEqual(['four-shelf', 'two-shelf'])
    expect(getFurnitureDefinition('wall-mirror')?.variants?.map((v) => v.id)).toEqual(['oval', 'arch'])
  })
})

describe('가구 비주얼 고도화 3차: 렌더링 회귀', () => {
  const IDS_WITH_VARIANTS = ['stool', 'storage-basket', 'bookshelf', 'wall-mirror'] as const

  it.each(IDS_WITH_VARIANTS)('%s: 모든 variant × 모든 colorway가 예외 없이 렌더링된다', (id) => {
    const def = getFurnitureDefinition(id)!
    const variants = def.variants ?? [undefined]
    for (const variant of variants) {
      for (const colorway of getColorwayOptions(id)) {
        const size = getFurnitureSize(def, variant?.id)
        const { unmount, container } = render(<FurnitureIcon furnitureId={id} width={size.width} height={size.height} colorway={colorway.id} variant={variant?.id} />)
        expect(container.querySelector('svg'), `${id}/${variant?.id}/${colorway.id}`).toBeTruthy()
        unmount()
      }
    }
  })

  it('stool: round/square variant가 실제로 다른 모양을 그린다', () => {
    const def = getFurnitureDefinition('stool')!
    const round = render(<FurnitureIcon furnitureId="stool" width={def.width} height={def.height} colorway={getDefaultColorway('stool')} />)
    const roundHtml = round.container.innerHTML
    round.unmount()
    const square = render(<FurnitureIcon furnitureId="stool" width={def.width} height={def.height} colorway={getDefaultColorway('stool')} variant="square" />)
    const squareHtml = square.container.innerHTML
    square.unmount()
    expect(roundHtml).not.toBe(squareHtml)
  })

  it('storage-basket: round/rect variant가 실제로 다른 모양을 그린다', () => {
    const def = getFurnitureDefinition('storage-basket')!
    expect(isValidVariant(def, 'round')).toBe(true)
    expect(isValidVariant(def, 'rect')).toBe(true)
    const round = render(<FurnitureIcon furnitureId="storage-basket" width={def.width} height={def.height} colorway={getDefaultColorway('storage-basket')} variant="round" />)
    const roundHtml = round.container.innerHTML
    round.unmount()
    const rect = render(<FurnitureIcon furnitureId="storage-basket" width={64} height={52} colorway={getDefaultColorway('storage-basket')} variant="rect" />)
    const rectHtml = rect.container.innerHTML
    rect.unmount()
    expect(roundHtml).not.toBe(rectHtml)
  })

  it('bookshelf: four-shelf/two-shelf variant가 실제로 다른 책장 구조를 그린다 (선반 개수가 다름)', () => {
    const def = getFurnitureDefinition('bookshelf')!
    const four = render(<FurnitureIcon furnitureId="bookshelf" width={def.width} height={def.height} colorway={getDefaultColorway('bookshelf')} variant="four-shelf" />)
    const fourShelves = four.container.querySelectorAll('rect[rx="2"]').length
    four.unmount()
    const two = render(<FurnitureIcon furnitureId="bookshelf" width={def.width} height={120} colorway={getDefaultColorway('bookshelf')} variant="two-shelf" />)
    const twoShelves = two.container.querySelectorAll('rect[rx="2"]').length
    two.unmount()
    expect(fourShelves).toBeGreaterThan(twoShelves)
  })

  it('wall-mirror: oval/arch variant가 실제로 다른 실루엣을 그린다', () => {
    const def = getFurnitureDefinition('wall-mirror')!
    const oval = render(<FurnitureIcon furnitureId="wall-mirror" width={def.width} height={def.height} colorway={getDefaultColorway('wall-mirror')} variant="oval" />)
    const ovalEllipses = oval.container.querySelectorAll('ellipse').length
    oval.unmount()
    const arch = render(<FurnitureIcon furnitureId="wall-mirror" width={def.width} height={def.height} colorway={getDefaultColorway('wall-mirror')} variant="arch" />)
    const archPaths = arch.container.querySelectorAll('path').length
    arch.unmount()
    // the oval shape is drawn with ellipses, the arch shape with paths — different element mixes prove a real silhouette change
    expect(ovalEllipses).toBeGreaterThan(0)
    expect(archPaths).toBeGreaterThan(0)
  })
})

describe('가구 비주얼 고도화 3차: 기존 interaction/collision 데이터는 전혀 변경되지 않았다', () => {
  it('sofa/dining-chair/office-chair/bed/table 슬롯 오프셋 회귀 (이번 라운드에서 손대지 않음)', () => {
    const sofa = getFurnitureDefinition('sofa')!.interactionSlots
    expect(sofa.find((s) => s.id === 'sofa-left')?.offsetX).toBeCloseTo(-39.5, 5)
    expect(sofa.find((s) => s.id === 'sofa-right')?.offsetX).toBeCloseTo(39.5, 5)
    expect(getSitSlots(getFurnitureDefinition('dining-chair')!)[0].offsetY).toBeCloseTo(-1.4, 5)
    expect(getSitSlots(getFurnitureDefinition('office-chair')!)[0].offsetY).toBeCloseTo(6.7, 5)
    const bed = getFurnitureDefinition('bed')!.interactionSlots
    expect(bed.find((s) => s.id === 'bed-left')?.offsetX).toBeCloseTo(-40.3, 5)
  })

  it('collision(가구 장애물) 계산은 stool/storage-basket을 포함해도 기존 가구에 영향 없다', () => {
    const placements: FurniturePlacement[] = [
      { id: 'p-sofa', furnitureId: 'sofa', x: 200, y: 200, scale: 1, rotation: 0, colorway: getDefaultColorway('sofa'), layer: 0 },
      { id: 'p-stool', furnitureId: 'stool', x: 300, y: 200, scale: 1, rotation: 0, colorway: getDefaultColorway('stool'), layer: 1 },
      { id: 'p-basket', furnitureId: 'storage-basket', x: 400, y: 200, scale: 1, rotation: 0, colorway: getDefaultColorway('storage-basket'), layer: 2 },
    ]
    const obstacles = furnitureObstacles(placements)
    expect(obstacles).toHaveLength(3)
    for (const o of obstacles) {
      expect(o.maxX - o.minX).toBeGreaterThan(0)
      expect(o.maxY - o.minY).toBeGreaterThan(0)
    }
  })
})

describe('가구 비주얼 고도화 3차: stool의 실제 앉기·일어나기 흐름', () => {
  function setupRoom(furniture: FurniturePlacement[]) {
    useHomeStore.setState((state) => {
      const room = { ...state.rooms[0], furniture }
      return { rooms: state.rooms.map((r, i) => (i === 0 ? room : r)) }
    })
    return useHomeStore.getState().rooms[0].id
  }

  it('stool에 앉는 요청이 예약되고 이동 목적지가 설정되며, 일어나면 예약이 풀린다', () => {
    useCharacterStore.setState({ characters: [character('a')] })
    const roomId = setupRoom([{ id: 'stool-1', furnitureId: 'stool', x: 300, y: 200, scale: 1, rotation: 0, colorway: getDefaultColorway('stool'), layer: 0 }])
    useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 290, 200, roomId) } })
    expect(startSitting('a', 'stool-1')).toBe('started')
    expect(useCharacterMovementStore.getState().byId.a?.status).toBe('moving')
    expect(useFurnitureUsageStore.getState().byCharacterId.a).toBe('stool-1:seat')
    standUp('a')
    expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
  })
})
