import type { CSSProperties } from 'react'
import { RoomLightingOverlay } from '../lighting/RoomLightingOverlay'
import { FloorSurface } from './FloorSurface'
import { FurnitureItem } from './FurnitureItem'
import { getActiveDecorateRoom, useHomeStore } from './homeStore'
import { FLOOR_HEIGHT_RATIO, ROOM_HEIGHT, ROOM_WIDTH } from './roomLayout'
import { WallSurface } from './WallSurface'
import './Room.css'

export function Room() {
  const furniture = useHomeStore((state) => getActiveDecorateRoom(state).furniture)
  const wallpaper = useHomeStore((state) => getActiveDecorateRoom(state).wallpaper)
  const floor = useHomeStore((state) => getActiveDecorateRoom(state).floor)
  const selectFurniture = useHomeStore((state) => state.selectFurniture)

  const style = {
    aspectRatio: `${ROOM_WIDTH} / ${ROOM_HEIGHT}`,
    '--floor-height': `${FLOOR_HEIGHT_RATIO * 100}%`,
  } as CSSProperties

  return (
    <div className="room" style={style} onPointerDown={() => selectFurniture(null)}>
      <div className="room-wall">
        <WallSurface settings={wallpaper} />
      </div>
      <div className="room-corner-shade room-corner-shade-left" />
      <div className="room-corner-shade room-corner-shade-right" />
      <div className="room-floor">
        <FloorSurface settings={floor} />
      </div>
      <div className="room-baseboard" />

      <div className="room-surface">
        {furniture.map((placement) => (
          <FurnitureItem key={placement.id} placement={placement} />
        ))}
      </div>
      <RoomLightingOverlay />
    </div>
  )
}
