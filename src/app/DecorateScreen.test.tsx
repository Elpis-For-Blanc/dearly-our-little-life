import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DecorateScreen } from './DecorateScreen'
import { getActiveDecorateRoom, useHomeStore } from '../features/home/homeStore'

const placement = { id: '1', furnitureId: 'sofa', x: 100, y: 80, scale: 1, rotation: 0 as const, colorway: 'rose', layer: 0 }

function activeFurniture() {
  return getActiveDecorateRoom(useHomeStore.getState()).furniture
}

describe('DecorateScreen keyboard delete', () => {
  beforeEach(() => {
    localStorage.clear()
    const roomId = useHomeStore.getState().activeDecorateRoomId
    useHomeStore.setState((state) => ({
      rooms: state.rooms.map((room) => (room.id === roomId ? { ...room, furniture: [placement] } : room)),
      selectedFurnitureId: '1',
    }))
  })

  afterEach(() => {
    cleanup()
  })

  it('deletes the selected furniture when Delete is pressed', async () => {
    const user = userEvent.setup()
    render(<DecorateScreen />)

    await user.keyboard('{Delete}')

    expect(activeFurniture()).toHaveLength(0)
  })

  it('does nothing when Delete is pressed with no selection', async () => {
    useHomeStore.setState({ selectedFurnitureId: null })
    const user = userEvent.setup()
    render(<DecorateScreen />)

    await user.keyboard('{Delete}')

    expect(activeFurniture()).toHaveLength(1)
  })

  it('does not delete while a text input has focus', async () => {
    const user = userEvent.setup()
    render(<DecorateScreen />)

    await user.click(screen.getByLabelText('X 좌표'))
    await user.keyboard('{Delete}')

    expect(activeFurniture()).toHaveLength(1)
  })
})
