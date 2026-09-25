import { describe, expect, it } from 'vitest'
import { getFurnitureDefinition } from './furnitureCatalog'
import { getUsableLieSlots } from '../simulation/furnitureInteractionEngine'

describe('침대 lie 슬롯 인원수', () => {
  it.each(['bed', 'bed-double'] as const)('%s는 2인이 사용할 수 있는 서로 다른 두 lie 슬롯을 제공한다', (id) => {
    const slots = getUsableLieSlots(getFurnitureDefinition(id)!)
    expect(slots).toHaveLength(2)
    expect(new Set(slots.map((slot) => slot.id)).size).toBe(2)
    expect(slots.every((slot) => slot.kind === 'lie')).toBe(true)
    expect(slots[0].offsetX).toBeLessThan(0)
    expect(slots[1].offsetX).toBeGreaterThan(0)
  })

  it.each(['bed-single', 'canopy-bed'] as const)('%s는 1인용 lie 슬롯 하나만 제공한다', (id) => {
    const slots = getUsableLieSlots(getFurnitureDefinition(id)!)
    expect(slots).toHaveLength(1)
    expect(slots[0].id).toBe('lie')
    expect(slots[0].offsetX).toBe(0)
    expect(slots[0].facing).toBeCloseTo(-Math.PI / 2, 5)
  })

  it('bed-double은 두 베개 중심에 맞춰 좌우 대칭이고 매트리스 안쪽에 있다', () => {
    const definition = getFurnitureDefinition('bed-double')!
    const [left, right] = getUsableLieSlots(definition)
    expect(left.offsetX).toBeCloseTo(-224 * 0.2075, 5)
    expect(right.offsetX).toBeCloseTo(224 * 0.2075, 5)
    const absoluteY = definition.height / 2 + left.offsetY
    expect(absoluteY).toBeCloseTo(definition.height * 0.57, 5)
    expect(absoluteY).toBeGreaterThan(definition.height * 0.4)
    expect(absoluteY).toBeLessThan(definition.height * 0.74)
  })

  it('canopy-bed의 한 슬롯은 기둥 사이 실제 매트리스 중앙에 있다', () => {
    const definition = getFurnitureDefinition('canopy-bed')!
    const [slot] = getUsableLieSlots(definition)
    expect(slot.offsetX).toBe(0)
    const absoluteY = definition.height / 2 + slot.offsetY
    expect(absoluteY).toBeCloseTo(definition.height * 0.699, 5)
    expect(absoluteY).toBeGreaterThan(definition.height * 0.588)
    expect(absoluteY).toBeLessThan(definition.height * 0.81)
  })
})
