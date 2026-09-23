import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useNeedsStore } from '../needs/needsStore'
import { CharacterList } from './CharacterList'
import { useCharacterStore } from './characterStore'
import { EMPTY_AI_PROFILE } from './types'

const characterA = {
  id: 'a',
  name: 'Milo',
  imageDataUrl: 'data:image/png;base64,',
  displayScale: 1, footOffsetRatio: 0, imageBounds: null,
  traits: { personality: 'playful', favoriteColor: 'blue' },
  aiProfile: EMPTY_AI_PROFILE,
}
const characterB = {
  id: 'b',
  name: 'Luna',
  imageDataUrl: 'data:image/png;base64,',
  displayScale: 1, footOffsetRatio: 0, imageBounds: null,
  traits: { personality: 'calm', favoriteColor: 'lavender' },
  aiProfile: EMPTY_AI_PROFILE,
}

describe('CharacterList tone/dialogue profile editing', () => {
  beforeEach(() => {
    localStorage.clear()
    useCharacterStore.setState({ characters: [characterA, characterB] })
  })

  afterEach(() => {
    cleanup()
  })

  it('keeps the tone/dialogue editor collapsed until "말투·대사 설정" is clicked', async () => {
    const user = userEvent.setup()
    render(<CharacterList />)

    expect(screen.queryByLabelText(/말투 특징/)).not.toBeInTheDocument()

    const miloRow = screen.getByText('Milo').closest('li')
    if (!miloRow) throw new Error('row not found')
    await user.click(within(miloRow).getByRole('button', { name: '말투·대사 설정' }))

    expect(within(miloRow).getByLabelText(/말투 특징/)).toBeInTheDocument()
  })

  it('edits to character A do not affect character B', async () => {
    const user = userEvent.setup()
    render(<CharacterList />)

    const miloRow = screen.getByText('Milo').closest('li')
    if (!miloRow) throw new Error('row not found')
    await user.click(within(miloRow).getByRole('button', { name: '말투·대사 설정' }))
    await user.type(within(miloRow).getByLabelText(/말투 특징/), '반말')

    const characters = useCharacterStore.getState().characters
    expect(characters.find((c) => c.id === 'a')?.aiProfile.tone.toneDetail).toBe('반말')
    expect(characters.find((c) => c.id === 'b')?.aiProfile.tone.toneDetail).toBe('')
  })
})

describe('CharacterList: 캐릭터 삭제 시 욕구 상태 정리', () => {
  beforeEach(() => {
    localStorage.clear()
    useCharacterStore.setState({ characters: [characterA, characterB] })
    useNeedsStore.setState({ byId: {} })
    useNeedsStore.getState().setNeeds('a', { hunger: 40, energy: 40, fun: 40, social: 40 })
    useNeedsStore.getState().setNeeds('b', { hunger: 60, energy: 60, fun: 60, social: 60 })
  })

  afterEach(() => {
    cleanup()
  })

  it('캐릭터를 삭제하면 그 캐릭터의 욕구 상태만 정리되고, 다른 캐릭터의 욕구는 그대로다', async () => {
    const user = userEvent.setup()
    render(<CharacterList />)

    const miloRow = screen.getByText('Milo').closest('li')
    if (!miloRow) throw new Error('row not found')
    await user.click(within(miloRow).getByRole('button', { name: '삭제' }))

    expect(useNeedsStore.getState().byId.a).toBeUndefined()
    expect(useNeedsStore.getState().byId.b).toEqual({ hunger: 60, energy: 60, fun: 60, social: 60 })
  })
})
