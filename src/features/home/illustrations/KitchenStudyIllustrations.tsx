import { resolvePartTones } from '../furnitureStyling'
import { BOOK_TONES, FURNITURE_PALETTE as P } from '../palette'
import { Block, Book, GroundShadow, Knob, Leg, SurfaceSheen, SW, Svg, Tabletop, VolumeShade } from './parts'
import { patternFill, surfacePattern } from './surface'
import type { FurnitureIllustrationProps as Props } from './types'

/**
 * Shared dining-table body: top slab with depth, an apron under it, and
 * four legs (the back pair higher and fainter for perspective) — reused by
 * both `dining-table` and the larger `dining-table-large` (6인용), same
 * `id`/`label` parametrization pattern `SofaBody`/`BedBody` already
 * established for their own size-variant families. A wide table gets a
 * center support leg pair too, so a 6인용-sized top never reads as
 * under-supported.
 */
function DiningTableBody({ width: w, height: h, colorway, style, id, label, wide }: Props & { id: string; label: string; wide: boolean }) {
  const { top, legs } = resolvePartTones(id, colorway, style)
  const groundY = h * 0.95
  const topY = h * 0.06
  const depth = h * 0.2
  const thick = h * 0.07
  const legTop = topY + depth + thick * 0.5
  const legW = w * 0.035
  return (
    <Svg width={w} height={h} label={label}>
      <GroundShadow cx={w / 2} y={groundY + h * 0.008} ambientRx={w * 0.46} contactRx={w * 0.42} unit={h} />
      <Leg x={w * 0.17} y={legTop} w={legW} h={groundY - legTop - h * 0.07} tone={legs} opacity={0.7} />
      <Leg x={w * 0.83 - legW} y={legTop} w={legW} h={groundY - legTop - h * 0.07} tone={legs} opacity={0.7} />
      {wide && <Leg x={w / 2 - legW / 2} y={legTop} w={legW} h={groundY - legTop - h * 0.07} tone={legs} opacity={0.7} />}
      <Block x={w * 0.05} y={topY + depth + thick} w={w * 0.9} h={h * 0.06} r={2} tone={legs} sw={1} />
      <Leg x={w * 0.04} y={legTop} w={legW} h={groundY - legTop} tone={legs} />
      <Leg x={w * 0.96 - legW} y={legTop} w={legW} h={groundY - legTop} tone={legs} />
      <Tabletop x={0} y={topY} w={w} depth={depth} thick={thick} inset={w * 0.05} tone={top} />
    </Svg>
  )
}

export function DiningTableIllustration(props: Props) {
  return <DiningTableBody {...props} id="dining-table" label="식탁" wide={false} />
}

export function DiningTableLargeIllustration(props: Props) {
  return <DiningTableBody {...props} id="dining-table-large" label="6인용 식탁" wide />
}

/** Dining chair: back posts that run down into the back legs, a slatted backrest, a cushioned seat on a seat frame, and front legs. The seat cushion is the patternable surface. */
export function DiningChairIllustration({ width: w, height: h, colorway, style }: Props) {
  const { seat, back, frame } = resolvePartTones('dining-chair', colorway, style)
  const seatPattern = surfacePattern('seat', style)
  const groundY = h * 0.96
  const postW = w * 0.09
  const seatFrameY = h * 0.54
  return (
    <Svg width={w} height={h} label="식탁 의자" patterns={[seatPattern]}>
      <GroundShadow cx={w / 2} y={groundY + h * 0.005} ambientRx={w * 0.46} contactRx={w * 0.38} unit={h} />
      <Leg x={w * 0.1} y={h * 0.03} w={postW} h={groundY - h * 0.03 - h * 0.03} tone={frame} />
      <Leg x={w * 0.9 - postW} y={h * 0.03} w={postW} h={groundY - h * 0.03 - h * 0.03} tone={frame} />
      <Block x={w * 0.12} y={h * 0.06} w={w * 0.76} h={h * 0.3} r={h * 0.05} tone={back} />
      <SurfaceSheen cx={w / 2} cy={h * 0.14} rx={w * 0.26} ry={h * 0.06} opacity={0.28} />
      {[0.34, 0.5, 0.66].map((fx) => (
        <line key={fx} x1={w * fx} y1={h * 0.09} x2={w * fx} y2={h * 0.33} stroke={back.stroke} strokeWidth={1} opacity={0.7} />
      ))}
      <Block x={w * 0.06} y={seatFrameY} w={w * 0.88} h={h * 0.05} r={2} tone={frame} sw={1} />
      <Block x={w * 0.03} y={h * 0.42} w={w * 0.94} h={h * 0.13} r={h * 0.05} tone={seat} fill={patternFill(seatPattern)} />
      <SurfaceSheen cx={w * 0.36} cy={h * 0.46} rx={w * 0.24} ry={h * 0.03} opacity={0.26} />
      <Leg x={w * 0.07} y={seatFrameY} w={postW} h={groundY - seatFrameY} tone={frame} />
      <Leg x={w * 0.93 - postW} y={seatFrameY} w={postW} h={groundY - seatFrameY} tone={frame} />
    </Svg>
  )
}

/** Long backless bench for a dining table: a padded seat on a simple frame with two independent seat zones (left/right — same idea `sofa-left`/`sofa-right` already established for a shared piece of furniture), no backrest. */
export function DiningBenchIllustration({ width: w, height: h, colorway, style }: Props) {
  const { seat, frame } = resolvePartTones('dining-bench', colorway, style)
  const seatPattern = surfacePattern('seat', style)
  const groundY = h * 0.95
  const legW = w * 0.045
  const seatY = h * 0.2
  const seatH = h * 0.42
  return (
    <Svg width={w} height={h} label="벤치형 식탁 의자" patterns={[seatPattern]}>
      <GroundShadow cx={w / 2} y={groundY} ambientRx={w * 0.47} contactRx={w * 0.42} unit={h} />
      <Leg x={w * 0.06} y={seatY + seatH - h * 0.015} w={legW} h={groundY - (seatY + seatH - h * 0.015)} tone={frame} />
      <Leg x={w * 0.94 - legW} y={seatY + seatH - h * 0.015} w={legW} h={groundY - (seatY + seatH - h * 0.015)} tone={frame} />
      <Leg x={w * 0.3} y={seatY + seatH - h * 0.015} w={legW} h={groundY - (seatY + seatH - h * 0.015)} tone={frame} opacity={0.75} />
      <Leg x={w * 0.7 - legW} y={seatY + seatH - h * 0.015} w={legW} h={groundY - (seatY + seatH - h * 0.015)} tone={frame} opacity={0.75} />
      <Block x={w * 0.03} y={seatY} w={w * 0.94} h={seatH} r={seatH * 0.28} tone={seat} fill={patternFill(seatPattern)} sw={1.2} />
      <SurfaceSheen cx={w * 0.28} cy={seatY + seatH * 0.28} rx={w * 0.16} ry={seatH * 0.14} opacity={0.24} />
      <SurfaceSheen cx={w * 0.72} cy={seatY + seatH * 0.28} rx={w * 0.16} ry={seatH * 0.14} opacity={0.24} />
    </Svg>
  )
}

/** Computer desk: the same tabletop-with-depth construction `DeskIllustration` uses (see below), with a slim monitor-and-stand on top for a clearly distinguishable silhouette. No interaction slot of its own — a character uses a separate office-chair nearby, exactly like the original `desk`. */
export function ComputerDeskIllustration({ width: w, height: h, colorway, style }: Props) {
  const { top, body, door, handle } = resolvePartTones('computer-desk', colorway, style)
  const groundY = h * 0.95
  const topY = h * 0.32
  const depth = h * 0.14
  const thick = h * 0.06
  const bodyY = topY + depth + thick
  const unitW = w * 0.26
  return (
    <Svg width={w} height={h} label="컴퓨터 책상">
      <GroundShadow cx={w / 2} y={groundY + h * 0.006} ambientRx={w * 0.46} contactRx={w * 0.42} unit={h} />
      <Block x={w * 0.32} y={bodyY} w={w * 0.6} h={h * 0.44} tone={body} fill={body.stroke} stroke="none" opacity={0.18} />
      <Leg x={w * 0.9} y={bodyY - 2} w={w * 0.04} h={groundY - bodyY + 2} />
      <Block x={w * 0.06} y={bodyY} w={unitW} h={groundY - bodyY} r={3} tone={body} />
      {[0, 1].map((row) => {
        const rowH = (groundY - bodyY - 8) / 2
        const rowY = bodyY + 3 + row * rowH
        return (
          <g key={row}>
            <Block x={w * 0.06 + 3} y={rowY} w={unitW - 6} h={rowH - 3} r={2} tone={door} sw={1} />
            <SurfaceSheen cx={w * 0.06 + unitW * 0.32} cy={rowY + (rowH - 3) * 0.32} rx={unitW * 0.16} ry={(rowH - 3) * 0.22} opacity={0.18} />
            <Knob cx={w * 0.06 + unitW / 2} cy={rowY + (rowH - 3) / 2} r={2} tone={handle} />
          </g>
        )
      })}
      <Tabletop x={0} y={topY} w={w} depth={depth} thick={thick} inset={w * 0.05} tone={top} />
      {/* monitor: stand + a dark glass screen with a small sheen */}
      <Block x={w * 0.46} y={topY - h * 0.02} w={w * 0.08} h={h * 0.04} r={1} tone={P.metal} sw={1} />
      <Block x={w * 0.3} y={topY - h * 0.24} w={w * 0.4} h={h * 0.22} r={3} tone={P.slate} />
      <Block x={w * 0.32} y={topY - h * 0.22} w={w * 0.36} h={h * 0.18} r={2} tone={P.slate} fill="#8A91A6" stroke="none" />
      <SurfaceSheen cx={w * 0.4} cy={topY - h * 0.16} rx={w * 0.08} ry={h * 0.05} opacity={0.22} />
    </Svg>
  )
}

/** Two-door refrigerator: a small freezer door over a large fridge door with vertical handles, and two feet. */
export function FridgeIllustration({ width: w, height: h, colorway, style }: Props) {
  const { body, handle } = resolvePartTones('fridge', colorway, style)
  const groundY = h * 0.97
  return (
    <Svg width={w} height={h} label="냉장고">
      <GroundShadow cx={w / 2} y={groundY + h * 0.004} ambientRx={w * 0.5} contactRx={w * 0.42} unit={h} />
      <Block x={w * 0.1} y={h * 0.93} w={w * 0.16} h={groundY - h * 0.93} r={2} tone={P.slate} sw={1} />
      <Block x={w * 0.74} y={h * 0.93} w={w * 0.16} h={groundY - h * 0.93} r={2} tone={P.slate} sw={1} />
      <Block x={w * 0.02} y={h * 0.01} w={w * 0.96} h={h * 0.93} r={8} tone={body} fill={body.stroke} opacity={0.4} />
      <Block x={w * 0.05} y={h * 0.03} w={w * 0.9} h={h * 0.29} r={6} tone={body} />
      <SurfaceSheen cx={w * 0.3} cy={h * 0.1} rx={w * 0.16} ry={h * 0.06} opacity={0.22} />
      <Block x={w * 0.05} y={h * 0.34} w={w * 0.9} h={h * 0.58} r={6} tone={body} />
      <SurfaceSheen cx={w * 0.3} cy={h * 0.42} rx={w * 0.16} ry={h * 0.1} opacity={0.18} />
      <Block x={w * 0.13} y={h * 0.13} w={w * 0.035} h={h * 0.1} r={2} tone={handle} sw={1} />
      <Block x={w * 0.13} y={h * 0.42} w={w * 0.035} h={h * 0.2} r={2} tone={handle} sw={1} />
    </Svg>
  )
}

/** Base cabinet: worktop slab, two doors with knobs, and a recessed toe-kick. */
export function KitchenCabinetIllustration({ width: w, height: h, colorway, style }: Props) {
  const { top, body, door, handle } = resolvePartTones('kitchen-cabinet', colorway, style)
  const groundY = h * 0.96
  return (
    <Svg width={w} height={h} label="주방 수납장">
      <GroundShadow cx={w / 2} y={groundY + h * 0.005} ambientRx={w * 0.47} contactRx={w * 0.43} unit={h} />
      <Block x={w * 0.05} y={h * 0.88} w={w * 0.9} h={groundY - h * 0.88} tone={P.taupe} sw={1} />
      <Block x={w * 0.03} y={h * 0.14} w={w * 0.94} h={h * 0.75} r={3} tone={body} />
      <Block x={w * 0.06} y={h * 0.2} w={w * 0.41} h={h * 0.62} r={3} tone={door} sw={1.2} />
      <SurfaceSheen cx={w * 0.16} cy={h * 0.32} rx={w * 0.1} ry={h * 0.16} opacity={0.16} />
      <Block x={w * 0.53} y={h * 0.2} w={w * 0.41} h={h * 0.62} r={3} tone={door} sw={1.2} />
      <VolumeShade cx={w * 0.86} cy={h * 0.5} rx={w * 0.08} ry={h * 0.24} color={door.stroke} opacity={0.1} />
      <Knob cx={w * 0.44} cy={h * 0.32} r={2.4} tone={handle} />
      <Knob cx={w * 0.56} cy={h * 0.32} r={2.4} tone={handle} />
      <Block x={0} y={h * 0.04} w={w} h={h * 0.11} r={4} tone={top} />
      <SurfaceSheen cx={w / 2} cy={h * 0.075} rx={w * 0.3} ry={h * 0.025} opacity={0.28} />
    </Svg>
  )
}

/** Sink unit: a worktop seen from above with a recessed basin and a faucet, over a two-door cabinet. */
export function SinkIllustration({ width: w, height: h, colorway, style }: Props) {
  const { top, body, door, handle } = resolvePartTones('sink', colorway, style)
  const groundY = h * 0.96
  const topY = h * 0.2
  const depth = h * 0.14
  const thick = h * 0.06
  const cabY = topY + depth + thick
  const faucetX = w * 0.42
  return (
    <Svg width={w} height={h} label="싱크대">
      <GroundShadow cx={w / 2} y={groundY + h * 0.005} ambientRx={w * 0.47} contactRx={w * 0.43} unit={h} />
      <Block x={w * 0.05} y={h * 0.9} w={w * 0.9} h={groundY - h * 0.9} tone={P.taupe} sw={1} />
      <Block x={w * 0.03} y={cabY} w={w * 0.94} h={h * 0.9 - cabY} r={3} tone={body} />
      <Block x={w * 0.06} y={cabY + h * 0.05} w={w * 0.41} h={h * 0.9 - cabY - h * 0.1} r={3} tone={door} sw={1.2} />
      <SurfaceSheen cx={w * 0.16} cy={cabY + h * 0.12} rx={w * 0.1} ry={h * 0.08} opacity={0.16} />
      <Block x={w * 0.53} y={cabY + h * 0.05} w={w * 0.41} h={h * 0.9 - cabY - h * 0.1} r={3} tone={door} sw={1.2} />
      <VolumeShade cx={w * 0.86} cy={cabY + h * 0.2} rx={w * 0.08} ry={h * 0.15} color={door.stroke} opacity={0.1} />
      <Knob cx={w * 0.44} cy={cabY + h * 0.14} r={2.4} tone={handle} />
      <Knob cx={w * 0.56} cy={cabY + h * 0.14} r={2.4} tone={handle} />
      <Tabletop x={0} y={topY} w={w} depth={depth} thick={thick} inset={w * 0.03} tone={top} />
      <ellipse cx={faucetX} cy={topY + depth * 0.55} rx={w * 0.2} ry={depth * 0.34} fill={P.glass.fill} stroke={P.glass.stroke} strokeWidth={SW} />
      <Block x={faucetX - w * 0.012} y={h * 0.06} w={w * 0.024} h={h * 0.16} r={2} tone={P.metal} sw={1} />
      <Block x={faucetX - w * 0.012} y={h * 0.05} w={w * 0.06} h={h * 0.03} r={2} tone={P.metal} sw={1} />
      <Knob cx={faucetX - w * 0.03} cy={h * 0.1} r={2.4} />
    </Svg>
  )
}

/** Countertop microwave: body, dark glass door with a sheen, a control panel with buttons and a dial, and two feet. */
export function MicrowaveIllustration({ width: w, height: h, colorway, style }: Props) {
  const { body, panel } = resolvePartTones('microwave', colorway, style)
  const groundY = h * 0.94
  return (
    <Svg width={w} height={h} label="전자레인지">
      <GroundShadow cx={w / 2} y={groundY} ambientRx={w * 0.47} contactRx={w * 0.4} unit={h} />
      <Block x={w * 0.1} y={h * 0.86} w={w * 0.1} h={groundY - h * 0.86} r={1.5} tone={P.slate} sw={1} />
      <Block x={w * 0.8} y={h * 0.86} w={w * 0.1} h={groundY - h * 0.86} r={1.5} tone={P.slate} sw={1} />
      <Block x={w * 0.02} y={h * 0.05} w={w * 0.96} h={h * 0.82} r={6} tone={body} />
      <SurfaceSheen cx={w * 0.14} cy={h * 0.11} rx={w * 0.09} ry={h * 0.04} opacity={0.24} />
      <Block x={w * 0.08} y={h * 0.16} w={w * 0.56} h={h * 0.58} r={4} tone={P.slate} />
      <polygon points={`${w * 0.12},${h * 0.2} ${w * 0.26},${h * 0.2} ${w * 0.16},${h * 0.7} ${w * 0.11},${h * 0.7}`} fill="#fff" opacity={0.16} />
      <Block x={w * 0.7} y={h * 0.16} w={w * 0.22} h={h * 0.58} r={3} tone={panel} sw={1} />
      <circle cx={w * 0.81} cy={h * 0.3} r={w * 0.055} fill={P.metal.fill} stroke={P.metal.stroke} strokeWidth={1} />
      {[0.48, 0.58, 0.68].map((fy) => (
        <circle key={fy} cx={w * 0.81} cy={h * fy} r={w * 0.025} fill={P.metal.stroke} />
      ))}
    </Svg>
  )
}

/**
 * Prep counter: a base cabinet (top slab, drawer band, two doors, toe-kick)
 * distinct from `kitchen-cabinet` (which stops at the closed cabinet) by
 * what's resting on top — a wooden cutting board with a couple of small
 * veggies, drawn flat on the worktop's own surface plane, the "생활감" this
 * batch specifically asked for over a plain countertop.
 */
export function KitchenCounterIllustration({ width: w, height: h, colorway, style }: Props) {
  const { top, body, door, handle } = resolvePartTones('kitchen-counter', colorway, style)
  const groundY = h * 0.96
  return (
    <Svg width={w} height={h} label="조리대">
      <GroundShadow cx={w / 2} y={groundY + h * 0.005} ambientRx={w * 0.47} contactRx={w * 0.43} unit={h} />
      <Block x={w * 0.05} y={h * 0.88} w={w * 0.9} h={groundY - h * 0.88} tone={P.taupe} sw={1} />
      <Block x={w * 0.03} y={h * 0.14} w={w * 0.94} h={h * 0.75} r={3} tone={body} />
      <Block x={w * 0.06} y={h * 0.19} w={w * 0.88} h={h * 0.14} r={2} tone={door} sw={1} />
      <SurfaceSheen cx={w * 0.2} cy={h * 0.24} rx={w * 0.12} ry={h * 0.04} opacity={0.18} />
      <Block x={w * 0.06} y={h * 0.36} w={w * 0.41} h={h * 0.5} r={3} tone={door} sw={1.2} />
      <Block x={w * 0.53} y={h * 0.36} w={w * 0.41} h={h * 0.5} r={3} tone={door} sw={1.2} />
      <Knob cx={w * 0.44} cy={h * 0.6} r={2.2} tone={handle} />
      <Knob cx={w * 0.56} cy={h * 0.6} r={2.2} tone={handle} />
      <Block x={0} y={h * 0.04} w={w} h={h * 0.11} r={4} tone={top} />
      <SurfaceSheen cx={w / 2} cy={h * 0.075} rx={w * 0.3} ry={h * 0.025} opacity={0.3} />
      {/* cutting board + veggies resting on the worktop */}
      <Block x={w * 0.58} y={h * 0.05} w={w * 0.3} h={h * 0.08} r={h * 0.015} tone={P.taupe} sw={1} />
      <circle cx={w * 0.66} cy={h * 0.09} r={w * 0.028} fill={P.pinkDeep.fill} stroke={P.pinkDeep.stroke} strokeWidth={1} />
      <circle cx={w * 0.76} cy={h * 0.09} r={w * 0.024} fill={P.leaf.fill} stroke={P.leaf.stroke} strokeWidth={1} />
    </Svg>
  )
}

/** Small countertop toaster: rounded body, two bread slots, a peek of golden toast, and a side lever. */
export function ToasterIllustration({ width: w, height: h, colorway, style }: Props) {
  const { body } = resolvePartTones('toaster', colorway, style)
  const groundY = h * 0.94
  return (
    <Svg width={w} height={h} label="토스터">
      <GroundShadow cx={w / 2} y={groundY} ambientRx={w * 0.42} contactRx={w * 0.34} unit={h} />
      <Block x={w * 0.06} y={h * 0.28} w={w * 0.88} h={h * 0.62} r={h * 0.1} tone={body} sw={1.4} />
      <SurfaceSheen cx={w * 0.32} cy={h * 0.42} rx={w * 0.14} ry={h * 0.12} opacity={0.24} />
      {[0.34, 0.5, 0.66].map((fx) => (
        <rect key={fx} x={w * fx - w * 0.03} y={h * 0.16} width={w * 0.06} height={h * 0.16} rx={2} fill={P.slate.fill} opacity={0.85} />
      ))}
      {/* toast peeking out of the middle slot */}
      <rect x={w * 0.44} y={h * 0.06} width={w * 0.12} height={h * 0.14} rx={2} fill={P.butter.fill} stroke={P.butter.stroke} strokeWidth={1} />
      <Block x={w * 0.86} y={h * 0.5} w={w * 0.08} h={h * 0.1} r={2} tone={P.metal} sw={1} />
    </Svg>
  )
}

/** Small kettle: a rounded body, a curved spout and handle, and a lid with a knob. */
export function KettleIllustration({ width: w, height: h, colorway, style }: Props) {
  const { body } = resolvePartTones('kettle', colorway, style)
  const groundY = h * 0.95
  return (
    <Svg width={w} height={h} label="주전자">
      <GroundShadow cx={w / 2} y={groundY} ambientRx={w * 0.4} contactRx={w * 0.3} unit={h} />
      <path d={`M ${w * 0.84} ${h * 0.52} Q ${w * 0.98} ${h * 0.42} ${w * 0.92} ${h * 0.24}`} fill="none" stroke={body.stroke} strokeWidth={w * 0.07} strokeLinecap="round" />
      <path d={`M ${w * 0.16} ${h * 0.5} Q ${w * 0.02} ${h * 0.6} ${w * 0.14} ${h * 0.76}`} fill="none" stroke={body.stroke} strokeWidth={w * 0.06} strokeLinecap="round" />
      <ellipse cx={w / 2} cy={h * 0.68} rx={w * 0.42} ry={h * 0.26} fill={body.fill} stroke={body.stroke} strokeWidth={SW} />
      <SurfaceSheen cx={w * 0.36} cy={h * 0.56} rx={w * 0.12} ry={h * 0.14} opacity={0.28} />
      <ellipse cx={w / 2} cy={h * 0.42} rx={w * 0.22} ry={h * 0.06} fill={body.fill} stroke={body.stroke} strokeWidth={1.2} />
      <circle cx={w / 2} cy={h * 0.36} r={w * 0.05} fill={P.metal.fill} stroke={P.metal.stroke} strokeWidth={1} />
    </Svg>
  )
}

/** Small drip coffee machine: a boxy head with a control panel, and a glass cup catching the drip below. */
export function CoffeeMachineIllustration({ width: w, height: h, colorway, style }: Props) {
  const { body, panel } = resolvePartTones('coffee-machine', colorway, style)
  const groundY = h * 0.95
  return (
    <Svg width={w} height={h} label="커피머신">
      <GroundShadow cx={w / 2} y={groundY} ambientRx={w * 0.42} contactRx={w * 0.32} unit={h} />
      <Block x={w * 0.14} y={h * 0.1} w={w * 0.72} h={h * 0.6} r={h * 0.06} tone={body} sw={1.4} />
      <SurfaceSheen cx={w * 0.34} cy={h * 0.24} rx={w * 0.12} ry={h * 0.1} opacity={0.24} />
      <Block x={w * 0.4} y={h * 0.2} w={w * 0.2} h={h * 0.08} r={2} tone={panel} sw={1} />
      <circle cx={w * 0.5} cy={h * 0.36} r={w * 0.04} fill={P.metal.fill} stroke={P.metal.stroke} strokeWidth={1} />
      <Block x={w * 0.22} y={h * 0.66} w={w * 0.56} h={h * 0.1} r={2} tone={panel} sw={1} />
      <Block x={w * 0.34} y={h * 0.76} w={w * 0.32} h={h * 0.18} r={2} tone={P.glass} sw={1} />
    </Svg>
  )
}

/** Desk: top slab with depth, a three-drawer unit on the left, a slim leg on the right and a modesty panel between. */
export function DeskIllustration({ width: w, height: h, colorway, style }: Props) {
  const { top, body, door, handle } = resolvePartTones('desk', colorway, style)
  const groundY = h * 0.95
  const topY = h * 0.06
  const depth = h * 0.16
  const thick = h * 0.07
  const bodyY = topY + depth + thick
  const unitW = w * 0.28
  return (
    <Svg width={w} height={h} label="책상">
      <GroundShadow cx={w / 2} y={groundY + h * 0.006} ambientRx={w * 0.46} contactRx={w * 0.42} unit={h} />
      <Block x={w * 0.32} y={bodyY} w={w * 0.58} h={h * 0.5} tone={body} fill={body.stroke} stroke="none" opacity={0.18} />
      <Leg x={w * 0.9} y={bodyY - 2} w={w * 0.04} h={groundY - bodyY + 2} />
      <Block x={w * 0.06} y={bodyY} w={unitW} h={groundY - bodyY} r={3} tone={body} />
      {[0, 1, 2].map((row) => {
        const rowH = (groundY - bodyY - 8) / 3
        const rowY = bodyY + 3 + row * rowH
        return (
          <g key={row}>
            <Block x={w * 0.06 + 3} y={rowY} w={unitW - 6} h={rowH - 3} r={2} tone={door} sw={1} />
            <SurfaceSheen cx={w * 0.06 + unitW * 0.32} cy={rowY + (rowH - 3) * 0.32} rx={unitW * 0.16} ry={(rowH - 3) * 0.22} opacity={0.18} />
            <Knob cx={w * 0.06 + unitW / 2} cy={rowY + (rowH - 3) / 2} r={2} tone={handle} />
          </g>
        )
      })}
      <Tabletop x={0} y={topY} w={w} depth={depth} thick={thick} inset={w * 0.05} tone={top} />
    </Svg>
  )
}

/** Swivel office chair: backrest, seat, armrests, a gas-lift column and a five-caster star base. The seat is the patternable surface. */
export function OfficeChairIllustration({ width: w, height: h, colorway, style }: Props) {
  const { seat, back, frame } = resolvePartTones('office-chair', colorway, style)
  const seatPattern = surfacePattern('seat', style)
  const groundY = h * 0.97
  const hubY = h * 0.85
  const casterXs = [0.1, 0.3, 0.5, 0.7, 0.9]
  const casterR = w * 0.04
  const casterY = groundY - casterR
  return (
    <Svg width={w} height={h} label="사무용 의자" patterns={[seatPattern]}>
      <GroundShadow cx={w / 2} y={groundY} ambientRx={w * 0.45} contactRx={w * 0.4} unit={h} />
      {casterXs.map((fx) => (
        <g key={fx}>
          <line x1={w / 2} y1={hubY} x2={w * fx} y2={casterY - casterR * 0.4} stroke={frame.fill} strokeWidth={4} strokeLinecap="round" />
          <circle cx={w * fx} cy={casterY} r={casterR} fill={frame.stroke} />
        </g>
      ))}
      <Block x={w / 2 - w * 0.035} y={h * 0.6} w={w * 0.07} h={hubY - h * 0.6} r={2} tone={P.metal} sw={1} />
      <Block x={w * 0.18} y={h * 0.04} w={w * 0.64} h={h * 0.42} r={h * 0.12} tone={back} />
      <SurfaceSheen cx={w / 2} cy={h * 0.13} rx={w * 0.22} ry={h * 0.07} opacity={0.28} />
      <Block x={w / 2 - w * 0.03} y={h * 0.44} w={w * 0.06} h={h * 0.1} tone={P.metal} sw={1} />
      <Block x={w * 0.06} y={h * 0.36} w={w * 0.05} h={h * 0.14} r={2} tone={frame} sw={1} />
      <Block x={w * 0.89} y={h * 0.36} w={w * 0.05} h={h * 0.14} r={2} tone={frame} sw={1} />
      <Block x={w * 0.1} y={h * 0.5} w={w * 0.8} h={h * 0.12} r={h * 0.05} tone={seat} fill={patternFill(seatPattern)} />
      <SurfaceSheen cx={w * 0.36} cy={h * 0.54} rx={w * 0.26} ry={h * 0.03} opacity={0.24} />
    </Svg>
  )
}

/**
 * Simple counter/bar stool: a flat seat on four straight legs joined by a
 * thin footrest ring — deliberately unpadded and geometric, distinct from
 * the domed, upholstered `ottoman` this catalog already has. Both variants
 * share the exact same width/height on purpose (only the seat's own
 * silhouette differs — round vs. square), so the single real `'sit'` slot
 * (baked in from this definition's own base size, like every other slot in
 * this catalog) stays correct regardless of which shape is drawn.
 */
export function StoolIllustration({ width: w, height: h, colorway, variant, style }: Props) {
  const { seat, frame } = resolvePartTones('stool', colorway, style)
  const seatPattern = surfacePattern('seat', style)
  const seatFill = patternFill(seatPattern)
  const groundY = h * 0.97
  const seatTopY = h * 0.1
  const seatBottomY = h * 0.22
  const ringY = h * 0.58
  const legInset = w * 0.14
  const legW = w * 0.07
  const legTop = seatBottomY - h * 0.01
  const isSquare = variant === 'square'
  return (
    <Svg width={w} height={h} label="스툴" patterns={[seatPattern]}>
      <GroundShadow cx={w / 2} y={groundY} ambientRx={w * 0.48} contactRx={w * 0.38} unit={h} />
      <Leg x={legInset} y={legTop} w={legW} h={groundY - legTop} tone={frame} />
      <Leg x={w - legInset - legW} y={legTop} w={legW} h={groundY - legTop} tone={frame} />
      {/* footrest ring — the stool's own distinguishing detail versus the ottoman/chairs */}
      <ellipse cx={w / 2} cy={ringY} rx={w / 2 - legInset - legW / 2} ry={h * 0.02} fill="none" stroke={frame.stroke} strokeWidth={2} opacity={0.8} />
      {isSquare ? (
        <>
          <Block x={w * 0.1} y={seatTopY} w={w * 0.8} h={seatBottomY - seatTopY} r={h * 0.03} tone={seat} fill={seatFill} sw={1.2} />
          <SurfaceSheen cx={w * 0.38} cy={seatTopY + (seatBottomY - seatTopY) * 0.32} rx={w * 0.24} ry={(seatBottomY - seatTopY) * 0.24} opacity={0.26} />
        </>
      ) : (
        <>
          <ellipse cx={w / 2} cy={(seatTopY + seatBottomY) / 2} rx={w * 0.46} ry={(seatBottomY - seatTopY) / 2} fill={seat.fill} stroke={seat.stroke} strokeWidth={1.2} />
          {seatFill && <ellipse cx={w / 2} cy={(seatTopY + seatBottomY) / 2} rx={w * 0.46} ry={(seatBottomY - seatTopY) / 2} fill={seatFill} stroke="none" />}
          <SurfaceSheen cx={w * 0.4} cy={seatTopY + (seatBottomY - seatTopY) * 0.3} rx={w * 0.22} ry={(seatBottomY - seatTopY) * 0.22} opacity={0.28} />
        </>
      )}
    </Svg>
  )
}

const RACK_BOOKS: Array<Array<[number, number]>> = [
  [[0.1, 0.85], [0.08, 0.95], [0.11, 0.75], [0.09, 0.9], [0.1, 0.8], [0.08, 0.92], [0.1, 0.7]],
  [[0.09, 0.9], [0.11, 0.78], [0.1, 0.95], [0.09, 0.82], [0.1, 0.88]],
]

/** Small tabletop book rack: two tiers of upright books between side panels, on a base tray. */
export function BookrackIllustration({ width: w, height: h, colorway, style }: Props) {
  const { body } = resolvePartTones('bookrack', colorway, style)
  const groundY = h * 0.96
  const tiers = [{ top: 0.06, bottom: 0.47 }, { top: 0.53, bottom: 0.86 }]
  return (
    <Svg width={w} height={h} label="책꽂이">
      <GroundShadow cx={w / 2} y={groundY} ambientRx={w * 0.47} contactRx={w * 0.44} unit={h} />
      <Block x={w * 0.02} y={h * 0.06} w={w * 0.96} h={h * 0.8} tone={body} fill={body.stroke} stroke="none" opacity={0.2} />
      {RACK_BOOKS.map((row, tier) => {
        const bottom = tiers[tier].bottom * h
        const room = (tiers[tier].bottom - tiers[tier].top) * h
        let x = w * 0.08
        return row.map(([bw, bh], i) => {
          const book = <Book key={`${tier}-${i}`} x={x} y={bottom - room * bh} w={w * bw} h={room * bh} tone={BOOK_TONES[(tier * 3 + i) % BOOK_TONES.length]} />
          x += w * bw + w * 0.012
          return book
        })
      })}
      <Block x={w * 0.02} y={h * 0.47} w={w * 0.96} h={h * 0.05} r={2} tone={body} />
      <SurfaceSheen cx={w / 2} cy={h * 0.49} rx={w * 0.3} ry={h * 0.014} opacity={0.24} />
      <Block x={w * 0.02} y={h * 0.06} w={w * 0.05} h={h * 0.82} r={2} tone={body} />
      <Block x={w * 0.93} y={h * 0.06} w={w * 0.05} h={h * 0.82} r={2} tone={body} />
      <Block x={0} y={h * 0.86} w={w} h={groundY - h * 0.86} r={3} tone={P.taupe} />
    </Svg>
  )
}

/** Floor lamp: weighted round base, a slim pole, and a tapered shade with a warm glow under it. */
export function FloorLampIllustration({ width: w, height: h, colorway, style }: Props) {
  const { shade } = resolvePartTones('floor-lamp', colorway, style)
  const groundY = h * 0.97
  return (
    <Svg width={w} height={h} label="스탠드 조명">
      <GroundShadow cx={w / 2} y={groundY} ambientRx={w * 0.38} contactRx={w * 0.3} unit={h} />
      <ellipse cx={w / 2} cy={groundY - h * 0.012} rx={w * 0.3} ry={h * 0.014} fill={P.metal.fill} stroke={P.metal.stroke} strokeWidth={SW} />
      <Block x={w / 2 - w * 0.02} y={h * 0.3} w={w * 0.04} h={groundY - h * 0.3 - h * 0.012} r={2} tone={P.taupe} sw={1} />
      <ellipse cx={w / 2} cy={h * 0.35} rx={w * 0.4} ry={h * 0.04} fill={P.butter.fill} opacity={0.55} />
      <polygon points={`${w * 0.28},${h * 0.03} ${w * 0.72},${h * 0.03} ${w * 0.92},${h * 0.32} ${w * 0.08},${h * 0.32}`} fill={shade.fill} stroke={shade.stroke} strokeWidth={SW} strokeLinejoin="round" />
      <SurfaceSheen cx={w * 0.4} cy={h * 0.14} rx={w * 0.12} ry={h * 0.09} opacity={0.3} />
      <ellipse cx={w / 2} cy={h * 0.32} rx={w * 0.42} ry={h * 0.015} fill={shade.stroke} opacity={0.4} />
      {/* the bulb, peeking below the shade's open rim — same treatment as the table lamp, its own shape distinct from the pole/base/shade */}
      <Block x={w / 2 - w * 0.022} y={h * 0.3} w={w * 0.044} h={h * 0.03} tone={P.metal} sw={1} />
      <ellipse cx={w / 2} cy={h * 0.35} rx={w * 0.05} ry={h * 0.03} fill={P.butter.fill} stroke={P.butter.stroke} strokeWidth={1} />
      <ellipse cx={w * 0.48} cy={h * 0.34} rx={w * 0.016} ry={h * 0.011} fill="#ffffff" opacity={0.6} />
    </Svg>
  )
}
