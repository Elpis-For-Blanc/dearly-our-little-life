import type { WallpaperPatternType } from '../roomSurface'

function starPath(cx: number, cy: number, outerR: number, innerR: number) {
  const points: string[] = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR
    const angle = (Math.PI / 5) * i - Math.PI / 2
    points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`)
  }
  return `M ${points.join(' L ')} Z`
}

/** Content placed inside a <pattern> tile (on top of its base-color rect), in tile-local units [0, tile]. */
export function getWallpaperPatternContent(type: WallpaperPatternType, tile: number, color: string) {
  const t = tile

  switch (type) {
    case 'solid':
      return null
    case 'stripe-vertical':
      return <rect x={0} y={0} width={t * 0.35} height={t} fill={color} />
    case 'stripe-horizontal':
      return <rect x={0} y={0} width={t} height={t * 0.35} fill={color} />
    case 'checker':
      return (
        <>
          <rect x={0} y={0} width={t / 2} height={t / 2} fill={color} />
          <rect x={t / 2} y={t / 2} width={t / 2} height={t / 2} fill={color} />
        </>
      )
    case 'gingham':
      return (
        <>
          <rect x={0} y={0} width={t} height={t * 0.3} fill={color} opacity={0.5} />
          <rect x={0} y={0} width={t * 0.3} height={t} fill={color} opacity={0.5} />
        </>
      )
    case 'dot':
      return <circle cx={t / 2} cy={t / 2} r={t * 0.14} fill={color} />
    case 'floral':
      return (
        <g transform={`translate(${t / 2} ${t / 2})`}>
          {[0, 72, 144, 216, 288].map((deg) => (
            <ellipse key={deg} cx={0} cy={-t * 0.16} rx={t * 0.09} ry={t * 0.14} fill={color} opacity={0.85} transform={`rotate(${deg})`} />
          ))}
          <circle cx={0} cy={0} r={t * 0.06} fill={color} />
        </g>
      )
    case 'heart':
      return (
        <path
          d={`M ${t / 2} ${t * 0.34} C ${t * 0.3} ${t * 0.1}, ${t * 0.05} ${t * 0.3}, ${t / 2} ${t * 0.6} C ${t * 0.95} ${t * 0.3}, ${t * 0.7} ${t * 0.1}, ${t / 2} ${t * 0.34} Z`}
          fill={color}
        />
      )
    case 'star':
      return <path d={starPath(t / 2, t / 2, t * 0.22, t * 0.09)} fill={color} />
    case 'diamond':
      return <rect x={t * 0.28} y={t * 0.28} width={t * 0.44} height={t * 0.44} fill={color} transform={`rotate(45 ${t / 2} ${t / 2})`} />
    case 'lattice':
      return (
        <g stroke={color} strokeWidth={t * 0.045} opacity={0.8}>
          <line x1={0} y1={0} x2={t} y2={t} />
          <line x1={t} y1={0} x2={0} y2={t} />
        </g>
      )
    case 'vintage':
      return (
        <g>
          <circle cx={t / 2} cy={t / 2} r={t * 0.2} fill="none" stroke={color} strokeWidth={t * 0.03} opacity={0.7} />
          <circle cx={t / 2} cy={t / 2} r={t * 0.06} fill={color} />
          <circle cx={0} cy={0} r={t * 0.06} fill={color} opacity={0.6} />
          <circle cx={t} cy={0} r={t * 0.06} fill={color} opacity={0.6} />
          <circle cx={0} cy={t} r={t * 0.06} fill={color} opacity={0.6} />
          <circle cx={t} cy={t} r={t * 0.06} fill={color} opacity={0.6} />
        </g>
      )
    default:
      return null
  }
}
