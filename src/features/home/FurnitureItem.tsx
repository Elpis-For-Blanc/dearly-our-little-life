import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { evictPlacementUsage } from '../simulation/furnitureUsageTrigger'
import { getFurnitureDefinition, getFurnitureSize } from './furnitureCatalog'
import { clampFurniturePlacement } from './furniturePlacementEngine'
import { FurnitureIcon } from './illustrations'
import { useHomeStore } from './homeStore'
import { ROOM_HEIGHT, ROOM_WIDTH } from './roomLayout'
import type { FurniturePlacement } from './types'
import './FurnitureItem.css'

interface FurnitureItemProps {
  placement: FurniturePlacement
}

/**
 * Renders one placed furniture item and owns its drag-to-move interaction.
 *
 * Position/size are expressed as percentages of the room (which is itself a
 * fixed-aspect-ratio box, see roomLayout.ts), so furniture scales with the
 * room instead of drifting at different viewport widths. Dragging still
 * happens in real screen pixels, so pointer movement is converted back into
 * room-logical units using the room's current rendered size.
 *
 * Dragging uses pointer capture on this element (not a document-level
 * listener) — the browser keeps delivering pointermove/up events to this
 * element even once the pointer moves outside its bounds, so a fast drag
 * never "escapes" it.
 */
export function FurnitureItem({ placement }: FurnitureItemProps) {
  const definition = getFurnitureDefinition(placement.furnitureId)
  const { width, height } = getFurnitureSize(definition, placement.variant)

  const isSelected = useHomeStore((state) => state.selectedFurnitureId === placement.id)
  const selectFurniture = useHomeStore((state) => state.selectFurniture)
  const moveFurniture = useHomeStore((state) => state.moveFurniture)

  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null)
  const dragStart = useRef<{
    pointerId: number
    clientX: number
    clientY: number
    roomScaleX: number
    roomScaleY: number
  } | null>(null)

  const x = dragPosition?.x ?? placement.x
  const y = dragPosition?.y ?? placement.y

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.stopPropagation()
    const roomRect = event.currentTarget.parentElement?.getBoundingClientRect()
    if (!roomRect) return

    // jsdom (used in tests) doesn't implement the Pointer Events capture API.
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragStart.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      // jsdom reports 0x0 rects (no real layout engine) — fall back to a 1:1 mapping.
      roomScaleX: roomRect.width > 0 ? roomRect.width / ROOM_WIDTH : 1,
      roomScaleY: roomRect.height > 0 ? roomRect.height / ROOM_HEIGHT : 1,
    }
    selectFurniture(placement.id)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = dragStart.current
    if (!start || start.pointerId !== event.pointerId) return

    const logicalDx = (event.clientX - start.clientX) / start.roomScaleX
    const logicalDy = (event.clientY - start.clientY) / start.roomScaleY
    const clamped = clampFurniturePlacement(
      definition,
      placement.x + logicalDx,
      placement.y + logicalDy,
      width * placement.scale,
      height * placement.scale,
    )
    setDragPosition(clamped)
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const start = dragStart.current
    if (!start || start.pointerId !== event.pointerId) return

    dragStart.current = null
    if (dragPosition && (dragPosition.x !== placement.x || dragPosition.y !== placement.y)) {
      // A moved piece's interaction slots move with it — evict whoever's approaching/seated on it first, so they
      // never end up walking toward (or sitting at) a now-stale position (see furnitureUsageTrigger.ts).
      evictPlacementUsage(placement.id)
      moveFurniture(placement.id, dragPosition.x, dragPosition.y)
    }
    setDragPosition(null)
  }

  const mirror = placement.rotation === 180 ? ' scaleX(-1)' : ''
  const style: CSSProperties = {
    left: `${(x / ROOM_WIDTH) * 100}%`,
    top: `${(y / ROOM_HEIGHT) * 100}%`,
    width: `${(width / ROOM_WIDTH) * 100}%`,
    height: `${(height / ROOM_HEIGHT) * 100}%`,
    transform: `translate(-50%, -50%) scale(${placement.scale})${mirror}`,
    zIndex: placement.layer,
  }

  return (
    <div
      className={isSelected ? 'furniture-item furniture-item-selected' : 'furniture-item'}
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
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
}
