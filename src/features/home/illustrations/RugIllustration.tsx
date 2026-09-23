import { resolvePartTones } from '../furnitureStyling'
import { FURNITURE_PALETTE as P } from '../palette'
import { Svg } from './parts'
import { patternFill, surfacePattern } from './surface'
import type { FurnitureIllustrationProps } from './types'

/** A rug's face is a large surface, so its pattern tile is scaled up (on top of the 작게/보통/크게 step) to read as a woven design instead of a tiny print. */
const RUG_PATTERN_TILE_SCALE = 2

/**
 * Outline of one rug shape, shrunk by `inset` on every side. The pattern and
 * the base color fill the *whole* outline, edge to edge (`inset` 4), and a
 * faint inner ring (`inset` ~14% of the short side) is stroked over it like a
 * woven border — so the rug's whole surface is the patterned fabric.
 * (The ring inset is `ringInset` in the component.)
 */
function rugOutline(variant: string | undefined, w: number, h: number, inset: number): { d?: string; ellipse?: { rx: number; ry: number } } {
  const x0 = inset
  const y0 = inset
  const W = w - 2 * inset
  const H = h - 2 * inset
  if (variant === 'rect') {
    // Trapezoid: the back edge is narrower than the front, the same floor perspective the flattened ellipses have.
    const taper = W * 0.06
    return { d: `M ${x0 + taper} ${y0} L ${x0 + W - taper} ${y0} L ${x0 + W} ${y0 + H} L ${x0} ${y0 + H} Z` }
  }
  if (variant === 'heart') {
    const cx = x0 + W / 2
    return {
      d:
        `M ${cx} ${y0 + H} C ${x0 + W * 0.04} ${y0 + H * 0.62} ${x0} ${y0 + H * 0.12} ${x0 + W * 0.28} ${y0 + H * 0.08} ` +
        `C ${x0 + W * 0.42} ${y0 + H * 0.05} ${cx} ${y0 + H * 0.2} ${cx} ${y0 + H * 0.3} ` +
        `C ${cx} ${y0 + H * 0.2} ${x0 + W * 0.58} ${y0 + H * 0.05} ${x0 + W * 0.72} ${y0 + H * 0.08} ` +
        `C ${x0 + W} ${y0 + H * 0.12} ${x0 + W * 0.96} ${y0 + H * 0.62} ${cx} ${y0 + H} Z`,
    }
  }
  // 'ellipse' (the original) and 'circle' (a squatter ellipse) share one drawing; only their size differs.
  return { ellipse: { rx: W / 2, ry: H / 2 } }
}

/**
 * Unlike the other furniture, a rug is flat on the floor rather than an
 * elevated object, so it deliberately has no displaced contact/ambient
 * shadow pair — a shadow offset below it would be exactly what makes a
 * flat floor covering look like it's floating. The soft halo here matches
 * the rug's own footprint (not shifted down) to read as "lying flush".
 * With no customization and the default shape this draws exactly what the
 * rug always drew.
 */
export function RugIllustration({ width, height, colorway, variant, style }: FurnitureIllustrationProps) {
  const { base, border } = resolvePartTones('rug', colorway, style)
  const facePattern = surfacePattern('base', style, RUG_PATTERN_TILE_SCALE)
  const cx = width / 2
  const cy = height / 2
  const fill = patternFill(facePattern) ?? base.fill
  const halo = rugOutline(variant, width, height, 0)
  const face = rugOutline(variant, width, height, 4)
  // 16 is what the original ellipse rug always used; the corner shapes need an inset proportional to their short side.
  const ringInset = variant === 'rect' || variant === 'heart' ? Math.min(width, height) * 0.14 : 16
  const ring = rugOutline(variant, width, height, ringInset)

  return (
    <Svg width={width} height={height} label="러그" patterns={[facePattern]}>
      {halo.ellipse ? <ellipse cx={cx} cy={cy} rx={halo.ellipse.rx} ry={halo.ellipse.ry} fill={P.shadowAmbient} /> : <path d={halo.d} fill={P.shadowAmbient} />}
      {face.ellipse ? (
        <ellipse cx={cx} cy={cy} rx={face.ellipse.rx} ry={face.ellipse.ry} fill={fill} stroke={border.fill} strokeWidth={3} opacity={0.9} />
      ) : (
        <path d={face.d} fill={fill} stroke={border.fill} strokeWidth={3} strokeLinejoin="round" opacity={0.9} />
      )}
      {ring.ellipse ? (
        <ellipse cx={cx} cy={cy} rx={ring.ellipse.rx} ry={ring.ellipse.ry} fill="none" stroke={border.fill} strokeWidth={2} opacity={0.4} />
      ) : (
        <path d={ring.d} fill="none" stroke={border.fill} strokeWidth={2} strokeLinejoin="round" opacity={0.4} />
      )}
    </Svg>
  )
}
