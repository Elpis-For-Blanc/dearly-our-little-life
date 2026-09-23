/** Shared pastel tokens so every furniture illustration reads as one consistent style. */
export const FURNITURE_PALETTE = {
  pink: { fill: '#F7C6D9', stroke: '#E39CB8' },
  pinkDeep: { fill: '#F2A9C6', stroke: '#D97FA6' },
  cream: { fill: '#FBF3E4', stroke: '#E8D9BB' },
  lavender: { fill: '#DED2F2', stroke: '#B9A4DD' },
  sky: { fill: '#CFE8F7', stroke: '#9CC7E0' },
  taupe: { fill: '#E1CBA8', stroke: '#C2A374' },
  terracotta: { fill: '#F0BBA0', stroke: '#D89676' },
  leaf: { fill: '#BFDDA9', stroke: '#96BE7C' },
  leafDeep: { fill: '#A8CD8E', stroke: '#82A968' },
  ivory: { fill: '#FFFCF6', stroke: '#EDE3CE' },
  mint: { fill: '#CDEBDD', stroke: '#9FCBB6' },
  butter: { fill: '#FBEBA6', stroke: '#E3CC72' },
  /** Cool neutrals for screens, glass and appliances — kept pastel, never pure black/white. */
  slate: { fill: '#6F7688', stroke: '#565C6D' },
  glass: { fill: '#DCEFF8', stroke: '#B4D6E6' },
  metal: { fill: '#E9E6EE', stroke: '#C4BFCF' },
  /** A bright, subtly warm off-white for ceramic/porcelain pieces (vases, mugs, lamp bases) — distinct from `ivory` (fabric/paper) and `metal` (cool, gray-toned) so the three read as genuinely different materials side by side. */
  ceramic: { fill: '#F6F1E8', stroke: '#D8CDB8' },
  /** Tight, directly under the actual ground-contact point (leg bottoms, frame edge, pot base). */
  shadowContact: 'rgba(94, 72, 51, 0.24)',
  /** Soft, wide halo beneath the whole footprint — barely visible, never competes with the furniture itself. */
  shadowAmbient: 'rgba(94, 72, 51, 0.08)',
} as const

export type PaletteTone = { fill: string; stroke: string }

/**
 * Named material groups every illustration should reach for when choosing a
 * part's tone, so "wood legs", "fabric cushions", "glass tops", "metal
 * handles" and "ceramic bases" read consistently across every piece in the
 * catalog rather than each illustration inventing its own mapping. This is
 * a *naming* layer over tones that mostly already existed (`P.taupe` was
 * already every wooden leg's tone, `P.metal`/`P.glass` already existed) —
 * `ceramic` above is the one genuinely new tone this introduces. Never a
 * texture image (per the spec's own "실제 텍스처 이미지를 무리하게 추가하지
 * 말고") — material distinction here is entirely tone + `SurfaceSheen`
 * presence: fabric surfaces (sofa cushions, chair seats, bed blankets) stay
 * matte (no sheen, or the softer opacity already used), while
 * glass/metal/ceramic surfaces get a `SurfaceSheen` highlight to read as
 * reflective.
 */
export const MATERIAL_TONES = {
  wood: FURNITURE_PALETTE.taupe,
  glass: FURNITURE_PALETTE.glass,
  metal: FURNITURE_PALETTE.metal,
  ceramic: FURNITURE_PALETTE.ceramic,
} as const

/** Cover colors cycled through for the books on shelves and racks. */
export const BOOK_TONES: PaletteTone[] = [
  FURNITURE_PALETTE.pink,
  FURNITURE_PALETTE.sky,
  FURNITURE_PALETTE.mint,
  FURNITURE_PALETTE.butter,
  FURNITURE_PALETTE.lavender,
  FURNITURE_PALETTE.terracotta,
]
