import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WallpaperEditor } from './WallpaperEditor'
import { getActiveDecorateRoom, useHomeStore } from './homeStore'
import { DEFAULT_WALLPAPER, type WallpaperSettings } from './roomSurface'

function setActiveRoomWallpaper(wallpaper: WallpaperSettings) {
  const roomId = useHomeStore.getState().activeDecorateRoomId
  useHomeStore.setState((state) => ({
    rooms: state.rooms.map((room) => (room.id === roomId ? { ...room, wallpaper } : room)),
  }))
}

function activeWallpaper() {
  return getActiveDecorateRoom(useHomeStore.getState()).wallpaper
}

describe('WallpaperEditor', () => {
  beforeEach(() => {
    localStorage.clear()
    setActiveRoomWallpaper(DEFAULT_WALLPAPER)
  })

  afterEach(() => {
    cleanup()
  })

  it('applies a preset color immediately', async () => {
    const user = userEvent.setup()
    render(<WallpaperEditor />)

    await user.click(screen.getByRole('button', { name: '라벤더' }))

    expect(activeWallpaper().baseColor.toLowerCase()).toBe('#ded2f2')
  })

  it('offers the shared dark palette for both wall and pattern colors', async () => {
    const user = userEvent.setup()
    render(<WallpaperEditor />)

    await user.click(screen.getByRole('button', { name: '벽 색상 소프트 블랙' }))
    expect(activeWallpaper().baseColor.toLowerCase()).toBe('#292929')

    await user.click(screen.getByRole('button', { name: '도트' }))
    await user.click(screen.getByRole('button', { name: '벽 무늬 색상 네이비' }))
    expect(activeWallpaper().patternColor.toLowerCase()).toBe('#263653')
  })

  it('does not show pattern-color/scale controls for the solid pattern, but does for others', async () => {
    const user = userEvent.setup()
    render(<WallpaperEditor />)

    expect(screen.queryByText(/패턴 크기/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '도트' }))

    expect(activeWallpaper().pattern).toBe('dot')
    expect(screen.getByText(/패턴 크기/)).toBeInTheDocument()
  })

  it('adjusts pattern scale via the slider and applies immediately', () => {
    setActiveRoomWallpaper({ ...DEFAULT_WALLPAPER, pattern: 'heart' })
    render(<WallpaperEditor />)

    fireEvent.change(screen.getByLabelText(/패턴 크기/), { target: { value: '1.5' } })

    expect(activeWallpaper().patternScale).toBe(1.5)
  })
})
