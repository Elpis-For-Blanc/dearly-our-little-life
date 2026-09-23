import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ColorSwatchPicker } from './ColorSwatchPicker'
import { getColorwayOptions, getDefaultColorway, GENERIC_COLORWAYS, SOFA_COLORWAYS } from './colorways'
import {
  DEEP_COLOR_PRESETS,
  FURNITURE_COLOR_GROUPS,
  FURNITURE_COLOR_PRESETS,
  GRAY_BLACK_COLOR_PRESETS,
  LIGHT_COLOR_PRESETS,
  RED_WINE_COLOR_PRESETS,
  SURFACE_COLOR_PRESETS,
} from './colorPresets'
import { FURNITURE_CATALOG, getFurnitureDefinition, getFurnitureSize } from './furnitureCatalog'
import { FurniturePropertiesPanel } from './FurniturePropertiesPanel'
import { defaultPatternSetting, hexLuminance, toneFromHex, type PatternSetting } from './furnitureStyle'
import { getPartDefaults, resolvePartTones } from './furnitureStyling'
import { getActiveDecorateRoom, useHomeStore } from './homeStore'
import { FurnitureIcon } from './illustrations'
import { FURNITURE_PALETTE as P } from './palette'
import type { FurniturePlacement } from './types'

const NEW_PRESETS: Array<[string, string, string]> = [
  ['light-gray', '라이트 그레이', '#D3D3D3'],
  ['gray', '그레이', '#929292'],
  ['charcoal', '차콜', '#41434A'],
  ['soft-black', '소프트 블랙', '#292929'],
  ['black', '블랙', '#171717'],
  ['red', '레드', '#D63845'],
  ['deep-red', '딥 레드', '#A82432'],
  ['wine', '와인', '#702C42'],
  ['burgundy', '버건디', '#581D32'],
  ['navy', '네이비', '#263653'],
  ['deep-brown', '딥 브라운', '#50382E'],
  ['forest-green', '포레스트 그린', '#244C3B'],
  ['plum', '플럼', '#583654'],
]

const ORIGINAL_FURNITURE_PRESET_IDS = [...SURFACE_COLOR_PRESETS.map((p) => p.id), 'sage-green', 'brown']

function icon(id: string, extras: { variant?: string; colors?: FurniturePlacement['colors']; patterns?: FurniturePlacement['patterns']; colorway?: string } = {}) {
  const definition = getFurnitureDefinition(id)!
  const size = getFurnitureSize(definition, extras.variant)
  return <FurnitureIcon furnitureId={id} width={size.width} height={size.height} colorway={extras.colorway ?? getDefaultColorway(id)} variant={extras.variant} colors={extras.colors} patterns={extras.patterns} />
}

function placement(furnitureId: string, overrides: Partial<FurniturePlacement> = {}): FurniturePlacement {
  return { id: `p-${furnitureId}`, furnitureId, x: 360, y: 330, scale: 1, rotation: 0, colorway: getDefaultColorway(furnitureId), layer: 0, ...overrides }
}

function resetRoom() {
  localStorage.clear()
  const room = useHomeStore.getInitialState().rooms[0]
  useHomeStore.setState({ rooms: [{ ...room, furniture: [] }], activeDecorateRoomId: room.id, activeLiveRoomId: room.id, selectedFurnitureId: null })
}

const current = () => getActiveDecorateRoom(useHomeStore.getState()).furniture[0]

describe('the palette (one source: colorPresets.ts)', () => {
  it('adds exactly the requested 13 colors with their names and values', () => {
    const added = [...GRAY_BLACK_COLOR_PRESETS, ...RED_WINE_COLOR_PRESETS, ...DEEP_COLOR_PRESETS]
    expect(added.map((p) => [p.id, p.label, p.hex])).toEqual(NEW_PRESETS)
  })

  it('groups them as 밝은 색상 / 회색·검정 / 빨강·와인 / 기타 진한 색상, in that order', () => {
    expect(FURNITURE_COLOR_GROUPS.map((g) => g.label)).toEqual(['밝은 색상', '회색·검정', '빨강·와인', '기타 진한 색상'])
    expect(FURNITURE_COLOR_GROUPS[1].presets).toBe(GRAY_BLACK_COLOR_PRESETS)
    expect(FURNITURE_COLOR_PRESETS).toEqual(FURNITURE_COLOR_GROUPS.flatMap((g) => g.presets))
  })

  it('keeps every existing color with the same id, label, value and order — the light group is exactly what furniture offered before', () => {
    expect(LIGHT_COLOR_PRESETS.map((p) => p.id)).toEqual(ORIGINAL_FURNITURE_PRESET_IDS)
    expect(LIGHT_COLOR_PRESETS.slice(0, 16)).toEqual(SURFACE_COLOR_PRESETS)
    expect(LIGHT_COLOR_PRESETS.find((p) => p.id === 'brown')).toEqual({ id: 'brown', label: '브라운', hex: '#B08968' })
    expect(LIGHT_COLOR_PRESETS.find((p) => p.id === 'sage-green')).toEqual({ id: 'sage-green', label: '세이지 그린', hex: '#BFDDA9' })
    expect(SURFACE_COLOR_PRESETS).toHaveLength(16) // wallpaper/floor palette untouched
    expect(SURFACE_COLOR_PRESETS[0]).toEqual({ id: 'ivory', label: '아이보리', hex: '#FFF8F0' })
  })

  it('has unique ids and valid hex values across the whole palette', () => {
    expect(new Set(FURNITURE_COLOR_PRESETS.map((p) => p.id)).size).toBe(FURNITURE_COLOR_PRESETS.length)
    for (const p of FURNITURE_COLOR_PRESETS) expect(p.hex).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })

  it('the wallpaper/floor picker is unchanged: a flat 16-swatch grid with no group headings', () => {
    const { container } = render(<ColorSwatchPicker value="#ffffff" onChange={() => {}} />)
    expect(container.querySelectorAll('.color-swatch')).toHaveLength(16)
    expect(container.querySelector('.color-swatch-group')).toBeNull()
  })

  it('whole-piece dark presets take their colors from the same palette, never a second copy', () => {
    const sofaCharcoal = getColorwayOptions('sofa').find((o) => o.id === 'charcoal')!
    expect(sofaCharcoal.swatch).toBe('#41434A')
    expect(SOFA_COLORWAYS.wine.body.fill).toBe('#702C42')
    expect(GENERIC_COLORWAYS.navy.main.fill).toBe('#263653')
    expect(getColorwayOptions('plant').find((o) => o.id === 'forest')!.swatch).toBe('#244C3B')
  })
})

describe('outline derivation', () => {
  it('pastel fills keep the darker outline they always had', () => {
    expect(toneFromHex('#ffffff').stroke).toBe('#dbdbdb')
    for (const p of LIGHT_COLOR_PRESETS) {
      const expected = [1, 3, 5].map((i) => Math.round(parseInt(p.hex.slice(i, i + 2), 16) * 0.86).toString(16).padStart(2, '0')).join('')
      expect(toneFromHex(p.hex).stroke, p.id).toBe(`#${expected}`)
    }
  })

  it('dark fills get a lighter outline so their edges stay visible, and every palette color has a readable edge', () => {
    for (const hex of ['#171717', '#292929', '#41434A', '#702C42', '#581D32', '#263653']) {
      expect(hexLuminance(toneFromHex(hex).stroke), hex).toBeGreaterThan(hexLuminance(hex))
    }
    for (const p of FURNITURE_COLOR_PRESETS) {
      const tone = toneFromHex(p.hex)
      expect(tone.fill).toBe(p.hex) // the fill is exactly what was picked
      expect(Math.abs(hexLuminance(tone.stroke) - hexLuminance(tone.fill)), p.id).toBeGreaterThanOrEqual(0.05)
    }
  })

  it('a new pattern on any palette color starts with a visible motif (readable on dark and light alike)', () => {
    for (const p of FURNITURE_COLOR_PRESETS) {
      const setting = defaultPatternSetting('star', toneFromHex(p.hex))
      expect(Math.abs(hexLuminance(setting.color) - hexLuminance(setting.baseColor)), p.id).toBeGreaterThanOrEqual(0.05)
    }
  })
})

describe('existing colorways are unchanged', () => {
  it('every piece keeps its original default colorway and the original presets first, in order', () => {
    const defaults: Record<string, string> = { sofa: 'rose', table: 'natural', bed: 'blush', plant: 'sage', rug: 'blush', window: 'cream' }
    for (const [id, colorway] of Object.entries(defaults)) expect(getDefaultColorway(id)).toBe(colorway)
    for (const f of FURNITURE_CATALOG.filter((p) => !(p.id in defaults))) expect(getDefaultColorway(f.id), f.id).toBe('cream')

    const original: Record<string, string[]> = {
      sofa: ['rose', 'cream'],
      table: ['natural', 'blush'],
      bed: ['blush', 'sky'],
      plant: ['sage', 'blush'],
      rug: ['blush', 'sage', 'sky'],
      window: ['cream', 'blush', 'lavender'],
      wardrobe: ['cream', 'rose', 'sky', 'mint', 'lavender', 'butter'],
    }
    for (const [id, ids] of Object.entries(original)) expect(getColorwayOptions(id).map((o) => o.id).slice(0, ids.length), id).toEqual(ids)
  })

  it('the original preset tones did not change', () => {
    expect(SOFA_COLORWAYS.rose.body).toEqual(P.pink)
    expect(SOFA_COLORWAYS.cream.cushion).toEqual(P.ivory)
    expect(GENERIC_COLORWAYS.cream).toEqual({ main: P.cream, accent: P.pink })
    expect(getPartDefaults('sofa', 'rose').legs).toEqual(P.taupe)
  })

  it('every piece with presets also offers the dark whole-piece presets, and each renders cleanly', () => {
    for (const f of FURNITURE_CATALOG) {
      const ids = getColorwayOptions(f.id).map((o) => o.id)
      if (f.id === 'plant') {
        expect(ids).toContain('forest')
        continue
      }
      for (const dark of ['charcoal', 'black', 'red', 'wine', 'navy', 'deep-brown']) expect(ids, `${f.id}/${dark}`).toContain(dark)
      for (const dark of ['charcoal', 'black', 'wine']) {
        const { container } = render(icon(f.id, { colorway: dark }))
        expect(container.innerHTML, `${f.id}/${dark}`).not.toMatch(/NaN|undefined/)
        cleanup()
      }
    }
  })

  it('a dark whole-piece preset actually paints the piece', () => {
    const { container } = render(icon('sofa', { colorway: 'charcoal' }))
    expect(container.innerHTML).toContain('#41434A')
    cleanup()
    expect(render(icon('rug', { colorway: 'wine' })).container.innerHTML).toContain('#702C42')
    cleanup()
    expect(render(icon('window', { colorway: 'navy' })).container.innerHTML).toContain('#263653')
    cleanup()
    expect(render(icon('wardrobe', { colorway: 'black' })).container.innerHTML).toContain('#171717')
  })
})

describe('new colors in the SVG', () => {
  afterEach(() => cleanup())

  const CASES: Array<[string, string]> = [
    ['sofa-long', 'body'],
    ['sofa-long', 'cushion'],
    ['coffee-table', 'top'],
    ['bed-double', 'blanket'],
    ['dining-chair', 'seat'],
    ['wardrobe', 'door'],
    ['cushion', 'body'],
    ['bunny-doll', 'body'],
    ['curtain', 'fabric'],
    ['rug', 'base'],
    ['window', 'frame'],
    ['window', 'curtain'],
  ]

  it('every new color paints the chosen part with that exact fill and a derived outline', () => {
    for (const [id, part] of CASES) {
      for (const [, , hex] of NEW_PRESETS) {
        const { container } = render(icon(id, { colors: { [part]: hex } }))
        const html = container.innerHTML.toLowerCase()
        expect(html, `${id}/${part}/${hex}`).toContain(`fill="${hex.toLowerCase()}"`)
        // The window's drapes are drawn without an outline (as they always were), so only their fill is checked.
        if (!(id === 'window' && part === 'curtain')) expect(html, `${id}/${part}/${hex}`).toContain(toneFromHex(hex).stroke.toLowerCase())
        cleanup()
      }
    }
  })

  it('rug body and border take new colors independently (본체·테두리)', () => {
    const { container } = render(icon('rug', { colors: { base: '#171717', border: '#D63845' } }))
    const ellipses = Array.from(container.querySelectorAll('ellipse'))
    expect(ellipses[1].getAttribute('fill')).toBe('#171717')
    expect(ellipses[1].getAttribute('stroke')).toBe('#D63845')
    expect(ellipses[2].getAttribute('stroke')).toBe('#D63845') // the woven-border ring follows the border color
  })

  it('the rug border follows its face until a border color is chosen, and the default look is exactly the original outline', () => {
    const base = getPartDefaults('rug', 'blush')
    expect(base.border.fill).toBe(base.base.stroke)
    expect(resolvePartTones('rug', 'blush').border.fill).toBe('#E39CB8')

    const face = resolvePartTones('rug', 'blush', { idPrefix: 'x', colors: { base: '#581D32' } })
    expect(face.border.fill).toBe(toneFromHex('#581D32').stroke) // recolored face -> border follows
    const own = resolvePartTones('rug', 'blush', { idPrefix: 'x', colors: { base: '#581D32', border: '#D3D3D3' } })
    expect(own.border.fill).toBe('#D3D3D3') // chosen border detaches
  })

  it('a dark body keeps its legs, handles, frames and shadows distinguishable', () => {
    // sofa: legs stay wood, edges stay outlined in a lighter tone, shadows are the palette shadows
    const { container } = render(icon('sofa-long', { colors: { body: '#171717' } }))
    const rects = Array.from(container.querySelectorAll('rect'))
    const legs = rects.filter((r) => r.getAttribute('fill') === P.taupe.fill)
    expect(legs.length).toBeGreaterThanOrEqual(3)
    const bodyShapes = rects.filter((r) => r.getAttribute('fill') === '#171717')
    expect(bodyShapes.length).toBeGreaterThan(0)
    for (const shape of bodyShapes) expect(shape.getAttribute('stroke')).not.toBe('#171717') // the edge never merges with the fill
    // The two ground-shadow ellipses (always the first two — GroundShadow renders before the body/SurfaceSheen
    // highlight) keep the palette's own shadow tones regardless of the dark body override; a body-color-independent
    // white SurfaceSheen highlight ellipse (see illustrations/parts.tsx) is expected to follow them and is not part
    // of what this test is checking.
    const ellipses = Array.from(container.querySelectorAll('ellipse'))
    expect(ellipses.slice(0, 2).map((e) => e.getAttribute('fill'))).toEqual([P.shadowAmbient, P.shadowContact])
    cleanup()

    // cabinet: black body, handles stay metal and doors stay their own tone
    const wardrobe = render(icon('wardrobe', { colors: { body: '#171717' } })).container
    const handles = Array.from(wardrobe.querySelectorAll('rect')).filter((r) => r.getAttribute('fill') === P.metal.fill)
    expect(handles).toHaveLength(2)
    expect(wardrobe.innerHTML).toContain(getPartDefaults('wardrobe', 'cream').door.fill)
    cleanup()

    // chair: black back and seat leave the wooden frame alone
    const chair = render(icon('dining-chair', { colors: { back: '#171717', seat: '#171717' } })).container
    expect(Array.from(chair.querySelectorAll('rect')).filter((r) => r.getAttribute('fill') === P.taupe.fill).length).toBeGreaterThanOrEqual(4)
  })

  it('making every part black at once still leaves each shape outlined and the shadows in place', () => {
    for (const f of FURNITURE_CATALOG.filter((p) => p.colorParts.length > 0 && p.zone === 'floor' && p.collision.mode === 'solid')) {
      const colors = Object.fromEntries(f.colorParts.map((p) => [p.id, '#171717']))
      const { container } = render(icon(f.id, { colors }))
      const blacks = Array.from(container.querySelectorAll('[fill="#171717"]'))
      expect(blacks.length, f.id).toBeGreaterThan(0)
      for (const el of blacks) {
        const stroke = el.getAttribute('stroke')
        if (stroke && stroke !== 'none') expect(hexLuminance(stroke.startsWith('#') ? stroke : '#000000'), `${f.id} outline`).toBeGreaterThan(hexLuminance('#171717'))
      }
      expect(Array.from(container.querySelectorAll('ellipse')).some((e) => e.getAttribute('fill') === P.shadowContact), `${f.id} shadow`).toBe(true)
      cleanup()
    }
  })

  it('dark rug and curtain keep readable patterns: background and motif colors are set independently', () => {
    const rugPattern: PatternSetting = { type: 'gingham', baseColor: '#171717', color: '#F7C6D9', size: 2 }
    const rug = render(icon('rug', { colors: { base: '#171717' }, patterns: { base: rugPattern } })).container
    const rugDef = rug.querySelector('pattern')!
    expect(rugDef.querySelector('rect')!.getAttribute('fill')).toBe('#171717') // background
    expect(rug.innerHTML).toContain('#F7C6D9') // motif
    cleanup()

    const curtain: PatternSetting = { type: 'star', baseColor: '#702C42', color: '#D3D3D3', size: 3 }
    const window = render(icon('window', { colors: { curtain: '#702C42' }, patterns: { curtain } })).container
    expect(window.querySelector('pattern rect')!.getAttribute('fill')).toBe('#702C42')
    expect(window.innerHTML).toContain('#D3D3D3')
    cleanup()

    const prop = render(icon('curtain', { patterns: { fabric: { type: 'ribbon', baseColor: '#263653', color: '#FBF3E4', size: 2 } } })).container
    expect(prop.querySelector('pattern rect')!.getAttribute('fill')).toBe('#263653')
  })
})

describe('color picker UI', () => {
  beforeEach(resetRoom)
  afterEach(() => cleanup())

  function select(furnitureId: string, extras: Partial<FurniturePlacement> = {}) {
    useHomeStore.getState().addFurniture(placement(furnitureId, { id: 'sel', ...extras }))
    useHomeStore.getState().selectFurniture('sel')
    return render(<FurniturePropertiesPanel />)
  }

  it('shows the palette in the four labeled groups, with the free color picker kept', () => {
    select('sofa')
    const groups = within(screen.getByRole('group', { name: '본체 색상 밝은 색상' })).getAllByRole('button')
    expect(groups).toHaveLength(LIGHT_COLOR_PRESETS.length)
    for (const label of ['밝은 색상', '회색·검정', '빨강·와인', '기타 진한 색상']) {
      expect(screen.getByRole('group', { name: `본체 색상 ${label}` })).toBeInTheDocument()
    }
    expect(screen.getByLabelText('본체 색상 직접 선택')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '본체 색상 버건디' })).toBeInTheDocument()
  })

  it('all three furniture pickers (part color, pattern background, motif color) offer the same full palette', async () => {
    const user = userEvent.setup()
    const { container } = select('sofa')
    await user.selectOptions(screen.getByLabelText('방석 패턴 종류'), 'gingham')
    const pickers = Array.from(container.querySelectorAll('.color-swatch-picker'))
    expect(pickers).toHaveLength(3)
    for (const picker of pickers) expect(picker.querySelectorAll('.color-swatch')).toHaveLength(FURNITURE_COLOR_PRESETS.length)
  })

  it('picks a dark color for a part, the pattern background and the motif independently', async () => {
    const user = userEvent.setup()
    select('sofa')
    await user.click(screen.getByRole('button', { name: '본체 색상 차콜' }))
    expect(current().colors).toEqual({ body: '#41434A' })

    await user.selectOptions(screen.getByLabelText('방석 패턴 종류'), 'heart')
    await user.click(screen.getByRole('button', { name: '패턴 배경색 블랙' }))
    expect(current().patterns?.cushion).toMatchObject({ baseColor: '#171717' })
    const motifBefore = current().patterns!.cushion.color
    await user.click(screen.getByRole('button', { name: '패턴 무늬 색상 레드' }))
    expect(current().patterns?.cushion).toMatchObject({ baseColor: '#171717', color: '#D63845' })
    expect(motifBefore).not.toBe('#D63845')
    await user.click(screen.getByRole('button', { name: '패턴 배경색 와인' }))
    expect(current().patterns?.cushion).toMatchObject({ baseColor: '#702C42', color: '#D63845' }) // changing one never touches the other
  })

  it('a custom hex still works alongside the new presets', () => {
    select('bed-single')
    fireEvent.click(within(screen.getByRole('group', { name: '색상을 바꿀 부위' })).getByRole('button', { name: '이불' }))
    fireEvent.change(screen.getByLabelText('이불 색상 직접 선택'), { target: { value: '#123456' } })
    expect(current().colors).toEqual({ blanket: '#123456' })
  })

  it('offers dark colors for the rug body and border, and the window frame and curtain', async () => {
    const user = userEvent.setup()
    select('rug')
    await user.click(screen.getByRole('button', { name: '러그 바탕 색상 소프트 블랙' }))
    await user.click(within(screen.getByRole('group', { name: '색상을 바꿀 부위' })).getByRole('button', { name: '러그 테두리' }))
    await user.click(screen.getByRole('button', { name: '러그 테두리 색상 딥 레드' }))
    expect(current().colors).toEqual({ base: '#292929', border: '#A82432' })
    cleanup()
    resetRoom()

    select('window')
    await user.click(screen.getByRole('button', { name: '프레임 색상 딥 브라운' }))
    await user.click(within(screen.getByRole('group', { name: '색상을 바꿀 부위' })).getByRole('button', { name: '커튼' }))
    await user.click(screen.getByRole('button', { name: '커튼 색상 버건디' }))
    expect(current().colors).toEqual({ frame: '#50382E', curtain: '#581D32' })
  })

  it('the preview shows the chosen dark color as soon as it is picked, and 기본색으로 restores the default', async () => {
    const user = userEvent.setup()
    const { container } = select('coffee-table')
    await user.click(screen.getByRole('button', { name: '상판 색상 블랙' }))
    expect(container.querySelector('.furniture-properties-preview')!.innerHTML).toContain('#171717')
    await user.click(screen.getByRole('button', { name: '상판 기본색으로' }))
    expect(container.querySelector('.furniture-properties-preview')!.innerHTML).not.toContain('#171717')
  })

  it('the rug border can be reset to follow the face again', async () => {
    const user = userEvent.setup()
    select('rug')
    await user.click(within(screen.getByRole('group', { name: '색상을 바꿀 부위' })).getByRole('button', { name: '러그 테두리' }))
    await user.click(screen.getByRole('button', { name: '러그 테두리 색상 네이비' }))
    expect(current().colors).toEqual({ border: '#263653' })
    await user.click(screen.getByRole('button', { name: '러그 테두리 기본색으로' }))
    expect(current().colors).toBeUndefined()
  })
})

describe('storage', () => {
  beforeEach(resetRoom)
  afterEach(() => cleanup())

  it('saves new colors with the placement (schema 5) and restores them after a reload', async () => {
    useHomeStore.getState().addFurniture(placement('sofa', { id: 's' }))
    useHomeStore.getState().addFurniture(placement('rug', { id: 'r' }))
    useHomeStore.getState().addFurniture(placement('window', { id: 'w' }))
    useHomeStore.getState().addFurniture(placement('curtain', { id: 'c' }))
    useHomeStore.getState().updateFurniture('s', { colors: { body: '#171717', legs: '#50382E' } })
    useHomeStore.getState().updateFurniture('r', { colors: { base: '#581D32', border: '#D3D3D3' }, patterns: { base: { type: 'tartan', baseColor: '#581D32', color: '#929292', size: 3 } } })
    useHomeStore.getState().updateFurniture('w', { colors: { frame: '#292929', curtain: '#263653' } })
    useHomeStore.getState().updateFurniture('c', { colors: { fabric: '#583654' } })

    const raw = localStorage.getItem('dearly-home')!
    expect(JSON.parse(raw).version).toBe(5)
    useHomeStore.setState({ rooms: [{ ...useHomeStore.getState().rooms[0], furniture: [] }] })
    localStorage.setItem('dearly-home', raw)
    await useHomeStore.persist.rehydrate()

    const byId = Object.fromEntries(getActiveDecorateRoom(useHomeStore.getState()).furniture.map((f) => [f.id, f]))
    expect(byId.s.colors).toEqual({ body: '#171717', legs: '#50382E' })
    expect(byId.r.colors).toEqual({ base: '#581D32', border: '#D3D3D3' })
    expect(byId.r.patterns?.base).toMatchObject({ type: 'tartan', baseColor: '#581D32', color: '#929292', size: 3 })
    expect(byId.w.colors).toEqual({ frame: '#292929', curtain: '#263653' })
    expect(byId.c.colors).toEqual({ fabric: '#583654' })
  })

  it('existing saved colors, layouts and rooms load exactly as before', async () => {
    const base = useHomeStore.getInitialState().rooms[0]
    const sofa = { id: 'a', furnitureId: 'sofa', x: 200, y: 310, scale: 1.1, rotation: 180, colorway: 'cream', layer: 3, colors: { cushion: '#F7C6D9' } }
    const rug = { id: 'b', furnitureId: 'rug', x: 300, y: 380, scale: 1, rotation: 0, colorway: 'sage', layer: -1, variant: 'heart', colors: { base: '#BFDDA9' } }
    const rooms = [
      { ...base, id: 'r1', furniture: [sofa, rug] },
      { ...base, id: 'r2', kind: 'bedroom' as const, name: '침실', furniture: [] },
    ]
    localStorage.setItem('dearly-home', JSON.stringify({ state: { rooms, activeDecorateRoomId: 'r2', activeLiveRoomId: 'r1' }, version: 5 }))
    await useHomeStore.persist.rehydrate()
    const state = useHomeStore.getState()
    expect(state.rooms[0].furniture).toEqual([sofa, rug])
    expect(state.rooms.map((r) => r.id)).toEqual(['r1', 'r2'])
    expect(state.activeDecorateRoomId).toBe('r2')
  })

  it('a saved rug with no border color still draws its original outline (nothing needs migrating)', async () => {
    const base = useHomeStore.getInitialState().rooms[0]
    const rug = { id: 'b', furnitureId: 'rug', x: 300, y: 380, scale: 1, rotation: 0, colorway: 'blush', layer: -1, colors: { base: '#A82432' } }
    localStorage.setItem('dearly-home', JSON.stringify({ state: { rooms: [{ ...base, id: 'r1', furniture: [rug] }], activeDecorateRoomId: 'r1', activeLiveRoomId: 'r1' }, version: 4 }))
    await useHomeStore.persist.rehydrate()
    const saved = useHomeStore.getState().rooms[0].furniture[0]
    expect(saved).toEqual(rug)
    const { container } = render(icon('rug', { colors: saved.colors, colorway: saved.colorway }))
    expect(container.querySelectorAll('ellipse')[1].getAttribute('stroke')).toBe(toneFromHex('#A82432').stroke)
  })

  it('different rooms keep different new-color choices', () => {
    const first = useHomeStore.getState().rooms[0].id
    const second = useHomeStore.getState().addRoom('bedroom', '침실', 'empty')
    useHomeStore.getState().addFurniture(placement('sofa', { id: 'a' }))
    useHomeStore.getState().updateFurniture('a', { colors: { body: '#171717' } })
    useHomeStore.getState().setActiveDecorateRoom(second)
    useHomeStore.getState().addFurniture(placement('sofa', { id: 'b' }))
    useHomeStore.getState().updateFurniture('b', { colors: { body: '#D63845' } })
    const rooms = useHomeStore.getState().rooms
    expect(rooms.find((r) => r.id === first)!.furniture[0].colors).toEqual({ body: '#171717' })
    expect(rooms.find((r) => r.id === second)!.furniture[0].colors).toEqual({ body: '#D63845' })
  })
})
