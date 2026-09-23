import type { PaletteTone } from './palette'

/**
 * Per-placement customization added on top of a furniture piece's preset
 * `colorway`: `colors` recolors individual named parts (본체/방석/다리 …) and
 * `patterns` puts a pattern on a named fabric surface (방석/이불/커튼 …). Both are
 * optional and absent for anything the user hasn't customized, so every
 * placement saved before this existed renders exactly as it always did.
 */
export type FurniturePatternType =
  | 'solid'
  | 'dot-small'
  | 'dot-large'
  | 'stripe-vertical'
  | 'stripe-horizontal'
  | 'gingham'
  | 'tartan'
  | 'floral'
  | 'rose'
  | 'heart'
  | 'ribbon'
  | 'star'

export const FURNITURE_PATTERN_LABELS: Record<FurniturePatternType, string> = {
  solid: '단색',
  'dot-small': '작은 도트',
  'dot-large': '큰 도트',
  'stripe-vertical': '세로 스트라이프',
  'stripe-horizontal': '가로 스트라이프',
  gingham: '깅엄 체크',
  tartan: '타탄 체크',
  floral: '작은 꽃무늬',
  rose: '장미',
  heart: '하트',
  ribbon: '리본',
  star: '별',
}

export const FURNITURE_PATTERN_ORDER = Object.keys(FURNITURE_PATTERN_LABELS) as FurniturePatternType[]

export type PatternSize = 1 | 2 | 3

export const PATTERN_SIZE_LABELS: Record<PatternSize, string> = { 1: '작게', 2: '보통', 3: '크게' }

/** Tile edge, in the illustration's own logical units, for each size step. */
export const PATTERN_TILE_UNITS: Record<PatternSize, number> = { 1: 10, 2: 16, 3: 26 }

export interface PatternSetting {
  /** Never `'solid'` — choosing 단색 removes the pattern entry instead. */
  type: Exclude<FurniturePatternType, 'solid'>
  /** Background color behind the motif. */
  baseColor: string
  /** Motif color. */
  color: string
  size: PatternSize
}

/** What an illustration receives in addition to its size/colorway. `idPrefix` makes every pattern id in the document unique. */
export interface FurnitureStyle {
  idPrefix: string
  colors?: Record<string, string>
  patterns?: Record<string, PatternSetting>
}

const HEX = /^#[0-9a-fA-F]{6}$/

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value)
}

/** Perceived brightness of a #rrggbb color, 0 (black) to 1 (white). */
export function hexLuminance(hex: string): number {
  const channel = (start: number) => parseInt(hex.slice(start, start + 2), 16)
  return (0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)) / 255
}

/** Fills darker than this get a *lighter* outline instead of a darker one. */
const DARK_FILL_LUMINANCE = 0.3
/** How far a dark fill's outline is mixed toward white. */
const DARK_OUTLINE_LIGHTEN = 0.3
/** How much a light fill's outline is darkened. */
const LIGHT_OUTLINE_DARKEN = 0.86

/**
 * The outline tone for a color the user picked: the fill is used exactly as
 * picked, and the stroke is derived so the edge always reads. A light or
 * pastel fill gets a slightly darker outline (what pastel furniture has always
 * had); a dark fill (charcoal, black, burgundy…) would vanish into a darker
 * outline, so it gets a lighter one, like a soft edge highlight. Every shape
 * in the illustrations that outlines a part uses this stroke, which is what
 * keeps a black sofa body's arms, cushions and frame distinguishable.
 */
export function toneFromHex(hex: string): PaletteTone {
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  const dark = hexLuminance(hex) < DARK_FILL_LUMINANCE
  const shade = (start: number) => {
    const value = parseInt(hex.slice(start, start + 2), 16)
    return dark ? value + (255 - value) * DARK_OUTLINE_LIGHTEN : value * LIGHT_OUTLINE_DARKEN
  }
  return { fill: hex, stroke: `#${toHex(shade(1))}${toHex(shade(3))}${toHex(shade(5))}` }
}

/** Keeps only well-formed `partId -> #rrggbb` pairs; `undefined` (not `{}`) when nothing valid remains, so uncustomized placements stay unchanged. */
export function normalizePartColors(raw: unknown): Record<string, string> | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const result: Record<string, string> = {}
  for (const [part, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isHexColor(value)) result[part] = value
  }
  return Object.keys(result).length > 0 ? result : undefined
}

function isPatternSize(value: unknown): value is PatternSize {
  return value === 1 || value === 2 || value === 3
}

export function normalizePatterns(raw: unknown): Record<string, PatternSetting> | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const result: Record<string, PatternSetting> = {}
  for (const [surface, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== 'object' || value === null) continue
    const candidate = value as Record<string, unknown>
    const type = candidate.type
    if (typeof type !== 'string' || type === 'solid' || !Object.hasOwn(FURNITURE_PATTERN_LABELS, type)) continue
    if (!isHexColor(candidate.baseColor) || !isHexColor(candidate.color)) continue
    result[surface] = { type: type as PatternSetting['type'], baseColor: candidate.baseColor, color: candidate.color, size: isPatternSize(candidate.size) ? candidate.size : 2 }
  }
  return Object.keys(result).length > 0 ? result : undefined
}

/** A first pattern on a surface: motif in the part's outline color over the part's own fill, so it looks like a tone-on-tone print until the user recolors it. */
export function defaultPatternSetting(type: PatternSetting['type'], tone: PaletteTone): PatternSetting {
  return { type, baseColor: tone.fill, color: tone.stroke, size: 2 }
}
