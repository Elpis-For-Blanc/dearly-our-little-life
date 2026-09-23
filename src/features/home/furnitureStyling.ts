import { BED_COLORWAYS, genericTones, RUG_COLORWAYS, SOFA_COLORWAYS, TABLE_COLORWAYS, WINDOW_COLORWAYS } from './colorways'
import { isHexColor, toneFromHex, type FurnitureStyle } from './furnitureStyle'
import { FURNITURE_PALETTE as P, type PaletteTone } from './palette'

/** Default tone of every recolorable part of one piece, keyed by part id, for a given preset colorway. */
export type PartTones = Record<string, PaletteTone>

const wood = P.taupe
const metal = P.metal

/**
 * The single source of each piece's part colors *before* any user override —
 * both the illustrations and the editing panel read it, so what the panel
 * shows as "current" is exactly what the SVG draws. The original sofa/table/
 * bed keep deriving their defaults from their own preset tables, so a
 * placement with no overrides looks identical to before. Part ids here must
 * match the `colorParts` of the same piece in furnitureCatalog.ts (tested).
 */
const sofaLike = (colorway: string): PartTones => {
  const g = genericTones(colorway)
  return { body: g.main, cushion: g.accent, legs: wood }
}

const tableLike = (colorway: string): PartTones => ({ top: genericTones(colorway).main, legs: wood })

const bedLike = (colorway: string): PartTones => {
  const g = genericTones(colorway)
  return { headboard: g.main, frame: wood, blanket: g.accent, pillow: { fill: P.ivory.fill, stroke: g.accent.stroke } }
}

const cabinetLike = (colorway: string): PartTones => {
  const g = genericTones(colorway)
  return { body: g.main, door: g.accent, handle: metal }
}

const chairLike = (colorway: string): PartTones => {
  const g = genericTones(colorway)
  return { seat: g.accent, back: g.main, frame: wood }
}

/** A backless bench — same idea as `chairLike` minus the `back` part, which `BENCH_STYLE` (furnitureCatalog.ts) never declares. */
const benchLike = (colorway: string): PartTones => ({ seat: genericTones(colorway).accent, frame: wood })

const bodyOnly = (colorway: string): PartTones => ({ body: genericTones(colorway).main })
const frameOnly = (colorway: string): PartTones => ({ frame: genericTones(colorway).main })
const shadeOnly = (colorway: string): PartTones => ({ shade: genericTones(colorway).main })

const PART_DEFAULTS: Record<string, (colorway: string) => PartTones> = {
  // original pieces — defaults come from their own preset tables
  sofa: (colorway) => {
    const tones = SOFA_COLORWAYS[colorway] ?? SOFA_COLORWAYS.rose
    return { body: tones.body, cushion: tones.cushion, legs: wood }
  },
  table: (colorway) => ({ top: (TABLE_COLORWAYS[colorway] ?? TABLE_COLORWAYS.natural).top, legs: wood }),
  bed: (colorway) => ({ headboard: wood, frame: wood, blanket: (BED_COLORWAYS[colorway] ?? BED_COLORWAYS.blush).accent, pillow: P.ivory }),
  'canopy-bed': (colorway) => ({ headboard: genericTones(colorway).main, frame: wood, blanket: genericTones(colorway).accent, pillow: P.ivory }),
  'round-table': tableLike,
  rug: (colorway) => {
    const base = (RUG_COLORWAYS[colorway] ?? RUG_COLORWAYS.blush).fill
    return { base, border: toneFromHex(base.stroke) }
  },
  window: (colorway) => ({ frame: { fill: '#fbf3e4', stroke: '#e8d9bb' }, curtain: (WINDOW_COLORWAYS[colorway] ?? WINDOW_COLORWAYS.cream).curtain }),
  // 거실
  'sofa-single': sofaLike,
  'sofa-long': sofaLike,
  armchair: sofaLike,
  'coffee-table': tableLike,
  'side-table': tableLike,
  'tv-stand': cabinetLike,
  bookshelf: bodyOnly,
  // 침실
  'bed-single': bedLike,
  'bed-double': bedLike,
  nightstand: cabinetLike,
  vanity: cabinetLike,
  wardrobe: cabinetLike,
  dresser: cabinetLike,
  'floor-mirror': frameOnly,
  // 주방
  'dining-table': tableLike,
  'dining-table-large': tableLike,
  'dining-chair': chairLike,
  'dining-bench': benchLike,
  fridge: (colorway) => ({ body: genericTones(colorway).main, handle: metal }),
  'kitchen-cabinet': (colorway) => ({ top: wood, ...cabinetLike(colorway) }),
  sink: (colorway) => ({ top: metal, ...cabinetLike(colorway) }),
  microwave: (colorway) => ({ body: genericTones(colorway).main, panel: genericTones(colorway).accent }),
  'kitchen-counter': (colorway) => ({ top: wood, ...cabinetLike(colorway) }),
  toaster: bodyOnly,
  kettle: bodyOnly,
  'coffee-machine': (colorway) => ({ body: genericTones(colorway).main, panel: genericTones(colorway).accent }),
  // 서재
  desk: (colorway) => ({ top: genericTones(colorway).main, ...cabinetLike(colorway) }),
  'computer-desk': (colorway) => ({ top: genericTones(colorway).main, ...cabinetLike(colorway) }),
  'office-chair': (colorway) => ({ ...chairLike(colorway), frame: P.slate }),
  bookrack: bodyOnly,
  'floor-lamp': shadeOnly,
  // 침실/거실 (가구 종류 확장 2차)
  'bedroom-bench': benchLike,
  ottoman: benchLike,
  'low-cabinet': cabinetLike,
  console: cabinetLike,
  'pendant-light': shadeOnly,
  'wall-mirror': frameOnly,
  'display-shelf': bodyOnly,
  // 가구 비주얼 고도화 + 종류 확장 (3차)
  stool: benchLike,
  'storage-basket': bodyOnly,
  // 조명·소품
  'table-lamp': shadeOnly,
  cushion: (colorway) => ({ body: genericTones(colorway).main, button: genericTones(colorway).accent }),
  'bunny-doll': bodyOnly,
  'bear-doll': bodyOnly,
  vase: bodyOnly,
  candle: bodyOnly,
  frame: frameOnly,
  'desk-clock': bodyOnly,
  'book-stack': (colorway) => ({ bottom: genericTones(colorway).main, middle: P.sky, top: genericTones(colorway).accent }),
  mug: bodyOnly,
  'wall-clock': (colorway) => ({ rim: genericTones(colorway).main }),
  curtain: (colorway) => ({ fabric: genericTones(colorway).main, tieback: genericTones(colorway).accent }),
}

/** An empty object for pieces with no recolorable parts (only the plant now) or ids that aren't in the catalog. */
export function getPartDefaults(furnitureId: string, colorway: string): PartTones {
  return PART_DEFAULTS[furnitureId]?.(colorway) ?? {}
}

/**
 * Parts whose color, until the user picks one, is *derived from another
 * part's current color* rather than fixed by the preset: the rug's border
 * (the woven edge line) is the outline color of its face, so recoloring the
 * face recolors the border with it, while choosing a border color detaches it.
 * Unrecolored, the border is exactly the outline it always had.
 */
const FOLLOWS: Record<string, Record<string, string>> = { rug: { border: 'base' } }

/** Defaults with the user's per-part color overrides applied — what an illustration actually paints with. Unknown part ids and malformed values in `colors` are ignored. */
export function resolvePartTones(furnitureId: string, colorway: string, style?: FurnitureStyle): PartTones {
  const tones = getPartDefaults(furnitureId, colorway)
  const colors = style?.colors
  if (!colors) return tones
  const resolved: PartTones = { ...tones }
  for (const part of Object.keys(tones)) {
    const override = colors[part]
    if (isHexColor(override)) resolved[part] = toneFromHex(override)
  }
  for (const [part, source] of Object.entries(FOLLOWS[furnitureId] ?? {})) {
    if (!isHexColor(colors[part]) && resolved[source]) resolved[part] = toneFromHex(resolved[source].stroke)
  }
  return resolved
}

export function knownStyledFurnitureIds(): string[] {
  return Object.keys(PART_DEFAULTS)
}
