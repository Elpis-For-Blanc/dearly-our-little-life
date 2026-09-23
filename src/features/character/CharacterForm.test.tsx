import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useNeedsStore } from '../needs/needsStore'
import { CharacterForm, MAX_CHARACTERS } from './CharacterForm'
import { useCharacterStore } from './characterStore'
import { EMPTY_AI_PROFILE } from './types'

function makeImageFile(name = 'milo.png') {
  return new File(['fake-image-bytes'], name, { type: 'image/png' })
}

describe('CharacterForm', () => {
  beforeEach(() => {
    useCharacterStore.setState({ characters: [] })
    useNeedsStore.setState({ byId: {} })
  })

  afterEach(() => {
    cleanup()
  })

  it('adds a character to the store on submit, including personality tags picked from the list', async () => {
    const user = userEvent.setup()
    render(<CharacterForm />)

    await user.upload(screen.getByLabelText('이미지'), makeImageFile())
    await user.type(screen.getByLabelText('이름'), 'Milo')
    await user.click(screen.getByRole('button', { name: '활발함' }))
    await user.click(screen.getByRole('button', { name: '다정함' }))
    await user.type(screen.getByLabelText('좋아하는 색'), '파랑')
    await user.click(screen.getByRole('button', { name: '캐릭터 등록' }))

    const characters = useCharacterStore.getState().characters
    expect(characters).toHaveLength(1)
    expect(characters[0]).toMatchObject({
      name: 'Milo',
      traits: { favoriteColor: '파랑' },
    })
    expect(characters[0].aiProfile.personalityTags).toEqual(expect.arrayContaining(['energetic', 'affectionate']))

    // 캐릭터 생성 시 기본 욕구(65~85 범위)가 함께 만들어진다
    const needs = useNeedsStore.getState().byId[characters[0].id]
    expect(needs).toBeDefined()
    for (const value of Object.values(needs!)) {
      expect(value).toBeGreaterThanOrEqual(65)
      expect(value).toBeLessThanOrEqual(85)
    }
  })

  it('creates the character with imageBounds: null when image-bounds analysis is unavailable (e.g. no real canvas pixel backend) — never blocks or loses the image', async () => {
    const user = userEvent.setup()
    const { container } = render(<CharacterForm />)

    await user.upload(screen.getByLabelText('이미지'), makeImageFile())
    // The preview shows immediately — analysis (which cannot decode a real image in this test environment) never blocks it.
    expect(container.querySelector('.character-form-preview')).toHaveAttribute('src', expect.stringContaining('data:'))

    await user.type(screen.getByLabelText('이름'), 'Milo')
    await user.click(screen.getByRole('button', { name: '캐릭터 등록' }))

    const characters = useCharacterStore.getState().characters
    expect(characters).toHaveLength(1)
    expect(characters[0].imageDataUrl).toContain('data:')
    expect(characters[0].imageBounds).toBeNull()
  })

  it('shows the full personality picker: search, category filter, 5-tag limit, and custom tags', async () => {
    const user = userEvent.setup()
    render(<CharacterForm />)

    expect(screen.getByPlaceholderText('성격 검색')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '대인관계' })).toBeInTheDocument()
    expect(screen.getByText('0 / 5')).toBeInTheDocument()

    for (const label of ['활발함', '다정함', '차분함', '사교적', '수줍음']) {
      await user.click(screen.getByRole('button', { name: label }))
    }
    expect(screen.getByText('5 / 5')).toBeInTheDocument()
    expect(screen.getByText(/최대 5개까지 선택할 수 있어요/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '무뚝뚝함' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: '활발함 제거' }))
    expect(screen.getByText('4 / 5')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '무뚝뚝함' })).toBeEnabled()
  })

  it('shows a validation error when the image is missing', async () => {
    const user = userEvent.setup()
    render(<CharacterForm />)

    await user.type(screen.getByLabelText('이름'), 'Milo')
    await user.click(screen.getByRole('button', { name: '캐릭터 등록' }))

    expect(screen.getByText('이름과 이미지를 모두 입력해 주세요.')).toBeInTheDocument()
    expect(useCharacterStore.getState().characters).toHaveLength(0)
  })

  it('hides the form once the max character count is reached', () => {
    useCharacterStore.setState({
      characters: Array.from({ length: MAX_CHARACTERS }, (_, i) => ({
        id: String(i),
        name: `Char ${i}`,
        imageDataUrl: 'data:image/png;base64,',
        displayScale: 1, footOffsetRatio: 0, imageBounds: null,
        traits: { personality: '', favoriteColor: '' },
        aiProfile: EMPTY_AI_PROFILE,
      })),
    })

    render(<CharacterForm />)

    expect(screen.queryByRole('button', { name: '캐릭터 등록' })).not.toBeInTheDocument()
    expect(
      screen.getByText(`캐릭터는 최대 ${MAX_CHARACTERS}명까지 등록할 수 있어요.`),
    ).toBeInTheDocument()
  })
})
