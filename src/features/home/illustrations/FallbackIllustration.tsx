import { FURNITURE_PALETTE as P } from '../palette'
import type { FurnitureIllustrationProps } from './types'

/** Used only if a saved placement references a furnitureId no longer in the catalog. */
export function FallbackIllustration({ width, height }: FurnitureIllustrationProps) {
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" role="img" aria-label="가구">
      <rect x={4} y={4} width={width - 8} height={height - 8} rx={10} fill={P.cream.fill} stroke={P.cream.stroke} strokeWidth={1.5} />
    </svg>
  )
}
