import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterDialogueLineManager } from './CharacterDialogueLineManager'
import { useCharacterStore } from './characterStore'
import { EMPTY_AI_PROFILE, type Character } from './types'
import { useSituationCategoryStore } from '../dialogue/situationCategoryStore'

const character: Character = {
  id: '1',
  name: 'Milo',
  imageDataUrl: 'data:image/png;base64,',
  displayScale: 1, footOffsetRatio: 0, imageBounds: null,
  traits: { personality: '', favoriteColor: '' },
  aiProfile: EMPTY_AI_PROFILE,
}

function currentCharacter() {
  const found = useCharacterStore.getState().characters.find((c) => c.id === '1')
  if (!found) throw new Error('character not found')
  return found
}

describe('CharacterDialogueLineManager', () => {
  beforeEach(() => {
    localStorage.clear()
    useCharacterStore.setState({ characters: [character] })
    useSituationCategoryStore.setState({ customCategories: [] })
  })

  afterEach(() => {
    cleanup()
  })

  it('adds a dialogue line with category, situation note, emotion, and tags', async () => {
    const user = userEvent.setup()
    render(<CharacterDialogueLineManager character={character} />)

    await user.selectOptions(screen.getByLabelText('상황 카테고리'), '아침 인사')
    await user.type(screen.getByLabelText('상황 (선택)'), '아침에 상대를 깨울 때')
    await user.type(screen.getByLabelText('대사'), '일어날 시간입니다.')
    await user.type(screen.getByLabelText('감정'), '다정함')
    await user.type(screen.getByLabelText('태그'), '아침, 기상')
    await user.click(screen.getByRole('button', { name: '대사 추가' }))

    const lines = currentCharacter().aiProfile.dialogueLines
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      categoryId: 'morning-greeting',
      situationNote: '아침에 상대를 깨울 때',
      text: '일어날 시간입니다.',
      emotion: '다정함',
      tags: ['아침', '기상'],
    })
  })

  it('does not modify the entered line text (no tone normalization)', async () => {
    const user = userEvent.setup()
    render(<CharacterDialogueLineManager character={character} />)

    const weirdText = '음...  그래도 괜찮아요!!'
    await user.type(screen.getByLabelText('대사'), weirdText)
    await user.click(screen.getByRole('button', { name: '대사 추가' }))

    expect(currentCharacter().aiProfile.dialogueLines[0].text).toBe(weirdText)
  })

  it('adds a custom situation category and selects it immediately', async () => {
    const user = userEvent.setup()
    render(<CharacterDialogueLineManager character={character} />)

    await user.type(screen.getByPlaceholderText('새 카테고리 이름'), '기념일')
    await user.click(screen.getByRole('button', { name: '카테고리 추가' }))

    expect(screen.getByLabelText('상황 카테고리')).toHaveValue(useSituationCategoryStore.getState().customCategories[0].id)
    expect(screen.getByRole('option', { name: '기념일' })).toBeInTheDocument()
  })

  it('edits an existing line in place rather than creating a duplicate', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<CharacterDialogueLineManager character={character} />)

    await user.type(screen.getByLabelText('대사'), '원래 대사')
    await user.click(screen.getByRole('button', { name: '대사 추가' }))
    rerender(<CharacterDialogueLineManager character={currentCharacter()} />)

    await user.click(screen.getByRole('button', { name: '수정' }))
    const textField = screen.getByLabelText('대사') as HTMLTextAreaElement
    await user.clear(textField)
    await user.type(textField, '수정된 대사')
    await user.click(screen.getByRole('button', { name: '대사 수정 저장' }))

    const lines = currentCharacter().aiProfile.dialogueLines
    expect(lines).toHaveLength(1)
    expect(lines[0].text).toBe('수정된 대사')
  })

  it('reorders lines with the up/down buttons', async () => {
    useCharacterStore.setState({
      characters: [
        {
          ...character,
          aiProfile: {
            ...EMPTY_AI_PROFILE,
            dialogueLines: [
              { id: 'l1', categoryId: 'meal', situationNote: '', text: '첫번째', emotion: '', tags: [], isFallback: false },
              { id: 'l2', categoryId: 'meal', situationNote: '', text: '두번째', emotion: '', tags: [], isFallback: false },
            ],
          },
        },
      ],
    })
    const user = userEvent.setup()
    render(<CharacterDialogueLineManager character={currentCharacter()} />)

    const items = screen.getAllByRole('listitem')
    await user.click(within(items[1]).getByRole('button', { name: '위로' }))

    expect(currentCharacter().aiProfile.dialogueLines.map((l) => l.text)).toEqual(['두번째', '첫번째'])
  })

  it('deletes a line', async () => {
    useCharacterStore.setState({
      characters: [
        {
          ...character,
          aiProfile: {
            ...EMPTY_AI_PROFILE,
            dialogueLines: [{ id: 'l1', categoryId: 'meal', situationNote: '', text: '삭제될 대사', emotion: '', tags: [], isFallback: false }],
          },
        },
      ],
    })
    const user = userEvent.setup()
    render(<CharacterDialogueLineManager character={currentCharacter()} />)

    await user.click(screen.getByRole('button', { name: '삭제' }))

    expect(currentCharacter().aiProfile.dialogueLines).toHaveLength(0)
  })

  it('shows the bubble preview for the clicked line, reusing the shared bubble component', async () => {
    useCharacterStore.setState({
      characters: [
        {
          ...character,
          aiProfile: {
            ...EMPTY_AI_PROFILE,
            dialogueLines: [{ id: 'l1', categoryId: 'meal', situationNote: '', text: '밥 먹자!', emotion: '', tags: [], isFallback: false }],
          },
        },
      ],
    })
    const user = userEvent.setup()
    render(<CharacterDialogueLineManager character={currentCharacter()} />)

    await user.click(screen.getByRole('button', { name: '미리보기' }))

    expect(document.querySelector('.dialogue-bubble-text')).toHaveTextContent('밥 먹자!')
  })
})
