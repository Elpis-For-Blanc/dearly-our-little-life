import { describe, expect, it, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { getColorwayOptions, getDefaultColorway } from './colorways'
import { getFurnitureDefinition } from './furnitureCatalog'
import { FurnitureIcon } from './illustrations'
import { getSitSlots } from '../simulation/furnitureInteractionEngine'

afterEach(() => {
  cleanup()
})

/**
 * "가구 비주얼 3차 리디자인 — 거실 + 침실 + 생활 소품": additive-only overlay
 * polish (bookshelf/nightstand/clock/mug/book-stack sheens) plus one real
 * new variant (`vase` 꽃이 있는/빈 꽃병). `rug` was deliberately left
 * untouched this round — an existing test (`rugWindow.test.tsx`'s "default
 * look is unchanged") pins its exact original SVG geometry, and this
 * round's rug ask (soft border, subtle pattern, non-blocking) was already
 * satisfied by the existing design, so nothing there needed to change. No
 * interactionSlots offset, catalog id, or engine/store file was touched.
 *
 * `sofa` briefly gained a small decorative throw pillow overlay in this
 * round, then had it removed again per explicit follow-up feedback (it
 * didn't read as "neatly arranged" even after repositioning) — the sofa is
 * back to its original, pillow-free two-cushion design. The tests below
 * reflect that final, pillow-free baseline, not the removed decoration.
 */
describe('가구 비주얼 3차 리디자인: vase의 새 variant(꽃이 있는/빈 꽃병)', () => {
  it('vase는 동일 크기의 두 variant를 갖는다 (상호작용 슬롯이 없어 크기가 달라도 안전하지만, 실제로는 모양만 다름)', () => {
    const def = getFurnitureDefinition('vase')!
    expect(def.interactionSlots).toEqual([])
    const [flowers, empty] = def.variants!
    expect(flowers.id).toBe('flowers')
    expect(empty.id).toBe('empty')
    expect(flowers.width).toBe(empty.width)
    expect(flowers.height).toBe(empty.height)
  })

  it('flowers/empty variant가 실제로 다른 그림을 그린다 (꽃 유무)', () => {
    const def = getFurnitureDefinition('vase')!
    const flowers = render(<FurnitureIcon furnitureId="vase" width={def.width} height={def.height} colorway={getDefaultColorway('vase')} variant="flowers" />)
    const flowersCircles = flowers.container.querySelectorAll('circle').length
    flowers.unmount()
    const empty = render(<FurnitureIcon furnitureId="vase" width={def.width} height={def.height} colorway={getDefaultColorway('vase')} variant="empty" />)
    const emptyCircles = empty.container.querySelectorAll('circle').length
    empty.unmount()
    // the flower blooms are drawn as circles; the empty vase has none
    expect(flowersCircles).toBeGreaterThan(0)
    expect(emptyCircles).toBe(0)
  })

  it('variant를 지정하지 않으면 기존 저장 데이터와 동일하게 꽃이 있는 기본 모습을 그린다', () => {
    const def = getFurnitureDefinition('vase')!
    const withoutVariant = render(<FurnitureIcon furnitureId="vase" width={def.width} height={def.height} colorway={getDefaultColorway('vase')} />)
    const circles = withoutVariant.container.querySelectorAll('circle').length
    withoutVariant.unmount()
    expect(circles).toBeGreaterThan(0)
  })
})

describe('가구 비주얼 3차 리디자인: sofa는 장식 쿠션 없이 원래의 정돈된 두 쿠션 디자인으로 유지된다', () => {
  it('sofa-left/sofa-right 오프셋 회귀', () => {
    const slots = getSitSlots(getFurnitureDefinition('sofa')!)
    expect(slots.map((s) => s.id)).toEqual(['sofa-left', 'sofa-right'])
    expect(slots.find((s) => s.id === 'sofa-left')?.offsetX).toBeCloseTo(-39.5, 5)
    expect(slots.find((s) => s.id === 'sofa-right')?.offsetX).toBeCloseTo(39.5, 5)
  })

  it('sofa는 정확히 두 개의 좌석 쿠션만 그린다 — 추가로 실험했던 장식용 throw pillow는 제거되어 남아있지 않다', () => {
    const def = getFurnitureDefinition('sofa')!
    const { container } = render(<FurnitureIcon furnitureId="sofa" width={def.width} height={def.height} colorway={getDefaultColorway('sofa')} />)
    // every rect in this illustration with a rounded corner at cushionH*0.35 is one of the two real seat cushions —
    // a third rect at that same corner radius would mean a stray decorative cushion crept back in
    const cushionCorner = String(def.height * 0.27 * 0.35)
    const cushionRects = Array.from(container.querySelectorAll('rect')).filter((r) => r.getAttribute('rx') === cushionCorner)
    expect(cushionRects).toHaveLength(2)
    container.remove()
  })
})

describe('가구 비주얼 3차 리디자인: 렌더링 회귀 (이번 라운드에서 손댄 소품/가구)', () => {
  const TOUCHED_IDS = ['sofa', 'bookshelf', 'nightstand', 'wall-clock', 'desk-clock', 'mug', 'book-stack', 'fridge', 'sink', 'microwave'] as const

  it.each(TOUCHED_IDS)('%s: 모든 colorway가 예외 없이 렌더링된다', (id) => {
    const def = getFurnitureDefinition(id)!
    for (const colorway of getColorwayOptions(id)) {
      const { unmount, container } = render(<FurnitureIcon furnitureId={id} width={def.width} height={def.height} colorway={colorway.id} />)
      expect(container.querySelector('svg'), `${id}/${colorway.id}`).toBeTruthy()
      unmount()
    }
  })
})
