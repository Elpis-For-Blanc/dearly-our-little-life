import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterToneForm } from './CharacterToneForm'
import { useCharacterStore } from './characterStore'
import { EMPTY_AI_PROFILE } from './types'

// Subscribes to the store so each keystroke's update re-renders with the
// fresh tone value — a controlled <input> bound to a static snapshot prop
// (as a bare test render would do) gets reset by React after every
// keystroke, which isn't how the real app renders this component either.
function ConnectedToneForm() {
  const character = useCharacterStore((state) => state.characters.find((c) => c.id === '1'))
  if (!character) return null
  return <CharacterToneForm characterId={character.id} tone={character.aiProfile.tone} />
}

describe('CharacterToneForm', () => {
  beforeEach(() => {
    localStorage.clear()
    useCharacterStore.setState({
      characters: [
        {
          id: '1',
          name: 'Milo',
          imageDataUrl: 'data:image/png;base64,',
          displayScale: 1, footOffsetRatio: 0, imageBounds: null,
          traits: { personality: '', favoriteColor: '' },
          aiProfile: EMPTY_AI_PROFILE,
        },
      ],
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('the base tone select is a shortcut, but free-text tone detail is always editable regardless of selection', async () => {
    const user = userEvent.setup()
    render(<ConnectedToneForm />)

    await user.selectOptions(screen.getByLabelText('기본 말투'), '존댓말')
    expect(useCharacterStore.getState().characters[0].aiProfile.tone.baseTone).toBe('formal')

    // toneDetail must remain freely editable no matter which baseTone is picked
    expect(screen.getByLabelText(/말투 특징/)).not.toBeDisabled()
  })

  it('writes each field to its own tone property without clobbering the others', async () => {
    const user = userEvent.setup()
    render(<ConnectedToneForm />)

    await user.type(screen.getByLabelText('일인칭 표현'), '나')
    await user.type(screen.getByLabelText('상대를 부르는 호칭'), '자기야')
    await user.type(screen.getByLabelText('말버릇'), '~다냥')

    const tone = useCharacterStore.getState().characters[0].aiProfile.tone
    expect(tone.firstPerson).toBe('나')
    expect(tone.addressForPartner).toBe('자기야')
    expect(tone.verbalTic).toBe('~다냥')
  })
})
