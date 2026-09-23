import { describe, expect, it } from 'vitest'
import { getFurnitureDefinition } from '../home/furnitureCatalog'
import type { FurniturePlacement } from '../home/types'
import { CHARACTER_RADIUS, FURNITURE_APPROACH_CLEARANCE } from './movementConfig'
import { getPrimarySitSlot, isSittableFurniture, resolveApproachPoint, resolveSeatFacing, resolveSeatPosition } from './furnitureInteractionEngine'

const SOFA = getFurnitureDefinition('sofa')!
const TABLE = getFurnitureDefinition('table')!
const PLANT = getFurnitureDefinition('plant')!

function placement(overrides: Partial<FurniturePlacement> = {}): FurniturePlacement {
  return { id: 'p1', furnitureId: 'sofa', x: 300, y: 300, scale: 1, rotation: 0, colorway: 'rose', layer: 0, ...overrides }
}

describe('getPrimarySitSlot / isSittableFurniture', () => {
  it('finds the sofa\'s first "sit" slot and treats it as sittable', () => {
    const slot = getPrimarySitSlot(SOFA)
    expect(slot?.kind).toBe('sit')
    expect(slot?.id).toBe('sofa-left')
    expect(isSittableFurniture('sofa')).toBe(true)
  })

  it('a piece with only "stand" slots, or none at all, is never sittable', () => {
    expect(getPrimarySitSlot(TABLE)).toBeUndefined() // table's slots are both 'stand'
    expect(getPrimarySitSlot(PLANT)).toBeUndefined() // no slots at all
    expect(isSittableFurniture('table')).toBe(false)
    expect(isSittableFurniture('plant')).toBe(false)
  })

  it('an unknown furniture id is never sittable', () => {
    expect(isSittableFurniture('not-a-real-id')).toBe(false)
  })
})

describe('resolveSeatPosition / resolveSeatFacing', () => {
  const slot = getPrimarySitSlot(SOFA)!

  it('never hardcodes a world position — it tracks the placement\'s own x/y', () => {
    const a = resolveSeatPosition(placement({ x: 100, y: 100 }), slot)
    const b = resolveSeatPosition(placement({ x: 400, y: 250 }), slot)
    expect(a).not.toEqual(b)
    expect(b.x - a.x).toBeCloseTo(300)
    expect(b.y - a.y).toBeCloseTo(150)
  })

  it('scales the slot offset with the placement\'s own scale', () => {
    const at1 = resolveSeatPosition(placement({ scale: 1 }), slot)
    const at2 = resolveSeatPosition(placement({ scale: 2 }), slot)
    const p = placement()
    expect(at2.x - p.x).toBeCloseTo((at1.x - p.x) * 2)
    expect(at2.y - p.y).toBeCloseTo((at1.y - p.y) * 2)
  })

  it('mirrors the X offset (never the Y) for a rotated (rotation: 180) placement, matching the visual scaleX(-1)', () => {
    const normal = resolveSeatPosition(placement({ rotation: 0 }), slot)
    const mirrored = resolveSeatPosition(placement({ rotation: 180 }), slot)
    const p = placement()
    expect(mirrored.x - p.x).toBeCloseTo(-(normal.x - p.x))
    expect(mirrored.y - p.y).toBeCloseTo(normal.y - p.y)
  })

  it('reflects facing across the vertical axis only when mirrored', () => {
    expect(resolveSeatFacing(placement({ rotation: 0 }), slot)).toBe(slot.facing)
    expect(resolveSeatFacing(placement({ rotation: 180 }), slot)).toBeCloseTo(Math.PI - slot.facing)
  })

  it('the two sofa slots (left/right) resolve to two distinct seat positions', () => {
    const left = SOFA.interactionSlots.find((s) => s.id === 'sofa-left')!
    const right = SOFA.interactionSlots.find((s) => s.id === 'sofa-right')!
    const p = placement()
    expect(resolveSeatPosition(p, left)).not.toEqual(resolveSeatPosition(p, right))
  })
})

describe('resolveApproachPoint', () => {
  const slot = getPrimarySitSlot(SOFA)!

  it('lands outside the furniture\'s own solid collision rect, on the open (south) side', () => {
    const p = placement({ x: 300, y: 300, scale: 1 })
    const approach = resolveApproachPoint(p, SOFA, slot)
    const footprintBottom = p.y + SOFA.height / 2 // full-height solid rect (no footprintHeightRatio set)
    expect(approach.y).toBeGreaterThanOrEqual(footprintBottom + CHARACTER_RADIUS)
    expect(approach.y).toBeCloseTo(footprintBottom + FURNITURE_APPROACH_CLEARANCE, 0)
  })

  it('follows the placement, never a hardcoded per-sofa constant', () => {
    const near = resolveApproachPoint(placement({ x: 100, y: 100 }), SOFA, slot)
    const far = resolveApproachPoint(placement({ x: 500, y: 350 }), SOFA, slot)
    expect(near).not.toEqual(far)
  })

  it('scales with the placement\'s scale', () => {
    const small = resolveApproachPoint(placement({ scale: 0.8 }), SOFA, slot)
    const large = resolveApproachPoint(placement({ scale: 1.3 }), SOFA, slot)
    expect(large.y).toBeGreaterThan(small.y)
  })

  it('mirrors along with the seat when rotated', () => {
    const normal = resolveApproachPoint(placement({ rotation: 0 }), SOFA, slot)
    const mirrored = resolveApproachPoint(placement({ rotation: 180 }), SOFA, slot)
    expect(mirrored.x).not.toBeCloseTo(normal.x, 0)
    expect(mirrored.y).toBeCloseTo(normal.y)
  })

  it('stays clamped inside the room\'s walkable floor bounds even for a sofa near the room edge', () => {
    const p = placement({ x: 300, y: 10000 }) // absurdly far south, well outside the room
    const approach = resolveApproachPoint(p, SOFA, slot)
    expect(Number.isFinite(approach.x)).toBe(true)
    expect(Number.isFinite(approach.y)).toBe(true)
    // clampToFloorBounds guarantees this stays within the room's own height, not off in space.
    expect(approach.y).toBeLessThan(10000)
  })
})
