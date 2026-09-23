import { behaviorWeightFor, type BehaviorType } from '../character/personalityTags'
import { getFurnitureDefinition, getFurnitureSize } from '../home/furnitureCatalog'
import { ROOM_HEIGHT, ROOM_WIDTH } from '../home/roomLayout'
import type { Room, RoomKind } from '../home/roomTypes'
import type { FurniturePlacement } from '../home/types'
import { CHARACTER_RADIUS, ENCOUNTER_DISTANCE, FLOOR_TOP_Y, MAX_DESTINATION_ATTEMPTS } from './movementConfig'

export interface Point {
  x: number
  y: number
}

export interface Rect {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/**
 * Furniture obstacle rects for collision, driven by each definition's own
 * `collision` (types.ts) rather than any per-id exception: a rug, wall decor
 * and tabletop props declare `mode: 'none'` and never block; a solid piece
 * blocks a rectangle anchored to the *bottom* of its drawn footprint
 * (`footprintHeightRatio`), so a tall wardrobe or fridge blocks its base, not
 * its whole height. A placement whose id is no longer in the catalog keeps the
 * old behavior (a full 60x60 solid block) so a stale save can't silently open
 * a hole in a room's walls.
 */
export function furnitureObstacles(furniture: FurniturePlacement[]): Rect[] {
  const rects: Rect[] = []
  for (const placement of furniture) {
    const definition = getFurnitureDefinition(placement.furnitureId)
    if (definition?.collision.mode === 'none') continue

    const size = getFurnitureSize(definition, placement.variant)
    const width = size.width * placement.scale
    const height = size.height * placement.scale
    const ratio = definition?.collision.mode === 'solid' ? (definition.collision.footprintHeightRatio ?? 1) : 1
    const footprintHeight = height * ratio
    const bottom = placement.y + height / 2
    rects.push({
      minX: placement.x - width / 2,
      maxX: placement.x + width / 2,
      minY: bottom - footprintHeight,
      maxY: bottom,
    })
  }
  return rects
}

export function circleIntersectsRect(cx: number, cy: number, radius: number, rect: Rect): boolean {
  const closestX = Math.min(Math.max(cx, rect.minX), rect.maxX)
  const closestY = Math.min(Math.max(cy, rect.minY), rect.maxY)
  const dx = cx - closestX
  const dy = cy - closestY
  return dx * dx + dy * dy < radius * radius
}

export function circlesOverlap(ax: number, ay: number, aRadius: number, bx: number, by: number, bRadius: number): boolean {
  const dx = ax - bx
  const dy = ay - by
  const minDistance = aRadius + bRadius
  return dx * dx + dy * dy < minDistance * minDistance
}

export function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function isBlocked(x: number, y: number, radius: number, obstacles: Rect[], otherPositions: Point[]): boolean {
  return (
    obstacles.some((rect) => circleIntersectsRect(x, y, radius, rect)) ||
    otherPositions.some((p) => circlesOverlap(x, y, radius, p.x, p.y, radius))
  )
}

function floorBounds(radius: number) {
  return { minX: radius, maxX: ROOM_WIDTH - radius, minY: FLOOR_TOP_Y + radius, maxY: ROOM_HEIGHT - radius }
}

/** Exported so other modules that need a walkable-space point (e.g. furnitureInteractionEngine.ts's approach point) clamp against the exact same floor bounds movement itself uses, rather than duplicating the math. */
export function clampToFloorBounds(x: number, y: number, radius: number): Point {
  const bounds = floorBounds(radius)
  return {
    x: Math.min(Math.max(x, bounds.minX), bounds.maxX),
    y: Math.min(Math.max(y, bounds.minY), bounds.maxY),
  }
}

/**
 * Random point on the walkable floor that doesn't overlap furniture or
 * another character. Retries up to MAX_DESTINATION_ATTEMPTS times, then
 * falls back to the floor's center — this is a simple retry-based avoidance,
 * not real pathfinding, and is disclosed as such in CLAUDE.md.
 */
export function pickRandomDestination(
  obstacles: Rect[],
  otherPositions: Point[],
  radius: number = CHARACTER_RADIUS,
  random: () => number = Math.random,
): Point {
  const { minX, maxX, minY, maxY } = floorBounds(radius)

  for (let attempt = 0; attempt < MAX_DESTINATION_ATTEMPTS; attempt++) {
    const x = minX + random() * (maxX - minX)
    const y = minY + random() * (maxY - minY)
    if (!isBlocked(x, y, radius, obstacles, otherPositions)) return { x, y }
  }

  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
}

/**
 * "사교적" behavior: aims near a random other character (offset at roughly
 * ENCOUNTER_DISTANCE so they end up close without landing exactly on top of
 * each other) rather than a fully random point. Falls back to a plain
 * random destination if there's no one else to approach.
 */
export function pickApproachDestination(
  otherPositions: Point[],
  obstacles: Rect[],
  radius: number = CHARACTER_RADIUS,
  random: () => number = Math.random,
): Point {
  if (otherPositions.length === 0) return pickRandomDestination(obstacles, otherPositions, radius, random)

  const target = otherPositions[Math.floor(random() * otherPositions.length)]
  const angle = random() * Math.PI * 2
  const approachDistance = ENCOUNTER_DISTANCE * 0.6
  const point = clampToFloorBounds(target.x + Math.cos(angle) * approachDistance, target.y + Math.sin(angle) * approachDistance, radius)

  return isBlocked(point.x, point.y, radius, obstacles, []) ? pickRandomDestination(obstacles, otherPositions, radius, random) : point
}

/**
 * "내향적" behavior: tries several candidate points and keeps the one
 * farthest from every other character (still avoiding furniture). Falls
 * back to a plain random destination if there's no one to keep distance
 * from, or if every candidate is blocked.
 */
export function pickSeekSolitudeDestination(
  otherPositions: Point[],
  obstacles: Rect[],
  radius: number = CHARACTER_RADIUS,
  random: () => number = Math.random,
): Point {
  if (otherPositions.length === 0) return pickRandomDestination(obstacles, otherPositions, radius, random)

  const { minX, maxX, minY, maxY } = floorBounds(radius)
  let best: Point | null = null
  let bestMinDistance = -Infinity

  for (let attempt = 0; attempt < MAX_DESTINATION_ATTEMPTS; attempt++) {
    const x = minX + random() * (maxX - minX)
    const y = minY + random() * (maxY - minY)
    if (obstacles.some((rect) => circleIntersectsRect(x, y, radius, rect))) continue

    const minDistance = Math.min(...otherPositions.map((p) => distanceBetween({ x, y }, p)))
    if (minDistance > bestMinDistance) {
      bestMinDistance = minDistance
      best = { x, y }
    }
  }

  return best ?? pickRandomDestination(obstacles, otherPositions, radius, random)
}

const BEHAVIOR_TYPES: BehaviorType[] = ['wander', 'rest', 'approach', 'seekSolitude']
const BEHAVIOR_TYPES_WITH_ROOM_CHANGE: BehaviorType[] = [...BEHAVIOR_TYPES, 'changeRoom']

/**
 * `changeRoom` gets a lower starting rate than the other four so a character
 * doesn't restlessly bounce between rooms every time it picks a new
 * destination — personality tags (see personalityTags.ts's `OVERRIDES`) then
 * push this up or down per character on top of this shared base.
 */
const BEHAVIOR_BASE_WEIGHT: Partial<Record<BehaviorType, number>> = { changeRoom: 0.35 }

function baseWeightFor(behavior: BehaviorType): number {
  return BEHAVIOR_BASE_WEIGHT[behavior] ?? 1
}

/**
 * Personality-weighted pick of which behavior a character adopts the next
 * time it needs a new destination (on arrival or when blocked). A character
 * with no relevant tags gets equal (weight-1) odds on the four in-room
 * behaviors — see personalityTags.ts's `behaviorWeightFor` for which tags
 * actually bias this. `canChangeRoom` gates `changeRoom` out entirely
 * (weight 0, never picked) when there's nowhere else to go, i.e. only one
 * room exists — set it to `rooms.length > 1`.
 */
export function pickBehavior(
  personalityTagIds: string[],
  canChangeRoom: boolean,
  random: () => number = Math.random,
): BehaviorType {
  const behaviors = canChangeRoom ? BEHAVIOR_TYPES_WITH_ROOM_CHANGE : BEHAVIOR_TYPES
  const weights = behaviors.map((behavior) => behaviorWeightFor(personalityTagIds, behavior) * baseWeightFor(behavior))
  const total = weights.reduce((sum, w) => sum + w, 0)
  let roll = random() * total
  for (let i = 0; i < behaviors.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return behaviors[i]
  }
  return behaviors[behaviors.length - 1]
}

/**
 * Real-clock-hour bias toward a room kind — the same "honest simplification"
 * pattern as autoDialogueEngine.ts's `isTimeOfDayEligible`: there's no
 * in-game clock or tracked "available furniture" signal to reason about
 * "적절한 시간대/사용 가능한 가구" with, so this uses the one genuine
 * real-world signal available (the current hour) rather than faking a
 * richer decision. Additive bonus, not a hard filter — every room kind
 * stays reachable, just more or less likely.
 */
export function roomKindBiasForHour(kind: RoomKind, hour: number): number {
  const isNight = hour >= 21 || hour <= 5
  const isMealtime = (hour >= 7 && hour <= 9) || (hour >= 12 && hour <= 13) || (hour >= 18 && hour <= 20)
  if (isNight && kind === 'bedroom') return 1.5
  if (isMealtime && kind === 'kitchen') return 1.5
  return 0
}

/**
 * Weighted pick of which room a character moves to next, biased by
 * `roomKindBiasForHour` and otherwise uniform across every other room
 * (never the room the character is already in). Returns `null` if there's
 * no other room to move to.
 */
export function pickDestinationRoomId(
  rooms: Room[],
  currentRoomId: string,
  hour: number,
  random: () => number = Math.random,
): string | null {
  const candidates = rooms.filter((room) => room.id !== currentRoomId)
  if (candidates.length === 0) return null

  const weights = candidates.map((room) => 1 + roomKindBiasForHour(room.kind, hour))
  const total = weights.reduce((sum, w) => sum + w, 0)
  let roll = random() * total
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return candidates[i].id
  }
  return candidates[candidates.length - 1].id
}

/** How many nearby points to try before giving up and using the doorway position exactly as-is (see `pickDoorwayArrivalPosition`). */
const DOORWAY_ARRIVAL_ATTEMPTS = 8
/** How far from the doorway an arrival jitter point may land — small, so a character still visibly appears "at the doorway", not teleported across the room. */
const DOORWAY_ARRIVAL_JITTER_RADIUS = CHARACTER_RADIUS * 3

/**
 * Every room's doorway sits at the exact same fixed logical coordinate
 * (`createDefaultDoorway`), so two characters can genuinely end up stacked
 * exactly on top of each other there — one already idling at the doorway,
 * another arriving via a room change. Landing a second character exactly on
 * the first is what causes the movement deadlock `MAX_STUCK_TICKS` exists to
 * recover from (CHARACTER_RADIUS*2 > MOVE_SPEED_PER_TICK, so neither could
 * ever complete a first step away). This reduces how often that recovery
 * path is even needed: if the doorway point itself is currently blocked by
 * another character or furniture, nudge the arrival point a short distance
 * away instead — still "at the doorway" in spirit, just not exactly
 * overlapping. Falls back to the doorway position itself if every jittered
 * candidate is also blocked; `MAX_STUCK_TICKS` is the guaranteed backstop
 * either way, so this never needs to be perfect.
 */
export function pickDoorwayArrivalPosition(
  doorwayPosition: Point,
  obstacles: Rect[],
  otherPositions: Point[],
  radius: number = CHARACTER_RADIUS,
  random: () => number = Math.random,
): Point {
  if (!isBlocked(doorwayPosition.x, doorwayPosition.y, radius, obstacles, otherPositions)) return doorwayPosition

  for (let attempt = 0; attempt < DOORWAY_ARRIVAL_ATTEMPTS; attempt++) {
    const angle = random() * Math.PI * 2
    const distance = radius * 1.5 + random() * (DOORWAY_ARRIVAL_JITTER_RADIUS - radius * 1.5)
    const candidate = clampToFloorBounds(doorwayPosition.x + Math.cos(angle) * distance, doorwayPosition.y + Math.sin(angle) * distance, radius)
    if (!isBlocked(candidate.x, candidate.y, radius, obstacles, otherPositions)) return candidate
  }

  return doorwayPosition
}

/** Moves `pos` toward `destination` by at most `speed` units, landing exactly on it rather than overshooting. */
export function stepToward(pos: Point, destination: Point, speed: number): Point {
  const dx = destination.x - pos.x
  const dy = destination.y - pos.y
  const distance = Math.hypot(dx, dy)
  if (distance <= speed || distance === 0) return { x: destination.x, y: destination.y }

  const ratio = speed / distance
  return { x: pos.x + dx * ratio, y: pos.y + dy * ratio }
}

export function hasArrived(pos: Point, destination: Point, epsilon = 0.5): boolean {
  return distanceBetween(pos, destination) <= epsilon
}

/** Whether stepping to `next` would collide with furniture or another character (excluding the mover itself). */
export function wouldCollide(
  next: Point,
  radius: number,
  obstacles: Rect[],
  otherPositions: Point[],
): boolean {
  return isBlocked(next.x, next.y, radius, obstacles, otherPositions)
}
