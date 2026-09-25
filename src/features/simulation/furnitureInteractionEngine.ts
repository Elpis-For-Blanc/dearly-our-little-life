import { getFurnitureDefinition, getFurnitureSize } from '../home/furnitureCatalog'
import type { FurnitureDefinition, FurnitureInteractionSlot, FurniturePlacement } from '../home/types'
import { CHARACTER_RADIUS, FURNITURE_APPROACH_CLEARANCE } from './movementConfig'
import { circleIntersectsRect, circlesOverlap, clampToFloorBounds, type Point, type Rect } from './movementEngine'

/**
 * Pure geometry for furniture interaction — resolving a `FurnitureInteractionSlot`
 * (catalog data, relative to the furniture's own origin) to real room-logical
 * world coordinates using a specific placement's x/y/scale/rotation. Nothing
 * here is hardcoded to any one furniture id; every calculation reads the
 * placement/definition it's given, so it works for the sofa today and for
 * any future sittable piece without changes.
 */

/** Every 'sit' slot a definition declares, in catalog order — empty for furniture with none. The 2-seat sofa declares two (`sofa-left`/`sofa-right`), an ordinary chair declares exactly one (`seat`). */
export function getSitSlots(definition: FurnitureDefinition | undefined): FurnitureInteractionSlot[] {
  return definition?.interactionSlots.filter((slot) => slot.kind === 'sit') ?? []
}

/** The first 'sit' slot a definition declares, or undefined if it has none — used wherever "does this furniture have any usable seat at all" is the only question (e.g. `isSittableFurniture`), never to pick *which* seat a character actually reserves (see `furnitureUsageTrigger.ts`'s `startSitting`, which resolves a specific seat via `getSitSlots` instead). */
export function getPrimarySitSlot(definition: FurnitureDefinition | undefined): FurnitureInteractionSlot | undefined {
  return getSitSlots(definition)[0]
}

/** Whether a furniture id currently has at least one usable 'sit' slot. */
export function isSittableFurniture(furnitureId: string): boolean {
  return getPrimarySitSlot(getFurnitureDefinition(furnitureId)) !== undefined
}

/** Every 'lie' slot a definition declares, in catalog order. `bed` and `bed-double` have two; `bed-single` and `canopy-bed` intentionally have one. */
export function getLieSlots(definition: FurnitureDefinition | undefined): FurnitureInteractionSlot[] {
  return definition?.interactionSlots.filter((slot) => slot.kind === 'lie') ?? []
}

export function getPrimaryLieSlot(definition: FurnitureDefinition | undefined): FurnitureInteractionSlot | undefined {
  return getLieSlots(definition)[0]
}

/** A lieable furniture piece may expose at most two usable slots; single-occupant beds simply declare one. */
export const MAX_LIE_OCCUPANTS = 2

/**
 * The lie slots actually offered to a character/the UI/the automatic
 * furniture-use pass: every real lie slot of the piece, up to
 * `MAX_LIE_OCCUPANTS` (2). Each is reserved, occupied and released
 * independently by `furnitureUsageStore.ts` (one character can hold only one
 * slot at a time), so a second character can lie down while the first is
 * already in the bed, and a third is refused once both slots are taken —
 * nothing here (or anywhere) treats "a bed is in use" as a property of the
 * whole piece. This used to return only the first slot (a deliberate,
 * single-occupant phase); `furnitureUsageTrigger.ts`'s `startLyingDown`,
 * `FurnitureUsagePanel.tsx` and `autoFurnitureUseEngine.ts` all read through
 * this one function, so they all changed together.
 */
export function getUsableLieSlots(definition: FurnitureDefinition | undefined): FurnitureInteractionSlot[] {
  return getLieSlots(definition).slice(0, MAX_LIE_OCCUPANTS)
}

/** Whether a furniture id currently has at least one usable 'lie' slot — a bed. */
export function isLieableFurniture(furnitureId: string): boolean {
  return getPrimaryLieSlot(getFurnitureDefinition(furnitureId)) !== undefined
}

/** Every 'stand' slot a definition declares — a table's linger spots (north/south). */
export function getStandSlots(definition: FurnitureDefinition | undefined): FurnitureInteractionSlot[] {
  return definition?.interactionSlots.filter((slot) => slot.kind === 'stand') ?? []
}

/** Whether a furniture id currently has at least one usable 'stand' slot — a table. */
export function isLingerableFurniture(furnitureId: string): boolean {
  return getStandSlots(getFurnitureDefinition(furnitureId)).length > 0
}

/** Whether a furniture id has any usable interaction slot at all (sit, lie, or stand) — the one check the Live-screen click affordance uses to decide a piece is worth selecting. */
export function isInteractableFurniture(furnitureId: string): boolean {
  return isSittableFurniture(furnitureId) || isLieableFurniture(furnitureId) || isLingerableFurniture(furnitureId)
}

/**
 * A slot's seat position in world coordinates. A mirrored placement
 * (`rotation: 180`, rendered as `scaleX(-1)`) flips the slot's X offset to
 * match — the same reflection `FurnitureItem`/`LiveRoomView` already apply
 * visually — so the seat always lands on the drawn cushion, mirrored or not.
 */
export function resolveSeatPosition(placement: FurniturePlacement, slot: FurnitureInteractionSlot): Point {
  const mirror = placement.rotation === 180 ? -1 : 1
  return {
    x: placement.x + slot.offsetX * placement.scale * mirror,
    y: placement.y + slot.offsetY * placement.scale,
  }
}

/** The direction a character faces while using this slot, reflected the same way the seat position is for a mirrored placement (`π - facing` mirrors a direction vector across the vertical axis, matching `scaleX(-1)`). */
export function resolveSeatFacing(placement: FurniturePlacement, slot: FurnitureInteractionSlot): number {
  return placement.rotation === 180 ? Math.PI - slot.facing : slot.facing
}

/**
 * The full extent of the same solid collision rect `furnitureObstacles`
 * (movementEngine.ts) computes for this placement — its bottom edge is
 * exactly where the solid, unwalkable area ends and the open floor begins
 * vertically, regardless of `footprintHeightRatio` (which only ever narrows
 * the *height*; the rect always spans the piece's *full* drawn width).
 * Shared by `resolveApproachPoint` and `resolveWalkDestination`'s stand-slot
 * fallback so both agree on where this piece's real footprint is.
 */
function footprintRect(placement: FurniturePlacement, definition: FurnitureDefinition): { left: number; right: number; top: number; bottom: number } {
  const size = getFurnitureSize(definition, placement.variant)
  const width = size.width * placement.scale
  const height = size.height * placement.scale
  const ratio = definition.collision.mode === 'solid' ? (definition.collision.footprintHeightRatio ?? 1) : 1
  const bottom = placement.y + height / 2
  return { left: placement.x - width / 2, right: placement.x + width / 2, top: bottom - height * ratio, bottom }
}

/**
 * Where a character walks to — via the ordinary collision-checked movement
 * engine, never a shortcut — before occupying a 'sit' or 'lie' slot. Always
 * outside the furniture's own solid collision rect, on the open floor
 * directly in front of the slot, so the walk there is genuine, failable
 * movement, not a disguised teleport. Clamped to the room's walkable floor
 * bounds, same as every other movement destination. Never used for a
 * 'stand' slot — see `resolveWalkDestination` below for why.
 */
export function resolveApproachPoint(placement: FurniturePlacement, definition: FurnitureDefinition, slot: FurnitureInteractionSlot): Point {
  const seat = resolveSeatPosition(placement, slot)
  const { bottom } = footprintRect(placement, definition)
  const y = Math.max(seat.y, bottom) + FURNITURE_APPROACH_CLEARANCE
  return clampToFloorBounds(seat.x, y, CHARACTER_RADIUS)
}

export interface StandDestination {
  point: Point
  /**
   * False when this slot's position, even after clamping to the room's
   * floor bounds, still can't be resolved to a point genuinely outside the
   * placement's own footprint — a real, reachable-through-the-decorate-UI
   * case: a table's own `tableSideSlots` offset is defined as exactly
   * "half the piece's own width + the standard clearance margin"
   * (`FURNITURE_APPROACH_CLEARANCE`), so at the room's own left/right edge
   * (where `clampToRoom` already lets a user push a table's *center* to
   * within one half-width of the wall) there is *no* point left between the
   * wall and the table's far edge for a character to stand at all — pushing
   * "further out" just re-clamps back to the same wall-adjacent boundary,
   * which is still inside the footprint. This isn't a bug to paper over
   * with a fake position; `FurnitureUsagePanel.tsx` treats `false` here the
   * same as "blocked by another obstacle" (CLAUDE.md's "접근 지점이 벽...과
   * 충돌하면 사용할 수 없는 지점으로 처리" requirement) — refuses to offer
   * the slot at all and explains why, rather than sending a character on an
   * impossible walk into the furniture it's meant to stand beside.
   */
  clearOfFootprint: boolean
}

/**
 * The single destination a character walks to for a 'stand' slot (a
 * table's left/right linger spot) — already drawn *outside* the furniture's
 * footprint by design (see `tableSideSlots` in furnitureCatalog.ts), so
 * there's normally no separate approach-vs-final-position split the way
 * 'sit'/'lie' need (see `resolveApproachPoint`): the character just walks
 * straight to it through the ordinary, fully collision-checked path.
 *
 * The raw position is still clamped to the room's floor bounds like every
 * other destination — see `StandDestination.clearOfFootprint`'s own doc
 * comment for what it means, and why, when clamping pulls the point back
 * inside the furniture's own footprint, this honestly reports that instead
 * of returning a position that would visually overlap the table.
 */
export function resolveStandDestination(placement: FurniturePlacement, definition: FurnitureDefinition, slot: FurnitureInteractionSlot): StandDestination {
  const raw = resolveSeatPosition(placement, slot)
  const clamped = clampToFloorBounds(raw.x, raw.y, CHARACTER_RADIUS)
  const { left, right, top, bottom } = footprintRect(placement, definition)
  const insideX = clamped.x > left - CHARACTER_RADIUS && clamped.x < right + CHARACTER_RADIUS
  const insideY = clamped.y > top - CHARACTER_RADIUS && clamped.y < bottom + CHARACTER_RADIUS
  return { point: clamped, clearOfFootprint: !(insideX && insideY) }
}

/**
 * The single destination a character walks to for *any* interaction kind —
 * for 'stand', this is `resolveStandDestination(...).point` even when
 * `clearOfFootprint` is false (movement itself has no notion of "refuse to
 * go" — see that field's own doc comment for who actually acts on it: the
 * UI, by not offering the slot in the first place). Every other kind
 * ('sit'/'lie') defers to `resolveApproachPoint`, unchanged.
 */
export function resolveWalkDestination(placement: FurniturePlacement, definition: FurnitureDefinition, slot: FurnitureInteractionSlot): Point {
  if (slot.kind !== 'stand') return resolveApproachPoint(placement, definition, slot)
  return resolveStandDestination(placement, definition, slot).point
}

/**
 * Whether a would-be walk destination is currently blocked by another piece
 * of furniture or another character standing right there — the proactive
 * check `FurnitureUsagePanel.tsx` uses to mark a table's left/right spot
 * "사용할 수 없는 지점" and explain why *before* the user tries, rather than
 * only discovering it via the movement engine's own retry/timeout handling
 * once they've already committed to walking there. `obstacles` should
 * exclude the placement the slot itself belongs to (its own footprint is
 * already accounted for by `resolveWalkDestination`), and `otherPositions`
 * is every other character's current position in the same room.
 */
export function isWalkDestinationBlocked(destination: Point, obstacles: Rect[], otherPositions: Point[], radius: number = CHARACTER_RADIUS): boolean {
  return obstacles.some((rect) => circleIntersectsRect(destination.x, destination.y, radius, rect)) || otherPositions.some((p) => circlesOverlap(destination.x, destination.y, radius, p.x, p.y, radius))
}
