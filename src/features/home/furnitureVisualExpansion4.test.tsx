import { describe, expect, it, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { getColorwayOptions, getDefaultColorway } from './colorways'
import { getFurnitureDefinition, FURNITURE_CATALOG } from './furnitureCatalog'
import { FurnitureIcon } from './illustrations'
import { furnitureObstacles } from '../simulation/movementEngine'
import { classifyInteractionType } from './furnitureInteractionType'
import type { FurniturePlacement } from './types'

afterEach(() => {
  cleanup()
})

/**
 * "가구 비주얼 2차 리디자인 + 가구 종류 확장" (4th visual round): the request
 * listed ~50 furniture names across living/bedroom/kitchen/storage/decor —
 * cross-checked against the real catalog first (per the spec's own "이미
 * 존재하는 가구를 먼저 조사한다... 중복 ID를 만들지 말고 기존 것을 확장한다"),
 * and only 4 were genuinely missing: kitchen-counter/toaster/kettle/
 * coffee-machine (a small-appliance gap — the kitchen category previously
 * had only fridge/kitchen-cabinet/sink/microwave). Everything else the
 * request named (sofa/sofa-single/armchair/coffee-table/side-table/
 * bedside-table=nightstand/dresser/wardrobe/floor-mirror/tv-console=
 * tv-stand/low-cabinet/bookshelf/display-shelf/rug/dining-table/
 * dining-chair/stool/storage-basket/drawer-chest=dresser/vase/
 * potted-plant=plant/framed-picture=frame/photo-frame=frame/wall-clock/
 * table-clock=desk-clock/candle/bunny-doll/bear-doll/cushion/books=
 * book-stack) already existed and was intentionally not duplicated.
 */
describe('가구 비주얼 2차 리디자인 4차: 신규 주방 소가전 데이터 유효성', () => {
  const NEW_IDS = ['kitchen-counter', 'toaster', 'kettle', 'coffee-machine'] as const

  it('전체 카탈로그에 네 가구가 정확히 한 번씩, kitchen 카테고리로 존재한다', () => {
    for (const id of NEW_IDS) {
      const matches = FURNITURE_CATALOG.filter((f) => f.id === id)
      expect(matches, id).toHaveLength(1)
      expect(matches[0].category, id).toBe('kitchen')
    }
  })

  it('네 가구 모두 상호작용 슬롯이 없다 (장식/비좌석 가구)', () => {
    for (const id of NEW_IDS) {
      expect(getFurnitureDefinition(id)?.interactionSlots, id).toEqual([])
    }
  })

  it('kitchen-counter는 다른 주방 하부장처럼 바닥을 막고(solid), 소형 가전 3종은 캐릭터가 옆으로 지나갈 수 있다(none)', () => {
    expect(getFurnitureDefinition('kitchen-counter')?.collision.mode).toBe('solid')
    for (const id of ['toaster', 'kettle', 'coffee-machine']) {
      expect(getFurnitureDefinition(id)?.collision.mode, id).toBe('none')
    }
  })

  it('네 가구 모두 preset 색상 옵션을 받는다 (일반 GENERIC 컬러웨이 세트로 자동 연결됨)', () => {
    for (const id of NEW_IDS) expect(getColorwayOptions(id).length, id).toBeGreaterThan(1)
  })

  it('interactionType 분류: kitchen-counter는 storage로, 소형 가전 3종은 decor로 분류된다 (실제 상호작용 시스템은 이 분류를 전혀 참조하지 않음)', () => {
    expect(classifyInteractionType(getFurnitureDefinition('kitchen-counter')!)).toBe('storage')
    for (const id of ['toaster', 'kettle', 'coffee-machine']) {
      expect(classifyInteractionType(getFurnitureDefinition(id)!), id).toBe('decor')
    }
  })
})

describe('가구 비주얼 2차 리디자인 4차: 렌더링 회귀', () => {
  const NEW_IDS = ['kitchen-counter', 'toaster', 'kettle', 'coffee-machine'] as const

  it.each(NEW_IDS)('%s: 모든 colorway가 예외 없이 렌더링되고, colorway가 바뀌면 실제로 다른 그림이 그려진다', (id) => {
    const def = getFurnitureDefinition(id)!
    const options = getColorwayOptions(id)
    let previousHtml: string | null = null
    for (const colorway of options) {
      const { unmount, container } = render(<FurnitureIcon furnitureId={id} width={def.width} height={def.height} colorway={colorway.id} />)
      expect(container.querySelector('svg'), `${id}/${colorway.id}`).toBeTruthy()
      if (previousHtml !== null) expect(container.innerHTML, `${id}/${colorway.id}`).not.toBe(previousHtml)
      previousHtml = container.innerHTML
      unmount()
    }
  })

  it('kitchen-counter는 조리대 위 도마·채소 소품을 그려, 같은 하부장 구조의 kitchen-cabinet과 구별된다', () => {
    const counter = getFurnitureDefinition('kitchen-counter')!
    const cabinet = getFurnitureDefinition('kitchen-cabinet')!
    const counterRender = render(<FurnitureIcon furnitureId="kitchen-counter" width={counter.width} height={counter.height} colorway={getDefaultColorway('kitchen-counter')} />)
    const counterCircles = counterRender.container.querySelectorAll('circle').length
    counterRender.unmount()
    const cabinetRender = render(<FurnitureIcon furnitureId="kitchen-cabinet" width={cabinet.width} height={cabinet.height} colorway={getDefaultColorway('kitchen-cabinet')} />)
    const cabinetCircles = cabinetRender.container.querySelectorAll('circle').length
    cabinetRender.unmount()
    // the cutting-board veggies are drawn as circles the plain cabinet doesn't have (beyond its own two door knobs)
    expect(counterCircles).toBeGreaterThan(cabinetCircles)
  })
})

describe('가구 비주얼 2차 리디자인 4차: 기존 interaction/collision은 전혀 변경되지 않았다', () => {
  it('sofa/bed/dining-chair/table 슬롯 오프셋 회귀 (이번 라운드에서 손대지 않음)', () => {
    const sofa = getFurnitureDefinition('sofa')!.interactionSlots
    expect(sofa.find((s) => s.id === 'sofa-left')?.offsetX).toBeCloseTo(-39.5, 5)
    const bed = getFurnitureDefinition('bed')!.interactionSlots
    expect(bed.find((s) => s.id === 'bed-left')?.offsetX).toBeCloseTo(-40.3, 5)
    const diningChair = getFurnitureDefinition('dining-chair')!.interactionSlots
    expect(diningChair[0].offsetY).toBeCloseTo(-1.4, 5)
  })

  it('기존 주방 가구(fridge/sink/microwave/kitchen-cabinet)는 id/category/collision이 그대로다', () => {
    expect(getFurnitureDefinition('fridge')?.collision.mode).toBe('solid')
    expect(getFurnitureDefinition('sink')?.collision.mode).toBe('solid')
    expect(getFurnitureDefinition('microwave')?.collision.mode).toBe('none')
    expect(getFurnitureDefinition('kitchen-cabinet')?.category).toBe('kitchen')
  })

  it('collision(가구 장애물) 계산은 신규 가구를 포함해도 예외 없이 동작한다', () => {
    const placements: FurniturePlacement[] = [
      { id: 'p-counter', furnitureId: 'kitchen-counter', x: 200, y: 200, scale: 1, rotation: 0, colorway: getDefaultColorway('kitchen-counter'), layer: 0 },
      { id: 'p-toaster', furnitureId: 'toaster', x: 260, y: 180, scale: 1, rotation: 0, colorway: getDefaultColorway('toaster'), layer: 1 },
      { id: 'p-kettle', furnitureId: 'kettle', x: 300, y: 180, scale: 1, rotation: 0, colorway: getDefaultColorway('kettle'), layer: 2 },
      { id: 'p-coffee', furnitureId: 'coffee-machine', x: 340, y: 180, scale: 1, rotation: 0, colorway: getDefaultColorway('coffee-machine'), layer: 3 },
    ]
    const obstacles = furnitureObstacles(placements)
    // only kitchen-counter is solid — the three small appliances (collision: none) never generate an obstacle rect
    expect(obstacles).toHaveLength(1)
    expect(obstacles[0].maxX - obstacles[0].minX).toBeGreaterThan(0)
  })
})
