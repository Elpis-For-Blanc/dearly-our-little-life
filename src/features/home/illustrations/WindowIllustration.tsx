import { resolvePartTones } from '../furnitureStyling'
import { Svg } from './parts'
import { patternFill, surfacePattern } from './surface'
import type { FurnitureIllustrationProps } from './types'

/**
 * Same frame/glass/curtain/rod design as before. `frame` recolors the window
 * frame and its cross bars, `curtain` the two drapes, and the drapes are the
 * one patternable surface (glass, rod and frame never take a pattern).
 */
export function WindowIllustration({ width, height, colorway, style }: FurnitureIllustrationProps) {
  const { frame, curtain } = resolvePartTones('window', colorway, style)
  const curtainPattern = surfacePattern('curtain', style)
  const curtainFill = patternFill(curtainPattern) ?? curtain.fill

  return (
    <Svg width={width} height={height} label="창문" patterns={[curtainPattern]}>
      <rect x={2} y={4} width={width - 4} height={7} rx={3.5} fill="#c2a374" />

      <path d={`M 0 6 Q ${width * 0.18} ${height * 0.55} ${width * 0.08} ${height} L 0 ${height} Z`} fill={curtainFill} opacity={0.92} />
      <path d={`M ${width} 6 Q ${width * 0.82} ${height * 0.55} ${width * 0.92} ${height} L ${width} ${height} Z`} fill={curtainFill} opacity={0.92} />

      <rect x={width * 0.12} y={12} width={width * 0.76} height={height - 22} rx={10} fill={frame.fill} stroke={frame.stroke} strokeWidth={3} />
      <rect x={width * 0.12 + 8} y={20} width={width * 0.76 - 16} height={height - 38} rx={6} fill="#cfe8f7" opacity={0.75} />
      <line x1={width / 2} y1={20} x2={width / 2} y2={height - 18} stroke={frame.stroke} strokeWidth={3} />
      <line x1={width * 0.12 + 8} y1={height * 0.52} x2={width * 0.88 - 8} y2={height * 0.52} stroke={frame.stroke} strokeWidth={3} />
    </Svg>
  )
}
