import type { FurnitureStyle, PatternSetting } from '../furnitureStyle'

/** A pattern applied to one named fabric surface of one placed piece. */
export interface SurfacePattern {
  /** Unique across the whole document: the owning piece's `idPrefix` plus the surface name. */
  id: string
  setting: PatternSetting
  /** Multiplies the tile size chosen by `setting.size` — 1 for ordinary fabric, larger for big surfaces like a rug so the motif reads at the surface's scale. */
  tileScale: number
}

export function surfacePattern(surface: string, style?: FurnitureStyle, tileScale = 1): SurfacePattern | null {
  const setting = style?.patterns?.[surface]
  if (!style || !setting) return null
  return { id: `${style.idPrefix}-${surface}`, setting, tileScale }
}

/** The `fill` to give the surface's shapes, or `undefined` to keep the part's plain color. Only shapes that *are* the fabric get this — legs, handles and shadows never do. */
export function patternFill(pattern: SurfacePattern | null): string | undefined {
  return pattern ? `url(#${pattern.id})` : undefined
}
