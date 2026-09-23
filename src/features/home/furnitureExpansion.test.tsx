import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FLOOR_TOP_Y } from '../simulation/movementConfig'
import { furnitureObstacles } from '../simulation/movementEngine'
import { getColorwayOptions, getDefaultColorway } from './colorways'
import { FurnitureCatalog } from './FurnitureCatalogPanel'
import { FURNITURE_CATALOG, getFurnitureDefinition } from './furnitureCatalog'
import { FurnitureItem } from './FurnitureItem'
import { getActiveDecorateRoom, useHomeStore } from './homeStore'
import { FurnitureIcon } from './illustrations'
import { FURNITURE_PALETTE as P } from './palette'
import { defaultPlacementPosition } from './placementDefaults'
import { ROOM_HEIGHT, ROOM_WIDTH } from './roomLayout'
import type { FurniturePlacement } from './types'

const ORIGINAL_IDS = ['sofa', 'table', 'bed', 'plant', 'rug', 'window']

const NEW_FURNITURE: Record<string, string> = {
  // 거실
  'sofa-single': '1인용 소파',
  'sofa-long': '긴 소파',
  armchair: '안락의자',
  'coffee-table': '로우 테이블',
  'side-table': '사이드 테이블',
  'tv-stand': 'TV',
  bookshelf: '책장',
  // 침실
  'bed-single': '싱글 침대',
  'bed-double': '더블 침대',
  nightstand: '협탁',
  vanity: '화장대',
  wardrobe: '옷장',
  'floor-mirror': '전신거울',
  // 주방
  'dining-table': '식탁',
  'dining-chair': '식탁 의자',
  fridge: '냉장고',
  'kitchen-cabinet': '주방 수납장',
  sink: '싱크대',
  microwave: '전자레인지',
  // 서재
  desk: '책상',
  'office-chair': '사무용 의자',
  bookrack: '책꽂이',
  'floor-lamp': '스탠드 조명',
  // 소품
  cushion: '쿠션',
  'bunny-doll': '토끼 인형',
  'bear-doll': '곰 인형',
  vase: '꽃병',
  frame: '액자',
  'desk-clock': '탁상시계',
  'book-stack': '책 더미',
  mug: '머그컵',
  'table-lamp': '테이블 조명',
  'wall-clock': '벽시계',
  curtain: '커튼',
  // 신규 (가구 종류 확장 1차)
  dresser: '서랍장',
  candle: '캔들',
  'canopy-bed': '캐노피 침대',
  'round-table': '원형 테이블',
  // 신규 (가구 종류 확장 2차)
  'bedroom-bench': '벤치',
  'dining-bench': '벤치형 식탁 의자',
  ottoman: '오토만',
  'computer-desk': '컴퓨터 책상',
  'low-cabinet': '낮은 수납장',
  console: '콘솔',
  'pendant-light': '펜던트 조명',
  'wall-mirror': '벽거울',
  'display-shelf': '장식 선반',
  'dining-table-large': '6인용 식탁',
  // 신규 (가구 비주얼 고도화 + 종류 확장 3차)
  stool: '스툴',
  'storage-basket': '수납 바구니',
  // 신규 (가구 비주얼 2차 리디자인 + 종류 확장 4차)
  'kitchen-counter': '조리대',
  toaster: '토스터',
  kettle: '주전자',
  'coffee-machine': '커피머신',
}

const WALL_IDS = ['window', 'floor-mirror', 'frame', 'wall-clock', 'curtain', 'pendant-light', 'wall-mirror', 'display-shelf']

function placement(furnitureId: string, overrides: Partial<FurniturePlacement> = {}): FurniturePlacement {
  return { id: `p-${furnitureId}`, furnitureId, x: 360, y: 330, scale: 1, rotation: 0, colorway: getDefaultColorway(furnitureId), layer: 0, ...overrides }
}

function renderIcon(furnitureId: string, colorway = getDefaultColorway(furnitureId)) {
  const definition = getFurnitureDefinition(furnitureId)!
  return render(<FurnitureIcon furnitureId={furnitureId} width={definition.width} height={definition.height} colorway={colorway} />)
}

describe('catalog contents', () => {
  it('keeps the six original ids first, with their original names and sizes', () => {
    expect(FURNITURE_CATALOG.slice(0, 6).map((f) => f.id)).toEqual(ORIGINAL_IDS)
    const originals = Object.fromEntries(FURNITURE_CATALOG.slice(0, 6).map((f) => [f.id, [f.name, f.width, f.height]]))
    expect(originals).toEqual({
      sofa: ['소파', 224, 96],
      table: ['테이블', 128, 128],
      bed: ['침대', 192, 144],
      plant: ['화분', 64, 64],
      rug: ['러그', 320, 100],
      window: ['창문', 180, 140],
    })
  })

  it('keeps the original sofa/bed interaction slots untouched', () => {
    expect(getFurnitureDefinition('sofa')?.interactionSlots.map((s) => s.id)).toEqual(['sofa-left', 'sofa-right'])
    expect(getFurnitureDefinition('bed')?.interactionSlots.map((s) => s.id)).toEqual(['bed-left', 'bed-right'])
  })

  it('adds the 54 new pieces (34 original expansion + 4 furniture-variety-expansion phase 1 + 10 phase 2 + 2 visual-renewal phase 3 + 4 kitchen-appliance phase 4) with unique stable ids and the expected names, all free by default', () => {
    expect(Object.keys(NEW_FURNITURE)).toHaveLength(54)
    expect(FURNITURE_CATALOG).toHaveLength(60)
    expect(new Set(FURNITURE_CATALOG.map((f) => f.id)).size).toBe(60)
    for (const [id, name] of Object.entries(NEW_FURNITURE)) {
      expect(getFurnitureDefinition(id)?.name, id).toBe(name)
    }
    for (const definition of FURNITURE_CATALOG) expect(definition.isFreeDefault).toBe(true)
  })

  it('does not duplicate anything that already existed: no second 화분/소파/테이블/침대/러그/창문 entry and a single TV entry', () => {
    const names = FURNITURE_CATALOG.map((f) => f.name)
    for (const name of ['화분', '소파', '테이블', '침대', '러그', '창문', 'TV']) expect(names.filter((n) => n === name)).toHaveLength(1)
    expect(names.some((n) => n === 'TV장')).toBe(false)
  })

  it('every entry has sane sizes, scale bounds and a known category', () => {
    const categories = ['living', 'bedroom', 'kitchen', 'study', 'storage', 'lighting', 'decor', 'windowRug']
    for (const f of FURNITURE_CATALOG) {
      expect(f.width).toBeGreaterThan(0)
      expect(f.height).toBeGreaterThan(0)
      expect(f.minScale).toBeLessThan(f.maxScale)
      expect(f.minScale).toBeLessThanOrEqual(1)
      expect(f.maxScale).toBeGreaterThanOrEqual(1)
      expect(categories).toContain(f.category)
    }
  })

  it('new pieces get colorway options, while ids not in the catalog get none', () => {
    for (const id of Object.keys(NEW_FURNITURE)) expect(getColorwayOptions(id).length).toBeGreaterThan(1)
    expect(getColorwayOptions('removed-item')).toEqual([])
    expect(getColorwayOptions('sofa').map((o) => o.id).slice(0, 2)).toEqual(['rose', 'cream']) // original presets untouched, still first (dark presets are appended)
  })
})

describe('illustrations', () => {
  afterEach(() => cleanup())

  it('every catalog entry renders its own SVG (no fallback), sized to its definition, for every colorway', () => {
    const fallbackLabel = (() => {
      const { container } = render(<FurnitureIcon furnitureId="not-a-real-id" width={50} height={50} colorway="x" />)
      const label = container.querySelector('svg')?.getAttribute('aria-label')
      cleanup()
      return label
    })()

    for (const definition of FURNITURE_CATALOG) {
      for (const option of getColorwayOptions(definition.id)) {
        const { container } = renderIcon(definition.id, option.id)
        const svg = container.querySelector('svg')
        expect(svg, definition.id).not.toBeNull()
        expect(svg?.getAttribute('viewBox')).toBe(`0 0 ${definition.width} ${definition.height}`)
        expect(svg?.getAttribute('aria-label'), definition.id).not.toBe(fallbackLabel)
        expect(svg?.querySelectorAll('*').length, definition.id).toBeGreaterThan(2)
        cleanup()
      }
    }
  })

  it('renders without NaN/undefined/negative sizes in any attribute', () => {
    for (const definition of FURNITURE_CATALOG) {
      const { container } = renderIcon(definition.id)
      for (const element of Array.from(container.querySelectorAll('*'))) {
        for (const attribute of Array.from(element.attributes)) {
          expect(attribute.value, `${definition.id} <${element.tagName} ${attribute.name}>`).not.toMatch(/NaN|undefined|Infinity/)
          if (['width', 'height', 'rx', 'ry', 'r'].includes(attribute.name) && attribute.value !== '100%') {
            expect(Number(attribute.value), `${definition.id} <${element.tagName} ${attribute.name}>`).toBeGreaterThanOrEqual(0)
          }
        }
      }
      cleanup()
    }
  })

  it('changing the colorway actually changes the drawing (new pieces)', () => {
    for (const id of Object.keys(NEW_FURNITURE)) {
      const [first, second] = getColorwayOptions(id)
      const a = renderIcon(id, first.id).container.innerHTML
      cleanup()
      const b = renderIcon(id, second.id).container.innerHTML
      cleanup()
      expect(a, id).not.toBe(b)
    }
  })

  it('every floor-standing piece draws a contact shadow that sits right under its lowest structure (legs/frame/base), never floating or buried', () => {
    // The vase (new) and plant (original, untouched) draw their bodies as curved <path>s, whose extent jsdom can't
    // measure. storage-basket's default (round) shape is the same — its woven-basket body is a curved <path> too
    // (the 'rect' variant isn't, but this test always renders the default shape) — same exclusion, same reason.
    const checked = [...Object.keys(NEW_FURNITURE), 'sofa', 'table', 'bed'].filter((id) => !WALL_IDS.includes(id) || id === 'floor-mirror').filter((id) => id !== 'vase' && id !== 'storage-basket')
    for (const id of checked) {
      const definition = getFurnitureDefinition(id)!
      const { container } = renderIcon(id)
      const shadows = Array.from(container.querySelectorAll('ellipse')).filter((e) => e.getAttribute('fill') === P.shadowContact)
      expect(shadows.length, `${id} has no contact shadow`).toBe(1)
      const shadowY = Number(shadows[0].getAttribute('cy'))

      let lowest = 0
      for (const element of Array.from(container.querySelectorAll('rect, circle, line, ellipse'))) {
        if (element === shadows[0] || element.getAttribute('fill') === P.shadowAmbient) continue
        if (element.getAttribute('transform') || element.getAttribute('opacity') === '0.7') continue // rotated leaves / faint back legs never define the ground
        const tag = element.tagName.toLowerCase()
        let bottom = 0
        if (tag === 'rect') bottom = Number(element.getAttribute('y')) + Number(element.getAttribute('height'))
        if (tag === 'circle') bottom = Number(element.getAttribute('cy')) + Number(element.getAttribute('r'))
        if (tag === 'ellipse') bottom = Number(element.getAttribute('cy')) + Number(element.getAttribute('ry'))
        if (tag === 'line') bottom = Math.max(Number(element.getAttribute('y1')), Number(element.getAttribute('y2')))
        if (bottom > lowest) lowest = bottom
      }
      expect(Math.abs(shadowY - lowest), `${id}: shadow y=${shadowY}, lowest structure=${lowest}`).toBeLessThanOrEqual(definition.height * 0.045)
      cleanup()
    }
  })

  it('wall-mounted pieces draw no floor shadow', () => {
    for (const id of ['floor-mirror', 'frame', 'wall-clock', 'curtain']) {
      const { container } = renderIcon(id)
      const shadowLike = Array.from(container.querySelectorAll('ellipse')).filter((e) => e.getAttribute('fill') === P.shadowContact)
      // The floor mirror stands on the floor so it keeps one; the rest hang on the wall.
      expect(shadowLike.length, id).toBe(id === 'floor-mirror' ? 1 : 0)
      cleanup()
    }
  })

  it('the catalog card preview and the placed furniture render the identical SVG', async () => {
    const user = userEvent.setup()
    const roomId = useHomeStore.getState().activeDecorateRoomId
    useHomeStore.setState((state) => ({ rooms: state.rooms.map((room) => (room.id === roomId ? { ...room, furniture: [] } : room)), selectedFurnitureId: null }))
    render(<FurnitureCatalog />)

    for (const id of ['sofa-long', 'dining-chair', 'wardrobe', 'bunny-doll', 'curtain']) {
      const definition = getFurnitureDefinition(id)!
      const card = screen.getByText(definition.name).closest('article')!
      const previewSvg = card.querySelector('.furniture-card-preview svg')!.outerHTML

      await user.click(within(card).getByRole('button', { name: '+ 배치' }))
      const placed = getActiveDecorateRoom(useHomeStore.getState()).furniture.find((f) => f.furnitureId === id)!
      const { container } = render(<FurnitureItem placement={placed} />)
      expect(container.querySelector('.furniture-item svg')!.outerHTML, id).toBe(previewSvg)
      cleanup()
      render(<FurnitureCatalog />)
    }
  })
})

describe('collision (separate from drawn size)', () => {
  it('rugs, windows, wall decor and tabletop props never block characters', () => {
    for (const id of ['rug', ...WALL_IDS, 'microwave', 'bookrack', 'table-lamp', 'cushion', 'bunny-doll', 'bear-doll', 'vase', 'desk-clock', 'book-stack', 'mug']) {
      expect(furnitureObstacles([placement(id)]), id).toEqual([])
    }
  })

  it('original solid pieces block their full drawn rectangle exactly as before', () => {
    expect(furnitureObstacles([placement('sofa', { x: 300, y: 300 })])).toEqual([{ minX: 188, maxX: 412, minY: 252, maxY: 348 }])
    expect(furnitureObstacles([placement('table', { x: 300, y: 300, scale: 1.5 })])).toEqual([{ minX: 204, maxX: 396, minY: 204, maxY: 396 }])
    expect(furnitureObstacles([placement('bed', { x: 300, y: 300 })])).toEqual([{ minX: 204, maxX: 396, minY: 228, maxY: 372 }])
    expect(furnitureObstacles([placement('plant', { x: 300, y: 300 })])).toEqual([{ minX: 268, maxX: 332, minY: 268, maxY: 332 }])
  })

  it('tall furniture blocks only its base, anchored to the bottom of the drawing', () => {
    // wardrobe: 128x192, footprint ratio 0.25 -> 48 tall, ending at its bottom edge
    expect(furnitureObstacles([placement('wardrobe', { x: 300, y: 300 })])).toEqual([{ minX: 236, maxX: 364, minY: 348, maxY: 396 }])
    const [fridge] = furnitureObstacles([placement('fridge', { x: 300, y: 300, scale: 1 })])
    expect(fridge.maxY - fridge.minY).toBeCloseTo(176 * 0.25)
    expect(fridge.maxY).toBeCloseTo(300 + 88)
  })

  it('scale scales the footprint too', () => {
    const [small] = furnitureObstacles([placement('bookshelf', { scale: 1 })])
    const [big] = furnitureObstacles([placement('bookshelf', { scale: 1.2 })])
    expect(big.maxX - big.minX).toBeCloseTo((small.maxX - small.minX) * 1.2)
    expect(big.maxY - big.minY).toBeCloseTo((small.maxY - small.minY) * 1.2)
  })

  it('a placement whose id is no longer in the catalog still blocks a 60x60 square (unchanged fallback)', () => {
    expect(furnitureObstacles([placement('removed-item', { x: 300, y: 300 })])).toEqual([{ minX: 270, maxX: 330, minY: 270, maxY: 330 }])
  })

  it('every solid new piece declares a footprint that fits inside its drawing', () => {
    for (const f of FURNITURE_CATALOG) {
      if (f.collision.mode !== 'solid') continue
      const ratio = f.collision.footprintHeightRatio ?? 1
      expect(ratio, f.id).toBeGreaterThan(0)
      expect(ratio, f.id).toBeLessThanOrEqual(1)
    }
  })
})

describe('placement defaults (wall pieces start on the wall, but stay freely movable)', () => {
  beforeEach(() => {
    localStorage.clear()
    const roomId = useHomeStore.getState().activeDecorateRoomId
    useHomeStore.setState((state) => ({ rooms: state.rooms.map((room) => (room.id === roomId ? { ...room, furniture: [] } : room)), selectedFurnitureId: null }))
  })
  afterEach(() => cleanup())

  it('wall pieces start in the wall band, spread along it; floor pieces keep the original grid', () => {
    for (const id of WALL_IDS) {
      const definition = getFurnitureDefinition(id)!
      expect(definition.zone).toBe('wall')
      const { y } = defaultPlacementPosition(definition, [])
      expect(y, id).toBeLessThan(FLOOR_TOP_Y)
    }
    const clock = getFurnitureDefinition('wall-clock')!
    const first = defaultPlacementPosition(clock, [])
    const second = defaultPlacementPosition(clock, [placement('frame')])
    expect(second.x).toBeGreaterThan(first.x)
    expect(second.y).toBe(first.y)

    // GRID_ORIGIN_Y (300) is deliberately inside the floor's own grounding range for typical floor furniture (see
    // placementDefaults.ts/furniturePlacementEngine.ts) — a freshly-added sofa should never start above the floor
    // line, only its X should move across the grid's columns.
    const sofa = getFurnitureDefinition('sofa')!
    expect(defaultPlacementPosition(sofa, [])).toEqual({ x: 112, y: 300 })
    expect(defaultPlacementPosition(sofa, [placement('desk'), placement('bed')])).toEqual({ x: 390, y: 300 })
  })

  it('a wall piece added from the catalog lands on the wall, and can then be moved anywhere in the room (no snapping or range limit)', async () => {
    const user = userEvent.setup()
    render(<FurnitureCatalog />)
    const card = screen.getByText('벽시계').closest('article')!
    await user.click(within(card).getByRole('button', { name: '+ 배치' }))

    const placed = getActiveDecorateRoom(useHomeStore.getState()).furniture[0]
    expect(placed.y).toBeLessThan(FLOOR_TOP_Y)

    useHomeStore.getState().moveFurniture(placed.id, 360, ROOM_HEIGHT - 40)
    const moved = getActiveDecorateRoom(useHomeStore.getState()).furniture[0]
    expect(moved.y).toBe(ROOM_HEIGHT - 40)
    expect(moved.x).toBeLessThanOrEqual(ROOM_WIDTH)
    expect(furnitureObstacles([moved])).toEqual([]) // even on the floor, wall decor never blocks walking
  })

  it('a new floor piece added from the catalog is a normal placement with defaults', async () => {
    const user = userEvent.setup()
    render(<FurnitureCatalog />)
    const card = screen.getByText('책장').closest('article')!
    await user.click(within(card).getByRole('button', { name: '+ 배치' }))
    expect(getActiveDecorateRoom(useHomeStore.getState()).furniture[0]).toMatchObject({ furnitureId: 'bookshelf', scale: 1, rotation: 0, colorway: 'cream', layer: 0 })
  })
})

describe('saved data compatibility', () => {
  it('old placements of the original pieces keep their id, colorway and geometry through the store', () => {
    const roomId = useHomeStore.getState().activeDecorateRoomId
    const saved: FurniturePlacement[] = [
      { id: 'a', furnitureId: 'sofa', x: 200, y: 300, scale: 1.1, rotation: 180, colorway: 'cream', layer: 3 },
      { id: 'b', furnitureId: 'bed', x: 500, y: 300, scale: 1, rotation: 0, colorway: 'sky', layer: 4 },
    ]
    useHomeStore.setState((state) => ({ rooms: state.rooms.map((room) => (room.id === roomId ? { ...room, furniture: [] } : room)) }))
    for (const p of saved) useHomeStore.getState().addFurniture(p)
    expect(getActiveDecorateRoom(useHomeStore.getState()).furniture).toEqual(saved)
  })

  it('a new piece placed without a colorway falls back to a real default for it', () => {
    const roomId = useHomeStore.getState().activeDecorateRoomId
    useHomeStore.setState((state) => ({ rooms: state.rooms.map((room) => (room.id === roomId ? { ...room, furniture: [] } : room)) }))
    useHomeStore.getState().addFurniture({ id: 'z', furnitureId: 'wardrobe' } as FurniturePlacement)
    expect(getActiveDecorateRoom(useHomeStore.getState()).furniture[0]).toMatchObject({ furnitureId: 'wardrobe', colorway: 'cream', scale: 1, rotation: 0 })
  })
})
