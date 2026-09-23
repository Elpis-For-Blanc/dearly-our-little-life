import type { PatternSetting } from './furnitureStyle'
import type { FloorSettings, WallpaperSettings } from './roomSurface'

/**
 * "방 프리셋" (room theme preset) data — a complete room look (wallpaper +
 * floor + a real furniture combination/layout) a user can apply in one
 * step. Deliberately a separate concept from `roomThemes.ts`'s legacy
 * `RoomTheme` (kept only as the old v2 schema migration's color source,
 * never rendered anymore) and from `homeStore.ts`'s `RoomPreset` (`'default'
 * | 'empty'`, the *room-creation* starter-furniture choice) — neither name
 * is reused here to avoid confusing three unrelated things.
 */
export type DecorPresetCategory = 'princess' | 'vintage' | 'simple' | 'fantasy' | 'lifestyle'

export const DECOR_PRESET_CATEGORY_LABELS: Record<DecorPresetCategory, string> = {
  princess: '공주',
  vintage: '빈티지',
  simple: '심플',
  fantasy: '판타지',
  lifestyle: '생활감',
}

export const DECOR_PRESET_CATEGORY_ORDER: DecorPresetCategory[] = ['princess', 'vintage', 'simple', 'fantasy', 'lifestyle']

/**
 * One piece of furniture in a preset's layout. Position is stored as a
 * fraction (0-1) of the room's own logical width/height
 * (`roomLayout.ts`'s `ROOM_WIDTH`/`ROOM_HEIGHT`), not a raw absolute
 * coordinate — `decorPresetEngine.ts`'s `resolveDecorPresetFurniture`
 * multiplies back out against the room's *current* logical size, then runs
 * every piece through the same zone/collision-aware
 * `furniturePlacementEngine.ts`'s `clampFurniturePlacement` manual
 * placement already goes through. Every ratio here was chosen so that
 * resolution needs **zero** adjustment (verified by
 * `decorPresets.test.ts` against the real placement pipeline) — in
 * particular, every solid floor-standing piece's Y already keeps its
 * bottom edge on the floor's own visual surface (see
 * `furniturePlacementEngine.ts`'s own doc comment for why an
 * insufficiently-low Y is what made furniture render as if floating
 * against the wall, the bug this data was rewritten to fix).
 */
export interface DecorPresetFurnitureEntry {
  furnitureId: string
  xRatio: number
  yRatio: number
  scale: number
  rotation: 0 | 180
  colorway: string
  variant?: string
  colors?: Record<string, string>
  patterns?: Record<string, PatternSetting>
}

export interface DecorPresetDefinition {
  id: string
  name: string
  description: string
  category: DecorPresetCategory
  tags: string[]
  /** 2-3 representative hex colors for the catalog card's swatch strip — cosmetic display data only, never applied to anything. */
  accentColors: string[]
  wallpaper: WallpaperSettings
  floor: FloorSettings
  furniture: DecorPresetFurnitureEntry[]
}

function entry(
  furnitureId: string,
  xRatio: number,
  yRatio: number,
  colorway: string,
  extra: Partial<Pick<DecorPresetFurnitureEntry, 'patterns' | 'colors' | 'variant'>> = {},
): DecorPresetFurnitureEntry {
  return { furnitureId, xRatio, yRatio, scale: 1, rotation: 0, colorway, ...extra }
}

function pattern(type: PatternSetting['type'], baseColor: string, color: string, size: PatternSetting['size'] = 2): PatternSetting {
  return { type, baseColor, color, size }
}

/**
 * Six starter themes, each a genuinely different furniture *combination*
 * and layout (never "the same room with a different wallpaper color")
 * built only from furniture ids that already exist in `furnitureCatalog.ts`
 * — no new SVG art, no invented ids. Every `colorway` is checked against
 * that piece's real `getColorwayOptions()` list, every `patterns`/`colors`
 * entry against that piece's real `colorParts`/`patternSurfaces`, and every
 * position against the real shared placement pipeline (all three by
 * `decorPresetEngine.ts`'s `validateDecorPreset`, and offline by
 * `decorPresets.test.ts`) — most furniture past the original six
 * (`sofa`/`table`/`bed`/`rug`/`window`) only accepts the *generic* colorway
 * set (cream/rose/sky/mint/lavender/butter + six dark presets), not
 * `blush`/`natural`/`sage`/`forest`, which stay exclusive to their own
 * original piece.
 *
 * Layouts were hand-placed and then verified — not just eyeballed —
 * against the real engine: every solid piece's `furnitureObstacles` rect is
 * checked pairwise for overlap, the room's one fixed doorway point is
 * checked clear, and every piece that actually has a real interaction slot
 * (only `bed-single`/`bed-double`/`dining-table`/`dining-chair`/
 * `office-chair` do — most catalog entries past the original six declare
 * none) has its `resolveWalkDestination`/`resolveStandDestination` point
 * checked reachable against every *other* piece in the same preset.
 */
export const DECOR_PRESETS: DecorPresetDefinition[] = [
  {
    id: 'strawberry-princess',
    name: '딸기우유 공주방',
    description: '사랑스럽고 부드러운 공주풍 침실이에요.',
    category: 'princess',
    tags: ['공주', '핑크', '사랑스러운'],
    accentColors: ['#FFD9E6', '#FDF1DC', '#FFFFFF'],
    wallpaper: { baseColor: '#FFE3EC', pattern: 'floral', patternColor: '#FDF1DC', patternScale: 1 },
    floor: { baseColor: '#F3E4CF', pattern: 'wood-horizontal', patternColor: '#E7D0AB', patternScale: 1, orientation: 0 },
    furniture: [
      entry('bed-single', 0.20833, 0.68182, 'rose', { patterns: { blanket: pattern('floral', '#FFE3EC', '#F7C6D9') } }),
      entry('nightstand', 0.375, 0.63636, 'cream'),
      entry('dining-chair', 0.55556, 0.68182, 'cream'),
      entry('sofa-single', 0.80556, 0.68182, 'rose'),
      entry('rug', 0.5, 0.75, 'blush'),
      entry('cushion', 0.81944, 0.63636, 'rose', { patterns: { body: pattern('dot-small', '#FFF8F0', '#F7C6D9', 1) } }),
      entry('frame', 0.80556, 0.20455, 'cream'),
    ],
  },
  {
    id: 'white-angel',
    name: '화이트 엔젤 룸',
    description: '깨끗하고 몽환적인 화이트 톤의 방이에요.',
    category: 'fantasy',
    tags: ['화이트', '천사', '몽환적'],
    accentColors: ['#FFFFFF', '#E8E4DC', '#D9EAF8'],
    wallpaper: { baseColor: '#FFFFFF', pattern: 'stripe-vertical', patternColor: '#F3F0EC', patternScale: 1.4 },
    floor: { baseColor: '#FFFFFF', pattern: 'marble', patternColor: '#E8E4DC', patternScale: 1, orientation: 0 },
    furniture: [
      entry('bed-single', 0.22222, 0.68182, 'sky', { patterns: { blanket: pattern('dot-small', '#FFFFFF', '#E8E4DC', 1) } }),
      entry('office-chair', 0.58333, 0.65909, 'cream'),
      entry('side-table', 0.80556, 0.63636, 'sky'),
      entry('table-lamp', 0.80556, 0.56818, 'cream'),
      entry('rug', 0.5, 0.75, 'sky'),
      entry('vase', 0.875, 0.59091, 'cream'),
      entry('frame', 0.27778, 0.20455, 'cream'),
    ],
  },
  {
    id: 'romantic-vintage',
    name: '로맨틱 빈티지 룸',
    description: '짙은 브라운과 로즈핑크가 어우러진 유럽풍 빈티지 침실이에요.',
    category: 'vintage',
    tags: ['빈티지', '유럽풍', '로맨틱'],
    accentColors: ['#F7C6D9', '#EFE3D0', '#50382E'],
    wallpaper: { baseColor: '#EFE3D0', pattern: 'vintage', patternColor: '#8B6650', patternScale: 1.2 },
    floor: { baseColor: '#C9A876', pattern: 'herringbone', patternColor: '#A8825A', patternScale: 1, orientation: 0 },
    furniture: [
      entry('bed-double', 0.23611, 0.68182, 'rose', { patterns: { blanket: pattern('rose', '#F7C6D9', '#8B6650') } }),
      entry('desk', 0.66667, 0.63636, 'deep-brown'),
      entry('dining-chair', 0.66667, 0.77273, 'deep-brown', { patterns: { seat: pattern('tartan', '#EFE3D0', '#8B6650') } }),
      entry('bookshelf', 0.90278, 0.56818, 'deep-brown'),
      entry('nightstand', 0.45833, 0.63636, 'deep-brown'),
      entry('book-stack', 0.66667, 0.59091, 'cream'),
      entry('vase', 0.90278, 0.47727, 'rose'),
    ],
  },
  {
    id: 'lovely-cafe',
    name: '러블리 카페 룸',
    description: '크림과 민트가 어우러진 아늑하고 귀여운 카페 공간이에요.',
    category: 'lifestyle',
    tags: ['카페', '아늑함', '핑크민트'],
    accentColors: ['#FDF1DC', '#FFD9E6', '#D3F0E0'],
    wallpaper: { baseColor: '#FFF8F0', pattern: 'dot', patternColor: '#FFD9E6', patternScale: 1.3 },
    floor: { baseColor: '#FDF1DC', pattern: 'tile-square', patternColor: '#D3F0E0', patternScale: 1, orientation: 0 },
    furniture: [
      entry('dining-table', 0.52778, 0.65909, 'rose'),
      entry('dining-chair', 0.25, 0.70455, 'cream', { patterns: { seat: pattern('gingham', '#FFF8F0', '#FFD9E6') } }),
      entry('dining-chair', 0.80556, 0.70455, 'cream', { patterns: { seat: pattern('gingham', '#FFF8F0', '#FFD9E6') } }),
      entry('sofa-single', 0.90278, 0.56818, 'mint'),
      entry('kitchen-cabinet', 0.16667, 0.56818, 'cream'),
      entry('table-lamp', 0.52778, 0.59091, 'cream'),
      entry('mug', 0.55556, 0.63636, 'cream'),
      entry('vase', 0.16667, 0.47727, 'mint'),
    ],
  },
  {
    id: 'simple-modern',
    name: '심플 모던 룸',
    description: '화이트와 그레이 톤의 단정하고 깔끔한 생활 공간이에요.',
    category: 'simple',
    tags: ['모던', '심플', '깔끔'],
    accentColors: ['#F5F5F3', '#E8E2D8', '#41434A'],
    wallpaper: { baseColor: '#F5F5F3', pattern: 'solid', patternColor: '#E5E5E0', patternScale: 1 },
    floor: { baseColor: '#E8E2D8', pattern: 'wood-vertical', patternColor: '#D4CBBA', patternScale: 1, orientation: 0 },
    furniture: [
      entry('bed-single', 0.20833, 0.68182, 'charcoal'),
      entry('sofa-single', 0.80556, 0.65909, 'cream'),
      entry('coffee-table', 0.52778, 0.59091, 'butter'),
      entry('desk', 0.83333, 0.81818, 'charcoal'),
      entry('desk-clock', 0.83333, 0.72727, 'cream'),
      entry('book-stack', 0.77778, 0.75, 'cream'),
    ],
  },
  {
    id: 'bunny-doll-room',
    name: '토끼 인형방',
    description: '토끼 인형이 잘 어울리는 사랑스러운 파스텔 방이에요.',
    category: 'princess',
    tags: ['토끼', '인형', '파스텔'],
    accentColors: ['#FFE3EC', '#FDF1DC', '#FFFFFF'],
    wallpaper: { baseColor: '#FFF8F0', pattern: 'heart', patternColor: '#FFD9E6', patternScale: 1 },
    floor: { baseColor: '#FFF8F0', pattern: 'tile-dot', patternColor: '#FFD9E6', patternScale: 1, orientation: 0 },
    furniture: [
      entry('bed-single', 0.20833, 0.68182, 'rose', { patterns: { blanket: pattern('heart', '#FFE3EC', '#FFD9E6') } }),
      entry('side-table', 0.41667, 0.63636, 'cream'),
      entry('sofa-single', 0.66667, 0.65909, 'rose', { patterns: { cushion: pattern('ribbon', '#FFF8F0', '#F7C6D9') } }),
      entry('wardrobe', 0.90278, 0.56818, 'rose'),
      entry('rug', 0.5, 0.86364, 'blush'),
      entry('bunny-doll', 0.27778, 0.77273, 'cream'),
      entry('bear-doll', 0.52778, 0.81818, 'rose'),
      entry('cushion', 0.63889, 0.61364, 'rose'),
    ],
  },
]

export function getDecorPreset(id: string): DecorPresetDefinition | undefined {
  return DECOR_PRESETS.find((preset) => preset.id === id)
}
