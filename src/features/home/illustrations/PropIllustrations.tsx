import { resolvePartTones } from '../furnitureStyling'
import { FURNITURE_PALETTE as P } from '../palette'
import { Block, GroundShadow, SurfaceSheen, SW, Svg } from './parts'
import { patternFill, surfacePattern } from './surface'
import type { FurnitureIllustrationProps as Props } from './types'

/** Puffy square cushion: a plump body with four corner puffs, a center button and gathered seams. The whole body (puffs included) is the patternable fabric. */
export function CushionIllustration({ width: w, height: h, colorway, style }: Props) {
  const { body, button } = resolvePartTones('cushion', colorway, style)
  const bodyPattern = surfacePattern('body', style)
  const fill = patternFill(bodyPattern)
  const puff = w * 0.1
  return (
    <Svg width={w} height={h} label="쿠션" patterns={[bodyPattern]}>
      <GroundShadow cx={w / 2} y={h * 0.93} ambientRx={w * 0.44} contactRx={w * 0.34} unit={h} />
      <Block x={w * 0.06} y={h * 0.1} w={w * 0.88} h={h * 0.8} r={w * 0.22} tone={body} fill={fill} />
      {[[0.1, 0.14], [0.9, 0.14], [0.1, 0.86], [0.9, 0.86]].map(([fx, fy]) => (
        <circle key={`${fx}-${fy}`} cx={w * fx} cy={h * fy} r={puff} fill={fill ?? body.fill} stroke={body.stroke} strokeWidth={SW} />
      ))}
      <Block x={w * 0.06} y={h * 0.1} w={w * 0.88} h={h * 0.8} r={w * 0.22} tone={body} fill={fill} stroke="none" />
      <path d={`M ${w * 0.16} ${h * 0.2} L ${w * 0.5} ${h * 0.5} L ${w * 0.84} ${h * 0.2} M ${w * 0.16} ${h * 0.8} L ${w * 0.5} ${h * 0.5} L ${w * 0.84} ${h * 0.8}`} fill="none" stroke={body.stroke} strokeWidth={1} opacity={0.5} />
      <SurfaceSheen cx={w * 0.34} cy={h * 0.28} rx={w * 0.16} ry={h * 0.12} opacity={0.2} />
      <circle cx={w / 2} cy={h / 2} r={w * 0.05} fill={button.fill} stroke={button.stroke} strokeWidth={1} />
    </Svg>
  )
}

/** Plush bunny sitting up: long ears with pink insides, round head and body, paws, face and blush. */
export function BunnyDollIllustration({ width: w, height: h, colorway, style }: Props) {
  const { body } = resolvePartTones('bunny-doll', colorway, style)
  return (
    <Svg width={w} height={h} label="토끼 인형">
      <GroundShadow cx={w / 2} y={h * 0.95} ambientRx={w * 0.4} contactRx={w * 0.3} unit={h} />
      <ellipse cx={w * 0.36} cy={h * 0.17} rx={w * 0.09} ry={h * 0.16} fill={body.fill} stroke={body.stroke} strokeWidth={SW} />
      <ellipse cx={w * 0.64} cy={h * 0.17} rx={w * 0.09} ry={h * 0.16} fill={body.fill} stroke={body.stroke} strokeWidth={SW} />
      <ellipse cx={w * 0.36} cy={h * 0.18} rx={w * 0.04} ry={h * 0.1} fill={P.pinkDeep.fill} opacity={0.7} />
      <ellipse cx={w * 0.64} cy={h * 0.18} rx={w * 0.04} ry={h * 0.1} fill={P.pinkDeep.fill} opacity={0.7} />
      <ellipse cx={w / 2} cy={h * 0.75} rx={w * 0.3} ry={h * 0.2} fill={body.fill} stroke={body.stroke} strokeWidth={SW} />
      <ellipse cx={w * 0.22} cy={h * 0.72} rx={w * 0.07} ry={h * 0.11} fill={body.fill} stroke={body.stroke} strokeWidth={SW} />
      <ellipse cx={w * 0.78} cy={h * 0.72} rx={w * 0.07} ry={h * 0.11} fill={body.fill} stroke={body.stroke} strokeWidth={SW} />
      <ellipse cx={w / 2} cy={h * 0.45} rx={w * 0.27} ry={h * 0.21} fill={body.fill} stroke={body.stroke} strokeWidth={SW} />
      <SurfaceSheen cx={w * 0.4} cy={h * 0.36} rx={w * 0.1} ry={h * 0.07} opacity={0.24} />
      <circle cx={w * 0.4} cy={h * 0.43} r={w * 0.028} fill={P.slate.fill} />
      <circle cx={w * 0.6} cy={h * 0.43} r={w * 0.028} fill={P.slate.fill} />
      <ellipse cx={w / 2} cy={h * 0.5} rx={w * 0.03} ry={h * 0.02} fill={P.pinkDeep.stroke} />
      <circle cx={w * 0.33} cy={h * 0.5} r={w * 0.045} fill={P.pinkDeep.fill} opacity={0.5} />
      <circle cx={w * 0.67} cy={h * 0.5} r={w * 0.045} fill={P.pinkDeep.fill} opacity={0.5} />
      <ellipse cx={w * 0.4} cy={h * 0.93} rx={w * 0.1} ry={h * 0.05} fill={body.fill} stroke={body.stroke} strokeWidth={1} />
      <ellipse cx={w * 0.6} cy={h * 0.93} rx={w * 0.1} ry={h * 0.05} fill={body.fill} stroke={body.stroke} strokeWidth={1} />
    </Svg>
  )
}

/** Plush bear sitting up: round ears, a lighter muzzle and belly, dark nose and eyes. */
export function BearDollIllustration({ width: w, height: h, colorway, style }: Props) {
  const { body } = resolvePartTones('bear-doll', colorway, style)
  return (
    <Svg width={w} height={h} label="곰 인형">
      <GroundShadow cx={w / 2} y={h * 0.95} ambientRx={w * 0.4} contactRx={w * 0.3} unit={h} />
      <circle cx={w * 0.26} cy={h * 0.17} r={w * 0.1} fill={body.fill} stroke={body.stroke} strokeWidth={SW} />
      <circle cx={w * 0.74} cy={h * 0.17} r={w * 0.1} fill={body.fill} stroke={body.stroke} strokeWidth={SW} />
      <circle cx={w * 0.26} cy={h * 0.18} r={w * 0.05} fill={P.pink.fill} opacity={0.8} />
      <circle cx={w * 0.74} cy={h * 0.18} r={w * 0.05} fill={P.pink.fill} opacity={0.8} />
      <ellipse cx={w / 2} cy={h * 0.74} rx={w * 0.3} ry={h * 0.21} fill={body.fill} stroke={body.stroke} strokeWidth={SW} />
      <ellipse cx={w / 2} cy={h * 0.76} rx={w * 0.17} ry={h * 0.13} fill={P.ivory.fill} opacity={0.85} />
      <ellipse cx={w * 0.2} cy={h * 0.7} rx={w * 0.08} ry={h * 0.11} fill={body.fill} stroke={body.stroke} strokeWidth={SW} />
      <ellipse cx={w * 0.8} cy={h * 0.7} rx={w * 0.08} ry={h * 0.11} fill={body.fill} stroke={body.stroke} strokeWidth={SW} />
      <circle cx={w / 2} cy={h * 0.42} r={w * 0.29} fill={body.fill} stroke={body.stroke} strokeWidth={SW} />
      <SurfaceSheen cx={w * 0.38} cy={h * 0.3} rx={w * 0.1} ry={h * 0.07} opacity={0.22} />
      <ellipse cx={w / 2} cy={h * 0.5} rx={w * 0.14} ry={h * 0.09} fill={P.ivory.fill} stroke={body.stroke} strokeWidth={1} />
      <ellipse cx={w / 2} cy={h * 0.47} rx={w * 0.04} ry={h * 0.025} fill={P.slate.fill} />
      <circle cx={w * 0.38} cy={h * 0.38} r={w * 0.028} fill={P.slate.fill} />
      <circle cx={w * 0.62} cy={h * 0.38} r={w * 0.028} fill={P.slate.fill} />
      <ellipse cx={w * 0.38} cy={h * 0.94} rx={w * 0.1} ry={h * 0.045} fill={body.fill} stroke={body.stroke} strokeWidth={1} />
      <ellipse cx={w * 0.62} cy={h * 0.94} rx={w * 0.1} ry={h * 0.045} fill={body.fill} stroke={body.stroke} strokeWidth={1} />
    </Svg>
  )
}

/**
 * Small pillar candle in a saucer holder, with a lit flame and a soft warm
 * glow around it — the one catalog piece whose `lightSource: true` gets an
 * actual, matching visual treatment (not just inert metadata): the glow
 * ellipse behind the flame, same `P.butter`-toned soft-light approach
 * `FloorLampIllustration`/`TableLampIllustration` already use, just scaled
 * down for a tabletop prop. Decor-only — no interaction slots.
 */
export function CandleIllustration({ width: w, height: h, colorway, style }: Props) {
  const { body } = resolvePartTones('candle', colorway, style)
  const groundY = h * 0.95
  return (
    <Svg width={w} height={h} label="캔들">
      <GroundShadow cx={w / 2} y={groundY} ambientRx={w * 0.44} contactRx={w * 0.32} unit={h} />
      <ellipse cx={w / 2} cy={h * 0.16} rx={w * 0.34} ry={h * 0.13} fill={P.butter.fill} opacity={0.5} />
      <ellipse cx={w / 2} cy={h * 0.92} rx={w * 0.36} ry={h * 0.05} fill={P.taupe.fill} stroke={P.taupe.stroke} strokeWidth={1} />
      <Block x={w * 0.32} y={h * 0.3} w={w * 0.36} h={h * 0.6} r={w * 0.16} tone={body} />
      <SurfaceSheen cx={w * 0.42} cy={h * 0.42} rx={w * 0.1} ry={h * 0.18} opacity={0.3} />
      <path
        d={`M ${w * 0.5} ${h * 0.02} C ${w * 0.58} ${h * 0.1} ${w * 0.56} ${h * 0.18} ${w * 0.5} ${h * 0.23} C ${w * 0.44} ${h * 0.18} ${w * 0.42} ${h * 0.1} ${w * 0.5} ${h * 0.02} Z`}
        fill={P.butter.fill}
        stroke={P.butter.stroke}
        strokeWidth={1}
      />
      <circle cx={w * 0.5} cy={h * 0.27} r={w * 0.03} fill={P.slate.fill} />
    </Svg>
  )
}

/** Bulbous vase with a short neck and three flowers on curved stems. */
/**
 * Two real variants, same width/height (vase has no interactionSlots, so
 * this is safe either way, but kept identical in size on purpose — only the
 * flowers themselves differ): `'flowers'` (default, matching the original
 * always-drawn design exactly, so every existing placement is unaffected)
 * and `'empty'` (just the vase body — the stems/leaves/blooms are skipped
 * entirely, not hidden behind opacity 0).
 */
export function VaseIllustration({ width: w, height: h, colorway, variant, style }: Props) {
  const { body } = resolvePartTones('vase', colorway, style)
  const blooms: Array<[number, number, string]> = [[0.26, 0.2, P.pinkDeep.fill], [0.5, 0.09, P.butter.fill], [0.74, 0.22, P.lavender.fill]]
  const hasFlowers = variant !== 'empty'
  return (
    <Svg width={w} height={h} label={hasFlowers ? '꽃병' : '빈 꽃병'}>
      <GroundShadow cx={w / 2} y={h * 0.96} ambientRx={w * 0.4} contactRx={w * 0.28} unit={h} />
      {hasFlowers && (
        <>
          {blooms.map(([fx, fy]) => (
            <path key={fx} d={`M ${w * 0.5} ${h * 0.46} Q ${w * (0.5 + (fx - 0.5) * 0.4)} ${h * 0.3} ${w * fx} ${h * fy}`} fill="none" stroke={P.leafDeep.stroke} strokeWidth={1.6} />
          ))}
          <ellipse cx={w * 0.36} cy={h * 0.34} rx={w * 0.07} ry={h * 0.03} fill={P.leaf.fill} stroke={P.leaf.stroke} strokeWidth={1} transform={`rotate(-30 ${w * 0.36} ${h * 0.34})`} />
          <ellipse cx={w * 0.64} cy={h * 0.36} rx={w * 0.07} ry={h * 0.03} fill={P.leaf.fill} stroke={P.leaf.stroke} strokeWidth={1} transform={`rotate(30 ${w * 0.64} ${h * 0.36})`} />
          {blooms.map(([fx, fy, color]) => (
            <g key={`bloom-${fx}`}>
              <circle cx={w * fx} cy={h * fy} r={w * 0.1} fill={color} stroke={P.pinkDeep.stroke} strokeWidth={1} />
              <circle cx={w * fx} cy={h * fy} r={w * 0.035} fill={P.butter.stroke} />
            </g>
          ))}
          <Block x={w * 0.36} y={h * 0.43} w={w * 0.28} h={h * 0.1} r={2} tone={body} />
        </>
      )}
      <path d={`M ${w * 0.3} ${h * 0.52} Q ${w * 0.04} ${h * 0.72} ${w * 0.24} ${h * 0.94} L ${w * 0.76} ${h * 0.94} Q ${w * 0.96} ${h * 0.72} ${w * 0.7} ${h * 0.52} Z`} fill={body.fill} stroke={body.stroke} strokeWidth={SW} strokeLinejoin="round" />
      <SurfaceSheen cx={w * 0.34} cy={h * 0.68} rx={w * 0.08} ry={h * 0.14} opacity={0.24} />
      <path d={`M ${w * 0.26} ${h * 0.7} Q ${w * 0.5} ${h * 0.78} ${w * 0.74} ${h * 0.7}`} fill="none" stroke={body.stroke} strokeWidth={1.5} opacity={0.7} />
    </Svg>
  )
}

/** Wall picture frame: frame, mat, and a little landscape (sun and two hills). */
export function FrameIllustration({ width: w, height: h, colorway, style }: Props) {
  const { frame } = resolvePartTones('frame', colorway, style)
  return (
    <Svg width={w} height={h} label="액자">
      <Block x={0} y={0} w={w} h={h} r={4} tone={frame} />
      <Block x={w * 0.1} y={h * 0.08} w={w * 0.8} h={h * 0.84} r={2} tone={P.ivory} sw={1} />
      <Block x={w * 0.17} y={h * 0.14} w={w * 0.66} h={h * 0.72} tone={P.sky} sw={1} />
      <circle cx={w * 0.66} cy={h * 0.3} r={w * 0.07} fill={P.butter.fill} stroke={P.butter.stroke} strokeWidth={1} />
      <path d={`M ${w * 0.17} ${h * 0.86} L ${w * 0.17} ${h * 0.62} Q ${w * 0.35} ${h * 0.46} ${w * 0.52} ${h * 0.7} L ${w * 0.6} ${h * 0.86} Z`} fill={P.leaf.fill} stroke={P.leaf.stroke} strokeWidth={1} />
      <path d={`M ${w * 0.4} ${h * 0.86} Q ${w * 0.6} ${h * 0.56} ${w * 0.83} ${h * 0.66} L ${w * 0.83} ${h * 0.86} Z`} fill={P.leafDeep.fill} stroke={P.leafDeep.stroke} strokeWidth={1} />
      {/* a faint glass-cover streak over the picture, the same reflective cue floor-mirror/wall-mirror use */}
      <path d={`M ${w * 0.22} ${h * 0.18} L ${w * 0.32} ${h * 0.18} L ${w * 0.24} ${h * 0.5} L ${w * 0.19} ${h * 0.5} Z`} fill="#fff" opacity={0.25} />
    </Svg>
  )
}

/** Small desk clock: round body on two little feet, a face with hands, and two bells on top. */
export function DeskClockIllustration({ width: w, height: h, colorway, style }: Props) {
  const { body } = resolvePartTones('desk-clock', colorway, style)
  const cy = h * 0.55
  const r = w * 0.38
  return (
    <Svg width={w} height={h} label="탁상시계">
      <GroundShadow cx={w / 2} y={h * 0.95} ambientRx={w * 0.4} contactRx={w * 0.3} unit={h} />
      <circle cx={w * 0.27} cy={h * 0.2} r={w * 0.1} fill={P.metal.fill} stroke={P.metal.stroke} strokeWidth={1} />
      <circle cx={w * 0.73} cy={h * 0.2} r={w * 0.1} fill={P.metal.fill} stroke={P.metal.stroke} strokeWidth={1} />
      <line x1={w * 0.3} y1={h * 0.84} x2={w * 0.24} y2={h * 0.95} stroke={P.slate.fill} strokeWidth={2.5} strokeLinecap="round" />
      <line x1={w * 0.7} y1={h * 0.84} x2={w * 0.76} y2={h * 0.95} stroke={P.slate.fill} strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={w / 2} cy={cy} r={r} fill={body.fill} stroke={body.stroke} strokeWidth={SW} />
      <circle cx={w / 2} cy={cy} r={r * 0.78} fill={P.ivory.fill} stroke={body.stroke} strokeWidth={1} />
      <SurfaceSheen cx={w * 0.42} cy={cy - r * 0.32} rx={r * 0.28} ry={r * 0.18} opacity={0.3} />
      {[0, 90, 180, 270].map((deg) => (
        <line key={deg} x1={w / 2} y1={cy - r * 0.68} x2={w / 2} y2={cy - r * 0.58} stroke={P.slate.fill} strokeWidth={1.2} transform={`rotate(${deg} ${w / 2} ${cy})`} />
      ))}
      <line x1={w / 2} y1={cy} x2={w / 2} y2={cy - r * 0.5} stroke={P.slate.fill} strokeWidth={1.5} strokeLinecap="round" />
      <line x1={w / 2} y1={cy} x2={w / 2 + r * 0.32} y2={cy + r * 0.12} stroke={P.slate.fill} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  )
}

/** Three stacked books, each slightly offset, with cover, page edge and spine shading. */
export function BookStackIllustration({ width: w, height: h, colorway, style }: Props) {
  const { bottom, middle, top } = resolvePartTones('book-stack', colorway, style)
  const books = [
    { x: 0.03, y: 0.62, w: 0.94, tone: bottom },
    { x: 0.1, y: 0.36, w: 0.8, tone: middle },
    { x: 0.06, y: 0.1, w: 0.7, tone: top },
  ]
  return (
    <Svg width={w} height={h} label="책 더미">
      <GroundShadow cx={w / 2} y={h * 0.93} ambientRx={w * 0.47} contactRx={w * 0.42} unit={h} />
      {books.map((book) => (
        <g key={book.y}>
          <Block x={w * book.x} y={h * book.y} w={w * book.w} h={h * 0.28} r={3} tone={book.tone} />
          <Block x={w * (book.x + 0.05)} y={h * (book.y + 0.08)} w={w * (book.w - 0.06)} h={h * 0.1} r={1.5} tone={P.ivory} sw={1} />
          <line x1={w * (book.x + 0.05)} y1={h * book.y} x2={w * (book.x + 0.05)} y2={h * (book.y + 0.28)} stroke={book.tone.stroke} strokeWidth={1.2} />
          <SurfaceSheen cx={w * (book.x + book.w * 0.72)} cy={h * (book.y + 0.08)} rx={w * book.w * 0.12} ry={h * 0.05} opacity={0.22} />
        </g>
      ))}
    </Svg>
  )
}

/** Mug with a handle, a coffee surface and two wisps of steam. */
export function MugIllustration({ width: w, height: h, colorway, style }: Props) {
  const { body } = resolvePartTones('mug', colorway, style)
  return (
    <Svg width={w} height={h} label="머그컵">
      <GroundShadow cx={w * 0.42} y={h * 0.9} ambientRx={w * 0.42} contactRx={w * 0.34} unit={h} />
      <path d={`M ${w * 0.36} ${h * 0.02} q -4 5 0 9 t 0 9`} fill="none" stroke={P.metal.stroke} strokeWidth={1.4} strokeLinecap="round" opacity={0.7} />
      <path d={`M ${w * 0.5} ${h * 0.02} q -4 5 0 9 t 0 9`} fill="none" stroke={P.metal.stroke} strokeWidth={1.4} strokeLinecap="round" opacity={0.7} />
      <path d={`M ${w * 0.7} ${h * 0.4} C ${w * 0.98} ${h * 0.36} ${w * 0.98} ${h * 0.72} ${w * 0.7} ${h * 0.7}`} fill="none" stroke={body.stroke} strokeWidth={3.2} strokeLinecap="round" />
      <Block x={w * 0.12} y={h * 0.32} w={w * 0.58} h={h * 0.58} r={w * 0.1} tone={body} />
      <SurfaceSheen cx={w * 0.24} cy={h * 0.5} rx={w * 0.1} ry={h * 0.22} opacity={0.26} />
      <ellipse cx={w * 0.41} cy={h * 0.33} rx={w * 0.29} ry={h * 0.05} fill="#C9A98A" stroke={body.stroke} strokeWidth={1} />
    </Svg>
  )
}

/** Small lamp: round foot, short stem, a tapered shade and a warm glow under the rim. */
export function TableLampIllustration({ width: w, height: h, colorway, style }: Props) {
  const { shade } = resolvePartTones('table-lamp', colorway, style)
  return (
    <Svg width={w} height={h} label="테이블 조명">
      <GroundShadow cx={w / 2} y={h * 0.96} ambientRx={w * 0.4} contactRx={w * 0.3} unit={h} />
      <ellipse cx={w / 2} cy={h * 0.94} rx={w * 0.28} ry={h * 0.03} fill={P.taupe.fill} stroke={P.taupe.stroke} strokeWidth={SW} />
      <Block x={w / 2 - w * 0.04} y={h * 0.46} w={w * 0.08} h={h * 0.48} r={2} tone={P.taupe} sw={1} />
      <ellipse cx={w / 2} cy={h * 0.5} rx={w * 0.4} ry={h * 0.04} fill={P.butter.fill} opacity={0.55} />
      <polygon points={`${w * 0.28},${h * 0.04} ${w * 0.72},${h * 0.04} ${w * 0.92},${h * 0.48} ${w * 0.08},${h * 0.48}`} fill={shade.fill} stroke={shade.stroke} strokeWidth={SW} strokeLinejoin="round" />
      <SurfaceSheen cx={w * 0.4} cy={h * 0.18} rx={w * 0.11} ry={h * 0.11} opacity={0.3} />
      <ellipse cx={w / 2} cy={h * 0.48} rx={w * 0.42} ry={h * 0.02} fill={shade.stroke} opacity={0.4} />
      {/* the bulb itself, peeking out under the shade's open rim — a warm glass shape distinct from the ambient glow ellipse above */}
      <Block x={w / 2 - w * 0.025} y={h * 0.46} w={w * 0.05} h={h * 0.045} tone={P.metal} sw={1} />
      <ellipse cx={w / 2} cy={h * 0.52} rx={w * 0.055} ry={h * 0.04} fill={P.butter.fill} stroke={P.butter.stroke} strokeWidth={1} />
      <ellipse cx={w * 0.48} cy={h * 0.51} rx={w * 0.018} ry={h * 0.014} fill="#ffffff" opacity={0.6} />
    </Svg>
  )
}

/**
 * Ceiling-hung pendant light: a cord down from the top edge, a bell-shaped
 * shade, and a soft warm glow underneath — the one piece in the catalog
 * with no legs/base/pole at all, unlike `floor-lamp`/`table-lamp`, so its
 * silhouette is unmistakably a *hanging* fixture. A second `lightSource`
 * piece (candle was the first) — its glow is genuine, matching visual
 * metadata, not decorative-only.
 */
export function PendantLightIllustration({ width: w, height: h, colorway, style }: Props) {
  const { shade } = resolvePartTones('pendant-light', colorway, style)
  return (
    <Svg width={w} height={h} label="펜던트 조명">
      {/* cable — a distinct cord down from the ceiling, separate from the shade's own hanger fitting below */}
      <line x1={w / 2} y1={0} x2={w / 2} y2={h * 0.3} stroke={P.slate.fill} strokeWidth={1.6} />
      <Block x={w / 2 - w * 0.02} y={h * 0.29} w={w * 0.04} h={h * 0.04} tone={P.metal} sw={1} />
      <ellipse cx={w / 2} cy={h * 0.68} rx={w * 0.46} ry={h * 0.16} fill={P.butter.fill} opacity={0.4} />
      <path
        d={`M ${w * 0.2} ${h * 0.32} Q ${w * 0.5} ${h * 0.22} ${w * 0.8} ${h * 0.32} L ${w * 0.92} ${h * 0.56} Q ${w * 0.5} ${h * 0.66} ${w * 0.08} ${h * 0.56} Z`}
        fill={shade.fill}
        stroke={shade.stroke}
        strokeWidth={SW}
        strokeLinejoin="round"
      />
      <SurfaceSheen cx={w * 0.38} cy={h * 0.4} rx={w * 0.1} ry={h * 0.06} opacity={0.3} />
      <ellipse cx={w / 2} cy={h * 0.56} rx={w * 0.42} ry={h * 0.03} fill={shade.stroke} opacity={0.4} />
      {/* the bulb, hanging just below the shade's open bottom — its own warm glass shape, distinct from the shade and the ambient glow */}
      <ellipse cx={w / 2} cy={h * 0.63} rx={w * 0.07} ry={h * 0.055} fill={P.butter.fill} stroke={P.butter.stroke} strokeWidth={1} />
      <ellipse cx={w * 0.47} cy={h * 0.61} rx={w * 0.022} ry={h * 0.018} fill="#ffffff" opacity={0.6} />
    </Svg>
  )
}

/**
 * Small wall mirror in a simple frame — distinct from `floor-mirror`
 * (full-length, propped on feet): no legs, hangs flush on the wall, meant to
 * be read at a glance as smaller and lighter. Two real shapes, same
 * width/height so nothing about the (slot-free) piece's footprint shifts
 * between them: 오벌 (the original ellipse) and 아치형 (a rounded-top
 * rectangle) — both get the same glass reflection streak.
 */
export function WallMirrorIllustration({ width: w, height: h, colorway, variant, style }: Props) {
  const { frame } = resolvePartTones('wall-mirror', colorway, style)
  const cx = w / 2
  const cy = h / 2
  const isArch = variant === 'arch'
  const reflection = <path d={`M ${w * 0.32} ${h * 0.24} Q ${w * 0.4} ${h * 0.5} ${w * 0.3} ${h * 0.76}`} stroke="#fff" strokeWidth={w * 0.05} opacity={0.35} fill="none" strokeLinecap="round" />
  return (
    <Svg width={w} height={h} label="벽거울">
      {isArch ? (
        <>
          <path d={`M ${w * 0.05} ${h * 0.98} L ${w * 0.05} ${h * 0.35} Q ${w * 0.05} ${h * 0.02} ${w / 2} ${h * 0.02} Q ${w * 0.95} ${h * 0.02} ${w * 0.95} ${h * 0.35} L ${w * 0.95} ${h * 0.98} Z`} fill={frame.fill} stroke={frame.stroke} strokeWidth={SW} strokeLinejoin="round" />
          <path d={`M ${w * 0.13} ${h * 0.93} L ${w * 0.13} ${h * 0.37} Q ${w * 0.13} ${h * 0.1} ${w / 2} ${h * 0.1} Q ${w * 0.87} ${h * 0.1} ${w * 0.87} ${h * 0.37} L ${w * 0.87} ${h * 0.93} Z`} fill={P.glass.fill} stroke={P.glass.stroke} strokeWidth={1} />
        </>
      ) : (
        <>
          <ellipse cx={cx} cy={cy} rx={w * 0.47} ry={h * 0.47} fill={frame.fill} stroke={frame.stroke} strokeWidth={SW} />
          <ellipse cx={cx} cy={cy} rx={w * 0.38} ry={h * 0.38} fill={P.glass.fill} stroke={P.glass.stroke} strokeWidth={1} />
        </>
      )}
      {reflection}
    </Svg>
  )
}

/**
 * Small storage basket/bin — a real `storage`-category piece with no
 * interaction slot (like every other decor prop), for tidying small items
 * next to a dresser or bed. Two genuinely different shapes: a round woven
 * basket (default, with drawn weave lines) and a rectangular fabric bin with
 * an upper lip — different width/height is safe here since this piece has
 * zero interactionSlots to ever misalign.
 */
export function StorageBasketIllustration({ width: w, height: h, colorway, variant, style }: Props) {
  const { body } = resolvePartTones('storage-basket', colorway, style)
  const groundY = h * 0.95
  const isRect = variant === 'rect'
  return (
    <Svg width={w} height={h} label="수납 바구니">
      <GroundShadow cx={w / 2} y={groundY} ambientRx={w * 0.46} contactRx={w * 0.36} unit={h} />
      {isRect ? (
        <>
          <Block x={w * 0.08} y={h * 0.24} w={w * 0.84} h={h * 0.68} r={h * 0.05} tone={body} sw={1.4} />
          <Block x={w * 0.02} y={h * 0.16} w={w * 0.96} h={h * 0.16} r={h * 0.05} tone={body} fill={body.stroke} stroke="none" opacity={0.3} />
          <SurfaceSheen cx={w * 0.36} cy={h * 0.42} rx={w * 0.22} ry={h * 0.16} opacity={0.2} />
        </>
      ) : (
        <>
          <path
            d={`M ${w * 0.12} ${h * 0.28} Q ${w * 0.5} ${h * 0.14} ${w * 0.88} ${h * 0.28} L ${w * 0.78} ${h * 0.9} Q ${w * 0.5} ${h * 0.98} ${w * 0.22} ${h * 0.9} Z`}
            fill={body.fill}
            stroke={body.stroke}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
          {[0.42, 0.58, 0.74].map((fy) => (
            <path key={fy} d={`M ${w * 0.16} ${h * fy} Q ${w * 0.5} ${h * (fy + 0.035)} ${w * 0.84} ${h * fy}`} fill="none" stroke={body.stroke} strokeWidth={0.8} opacity={0.4} />
          ))}
          <ellipse cx={w / 2} cy={h * 0.27} rx={w * 0.38} ry={h * 0.045} fill="none" stroke={body.stroke} strokeWidth={1.2} opacity={0.6} />
          <SurfaceSheen cx={w * 0.36} cy={h * 0.48} rx={w * 0.16} ry={h * 0.22} opacity={0.2} />
        </>
      )}
    </Svg>
  )
}

/** Small wall-mounted display shelf with two little decorative pieces resting on it. */
export function DisplayShelfIllustration({ width: w, height: h, colorway, style }: Props) {
  const { body } = resolvePartTones('display-shelf', colorway, style)
  return (
    <Svg width={w} height={h} label="장식 선반">
      <Block x={w * 0.1} y={h * 0.15} w={w * 0.02} h={h * 0.6} r={1} tone={body} opacity={0.5} sw={1} />
      <Block x={w * 0.88} y={h * 0.15} w={w * 0.02} h={h * 0.6} r={1} tone={body} sw={1} opacity={0.5} />
      <Block x={0} y={h * 0.6} w={w} h={h * 0.22} r={2} tone={body} sw={1.2} />
      <SurfaceSheen cx={w / 2} cy={h * 0.66} rx={w * 0.32} ry={h * 0.03} opacity={0.28} />
      <circle cx={w * 0.25} cy={h * 0.42} r={w * 0.06} fill={P.pinkDeep.fill} stroke={P.pinkDeep.stroke} strokeWidth={1} />
      <Block x={w * 0.62} y={h * 0.24} w={w * 0.1} h={h * 0.36} r={2} tone={P.leaf} sw={1} />
    </Svg>
  )
}

/** Round wall clock: outer rim, dial with twelve ticks, hands and a center cap. */
export function WallClockIllustration({ width: w, height: h, colorway, style }: Props) {
  const { rim } = resolvePartTones('wall-clock', colorway, style)
  const c = w / 2
  return (
    <Svg width={w} height={h} label="벽시계">
      <circle cx={c} cy={c} r={w * 0.48} fill={rim.fill} stroke={rim.stroke} strokeWidth={SW} />
      <circle cx={c} cy={c} r={w * 0.4} fill={P.ivory.fill} stroke={rim.stroke} strokeWidth={1} />
      <SurfaceSheen cx={c - w * 0.1} cy={c - w * 0.12} rx={w * 0.14} ry={w * 0.1} opacity={0.28} />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1={c} y1={c - w * 0.36} x2={c} y2={c - w * (i % 3 === 0 ? 0.29 : 0.32)} stroke={P.slate.fill} strokeWidth={i % 3 === 0 ? 1.8 : 1} transform={`rotate(${i * 30} ${c} ${c})`} />
      ))}
      <line x1={c} y1={c} x2={c} y2={c - w * 0.25} stroke={P.slate.fill} strokeWidth={1.8} strokeLinecap="round" transform={`rotate(24 ${c} ${c})`} />
      <line x1={c} y1={c} x2={c} y2={c - w * 0.18} stroke={P.slate.fill} strokeWidth={2.4} strokeLinecap="round" transform={`rotate(-70 ${c} ${c})`} />
      <circle cx={c} cy={c} r={w * 0.035} fill={P.pink.stroke} />
    </Svg>
  )
}

/** A pair of tied-back drapes on a rod: gathered folds, tie-backs, and finials. The two panels are the patternable `fabric` surface. */
export function CurtainIllustration({ width: w, height: h, colorway, style }: Props) {
  const { fabric, tieback } = resolvePartTones('curtain', colorway, style)
  const fabricPattern = surfacePattern('fabric', style)
  const fabricFill = patternFill(fabricPattern)
  const panel = `M ${w * 0.04} ${h * 0.05} L ${w * 0.46} ${h * 0.05} C ${w * 0.46} ${h * 0.4} ${w * 0.3} ${h * 0.5} ${w * 0.3} ${h * 0.56} C ${w * 0.3} ${h * 0.7} ${w * 0.44} ${h * 0.85} ${w * 0.46} ${h * 0.97} L ${w * 0.04} ${h * 0.97} Z`
  const folds = [0.12, 0.2, 0.28, 0.36]
  return (
    <Svg width={w} height={h} label="커튼" patterns={[fabricPattern]}>
      {[false, true].map((mirrored) => (
        <g key={String(mirrored)} transform={mirrored ? `translate(${w} 0) scale(-1 1)` : undefined}>
          <path d={panel} fill={fabricFill ?? fabric.fill} stroke={fabric.stroke} strokeWidth={SW} strokeLinejoin="round" />
          {folds.map((fx) => (
            <path key={fx} d={`M ${w * fx} ${h * 0.06} C ${w * (fx + 0.02)} ${h * 0.4} ${w * (fx - 0.02)} ${h * 0.7} ${w * fx} ${h * 0.96}`} fill="none" stroke={fabric.stroke} strokeWidth={1} opacity={0.45} />
          ))}
          <Block x={w * 0.26} y={h * 0.54} w={w * 0.22} h={h * 0.035} r={2} tone={tieback} sw={1} />
        </g>
      ))}
      <Block x={0} y={h * 0.02} w={w} h={h * 0.03} r={2} tone={P.taupe} sw={1} />
      <circle cx={w * 0.01} cy={h * 0.035} r={w * 0.02} fill={P.taupe.fill} stroke={P.taupe.stroke} strokeWidth={1} />
      <circle cx={w * 0.99} cy={h * 0.035} r={w * 0.02} fill={P.taupe.fill} stroke={P.taupe.stroke} strokeWidth={1} />
    </Svg>
  )
}
