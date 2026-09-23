import { resolvePartTones } from '../furnitureStyling'
import { BOOK_TONES, FURNITURE_PALETTE as P } from '../palette'
import { Block, Book, GroundShadow, Knob, Leg, SurfaceSheen, SW, Svg, Tabletop, VolumeShade } from './parts'
import { patternFill, surfacePattern } from './surface'
import type { FurnitureIllustrationProps as Props } from './types'

/**
 * Shared body for the single and long sofas: same construction as the
 * original two-seater (backrest set back, armrests and base frame all reaching
 * `groundY`, short legs overlapping into the frame) but with `cushions` seats.
 * `groundY` is the one source of truth armrests, frame and legs key off, so
 * they can never drift apart into a gap. Patterns go only on the two fabric
 * surfaces (`body`, `cushion`) — never on legs or shadows.
 */
function SofaBody({ width: w, height: h, colorway, style, cushions, id, label }: Props & { cushions: number; id: string; label: string }) {
  const { body, cushion, legs } = resolvePartTones(id, colorway, style)
  const bodyPattern = surfacePattern('body', style)
  const cushionPattern = surfacePattern('cushion', style)
  const bodyFill = patternFill(bodyPattern)
  const cushionFill = patternFill(cushionPattern)
  const groundY = h * 0.85
  const armW = h * 0.28
  const armY = h * 0.15
  const legH = h * 0.1
  const legY = groundY - h * 0.02
  const legW = h * 0.13
  const frameY = h * 0.34
  const cushionInset = armW + h * 0.06
  const gap = h * 0.025
  const cushionY = h * 0.27
  const cushionH = h * 0.27
  const cushionW = (w - 2 * cushionInset - gap * (cushions - 1)) / cushions
  const legXs = [armW * 0.7, w - armW * 0.7 - legW, ...(cushions > 2 ? [w / 2 - legW / 2] : [])]
  const shadowY = legY + legH + h * 0.01

  return (
    <Svg width={w} height={h} label={label} patterns={[bodyPattern, cushionPattern]}>
      <GroundShadow cx={w / 2} y={shadowY} ambientRx={w * 0.43} contactRx={w / 2 - armW * 0.7 + legW * 0.3} unit={h} />
      <Block x={w * 0.03} y={h * 0.04} w={w * 0.94} h={h * 0.44} r={h * 0.15} tone={body} fill={bodyFill} />
      <SurfaceSheen cx={w / 2} cy={h * 0.16} rx={w * 0.34} ry={h * 0.08} />
      <Block x={0} y={armY} w={armW} h={groundY - armY} r={armW * 0.45} tone={body} fill={bodyFill} />
      <SurfaceSheen cx={armW * 0.34} cy={armY + (groundY - armY) * 0.28} rx={armW * 0.22} ry={(groundY - armY) * 0.2} opacity={0.2} />
      <Block x={w - armW} y={armY} w={armW} h={groundY - armY} r={armW * 0.45} tone={body} fill={bodyFill} />
      <VolumeShade cx={w - armW * 0.3} cy={armY + (groundY - armY) * 0.5} rx={armW * 0.24} ry={(groundY - armY) * 0.34} color={body.stroke} opacity={0.13} />
      <Block x={armW - h * 0.04} y={frameY} w={w - 2 * (armW - h * 0.04)} h={groundY - frameY} r={h * 0.05} tone={body} fill={bodyFill} />
      {/* soft shaded band where the seat cushions meet the frame — the same "좌석 깊이" cue the main sofa uses */}
      <VolumeShade cx={w / 2} cy={cushionY - h * 0.01} rx={w * 0.3} ry={h * 0.02} color={body.stroke} opacity={0.16} />
      {legXs.map((x) => (
        <Leg key={x} x={x} y={legY} w={legW} h={legH} tone={legs} />
      ))}
      {Array.from({ length: cushions }, (_, i) => (
        <Block key={i} x={cushionInset + i * (cushionW + gap)} y={cushionY} w={cushionW} h={cushionH} r={cushionH * 0.35} tone={cushion} fill={cushionFill} sw={1.2} />
      ))}
      {Array.from({ length: cushions }, (_, i) => (
        <SurfaceSheen key={i} cx={cushionInset + i * (cushionW + gap) + cushionW / 2} cy={cushionY + cushionH * 0.26} rx={cushionW * 0.3} ry={cushionH * 0.14} opacity={0.24} />
      ))}
    </Svg>
  )
}

export function SofaSingleIllustration(props: Props) {
  return <SofaBody {...props} id="sofa-single" cushions={1} label="1인용 소파" />
}

export function SofaLongIllustration(props: Props) {
  return <SofaBody {...props} id="sofa-long" cushions={3} label="긴 소파" />
}

/** A rounder, taller-backed chair with tufting buttons and two visible wooden legs. */
export function ArmchairIllustration({ width: w, height: h, colorway, style }: Props) {
  const { body, cushion, legs } = resolvePartTones('armchair', colorway, style)
  const bodyPattern = surfacePattern('body', style)
  const cushionPattern = surfacePattern('cushion', style)
  const bodyFill = patternFill(bodyPattern)
  const groundY = h * 0.96
  const legH = h * 0.09
  const legW = w * 0.07
  const armW = w * 0.2
  // Arms and the seat base end at frameBottom; the legs start just above it and end at groundY, where the shadow sits.
  const frameBottom = groundY - legH + h * 0.02
  return (
    <Svg width={w} height={h} label="안락의자" patterns={[bodyPattern, cushionPattern]}>
      <GroundShadow cx={w / 2} y={groundY + h * 0.005} ambientRx={w * 0.42} contactRx={w * 0.36} unit={h} />
      <Block x={w * 0.08} y={h * 0.02} w={w * 0.84} h={h * 0.56} r={w * 0.3} tone={body} fill={bodyFill} />
      <SurfaceSheen cx={w / 2} cy={h * 0.14} rx={w * 0.3} ry={h * 0.08} />
      {[0.32, 0.5, 0.68].map((fx) => (
        <circle key={fx} cx={w * fx} cy={h * 0.24} r={w * 0.025} fill={body.stroke} opacity={0.7} />
      ))}
      <Block x={0} y={h * 0.34} w={armW} h={frameBottom - h * 0.34} r={armW * 0.5} tone={body} fill={bodyFill} />
      <SurfaceSheen cx={armW * 0.3} cy={h * 0.34 + (frameBottom - h * 0.34) * 0.3} rx={armW * 0.2} ry={(frameBottom - h * 0.34) * 0.18} opacity={0.2} />
      <Block x={w - armW} y={h * 0.34} w={armW} h={frameBottom - h * 0.34} r={armW * 0.5} tone={body} fill={bodyFill} />
      <VolumeShade cx={w - armW * 0.28} cy={h * 0.34 + (frameBottom - h * 0.34) * 0.55} rx={armW * 0.22} ry={(frameBottom - h * 0.34) * 0.3} color={body.stroke} opacity={0.13} />
      <Block x={armW * 0.7} y={h * 0.5} w={w - armW * 1.4} h={frameBottom - h * 0.5} r={h * 0.05} tone={body} fill={bodyFill} />
      <Leg x={w * 0.1} y={frameBottom - h * 0.02} w={legW} h={groundY - frameBottom + h * 0.02} tone={legs} />
      <Leg x={w * 0.9 - legW} y={frameBottom - h * 0.02} w={legW} h={groundY - frameBottom + h * 0.02} tone={legs} />
      <Block x={armW * 0.9} y={h * 0.44} w={w - armW * 1.8} h={h * 0.22} r={h * 0.09} tone={cushion} fill={patternFill(cushionPattern)} sw={1.2} />
      <SurfaceSheen cx={w / 2} cy={h * 0.5} rx={(w - armW * 1.8) * 0.32} ry={h * 0.04} opacity={0.22} />
    </Svg>
  )
}

/** Padded footstool: a round cushioned top on four short splayed legs. Deliberately given a real `'sit'` slot (see `furnitureCatalog.ts`'s own comment on why) — the cushion top is the one patternable surface. */
export function OttomanIllustration({ width: w, height: h, colorway, style }: Props) {
  const { seat, frame } = resolvePartTones('ottoman', colorway, style)
  const seatPattern = surfacePattern('seat', style)
  const groundY = h * 0.95
  const legW = w * 0.06
  const seatCy = h * 0.36
  const seatRy = h * 0.21
  return (
    <Svg width={w} height={h} label="오토만" patterns={[seatPattern]}>
      <GroundShadow cx={w / 2} y={groundY} ambientRx={w * 0.44} contactRx={w * 0.34} unit={h} />
      <g transform={`rotate(-8 ${w * 0.1 + legW / 2} ${seatCy + seatRy})`}>
        <Leg x={w * 0.1} y={seatCy + seatRy - h * 0.02} w={legW} h={groundY - (seatCy + seatRy - h * 0.02)} tone={frame} opacity={0.85} />
      </g>
      <g transform={`rotate(8 ${w * 0.9 - legW / 2} ${seatCy + seatRy})`}>
        <Leg x={w * 0.9 - legW} y={seatCy + seatRy - h * 0.02} w={legW} h={groundY - (seatCy + seatRy - h * 0.02)} tone={frame} opacity={0.85} />
      </g>
      <ellipse cx={w / 2} cy={seatCy} rx={w * 0.42} ry={seatRy} fill={seat.fill} stroke={seat.stroke} strokeWidth={1.2} />
      {patternFill(seatPattern) && <ellipse cx={w / 2} cy={seatCy} rx={w * 0.42} ry={seatRy} fill={patternFill(seatPattern)} stroke="none" />}
      <SurfaceSheen cx={w / 2} cy={seatCy - seatRy * 0.32} rx={w * 0.24} ry={seatRy * 0.35} opacity={0.26} />
    </Svg>
  )
}

/** Low, wide cabinet with sliding-look doors — a living-room storage piece distinct from the taller `wardrobe` and the countertop `kitchen-cabinet`. */
export function LowCabinetIllustration({ width: w, height: h, colorway, style }: Props) {
  const { body, door, handle } = resolvePartTones('low-cabinet', colorway, style)
  const groundY = h * 0.95
  return (
    <Svg width={w} height={h} label="낮은 수납장">
      <GroundShadow cx={w / 2} y={groundY + h * 0.005} ambientRx={w * 0.48} contactRx={w * 0.43} unit={h} />
      <Leg x={w * 0.06} y={h * 0.86} w={w * 0.05} h={groundY - h * 0.86} />
      <Leg x={w * 0.94 - w * 0.05} y={h * 0.86} w={w * 0.05} h={groundY - h * 0.86} />
      <Block x={w * 0.02} y={h * 0.1} w={w * 0.96} h={h * 0.78} r={4} tone={body} />
      <Block x={w * 0.06} y={h * 0.18} w={w * 0.42} h={h * 0.62} r={2} tone={door} sw={1.2} />
      <SurfaceSheen cx={w * 0.16} cy={h * 0.3} rx={w * 0.1} ry={h * 0.16} opacity={0.16} />
      <Block x={w * 0.52} y={h * 0.18} w={w * 0.42} h={h * 0.62} r={2} tone={door} sw={1.2} />
      <VolumeShade cx={w * 0.84} cy={h * 0.5} rx={w * 0.09} ry={h * 0.24} color={door.stroke} opacity={0.1} />
      <Block x={w * 0.46} y={h * 0.3} w={w * 0.015} h={h * 0.4} r={1} tone={handle} sw={1} />
      <Block x={w * 0.535} y={h * 0.3} w={w * 0.015} h={h * 0.4} r={1} tone={handle} sw={1} />
      <SurfaceSheen cx={w / 2} cy={h * 0.16} rx={w * 0.3} ry={h * 0.03} opacity={0.28} />
    </Svg>
  )
}

/** Slim entryway console: a narrow tabletop on tall thin legs with one open shelf below — a deliberately slim profile so it reads as a distinct piece from every other cabinet. */
export function ConsoleIllustration({ width: w, height: h, colorway, style }: Props) {
  const { body, door, handle } = resolvePartTones('console', colorway, style)
  const groundY = h * 0.95
  const topY = h * 0.06
  const depth = h * 0.1
  const thick = h * 0.045
  const shelfY = h * 0.62
  return (
    <Svg width={w} height={h} label="콘솔">
      <GroundShadow cx={w / 2} y={groundY} ambientRx={w * 0.42} contactRx={w * 0.34} unit={h} />
      <Leg x={w * 0.06} y={topY + depth + thick} w={w * 0.035} h={groundY - topY - depth - thick} tone={body} />
      <Leg x={w * 0.94 - w * 0.035} y={topY + depth + thick} w={w * 0.035} h={groundY - topY - depth - thick} tone={body} />
      <Block x={w * 0.1} y={shelfY} w={w * 0.8} h={h * 0.035} r={1} tone={body} sw={1} />
      <Block x={w * 0.14} y={shelfY + h * 0.06} w={w * 0.14} h={h * 0.24} r={2} tone={door} sw={1} />
      <Knob cx={w * 0.21} cy={shelfY + h * 0.18} r={1.6} tone={handle} />
      <Tabletop x={0} y={topY} w={w} depth={depth} thick={thick} inset={w * 0.04} tone={body} />
    </Svg>
  )
}

/** Low table: a top slab with depth, four legs (the back pair set higher and fainter for perspective), and a lower shelf. */
export function CoffeeTableIllustration({ width: w, height: h, colorway, style }: Props) {
  const { top, legs } = resolvePartTones('coffee-table', colorway, style)
  const groundY = h * 0.9
  const topY = h * 0.1
  const depth = h * 0.16
  const thick = h * 0.09
  const legW = w * 0.05
  const legTop = topY + depth + thick * 0.5
  return (
    <Svg width={w} height={h} label="로우 테이블">
      <GroundShadow cx={w / 2} y={groundY + h * 0.01} ambientRx={w * 0.46} contactRx={w * 0.4} unit={h} />
      <Leg x={w * 0.15} y={legTop} w={legW} h={groundY - legTop - h * 0.04} tone={legs} opacity={0.7} />
      <Leg x={w * 0.85 - legW} y={legTop} w={legW} h={groundY - legTop - h * 0.04} tone={legs} opacity={0.7} />
      <Block x={w * 0.09} y={h * 0.66} w={w * 0.82} h={h * 0.06} r={2} tone={legs} sw={1} />
      <Leg x={w * 0.05} y={legTop} w={legW} h={groundY - legTop} tone={legs} />
      <Leg x={w * 0.95 - legW} y={legTop} w={legW} h={groundY - legTop} tone={legs} />
      <Tabletop x={0} y={topY} w={w} depth={depth} thick={thick} inset={w * 0.05} tone={top} />
    </Svg>
  )
}

/** Round pedestal side table: disc top with visible thickness, a single column, and a round base. */
export function SideTableIllustration({ width: w, height: h, colorway, style }: Props) {
  const { top, legs } = resolvePartTones('side-table', colorway, style)
  const groundY = h * 0.92
  const topCy = h * 0.14
  const thick = h * 0.06
  return (
    <Svg width={w} height={h} label="사이드 테이블">
      <GroundShadow cx={w / 2} y={groundY} ambientRx={w * 0.42} contactRx={w * 0.3} unit={h} />
      <ellipse cx={w / 2} cy={groundY - h * 0.03} rx={w * 0.3} ry={h * 0.04} fill={legs.fill} stroke={legs.stroke} strokeWidth={SW} />
      <Block x={w / 2 - w * 0.05} y={topCy + thick} w={w * 0.1} h={groundY - h * 0.03 - topCy - thick} tone={legs} sw={1} />
      <ellipse cx={w / 2} cy={topCy + thick} rx={w * 0.48} ry={h * 0.08} fill={top.stroke} opacity={0.5} />
      <ellipse cx={w / 2} cy={topCy} rx={w * 0.48} ry={h * 0.08} fill={top.fill} stroke={top.stroke} strokeWidth={SW} />
      <SurfaceSheen cx={w / 2} cy={topCy - h * 0.015} rx={w * 0.3} ry={h * 0.035} opacity={0.3} />
    </Svg>
  )
}

/**
 * Round pedestal dining/gathering table — the same disc-top-on-a-column
 * construction as `SideTableIllustration`, but taller and wider (standing-
 * height, not side-table-height), so it reads as a distinct piece to stand
 * at. Its two `'stand'` slots (`tableSideSlots`, exactly like the original
 * table/dining-table) don't depend on this illustration's vertical
 * proportions at all — they're offset left/right from the placement's own
 * center at `offsetY: 0`, unaffected by how tall the drawn column is.
 */
export function RoundTableIllustration({ width: w, height: h, colorway, style }: Props) {
  const { top, legs } = resolvePartTones('round-table', colorway, style)
  const groundY = h * 0.93
  const topCy = h * 0.18
  const thick = h * 0.07
  return (
    <Svg width={w} height={h} label="원형 테이블">
      <GroundShadow cx={w / 2} y={groundY} ambientRx={w * 0.44} contactRx={w * 0.3} unit={h} />
      <ellipse cx={w / 2} cy={groundY - h * 0.03} rx={w * 0.15} ry={h * 0.035} fill={legs.fill} stroke={legs.stroke} strokeWidth={SW} />
      <Block x={w / 2 - w * 0.045} y={topCy + thick} w={w * 0.09} h={groundY - h * 0.03 - topCy - thick} tone={legs} sw={1} />
      <ellipse cx={w / 2} cy={topCy + thick} rx={w * 0.46} ry={h * 0.11} fill={top.stroke} opacity={0.5} />
      <ellipse cx={w / 2} cy={topCy} rx={w * 0.46} ry={h * 0.11} fill={top.fill} stroke={top.stroke} strokeWidth={SW} />
      <SurfaceSheen cx={w / 2} cy={topCy - h * 0.02} rx={w * 0.28} ry={h * 0.04} opacity={0.3} />
    </Svg>
  )
}

/** A television on a low cabinet, drawn as one piece: screen, neck and foot on the cabinet top, two doors, and short legs. */
export function TvStandIllustration({ width: w, height: h, colorway, style }: Props) {
  const { body, door, handle } = resolvePartTones('tv-stand', colorway, style)
  const groundY = h * 0.96
  const cabY = h * 0.58
  const cabH = h * 0.32
  return (
    <Svg width={w} height={h} label="TV와 TV장">
      <GroundShadow cx={w / 2} y={groundY + h * 0.005} ambientRx={w * 0.47} contactRx={w * 0.43} unit={h} />
      <Leg x={w * 0.06} y={cabY + cabH - 2} w={w * 0.03} h={groundY - cabY - cabH + 2} />
      <Leg x={w * 0.91} y={cabY + cabH - 2} w={w * 0.03} h={groundY - cabY - cabH + 2} />
      <Block x={w * 0.36} y={h * 0.55} w={w * 0.28} h={h * 0.03} r={3} tone={P.metal} sw={1} />
      <Block x={w / 2 - w * 0.03} y={h * 0.5} w={w * 0.06} h={h * 0.06} tone={P.metal} sw={1} />
      <Block x={w * 0.12} y={h * 0.02} w={w * 0.76} h={h * 0.5} r={6} tone={P.slate} />
      <Block x={w * 0.14} y={h * 0.045} w={w * 0.72} h={h * 0.445} r={4} tone={P.slate} fill="#8A91A6" stroke="none" />
      <polygon points={`${w * 0.2},${h * 0.06} ${w * 0.4},${h * 0.06} ${w * 0.27},${h * 0.47} ${w * 0.16},${h * 0.47}`} fill="#fff" opacity={0.16} />
      <Block x={0} y={cabY} w={w} h={cabH} r={6} tone={body} />
      <SurfaceSheen cx={w / 2} cy={cabY + h * 0.02} rx={w * 0.34} ry={h * 0.015} opacity={0.22} />
      <Block x={w * 0.04} y={cabY + h * 0.04} w={w * 0.44} h={cabH - h * 0.08} r={3} tone={door} sw={1} />
      <Block x={w * 0.52} y={cabY + h * 0.04} w={w * 0.44} h={cabH - h * 0.08} r={3} tone={door} sw={1} />
      <Knob cx={w * 0.45} cy={cabY + cabH / 2} r={2.2} tone={handle} />
      <Knob cx={w * 0.55} cy={cabY + cabH / 2} r={2.2} tone={handle} />
    </Svg>
  )
}

const SHELF_BOOKS: Array<Array<[number, number]>> = [
  [[0.11, 0.8], [0.09, 0.95], [0.13, 0.7], [0.1, 0.88], [0.12, 0.76], [0.09, 0.92]],
  [[0.1, 0.9], [0.12, 0.72], [0.09, 0.85], [0.14, 0.78]],
  [[0.12, 0.82], [0.1, 0.94], [0.11, 0.7], [0.09, 0.86], [0.13, 0.75], [0.1, 0.9]],
  [[0.1, 0.78], [0.12, 0.9], [0.11, 0.72]],
]

/**
 * Bookcase: carcass, recessed back, boards with books of varying heights, and
 * a toe-kick plinth. `variant` picks a real drawn difference, not a resize:
 * `'four-shelf'` (default, tall) draws all four boards; `'two-shelf'`
 * (squat, matching that variant's own shorter catalog height) draws only two
 * — the same "catalog data alone changes what's actually drawn" pattern
 * `dresser`'s 2단/3단 variant already established. Safe here for the same
 * reason it's safe there: bookshelf has zero interactionSlots.
 */
export function BookshelfIllustration({ width: w, height: h, colorway, variant, style }: Props) {
  const { body } = resolvePartTones('bookshelf', colorway, style)
  const groundY = h * 0.97
  const isCompact = variant === 'two-shelf'
  const boards = isCompact ? [0.35, 0.7] : [0.25, 0.45, 0.65, 0.85]
  const tops = isCompact ? [0.05, 0.42] : [0.05, 0.27, 0.47, 0.67]
  const bookRows = isCompact ? SHELF_BOOKS.slice(0, 2) : SHELF_BOOKS
  return (
    <Svg width={w} height={h} label="책장">
      <GroundShadow cx={w / 2} y={groundY + h * 0.005} ambientRx={w * 0.47} contactRx={w * 0.42} unit={h} />
      <Block x={w * 0.05} y={h * 0.92} w={w * 0.9} h={groundY - h * 0.92} tone={P.taupe} sw={1} />
      <Block x={0} y={h * 0.01} w={w} h={h * 0.92} r={6} tone={body} />
      <SurfaceSheen cx={w * 0.15} cy={h * 0.06} rx={w * 0.08} ry={h * 0.03} opacity={0.24} />
      <Block x={w * 0.07} y={h * 0.04} w={w * 0.86} h={h * 0.85} r={3} tone={body} fill={body.stroke} stroke="none" opacity={0.3} />
      {bookRows.map((row, rowIndex) => {
        const bottom = boards[rowIndex] * h
        const room = (boards[rowIndex] - tops[rowIndex]) * h
        let x = w * 0.09
        return row.map(([bw, bh], i) => {
          const book = <Book key={`${rowIndex}-${i}`} x={x} y={bottom - room * bh} w={w * bw} h={room * bh} tone={BOOK_TONES[(rowIndex * 2 + i) % BOOK_TONES.length]} />
          x += w * bw + w * 0.012
          return book
        })
      })}
      {boards.map((b) => (
        <Block key={b} x={w * 0.05} y={b * h} w={w * 0.9} h={h * 0.022} r={2} tone={body} />
      ))}
    </Svg>
  )
}
