import type { FurnitureCategory, FurnitureCollision, FurnitureDefinition, FurnitureInteractionSlot, FurnitureZone, StyleTarget } from './types'

/** An entry before its recolorable parts/patternable surfaces are attached from STYLING below. */
type RawDefinition = Omit<FurnitureDefinition, 'colorParts' | 'patternSurfaces'>

const target = (id: string, label: string): StyleTarget => ({ id, label })

const BODY = target('body', '본체')
const CUSHION = target('cushion', '방석')
const LEGS = target('legs', '다리')
const TOP = target('top', '상판')
const DOOR = target('door', '문')
const DRAWER = target('door', '서랍')
const HANDLE = target('handle', '손잡이')
const SHADE = target('shade', '갓')
const FRAME = target('frame', '프레임')

const SOFA_STYLE = { colorParts: [BODY, CUSHION, LEGS], patternSurfaces: [target('cushion', '방석'), target('body', '본체 천')] }
const TABLE_STYLE = { colorParts: [TOP, LEGS], patternSurfaces: [] }
const DESK_STYLE = { colorParts: [TOP, BODY, DRAWER, HANDLE], patternSurfaces: [] }
/** A backless bench: a padded seat on a simple frame — no backrest part, unlike CHAIR_STYLE. */
const BENCH_STYLE = { colorParts: [target('seat', '좌판'), FRAME], patternSurfaces: [target('seat', '좌판')] }
const BED_STYLE = {
  colorParts: [target('headboard', '헤드보드'), FRAME, target('blanket', '이불'), target('pillow', '베개')],
  patternSurfaces: [target('blanket', '이불'), target('pillow', '베개')],
}
const CABINET_STYLE = { colorParts: [BODY, DOOR, HANDLE], patternSurfaces: [] }
const DRAWER_STYLE = { colorParts: [BODY, DRAWER, HANDLE], patternSurfaces: [] }
const CHAIR_STYLE = { colorParts: [target('seat', '좌판'), target('back', '등받이'), FRAME], patternSurfaces: [target('seat', '좌판')] }
const BODY_ONLY = { colorParts: [BODY], patternSurfaces: [] }
const FRAME_ONLY = { colorParts: [FRAME], patternSurfaces: [] }
const SHADE_ONLY = { colorParts: [SHADE], patternSurfaces: [] }
const NO_STYLE = { colorParts: [], patternSurfaces: [] }

/**
 * Which parts each piece lets the user recolor and which surfaces take a
 * pattern. Part ids must match furnitureStyling.ts's defaults for the same id
 * (tested). Pieces not listed (plant, rug, window) keep only their preset
 * colorways until their own editing phase.
 */
const STYLING: Record<string, Pick<FurnitureDefinition, 'colorParts' | 'patternSurfaces'>> = {
  // Rug: one whole-surface part/pattern (the pattern is the rug's face, edge to edge). Window: frame + curtain, with the curtain patternable.
  rug: { colorParts: [target('base', '러그 바탕'), target('border', '러그 테두리')], patternSurfaces: [target('base', '러그 표면')] },
  window: { colorParts: [FRAME, target('curtain', '커튼')], patternSurfaces: [target('curtain', '커튼')] },
  sofa: SOFA_STYLE,
  'sofa-single': SOFA_STYLE,
  'sofa-long': SOFA_STYLE,
  armchair: SOFA_STYLE,
  table: TABLE_STYLE,
  'coffee-table': TABLE_STYLE,
  'side-table': TABLE_STYLE,
  'dining-table': TABLE_STYLE,
  bed: BED_STYLE,
  'bed-single': BED_STYLE,
  'bed-double': BED_STYLE,
  'canopy-bed': BED_STYLE,
  'round-table': TABLE_STYLE,
  'tv-stand': CABINET_STYLE,
  wardrobe: CABINET_STYLE,
  nightstand: DRAWER_STYLE,
  vanity: DRAWER_STYLE,
  dresser: DRAWER_STYLE,
  candle: BODY_ONLY,
  'kitchen-cabinet': { colorParts: [TOP, BODY, DOOR, HANDLE], patternSurfaces: [] },
  sink: { colorParts: [TOP, BODY, DOOR, HANDLE], patternSurfaces: [] },
  'kitchen-counter': { colorParts: [TOP, BODY, DOOR, HANDLE], patternSurfaces: [] },
  toaster: BODY_ONLY,
  kettle: BODY_ONLY,
  'coffee-machine': { colorParts: [BODY, target('panel', '조작부')], patternSurfaces: [] },
  desk: DESK_STYLE,
  'computer-desk': DESK_STYLE,
  fridge: { colorParts: [BODY, HANDLE], patternSurfaces: [] },
  microwave: { colorParts: [BODY, target('panel', '조작부')], patternSurfaces: [] },
  'dining-chair': CHAIR_STYLE,
  'office-chair': CHAIR_STYLE,
  'bedroom-bench': BENCH_STYLE,
  'dining-bench': BENCH_STYLE,
  ottoman: BENCH_STYLE,
  'low-cabinet': CABINET_STYLE,
  console: CABINET_STYLE,
  'pendant-light': SHADE_ONLY,
  'wall-mirror': FRAME_ONLY,
  'display-shelf': BODY_ONLY,
  stool: BENCH_STYLE,
  'storage-basket': BODY_ONLY,
  'dining-table-large': TABLE_STYLE,
  bookshelf: BODY_ONLY,
  bookrack: BODY_ONLY,
  'floor-mirror': FRAME_ONLY,
  frame: FRAME_ONLY,
  'wall-clock': { colorParts: [target('rim', '테두리')], patternSurfaces: [] },
  'floor-lamp': SHADE_ONLY,
  'table-lamp': SHADE_ONLY,
  cushion: { colorParts: [BODY, target('button', '단추')], patternSurfaces: [target('body', '쿠션 천')] },
  'bunny-doll': BODY_ONLY,
  'bear-doll': BODY_ONLY,
  vase: BODY_ONLY,
  'desk-clock': BODY_ONLY,
  'book-stack': { colorParts: [target('bottom', '아래 책'), target('middle', '가운데 책'), target('top', '위 책')], patternSurfaces: [] },
  mug: BODY_ONLY,
  curtain: { colorParts: [target('fabric', '커튼 천'), target('tieback', '커튼 끈')], patternSurfaces: [target('fabric', '커튼 천')] },
}

/**
 * Compact builder for the entries added after the original six. Most have
 * no interaction slots (slots stay inert data until something needs them);
 * the optional last argument is only used for pieces the furniture
 * interaction system (see CLAUDE.md's "Furniture interaction" sections)
 * actually seats a character on — currently just the two ordinary chairs.
 */
function piece(
  id: string,
  name: string,
  category: FurnitureCategory,
  width: number,
  height: number,
  scaleRange: [number, number],
  collision: FurnitureCollision,
  zone: FurnitureZone = 'floor',
  interactionSlots: FurnitureInteractionSlot[] = [],
  lightSource = false,
): RawDefinition {
  return { id, name, category, width, height, minScale: scaleRange[0], maxScale: scaleRange[1], zone, collision, isFreeDefault: true, interactionSlots, ...(lightSource ? { lightSource } : {}) }
}

/** A single centered seat slot for an ordinary (one-person) chair — offsetX is always 0 since every chair illustration draws its seat cushion horizontally centered; offsetY is the seat cushion's own vertical center minus half the chair's height (its own local origin), read directly off that chair's real drawn geometry (see the offsetY comment at each call site below) — never guessed. */
function chairSeat(offsetY: number): FurnitureInteractionSlot[] {
  return [{ id: 'seat', kind: 'sit', offsetX: 0, offsetY, facing: -Math.PI / 2 }]
}

/**
 * The two independent lie-down slots of a bed — one per sleeper, so two
 * characters can share the same bed (see `furnitureUsageStore.ts`: every slot
 * is reserved/occupied/released on its own, and one character can hold only
 * one slot at a time). The first keeps the id `'lie'` this helper's
 * single-slot predecessor already used (`bed-single`/`bed-double`/`canopy-bed`
 * always exposed exactly `'lie'`), so any place that already refers to it
 * keeps working; the second is `'lie-right'`. The original `bed` entry never
 * used this helper — it has always had its own two slots (`bed-left`/
 * `bed-right`), unchanged.
 *
 * Positions are derived from each illustration's *real mattress rect*, in
 * fractions of the piece's own width/height (local geometry, never screen
 * coordinates), and re-verified against the actual rendered SVG by
 * `bedLieSlots.test.tsx`:
 *  - `xFraction` — how far left/right of the piece's center each sleeper sits,
 *    as a fraction of `width`. Chosen so the two are far enough apart not to
 *    overlap (>= one character footprint even at the piece's minimum scale),
 *    and both sit well inside the mattress, clear of the frame and the posts.
 *  - `yFraction` — the mattress's own vertical center, as a fraction of
 *    `height`: on the mattress, just below the pillow row (never on the
 *    pillows, never on the frame or above the mattress's top edge, which is
 *    where the old single centered slot — the pillow-row center — actually was).
 * `facing` is `-π/2` for every bed: toward the top of the drawing, where each
 * illustration puts its headboard and pillows (head end).
 */
function bedLieSlots(width: number, height: number, xFraction: number, yFraction: number): FurnitureInteractionSlot[] {
  const offsetX = width * xFraction
  const offsetY = height * (yFraction - 0.5)
  return [
    { id: 'lie', kind: 'lie', offsetX: -offsetX, offsetY, facing: -Math.PI / 2 },
    { id: 'lie-right', kind: 'lie', offsetX, offsetY, facing: -Math.PI / 2 },
  ]
}

/** One centered lie slot for beds that are intentionally single-occupant. */
function singleBedLieSlot(height: number, yFraction: number): FurnitureInteractionSlot[] {
  return [{ id: 'lie', kind: 'lie', offsetX: 0, offsetY: height * (yFraction - 0.5), facing: -Math.PI / 2 }]
}

/**
 * Two standing positions just outside a table's own footprint, on its left
 * and right (never its front/back — see CLAUDE.md's "Furniture interaction"
 * table-approach-direction fix for why). offset = half the piece's own width
 * (its collision rect always spans the *full* drawn width regardless of
 * `footprintHeightRatio`, which only ever narrows the *height*, so no ratio
 * is needed here the way `resolveApproachPoint`'s Y math needs one) plus the
 * same clearance margin (26 = `CHARACTER_RADIUS` + 6) every other approach
 * point already uses. `facing` points inward, toward the table's own center
 * — 0 (east) for the left slot, π (west) for the right one — matching the
 * "도착하면 테이블 쪽을 바라보고" requirement (still data-only; characters
 * have no directional sprite to actually rotate, same disclosed limitation
 * every other slot's `facing` already has).
 */
function tableSideSlots(width: number): FurnitureInteractionSlot[] {
  const offset = width / 2 + 26
  return [
    { id: 'table-left', kind: 'stand', offsetX: -offset, offsetY: 0, facing: 0 },
    { id: 'table-right', kind: 'stand', offsetX: offset, offsetY: 0, facing: Math.PI },
  ]
}

const NONE: FurnitureCollision = { mode: 'none' }
const solid = (footprintHeightRatio: number): FurnitureCollision => ({ mode: 'solid', footprintHeightRatio })

/**
 * The six original entries come first with their ids, names, sizes and
 * interaction slots exactly as they always were — existing saved placements
 * refer to them by id and must keep looking and colliding the same way (the
 * one deliberate behavior change: `window` is now non-blocking, as wall decor
 * should never stop a character walking on the floor).
 *
 * Base sizes were scaled up uniformly by 1.6x from the original set so
 * relative proportions between furniture types stay exactly as before while
 * looking like real furniture in the room rather than small test blocks.
 * Existing saved placements are unaffected: their `scale` (a multiplier on
 * this base size) keeps the same meaning.
 *
 * `collision` is separate from the drawn size: tall pieces only block their
 * base (`footprintHeightRatio`), and rugs, wall decor and tabletop props never
 * block.
 */
const RAW_CATALOG: RawDefinition[] = [
  {
    id: 'sofa',
    name: '소파',
    category: 'living',
    width: 224,
    height: 96,
    minScale: 0.8,
    maxScale: 1.3,
    zone: 'floor',
    collision: { mode: 'solid' },
    isFreeDefault: true,
    // Offsets match SofaIllustration's cushion centers exactly (see its comment).
    interactionSlots: [
      { id: 'sofa-left', kind: 'sit', offsetX: -39.5, offsetY: -9.1, facing: -Math.PI / 2 },
      { id: 'sofa-right', kind: 'sit', offsetX: 39.5, offsetY: -9.1, facing: -Math.PI / 2 },
    ],
  },
  {
    id: 'table',
    name: '테이블',
    category: 'living',
    width: 128,
    height: 128,
    minScale: 0.75,
    maxScale: 1.3,
    zone: 'floor',
    collision: { mode: 'solid' },
    isFreeDefault: true,
    // Standing positions just outside the table's footprint, left/right — see tableSideSlots's own doc comment.
    interactionSlots: tableSideSlots(128),
  },
  {
    id: 'bed',
    name: '침대',
    category: 'bedroom',
    width: 192,
    height: 144,
    minScale: 0.85,
    maxScale: 1.25,
    zone: 'floor',
    collision: { mode: 'solid' },
    isFreeDefault: true,
    // Offsets match BedIllustration's pillow centers exactly (see its comment). kind is 'lie', not 'sit' — see
    // types.ts's InteractionKind doc for why these were reclassified from their original 'sit' (the offsets themselves
    // are untouched, so any prior computation derived from them is unaffected).
    interactionSlots: [
      { id: 'bed-left', kind: 'lie', offsetX: -40.3, offsetY: 10.1, facing: -Math.PI / 2 },
      { id: 'bed-right', kind: 'lie', offsetX: 40.3, offsetY: 10.1, facing: -Math.PI / 2 },
    ],
  },
  {
    id: 'plant',
    name: '화분',
    category: 'decor',
    width: 64,
    height: 64,
    minScale: 0.75,
    maxScale: 1.4,
    zone: 'floor',
    collision: { mode: 'solid' },
    isFreeDefault: true,
    interactionSlots: [],
    // Safe to size-vary via `variants` (unlike an interactive piece) — plant has no interactionSlots at all, so
    // there's no baked-in-at-base-width slot offset a bigger variant could silently misplace (see the
    // dining-table-large comment below for the case where that *does* matter). Default first, matching the
    // original size exactly, so every existing placement is unaffected.
    variants: [
      { id: 'medium', label: '보통 화분', width: 64, height: 64 },
      { id: 'large', label: '큰 화분', width: 88, height: 96 },
    ],
  },
  {
    id: 'rug',
    name: '러그',
    category: 'windowRug',
    width: 320,
    height: 100,
    minScale: 0.7,
    maxScale: 1.4,
    zone: 'floor',
    collision: NONE,
    isFreeDefault: true,
    interactionSlots: [],
    // Drawn flattened for floor perspective, like the original rug: a "circle" is a squat ellipse, a "rectangle" a trapezoid. 타원형 is the original shape and size.
    variants: [
      { id: 'ellipse', label: '타원형', width: 320, height: 100 },
      { id: 'circle', label: '원형', width: 200, height: 110 },
      { id: 'rect', label: '직사각형', width: 300, height: 100 },
      { id: 'heart', label: '하트형', width: 200, height: 130 },
    ],
  },
  {
    id: 'window',
    name: '창문',
    category: 'windowRug',
    width: 180,
    height: 140,
    minScale: 0.8,
    maxScale: 1.3,
    zone: 'wall',
    collision: NONE,
    isFreeDefault: true,
    interactionSlots: [],
  },

  // ---- 거실
  piece('sofa-single', '1인용 소파', 'living', 128, 96, [0.8, 1.3], solid(0.85)),
  piece('sofa-long', '긴 소파', 'living', 288, 96, [0.75, 1.2], solid(0.85)),
  piece('armchair', '안락의자', 'living', 112, 104, [0.8, 1.3], solid(0.8)),
  piece('coffee-table', '로우 테이블', 'living', 128, 64, [0.75, 1.4], solid(0.7)),
  piece('side-table', '사이드 테이블', 'living', 64, 72, [0.75, 1.5], solid(0.5)),
  piece('tv-stand', 'TV', 'living', 200, 120, [0.75, 1.3], solid(0.45)),
  {
    ...piece('bookshelf', '책장', 'living', 112, 192, [0.75, 1.2], solid(0.25)),
    // Safe to size-vary — bookshelf has no interactionSlots. BookshelfIllustration itself branches its drawn shelf
    // count on `variant` (4 vs 2), a genuine visual difference from catalog data alone, same pattern dresser's own
    // drawer-count variant already established. Default first, matching the original size exactly.
    variants: [
      { id: 'four-shelf', label: '4단', width: 112, height: 192 },
      { id: 'two-shelf', label: '2단', width: 112, height: 120 },
    ],
  },

  // ---- 침실
  // Both are `BedBody` (BedroomIllustrations.tsx): mattress rect x 0.04w–0.96w, y 0.40h–0.74h, so its vertical center
  // is 0.57h; the pillow row ends at 0.48h, so 0.57h is on the mattress just below it.
  //  - bed-single: intentionally single-occupant; centered on its one wide pillow/mattress.
  //  - bed-double: two pillows of width 0.385w whose centers are ±0.2075w from center — one sleeper per side.
  piece('bed-single', '싱글 침대', 'bedroom', 144, 144, [0.85, 1.25], solid(0.9), 'floor', singleBedLieSlot(144, 0.57)),
  piece('bed-double', '더블 침대', 'bedroom', 224, 144, [0.8, 1.2], solid(0.9), 'floor', bedLieSlots(224, 144, 0.2075, 0.57)),
  piece('nightstand', '협탁', 'bedroom', 64, 72, [0.75, 1.5], solid(0.6)),
  piece('vanity', '화장대', 'bedroom', 128, 160, [0.75, 1.2], solid(0.4)),
  piece('wardrobe', '옷장', 'bedroom', 128, 192, [0.75, 1.2], solid(0.25)),
  piece('floor-mirror', '전신거울', 'bedroom', 72, 184, [0.75, 1.2], NONE, 'wall'),

  // ---- 주방
  // Stand slots only — dining-chair's own sit slot is a separate, unrelated piece; this phase never auto-seats a chair near the table.
  piece('dining-table', '식탁', 'kitchen', 176, 104, [0.75, 1.3], solid(0.65), 'floor', tableSideSlots(176)),
  // Seat cushion in DiningChairIllustration spans y=[0.42h, 0.55h] (center 0.485h); offset from the chair's own center (0.5h) is -0.015h = -1.44 at h=96.
  piece('dining-chair', '식탁 의자', 'kitchen', 56, 96, [0.75, 1.4], solid(0.5), 'floor', chairSeat(-1.4)),
  piece('fridge', '냉장고', 'kitchen', 88, 176, [0.75, 1.2], solid(0.25)),
  piece('kitchen-cabinet', '주방 수납장', 'kitchen', 128, 96, [0.75, 1.4], solid(0.65)),
  piece('sink', '싱크대', 'kitchen', 144, 104, [0.75, 1.4], solid(0.65)),
  piece('microwave', '전자레인지', 'kitchen', 72, 48, [0.75, 1.6], NONE),
  // A plain prep counter — distinct from kitchen-cabinet (a closed storage cabinet) and sink (has its own basin):
  // real bottom-cabinet-plus-worktop construction with a cutting board resting on top, the "생활감" this batch asks for.
  piece('kitchen-counter', '조리대', 'kitchen', 128, 96, [0.75, 1.4], solid(0.65)),
  // Small countertop appliances — same convention microwave already established (zone 'floor', collision NONE: small
  // enough that a walking character steps around them without any dedicated collision rect).
  piece('toaster', '토스터', 'kitchen', 40, 36, [0.75, 2], NONE),
  piece('kettle', '주전자', 'kitchen', 36, 44, [0.75, 2], NONE),
  piece('coffee-machine', '커피머신', 'kitchen', 44, 56, [0.75, 1.8], NONE),

  // ---- 서재
  piece('desk', '책상', 'study', 176, 104, [0.75, 1.3], solid(0.6)),
  // Seat cushion in OfficeChairIllustration spans y=[0.5h, 0.62h] (center 0.56h); offset from the chair's own center (0.5h) is +0.06h = 6.72 at h=112.
  piece('office-chair', '사무용 의자', 'study', 72, 112, [0.75, 1.4], solid(0.4), 'floor', chairSeat(6.7)),
  piece('bookrack', '책꽂이', 'study', 96, 72, [0.75, 1.6], NONE),
  // lightSource: true added alongside the furniture-variety-expansion phase's interactionType classifier (this is
  // THE original lamp — was already drawing its own warm glow before that classifier existed, this just makes the
  // metadata match what the illustration already did). Purely additive catalog data: FurniturePlacement is
  // unchanged, so every existing saved lamp placement is unaffected.
  piece('floor-lamp', '스탠드 조명', 'lighting', 56, 176, [0.75, 1.3], solid(0.15), 'floor', [], true),

  // ---- 조명·소품 (tabletop props never block; floor-standing ones are small enough to step around)
  piece('table-lamp', '테이블 조명', 'lighting', 40, 64, [0.75, 1.8], NONE, 'floor', [], true),
  piece('cushion', '쿠션', 'decor', 48, 48, [0.75, 2], NONE),
  piece('bunny-doll', '토끼 인형', 'decor', 56, 64, [0.75, 2], NONE),
  piece('bear-doll', '곰 인형', 'decor', 56, 64, [0.75, 2], NONE),
  {
    ...piece('vase', '꽃병', 'decor', 40, 64, [0.75, 1.8], NONE),
    // Same width/height for both — vase has no interactionSlots, so this is safe regardless, but kept identical on
    // purpose: only the flowers themselves differ. 'flowers' is the default (matches the original always-drawn
    // design exactly), so every existing saved vase placement renders unchanged.
    variants: [
      { id: 'flowers', label: '꽃이 있는 꽃병', width: 40, height: 64 },
      { id: 'empty', label: '빈 꽃병', width: 40, height: 64 },
    ],
  },
  piece('frame', '액자', 'decor', 64, 80, [0.75, 1.8], NONE, 'wall'),
  piece('desk-clock', '탁상시계', 'decor', 40, 40, [0.75, 2], NONE),
  piece('book-stack', '책 더미', 'decor', 56, 40, [0.75, 2], NONE),
  piece('mug', '머그컵', 'decor', 32, 32, [0.75, 2.2], NONE),
  piece('wall-clock', '벽시계', 'decor', 56, 56, [0.75, 1.8], NONE, 'wall'),
  piece('curtain', '커튼', 'windowRug', 96, 176, [0.75, 1.3], NONE, 'wall'),

  // ---- 신규: 장식/비상호작용 — 러그·화분·액자·거울·협탁·책장은 이미 카탈로그에 있어(rug/plant/frame/floor-mirror/nightstand/bookshelf) 새로 추가하지 않는다.
  {
    ...piece('dresser', '서랍장', 'bedroom', 144, 112, [0.75, 1.3], solid(0.5)),
    // Safe to size-vary — dresser has no interactionSlots either. DresserIllustration itself branches its drawn
    // drawer-row count on `variant` (2 vs 3), a genuine visual difference from catalog data alone, not just a resize.
    variants: [
      { id: 'three-drawer', label: '3단', width: 144, height: 112 },
      { id: 'two-drawer', label: '2단', width: 144, height: 88 },
    ],
  },
  // Tabletop prop — collision:none like every other small decor item, but a real light source (see furnitureCatalog's `piece` `lightSource` param and CandleIllustration's own glow).
  piece('candle', '캔들', 'decor', 24, 36, [0.75, 2.2], NONE, 'floor', [], true),

  // ---- 신규: 상호작용 가구 — 기존 소파/의자·테이블 상호작용 엔진을 그대로 재사용 (bedLieSlots / tableSideSlots / chairSeat), 새 엔진을 만들지 않는다.
  // CanopyBedIllustration: mattress rect x 0.04w–0.96w, y 0.588h–0.810h → vertical center 0.699h, below the pillow
  // (y 0.529h–0.640h). This bed is intentionally single-occupant: its one lie slot is centered horizontally
  // and moved to y=0.699h, the actual mattress center, instead of the old pillow-row position at 0.5845h.
  piece('canopy-bed', '캐노피 침대', 'bedroom', 168, 176, [0.8, 1.2], solid(0.35), 'floor', singleBedLieSlot(176, 0.699)),
  piece('round-table', '원형 테이블', 'living', 140, 90, [0.75, 1.3], solid(0.65), 'floor', tableSideSlots(140)),

  // ---- 가구 종류 확장 (2차): 거실/침실/식사/작업/수납/조명/장식 전 영역
  // Cushion block center (y=0.18h to 0.68h, center 0.43h) minus local origin (0.5h) = -0.07h = -4.5 at h=64.
  piece('bedroom-bench', '벤치', 'bedroom', 112, 64, [0.75, 1.4], solid(0.5), 'floor', chairSeat(-4.5)),
  // Two independent seats, same left/right-offset pattern sofa-left/right already established — cushion center
  // (y=0.2h to 0.62h, center 0.41h) minus local origin (0.5h) = -0.09h = -6.5 at h=72; offsetX = ±width*0.25 = ±28.
  piece('dining-bench', '벤치형 식탁 의자', 'kitchen', 112, 72, [0.75, 1.4], solid(0.45), 'floor', [
    { id: 'bench-left', kind: 'sit', offsetX: -28, offsetY: -6.5, facing: -Math.PI / 2 },
    { id: 'bench-right', kind: 'sit', offsetX: 28, offsetY: -6.5, facing: -Math.PI / 2 },
  ]),
  // Padded seat top center (y=0.15h to 0.57h, center 0.36h) minus local origin (0.5h) = -0.14h = -6.7 at h=48.
  // Deliberately given a real 'sit' slot — per the spec's own "오토만 중 실제로 앉을 수 있는 것", a decorative,
  // non-sittable ottoman would simply declare no interactionSlots at all (exactly like every other decor piece);
  // this specific piece was designed to be one of the sittable ones.
  piece('ottoman', '오토만', 'living', 64, 48, [0.75, 1.6], solid(0.55), 'floor', chairSeat(-6.7)),
  // Table-type by classification (furnitureInteractionType.ts's TABLE_TYPE_NO_SLOT_IDS) but no real interactionSlots
  // — same reasoning as the original `desk`: a character uses a *separate* office-chair placed nearby, never the
  // desk/computer-desk itself.
  piece('computer-desk', '컴퓨터 책상', 'study', 176, 112, [0.75, 1.3], solid(0.6)),
  piece('low-cabinet', '낮은 수납장', 'storage', 144, 80, [0.75, 1.3], solid(0.55)),
  piece('console', '콘솔', 'storage', 120, 88, [0.75, 1.3], solid(0.4)),
  // Ceiling-hung — starts in the wall band like every other wall-zone piece (window, frame, wall-clock, curtain),
  // then moves freely with no range limit, per CLAUDE.md's established wall-piece design. A second `lightSource`.
  piece('pendant-light', '펜던트 조명', 'lighting', 48, 120, [0.75, 1.4], NONE, 'wall', [], true),
  {
    ...piece('wall-mirror', '벽거울', 'decor', 56, 72, [0.75, 1.6], NONE, 'wall'),
    // Same width/height for both shapes — wall-mirror has no interactionSlots, so this is safe regardless, but kept
    // identical in size on purpose (a real shape difference, not a resize): 오벌 is the original ellipse silhouette,
    // 아치형 a rounded-top rectangle, both drawn by WallMirrorIllustration branching on `variant`.
    variants: [
      { id: 'oval', label: '오벌', width: 56, height: 72 },
      { id: 'arch', label: '아치형', width: 56, height: 72 },
    ],
  },
  piece('display-shelf', '장식 선반', 'decor', 88, 32, [0.75, 1.6], NONE, 'wall'),
  // A second, larger dining table — a separate id (not a `variants` entry on `dining-table`) because its
  // `tableSideSlots` offset is baked in from *this* definition's own base width (240), and a size-changing
  // `variants` entry would NOT correctly resize an already-computed interactionSlots offset (verified: `variants`
  // only affects the *rendered/footprint* size via `getFurnitureSize`, never the static `interactionSlots` array) —
  // exactly the same reasoning the original `table`/`dining-table` split already established.
  piece('dining-table-large', '6인용 식탁', 'kitchen', 240, 120, [0.75, 1.2], solid(0.65), 'floor', tableSideSlots(240)),

  // ---- 가구 비주얼 고도화 + 종류 확장 (3차): the requested list cross-checked against the catalog above first —
  // 2인/3인 소파(sofa/sofa-long), 암체어(armchair), 싱글/더블 침대(bed-single/bed-double), 협탁(nightstand),
  // 서랍장(dresser), 책장(bookshelf), 전신거울(floor-mirror), 화분(plant), 인형(bunny-doll/bear-doll), 컴퓨터
  // 책상(computer-desk), 티테이블(coffee-table) and 벽 장식(frame/wall-clock/wall-mirror/display-shelf) already
  // exist under those ids — not duplicated. Only these two were genuinely missing.
  // StoolIllustration's seat spans y=[0.1h, 0.22h] (center 0.16h) for BOTH variants (same width/height on purpose —
  // see its own doc comment); offset from the stool's own center (0.5h) is -0.34h = -25.8 at h=76.
  {
    ...piece('stool', '스툴', 'kitchen', 48, 76, [0.75, 1.5], solid(0.55), 'floor', chairSeat(-25.8)),
    // A real interaction-slot piece: both variants MUST share the exact same width/height (see StoolIllustration's
    // own doc comment) — only the seat's drawn silhouette differs (round vs. square), never the size, so the sit
    // slot's offset (baked in from this definition's own base width/height) stays correct for either one.
    variants: [
      { id: 'round', label: '둥근 스툴', width: 48, height: 76 },
      { id: 'square', label: '사각 스툴', width: 48, height: 76 },
    ],
  },
  {
    ...piece('storage-basket', '수납 바구니', 'storage', 56, 56, [0.75, 1.6], solid(0.65)),
    // Different width/height between shapes is safe — storage-basket has no interactionSlots. 원형 (round woven
    // basket) is the default; 사각형 (rectangular fabric bin) is a genuinely different silhouette, not a recolor.
    variants: [
      { id: 'round', label: '원형 바구니', width: 56, height: 56 },
      { id: 'rect', label: '사각 바구니', width: 64, height: 52 },
    ],
  },
]

export const FURNITURE_CATALOG: FurnitureDefinition[] = RAW_CATALOG.map((entry) => ({ ...entry, ...(STYLING[entry.id] ?? NO_STYLE) }))

export function getFurnitureDefinition(furnitureId: string): FurnitureDefinition | undefined {
  return FURNITURE_CATALOG.find((item) => item.id === furnitureId)
}

/** Whether `variantId` names one of the definition's shapes. */
export function isValidVariant(definition: FurnitureDefinition | undefined, variantId: unknown): variantId is string {
  return typeof variantId === 'string' && !!definition?.variants?.some((v) => v.id === variantId)
}

/**
 * The drawn size of one placed piece: its chosen variant's size, or the
 * definition's own for a piece with no (or an unknown) variant, or 60x60 for an
 * id no longer in the catalog. Everything that lays out, drags, clamps or
 * collides a piece reads its size through here so a rug's shape and its
 * footprint can never disagree.
 */
export function getFurnitureSize(definition: FurnitureDefinition | undefined, variantId?: string): { width: number; height: number } {
  const variant = isValidVariant(definition, variantId) ? definition?.variants?.find((v) => v.id === variantId) : undefined
  return { width: variant?.width ?? definition?.width ?? 60, height: variant?.height ?? definition?.height ?? 60 }
}
