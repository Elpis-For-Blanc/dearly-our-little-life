import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CharacterToken } from './CharacterToken'
import { useCharacterMovementStore } from './characterMovementStore'
import { ROOM_HEIGHT, ROOM_WIDTH } from '../home/roomLayout'
import { EMPTY_AI_PROFILE, type Character } from '../character/types'
import { BASE_CHARACTER_HEIGHT } from './characterRenderConfig'
import { useDialogueStore } from '../dialogue/dialogueStore'

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'a',
    name: 'Milo',
    imageDataUrl: 'data:image/png;base64,fakepngdata',
    displayScale: 1, footOffsetRatio: 0, imageBounds: null,
    traits: { personality: '', favoriteColor: '' },
    aiProfile: EMPTY_AI_PROFILE,
    ...overrides,
  }
}

describe('CharacterToken', () => {
  beforeEach(() => {
    useCharacterMovementStore.setState({
      byId: {
        a: {
          id: 'a',
          roomId: 'room-1',
          x: 360,
          y: 300,
          destination: null,
          destinationRoomId: null,
          currentBehavior: null,
          status: 'idle',
          restTicksRemaining: 0,
          stuckTicks: 0,
        },
      },
    })
    useDialogueStore.setState({ activeBubbleByCharacter: {} })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the uploaded PNG as a plain <img>, with no circular mask or crop class applied', () => {
    // alt="" is intentional (a decorative sprite) and correctly maps to ARIA role "presentation", not "img" — query by tag instead.
    const { container } = render(<CharacterToken character={makeCharacter()} />)

    const img = container.querySelector('img') as HTMLImageElement
    expect(img).toHaveAttribute('src', 'data:image/png;base64,fakepngdata')
    expect(img.className).not.toMatch(/avatar|circle|round/i)
    expect(img).toHaveClass('character-token-sprite')
  })

  it('applies the base 120-logical-unit display height at displayScale 1, expressed as a percentage of room height (not a fixed pixel value)', () => {
    const { container } = render(<CharacterToken character={makeCharacter({ displayScale: 1 })} />)

    const img = container.querySelector('img') as HTMLImageElement
    const expectedPercent = (BASE_CHARACTER_HEIGHT / ROOM_HEIGHT) * 100
    expect(img.style.height).toBe(`${expectedPercent}%`)
  })

  it('scales the display height with the character\'s own displayScale', () => {
    const { container } = render(<CharacterToken character={makeCharacter({ displayScale: 2 })} />)

    const img = container.querySelector('img') as HTMLImageElement
    const expectedPercent = ((BASE_CHARACTER_HEIGHT * 2) / ROOM_HEIGHT) * 100
    expect(img.style.height).toBe(`${expectedPercent}%`)
  })

  it('anchors the wrapper at the character\'s exact foot position (movement x/y), matching the room\'s logical coordinate system', () => {
    const { container } = render(<CharacterToken character={makeCharacter()} />)

    const wrapper = container.querySelector('.character-token') as HTMLElement
    expect(wrapper.style.left).toBe(`${(360 / ROOM_WIDTH) * 100}%`)
    expect(wrapper.style.top).toBe(`${(300 / ROOM_HEIGHT) * 100}%`)
  })

  it('renders the shadow and sprite as children of the same foot-anchored wrapper, so they can never drift apart while moving', () => {
    const { container } = render(<CharacterToken character={makeCharacter()} />)

    const wrapper = container.querySelector('.character-token') as HTMLElement
    expect(wrapper.querySelector('.character-token-shadow')).not.toBeNull()
    expect(wrapper.querySelector('.character-token-sprite')).not.toBeNull()
  })

  it('shows a placeholder instead of a broken image when the image fails to load', () => {
    const { container } = render(<CharacterToken character={makeCharacter()} />)

    fireEvent.error(container.querySelector('img') as HTMLImageElement)

    expect(container.querySelector('img')).not.toBeInTheDocument()
    expect(screen.getByText('M')).toBeInTheDocument()
  })

  it('returns nothing if the character has no movement entry yet (never crashes mid-sync)', () => {
    useCharacterMovementStore.setState({ byId: {} })
    const { container } = render(<CharacterToken character={makeCharacter()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('applies footOffsetRatio to the sprite\'s own top offset, as a fraction of its rendered height, without moving the shadow', () => {
    const { container } = render(<CharacterToken character={makeCharacter({ footOffsetRatio: 0.1 })} />)

    const heightUnits = BASE_CHARACTER_HEIGHT * 1
    const expectedSpriteTop = ((heightUnits * 0.1) / ROOM_HEIGHT) * 100

    const img = container.querySelector('img') as HTMLImageElement
    expect(img.style.top).toBe(`${expectedSpriteTop}%`)

    const shadow = container.querySelector('.character-token-shadow') as HTMLElement
    expect(shadow.style.top).toBe('') // no inline top set — shadow never receives the correction
  })

  it('scales the foot-offset correction with displayScale (a fraction of the sprite\'s own rendered height, not a fixed amount)', () => {
    const { container } = render(<CharacterToken character={makeCharacter({ displayScale: 2, footOffsetRatio: 0.1 })} />)

    const heightUnits = BASE_CHARACTER_HEIGHT * 2
    const expectedSpriteTop = ((heightUnits * 0.1) / ROOM_HEIGHT) * 100

    const img = container.querySelector('img') as HTMLImageElement
    expect(img.style.top).toBe(`${expectedSpriteTop}%`)
  })

  it('shows no speech bubble by default', () => {
    const { container } = render(<CharacterToken character={makeCharacter()} />)
    expect(container.querySelector('.character-token-bubble')).toBeNull()
  })

  it('shows the character\'s active bubble text, keyed by their own id, positioned above the sprite', () => {
    useDialogueStore.setState({ activeBubbleByCharacter: { a: '안녕!' } })
    const { container } = render(<CharacterToken character={makeCharacter()} />)

    const bubble = container.querySelector('.character-token-bubble')
    expect(bubble).not.toBeNull()
    expect(bubble?.textContent).toBe('안녕!')
  })

  it('does not show a bubble meant for a different character', () => {
    useDialogueStore.setState({ activeBubbleByCharacter: { 'some-other-id': '안녕!' } })
    const { container } = render(<CharacterToken character={makeCharacter()} />)
    expect(container.querySelector('.character-token-bubble')).toBeNull()
  })

  describe('imageBounds-driven auto sizing and foot alignment', () => {
    it('renders the full image taller than BASE_CHARACTER_HEIGHT when the detected character body is only part of the image (auto real-size correction)', () => {
      const { container } = render(
        <CharacterToken character={makeCharacter({ imageBounds: { topRatio: 0.25, bottomRatio: 0.75, leftRatio: 0.25, rightRatio: 0.75 } })} />,
      )

      const img = container.querySelector('img') as HTMLImageElement
      const expectedPercent = ((BASE_CHARACTER_HEIGHT * 2) / ROOM_HEIGHT) * 100
      expect(img.style.height).toBe(`${expectedPercent}%`)
    })

    it('auto-pushes the sprite down to compensate for transparent padding below the feet, with no manual footOffsetRatio set', () => {
      const { container } = render(
        <CharacterToken character={makeCharacter({ footOffsetRatio: 0, imageBounds: { topRatio: 0, bottomRatio: 0.8, leftRatio: 0, rightRatio: 1 } })} />,
      )

      const img = container.querySelector('img') as HTMLImageElement
      const renderedHeight = BASE_CHARACTER_HEIGHT / 0.8
      const expectedTop = ((renderedHeight * 0.2) / ROOM_HEIGHT) * 100
      expect(parseFloat(img.style.top)).toBeCloseTo(expectedTop, 9)
    })

    it('never applies the auto correction to the shadow — shadow size/position stay keyed off displayScale alone', () => {
      const withoutBounds = render(<CharacterToken character={makeCharacter({ imageBounds: null })} />)
      const withoutShadow = withoutBounds.container.querySelector('.character-token-shadow') as HTMLElement
      const withoutShadowStyle = { width: withoutShadow.style.width, height: withoutShadow.style.height }
      cleanup()

      const withBounds = render(
        <CharacterToken character={makeCharacter({ imageBounds: { topRatio: 0.3, bottomRatio: 0.5, leftRatio: 0.3, rightRatio: 0.5 } })} />,
      )
      const withShadow = withBounds.container.querySelector('.character-token-shadow') as HTMLElement
      expect({ width: withShadow.style.width, height: withShadow.style.height }).toEqual(withoutShadowStyle)
      expect(withShadow.style.top).toBe('') // still no inline top — the shadow never moves for this either
    })

    it('does not change existing rendering when imageBounds is null (legacy characters keep looking exactly as before)', () => {
      const { container } = render(<CharacterToken character={makeCharacter({ imageBounds: null })} />)

      const img = container.querySelector('img') as HTMLImageElement
      const expectedPercent = (BASE_CHARACTER_HEIGHT / ROOM_HEIGHT) * 100
      expect(img.style.height).toBe(`${expectedPercent}%`)
      expect(img.style.top).toBe('0%')
    })
  })
})
