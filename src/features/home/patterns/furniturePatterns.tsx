import { PATTERN_TILE_UNITS, type PatternSetting } from '../furnitureStyle'
import { getWallpaperPatternContent } from './wallpaperPatterns'

/** Motif drawn on top of the tile's background rect, in tile-local units [0, t]. Motifs the wallpaper system already draws are reused as-is; only the furniture-specific ones live here. */
function motif(setting: PatternSetting, t: number) {
  const { type, color, baseColor } = setting
  switch (type) {
    case 'dot-small':
      return <circle cx={t / 2} cy={t / 2} r={t * 0.16} fill={color} />
    case 'dot-large':
      return <circle cx={t / 2} cy={t / 2} r={t * 0.22} fill={color} />
    case 'stripe-vertical':
    case 'stripe-horizontal':
    case 'gingham':
    case 'floral':
    case 'heart':
    case 'star':
      return getWallpaperPatternContent(type, t, color)
    case 'tartan':
      return (
        <>
          <rect x={0} y={t * 0.15} width={t} height={t * 0.25} fill={color} opacity={0.45} />
          <rect x={0} y={t * 0.62} width={t} height={t * 0.08} fill={color} opacity={0.85} />
          <rect x={t * 0.15} y={0} width={t * 0.25} height={t} fill={color} opacity={0.45} />
          <rect x={t * 0.62} y={0} width={t * 0.08} height={t} fill={color} opacity={0.85} />
        </>
      )
    case 'rose':
      return (
        <>
          <circle cx={t / 2} cy={t * 0.46} r={t * 0.27} fill={color} />
          <circle cx={t / 2} cy={t * 0.46} r={t * 0.19} fill="none" stroke={baseColor} strokeWidth={t * 0.035} />
          <circle cx={t / 2} cy={t * 0.46} r={t * 0.1} fill="none" stroke={baseColor} strokeWidth={t * 0.035} />
          <ellipse cx={t * 0.24} cy={t * 0.84} rx={t * 0.1} ry={t * 0.05} fill={color} opacity={0.6} transform={`rotate(-25 ${t * 0.24} ${t * 0.84})`} />
          <ellipse cx={t * 0.76} cy={t * 0.84} rx={t * 0.1} ry={t * 0.05} fill={color} opacity={0.6} transform={`rotate(25 ${t * 0.76} ${t * 0.84})`} />
        </>
      )
    case 'ribbon':
      return (
        <>
          <path d={`M ${t / 2} ${t / 2} L ${t * 0.16} ${t * 0.28} L ${t * 0.16} ${t * 0.72} Z`} fill={color} />
          <path d={`M ${t / 2} ${t / 2} L ${t * 0.84} ${t * 0.28} L ${t * 0.84} ${t * 0.72} Z`} fill={color} />
          <circle cx={t / 2} cy={t / 2} r={t * 0.08} fill={color} stroke={baseColor} strokeWidth={t * 0.03} />
        </>
      )
  }
}

/**
 * One tiled `<pattern>` for a furniture surface. Rendered inside the owning
 * illustration's own <svg>, and its `id` always carries that piece's unique
 * prefix, so two sofas (or a catalog preview and a placed sofa) never share
 * or collide on a pattern id. Dots scale the tile itself so 작은/큰 도트 differ
 * on top of the 3 size steps every pattern has.
 */
export function FurniturePatternDef({ id, setting, tileScale = 1 }: { id: string; setting: PatternSetting; tileScale?: number }) {
  const base = PATTERN_TILE_UNITS[setting.size] * tileScale
  const tile = setting.type === 'dot-small' ? base * 0.75 : setting.type === 'dot-large' ? base * 1.5 : base
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width={tile} height={tile}>
      <rect x={0} y={0} width={tile} height={tile} fill={setting.baseColor} />
      {motif(setting, tile)}
    </pattern>
  )
}
