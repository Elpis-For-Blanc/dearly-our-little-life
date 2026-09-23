import { useState, type CSSProperties } from 'react'
import { useCharacterStore } from '../character/characterStore'
import { FloorSurface } from '../home/FloorSurface'
import { getFurnitureDefinition, getFurnitureSize } from '../home/furnitureCatalog'
import { getActiveLiveRoom, useHomeStore } from '../home/homeStore'
import { FurnitureIcon } from '../home/illustrations'
import { FLOOR_HEIGHT_RATIO, ROOM_HEIGHT, ROOM_WIDTH } from '../home/roomLayout'
import type { FurniturePlacement } from '../home/types'
import { WallSurface } from '../home/WallSurface'
import { RoomLightingOverlay } from '../lighting/RoomLightingOverlay'
import { useCharacterMovementStore } from './characterMovementStore'
import { CharacterToken } from './CharacterToken'
import { isInteractableFurniture } from './furnitureInteractionEngine'
import { FurnitureUsagePanel } from './FurnitureUsagePanel'
import './LiveRoomView.css'

/**
 * A read-only view of the decorated room for the Live screen: same wall,
 * floor, and furniture rendering as the decorate phase's `Room.tsx`, minus
 * drag/select interaction (furniture here is fixed dressing, not editable,
 * except for the small "click a sittable piece to use it" affordance added
 * for furniture interaction — see below), plus each registered character's
 * live position from `characterMovementStore` on top. "Usable" now covers
 * any interaction kind (sit/lie/stand — sofa/chair, bed, table), not just
 * sitting; see `isInteractableFurniture`.
 *
 * Characters are filtered to only those currently in this room
 * (`characterMovementStore`'s `roomId`, not `activeDecorateRoomId`) — the
 * core "you can't see a character until you go looking for them" rule
 * (spec §6): a character who has moved to another room simply doesn't
 * render here, and nothing about this component tries to point the user
 * at where they went.
 */
export function LiveRoomView() {
  const activeRoom = useHomeStore(getActiveLiveRoom)
  const { furniture, wallpaper, floor } = activeRoom
  const activeRoomId = activeRoom.id
  const characters = useCharacterStore((state) => state.characters)
  const movementById = useCharacterMovementStore((state) => state.byId)
  const visibleCharacters = characters.filter((character) => movementById[character.id]?.roomId === activeRoomId)

  // Selecting a piece of usable furniture (currently: anything with a 'sit' slot) is Live-only state — entirely
  // separate from homeStore's decorate-only `selectedFurnitureId` (that one's read-side is documented as
  // "meaningful only for activeDecorateRoomId"; reusing it here would let a Live selection bleed into the decorate
  // screen's properties panel, or vice versa). Cleared whenever the observed room changes, so a stale selection can
  // never point at furniture the user isn't even looking at anymore.
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null)
  const selectedInThisRoom = selectedFurnitureId && furniture.some((f) => f.id === selectedFurnitureId) ? selectedFurnitureId : null

  const roomStyle = {
    aspectRatio: `${ROOM_WIDTH} / ${ROOM_HEIGHT}`,
    '--floor-height': `${FLOOR_HEIGHT_RATIO * 100}%`,
  } as CSSProperties

  return (
    <>
      <div className="live-room" style={roomStyle}>
        <div className="live-room-wall">
          <WallSurface settings={wallpaper} />
        </div>
        <div className="live-room-floor">
          <FloorSurface settings={floor} />
        </div>
        <div className="live-room-baseboard" />

        <div className="live-room-surface">
          {furniture.map((placement: FurniturePlacement) => {
            const definition = getFurnitureDefinition(placement.furnitureId)
            const { width, height } = getFurnitureSize(definition, placement.variant)
            const mirror = placement.rotation === 180 ? ' scaleX(-1)' : ''
            const usable = isInteractableFurniture(placement.furnitureId)
            const style: CSSProperties = {
              left: `${(placement.x / ROOM_WIDTH) * 100}%`,
              top: `${(placement.y / ROOM_HEIGHT) * 100}%`,
              width: `${(width / ROOM_WIDTH) * 100}%`,
              height: `${(height / ROOM_HEIGHT) * 100}%`,
              transform: `translate(-50%, -50%) scale(${placement.scale})${mirror}`,
              zIndex: placement.layer,
            }
            const className =
              'live-room-furniture' +
              (usable ? ' live-room-furniture-usable' : '') +
              (selectedInThisRoom === placement.id ? ' live-room-furniture-selected' : '')
            return (
              <div
                key={placement.id}
                className={className}
                style={style}
                role={usable ? 'button' : undefined}
                tabIndex={usable ? 0 : undefined}
                aria-label={usable ? `${definition?.name ?? placement.furnitureId} 사용` : undefined}
                onClick={usable ? () => setSelectedFurnitureId((current) => (current === placement.id ? null : placement.id)) : undefined}
                onKeyDown={
                  usable
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelectedFurnitureId((current) => (current === placement.id ? null : placement.id))
                        }
                      }
                    : undefined
                }
              >
                <FurnitureIcon
                  furnitureId={placement.furnitureId}
                  width={width}
                  height={height}
                  colorway={placement.colorway}
                  variant={placement.variant}
                  colors={placement.colors}
                  patterns={placement.patterns}
                />
              </div>
            )
          })}

          {visibleCharacters.map((character) => (
            <CharacterToken key={character.id} character={character} />
          ))}
        </div>
        <RoomLightingOverlay />
      </div>

      {selectedInThisRoom && (
        <FurnitureUsagePanel roomId={activeRoomId} placementId={selectedInThisRoom} onClose={() => setSelectedFurnitureId(null)} />
      )}
    </>
  )
}
