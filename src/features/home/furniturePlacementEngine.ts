import { FLOOR_HEIGHT_RATIO, ROOM_HEIGHT, ROOM_WIDTH } from './roomLayout'
import type { FurnitureDefinition } from './types'

/**
 * The one shared placement pipeline every furniture-positioning path in the
 * app goes through — manual drag (`FurnitureItem.tsx`), the properties
 * panel's X/Y/scale/variant controls (`FurniturePropertiesPanel.tsx`), the
 * catalog's initial-placement grid (`placementDefaults.ts`), and decor
 * preset resolution (`decorPresetEngine.ts`). Before this module existed,
 * every one of those computed its own clamp via `roomLayout.ts`'s
 * `clampToRoom`, which only ever bounded a placement to the room's *outer*
 * edges — it never distinguished "this piece is meant to stand on the
 * floor" from "this piece is meant to hang on the wall", so a floor piece
 * placed (or, for presets, authored) with too small a Y would render with
 * its own ground-contact shadow/legs up in the *wall* visual band, with no
 * floor surface under it at all — reads exactly like furniture floating in
 * mid-air. This was the actual root cause of the room-decor-preset "가구가
 * 벽에 떠 있는 것처럼 보이는" bug: several preset entries had a Y well above
 * where their own drawn height could ever put their bottom edge on the
 * floor. It equally affects manual placement (dragging a sofa up near the
 * ceiling looks exactly the same way) — this fixes that path too, per the
 * spec's own "수동 배치와 프리셋 적용이 동일한 좌표·표면·경계 규칙을
 * 사용하도록" requirement, not just presets.
 */

/**
 * Top edge (room-logical Y) of the floor's own visual band — the exact
 * same formula `roomLayout.ts`'s `FLOOR_HEIGHT_RATIO` and
 * `movementConfig.ts`'s `FLOOR_TOP_Y` (character-walking floor top) already
 * derive, recomputed here so this module doesn't need to import a
 * React-rendering file or the simulation layer (`home` must never depend on
 * `simulation`, only the reverse). All three stay in lockstep because
 * they're all the same formula, not because one imports another.
 */
export const FLOOR_SURFACE_TOP_Y = ROOM_HEIGHT * (1 - FLOOR_HEIGHT_RATIO)

/**
 * Whether a piece needs its *bottom edge* kept on the floor's own visual
 * surface at all. Only real, floor-standing, solid furniture does — a
 * `'wall'`-zone piece (window, frame, wall-clock, curtain, floor-mirror)
 * keeps CLAUDE.md's already-established, deliberate "moves freely anywhere
 * after its initial placement, no snapping or range limit" behavior,
 * unchanged. A `'floor'`-zone piece with `collision: {mode: 'none'}` (a
 * tabletop prop like a mug, vase, book stack, table lamp, or a doll) is
 * *also* exempt — these are routinely placed resting on top of another
 * piece of furniture (a mug on a table, a vase on a shelf), at whatever
 * height that surface happens to be, which is a legitimate, higher-than-
 * -the-floor position by design, not a bug. Only a piece that actually
 * stands on the floor with real physical footprint (`collision.mode ===
 * 'solid'`) needs this constraint.
 */
function needsFloorGrounding(definition: FurnitureDefinition | undefined): boolean {
  return definition?.zone === 'floor' && definition?.collision.mode === 'solid'
}

/**
 * The minimum center-Y a floor-grounded piece of `height` (its own drawn
 * height, already multiplied by its placement `scale`) may have without its
 * *bottom edge* (`y + height / 2` — the exact same bottom every furniture
 * illustration grounds its shadow/legs against; see
 * `furnitureInteractionEngine.ts`'s `footprintRect` and
 * `movementEngine.ts`'s `furnitureObstacles`, both of which already use
 * this same `y + height / 2` formula) rising above the floor's own visual
 * top edge. A piece taller than the floor band itself is only bounded by
 * not extending above the room's own top edge (`y >= height / 2`) — its
 * *top* legitimately reaching up into the wall band (a tall wardrobe's top
 * near the ceiling, its base on the floor) is normal and untouched by this
 * rule; only the bottom matters.
 */
export function floorFurnitureMinY(height: number): number {
  return Math.max(height / 2, FLOOR_SURFACE_TOP_Y - height / 2)
}

export interface PlacementBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/**
 * The valid coordinate range a placement's *center* point may occupy —
 * every clamping call site goes through this so they can never disagree.
 * Zone/collision-aware per `needsFloorGrounding`'s own doc comment; a piece
 * with no real `definition` at all (an id no longer in the catalog) falls
 * back to the original, unrestricted room-bounds behavior, same as before
 * this module existed.
 */
export function placementBounds(definition: FurnitureDefinition | undefined, effectiveWidth: number, effectiveHeight: number): PlacementBounds {
  const halfW = effectiveWidth / 2
  const halfH = effectiveHeight / 2
  const maxY = ROOM_HEIGHT - halfH
  const floorMinY = needsFloorGrounding(definition) ? floorFurnitureMinY(effectiveHeight) : halfH
  // Defensive: a piece whose own base size could never fit inside the room at all (larger than ROOM_HEIGHT) would
  // otherwise produce an inverted (minY > maxY) range — never let the floor-grounding floor exceed the room's own
  // ceiling. Not reachable by any real catalog entry today (checked by furniturePlacementEngine.test.ts), but this
  // keeps the function itself honest rather than relying on every caller to know that.
  const minY = Math.min(floorMinY, maxY)
  return { minX: halfW, maxX: ROOM_WIDTH - halfW, minY, maxY }
}

/**
 * Clamps a placement's requested center point into its own valid range
 * (see `placementBounds`) — the furniture-placement equivalent of
 * `roomLayout.ts`'s `clampToRoom`, now zone/collision-aware. Every
 * placement call site with access to the piece's `FurnitureDefinition`
 * should use this instead of calling `clampToRoom` directly.
 */
export function clampFurniturePlacement(
  definition: FurnitureDefinition | undefined,
  x: number,
  y: number,
  effectiveWidth: number,
  effectiveHeight: number,
): { x: number; y: number } {
  const bounds = placementBounds(definition, effectiveWidth, effectiveHeight)
  return {
    x: Math.min(Math.max(x, bounds.minX), bounds.maxX),
    y: Math.min(Math.max(y, bounds.minY), bounds.maxY),
  }
}

/**
 * Whether `x`/`y` is already exactly its own clamped position — i.e.
 * placing this piece here needs *no* adjustment at all. Used by
 * `decorPresetEngine.ts`'s `validateDecorPreset` to refuse a preset entry
 * outright (never silently relocate it) if its authored coordinates would
 * ever need correction — see that function's own doc comment for why a
 * silent auto-reposition is never an acceptable outcome for the six
 * built-in presets.
 */
export function isPlacementWithinBounds(definition: FurnitureDefinition | undefined, x: number, y: number, effectiveWidth: number, effectiveHeight: number): boolean {
  const clamped = clampFurniturePlacement(definition, x, y, effectiveWidth, effectiveHeight)
  const EPSILON = 0.01
  return Math.abs(clamped.x - x) < EPSILON && Math.abs(clamped.y - y) < EPSILON
}
