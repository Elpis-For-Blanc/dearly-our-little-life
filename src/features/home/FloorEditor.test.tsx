import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FloorEditor } from './FloorEditor'
import { getActiveDecorateRoom, useHomeStore } from './homeStore'
import { DEFAULT_FLOOR, type FloorSettings } from './roomSurface'

function setActiveRoomFloor(floor: FloorSettings) {
  const roomId = useHomeStore.getState().activeDecorateRoomId
  useHomeStore.setState((state) => ({
    rooms: state.rooms.map((room) => (room.id === roomId ? { ...room, floor } : room)),
  }))
}

function activeFloor() {
  return getActiveDecorateRoom(useHomeStore.getState()).floor
}

describe('FloorEditor', () => {
  beforeEach(() => {
    localStorage.clear()
    setActiveRoomFloor(DEFAULT_FLOOR)
  })

  afterEach(() => {
    cleanup()
  })

  it('applies a preset base color immediately (the first "베이지" swatch — base color, not pattern color)', async () => {
    const user = userEvent.setup()
    render(<FloorEditor />)

    await user.click(screen.getAllByRole('button', { name: '베이지' })[0])

    expect(activeFloor().baseColor.toLowerCase()).toBe('#efe3d0')
  })

  it('offers the shared dark palette for both floor and pattern colors', async () => {
    const user = userEvent.setup()
    render(<FloorEditor />)

    await user.click(screen.getByRole('button', { name: '바닥 색상 차콜' }))
    expect(activeFloor().baseColor.toLowerCase()).toBe('#41434a')

    await user.click(screen.getByRole('button', { name: /헤링본/ }))
    await user.click(screen.getByRole('button', { name: '바닥 무늬 색상 와인' }))
    expect(activeFloor().patternColor.toLowerCase()).toBe('#702c42')
  })

  it('switches floor pattern by clicking a pattern swatch', async () => {
    const user = userEvent.setup()
    render(<FloorEditor />)

    await user.click(screen.getByRole('button', { name: /헤링본/ }))

    expect(activeFloor().pattern).toBe('herringbone')
    expect(screen.getByText(/패턴 방향/)).toBeInTheDocument()
  })

  it('adjusts pattern orientation via its slider', () => {
    setActiveRoomFloor({ ...DEFAULT_FLOOR, pattern: 'tile-square' })
    render(<FloorEditor />)

    fireEvent.change(screen.getByLabelText(/패턴 방향/), { target: { value: '90' } })

    expect(activeFloor().orientation).toBe(90)
  })

  it('hides pattern controls for the solid pattern', () => {
    setActiveRoomFloor({ ...DEFAULT_FLOOR, pattern: 'solid' })
    render(<FloorEditor />)
    expect(screen.queryByText(/패턴 방향/)).not.toBeInTheDocument()
  })
})
