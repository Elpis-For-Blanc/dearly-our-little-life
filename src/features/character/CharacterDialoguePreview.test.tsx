import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { CharacterDialoguePreview } from './CharacterDialoguePreview'
import type { Character, CharacterDialogueLine } from './types'
import { EMPTY_AI_PROFILE } from './types'

const character: Character = {
  id: '1',
  name: 'Milo',
  imageDataUrl: 'data:image/png;base64,abc',
  displayScale: 1, footOffsetRatio: 0, imageBounds: null,
  traits: { personality: '', favoriteColor: '' },
  aiProfile: EMPTY_AI_PROFILE,
}

const line: CharacterDialogueLine = {
  id: 'l1',
  categoryId: 'meal',
  situationNote: '',
  text: '밥 먹었어?',
  emotion: 'calm',
  tags: [],
  isFallback: false,
}

describe('CharacterDialoguePreview', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows a hint instead of a bubble when no line is selected', () => {
    render(<CharacterDialoguePreview character={character} line={null} />)
    expect(screen.getByText(/미리보기/)).toBeInTheDocument()
    expect(document.querySelector('.dialogue-bubble')).not.toBeInTheDocument()
  })

  it('renders the selected line as a bubble next to the character image', () => {
    render(<CharacterDialoguePreview character={character} line={line} />)

    expect(screen.getByText('밥 먹었어?')).toBeInTheDocument()
    expect(screen.getByAltText('Milo')).toHaveAttribute('src', character.imageDataUrl)
  })
})
