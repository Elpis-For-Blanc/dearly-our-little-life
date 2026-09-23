export type WallpaperPatternType =
  | 'solid'
  | 'stripe-vertical'
  | 'stripe-horizontal'
  | 'checker'
  | 'gingham'
  | 'dot'
  | 'floral'
  | 'heart'
  | 'star'
  | 'diamond'
  | 'lattice'
  | 'vintage'

export type FloorPatternType =
  | 'solid'
  | 'wood-natural'
  | 'wood-horizontal'
  | 'wood-vertical'
  | 'herringbone'
  | 'tile-square'
  | 'tile-checker'
  | 'marble'
  | 'terrazzo'
  | 'tile-dot'
  | 'tile-vintage'

export interface WallpaperSettings {
  baseColor: string
  pattern: WallpaperPatternType
  patternColor: string
  /** Multiplier on the pattern's base tile size — also controls the effective spacing between motifs. */
  patternScale: number
}

export interface FloorSettings {
  baseColor: string
  pattern: FloorPatternType
  patternColor: string
  patternScale: number
  /** Degrees — lets directional patterns (planks, herringbone) be rotated. */
  orientation: number
}

export const WALLPAPER_PATTERN_LABELS: Record<WallpaperPatternType, string> = {
  solid: '단색',
  'stripe-vertical': '세로 스트라이프',
  'stripe-horizontal': '가로 스트라이프',
  checker: '체크',
  gingham: '깅엄 체크',
  dot: '도트',
  floral: '작은 꽃무늬',
  heart: '하트',
  star: '별',
  diamond: '다이아몬드',
  lattice: '격자',
  vintage: '빈티지 벽지',
}

export const FLOOR_PATTERN_LABELS: Record<FloorPatternType, string> = {
  solid: '단색',
  'wood-natural': '원목 마루',
  'wood-horizontal': '가로 마루',
  'wood-vertical': '세로 마루',
  herringbone: '헤링본',
  'tile-square': '정사각형 타일',
  'tile-checker': '체크 타일',
  marble: '대리석 느낌',
  terrazzo: '테라조',
  'tile-dot': '작은 도트 타일',
  'tile-vintage': '빈티지 타일',
}

export const WALLPAPER_PATTERN_ORDER = Object.keys(WALLPAPER_PATTERN_LABELS) as WallpaperPatternType[]
export const FLOOR_PATTERN_ORDER = Object.keys(FLOOR_PATTERN_LABELS) as FloorPatternType[]

export const DEFAULT_WALLPAPER: WallpaperSettings = {
  baseColor: '#faf5ec',
  pattern: 'solid',
  patternColor: '#e8d9bb',
  patternScale: 1,
}

export const DEFAULT_FLOOR: FloorSettings = {
  baseColor: '#e7d0ab',
  pattern: 'wood-horizontal',
  patternColor: '#c2a374',
  patternScale: 1,
  orientation: 0,
}

export function normalizeWallpaper(value: Partial<WallpaperSettings> | undefined): WallpaperSettings {
  return {
    baseColor: value?.baseColor ?? DEFAULT_WALLPAPER.baseColor,
    pattern: value?.pattern && WALLPAPER_PATTERN_LABELS[value.pattern] ? value.pattern : DEFAULT_WALLPAPER.pattern,
    patternColor: value?.patternColor ?? DEFAULT_WALLPAPER.patternColor,
    patternScale: value?.patternScale ?? DEFAULT_WALLPAPER.patternScale,
  }
}

export function normalizeFloor(value: Partial<FloorSettings> | undefined): FloorSettings {
  return {
    baseColor: value?.baseColor ?? DEFAULT_FLOOR.baseColor,
    pattern: value?.pattern && FLOOR_PATTERN_LABELS[value.pattern] ? value.pattern : DEFAULT_FLOOR.pattern,
    patternColor: value?.patternColor ?? DEFAULT_FLOOR.patternColor,
    patternScale: value?.patternScale ?? DEFAULT_FLOOR.patternScale,
    orientation: value?.orientation ?? DEFAULT_FLOOR.orientation,
  }
}
