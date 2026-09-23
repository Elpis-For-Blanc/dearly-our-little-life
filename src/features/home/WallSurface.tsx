import { useId } from 'react'
import { getWallpaperPatternContent } from './patterns/wallpaperPatterns'
import { ROOM_HEIGHT, ROOM_WIDTH } from './roomLayout'
import type { WallpaperSettings } from './roomSurface'

const BASE_TILE = 48

interface WallSurfaceProps {
  settings: WallpaperSettings
}

/**
 * Renders the wallpaper as a tiled SVG pattern in the same ROOM_WIDTH/
 * ROOM_HEIGHT logical unit space every other room element uses, so it
 * scales in lockstep with furniture and never distorts independently at
 * different render sizes.
 */
export function WallSurface({ settings }: WallSurfaceProps) {
  const patternId = useId()
  const tile = BASE_TILE * settings.patternScale

  return (
    <svg className="room-wall-svg" viewBox={`0 0 ${ROOM_WIDTH} ${ROOM_HEIGHT}`} width="100%" height="100%" role="img" aria-label="벽지">
      <defs>
        <pattern id={patternId} patternUnits="userSpaceOnUse" width={tile} height={tile}>
          <rect width={tile} height={tile} fill={settings.baseColor} />
          {getWallpaperPatternContent(settings.pattern, tile, settings.patternColor)}
        </pattern>
      </defs>
      <rect className="surface-fill" x={0} y={0} width={ROOM_WIDTH} height={ROOM_HEIGHT} fill={`url(#${patternId})`} />
    </svg>
  )
}
