import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { FurnitureItem } from './FurnitureItem'
import { getActiveDecorateRoom, useHomeStore } from './homeStore'

const placement = { id: '1', furnitureId: 'sofa', x: 100, y: 100, scale: 1, rotation: 0 as const, colorway: 'rose', layer: 0 }

function getItemElement() {
  const item = screen.getByRole('img', { name: '소파' }).closest('.furniture-item')
  if (!item) throw new Error('furniture item not found')
  return item
}

function activeFurniture() {
  return getActiveDecorateRoom(useHomeStore.getState()).furniture
}

describe('FurnitureItem', () => {
  beforeEach(() => {
    localStorage.clear()
    const roomId = useHomeStore.getState().activeDecorateRoomId
    useHomeStore.setState((state) => ({
      rooms: state.rooms.map((room) => (room.id === roomId ? { ...room, furniture: [placement] } : room)),
      selectedFurnitureId: null,
    }))
  })

  afterEach(() => {
    cleanup()
  })

  it('selects itself on pointer down', () => {
    render(<FurnitureItem placement={placement} />)
    fireEvent.pointerDown(getItemElement(), { pointerId: 1, clientX: 10, clientY: 10 })

    expect(useHomeStore.getState().selectedFurnitureId).toBe('1')
  })

  it('commits a moved position on pointer up after dragging', () => {
    render(<FurnitureItem placement={placement} />)
    const item = getItemElement()

    fireEvent.pointerDown(item, { pointerId: 1, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(item, { pointerId: 1, clientX: 40, clientY: 25 })
    fireEvent.pointerUp(item, { pointerId: 1, clientX: 40, clientY: 25 })

    const moved = activeFurniture()[0]
    expect(moved.x).toBe(130)
    // y is raised from the raw dragged-to 115 to the sofa's own floor-grounding minimum (224.8 = max(96/2,
    // FLOOR_SURFACE_TOP_Y - 96/2), see furniturePlacementEngine.ts) rather than staying at 115 — a solid floor
    // piece's bottom edge must land on the floor's own visual surface, or it renders as if floating against the
    // wall (the room-decor-preset bug this shared clamp was introduced to fix, now applied to manual drag too).
    expect(moved.y).toBe(224.8)
  })

  it('does not call moveFurniture when there was no movement', () => {
    render(<FurnitureItem placement={placement} />)
    const item = getItemElement()

    fireEvent.pointerDown(item, { pointerId: 1, clientX: 10, clientY: 10 })
    fireEvent.pointerUp(item, { pointerId: 1, clientX: 10, clientY: 10 })

    const unchanged = activeFurniture()[0]
    expect(unchanged.x).toBe(placement.x)
    expect(unchanged.y).toBe(placement.y)
  })
})
