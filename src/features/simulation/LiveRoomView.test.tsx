import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { LiveRoomView } from './LiveRoomView'
import { useCharacterStore } from '../character/characterStore'
import { EMPTY_AI_PROFILE, type Character } from '../character/types'
import { useCharacterMovementStore } from './characterMovementStore'
import { useHomeStore } from '../home/homeStore'
import { getDefaultColorway } from '../home/colorways'

function makeCharacter(id: string, name: string): Character {
  return {
    id,
    name,
    imageDataUrl: 'data:image/png;base64,',
    displayScale: 1, footOffsetRatio: 0, imageBounds: null,
    traits: { personality: '', favoriteColor: '' },
    aiProfile: EMPTY_AI_PROFILE,
  }
}

describe('LiveRoomView', () => {
  beforeEach(() => {
    const roomId = useHomeStore.getState().activeLiveRoomId
    useHomeStore.setState((state) => ({
      rooms: state.rooms.map((room) =>
        room.id === roomId
          ? { ...room, furniture: [{ id: 'f1', furnitureId: 'sofa', x: 200, y: 320, scale: 1, rotation: 0 as const, colorway: getDefaultColorway('sofa'), layer: 0 }] }
          : room,
      ),
    }))
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders 5 characters simultaneously (alongside existing furniture) without error', () => {
    const characters = Array.from({ length: 5 }, (_, i) => makeCharacter(String(i), `Char${i}`))
    const roomId = useHomeStore.getState().activeLiveRoomId
    useCharacterStore.setState({ characters })
    useCharacterMovementStore.setState({
      byId: Object.fromEntries(
        characters.map((c, i) => [
          c.id,
          {
            id: c.id,
            roomId,
            x: 100 + i * 40,
            y: 300,
            destination: null,
            destinationRoomId: null,
            currentBehavior: null,
            status: 'idle' as const,
            restTicksRemaining: 0,
            stuckTicks: 0,
          },
        ]),
      ),
    })

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(<LiveRoomView />)

    expect(container.querySelectorAll('.character-token')).toHaveLength(5)
    expect(container.querySelector('.live-room-furniture')).not.toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('does not render a character who is currently in a different room', () => {
    const characters = [makeCharacter('a', 'Milo'), makeCharacter('b', 'Luna')]
    const activeRoomId = useHomeStore.getState().activeLiveRoomId
    const otherRoomId = useHomeStore.getState().addRoom('bedroom', '침실', 'empty')
    useCharacterStore.setState({ characters })
    useCharacterMovementStore.setState({
      byId: {
        a: { id: 'a', roomId: activeRoomId, x: 100, y: 300, destination: null, destinationRoomId: null, currentBehavior: null, status: 'idle', restTicksRemaining: 0, stuckTicks: 0 },
        b: { id: 'b', roomId: otherRoomId, x: 100, y: 300, destination: null, destinationRoomId: null, currentBehavior: null, status: 'idle', restTicksRemaining: 0, stuckTicks: 0 },
      },
    })

    const { container } = render(<LiveRoomView />)

    expect(container.querySelectorAll('.character-token')).toHaveLength(1)
  })
})
