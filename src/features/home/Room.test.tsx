import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Room } from './Room'
import { useHomeStore } from './homeStore'
import { DEFAULT_FLOOR, DEFAULT_WALLPAPER, type FloorSettings, type WallpaperSettings } from './roomSurface'
import type { FurniturePlacement } from './types'

function setActiveRoom(patch: Partial<{ furniture: FurniturePlacement[]; wallpaper: WallpaperSettings; floor: FloorSettings }>) {
  const roomId = useHomeStore.getState().activeDecorateRoomId
  useHomeStore.setState((state) => ({
    rooms: state.rooms.map((room) => (room.id === roomId ? { ...room, ...patch } : room)),
  }))
}

describe('Room', () => {
  beforeEach(() => {
    localStorage.clear()
    setActiveRoom({ furniture: [], wallpaper: DEFAULT_WALLPAPER, floor: DEFAULT_FLOOR })
    useHomeStore.setState({ selectedFurnitureId: null })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the wall and floor as SVG surfaces reflecting the current wallpaper/floor settings', () => {
    setActiveRoom({
      wallpaper: { baseColor: '#ffd9e6', pattern: 'dot', patternColor: '#f7c6d9', patternScale: 1 },
      floor: { baseColor: '#efe3d0', pattern: 'marble', patternColor: '#d8c3a5', patternScale: 1, orientation: 0 },
    })
    render(<Room />)

    const wallSvg = screen.getByRole('img', { name: '벽지' })
    const floorSvg = screen.getByRole('img', { name: '바닥' })
    expect(wallSvg.querySelector('.surface-fill')).toHaveAttribute('fill', expect.stringContaining('url(#'))
    expect(floorSvg.querySelector('.surface-fill')).toHaveAttribute('fill', expect.stringContaining('url(#'))
    // The pattern tile itself is filled with the chosen base color.
    expect(wallSvg.querySelector('pattern rect')).toHaveAttribute('fill', '#ffd9e6')
    expect(floorSvg.querySelector('pattern rect')).toHaveAttribute('fill', '#efe3d0')
  })

  it('updates the wall pattern immediately when wallpaper settings change', () => {
    const { rerender } = render(<Room />)
    let wallSvg = screen.getByRole('img', { name: '벽지' })
    expect(wallSvg.querySelector('pattern')?.children).toHaveLength(1) // just the base rect for 'solid'

    useHomeStore.getState().setWallpaper({ pattern: 'star' })
    rerender(<Room />)

    wallSvg = screen.getByRole('img', { name: '벽지' })
    expect(wallSvg.querySelector('pattern')?.children.length ?? 0).toBeGreaterThan(1)
  })
})
