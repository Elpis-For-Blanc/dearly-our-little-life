/**
 * Character sprite base display height, in the same room-logical units as
 * furniture (roomLayout.ts) — NOT raw CSS pixels. The room itself is never
 * rendered at a fixed pixel size (it scales via CSS `aspect-ratio` to
 * whatever width its container gets), so a literal "120px" would look
 * correct only at one specific viewport width and distort at every other
 * one — exactly the bug the furniture system's logical-unit convention
 * (see CLAUDE.md) already exists to avoid. 120 logical units puts a
 * character roughly bed-height (144) scale, i.e. genuinely "standing in
 * the room" rather than a small icon.
 */
export const BASE_CHARACTER_HEIGHT = 120

/** Flat ground-contact shadow sized relative to the sprite's own rendered height, same idea as furniture's contact shadow — small, thin, and centered right on the foot point (0 built-in distance; any visible gap is the uploaded PNG's own transparent padding, corrected per-character via footOffsetRatio, not by moving the shadow). */
export const SHADOW_WIDTH_RATIO = 0.42
export const SHADOW_HEIGHT_RATIO = 0.1
