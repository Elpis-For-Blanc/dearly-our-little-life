import { describe, expect, it } from 'vitest'
import { getFurnitureDefinition } from '../home/furnitureCatalog'
import { needsFurnitureWeight } from './needsFurnitureBonus'

const HIGH = { energy: 90, fun: 90 }
const LOW_ENERGY = { energy: 10, fun: 90 }
const LOW_FUN = { energy: 90, fun: 10 }
const LOW_BOTH = { energy: 10, fun: 10 }

describe('needsFurnitureBonus: needsFurnitureWeight', () => {
  it('energy가 낮으면 sofa(seat) 후보의 가중치가 올라간다', () => {
    const sofa = getFurnitureDefinition('sofa')!
    expect(needsFurnitureWeight(sofa, LOW_ENERGY)).toBeGreaterThan(needsFurnitureWeight(sofa, HIGH))
  })

  it('energy가 낮으면 bed(lie) 후보의 가중치도 올라간다', () => {
    const bed = getFurnitureDefinition('bed')!
    expect(needsFurnitureWeight(bed, LOW_ENERGY)).toBeGreaterThan(needsFurnitureWeight(bed, HIGH))
  })

  it('fun이 낮으면 table(desk 등) 후보의 가중치가 올라간다', () => {
    const desk = getFurnitureDefinition('desk')!
    expect(needsFurnitureWeight(desk, LOW_FUN)).toBeGreaterThan(needsFurnitureWeight(desk, HIGH))
  })

  it('fun이 낮아도 bed(lie)에는 보너스가 붙지 않는다 (energy 전용)', () => {
    const bed = getFurnitureDefinition('bed')!
    expect(needsFurnitureWeight(bed, LOW_FUN)).toBe(needsFurnitureWeight(bed, HIGH))
  })

  it('energy와 fun이 둘 다 낮으면 sofa(seat)는 두 보너스를 모두 받아 더 높은 가중치를 갖는다', () => {
    const sofa = getFurnitureDefinition('sofa')!
    const onlyEnergy = needsFurnitureWeight(sofa, LOW_ENERGY)
    const both = needsFurnitureWeight(sofa, LOW_BOTH)
    expect(both).toBeGreaterThan(onlyEnergy)
  })

  it('욕구가 모두 충분하면 가중치는 기본값(1)이다', () => {
    const sofa = getFurnitureDefinition('sofa')!
    expect(needsFurnitureWeight(sofa, HIGH)).toBe(1)
  })

  it('수납 가구(storage로 분류)는 어떤 욕구가 낮아도 보너스를 받지 않는다', () => {
    const dresser = getFurnitureDefinition('dresser')!
    expect(needsFurnitureWeight(dresser, LOW_BOTH)).toBe(1)
  })
})
