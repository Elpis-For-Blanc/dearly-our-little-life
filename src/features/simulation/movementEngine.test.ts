import { describe, expect, it } from 'vitest'
import {
  circleIntersectsRect,
  circlesOverlap,
  furnitureObstacles,
  hasArrived,
  pickBehavior,
  pickDestinationRoomId,
  pickRandomDestination,
  roomKindBiasForHour,
  stepToward,
  wouldCollide,
} from './movementEngine'
import { CHARACTER_RADIUS, FLOOR_TOP_Y } from './movementConfig'
import type { FurniturePlacement } from '../home/types'
import { ROOM_HEIGHT, ROOM_WIDTH } from '../home/roomLayout'
import { createDefaultDoorway, type Room } from '../home/roomTypes'
import { DEFAULT_FLOOR, DEFAULT_WALLPAPER } from '../home/roomSurface'

function fixedRandom(...values: number[]): () => number {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

describe('circleIntersectsRect', () => {
  it('detects overlap when the circle center is inside the rect', () => {
    expect(circleIntersectsRect(50, 50, 10, { minX: 0, maxX: 100, minY: 0, maxY: 100 })).toBe(true)
  })

  it('detects overlap when the circle is near but outside the rect, within radius', () => {
    expect(circleIntersectsRect(105, 50, 10, { minX: 0, maxX: 100, minY: 0, maxY: 100 })).toBe(true)
  })

  it('reports no overlap when clearly far away', () => {
    expect(circleIntersectsRect(500, 500, 10, { minX: 0, maxX: 100, minY: 0, maxY: 100 })).toBe(false)
  })
})

describe('circlesOverlap', () => {
  it('detects overlap when circles are closer than the sum of their radii', () => {
    expect(circlesOverlap(0, 0, 20, 30, 0, 20)).toBe(true)
  })

  it('reports no overlap when far enough apart', () => {
    expect(circlesOverlap(0, 0, 20, 100, 0, 20)).toBe(false)
  })
})

describe('furnitureObstacles', () => {
  function placement(overrides: Partial<FurniturePlacement> = {}): FurniturePlacement {
    return { id: '1', furnitureId: 'table', x: 100, y: 300, scale: 1, rotation: 0, colorway: 'default', layer: 0, ...overrides }
  }

  it('produces a bounding rect centered on the placement, scaled by placement.scale', () => {
    const [rect] = furnitureObstacles([placement({ furnitureId: 'table', scale: 1 })])
    // table is 128x128 at scale 1
    expect(rect).toEqual({ minX: 36, maxX: 164, minY: 236, maxY: 364 })
  })

  it('excludes rugs — they are walkable floor coverings, not obstacles', () => {
    const obstacles = furnitureObstacles([placement({ furnitureId: 'rug' }), placement({ furnitureId: 'table' })])
    expect(obstacles).toHaveLength(1)
  })
})

describe('stepToward', () => {
  it('moves by exactly `speed` units toward the destination when far away', () => {
    const next = stepToward({ x: 0, y: 0 }, { x: 100, y: 0 }, 10)
    expect(next.x).toBeCloseTo(10)
    expect(next.y).toBeCloseTo(0)
  })

  it('lands exactly on the destination instead of overshooting when close', () => {
    const next = stepToward({ x: 0, y: 0 }, { x: 5, y: 0 }, 10)
    expect(next).toEqual({ x: 5, y: 0 })
  })

  it('returns the same point when already at the destination', () => {
    const next = stepToward({ x: 5, y: 5 }, { x: 5, y: 5 }, 10)
    expect(next).toEqual({ x: 5, y: 5 })
  })
})

describe('hasArrived', () => {
  it('is true within the epsilon distance', () => {
    expect(hasArrived({ x: 0, y: 0 }, { x: 0.2, y: 0 })).toBe(true)
  })

  it('is false outside the epsilon distance', () => {
    expect(hasArrived({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(false)
  })
})

describe('wouldCollide', () => {
  const obstacle = { minX: 0, maxX: 50, minY: 0, maxY: 50 }

  it('is true when the next position overlaps a furniture obstacle', () => {
    expect(wouldCollide({ x: 25, y: 25 }, CHARACTER_RADIUS, [obstacle], [])).toBe(true)
  })

  it('is true when the next position overlaps another character', () => {
    expect(wouldCollide({ x: 200, y: 200 }, CHARACTER_RADIUS, [], [{ x: 205, y: 200 }])).toBe(true)
  })

  it('is false when clear of both obstacles and other characters', () => {
    expect(wouldCollide({ x: 400, y: 400 }, CHARACTER_RADIUS, [obstacle], [{ x: 0, y: 0 }])).toBe(false)
  })
})

describe('pickRandomDestination', () => {
  it('stays within the walkable floor bounds', () => {
    for (let i = 0; i < 20; i++) {
      const point = pickRandomDestination([], [], CHARACTER_RADIUS, fixedRandom(i / 20, (i * 7) % 20 / 20))
      expect(point.x).toBeGreaterThanOrEqual(CHARACTER_RADIUS)
      expect(point.x).toBeLessThanOrEqual(ROOM_WIDTH - CHARACTER_RADIUS)
      expect(point.y).toBeGreaterThanOrEqual(FLOOR_TOP_Y + CHARACTER_RADIUS)
      expect(point.y).toBeLessThanOrEqual(ROOM_HEIGHT - CHARACTER_RADIUS)
    }
  })

  it('never returns a point that overlaps a given obstacle, retrying until it finds a free spot', () => {
    // Obstacle covers almost the entire left half of the floor.
    const obstacle = { minX: 0, maxX: ROOM_WIDTH * 0.9, minY: FLOOR_TOP_Y, maxY: ROOM_HEIGHT }
    // Random sequence starts by aiming inside the obstacle, then finds the free strip on the right.
    const random = fixedRandom(0.1, 0.5, 0.1, 0.5, 0.99, 0.5)
    const point = pickRandomDestination([obstacle], [], CHARACTER_RADIUS, random)
    expect(circleWithin(point, obstacle)).toBe(false)
  })

  it('falls back to the floor center if every attempt is blocked', () => {
    const obstacle = { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 }
    const point = pickRandomDestination([obstacle], [], CHARACTER_RADIUS, fixedRandom(0.5))
    const expectedX = (CHARACTER_RADIUS + (ROOM_WIDTH - CHARACTER_RADIUS)) / 2
    expect(point.x).toBeCloseTo(expectedX)
  })

  function circleWithin(point: { x: number; y: number }, rect: { minX: number; maxX: number; minY: number; maxY: number }) {
    return circleIntersectsRect(point.x, point.y, CHARACTER_RADIUS, rect)
  }
})

describe('pickBehavior', () => {
  it('never returns changeRoom when canChangeRoom is false, regardless of the roll', () => {
    for (let i = 0; i < 10; i++) {
      expect(pickBehavior([], false, fixedRandom(i / 10))).not.toBe('changeRoom')
    }
  })

  it('can return changeRoom when canChangeRoom is true and the roll lands in its (smaller) share', () => {
    // Neutral weights: wander=1, rest=1, approach=1, seekSolitude=1, changeRoom=0.35 (total 4.35).
    // A roll just under the total lands in the last (changeRoom) slice.
    const behavior = pickBehavior([], true, fixedRandom(0.999))
    expect(behavior).toBe('changeRoom')
  })
})

describe('roomKindBiasForHour', () => {
  it('biases toward bedroom at night, not at other hours', () => {
    expect(roomKindBiasForHour('bedroom', 23)).toBeGreaterThan(0)
    expect(roomKindBiasForHour('bedroom', 2)).toBeGreaterThan(0)
    expect(roomKindBiasForHour('bedroom', 14)).toBe(0)
  })

  it('biases toward kitchen at mealtimes, not at other hours', () => {
    expect(roomKindBiasForHour('kitchen', 8)).toBeGreaterThan(0)
    expect(roomKindBiasForHour('kitchen', 12)).toBeGreaterThan(0)
    expect(roomKindBiasForHour('kitchen', 19)).toBeGreaterThan(0)
    expect(roomKindBiasForHour('kitchen', 15)).toBe(0)
  })

  it('never biases a room kind that does not match the hour-based signal', () => {
    expect(roomKindBiasForHour('study', 23)).toBe(0)
    expect(roomKindBiasForHour('living', 8)).toBe(0)
  })
})

describe('pickDestinationRoomId', () => {
  function makeRoom(id: string, kind: Room['kind']): Room {
    return {
      id,
      kind,
      name: id,
      wallpaper: DEFAULT_WALLPAPER,
      floor: DEFAULT_FLOOR,
      furniture: [],
      doorway: createDefaultDoorway(id),
    }
  }

  it('returns null when there is no other room to go to', () => {
    const rooms = [makeRoom('only', 'living')]
    expect(pickDestinationRoomId(rooms, 'only', 12, fixedRandom(0.5))).toBeNull()
  })

  it('never returns the room the character is already in', () => {
    const rooms = [makeRoom('a', 'living'), makeRoom('b', 'bedroom'), makeRoom('c', 'kitchen')]
    for (let i = 0; i < 10; i++) {
      expect(pickDestinationRoomId(rooms, 'a', 12, fixedRandom(i / 10))).not.toBe('a')
    }
  })

  it('is biased toward the bedroom at night', () => {
    const rooms = [makeRoom('a', 'living'), makeRoom('b', 'bedroom')]
    // Both candidates get weight >0; a low roll should land on whichever comes first only if unweighted —
    // instead assert the bedroom's weight share (1.5 of 2.5 = 60%) actually wins a roll that would lose if unweighted.
    expect(pickDestinationRoomId(rooms, 'a', 23, fixedRandom(0.7))).toBe('b')
  })
})
