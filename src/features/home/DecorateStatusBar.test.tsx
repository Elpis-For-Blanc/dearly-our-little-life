import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { DecorateStatusBar } from './DecorateStatusBar'
import { useHomeStore } from './homeStore'
import type { FurniturePlacement } from './types'

const placement = { id: '1', furnitureId: 'sofa', x: 0, y: 0, scale: 1, rotation: 0 as const, colorway: 'rose', layer: 0 }

function setActiveRoomFurniture(furniture: FurniturePlacement[]) {
  const roomId = useHomeStore.getState().activeDecorateRoomId
  useHomeStore.setState((state) => ({
    rooms: state.rooms.map((room) => (room.id === roomId ? { ...room, furniture } : room)),
  }))
}

describe('DecorateStatusBar', () => {
  beforeEach(() => {
    localStorage.clear()
    setActiveRoomFurniture([])
    useHomeStore.setState({ selectedFurnitureId: null })
  })

  afterEach(() => {
    cleanup()
  })

  it('shows the active room name, furniture count, and a saved indicator', () => {
    setActiveRoomFurniture([placement])
    render(<DecorateStatusBar />)

    const roomName = useHomeStore.getState().rooms.find((r) => r.id === useHomeStore.getState().activeDecorateRoomId)!.name
    expect(screen.getByText(roomName)).toBeInTheDocument()
    expect(screen.getByText('가구 1개')).toBeInTheDocument()
    expect(screen.getByText('자동 저장됨')).toBeInTheDocument()
  })
})
