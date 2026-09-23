import { clampFurniturePlacement } from './furniturePlacementEngine'
import { getFurnitureDefinition } from './furnitureCatalog'
import { ROOM_HEIGHT } from './roomLayout'
import type { FurnitureDefinition, FurniturePlacement } from './types'

const GRID_COLUMNS = 4
const GRID_SPACING_X = 140
const GRID_SPACING_Y = 90
// Starts already inside (or close to) the floor's own visual band for most catalog heights, so a freshly-added
// floor piece reads as standing on the floor from the moment it appears, rather than relying entirely on
// clampFurniturePlacement's floor-grounding floor to rescue it after the fact (see furniturePlacementEngine.ts).
const GRID_ORIGIN_Y = 300
const GRID_ORIGIN_X = 110

const WALL_SPACING_X = 130
const WALL_ORIGIN_X = 120
const WALL_COLUMNS = 5
/** The band wall decor starts in — the same height the default window uses. */
const WALL_Y = ROOM_HEIGHT * 0.22

/**
 * Where a freshly added piece first appears. Floor pieces keep the original
 * grid (by how many pieces the room already has); wall pieces (window, clock,
 * mirror, frame, curtain) start in the wall band, spread along it by how many
 * wall pieces are already there so they don't stack. This only picks the
 * *starting* point — the position is stored like any other, so the user can
 * drag or type it anywhere afterwards with no snapping or range limit.
 *
 * Both branches clamp through `clampFurniturePlacement` (not the older,
 * zone-unaware `clampToRoom`) — for a `'floor'`-zone, solid piece this also
 * guarantees the starting position never lands with its bottom edge above
 * the floor's own visual surface (see `furniturePlacementEngine.ts`'s own
 * doc comment for why that's what makes furniture look "떠 있는" against the
 * wall instead of standing on the floor).
 */
export function defaultPlacementPosition(definition: FurnitureDefinition, existing: FurniturePlacement[]): { x: number; y: number } {
  if (definition.zone === 'wall') {
    const wallCount = existing.filter((placement) => getFurnitureDefinition(placement.furnitureId)?.zone === 'wall').length
    return clampFurniturePlacement(definition, WALL_ORIGIN_X + (wallCount % WALL_COLUMNS) * WALL_SPACING_X, WALL_Y, definition.width, definition.height)
  }

  const index = existing.length
  const rawX = GRID_ORIGIN_X + (index % GRID_COLUMNS) * GRID_SPACING_X
  const rawY = GRID_ORIGIN_Y + Math.floor(index / GRID_COLUMNS) * GRID_SPACING_Y
  return clampFurniturePlacement(definition, rawX, rawY, definition.width, definition.height)
}
