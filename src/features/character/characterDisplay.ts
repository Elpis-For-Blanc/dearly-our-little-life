import type { CharacterImageBounds } from './characterImageAnalysis'

/** Per-character sprite size multiplier — 1 = the base display height (see BASE_CHARACTER_HEIGHT in the simulation feature). */
export const DEFAULT_DISPLAY_SCALE = 1
export const MIN_DISPLAY_SCALE = 0.5
export const MAX_DISPLAY_SCALE = 2

export function clampDisplayScale(scale: number): number {
  if (Number.isNaN(scale)) return DEFAULT_DISPLAY_SCALE
  return Math.min(MAX_DISPLAY_SCALE, Math.max(MIN_DISPLAY_SCALE, scale))
}

/**
 * Per-character correction for transparent padding under a character's real
 * feet in their uploaded PNG — a fraction of the sprite's own *rendered*
 * height, not a fixed logical-unit amount, so it keeps working correctly
 * when `displayScale` changes. Positive shifts the sprite down (use this
 * when the character looks like it's floating above its shadow because the
 * image has empty space below the feet); negative shifts it up.
 */
export const DEFAULT_FOOT_OFFSET_RATIO = 0
export const MIN_FOOT_OFFSET_RATIO = -0.3
export const MAX_FOOT_OFFSET_RATIO = 0.3

export function clampFootOffsetRatio(ratio: number): number {
  if (Number.isNaN(ratio)) return DEFAULT_FOOT_OFFSET_RATIO
  return Math.min(MAX_FOOT_OFFSET_RATIO, Math.max(MIN_FOOT_OFFSET_RATIO, ratio))
}

/**
 * A detected bbox covering less than this fraction of the image's height is
 * treated as unreliable (avoids an absurdly blown-up sprite from a
 * near-fully-transparent or mis-detected image) — the real image is instead
 * rendered at its full, uncorrected height, same as `bounds: null`.
 */
const MIN_EFFECTIVE_HEIGHT_RATIO = 0.05

export interface CharacterDisplayGeometry {
  /** The full uploaded image's rendered height (including any transparent padding), in room-logical units — already folds in `displayScale` and the bbox-based "real size" auto-correction. This is what the `<img>` element's own CSS height should be set to. */
  renderedImageHeightUnits: number
  /** Combined auto (compensates transparent padding below the feet) + manual (`footOffsetRatio`) offset for the sprite's own `top`, in room-logical units — 0 means the image's own bottom edge already sits exactly on the ground point. */
  footOffsetUnits: number
  /** Offset for the speech bubble, anchored to the real drawn character's top edge (not the image file's own top edge, which may be mostly transparent padding). */
  bubbleOffsetUnits: number
}

/**
 * Turns a character's display settings + (optional) detected image bounds
 * into the concrete numbers `CharacterToken.tsx` renders with. With
 * `bounds: null` (never analyzed, or analysis failed) this reduces exactly
 * to the pre-analysis behavior — the full image is treated as the
 * character, and `footOffsetRatio` is the only correction applied — so
 * existing characters' saved sizing/offset never changes just because this
 * feature shipped.
 *
 * `baseHeight`/`displayScale` together are also what shadow sizing should
 * key off (`renderedImageHeightUnits` is deliberately NOT used for that) —
 * the shadow represents the character's real physical footprint, which
 * shouldn't grow just because their uploaded PNG happens to have a lot of
 * transparent padding around a small drawing.
 */
export function computeCharacterDisplayGeometry(
  baseHeight: number,
  displayScale: number,
  footOffsetRatio: number,
  bounds: CharacterImageBounds | null,
): CharacterDisplayGeometry {
  const topRatio = bounds?.topRatio ?? 0
  const bottomRatio = bounds?.bottomRatio ?? 1
  const effectiveHeightRatio = Math.max(MIN_EFFECTIVE_HEIGHT_RATIO, bottomRatio - topRatio)

  const renderedImageHeightUnits = (baseHeight / effectiveHeightRatio) * displayScale
  const autoFootOffsetUnits = renderedImageHeightUnits * (1 - bottomRatio)
  const manualFootOffsetUnits = renderedImageHeightUnits * footOffsetRatio
  const footOffsetUnits = autoFootOffsetUnits + manualFootOffsetUnits

  const opaqueHeightUnits = renderedImageHeightUnits * (bottomRatio - topRatio)
  const bubbleOffsetUnits = footOffsetUnits - opaqueHeightUnits

  return { renderedImageHeightUnits, footOffsetUnits, bubbleOffsetUnits }
}
