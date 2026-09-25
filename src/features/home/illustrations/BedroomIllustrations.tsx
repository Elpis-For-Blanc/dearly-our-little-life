import { resolvePartTones } from '../furnitureStyling'
import { FURNITURE_PALETTE as P } from '../palette'
import { Block, GroundShadow, Knob, Leg, SurfaceSheen, SW, Svg, VolumeShade } from './parts'
import { patternFill, surfacePattern } from './surface'
import type { FurnitureIllustrationProps as Props } from './types'

/**
 * Shared bed construction for the single and double beds: tall headboard behind,
 * a wooden side frame whose bottom edge is where the legs start (`frameBottom`),
 * mattress, folded blanket, and `pillows` pillows. The legs run from the
 * frame's underside down to `groundY`, and the shadow sits at `groundY`, so
 * frame, legs and shadow are one connected structure. Patterns apply only to
 * the blanket and the pillows.
 */
function BedBody({ width: w, height: h, colorway, style, pillows, id, label }: Props & { pillows: number; id: string; label: string }) {
  const { headboard, frame, blanket, pillow } = resolvePartTones(id, colorway, style)
  const blanketPattern = surfacePattern('blanket', style)
  const pillowPattern = surfacePattern('pillow', style)
  const groundY = h * 0.94
  const legH = h * 0.07
  const frameTop = h * 0.5
  const frameBottom = groundY - legH + h * 0.015
  const legW = w * 0.045
  const pillowGap = w * 0.03
  const pillowsW = w * 0.8
  const pillowW = (pillowsW - pillowGap * (pillows - 1)) / pillows

  return (
    <Svg width={w} height={h} label={label} patterns={[blanketPattern, pillowPattern]}>
      <GroundShadow cx={w / 2} y={groundY + h * 0.008} ambientRx={w * 0.47} contactRx={w * 0.44} unit={h} />
      <Block x={w * 0.02} y={h * 0.02} w={w * 0.96} h={h * 0.5} r={h * 0.12} tone={headboard} />
      <Block x={w * 0.07} y={h * 0.08} w={w * 0.86} h={h * 0.34} r={h * 0.08} tone={headboard} fill={headboard.stroke} stroke="none" opacity={0.18} />
      <SurfaceSheen cx={w / 2} cy={h * 0.12} rx={w * 0.3} ry={h * 0.05} opacity={0.22} />
      <Leg x={w * 0.04} y={frameBottom - h * 0.01} w={legW} h={groundY - frameBottom + h * 0.01} tone={frame} />
      <Leg x={w * 0.96 - legW} y={frameBottom - h * 0.01} w={legW} h={groundY - frameBottom + h * 0.01} tone={frame} />
      <Block x={0} y={frameTop} w={w} h={frameBottom - frameTop} r={h * 0.05} tone={frame} />
      {/* mattress — visually separated from the frame below it by a thin shaded seam */}
      <Block x={w * 0.04} y={h * 0.4} w={w * 0.92} h={h * 0.34} r={h * 0.08} tone={P.ivory} />
      <VolumeShade cx={w / 2} cy={h * 0.4 + h * 0.34 - h * 0.01} rx={w * 0.44} ry={h * 0.012} color={P.ivory.stroke} opacity={0.4} />
      {Array.from({ length: pillows }, (_, i) => (
        <g key={i}>
          <Block x={w * 0.1 + i * (pillowW + pillowGap)} y={h * 0.31} w={pillowW} h={h * 0.17} r={h * 0.07} tone={pillow} fill={patternFill(pillowPattern)} sw={1.2} />
          <SurfaceSheen cx={w * 0.1 + i * (pillowW + pillowGap) + pillowW / 2} cy={h * 0.31 + h * 0.17 * 0.3} rx={pillowW * 0.3} ry={h * 0.03} opacity={0.24} />
        </g>
      ))}
      <Block x={w * 0.04} y={frameTop} w={w * 0.92} h={h * 0.3} r={h * 0.06} tone={blanket} fill={patternFill(blanketPattern)} />
      <Block x={w * 0.04} y={frameTop} w={w * 0.92} h={h * 0.07} r={h * 0.03} tone={blanket} fill={blanket.stroke} stroke="none" opacity={0.3} />
      <SurfaceSheen cx={w * 0.3} cy={frameTop + h * 0.16} rx={w * 0.16} ry={h * 0.06} opacity={0.16} />
    </Svg>
  )
}

export function BedSingleIllustration(props: Props) {
  return <BedBody {...props} id="bed-single" pillows={1} label="싱글 침대" />
}

export function BedDoubleIllustration(props: Props) {
  return <BedBody {...props} id="bed-double" pillows={2} label="더블 침대" />
}

/** Low backless bench: a padded seat cushion on four slim legs — no backrest, unlike a chair. The cushion top is the one patternable surface. */
export function BedroomBenchIllustration({ width: w, height: h, colorway, style }: Props) {
  const { seat, frame } = resolvePartTones('bedroom-bench', colorway, style)
  const seatPattern = surfacePattern('seat', style)
  const groundY = h * 0.94
  const legW = w * 0.05
  const seatY = h * 0.18
  const seatH = h * 0.5
  return (
    <Svg width={w} height={h} label="벤치" patterns={[seatPattern]}>
      <GroundShadow cx={w / 2} y={groundY} ambientRx={w * 0.46} contactRx={w * 0.4} unit={h} />
      <Leg x={w * 0.08} y={seatY + seatH - h * 0.02} w={legW} h={groundY - (seatY + seatH - h * 0.02)} tone={frame} />
      <Leg x={w * 0.92 - legW} y={seatY + seatH - h * 0.02} w={legW} h={groundY - (seatY + seatH - h * 0.02)} tone={frame} />
      <Leg x={w * 0.28} y={seatY + seatH - h * 0.02} w={legW} h={groundY - (seatY + seatH - h * 0.02)} tone={frame} opacity={0.75} />
      <Leg x={w * 0.72 - legW} y={seatY + seatH - h * 0.02} w={legW} h={groundY - (seatY + seatH - h * 0.02)} tone={frame} opacity={0.75} />
      <Block x={w * 0.04} y={seatY} w={w * 0.92} h={seatH} r={seatH * 0.32} tone={seat} fill={patternFill(seatPattern)} sw={1.2} />
      <SurfaceSheen cx={w / 2} cy={seatY + seatH * 0.28} rx={w * 0.3} ry={seatH * 0.15} opacity={0.24} />
    </Svg>
  )
}

/** Bedside table: top slab, drawer with knob, open lower shelf, four short legs. */
export function NightstandIllustration({ width: w, height: h, colorway, style }: Props) {
  const { body, door, handle } = resolvePartTones('nightstand', colorway, style)
  const groundY = h * 0.93
  const legW = w * 0.08
  return (
    <Svg width={w} height={h} label="협탁">
      <GroundShadow cx={w / 2} y={groundY + h * 0.005} ambientRx={w * 0.45} contactRx={w * 0.38} unit={h} />
      <Leg x={w * 0.1} y={h * 0.78} w={legW} h={groundY - h * 0.78} />
      <Leg x={w * 0.9 - legW} y={h * 0.78} w={legW} h={groundY - h * 0.78} />
      <Block x={w * 0.08} y={h * 0.15} w={w * 0.84} h={h * 0.65} r={3} tone={body} />
      <Block x={w * 0.14} y={h * 0.53} w={w * 0.72} h={h * 0.22} r={2} tone={body} fill={body.stroke} stroke="none" opacity={0.25} />
      <Block x={w * 0.14} y={h * 0.22} w={w * 0.72} h={h * 0.26} r={3} tone={door} sw={1.2} />
      <SurfaceSheen cx={w * 0.4} cy={h * 0.29} rx={w * 0.16} ry={h * 0.05} opacity={0.2} />
      <Knob cx={w / 2} cy={h * 0.35} r={2.4} tone={handle} />
      <Block x={w * 0.02} y={h * 0.05} w={w * 0.96} h={h * 0.11} r={4} tone={body} />
      <SurfaceSheen cx={w / 2} cy={h * 0.09} rx={w * 0.3} ry={h * 0.025} opacity={0.26} />
    </Svg>
  )
}

/**
 * Chest of drawers: a wide, low cabinet — distinct from the nightstand (one
 * drawer, narrow) and the wardrobe (hanging doors, tall). Decor-only, like
 * every other cabinet piece past the original six.
 *
 * Reads `variant` to draw either 3 drawer rows (`'three-drawer'`, the
 * default — matches `dresser`'s own base `width`/`height`) or 2 (taller
 * rows, `'two-drawer'`, the shorter of its two catalog `variants`) — a real
 * drawn difference driven entirely by catalog data, not just a resize, per
 * the spec's own "catalog 데이터만 추가해도 새로운 variant를 만들 수 있는
 * 구조" request. Safe to do here specifically because `dresser` has no
 * `interactionSlots` at all (see `furnitureCatalog.ts`'s own comment on
 * `dining-table-large` for the case where a size-changing variant is
 * *not* safe: a piece with real interaction slots baked to its base width).
 */
export function DresserIllustration({ width: w, height: h, colorway, style, variant }: Props) {
  const { body, door, handle } = resolvePartTones('dresser', colorway, style)
  const rows = variant === 'two-drawer' ? 2 : 3
  const groundY = h * 0.95
  const legW = w * 0.05
  const bodyY = h * 0.14
  const drawerAreaY = bodyY + h * 0.04
  const drawerAreaH = groundY - h * 0.03 - drawerAreaY
  const rowGap = h * 0.025
  const rowH = (drawerAreaH - rowGap * (rows - 1)) / rows
  return (
    <Svg width={w} height={h} label="서랍장">
      <GroundShadow cx={w / 2} y={groundY + h * 0.005} ambientRx={w * 0.48} contactRx={w * 0.43} unit={h} />
      <Leg x={w * 0.07} y={h * 0.88} w={legW} h={groundY - h * 0.88} />
      <Leg x={w * 0.93 - legW} y={h * 0.88} w={legW} h={groundY - h * 0.88} />
      <Block x={w * 0.03} y={bodyY} w={w * 0.94} h={groundY - h * 0.03 - bodyY} r={3} tone={body} />
      {Array.from({ length: rows }, (_, row) => {
        const y = drawerAreaY + row * (rowH + rowGap)
        return (
          <g key={row}>
            <Block x={w * 0.08} y={y} w={w * 0.84} h={rowH} r={2} tone={door} sw={1.2} />
            <SurfaceSheen cx={w * 0.3} cy={y + rowH * 0.28} rx={w * 0.14} ry={rowH * 0.22} opacity={0.18} />
            <Knob cx={w * 0.36} cy={y + rowH / 2} r={2.2} tone={handle} />
            <Knob cx={w * 0.64} cy={y + rowH / 2} r={2.2} tone={handle} />
          </g>
        )
      })}
      <Block x={0} y={h * 0.04} w={w} h={h * 0.1} r={4} tone={body} />
      <SurfaceSheen cx={w / 2} cy={h * 0.075} rx={w * 0.3} ry={h * 0.025} opacity={0.3} />
    </Svg>
  )
}

/** Vanity: round mirror on top, a tabletop with a couple of bottles, drawer stacks either side of an open knee space, and legs. */
export function VanityIllustration({ width: w, height: h, colorway, style }: Props) {
  const { body, door, handle } = resolvePartTones('vanity', colorway, style)
  const groundY = h * 0.97
  const tableY = h * 0.52
  const unitW = w * 0.28
  return (
    <Svg width={w} height={h} label="화장대">
      <GroundShadow cx={w / 2} y={groundY + h * 0.005} ambientRx={w * 0.46} contactRx={w * 0.42} unit={h} />
      <Block x={w * 0.32} y={tableY + h * 0.06} w={w * 0.36} h={h * 0.3} tone={body} fill={body.stroke} stroke="none" opacity={0.18} />
      <ellipse cx={w / 2} cy={h * 0.26} rx={w * 0.31} ry={h * 0.245} fill={body.fill} stroke={body.stroke} strokeWidth={SW} />
      <ellipse cx={w / 2} cy={h * 0.26} rx={w * 0.26} ry={h * 0.2} fill={P.glass.fill} stroke={P.glass.stroke} strokeWidth={1} />
      <polygon points={`${w * 0.4},${h * 0.1} ${w * 0.46},${h * 0.1} ${w * 0.4},${h * 0.32} ${w * 0.36},${h * 0.32}`} fill="#fff" opacity={0.4} />
      <Block x={w * 0.08} y={tableY - h * 0.08} w={w * 0.07} h={h * 0.08} r={2} tone={P.pinkDeep} sw={1} />
      <Block x={w * 0.17} y={tableY - h * 0.05} w={w * 0.05} h={h * 0.05} r={2} tone={P.lavender} sw={1} />
      <Block x={w * 0.84} y={tableY - h * 0.06} w={w * 0.06} h={h * 0.06} r={3} tone={P.butter} sw={1} />
      {[0.04, 0.68].map((fx) => (
        <g key={fx}>
          <Block x={w * fx} y={tableY + h * 0.06} w={unitW} h={h * 0.34} r={3} tone={body} />
          {[0, 1, 2].map((row) => (
            <g key={row}>
              <Block x={w * fx + 3} y={tableY + h * 0.08 + row * h * 0.105} w={unitW - 6} h={h * 0.09} r={2} tone={door} sw={1} />
              <Knob cx={w * fx + unitW / 2} cy={tableY + h * 0.125 + row * h * 0.105} r={2} tone={handle} />
            </g>
          ))}
        </g>
      ))}
      <Leg x={w * 0.06} y={tableY + h * 0.4 - 2} w={w * 0.05} h={groundY - tableY - h * 0.4 + 2} />
      <Leg x={w * 0.89} y={tableY + h * 0.4 - 2} w={w * 0.05} h={groundY - tableY - h * 0.4 + 2} />
      <Block x={0} y={tableY} w={w} h={h * 0.06} r={4} tone={body} />
      <SurfaceSheen cx={w / 2} cy={tableY + h * 0.02} rx={w * 0.32} ry={h * 0.014} opacity={0.28} />
    </Svg>
  )
}

/** Wardrobe: crown, two paneled doors with handles, and a pair of feet. */
export function WardrobeIllustration({ width: w, height: h, colorway, style }: Props) {
  const { body, door, handle } = resolvePartTones('wardrobe', colorway, style)
  const groundY = h * 0.97
  return (
    <Svg width={w} height={h} label="옷장">
      <GroundShadow cx={w / 2} y={groundY + h * 0.005} ambientRx={w * 0.47} contactRx={w * 0.4} unit={h} />
      <Leg x={w * 0.06} y={h * 0.9} w={w * 0.08} h={groundY - h * 0.9} />
      <Leg x={w * 0.86} y={h * 0.9} w={w * 0.08} h={groundY - h * 0.9} />
      <Block x={0} y={h * 0.03} w={w} h={h * 0.88} r={6} tone={body} />
      <Block x={w * 0.02} y={0} w={w * 0.96} h={h * 0.05} r={3} tone={body} />
      <SurfaceSheen cx={w / 2} cy={h * 0.02} rx={w * 0.3} ry={h * 0.012} opacity={0.3} />
      <Block x={w * 0.05} y={h * 0.09} w={w * 0.43} h={h * 0.78} r={3} tone={door} sw={1.2} />
      <SurfaceSheen cx={w * 0.18} cy={h * 0.2} rx={w * 0.1} ry={h * 0.13} opacity={0.16} />
      <Block x={w * 0.52} y={h * 0.09} w={w * 0.43} h={h * 0.78} r={3} tone={door} sw={1.2} />
      <VolumeShade cx={w * 0.85} cy={h * 0.55} rx={w * 0.09} ry={h * 0.28} color={door.stroke} opacity={0.1} />
      <Block x={w * 0.1} y={h * 0.14} w={w * 0.33} h={h * 0.3} r={2} tone={door} fill="none" sw={1} opacity={0.7} />
      <Block x={w * 0.57} y={h * 0.14} w={w * 0.33} h={h * 0.3} r={2} tone={door} fill="none" sw={1} opacity={0.7} />
      <Block x={w * 0.1} y={h * 0.5} w={w * 0.33} h={h * 0.32} r={2} tone={door} fill="none" sw={1} opacity={0.7} />
      <Block x={w * 0.57} y={h * 0.5} w={w * 0.33} h={h * 0.32} r={2} tone={door} fill="none" sw={1} opacity={0.7} />
      <Block x={w * 0.43} y={h * 0.44} w={w * 0.02} h={h * 0.1} r={1} tone={handle} sw={1} />
      <Block x={w * 0.55} y={h * 0.44} w={w * 0.02} h={h * 0.1} r={1} tone={handle} sw={1} />
    </Svg>
  )
}

/**
 * Four-poster canopy bed: the same headboard/frame/mattress/blanket/pillow
 * construction `BedBody` (above) uses, compressed into the bottom ~60% of
 * the canvas so the top ~34% is free for the four corner posts and a
 * connecting canopy bar — a genuinely new silhouette, not a recolor of an
 * existing bed. Every vertical fraction below is `BedBody`'s own fraction
 * linearly remapped from its original [0.02, 0.94] range into [0.34, 0.94]
 * (scale factor (0.94-0.34)/(0.94-0.02) ≈ 0.6522) — kept as a documented
 * derivation, not eyeballed, so `bedLieSlots`' offsets can be read directly
 * off this same geometry the way every other slot in this catalog already is
 * (mattress rect y 0.588h–0.810h, x 0.04w–0.96w). Single wide pillow (like
 * `bed-single`), two `'lie'` slots via the exact same `bedLieSlots` helper
 * every other bed uses.
 */
export function CanopyBedIllustration({ width: w, height: h, colorway, style }: Props) {
  const { headboard, frame, blanket, pillow } = resolvePartTones('canopy-bed', colorway, style)
  const blanketPattern = surfacePattern('blanket', style)
  const pillowPattern = surfacePattern('pillow', style)

  const groundY = h * 0.94
  const legH = h * 0.046
  const frameTop = h * 0.653
  const frameBottom = groundY - legH + h * 0.01
  const headboardY = h * 0.34
  const headboardH = h * 0.326
  const mattressY = h * 0.588
  const mattressH = h * 0.222
  const pillowY = h * 0.529
  const pillowH = h * 0.111
  const pillowW = w * 0.46
  const legW = w * 0.045

  const postW = w * 0.04
  const postTopY = h * 0.02
  const postLeftX = w * 0.01
  const postRightX = w * 0.99 - postW

  return (
    <Svg width={w} height={h} label="캐노피 침대" patterns={[blanketPattern, pillowPattern]}>
      <GroundShadow cx={w / 2} y={groundY + h * 0.008} ambientRx={w * 0.47} contactRx={w * 0.44} unit={h} />

      {/* four posts, running from just below the canopy bar all the way to the floor */}
      <Leg x={postLeftX} y={postTopY + h * 0.05} w={postW} h={groundY - postTopY - h * 0.05} tone={frame} />
      <Leg x={postRightX} y={postTopY + h * 0.05} w={postW} h={groundY - postTopY - h * 0.05} tone={frame} />
      {/* connecting canopy bar and a small finial on each post */}
      <Block x={postLeftX} y={postTopY} w={postRightX + postW - postLeftX} h={h * 0.035} r={h * 0.015} tone={frame} sw={1} />
      <circle cx={postLeftX + postW / 2} cy={postTopY - h * 0.006} r={w * 0.018} fill={frame.fill} stroke={frame.stroke} strokeWidth={1} />
      <circle cx={postRightX + postW / 2} cy={postTopY - h * 0.006} r={w * 0.018} fill={frame.fill} stroke={frame.stroke} strokeWidth={1} />

      <Block x={w * 0.02} y={headboardY} w={w * 0.96} h={headboardH} r={h * 0.08} tone={headboard} />
      <Block x={w * 0.07} y={headboardY + h * 0.045} w={w * 0.86} h={headboardH * 0.68} r={h * 0.055} tone={headboard} fill={headboard.stroke} stroke="none" opacity={0.18} />
      <SurfaceSheen cx={w / 2} cy={headboardY + h * 0.06} rx={w * 0.28} ry={h * 0.035} opacity={0.2} />
      <Leg x={w * 0.04} y={frameBottom - h * 0.01} w={legW} h={groundY - frameBottom + h * 0.01} tone={frame} />
      <Leg x={w * 0.96 - legW} y={frameBottom - h * 0.01} w={legW} h={groundY - frameBottom + h * 0.01} tone={frame} />
      <Block x={0} y={frameTop} w={w} h={frameBottom - frameTop} r={h * 0.05} tone={frame} />
      {/* mattress — same shaded seam against the frame as the original bed */}
      <Block x={w * 0.04} y={mattressY} w={w * 0.92} h={mattressH} r={h * 0.06} tone={P.ivory} />
      <VolumeShade cx={w / 2} cy={mattressY + mattressH - h * 0.008} rx={w * 0.42} ry={h * 0.01} color={P.ivory.stroke} opacity={0.4} />
      <Block x={w * 0.27} y={pillowY} w={pillowW} h={pillowH} r={h * 0.05} tone={pillow} fill={patternFill(pillowPattern)} sw={1.2} />
      <SurfaceSheen cx={w / 2} cy={pillowY + pillowH * 0.32} rx={pillowW * 0.3} ry={pillowH * 0.16} opacity={0.24} />
      <Block x={w * 0.04} y={frameTop} w={w * 0.92} h={h * 0.196} r={h * 0.04} tone={blanket} fill={patternFill(blanketPattern)} />
      <Block x={w * 0.04} y={frameTop} w={w * 0.92} h={h * 0.046} r={h * 0.02} tone={blanket} fill={blanket.stroke} stroke="none" opacity={0.3} />
    </Svg>
  )
}

/** Full-length mirror: an arched frame around a glass pane with reflections, propped on two angled feet. */
export function FloorMirrorIllustration({ width: w, height: h, colorway, style }: Props) {
  const { frame } = resolvePartTones('floor-mirror', colorway, style)
  const groundY = h * 0.97
  return (
    <Svg width={w} height={h} label="전신거울">
      <GroundShadow cx={w / 2} y={groundY} ambientRx={w * 0.42} contactRx={w * 0.34} unit={h} />
      <line x1={w * 0.3} y1={h * 0.82} x2={w * 0.16} y2={groundY} stroke={P.taupe.stroke} strokeWidth={4} strokeLinecap="round" />
      <line x1={w * 0.7} y1={h * 0.82} x2={w * 0.84} y2={groundY} stroke={P.taupe.stroke} strokeWidth={4} strokeLinecap="round" />
      <Block x={w * 0.05} y={h * 0.02} w={w * 0.9} h={h * 0.88} r={w * 0.38} tone={frame} />
      <VolumeShade cx={w * 0.86} cy={h * 0.46} rx={w * 0.09} ry={h * 0.4} color={frame.stroke} opacity={0.12} />
      <Block x={w * 0.13} y={h * 0.06} w={w * 0.74} h={h * 0.8} r={w * 0.3} tone={P.glass} sw={1} />
      <polygon points={`${w * 0.3},${h * 0.1} ${w * 0.42},${h * 0.1} ${w * 0.22},${h * 0.5} ${w * 0.16},${h * 0.5}`} fill="#fff" opacity={0.5} />
      <polygon points={`${w * 0.5},${h * 0.1} ${w * 0.55},${h * 0.1} ${w * 0.33},${h * 0.55} ${w * 0.29},${h * 0.55}`} fill="#fff" opacity={0.3} />
    </Svg>
  )
}
