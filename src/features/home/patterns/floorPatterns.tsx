import type { FloorPatternType } from '../roomSurface'

/** Content placed inside a <pattern> tile (on top of its base-color rect), in tile-local units [0, tile]. */
export function getFloorPatternContent(type: FloorPatternType, tile: number, color: string) {
  const t = tile

  switch (type) {
    case 'solid':
      return null
    case 'wood-natural':
      return (
        <g stroke={color} opacity={0.55}>
          <rect x={0} y={0} width={t} height={t * 0.9} fill="none" strokeWidth={t * 0.025} />
          <line x1={0} y1={t * 0.3} x2={t} y2={t * 0.3} strokeWidth={t * 0.012} opacity={0.5} />
          <line x1={0} y1={t * 0.6} x2={t} y2={t * 0.6} strokeWidth={t * 0.012} opacity={0.5} />
        </g>
      )
    case 'wood-horizontal':
      return (
        <g stroke={color} opacity={0.6}>
          <rect x={0} y={0} width={t} height={t * 0.9} fill="none" strokeWidth={t * 0.03} />
          <line x1={0} y1={t * 0.45} x2={t} y2={t * 0.45} strokeWidth={t * 0.015} opacity={0.4} />
        </g>
      )
    case 'wood-vertical':
      return (
        <g stroke={color} opacity={0.6} transform={`rotate(90 ${t / 2} ${t / 2})`}>
          <rect x={0} y={0} width={t} height={t * 0.9} fill="none" strokeWidth={t * 0.03} />
          <line x1={0} y1={t * 0.45} x2={t} y2={t * 0.45} strokeWidth={t * 0.015} opacity={0.4} />
        </g>
      )
    case 'herringbone':
      return (
        <g stroke={color} strokeWidth={t * 0.06} opacity={0.55} strokeLinecap="square">
          <line x1={0} y1={t} x2={t / 2} y2={0} />
          <line x1={t / 2} y1={t} x2={t} y2={0} />
        </g>
      )
    case 'tile-square':
      return <rect x={1} y={1} width={t - 2} height={t - 2} fill="none" stroke={color} strokeWidth={t * 0.025} opacity={0.55} />
    case 'tile-checker':
      return (
        <g opacity={0.5}>
          <rect x={0} y={0} width={t / 2} height={t / 2} fill={color} />
          <rect x={t / 2} y={t / 2} width={t / 2} height={t / 2} fill={color} />
        </g>
      )
    case 'marble':
      return (
        <g stroke={color} strokeWidth={t * 0.025} fill="none" opacity={0.4}>
          <path d={`M 0 ${t * 0.3} Q ${t * 0.5} ${t * 0.1} ${t} ${t * 0.4}`} />
          <path d={`M 0 ${t * 0.7} Q ${t * 0.5} ${t * 0.9} ${t} ${t * 0.6}`} />
        </g>
      )
    case 'terrazzo':
      return (
        <g fill={color} opacity={0.55}>
          <circle cx={t * 0.2} cy={t * 0.25} r={t * 0.05} />
          <circle cx={t * 0.7} cy={t * 0.15} r={t * 0.04} />
          <circle cx={t * 0.55} cy={t * 0.6} r={t * 0.06} />
          <circle cx={t * 0.85} cy={t * 0.75} r={t * 0.035} />
          <circle cx={t * 0.15} cy={t * 0.8} r={t * 0.045} />
        </g>
      )
    case 'tile-dot':
      return (
        <g>
          <rect x={1} y={1} width={t - 2} height={t - 2} fill="none" stroke={color} strokeWidth={t * 0.02} opacity={0.4} />
          <circle cx={t / 2} cy={t / 2} r={t * 0.08} fill={color} opacity={0.6} />
        </g>
      )
    case 'tile-vintage':
      return (
        <g>
          <rect x={0} y={0} width={t / 2} height={t / 2} fill={color} opacity={0.45} />
          <rect x={t / 2} y={t / 2} width={t / 2} height={t / 2} fill={color} opacity={0.45} />
          <rect x={1} y={1} width={t - 2} height={t - 2} fill="none" stroke={color} strokeWidth={t * 0.02} opacity={0.3} />
        </g>
      )
    default:
      return null
  }
}
