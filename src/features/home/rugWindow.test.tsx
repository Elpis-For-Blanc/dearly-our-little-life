import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LiveRoomView } from '../simulation/LiveRoomView'
import { furnitureObstacles } from '../simulation/movementEngine'
import { getDefaultColorway, getColorwayOptions, RUG_COLORWAYS, WINDOW_COLORWAYS } from './colorways'
import { FurnitureCatalog } from './FurnitureCatalogPanel'
import { getFurnitureDefinition, getFurnitureSize, isValidVariant } from './furnitureCatalog'
import { FurnitureItem } from './FurnitureItem'
import { FurniturePropertiesPanel } from './FurniturePropertiesPanel'
import { FURNITURE_PATTERN_ORDER, PATTERN_TILE_UNITS, type PatternSetting } from './furnitureStyle'
import { getPartDefaults } from './furnitureStyling'
import { getActiveDecorateRoom, useHomeStore } from './homeStore'
import { FurnitureIcon } from './illustrations'
import { FURNITURE_PALETTE as P } from './palette'
import { clampToRoom, ROOM_HEIGHT, ROOM_WIDTH } from './roomLayout'
import type { FurniturePlacement } from './types'

const PATTERN_TYPES = FURNITURE_PATTERN_ORDER.filter((type): type is PatternSetting['type'] => type !== 'solid')
const RUG = getFurnitureDefinition('rug')!
const VARIANT_IDS = RUG.variants!.map((v) => v.id)

function pattern(type: PatternSetting['type'] = 'gingham', size: PatternSetting['size'] = 2): PatternSetting {
  return { type, baseColor: '#ffd9e6', color: '#f7c6d9', size }
}

function placement(furnitureId: string, overrides: Partial<FurniturePlacement> = {}): FurniturePlacement {
  return { id: `p-${furnitureId}`, furnitureId, x: 360, y: 340, scale: 1, rotation: 0, colorway: getDefaultColorway(furnitureId), layer: 0, ...overrides }
}

function icon(furnitureId: string, extras: { variant?: string; colors?: FurniturePlacement['colors']; patterns?: FurniturePlacement['patterns']; colorway?: string } = {}) {
  const definition = getFurnitureDefinition(furnitureId)!
  const size = getFurnitureSize(definition, extras.variant)
  return <FurnitureIcon furnitureId={furnitureId} width={size.width} height={size.height} colorway={extras.colorway ?? getDefaultColorway(furnitureId)} variant={extras.variant} colors={extras.colors} patterns={extras.patterns} />
}

function resetRoom() {
  localStorage.clear()
  const room = useHomeStore.getInitialState().rooms[0]
  useHomeStore.setState({ rooms: [{ ...room, furniture: [] }], activeDecorateRoomId: room.id, activeLiveRoomId: room.id, selectedFurnitureId: null })
}

const current = () => getActiveDecorateRoom(useHomeStore.getState()).furniture[0]

describe('rug and window definitions', () => {
  it('keep their ids, original sizes and non-blocking behavior', () => {
    expect(RUG.id).toBe('rug')
    expect([RUG.width, RUG.height]).toEqual([320, 100])
    expect(getFurnitureDefinition('window')).toMatchObject({ id: 'window', width: 180, height: 140, zone: 'wall', collision: { mode: 'none' } })
    expect(RUG.collision).toEqual({ mode: 'none' })
  })

  it('the rug declares one recolorable face that is also its patternable surface; the window its frame and curtain, with only the curtain patternable', () => {
    expect(RUG.colorParts).toEqual([
      { id: 'base', label: '러그 바탕' },
      { id: 'border', label: '러그 테두리' },
    ])
    expect(RUG.patternSurfaces.map((s) => s.id)).toEqual(['base'])
    const window = getFurnitureDefinition('window')!
    expect(window.colorParts.map((p) => p.label)).toEqual(['프레임', '커튼'])
    expect(window.patternSurfaces.map((s) => s.id)).toEqual(['curtain'])
  })

  it('the rug has four shapes with the original oval first and identical to the definition size', () => {
    expect(RUG.variants!.map((v) => v.label)).toEqual(['타원형', '원형', '직사각형', '하트형'])
    expect(RUG.variants![0]).toMatchObject({ id: 'ellipse', width: RUG.width, height: RUG.height })
    expect(getFurnitureSize(RUG)).toEqual({ width: 320, height: 100 })
    expect(getFurnitureSize(RUG, 'circle')).toEqual({ width: 200, height: 110 })
    expect(getFurnitureSize(RUG, 'nope')).toEqual({ width: 320, height: 100 }) // unknown shape = default
    expect(getFurnitureSize(getFurnitureDefinition('sofa'), 'circle')).toEqual({ width: 224, height: 96 }) // pieces without shapes ignore it
    expect(isValidVariant(RUG, 'heart')).toBe(true)
    expect(isValidVariant(RUG, 'star')).toBe(false)
    expect(isValidVariant(getFurnitureDefinition('sofa'), 'circle')).toBe(false)
  })

  it('default part colors are exactly the original preset tones', () => {
    for (const cw of Object.keys(RUG_COLORWAYS)) expect(getPartDefaults('rug', cw).base).toEqual(RUG_COLORWAYS[cw].fill)
    for (const cw of Object.keys(WINDOW_COLORWAYS)) {
      const d = getPartDefaults('window', cw)
      expect(d.curtain).toEqual(WINDOW_COLORWAYS[cw].curtain)
      expect(d.frame).toEqual({ fill: '#fbf3e4', stroke: '#e8d9bb' })
    }
    expect(getColorwayOptions('rug').map((o) => o.id).slice(0, 3)).toEqual(['blush', 'sage', 'sky']) // the existing presets are still first
  })
})

describe('default look is unchanged', () => {
  afterEach(() => cleanup())

  it('an untouched rug draws exactly the original three ellipses (halo, face, ring) and no defs', () => {
    for (const cw of ['blush', 'sage', 'sky']) {
      const { container } = render(icon('rug', { colorway: cw }))
      const e = Array.from(container.querySelectorAll('ellipse'))
      expect(e).toHaveLength(3)
      expect(container.querySelector('defs')).toBeNull()
      expect(container.querySelector('path')).toBeNull()
      expect(e.map((x) => x.getAttribute('rx'))).toEqual(['160', '156', '144'])
      expect(e.map((x) => x.getAttribute('ry'))).toEqual(['50', '46', '34'])
      expect(e[0].getAttribute('fill')).toBe(P.shadowAmbient)
      expect(e[1].getAttribute('fill')).toBe(RUG_COLORWAYS[cw].fill.fill)
      expect(e[1].getAttribute('stroke')).toBe(RUG_COLORWAYS[cw].fill.stroke)
      expect(e[1].getAttribute('stroke-width')).toBe('3')
      expect(e[1].getAttribute('opacity')).toBe('0.9')
      expect(e[2].getAttribute('fill')).toBe('none')
      expect(e[2].getAttribute('opacity')).toBe('0.4')
      cleanup()
    }
  })

  it('an untouched window draws the original curtains, frame, glass and bars', () => {
    const { container } = render(icon('window', { colorway: 'lavender' }))
    expect(container.querySelector('defs')).toBeNull()
    const paths = Array.from(container.querySelectorAll('path'))
    expect(paths.map((p) => p.getAttribute('fill'))).toEqual([WINDOW_COLORWAYS.lavender.curtain.fill, WINDOW_COLORWAYS.lavender.curtain.fill])
    const rects = Array.from(container.querySelectorAll('rect'))
    expect(rects.find((r) => r.getAttribute('fill') === '#fbf3e4')?.getAttribute('stroke')).toBe('#e8d9bb')
    expect(container.querySelectorAll('line')).toHaveLength(2)
  })
})

describe('rug shapes', () => {
  afterEach(() => cleanup())

  it('each shape renders in its own size with the right outline (ellipses vs. trapezoid vs. heart path)', () => {
    for (const v of RUG.variants!) {
      const { container } = render(icon('rug', { variant: v.id }))
      expect(container.querySelector('svg')!.getAttribute('viewBox')).toBe(`0 0 ${v.width} ${v.height}`)
      const ellipses = container.querySelectorAll('ellipse').length
      const paths = container.querySelectorAll('path').length
      if (v.id === 'ellipse' || v.id === 'circle') {
        expect([ellipses, paths]).toEqual([3, 0])
      } else {
        expect([ellipses, paths]).toEqual([0, 3])
      }
      expect(container.innerHTML).not.toMatch(/NaN|undefined/)
      cleanup()
    }
    // the four shapes are all visibly different drawings
    const drawings = VARIANT_IDS.map((id) => {
      const { container } = render(icon('rug', { variant: id }))
      const html = container.innerHTML
      cleanup()
      return html
    })
    expect(new Set(drawings).size).toBe(4)
  })

  it('the shape stays inside its own box (no outline point outside 0..width / 0..height)', () => {
    for (const id of ['rect', 'heart']) {
      const { width, height } = getFurnitureSize(RUG, id)
      const { container } = render(icon('rug', { variant: id }))
      for (const path of Array.from(container.querySelectorAll('path'))) {
        const numbers = path.getAttribute('d')!.match(/-?\d+(\.\d+)?/g)!.map(Number)
        for (let i = 0; i < numbers.length; i += 2) {
          expect(numbers[i], `${id} x`).toBeGreaterThanOrEqual(0)
          expect(numbers[i], `${id} x`).toBeLessThanOrEqual(width)
          expect(numbers[i + 1], `${id} y`).toBeGreaterThanOrEqual(0)
          expect(numbers[i + 1], `${id} y`).toBeLessThanOrEqual(height)
        }
      }
      cleanup()
    }
  })
})

describe('rug and window customization in the SVG', () => {
  afterEach(() => cleanup())

  it('recoloring the rug face changes fill and derived outline for every shape', () => {
    for (const id of VARIANT_IDS) {
      const { container } = render(icon('rug', { variant: id, colors: { base: '#a1b2c3' } }))
      expect(container.innerHTML, id).toContain('#a1b2c3')
      expect(container.innerHTML, id).not.toContain(RUG_COLORWAYS.blush.fill.fill)
      cleanup()
    }
  })

  it('every pattern type covers the whole rug face on every shape, with the chosen colors and a rug-scaled tile', () => {
    for (const id of VARIANT_IDS) {
      for (const type of PATTERN_TYPES) {
        const { container } = render(icon('rug', { variant: id, patterns: { base: { type, baseColor: '#abcdef', color: '#fedcba', size: 2 } } }))
        const def = container.querySelector('defs pattern')!
        expect(def, `${id}/${type}`).not.toBeNull()
        const url = `url(#${def.getAttribute('id')})`
        const filled = Array.from(container.querySelectorAll(`[fill="${url}"]`))
        expect(filled, `${id}/${type}`).toHaveLength(1) // the face only — never the halo or the ring
        expect(filled[0].getAttribute('stroke-width')).toBe('3')
        // Only direct children of the <svg> count: the pattern's own motif may contain fill="none" shapes.
        expect(container.querySelectorAll('svg > [fill="none"]')).toHaveLength(1) // the woven-border ring, never patterned
        expect(container.innerHTML).toContain('#abcdef')
        expect(container.innerHTML).toContain('#fedcba')
        const scale = type === 'dot-small' ? 0.75 : type === 'dot-large' ? 1.5 : 1
        expect(Number(def.getAttribute('width'))).toBeCloseTo(PATTERN_TILE_UNITS[2] * 2 * scale) // 2 = the rug's tile scale
        cleanup()
      }
    }
  })

  it('the three pattern sizes give growing tiles on the rug, and a rug tile is larger than the same step on a cushion', () => {
    const tile = (id: string, size: 1 | 2 | 3, key: string) => {
      const { container } = render(icon(id, { patterns: { [key]: pattern('star', size) } }))
      const width = Number(container.querySelector('pattern')!.getAttribute('width'))
      cleanup()
      return width
    }
    const rug = ([1, 2, 3] as const).map((s) => tile('rug', s, 'base'))
    expect(rug[0]).toBeLessThan(rug[1])
    expect(rug[1]).toBeLessThan(rug[2])
    expect(tile('rug', 2, 'base')).toBeGreaterThan(tile('cushion', 2, 'body'))
  })

  it('window frame and curtain recolor independently; the curtain takes patterns but the frame, glass and rod never do', () => {
    const frame = render(icon('window', { colors: { frame: '#112233' } })).container
    expect(frame.innerHTML).toContain('#112233')
    const glass = Array.from(frame.querySelectorAll('rect')).find((r) => r.getAttribute('fill') === '#cfe8f7')
    expect(glass).toBeDefined() // glass untouched
    cleanup()

    const { container } = render(icon('window', { patterns: { curtain: pattern('ribbon') } }))
    const patterned = Array.from(container.querySelectorAll('[fill^="url(#"]'))
    expect(patterned).toHaveLength(2)
    expect(patterned.every((el) => el.tagName.toLowerCase() === 'path')).toBe(true)
    expect(Array.from(container.querySelectorAll('rect')).every((r) => !r.getAttribute('fill')!.startsWith('url('))).toBe(true)
    cleanup()

    const curtain = render(icon('window', { colors: { curtain: '#445566' } })).container
    expect(Array.from(curtain.querySelectorAll('path')).map((p) => p.getAttribute('fill'))).toEqual(['#445566', '#445566'])
  })

  it('rug, window and their patterns never share ids when many are on screen', () => {
    const { container } = render(
      <div>
        {icon('rug', { patterns: { base: pattern('tartan') } })}
        {icon('rug', { variant: 'heart', patterns: { base: pattern('tartan') } })}
        {icon('window', { patterns: { curtain: pattern('rose') } })}
        {icon('window', { patterns: { curtain: pattern('rose') } })}
        {icon('sofa', { patterns: { cushion: pattern('heart') } })}
      </div>,
    )
    const ids = Array.from(container.querySelectorAll('[id]')).map((el) => el.getAttribute('id')!)
    expect(ids).toHaveLength(5)
    expect(new Set(ids).size).toBe(5)
    for (const ref of Array.from(container.querySelectorAll('[fill^="url(#"]')).map((el) => el.getAttribute('fill')!.slice(5, -1))) expect(ids).toContain(ref)
  })
})

describe('placing, selecting and moving', () => {
  beforeEach(resetRoom)
  afterEach(() => cleanup())

  it('a rug and a window are added through the normal catalog flow, with the window on the wall and the rug on the floor grid', async () => {
    const user = userEvent.setup()
    render(<FurnitureCatalog />)
    await user.click(within(screen.getByText('러그').closest('article')!).getByRole('button', { name: '+ 배치' }))
    await user.click(within(screen.getByText('창문').closest('article')!).getByRole('button', { name: '+ 배치' }))
    const [rug, window] = getActiveDecorateRoom(useHomeStore.getState()).furniture
    expect(rug).toMatchObject({ furnitureId: 'rug', colorway: 'blush', scale: 1 })
    expect('variant' in rug).toBe(false) // a new rug is the default shape until the user picks another
    expect(window.y).toBeLessThan(ROOM_HEIGHT * 0.62)
  })

  it('the catalog cards use the same default drawings as before (rug oval, window)', () => {
    const { container } = render(<FurnitureCatalog />)
    const rugCard = screen.getByText('러그').closest('article')!
    expect(rugCard.querySelectorAll('ellipse')).toHaveLength(3)
    expect(container.querySelector('.furniture-card-preview svg')).not.toBeNull()
  })

  it('the placed rug renders at its shape\'s size and a drag/move keeps the shape', () => {
    useHomeStore.getState().addFurniture(placement('rug', { id: 'r1', variant: 'circle' }))
    const { container } = render(<FurnitureItem placement={current()} />)
    const el = container.querySelector('.furniture-item') as HTMLElement
    expect(el.style.width).toBe(`${(200 / ROOM_WIDTH) * 100}%`)
    expect(el.style.height).toBe(`${(110 / ROOM_HEIGHT) * 100}%`)
    expect(container.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 200 110')

    useHomeStore.getState().moveFurniture('r1', 120, 380)
    expect(current()).toMatchObject({ x: 120, y: 380, variant: 'circle' })
  })

  it('selecting a rug shows the rug editor: shape, base color, pattern; nothing unsupported', () => {
    useHomeStore.getState().addFurniture(placement('rug', { id: 'r1' }))
    useHomeStore.getState().selectFurniture('r1')
    render(<FurniturePropertiesPanel />)
    expect(within(screen.getByRole('group', { name: '러그 모양' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['타원형', '원형', '직사각형', '하트형'])
    expect(within(screen.getByRole('group', { name: '색상을 바꿀 부위' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['러그 바탕', '러그 테두리'])
    expect(screen.getByLabelText('러그 표면 패턴 종류')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: '패턴을 넣을 표면' })).not.toBeInTheDocument() // one surface -> no surface tabs
    expect(screen.getByRole('button', { name: '타원형' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('changing the rug shape updates the piece, its preview and keeps it inside the room', async () => {
    const user = userEvent.setup()
    useHomeStore.getState().addFurniture(placement('rug', { id: 'r1', x: ROOM_WIDTH - 160, y: 300 })) // flush against the right edge as a 320-wide oval
    useHomeStore.getState().selectFurniture('r1')
    const { container } = render(<FurniturePropertiesPanel />)
    await user.click(screen.getByRole('button', { name: '직사각형' }))
    expect(current().variant).toBe('rect')
    expect(container.querySelector('.furniture-properties-preview svg')!.getAttribute('viewBox')).toBe('0 0 300 100')

    await user.click(screen.getByRole('button', { name: '하트형' }))
    expect(current().variant).toBe('heart')
    const { x, y } = current()
    expect(clampToRoom(x, y, 200 * current().scale, 130 * current().scale)).toEqual({ x, y }) // still fully inside after the footprint changed
  })

  it('recolors, patterns, resizes the pattern and clears it on the rug — the same flow as any other furniture', async () => {
    const user = userEvent.setup()
    useHomeStore.getState().addFurniture(placement('rug', { id: 'r1' }))
    useHomeStore.getState().selectFurniture('r1')
    const { container } = render(<FurniturePropertiesPanel />)

    await user.click(screen.getByRole('button', { name: '러그 바탕 색상 라일락' }))
    expect(current().colors).toEqual({ base: '#E6D6F2' })

    await user.selectOptions(screen.getByLabelText('러그 표면 패턴 종류'), 'gingham')
    expect(current().patterns?.base).toMatchObject({ type: 'gingham', baseColor: '#E6D6F2', size: 2 }) // starts tone-on-tone with the recolored face
    expect(container.querySelector('.furniture-properties-preview pattern')).not.toBeNull()

    await user.click(within(screen.getByRole('group', { name: '패턴 크기' })).getByRole('button', { name: '크게' }))
    fireEvent.change(screen.getByLabelText('패턴 무늬 색상 직접 선택'), { target: { value: '#123456' } })
    expect(current().patterns?.base).toMatchObject({ size: 3, color: '#123456' })

    await user.selectOptions(screen.getByLabelText('러그 표면 패턴 종류'), 'solid')
    expect(current().patterns).toBeUndefined()
    await user.click(screen.getByRole('button', { name: '러그 바탕 기본색으로' }))
    expect(current().colors).toBeUndefined()
  })

  it('selecting a window shows frame/curtain colors and the curtain pattern, and no shape picker', () => {
    useHomeStore.getState().addFurniture(placement('window', { id: 'w1' }))
    useHomeStore.getState().selectFurniture('w1')
    render(<FurniturePropertiesPanel />)
    expect(within(screen.getByRole('group', { name: '색상을 바꿀 부위' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['프레임', '커튼'])
    expect(screen.getByLabelText('커튼 패턴 종류')).toBeInTheDocument()
    expect(screen.queryByText('모양')).not.toBeInTheDocument()
  })

  it('the rug never blocks characters, in any shape, and the window still does not', () => {
    for (const id of VARIANT_IDS) expect(furnitureObstacles([placement('rug', { variant: id })])).toEqual([])
    expect(furnitureObstacles([placement('window')])).toEqual([])
  })

  it('a solid piece next to a rug still blocks exactly as before (rug shapes do not change other collisions)', () => {
    const rects = furnitureObstacles([placement('rug', { variant: 'heart' }), placement('sofa', { x: 300, y: 300 })])
    expect(rects).toEqual([{ minX: 188, maxX: 412, minY: 252, maxY: 348 }])
  })
})

describe('storage (schema 5)', () => {
  beforeEach(resetRoom)
  afterEach(() => cleanup())

  it('saves shape, colors and patterns of a rug and window and restores them after a reload', async () => {
    useHomeStore.getState().addFurniture(placement('rug', { id: 'r1' }))
    useHomeStore.getState().addFurniture(placement('window', { id: 'w1' }))
    useHomeStore.getState().updateFurniture('r1', { variant: 'heart', colors: { base: '#a1b2c3' }, patterns: { base: pattern('rose', 3) } })
    useHomeStore.getState().updateFurniture('w1', { colors: { frame: '#112233', curtain: '#445566' }, patterns: { curtain: pattern('star') } })

    const raw = localStorage.getItem('dearly-home')!
    expect(JSON.parse(raw).version).toBe(5)
    useHomeStore.setState({ rooms: [{ ...useHomeStore.getState().rooms[0], furniture: [] }] })
    localStorage.setItem('dearly-home', raw)
    await useHomeStore.persist.rehydrate()

    const [rug, window] = getActiveDecorateRoom(useHomeStore.getState()).furniture
    expect(rug).toMatchObject({ id: 'r1', variant: 'heart', colors: { base: '#a1b2c3' }, patterns: { base: pattern('rose', 3) } })
    expect(window).toMatchObject({ id: 'w1', colors: { frame: '#112233', curtain: '#445566' }, patterns: { curtain: pattern('star') } })
  })

  it('an existing rug and window saved in v3 or v4 load unchanged: same fields, default shape, no customization keys', async () => {
    const base = useHomeStore.getInitialState().rooms[0]
    const oldRug = { id: 'r', furnitureId: 'rug', x: 300, y: 380, scale: 1.2, rotation: 180, colorway: 'sage', layer: -1 }
    const oldWindow = { id: 'w', furnitureId: 'window', x: 360, y: 97, scale: 1, rotation: 0, colorway: 'lavender', layer: -2 }
    for (const version of [3, 4]) {
      const rooms = [{ ...base, id: 'r1', furniture: [oldRug, oldWindow] }]
      localStorage.setItem('dearly-home', JSON.stringify({ state: { rooms, activeDecorateRoomId: 'r1', activeLiveRoomId: 'r1' }, version }))
      await useHomeStore.persist.rehydrate()
      expect(useHomeStore.getState().rooms[0].furniture).toEqual([oldRug, oldWindow])
      expect(getFurnitureSize(RUG, useHomeStore.getState().rooms[0].furniture[0].variant)).toEqual({ width: 320, height: 100 })
    }
  })

  it('a v4 save that already had rug colors/patterns keeps them and gains no shape', async () => {
    const base = useHomeStore.getInitialState().rooms[0]
    const rug = { id: 'r', furnitureId: 'rug', x: 300, y: 380, scale: 1, rotation: 0, colorway: 'blush', layer: -1, colors: { base: '#a1b2c3' }, patterns: { base: pattern('heart') } }
    localStorage.setItem('dearly-home', JSON.stringify({ state: { rooms: [{ ...base, id: 'r1', furniture: [rug] }], activeDecorateRoomId: 'r1', activeLiveRoomId: 'r1' }, version: 4 }))
    await useHomeStore.persist.rehydrate()
    expect(useHomeStore.getState().rooms[0].furniture[0]).toEqual(rug)
  })

  it('drops an invalid or misplaced shape on load (unknown id, or a piece that has no shapes)', () => {
    const base = useHomeStore.getInitialState().rooms[0]
    const migrate = useHomeStore.persist.getOptions().migrate!
    const result = migrate(
      {
        rooms: [
          {
            ...base,
            id: 'r1',
            furniture: [
              { id: 'a', furnitureId: 'rug', x: 1, y: 2, scale: 1, rotation: 0, colorway: 'blush', layer: 0, variant: 'triangle' },
              { id: 'b', furnitureId: 'sofa', x: 1, y: 2, scale: 1, rotation: 0, colorway: 'rose', layer: 0, variant: 'circle' },
              { id: 'c', furnitureId: 'rug', x: 1, y: 2, scale: 1, rotation: 0, colorway: 'blush', layer: 0, variant: 'circle' },
            ],
          },
        ],
        activeDecorateRoomId: 'r1',
        activeLiveRoomId: 'r1',
      },
      4,
    ) as { rooms: Array<{ furniture: FurniturePlacement[] }> }
    const [a, b, c] = result.rooms[0].furniture
    expect('variant' in a).toBe(false)
    expect('variant' in b).toBe(false)
    expect(c.variant).toBe('circle')
  })

  it('each of five rooms keeps its own rug shape, color and pattern', () => {
    const first = useHomeStore.getState().rooms[0].id
    const rooms = [first, ...['bedroom', 'kitchen', 'study', 'hobby'].map((kind, i) => useHomeStore.getState().addRoom(kind as 'bedroom', `방${i}`, 'empty'))]
    expect(useHomeStore.getState().rooms).toHaveLength(5)
    rooms.forEach((roomId, i) => {
      useHomeStore.getState().setActiveDecorateRoom(roomId)
      useHomeStore.getState().addFurniture(placement('rug', { id: `r${i}` }))
      useHomeStore.getState().updateFurniture(`r${i}`, { variant: VARIANT_IDS[i % 4], colors: { base: `#00000${i}` }, patterns: i % 2 ? undefined : { base: pattern('star', ((i % 3) + 1) as 1 | 2 | 3) } })
    })
    rooms.forEach((roomId, i) => {
      const rug = useHomeStore.getState().rooms.find((r) => r.id === roomId)!.furniture[0]
      expect(rug).toMatchObject({ variant: VARIANT_IDS[i % 4], colors: { base: `#00000${i}` } })
      expect(Boolean(rug.patterns)).toBe(i % 2 === 0)
    })
  })

  it('a live room draws the customized rug and window', () => {
    useHomeStore.getState().addFurniture(placement('rug', { id: 'r1', variant: 'heart', patterns: { base: pattern('ribbon') } }))
    useHomeStore.getState().addFurniture(placement('window', { id: 'w1', patterns: { curtain: pattern('star') } }))
    const { container } = render(<LiveRoomView />)
    const svgs = Array.from(container.querySelectorAll('.live-room-furniture svg'))
    expect(svgs).toHaveLength(2)
    expect(svgs[0].getAttribute('viewBox')).toBe('0 0 200 130')
    expect(container.querySelectorAll('.live-room-furniture pattern')).toHaveLength(2)
  })
})
