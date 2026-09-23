import { describe, expect, it } from 'vitest'
import { getFurnitureDefinition } from './furnitureCatalog'
import { clampFurniturePlacement, floorFurnitureMinY, FLOOR_SURFACE_TOP_Y, isPlacementWithinBounds, placementBounds } from './furniturePlacementEngine'
import { ROOM_HEIGHT, ROOM_WIDTH } from './roomLayout'

const SOFA = getFurnitureDefinition('sofa')! // zone: floor, collision: solid, height 96
const WINDOW = getFurnitureDefinition('window')! // zone: wall, collision: none
const RUG = getFurnitureDefinition('rug')! // zone: floor, collision: none
const CUSHION = getFurnitureDefinition('cushion')! // zone: floor(default), collision: none — a tabletop prop

describe('furniturePlacementEngine', () => {
  describe('floorFurnitureMinY', () => {
    it('keeps the bottom edge (center + height/2) exactly on the floor surface for a piece shorter than the floor band', () => {
      const height = 96
      const minY = floorFurnitureMinY(height)
      expect(minY + height / 2).toBeCloseTo(FLOOR_SURFACE_TOP_Y, 5)
    })

    it('falls back to half-height for a piece so tall its own half-height already exceeds the floor-surface requirement', () => {
      const height = 1000 // taller than the room itself — a hypothetical extreme, never a real catalog size
      expect(floorFurnitureMinY(height)).toBe(height / 2)
    })
  })

  describe('placementBounds', () => {
    it('raises minY for a floor-zone, solid-collision piece so its bottom edge cannot rise above the floor', () => {
      const bounds = placementBounds(SOFA, 224, 96)
      expect(bounds.minY).toBeCloseTo(floorFurnitureMinY(96), 5)
      expect(bounds.minY).toBeGreaterThan(96 / 2) // genuinely raised, not just the room-edge minimum
    })

    it('keeps the original room-edge-only minY for a wall-zone piece, regardless of collision mode', () => {
      const bounds = placementBounds(WINDOW, 180, 140)
      expect(bounds.minY).toBe(70) // half its own height — free to go anywhere vertically, per CLAUDE.md's established wall-piece design
    })

    it('keeps the original room-edge-only minY for a floor-zone piece with collision:none (a rug, a tabletop prop)', () => {
      expect(placementBounds(RUG, 320, 100).minY).toBe(50)
      expect(placementBounds(CUSHION, 48, 48).minY).toBe(24)
    })

    it('falls back to the unrestricted room-bounds behavior for an id no longer in the catalog', () => {
      const bounds = placementBounds(undefined, 60, 60)
      expect(bounds).toEqual({ minX: 30, maxX: ROOM_WIDTH - 30, minY: 30, maxY: ROOM_HEIGHT - 30 })
    })

    it('never produces an inverted range (minY > maxY), even for a hypothetically oversized floor piece', () => {
      const bounds = placementBounds(SOFA, 100, ROOM_HEIGHT + 500)
      expect(bounds.minY).toBeLessThanOrEqual(bounds.maxY)
    })
  })

  describe('clampFurniturePlacement', () => {
    it('leaves an already-valid point untouched', () => {
      expect(clampFurniturePlacement(SOFA, 300, 300, 224, 96)).toEqual({ x: 300, y: 300 })
    })

    it('raises a floor-zone solid piece placed too high up toward the wall band', () => {
      const clamped = clampFurniturePlacement(SOFA, 300, 50, 224, 96)
      expect(clamped.x).toBe(300)
      expect(clamped.y).toBeCloseTo(floorFurnitureMinY(96), 5)
    })

    it('never raises a wall-zone piece placed high up — stays free to move anywhere vertically', () => {
      expect(clampFurniturePlacement(WINDOW, 300, 50, 180, 140)).toEqual({ x: 300, y: 70 })
    })

    it('still clamps to the room edges on every axis', () => {
      expect(clampFurniturePlacement(SOFA, -500, 5000, 224, 96).x).toBe(112)
      expect(clampFurniturePlacement(SOFA, 5000, 300, 224, 96).x).toBe(ROOM_WIDTH - 112)
      expect(clampFurniturePlacement(SOFA, 300, 5000, 224, 96).y).toBe(ROOM_HEIGHT - 48)
    })
  })

  describe('isPlacementWithinBounds', () => {
    it('true for a point that needs no adjustment', () => {
      expect(isPlacementWithinBounds(SOFA, 300, 300, 224, 96)).toBe(true)
    })

    it('false for a floor-zone solid piece placed above the floor-grounding minimum', () => {
      expect(isPlacementWithinBounds(SOFA, 300, 150, 224, 96)).toBe(false)
    })

    it('false for a point outside the room entirely', () => {
      expect(isPlacementWithinBounds(SOFA, -50, 300, 224, 96)).toBe(false)
    })

    it('true for a wall-zone piece placed high up (no floor-grounding rule applies to it)', () => {
      expect(isPlacementWithinBounds(WINDOW, 300, 70, 180, 140)).toBe(true)
    })
  })
})
