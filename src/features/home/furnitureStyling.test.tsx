import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LiveRoomView } from '../simulation/LiveRoomView'
import { BED_COLORWAYS, getDefaultColorway, SOFA_COLORWAYS, TABLE_COLORWAYS } from './colorways'
import { FURNITURE_COLOR_PRESETS, SURFACE_COLOR_PRESETS } from './colorPresets'
import { FURNITURE_CATALOG, getFurnitureDefinition } from './furnitureCatalog'
import { FurniturePropertiesPanel } from './FurniturePropertiesPanel'
import {
  FURNITURE_PATTERN_LABELS,
  FURNITURE_PATTERN_ORDER,
  normalizePartColors,
  normalizePatterns,
  PATTERN_TILE_UNITS,
  toneFromHex,
  type PatternSetting,
} from './furnitureStyle'
import { getPartDefaults, resolvePartTones } from './furnitureStyling'
import { getActiveDecorateRoom, useHomeStore } from './homeStore'
import { FurnitureIcon } from './illustrations'
import { FURNITURE_PALETTE as P } from './palette'
import type { FurniturePlacement } from './types'

const PATTERN_TYPES = FURNITURE_PATTERN_ORDER.filter((type): type is PatternSetting['type'] => type !== 'solid')
const STYLED = FURNITURE_CATALOG.filter((f) => f.colorParts.length > 0)
const PATTERNABLE = FURNITURE_CATALOG.filter((f) => f.patternSurfaces.length > 0)

function pattern(type: PatternSetting['type'] = 'gingham', size: PatternSetting['size'] = 2): PatternSetting {
  return { type, baseColor: '#ffd9e6', color: '#f7c6d9', size }
}

function icon(
  id: string,
  extras: { colors?: FurniturePlacement['colors']; patterns?: FurniturePlacement['patterns']; colorway?: string } = {},
) {
  const definition = getFurnitureDefinition(id)!
  return <FurnitureIcon furnitureId={id} width={definition.width} height={definition.height} colorway={extras.colorway ?? getDefaultColorway(id)} colors={extras.colors} patterns={extras.patterns} />
}

function html(id: string, extras: Parameters<typeof icon>[1] = {}) {
  const { container } = render(icon(id, extras))
  const result = container.innerHTML
  cleanup()
  return result
}

function placement(furnitureId: string, overrides: Partial<FurniturePlacement> = {}): FurniturePlacement {
  return { id: `p-${furnitureId}`, furnitureId, x: 300, y: 300, scale: 1, rotation: 0, colorway: getDefaultColorway(furnitureId), layer: 0, ...overrides }
}

function resetRoom() {
  localStorage.clear()
  const room = useHomeStore.getInitialState().rooms[0]
  useHomeStore.setState({ rooms: [{ ...room, furniture: [] }], activeDecorateRoomId: room.id, activeLiveRoomId: room.id, selectedFurnitureId: null })
}

describe('part and surface declarations', () => {
  it('every piece declares exactly the parts that have a default tone, with unique ids', () => {
    for (const f of FURNITURE_CATALOG) {
      const ids = f.colorParts.map((p) => p.id)
      expect(new Set(ids).size, f.id).toBe(ids.length)
      expect([...ids].sort(), f.id).toEqual(Object.keys(getPartDefaults(f.id, getDefaultColorway(f.id))).sort())
    }
  })

  it('every pattern surface is also a part (so a fresh pattern can start tone-on-tone) and only fabric surfaces are patternable', () => {
    for (const f of PATTERNABLE) {
      for (const surface of f.patternSurfaces) expect(f.colorParts.map((p) => p.id), `${f.id}/${surface.id}`).toContain(surface.id)
    }
    const surfaces = PATTERNABLE.flatMap((f) => f.patternSurfaces.map((s) => s.id))
    for (const forbidden of ['legs', 'handle', 'frame', 'top', 'shade']) expect(surfaces).not.toContain(forbidden)
  })

  it('matches the requested part sets: sofa 본체/방석/다리, bed 프레임/이불/베개, table 상판/다리, chair 좌판/등받이/프레임, cabinet 본체/문/손잡이', () => {
    const labels = (id: string) => getFurnitureDefinition(id)!.colorParts.map((p) => p.label)
    for (const id of ['sofa', 'sofa-single', 'sofa-long', 'armchair']) expect(labels(id)).toEqual(['본체', '방석', '다리'])
    for (const id of ['bed', 'bed-single', 'bed-double']) expect(labels(id)).toEqual(expect.arrayContaining(['프레임', '이불', '베개']))
    for (const id of ['table', 'coffee-table', 'side-table', 'dining-table']) expect(labels(id)).toEqual(['상판', '다리'])
    for (const id of ['dining-chair', 'office-chair']) expect(labels(id)).toEqual(['좌판', '등받이', '프레임'])
    for (const id of ['tv-stand', 'wardrobe']) expect(labels(id)).toEqual(['본체', '문', '손잡이'])
  })

  it('the plant (the only piece left with just its preset colorways) declares nothing recolorable', () => {
    expect(getFurnitureDefinition('plant')!.colorParts).toEqual([])
    expect(getFurnitureDefinition('plant')!.patternSurfaces).toEqual([])
  })
})

describe('existing designs are unchanged', () => {
  it('original sofa/table/bed defaults are exactly their preset tables', () => {
    for (const cw of ['rose', 'cream']) {
      const t = getPartDefaults('sofa', cw)
      expect(t.body).toEqual(SOFA_COLORWAYS[cw].body)
      expect(t.cushion).toEqual(SOFA_COLORWAYS[cw].cushion)
      expect(t.legs).toEqual(P.taupe)
    }
    for (const cw of ['natural', 'blush']) expect(getPartDefaults('table', cw).top).toEqual(TABLE_COLORWAYS[cw].top)
    for (const cw of ['blush', 'sky']) {
      const t = getPartDefaults('bed', cw)
      expect(t.blanket).toEqual(BED_COLORWAYS[cw].accent)
      expect(t.frame).toEqual(P.taupe)
      expect(t.headboard).toEqual(P.taupe)
      expect(t.pillow).toEqual(P.ivory)
    }
  })

  it('an empty customization renders byte-identical SVG to no customization, for every piece', () => {
    for (const f of FURNITURE_CATALOG) {
      expect(html(f.id, { colors: {}, patterns: {} }), f.id).toBe(html(f.id))
    }
  })

  it('unknown part ids and malformed colors in a placement are ignored', () => {
    const base = html('sofa')
    expect(html('sofa', { colors: { nope: '#123456', body: 'not-a-color' } })).toBe(base)
  })
})

describe('part colors', () => {
  it('recoloring any part of any piece shows up in that piece\'s SVG', () => {
    for (const f of STYLED) {
      for (const part of f.colorParts) {
        const output = html(f.id, { colors: { [part.id]: '#123456' } })
        expect(output, `${f.id}/${part.id}`).toContain('#123456')
        expect(output, `${f.id}/${part.id}`).not.toBe(html(f.id))
      }
    }
  })

  it('recoloring one part leaves the others alone (sofa cushion vs legs)', () => {
    const tones = resolvePartTones('sofa-long', 'cream', { idPrefix: 'x' })
    const { container } = render(icon('sofa-long', { colors: { cushion: '#ff0000' } }))
    const rects = Array.from(container.querySelectorAll('rect'))
    expect(rects.filter((r) => r.getAttribute('fill') === '#ff0000')).toHaveLength(3) // three cushions
    expect(rects.filter((r) => r.getAttribute('fill') === tones.legs.fill).length).toBeGreaterThanOrEqual(3) // legs untouched
    expect(rects.filter((r) => r.getAttribute('fill') === tones.body.fill).length).toBeGreaterThan(0) // body untouched
  })

  it('the derived outline is a darker shade of the picked color', () => {
    expect(toneFromHex('#ffffff').stroke).toBe('#dbdbdb')
    expect(toneFromHex('#f7c6d9').fill).toBe('#f7c6d9')
    const { container } = render(icon('side-table', { colors: { top: '#f7c6d9' } }))
    expect(container.innerHTML).toContain(toneFromHex('#f7c6d9').stroke)
  })

  it('normalizers keep only valid hex colors and valid patterns, and return undefined when nothing survives', () => {
    expect(normalizePartColors({ body: '#aabbcc', legs: 'blue', x: 5 })).toEqual({ body: '#aabbcc' })
    expect(normalizePartColors({})).toBeUndefined()
    expect(normalizePartColors(null)).toBeUndefined()
    expect(normalizePartColors(['#ffffff'])).toBeUndefined()
    expect(normalizePatterns({ cushion: pattern('heart', 3), blanket: { type: 'solid', baseColor: '#ffffff', color: '#000000', size: 1 }, seat: { type: 'nope' } })).toEqual({ cushion: pattern('heart', 3) })
    expect(normalizePatterns({ cushion: { type: 'star', baseColor: '#ffffff', color: '#000000', size: 9 } })?.cushion.size).toBe(2)
    expect(normalizePatterns('junk')).toBeUndefined()
  })
})

describe('patterns', () => {
  it('lists the 12 requested patterns (including 단색)', () => {
    expect(Object.values(FURNITURE_PATTERN_LABELS)).toEqual(['단색', '작은 도트', '큰 도트', '세로 스트라이프', '가로 스트라이프', '깅엄 체크', '타탄 체크', '작은 꽃무늬', '장미', '하트', '리본', '별'])
  })

  it('every pattern type renders on every patternable surface, with its background and motif colors', () => {
    for (const f of PATTERNABLE) {
      for (const surface of f.patternSurfaces) {
        for (const type of PATTERN_TYPES) {
          const { container } = render(icon(f.id, { patterns: { [surface.id]: { type, baseColor: '#abcdef', color: '#fedcba', size: 2 } } }))
          const def = container.querySelector('defs pattern')
          expect(def, `${f.id}/${surface.id}/${type}`).not.toBeNull()
          const output = container.innerHTML
          expect(output).toContain('#abcdef')
          expect(output).toContain('#fedcba')
          const id = def!.getAttribute('id')!
          expect(container.querySelectorAll(`[fill="url(#${id})"]`).length, `${f.id}/${surface.id}/${type}`).toBeGreaterThan(0)
          cleanup()
        }
      }
    }
  })

  it('has three size steps that change the tile size, larger steps giving larger tiles', () => {
    for (const type of PATTERN_TYPES) {
      const widths = ([1, 2, 3] as const).map((size) => {
        const { container } = render(icon('cushion', { patterns: { body: pattern(type, size) } }))
        const width = Number(container.querySelector('pattern')!.getAttribute('width'))
        cleanup()
        return width
      })
      expect(widths[0], type).toBeLessThan(widths[1])
      expect(widths[1], type).toBeLessThan(widths[2])
    }
    expect(PATTERN_TILE_UNITS[1]).toBeLessThan(PATTERN_TILE_UNITS[3])
  })

  it('small and large dots are genuinely different patterns', () => {
    const small = html('cushion', { patterns: { body: pattern('dot-small') } })
    const large = html('cushion', { patterns: { body: pattern('dot-large') } })
    expect(small).not.toBe(large)
  })

  it('only fabric shapes get the pattern — never legs, handles or shadows', () => {
    const { container } = render(icon('sofa', { patterns: { body: pattern('star'), cushion: pattern('heart') } }))
    const ids = Array.from(container.querySelectorAll('pattern')).map((p) => p.getAttribute('id'))
    expect(ids).toHaveLength(2)
    const patterned = Array.from(container.querySelectorAll('[fill^="url(#"]'))
    expect(patterned.length).toBe(1 + 2 + 1 + 2) // backrest, 2 arms, frame, 2 cushions
    expect(patterned.every((el) => el.tagName.toLowerCase() === 'rect')).toBe(true)
    const legs = Array.from(container.querySelectorAll('rect')).filter((r) => r.getAttribute('fill') === P.taupe.fill)
    expect(legs).toHaveLength(2)
    const shadows = Array.from(container.querySelectorAll('ellipse'))
    expect(shadows.every((e) => !e.getAttribute('fill')!.startsWith('url('))).toBe(true)

    const chair = render(icon('dining-chair', { patterns: { seat: pattern('ribbon') } })).container
    expect(chair.querySelectorAll('[fill^="url(#"]')).toHaveLength(1) // seat only, not frame/back
    cleanup()

    const cabinet = getFurnitureDefinition('kitchen-cabinet')!
    expect(cabinet.patternSurfaces).toEqual([]) // handles/doors of cabinets can't be patterned at all
  })

  it('a patterned surface with no pattern falls back to its plain part color', () => {
    const { container } = render(icon('bed-double', { colors: { blanket: '#123456' } }))
    expect(container.querySelector('defs')).toBeNull()
    expect(container.innerHTML).toContain('#123456')
  })
})

describe('pattern id uniqueness', () => {
  it('several patterned pieces (incl. the same piece twice) in one document never share an id, and every reference resolves', () => {
    const { container } = render(
      <div>
        {icon('sofa', { patterns: { body: pattern('star'), cushion: pattern('heart') } })}
        {icon('sofa', { patterns: { body: pattern('star'), cushion: pattern('heart') } })}
        {icon('sofa-long', { patterns: { cushion: pattern('tartan') } })}
        {icon('cushion', { patterns: { body: pattern('rose') } })}
        {icon('cushion', { patterns: { body: pattern('rose') } })}
        {icon('bed', { patterns: { blanket: pattern('ribbon'), pillow: pattern('floral') } })}
        {icon('curtain', { patterns: { fabric: pattern('gingham') } })}
        {icon('dining-chair', { patterns: { seat: pattern('dot-large') } })}
      </div>,
    )
    const ids = Array.from(container.querySelectorAll('[id]')).map((el) => el.getAttribute('id')!)
    expect(ids).toHaveLength(2 + 2 + 1 + 1 + 1 + 2 + 1 + 1)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]+$/)

    const references = Array.from(container.querySelectorAll('[fill^="url(#"]')).map((el) => el.getAttribute('fill')!.slice(5, -1))
    expect(references.length).toBeGreaterThan(0)
    for (const reference of references) expect(ids).toContain(reference)
  })

  it('a catalog-style preview and a placed copy of the same patterned piece get different ids', () => {
    const { container } = render(
      <div>
        {icon('cushion', { patterns: { body: pattern('star') } })}
        {icon('cushion', { patterns: { body: pattern('star') } })}
      </div>,
    )
    const [a, b] = Array.from(container.querySelectorAll('pattern')).map((p) => p.getAttribute('id'))
    expect(a).not.toBe(b)
  })
})

describe('palette', () => {
  it('offers all the requested pastel colors while keeping the existing wallpaper/floor presets', () => {
    const labels = FURNITURE_COLOR_PRESETS.map((p) => p.label)
    for (const wanted of ['딸기우유 핑크', '베이비 핑크', '로즈 핑크', '아이보리', '크림', '버터 옐로', '피치', '라벤더', '라일락', '베이비 블루', '세이지 그린', '민트', '베이지', '브라운', '화이트']) {
      expect(labels, wanted).toContain(wanted)
    }
    for (const preset of SURFACE_COLOR_PRESETS) expect(FURNITURE_COLOR_PRESETS).toContainEqual(preset)
    expect(new Set(FURNITURE_COLOR_PRESETS.map((p) => p.id)).size).toBe(FURNITURE_COLOR_PRESETS.length)
  })
})

describe('store: persistence, per-room independence, migration', () => {
  beforeEach(resetRoom)
  afterEach(() => cleanup())

  it('saves colors and patterns with the placement (current schema) and restores them after a reload', async () => {
    useHomeStore.getState().addFurniture(placement('sofa', { id: 's1' }))
    useHomeStore.getState().updateFurniture('s1', { colors: { cushion: '#aabbcc' }, patterns: { body: pattern('star', 3) } })

    const saved = JSON.parse(localStorage.getItem('dearly-home')!)
    expect(saved.version).toBe(5)
    expect(saved.state.rooms[0].furniture[0]).toMatchObject({ colors: { cushion: '#aabbcc' }, patterns: { body: pattern('star', 3) } })

    const raw = localStorage.getItem('dearly-home')!
    useHomeStore.setState({ rooms: [{ ...useHomeStore.getState().rooms[0], furniture: [] }] })
    localStorage.setItem('dearly-home', raw)
    await useHomeStore.persist.rehydrate()
    expect(getActiveDecorateRoom(useHomeStore.getState()).furniture[0]).toMatchObject({ id: 's1', colors: { cushion: '#aabbcc' }, patterns: { body: pattern('star', 3) } })
  })

  it('clearing colors/patterns removes the keys entirely', () => {
    useHomeStore.getState().addFurniture(placement('sofa', { id: 's1', colors: { body: '#aabbcc' }, patterns: { body: pattern() } }))
    useHomeStore.getState().updateFurniture('s1', { colors: undefined, patterns: undefined })
    const f = getActiveDecorateRoom(useHomeStore.getState()).furniture[0]
    expect('colors' in f).toBe(false)
    expect('patterns' in f).toBe(false)
  })

  it('each of up to five rooms keeps its own customizations, independent of the others', () => {
    const first = useHomeStore.getState().rooms[0].id
    const others = [useHomeStore.getState().addRoom('bedroom', '침실', 'empty'), useHomeStore.getState().addRoom('kitchen', '주방', 'empty'), useHomeStore.getState().addRoom('study', '서재', 'empty'), useHomeStore.getState().addRoom('hobby', '취미방', 'empty')]
    const all = [first, ...others]
    expect(useHomeStore.getState().rooms).toHaveLength(5)

    all.forEach((roomId, i) => {
      useHomeStore.getState().setActiveDecorateRoom(roomId)
      useHomeStore.getState().addFurniture(placement('sofa', { id: `s${i}` }))
      useHomeStore.getState().updateFurniture(`s${i}`, { colors: { body: `#00000${i}` }, patterns: i % 2 === 0 ? { cushion: pattern('heart', ((i % 3) + 1) as 1 | 2 | 3) } : undefined })
    })
    all.forEach((roomId, i) => {
      const room = useHomeStore.getState().rooms.find((r) => r.id === roomId)!
      expect(room.furniture).toHaveLength(1)
      expect(room.furniture[0].colors).toEqual({ body: `#00000${i}` })
      expect(Boolean(room.furniture[0].patterns)).toBe(i % 2 === 0)
    })
  })

  it('migrates a version-3 save untouched: every field of every placement, both surfaces, all rooms and the active ids survive', async () => {
    const base = useHomeStore.getInitialState().rooms[0]
    const oldFurniture = [
      { id: 'a', furnitureId: 'sofa', x: 200, y: 310, scale: 1.1, rotation: 180, colorway: 'cream', layer: 3 },
      { id: 'b', furnitureId: 'bed', x: 500, y: 300, scale: 0.9, rotation: 0, colorway: 'sky', layer: 4 },
      { id: 'c', furnitureId: 'rug', x: 300, y: 380, scale: 1, rotation: 0, colorway: 'sage', layer: -1 },
    ]
    const rooms = [
      { ...base, id: 'r1', name: '거실', furniture: oldFurniture, wallpaper: { ...base.wallpaper, baseColor: '#ffd9e6' }, floor: { ...base.floor, baseColor: '#e7d0ab' } },
      { ...base, id: 'r2', kind: 'bedroom' as const, name: '침실', furniture: [oldFurniture[1]] },
    ]
    localStorage.setItem('dearly-home', JSON.stringify({ state: { rooms, activeDecorateRoomId: 'r2', activeLiveRoomId: 'r1' }, version: 3 }))
    await useHomeStore.persist.rehydrate()

    const state = useHomeStore.getState()
    expect(state.rooms.map((r) => r.id)).toEqual(['r1', 'r2'])
    expect(state.rooms[0].furniture).toEqual(oldFurniture) // toEqual: no colors/patterns keys appear
    expect(state.rooms[1].furniture).toEqual([oldFurniture[1]])
    expect(state.rooms[0].wallpaper).toEqual(rooms[0].wallpaper)
    expect(state.rooms[0].floor).toEqual(rooms[0].floor)
    expect(state.rooms[1].name).toBe('침실')
    expect(state.activeDecorateRoomId).toBe('r2')
    expect(state.activeLiveRoomId).toBe('r1')
  })

  it('the explicit migration steps drop malformed values under the newer keys but never touch anything else', () => {
    const base = useHomeStore.getInitialState().rooms[0]
    const furniture = [{ id: 'a', furnitureId: 'sofa', x: 1, y: 2, scale: 1, rotation: 0, colorway: 'rose', layer: 0, colors: { body: 'red' }, patterns: { cushion: { type: 'solid' } } }]
    const migrate = useHomeStore.persist.getOptions().migrate!
    const result = migrate({ rooms: [{ ...base, id: 'r1', furniture }], activeDecorateRoomId: 'r1', activeLiveRoomId: 'r1' }, 3) as { rooms: Array<{ furniture: FurniturePlacement[] }> }
    expect(result.rooms[0].furniture[0]).toEqual({ id: 'a', furnitureId: 'sofa', x: 1, y: 2, scale: 1, rotation: 0, colorway: 'rose', layer: 0 })
  })

  it('older saves (v0, v2) still migrate through to the current shape', () => {
    const migrate = useHomeStore.persist.getOptions().migrate!
    const v0 = migrate({ furniture: [{ id: 'a', furnitureId: 'sofa' }], showWindow: false, showRug: false }, 0) as { rooms: Array<{ furniture: FurniturePlacement[] }> }
    expect(v0.rooms).toHaveLength(1)
    expect(v0.rooms[0].furniture[0]).toMatchObject({ id: 'a', furnitureId: 'sofa', scale: 1, rotation: 0 })
    const v2 = migrate({ furniture: [{ id: 'b', furnitureId: 'bed', x: 5, y: 6 }], wallpaper: { baseColor: '#ffffff' } }, 2) as { rooms: Array<{ furniture: FurniturePlacement[]; wallpaper: { baseColor: string } }> }
    expect(v2.rooms[0].furniture[0]).toMatchObject({ id: 'b', x: 5, y: 6 })
    expect(v2.rooms[0].wallpaper.baseColor).toBe('#ffffff')
  })

  it('a live room renders customized furniture (colors and patterns) like the decorate room', () => {
    useHomeStore.getState().addFurniture(placement('cushion', { id: 'c1', colors: { body: '#123456' }, patterns: { body: pattern('heart') } }))
    const { container } = render(<LiveRoomView />)
    expect(container.querySelector('.live-room-furniture pattern')).not.toBeNull()
    expect(container.innerHTML).toContain('#ffd9e6')
  })
})

describe('editing panel', () => {
  beforeEach(resetRoom)
  afterEach(() => cleanup())

  function select(furnitureId: string, extras: Partial<FurniturePlacement> = {}) {
    useHomeStore.getState().addFurniture(placement(furnitureId, { id: 'sel', ...extras }))
    useHomeStore.getState().selectFurniture('sel')
    return render(<FurniturePropertiesPanel />)
  }
  const current = () => getActiveDecorateRoom(useHomeStore.getState()).furniture[0]

  it('shows only the parts and surfaces the selected piece supports', () => {
    const sofa = select('sofa')
    const parts = within(screen.getByRole('group', { name: '색상을 바꿀 부위' }))
    expect(parts.getAllByRole('button').map((b) => b.textContent)).toEqual(['본체', '방석', '다리'])
    expect(screen.getByRole('group', { name: '패턴을 넣을 표면' })).toBeInTheDocument()
    sofa.unmount()
    resetRoom()

    select('table')
    expect(within(screen.getByRole('group', { name: '색상을 바꿀 부위' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['상판', '다리'])
    expect(screen.queryByText('패턴')).not.toBeInTheDocument() // a table has no fabric surface
    cleanup()
    resetRoom()

    select('plant')
    expect(screen.queryByText('부위별 색상')).not.toBeInTheDocument()
    expect(screen.queryByText('패턴')).not.toBeInTheDocument()
    expect(screen.getByText('색상')).toBeInTheDocument() // the preset colorway swatches remain
  })

  it('recolors the selected part immediately from a preset swatch, and only that part', async () => {
    const user = userEvent.setup()
    select('sofa')
    const parts = within(screen.getByRole('group', { name: '색상을 바꿀 부위' }))
    await user.click(parts.getByRole('button', { name: '방석' }))
    await user.click(screen.getByRole('button', { name: '방석 색상 라일락' }))
    expect(current().colors).toEqual({ cushion: '#E6D6F2' })
    await user.click(parts.getByRole('button', { name: '다리' }))
    await user.click(screen.getByRole('button', { name: '다리 색상 브라운' }))
    expect(current().colors).toEqual({ cushion: '#E6D6F2', legs: '#B08968' })
  })

  it('accepts a free color code from the color picker', () => {
    select('bed')
    fireEvent.click(within(screen.getByRole('group', { name: '색상을 바꿀 부위' })).getByRole('button', { name: '이불' }))
    fireEvent.change(screen.getByLabelText('이불 색상 직접 선택'), { target: { value: '#123456' } })
    expect(current().colors).toEqual({ blanket: '#123456' })
  })

  it('resets a part back to its default color', async () => {
    const user = userEvent.setup()
    select('sofa', { colors: { body: '#123456' } })
    await user.click(screen.getByRole('button', { name: '본체 기본색으로' }))
    expect(current().colors).toBeUndefined()
    expect(screen.queryByRole('button', { name: '본체 기본색으로' })).not.toBeInTheDocument()
  })

  it('adds, edits and removes a pattern: type, background color, motif color and size', async () => {
    const user = userEvent.setup()
    select('sofa')
    const type = screen.getByLabelText('방석 패턴 종류')
    expect(screen.queryByRole('group', { name: '패턴 크기' })).not.toBeInTheDocument()

    await user.selectOptions(type, 'tartan')
    expect(current().patterns?.cushion).toMatchObject({ type: 'tartan', size: 2 })
    expect(screen.getByRole('group', { name: '패턴 크기' })).toBeInTheDocument()

    await user.click(within(screen.getByRole('group', { name: '패턴 크기' })).getByRole('button', { name: '크게' }))
    expect(current().patterns?.cushion.size).toBe(3)
    await user.click(within(screen.getByRole('group', { name: '패턴 크기' })).getByRole('button', { name: '작게' }))
    expect(current().patterns?.cushion.size).toBe(1)

    await user.click(screen.getByRole('button', { name: '패턴 배경색 로즈 핑크' }))
    expect(current().patterns?.cushion.baseColor).toBe('#F7C6D9')
    await user.click(screen.getByRole('button', { name: '패턴 무늬 색상 민트' }))
    expect(current().patterns?.cushion.color).toBe('#D3F0E0')

    await user.selectOptions(type, 'heart')
    expect(current().patterns?.cushion).toMatchObject({ type: 'heart', size: 1, baseColor: '#F7C6D9', color: '#D3F0E0' }) // switching type keeps the colors and size

    await user.selectOptions(type, 'solid')
    expect(current().patterns).toBeUndefined()
  })

  it('a new pattern starts tone-on-tone with the part it covers, and the two surfaces of a piece are independent', async () => {
    const user = userEvent.setup()
    select('sofa', { colors: { cushion: '#abcdef' } })
    await user.selectOptions(screen.getByLabelText('방석 패턴 종류'), 'star')
    expect(current().patterns?.cushion.baseColor).toBe('#abcdef')

    await user.click(within(screen.getByRole('group', { name: '패턴을 넣을 표면' })).getByRole('button', { name: '본체 천' }))
    await user.selectOptions(screen.getByLabelText('본체 천 패턴 종류'), 'dot-large')
    expect(Object.keys(current().patterns ?? {}).sort()).toEqual(['body', 'cushion'])
    expect(current().patterns?.body.type).toBe('dot-large')
    expect(current().patterns?.cushion.type).toBe('star')
  })

  it('shows the customized SVG in the panel preview as it changes', async () => {
    const user = userEvent.setup()
    const { container } = select('cushion')
    expect(container.querySelector('.furniture-properties-preview pattern')).toBeNull()
    await user.selectOptions(screen.getByLabelText('쿠션 천 패턴 종류'), 'rose')
    expect(container.querySelector('.furniture-properties-preview pattern')).not.toBeNull()
  })

  it('switching the selection shows the new piece\'s own parts (no stale part selection)', () => {
    useHomeStore.getState().addFurniture(placement('sofa', { id: 'one' }))
    useHomeStore.getState().addFurniture(placement('table', { id: 'two' }))
    useHomeStore.getState().selectFurniture('one')
    render(<FurniturePropertiesPanel />)
    fireEvent.click(within(screen.getByRole('group', { name: '색상을 바꿀 부위' })).getByRole('button', { name: '다리' }))
    act(() => useHomeStore.getState().selectFurniture('two'))
    expect(within(screen.getByRole('group', { name: '색상을 바꿀 부위' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['상판', '다리'])
  })
})
