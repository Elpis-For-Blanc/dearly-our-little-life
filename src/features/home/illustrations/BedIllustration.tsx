import { resolvePartTones } from '../furnitureStyling'
import { FURNITURE_PALETTE as P } from '../palette'
import { Svg } from './parts'
import { patternFill, surfacePattern } from './surface'
import type { FurnitureIllustrationProps } from './types'

/**
 * All measurements are fractions of width/height. The two pillow centers
 * computed here are exactly what bed-left/bed-right's interactionSlots in
 * furnitureCatalog.ts are derived from — if these fractions change, update
 * those offsets too. (Frame/shadow geometry below does NOT feed those
 * offsets, so it can move freely.)
 */
export function BedIllustration({ width, height, colorway, style }: FurnitureIllustrationProps) {
  const parts = resolvePartTones('bed', colorway, style)
  const blanketPattern = surfacePattern('blanket', style)
  const pillowPattern = surfacePattern('pillow', style)
  const blanketFill = patternFill(blanketPattern) ?? parts.blanket.fill
  const pillowFill = patternFill(pillowPattern) ?? parts.pillow.fill

  const headboardInset = width * 0.08
  const headboardY = height * 0.08
  const headboardH = height * 0.22
  const frameInset = width * 0.02
  const frameY = height * 0.16
  const frameH = height * 0.76
  const frameBottom = frameY + frameH
  const mattressInset = width * 0.06
  const mattressY = height * 0.24
  const mattressH = height * 0.6
  const pillowInset = width * 0.1
  const pillowGap = width * 0.04
  const pillowY = height * 0.16
  const pillowH = height * 0.24
  const pillowW = (width - 2 * pillowInset - pillowGap) / 2
  const blanketInset = width * 0.07
  const blanketY = height * 0.66
  const blanketH = height * 0.18

  const shadowY = frameBottom + height * 0.008

  return (
    <Svg width={width} height={height} label="침대" patterns={[blanketPattern, pillowPattern]}>
      {/* ambient shadow — soft, wide, barely visible */}
      <ellipse cx={width / 2} cy={shadowY} rx={width * 0.46} ry={height * 0.035} fill={P.shadowAmbient} />
      {/* contact shadow — tight, directly under the frame */}
      <ellipse cx={width / 2} cy={shadowY} rx={width * 0.4} ry={height * 0.014} fill={P.shadowContact} />

      {/* frame, visible along the bottom and sides of the mattress */}
      <rect x={frameInset} y={frameY} width={width - frameInset * 2} height={frameH} rx={frameH * 0.18} fill={parts.frame.fill} stroke={parts.frame.stroke} strokeWidth={1.5} />
      {/* headboard */}
      <rect
        x={headboardInset}
        y={headboardY}
        width={width - headboardInset * 2}
        height={headboardH}
        rx={headboardH * 0.35}
        fill={parts.headboard.fill}
        stroke={parts.headboard.stroke}
        strokeWidth={1.5}
      />

      {/* mattress */}
      <rect
        x={mattressInset}
        y={mattressY}
        width={width - mattressInset * 2}
        height={mattressH}
        rx={mattressH * 0.2}
        fill={P.cream.fill}
        stroke={P.cream.stroke}
        strokeWidth={1.5}
      />

      {/* two pillows */}
      <rect x={pillowInset} y={pillowY} width={pillowW} height={pillowH} rx={pillowH * 0.4} fill={pillowFill} stroke={parts.pillow.stroke} strokeWidth={1.3} />
      <rect
        x={pillowInset + pillowW + pillowGap}
        y={pillowY}
        width={pillowW}
        height={pillowH}
        rx={pillowH * 0.4}
        fill={pillowFill}
        stroke={parts.pillow.stroke}
        strokeWidth={1.3}
      />

      {/* blanket */}
      <rect
        x={blanketInset}
        y={blanketY}
        width={width - blanketInset * 2}
        height={blanketH}
        rx={blanketH * 0.4}
        fill={blanketFill}
        stroke={parts.blanket.stroke}
        strokeWidth={1.5}
      />
    </Svg>
  )
}
