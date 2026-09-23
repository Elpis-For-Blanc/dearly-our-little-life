import { resolvePartTones } from '../furnitureStyling'
import { FURNITURE_PALETTE as P } from '../palette'
import { SurfaceSheen, VolumeShade } from './parts'
import type { FurnitureIllustrationProps } from './types'

/** All measurements are fractions of width/height so the silhouette stays proportioned at any catalog size. */
export function TableIllustration({ width, height, colorway, style }: FurnitureIllustrationProps) {
  const parts = resolvePartTones('table', colorway, style)
  const tones = { top: parts.top }
  const legTone = parts.legs
  const cx = width / 2

  const legW = width * 0.05
  const legInset = width * 0.2
  const legY = height * 0.34
  const legH = height * 0.48 // extended so the leg tips actually reach the shadow line below
  const legBottom = legY + legH
  const topRy = height * 0.1
  const topCy = height * 0.28
  const topRx = width * 0.44
  const edgeH = height * 0.09
  const edgeY = topCy + topRy * 0.2

  const shadowY = legBottom + height * 0.012

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" role="img" aria-label="테이블">
      {/* ambient shadow — soft, wide, barely visible */}
      <ellipse cx={cx} cy={shadowY} rx={width * 0.38} ry={height * 0.04} fill={P.shadowAmbient} />
      {/* contact shadow — tight, directly under the legs */}
      <ellipse cx={cx} cy={shadowY} rx={legInset + legW} ry={height * 0.016} fill={P.shadowContact} />

      {/* legs, reaching down to the shadow line */}
      <rect x={cx - legInset - legW / 2} y={legY} width={legW} height={legH} rx={legW * 0.35} fill={legTone.fill} stroke={legTone.stroke} strokeWidth={1} />
      <rect x={cx + legInset - legW / 2} y={legY} width={legW} height={legH} rx={legW * 0.35} fill={legTone.fill} stroke={legTone.stroke} strokeWidth={1} />

      {/* top thickness, visible under the front edge of the tabletop — keeps the perspective read */}
      <rect x={cx - topRx} y={edgeY} width={topRx * 2} height={edgeH} rx={edgeH * 0.4} fill={tones.top.stroke} opacity={0.55} />

      {/* tabletop */}
      <ellipse cx={cx} cy={topCy} rx={topRx} ry={topRy} fill={tones.top.fill} stroke={tones.top.stroke} strokeWidth={1.5} />
      <SurfaceSheen cx={cx} cy={topCy - topRy * 0.15} rx={topRx * 0.78} ry={topRy * 0.55} opacity={0.35} />
      {/* a whisper of shading on the far side, opposite the sheen, for a one-sided light cue on the disc */}
      <VolumeShade cx={cx + topRx * 0.35} cy={topCy + topRy * 0.35} rx={topRx * 0.3} ry={topRy * 0.4} color={tones.top.stroke} opacity={0.12} />
    </svg>
  )
}
