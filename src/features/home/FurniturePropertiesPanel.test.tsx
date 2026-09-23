import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FurniturePropertiesPanel } from './FurniturePropertiesPanel'
import { getActiveDecorateRoom, useHomeStore } from './homeStore'
import type { FurniturePlacement } from './types'

const placement = { id: '1', furnitureId: 'sofa', x: 100, y: 80, scale: 1, rotation: 0 as const, colorway: 'rose', layer: 0 }

function setActiveRoomFurniture(furniture: FurniturePlacement[]) {
  const roomId = useHomeStore.getState().activeDecorateRoomId
  useHomeStore.setState((state) => ({
    rooms: state.rooms.map((room) => (room.id === roomId ? { ...room, furniture } : room)),
  }))
}

function activeFurniture() {
  return getActiveDecorateRoom(useHomeStore.getState()).furniture
}

describe('FurniturePropertiesPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    setActiveRoomFurniture([placement])
    useHomeStore.setState({ selectedFurnitureId: null })
  })

  afterEach(() => {
    cleanup()
  })

  it('shows a hint instead of an editor when nothing is selected', () => {
    render(<FurniturePropertiesPanel />)
    expect(screen.getByText('가구를 선택하면 편집할 수 있어요.')).toBeInTheDocument()
  })

  it('shows the editor for the selected furniture', () => {
    useHomeStore.setState({ selectedFurnitureId: '1' })
    render(<FurniturePropertiesPanel />)
    expect(screen.getByRole('heading', { name: '소파' })).toBeInTheDocument()
  })

  it('updates X/Y through the number inputs, clamped to the room', async () => {
    useHomeStore.setState({ selectedFurnitureId: '1' })
    const user = userEvent.setup()
    render(<FurniturePropertiesPanel />)

    const xInput = screen.getByLabelText('X 좌표')
    await user.clear(xInput)
    await user.type(xInput, '5000')
    await user.tab()

    // clamped to the room's right edge minus half the (scaled) furniture width
    expect(activeFurniture()[0].x).toBeLessThan(720)
  })

  it('changes the colorway when a swatch is clicked', async () => {
    useHomeStore.setState({ selectedFurnitureId: '1' })
    const user = userEvent.setup()
    render(<FurniturePropertiesPanel />)

    await user.click(screen.getByRole('button', { name: '크림 베이지' }))

    expect(activeFurniture()[0].colorway).toBe('cream')
  })

  it('toggles the mirror flag with the direction button', async () => {
    useHomeStore.setState({ selectedFurnitureId: '1' })
    const user = userEvent.setup()
    render(<FurniturePropertiesPanel />)

    await user.click(screen.getByRole('button', { name: '기본 방향' }))
    expect(activeFurniture()[0].rotation).toBe(180)
  })

  it('sends to back and brings to front', async () => {
    setActiveRoomFurniture([
      placement,
      { id: '2', furnitureId: 'table', x: 0, y: 0, scale: 1, rotation: 0, colorway: 'natural', layer: 1 },
    ])
    useHomeStore.setState({ selectedFurnitureId: '1' })
    const user = userEvent.setup()
    render(<FurniturePropertiesPanel />)

    await user.click(screen.getByRole('button', { name: '앞으로' }))
    expect(activeFurniture()[0].layer).toBeGreaterThan(activeFurniture()[1].layer)

    await user.click(screen.getByRole('button', { name: '뒤로' }))
    expect(activeFurniture()[0].layer).toBeLessThan(activeFurniture()[1].layer)
  })

  it('deletes the furniture and clears the selection', async () => {
    useHomeStore.setState({ selectedFurnitureId: '1' })
    const user = userEvent.setup()
    render(<FurniturePropertiesPanel />)

    await user.click(screen.getByRole('button', { name: '삭제' }))

    expect(activeFurniture()).toHaveLength(0)
    expect(useHomeStore.getState().selectedFurnitureId).toBeNull()
  })

  it('exposes the exact same X/Y/size/direction/layer/delete editor for a rug placement as for regular furniture', async () => {
    const rug = { id: 'rug-1', furnitureId: 'rug', x: 300, y: 365, scale: 1, rotation: 0 as const, colorway: 'blush', layer: -1 }
    setActiveRoomFurniture([rug])
    useHomeStore.setState({ selectedFurnitureId: 'rug-1' })
    const user = userEvent.setup()
    render(<FurniturePropertiesPanel />)

    expect(screen.getByRole('heading', { name: '러그' })).toBeInTheDocument()
    expect(screen.getByLabelText('X 좌표')).toBeInTheDocument()
    expect(screen.getByLabelText('Y 좌표')).toBeInTheDocument()
    expect(screen.getByText(/크기 \(/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '기본 방향' }))
    expect(activeFurniture()[0].rotation).toBe(180)

    await user.click(screen.getByRole('button', { name: '삭제' }))
    expect(activeFurniture()).toHaveLength(0)
  })

  it('immediately reflects a changed X/Y coordinate for a window placement (no separate "apply" step)', () => {
    const win = { id: 'win-1', furnitureId: 'window', x: 360, y: 95, scale: 1, rotation: 0 as const, colorway: 'cream', layer: -2 }
    setActiveRoomFurniture([win])
    useHomeStore.setState({ selectedFurnitureId: 'win-1' })
    render(<FurniturePropertiesPanel />)

    fireEvent.change(screen.getByLabelText('X 좌표'), { target: { value: '250' } })

    expect(activeFurniture()[0].x).toBe(250)
  })
})
