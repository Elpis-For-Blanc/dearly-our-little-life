export interface ColorPreset {
  id: string
  label: string
  hex: string
}

/** Shared by both the wallpaper and floor color pickers — a custom hex input covers anything not listed here. */
export const SURFACE_COLOR_PRESETS: ColorPreset[] = [
  { id: 'ivory', label: '아이보리', hex: '#FFF8F0' },
  { id: 'cream', label: '크림', hex: '#FDF1DC' },
  { id: 'white', label: '화이트', hex: '#FFFFFF' },
  { id: 'strawberry-milk', label: '딸기우유 핑크', hex: '#FFD9E6' },
  { id: 'baby-pink', label: '베이비 핑크', hex: '#FFE3EC' },
  { id: 'rose-pink', label: '로즈 핑크', hex: '#F7C6D9' },
  { id: 'peach', label: '피치', hex: '#FFDAC1' },
  { id: 'butter-yellow', label: '버터 옐로', hex: '#FFF3B0' },
  { id: 'lavender', label: '라벤더', hex: '#DED2F2' },
  { id: 'lilac', label: '라일락', hex: '#E6D6F2' },
  { id: 'baby-blue', label: '베이비 블루', hex: '#D9EAF8' },
  { id: 'sky-blue', label: '스카이 블루', hex: '#CFE8F7' },
  { id: 'mint', label: '민트', hex: '#D3F0E0' },
  { id: 'sage', label: '세이지', hex: '#DCE7CC' },
  { id: 'beige', label: '베이지', hex: '#EFE3D0' },
  { id: 'mocha', label: '모카', hex: '#D8C3A5' },
]

export interface ColorPresetGroup {
  id: string
  label: string
  presets: ColorPreset[]
}

/**
 * The furniture-side palette, in one place: every furniture/prop part color,
 * the rug's face and border, the window's frame and curtain, and both pattern
 * colors (background and motif) all pick from `FURNITURE_COLOR_GROUPS` — no
 * editor keeps its own list. Groups are shown in this order.
 *
 * 밝은 색상 is exactly what the furniture picker offered before (the 16
 * wallpaper/floor presets + 세이지 그린 + 브라운, same ids/hex/order); the
 * three dark groups only add to it. Fills are used as picked — the matching
 * outline is derived per color in furnitureStyle.ts's `toneFromHex` (darker for
 * light fills, lighter for dark fills), so a dark part keeps a readable edge.
 * A custom hex input still covers anything not listed.
 */
export const LIGHT_COLOR_PRESETS: ColorPreset[] = [
  ...SURFACE_COLOR_PRESETS,
  { id: 'sage-green', label: '세이지 그린', hex: '#BFDDA9' },
  { id: 'brown', label: '브라운', hex: '#B08968' },
]

export const GRAY_BLACK_COLOR_PRESETS: ColorPreset[] = [
  { id: 'light-gray', label: '라이트 그레이', hex: '#D3D3D3' },
  { id: 'gray', label: '그레이', hex: '#929292' },
  { id: 'charcoal', label: '차콜', hex: '#41434A' },
  { id: 'soft-black', label: '소프트 블랙', hex: '#292929' },
  { id: 'black', label: '블랙', hex: '#171717' },
]

export const RED_WINE_COLOR_PRESETS: ColorPreset[] = [
  { id: 'red', label: '레드', hex: '#D63845' },
  { id: 'deep-red', label: '딥 레드', hex: '#A82432' },
  { id: 'wine', label: '와인', hex: '#702C42' },
  { id: 'burgundy', label: '버건디', hex: '#581D32' },
]

export const DEEP_COLOR_PRESETS: ColorPreset[] = [
  { id: 'navy', label: '네이비', hex: '#263653' },
  { id: 'deep-brown', label: '딥 브라운', hex: '#50382E' },
  { id: 'forest-green', label: '포레스트 그린', hex: '#244C3B' },
  { id: 'plum', label: '플럼', hex: '#583654' },
]

export const FURNITURE_COLOR_GROUPS: ColorPresetGroup[] = [
  { id: 'light', label: '밝은 색상', presets: LIGHT_COLOR_PRESETS },
  { id: 'gray-black', label: '회색·검정', presets: GRAY_BLACK_COLOR_PRESETS },
  { id: 'red-wine', label: '빨강·와인', presets: RED_WINE_COLOR_PRESETS },
  { id: 'deep', label: '기타 진한 색상', presets: DEEP_COLOR_PRESETS },
]

/** Every furniture-side preset, flattened in group order (the name this list has always had). */
export const FURNITURE_COLOR_PRESETS: ColorPreset[] = FURNITURE_COLOR_GROUPS.flatMap((group) => group.presets)
