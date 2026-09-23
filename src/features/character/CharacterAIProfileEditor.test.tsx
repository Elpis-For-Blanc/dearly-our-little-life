import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterAIProfileEditor } from './CharacterAIProfileEditor'
import { useCharacterStore } from './characterStore'
import { EMPTY_AI_PROFILE, type Character } from './types'

const character: Character = {
  id: '1',
  name: 'Milo',
  imageDataUrl: 'data:image/png;base64,',
  displayScale: 1, footOffsetRatio: 0, imageBounds: null,
  traits: { personality: '', favoriteColor: '' },
  aiProfile: EMPTY_AI_PROFILE,
}

function currentCharacter() {
  return useCharacterStore.getState().characters.find((c) => c.id === '1')!
}

describe('CharacterAIProfileEditor: display size control', () => {
  beforeEach(() => {
    localStorage.clear()
    useCharacterStore.setState({ characters: [character] })
  })

  afterEach(() => {
    cleanup()
  })

  it('shows the current display size as a percentage and defaults to 100%', async () => {
    const user = userEvent.setup()
    render(<CharacterAIProfileEditor character={currentCharacter()} />)
    await user.click(screen.getByRole('button', { name: '기타 설정' }))

    expect(screen.getByText(/100%/)).toBeInTheDocument()
  })

  it('changing the size slider updates the store, clamped to 50-200%, and persists to localStorage', async () => {
    const user = userEvent.setup()
    render(<CharacterAIProfileEditor character={currentCharacter()} />)
    await user.click(screen.getByRole('button', { name: '기타 설정' }))

    const [sizeSlider] = screen.getAllByRole('slider')
    fireChange(sizeSlider, '1.5')

    expect(currentCharacter().displayScale).toBe(1.5)
    const stored = JSON.parse(localStorage.getItem('dearly-characters') ?? '{}')
    expect(stored.state.characters[0].displayScale).toBe(1.5)
  })

  it('changing one character\'s size does not affect another character\'s size', async () => {
    const other: Character = { ...character, id: '2', name: 'Luna' }
    useCharacterStore.setState({ characters: [character, other] })

    const user = userEvent.setup()
    render(<CharacterAIProfileEditor character={currentCharacter()} />)
    await user.click(screen.getByRole('button', { name: '기타 설정' }))

    const [sizeSlider] = screen.getAllByRole('slider')
    fireChange(sizeSlider, '2')

    const characters = useCharacterStore.getState().characters
    expect(characters.find((c) => c.id === '1')?.displayScale).toBe(2)
    expect(characters.find((c) => c.id === '2')?.displayScale).toBe(1)
  })

  it('shows the current foot-position correction and defaults to 0%, adjustable independently of size', async () => {
    const user = userEvent.setup()
    render(<CharacterAIProfileEditor character={currentCharacter()} />)
    await user.click(screen.getByRole('button', { name: '기타 설정' }))

    expect(screen.getByText(/발 위치 보정/)).toBeInTheDocument()

    const [, footOffsetSlider] = screen.getAllByRole('slider')
    fireChange(footOffsetSlider, '0.1')

    expect(currentCharacter().footOffsetRatio).toBe(0.1)
    expect(currentCharacter().displayScale).toBe(1)
    const stored = JSON.parse(localStorage.getItem('dearly-characters') ?? '{}')
    expect(stored.state.characters[0].footOffsetRatio).toBe(0.1)
  })

  it('changing one character\'s foot-position correction does not affect another character\'s', async () => {
    const other: Character = { ...character, id: '2', name: 'Luna' }
    useCharacterStore.setState({ characters: [character, other] })

    const user = userEvent.setup()
    render(<CharacterAIProfileEditor character={currentCharacter()} />)
    await user.click(screen.getByRole('button', { name: '기타 설정' }))

    const [, footOffsetSlider] = screen.getAllByRole('slider')
    fireChange(footOffsetSlider, '-0.15')

    const characters = useCharacterStore.getState().characters
    expect(characters.find((c) => c.id === '1')?.footOffsetRatio).toBe(-0.15)
    expect(characters.find((c) => c.id === '2')?.footOffsetRatio).toBe(0)
  })
})

function fireChange(element: HTMLElement, value: string) {
  const input = element as HTMLInputElement
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  nativeSetter.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}
