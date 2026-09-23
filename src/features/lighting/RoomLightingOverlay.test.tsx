import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useBgmStore } from '../bgm/bgmStore'
import { useHomeStore } from '../home/homeStore'
import { Room } from '../home/Room'
import { LiveRoomView } from '../simulation/LiveRoomView'
import { getRoomLightingStyle } from './roomLightingEngine'
import { useRoomLightingSettingsStore } from './roomLightingSettingsStore'

function resetAll() {
  localStorage.clear()
  useRoomLightingSettingsStore.setState({ enabled: false, intensity: 70 })
  useBgmStore.setState({ isPlaying: false, currentBand: null, currentTrackId: null, errorMessage: null })
}

describe('RoomLightingOverlay', () => {
  beforeEach(resetAll)
  afterEach(() => cleanup())

  describe('decorate room (Room.tsx)', () => {
    it('renders no overlay at all while the setting is off (the default) — zero DOM cost, and the room shows its true colors', () => {
      const { container } = render(<Room />)
      expect(container.querySelector('.room-lighting-overlay')).toBeNull()
    })

    it('renders the overlay, styled for the current shared time band, once enabled', () => {
      useBgmStore.setState({ currentBand: 'night' })
      useRoomLightingSettingsStore.setState({ enabled: true, intensity: 100 })
      const { container } = render(<Room />)

      const overlay = container.querySelector('.room-lighting-overlay') as HTMLElement | null
      expect(overlay).not.toBeNull()
      const expected = getRoomLightingStyle('night', 100)
      expect(overlay!.style.backgroundColor).toBe(hexToRgb(expected.backgroundColor))
      expect(overlay!.style.opacity).toBe(String(expected.opacity))
      expect(overlay!.style.mixBlendMode).toBe(expected.mixBlendMode)
    })

    it('re-renders with a different style when the shared BGM time band changes, with no timer of its own', () => {
      useRoomLightingSettingsStore.setState({ enabled: true, intensity: 100 })
      useBgmStore.setState({ currentBand: 'daytime' })
      const { container, rerender } = render(<Room />)
      const daytimeOverlay = container.querySelector('.room-lighting-overlay') as HTMLElement
      expect(daytimeOverlay.style.opacity).toBe('0') // daytime's own baseOpacity is 0

      useBgmStore.setState({ currentBand: 'night' })
      rerender(<Room />)
      const nightOverlay = container.querySelector('.room-lighting-overlay') as HTMLElement
      expect(Number(nightOverlay.style.opacity)).toBeGreaterThan(0)
    })

    it('the overlay element is scoped inside the room container, not a sibling wrapping other UI', () => {
      useRoomLightingSettingsStore.setState({ enabled: true, intensity: 100 })
      const { container } = render(<Room />)
      const room = container.querySelector('.room')!
      expect(room.querySelector('.room-lighting-overlay')).not.toBeNull()
    })
  })

  describe('live room (LiveRoomView.tsx)', () => {
    beforeEach(() => {
      const room = useHomeStore.getInitialState().rooms[0]
      useHomeStore.setState({ rooms: [{ ...room, furniture: [] }], activeDecorateRoomId: room.id, activeLiveRoomId: room.id, selectedFurnitureId: null })
    })

    it('renders no overlay while off, renders one (inside .live-room) while on', () => {
      const { container, rerender } = render(<LiveRoomView />)
      expect(container.querySelector('.live-room .room-lighting-overlay')).toBeNull()

      useRoomLightingSettingsStore.setState({ enabled: true })
      rerender(<LiveRoomView />)
      expect(container.querySelector('.live-room .room-lighting-overlay')).not.toBeNull()
    })

    it('furniture click-to-select still works normally with lighting enabled — the overlay never intercepts interaction', () => {
      useHomeStore.setState((state) => ({
        rooms: state.rooms.map((r) => ({ ...r, furniture: [{ id: 'sofa-1', furnitureId: 'sofa', x: 300, y: 300, scale: 1, rotation: 0 as const, colorway: 'rose', layer: 0 }] })),
      }))
      useRoomLightingSettingsStore.setState({ enabled: true, intensity: 100 })
      useBgmStore.setState({ currentBand: 'night' })
      render(<LiveRoomView />)

      const sofaButton = screen.getByRole('button', { name: '소파 사용' })
      fireEvent.click(sofaButton)
      expect(screen.getByText('소파')).toBeInTheDocument() // FurnitureUsagePanel opened — the click reached the furniture, not the overlay
    })
  })
})

/** jsdom normalizes an inline `background-color: #rrggbb` style to `rgb(r, g, b)` when read back — this converts the expected hex the same way so the comparison is meaningful rather than always failing on format. */
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${r}, ${g}, ${b})`
}
