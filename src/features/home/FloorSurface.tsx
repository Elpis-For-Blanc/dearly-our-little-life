import { useId } from 'react'
import { getFloorPatternContent } from './patterns/floorPatterns'
import { FLOOR_HEIGHT_RATIO, ROOM_HEIGHT, ROOM_WIDTH } from './roomLayout'
import type { FloorSettings } from './roomSurface'

const BASE_TILE = 48

interface FloorSurfaceProps {
  settings: FloorSettings
}

/** Same tiled-SVG-pattern approach as WallSurface, sized to the floor's own true pixel span so tile size reads consistently between wall and floor. */
export function FloorSurface({ settings }: FloorSurfaceProps) {
  const patternId = useId()
  const tile = BASE_TILE * settings.patternScale
  const floorHeight = ROOM_HEIGHT * FLOOR_HEIGHT_RATIO

  return (
    <svg className="room-floor-svg" viewBox={`0 0 ${ROOM_WIDTH} ${floorHeight}`} width="100%" height="100%" role="img" aria-label="바닥">
      <defs>
        <pattern
          id={patternId}
          patternUnits="userSpaceOnUse"
          width={tile}
          height={tile}
          patternTransform={`rotate(${settings.orientation} ${tile / 2} ${tile / 2})`}
        >
          <rect width={tile} height={tile} fill={settings.baseColor} />
          {getFloorPatternContent(settings.pattern, tile, settings.patternColor)}
        </pattern>
      </defs>
      <rect className="surface-fill" x={0} y={0} width={ROOM_WIDTH} height={floorHeight} fill={`url(#${patternId})`} />
    </svg>
  )
}
