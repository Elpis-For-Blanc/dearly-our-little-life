import type { PatternSetting } from './furnitureStyle'

/**
 * How a character can occupy a furniture interaction slot. `'lie'` (added
 * for beds — see CLAUDE.md's "Furniture interaction" phase 3 section) is
 * deliberately its own kind, not reused `'sit'`: the bed's two slots
 * (`bed-left`/`bed-right`) originally shipped as `kind: 'sit'` purely
 * because that was the only slot kind that existed yet when they were
 * authored, before any interaction system consumed them — reclassifying
 * them keeps a bed from being swept into the sofa/chair *sit* flow
 * (different UI, different `characterMovementStore` status) now that both
 * are actually wired up. The slot *offsets themselves* are untouched.
 */
export type InteractionKind = 'sit' | 'stand' | 'lie'

/**
 * A point on a piece of furniture where a character can be placed to
 * interact with it, defined relative to the furniture's own origin (not
 * yet consumed by anything — Phase 3 will resolve these to world
 * coordinates via a placement's x/y/scale/rotation).
 */
export interface FurnitureInteractionSlot {
  id: string
  kind: InteractionKind
  offsetX: number
  offsetY: number
  /** Direction, in radians, a character should face while using this slot. */
  facing: number
}

/**
 * Catalog groups shown in the decorate panel (거실/침실/주방/서재/조명/장식/
 * 창문·러그/수납). `'storage'` was added alongside the furniture-variety
 * expansion phase for pieces whose whole purpose is storage capacity
 * (dresser, low/tall cabinets, console, …) — additive only: every
 * pre-existing piece keeps its original category unchanged (a dresser
 * added the phase before this one is still `'bedroom'`, not retroactively
 * moved), so this never touches already-saved category assumptions.
 */
export type FurnitureCategory = 'living' | 'bedroom' | 'kitchen' | 'study' | 'lighting' | 'decor' | 'windowRug' | 'storage'

/**
 * Where a piece belongs by default: `'wall'` items (window, clock, frame,
 * mirror, curtain) are *placed* on the wall band when added, `'floor'` items
 * on the floor grid. This only chooses the starting position — after that the
 * user can move any piece anywhere in the room, and nothing is snapped or
 * range-limited by it.
 */
export type FurnitureZone = 'floor' | 'wall'

/**
 * What a piece does to walking characters, kept separate from its drawn size.
 * `'none'` never blocks (rug, wall decor, tabletop props). `'solid'` blocks
 * with a rectangle anchored to the *bottom* of the drawn footprint —
 * `footprintHeightRatio` (0-1, default 1) is the fraction of the drawn height
 * that stands on the floor, so a tall wardrobe or fridge blocks only its base
 * instead of its whole height.
 */
export type FurnitureCollision = { mode: 'none' } | { mode: 'solid'; footprintHeightRatio?: number }

/**
 * One selectable shape of a piece (a rug's 타원형/원형/직사각형/하트형). The
 * first variant is the default and matches the definition's own width/height,
 * so a placement with no `variant` (everything saved before variants existed)
 * is exactly the default shape.
 */
export interface FurnitureVariant {
  id: string
  label: string
  width: number
  height: number
}

/** A named part or surface of a piece, as shown in the editing panel. */
export interface StyleTarget {
  id: string
  label: string
}

/** Static catalog entry: what a piece of furniture is and how it can be used. */
export interface FurnitureDefinition {
  /** Stable forever — saved placements and any future shop refer to it. Never rename an existing id. */
  id: string
  name: string
  category: FurnitureCategory
  /** Base logical size, in room units, at scale 1. */
  width: number
  height: number
  minScale: number
  maxScale: number
  zone: FurnitureZone
  collision: FurnitureCollision
  /** Selectable shapes, default first. Absent for pieces with a single shape. */
  variants?: FurnitureVariant[]
  /** The recolorable parts this piece really has, in display order — the editing panel shows exactly these and nothing else. Each id must have a default tone in furnitureStyling.ts. Empty = only the preset colorway. */
  colorParts: StyleTarget[]
  /** The fabric surfaces a pattern can be applied to (never legs, handles or shadows). Empty = no patterns. */
  patternSurfaces: StyleTarget[]
  /** Every piece is free for now; kept as data so a later shop can distinguish paid items without touching existing ids. */
  isFreeDefault: boolean
  interactionSlots: FurnitureInteractionSlot[]
  /**
   * Whether this piece is itself a light fixture (a lamp, a candle, …) —
   * purely descriptive metadata read by its own illustration for a small,
   * matching visual treatment (a soft glow) and by the catalog UI for the
   * "조명" badge; it never feeds `features/lighting/`'s time-of-day room
   * overlay, which stays a single room-wide effect unrelated to any one
   * piece of furniture. Absent (`undefined`) is exactly `false` — every
   * existing catalog entry is unaffected by this field's addition.
   */
  lightSource?: boolean
}

/** One instance of a FurnitureDefinition placed in the room. */
export interface FurniturePlacement {
  id: string
  furnitureId: string
  /** Logical room-space coordinates (see roomLayout.ts) — not raw CSS pixels. */
  x: number
  y: number
  scale: number
  /**
   * The furniture illustrations are drawn front-on, so arbitrary spin would
   * render as a broken-looking image rather than "facing another way".
   * Only 0 and 180 are used, meaning "as drawn" and "mirrored" (rendered via
   * `scaleX(-1)`, not an actual rotation) — kept as degrees for forward
   * compatibility with a future non-front-on art style.
   */
  rotation: 0 | 180
  colorway: string
  layer: number
  /** Chosen shape (one of the definition's `variants`). Absent = the default shape. */
  variant?: string
  /** Per-part color overrides (`partId -> #rrggbb`) on top of `colorway`. Absent until the user recolors a part. */
  colors?: Record<string, string>
  /** Patterns by surface id. Absent until the user adds one. */
  patterns?: Record<string, PatternSetting>
}
