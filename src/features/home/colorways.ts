import { FURNITURE_COLOR_PRESETS } from './colorPresets'
import { getFurnitureDefinition } from './furnitureCatalog'
import { toneFromHex } from './furnitureStyle'
import { FURNITURE_PALETTE as P, type PaletteTone } from './palette'

export interface ColorwayOption {
  id: string
  label: string
  /** Swatch shown in the properties panel color picker. */
  swatch: string
}

/** A hex from the one furniture palette (colorPresets.ts) by preset id — the dark whole-piece presets below never repeat a hex value. */
function presetHex(id: string): string {
  const preset = FURNITURE_COLOR_PRESETS.find((p) => p.id === id)
  if (!preset) throw new Error(`unknown color preset: ${id}`)
  return preset.hex
}

interface DarkColorway {
  id: string
  label: string
  /** Body / upholstery / face color. */
  main: PaletteTone
  /** The secondary surface (cushions, doors, blankets, shades) — a lighter companion so the piece keeps two readable tones. */
  accent: PaletteTone
}

/**
 * Whole-piece dark presets ("가구 전체" 색상), appended after every piece's
 * existing presets (which keep their ids, order and tones) — the original
 * default of each piece is unchanged. Each pairs a dark `main` with a lighter
 * `accent`; outlines come from `toneFromHex` (lighter edge on dark fills).
 */
const DARK_COLORWAYS: DarkColorway[] = [
  { id: 'charcoal', label: '차콜', main: toneFromHex(presetHex('charcoal')), accent: toneFromHex(presetHex('gray')) },
  { id: 'black', label: '블랙', main: toneFromHex(presetHex('black')), accent: toneFromHex(presetHex('gray')) },
  { id: 'red', label: '레드', main: toneFromHex(presetHex('red')), accent: toneFromHex(presetHex('cream')) },
  { id: 'wine', label: '와인', main: toneFromHex(presetHex('wine')), accent: toneFromHex(presetHex('light-gray')) },
  { id: 'navy', label: '네이비', main: toneFromHex(presetHex('navy')), accent: toneFromHex(presetHex('cream')) },
  { id: 'deep-brown', label: '딥 브라운', main: toneFromHex(presetHex('deep-brown')), accent: toneFromHex(presetHex('beige')) },
]

const DARK_OPTIONS: ColorwayOption[] = DARK_COLORWAYS.map((d) => ({ id: d.id, label: d.label, swatch: d.main.fill }))

interface SofaTones {
  body: PaletteTone
  cushion: PaletteTone
}

interface TableTones {
  top: PaletteTone
}

interface BedTones {
  accent: PaletteTone
}

interface PlantTones {
  leaf: PaletteTone
  leafDeep: PaletteTone
}

interface RugTones {
  fill: PaletteTone
}

interface WindowTones {
  curtain: PaletteTone
}

export const SOFA_COLORWAYS: Record<string, SofaTones> = {
  rose: { body: P.pink, cushion: P.cream },
  cream: { body: P.cream, cushion: P.ivory },
  ...Object.fromEntries(DARK_COLORWAYS.map((d) => [d.id, { body: d.main, cushion: d.accent }])),
}

export const TABLE_COLORWAYS: Record<string, TableTones> = {
  natural: { top: P.taupe },
  blush: { top: P.pink },
  ...Object.fromEntries(DARK_COLORWAYS.map((d) => [d.id, { top: d.main }])),
}

export const BED_COLORWAYS: Record<string, BedTones> = {
  blush: { accent: P.pinkDeep },
  sky: { accent: P.sky },
  ...Object.fromEntries(DARK_COLORWAYS.map((d) => [d.id, { accent: d.main }])),
}

export const PLANT_COLORWAYS: Record<string, PlantTones> = {
  sage: { leaf: P.leaf, leafDeep: P.leafDeep },
  blush: { leaf: P.pink, leafDeep: P.pinkDeep },
  forest: { leaf: toneFromHex(presetHex('forest-green')), leafDeep: toneFromHex('#1B3A2C') },
}

export const RUG_COLORWAYS: Record<string, RugTones> = {
  blush: { fill: P.pink },
  sage: { fill: P.leaf },
  sky: { fill: P.sky },
  ...Object.fromEntries(DARK_COLORWAYS.map((d) => [d.id, { fill: d.main }])),
}

export const WINDOW_COLORWAYS: Record<string, WindowTones> = {
  cream: { curtain: P.taupe },
  blush: { curtain: P.pinkDeep },
  lavender: { curtain: P.lavender },
  ...Object.fromEntries(DARK_COLORWAYS.map((d) => [d.id, { curtain: d.main }])),
}

export const FURNITURE_COLORWAY_OPTIONS: Record<string, ColorwayOption[]> = {
  sofa: [
    { id: 'rose', label: '로즈 핑크', swatch: P.pink.fill },
    { id: 'cream', label: '크림 베이지', swatch: P.cream.fill },
    ...DARK_OPTIONS,
  ],
  table: [
    { id: 'natural', label: '내추럴 우드', swatch: P.taupe.fill },
    { id: 'blush', label: '블러쉬', swatch: P.pink.fill },
    ...DARK_OPTIONS,
  ],
  bed: [
    { id: 'blush', label: '블러쉬 핑크', swatch: P.pinkDeep.fill },
    { id: 'sky', label: '파스텔 블루', swatch: P.sky.fill },
    ...DARK_OPTIONS,
  ],
  plant: [
    { id: 'sage', label: '세이지 그린', swatch: P.leaf.fill },
    { id: 'blush', label: '블러쉬 플라워', swatch: P.pink.fill },
    { id: 'forest', label: '포레스트 그린', swatch: presetHex('forest-green') },
  ],
  rug: [
    { id: 'blush', label: '블러쉬 핑크', swatch: P.pink.fill },
    { id: 'sage', label: '세이지 그린', swatch: P.leaf.fill },
    { id: 'sky', label: '파스텔 블루', swatch: P.sky.fill },
    ...DARK_OPTIONS,
  ],
  window: [
    { id: 'cream', label: '내추럴 크림', swatch: P.taupe.fill },
    { id: 'blush', label: '블러쉬 핑크', swatch: P.pinkDeep.fill },
    { id: 'lavender', label: '라벤더', swatch: P.lavender.fill },
    ...DARK_OPTIONS,
  ],
}

/**
 * The furniture added after the original six (illustrations/*Illustrations.tsx)
 * share one two-tone colorway set: `main` paints the body/upholstery, `accent`
 * the secondary surface (cushions, doors' trim, blankets, shades). Wooden legs
 * and metal parts keep their own fixed tones. Per-part color and pattern
 * customization (furnitureStyle.ts) sits on top of this. The dark whole-piece
 * presets are appended after the pastel ones, so `cream` stays every piece's default.
 */
export interface GenericTones {
  main: PaletteTone
  accent: PaletteTone
}

export const GENERIC_COLORWAYS: Record<string, GenericTones> = {
  cream: { main: P.cream, accent: P.pink },
  rose: { main: P.pink, accent: P.cream },
  sky: { main: P.sky, accent: P.ivory },
  mint: { main: P.mint, accent: P.cream },
  lavender: { main: P.lavender, accent: P.ivory },
  butter: { main: P.butter, accent: P.cream },
  ...Object.fromEntries(DARK_COLORWAYS.map((d) => [d.id, { main: d.main, accent: d.accent }])),
}

const GENERIC_COLORWAY_OPTIONS: ColorwayOption[] = [
  { id: 'cream', label: '크림', swatch: P.cream.fill },
  { id: 'rose', label: '로즈 핑크', swatch: P.pink.fill },
  { id: 'sky', label: '파스텔 블루', swatch: P.sky.fill },
  { id: 'mint', label: '민트', swatch: P.mint.fill },
  { id: 'lavender', label: '라벤더', swatch: P.lavender.fill },
  { id: 'butter', label: '버터 옐로', swatch: P.butter.fill },
  ...DARK_OPTIONS,
]

export function genericTones(colorway: string): GenericTones {
  return GENERIC_COLORWAYS[colorway] ?? GENERIC_COLORWAYS.cream
}

/** The six original furniture keep their own presets; every later catalog entry uses the generic set. An id that isn't in the catalog at all (a removed item in an old save) has no options. */
export function getColorwayOptions(furnitureId: string): ColorwayOption[] {
  const own = FURNITURE_COLORWAY_OPTIONS[furnitureId]
  if (own) return own
  return getFurnitureDefinition(furnitureId) ? GENERIC_COLORWAY_OPTIONS : []
}

export function getDefaultColorway(furnitureId: string): string {
  return getColorwayOptions(furnitureId)[0]?.id ?? 'default'
}
