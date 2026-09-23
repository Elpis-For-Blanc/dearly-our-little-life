import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SetupScreen } from './SetupScreen'
import { useCharacterStore } from '../features/character/characterStore'

function makeImageFile(name: string) {
  return new File(['fake-image-bytes'], name, { type: 'image/png' })
}

async function registerCharacter(user: ReturnType<typeof userEvent.setup>, name: string, personalityLabels: string[]) {
  await user.upload(screen.getByLabelText('이미지'), makeImageFile(`${name}.png`))
  await user.type(screen.getByLabelText('이름'), name)
  for (const label of personalityLabels) {
    await user.click(screen.getByRole('button', { name: label }))
  }
  await user.click(screen.getByRole('button', { name: '캐릭터 등록' }))
}

/**
 * End-to-end integration test for the exact flow reported missing in
 * production: the registration form must show the real personality picker
 * (not the old free-text input), the edit screen must reuse the same
 * component pre-populated with the saved selection, and edits must persist
 * to localStorage and stay isolated per character.
 */
describe('SetupScreen: character registration and personality editing end-to-end', () => {
  beforeEach(() => {
    localStorage.clear()
    useCharacterStore.setState({ characters: [] })
  })

  afterEach(() => {
    cleanup()
  })

  it('walks the full registration -> edit -> persist -> isolation flow', async () => {
    const user = userEvent.setup()
    render(<SetupScreen />)

    // 2. New-registration form shows the real personality list, not a free-text input.
    expect(screen.queryByLabelText('성격')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('성격 검색')).toBeInTheDocument()
    expect(screen.getByText('0 / 5')).toBeInTheDocument()

    await user.upload(screen.getByLabelText('이미지'), makeImageFile('milo.png'))

    // 3. Select exactly 5 personalities.
    const fivePersonalities = ['활발함', '다정함', '차분함', '사교적', '수줍음']
    for (const label of fivePersonalities) {
      await user.click(screen.getByRole('button', { name: label }))
    }
    expect(screen.getByText('5 / 5')).toBeInTheDocument()

    // 4. A 6th selection is blocked.
    await user.click(screen.getByRole('button', { name: '무뚝뚝함' }))
    expect(screen.getByText('5 / 5')).toBeInTheDocument()

    // 5. Register the character.
    await user.type(screen.getByLabelText('이름'), 'Milo')
    await user.click(screen.getByRole('button', { name: '캐릭터 등록' }))

    expect(useCharacterStore.getState().characters).toHaveLength(1)
    const registeredId = useCharacterStore.getState().characters[0].id
    expect(useCharacterStore.getState().characters[0].aiProfile.personalityTags).toHaveLength(5)

    // 6. Open the edit screen for the registered character (personality lives under its "기타 설정" tab).
    const miloRow = screen.getByText('Milo').closest('li')
    if (!miloRow) throw new Error('row not found')
    await user.click(within(miloRow).getByRole('button', { name: '말투·대사 설정' }))
    await user.click(within(miloRow).getByRole('button', { name: '기타 설정' }))

    // 7. All 5 previously-selected personalities show as selected in the edit picker.
    for (const label of fivePersonalities) {
      expect(within(miloRow).getByRole('button', { name: label })).toHaveClass('active')
    }
    expect(within(miloRow).getByText('5 / 5')).toBeInTheDocument()

    // 8. Change one personality: remove 수줍음, add 무뚝뚝함.
    await user.click(within(miloRow).getByRole('button', { name: '수줍음 제거' }))
    await user.click(within(miloRow).getByRole('button', { name: '무뚝뚝함' }))

    // 9. The change is written straight to localStorage (this store has no separate "save" step).
    const stored = JSON.parse(localStorage.getItem('dearly-characters') ?? '{}')
    const storedTags: string[] = stored.state.characters[0].aiProfile.personalityTags
    expect(storedTags).toContain('gruff')
    expect(storedTags).not.toContain('shy')
    expect(storedTags).toHaveLength(5)

    // 10. Re-reading the store (simulating a reload's hydration) reflects the change.
    expect(useCharacterStore.getState().characters.find((c) => c.id === registeredId)?.aiProfile.personalityTags).toEqual(storedTags)
  })

  it('editing one character\'s personalities never affects any other registered character', async () => {
    const user = userEvent.setup()
    render(<SetupScreen />)

    await registerCharacter(user, 'Milo', ['활발함', '사교적'])
    await registerCharacter(user, 'Luna', ['차분함', '내향적'])

    const lunaRow = screen.getByText('Luna').closest('li')
    if (!lunaRow) throw new Error('row not found')
    await user.click(within(lunaRow).getByRole('button', { name: '말투·대사 설정' }))
    await user.click(within(lunaRow).getByRole('button', { name: '기타 설정' }))
    await user.click(within(lunaRow).getByRole('button', { name: '차분함' })) // deselect

    const characters = useCharacterStore.getState().characters
    const milo = characters.find((c) => c.name === 'Milo')
    const luna = characters.find((c) => c.name === 'Luna')

    expect(luna?.aiProfile.personalityTags).toEqual(['introverted'])
    expect(milo?.aiProfile.personalityTags).toEqual(expect.arrayContaining(['energetic', 'sociable']))
    expect(milo?.aiProfile.personalityTags).toHaveLength(2)
  })
})

/**
 * The save/load buttons must live in the screen the "캐릭터 설정" nav button
 * actually opens (`SetupScreen`), not nested inside a specific character's
 * expandable editor — a screen with zero registered characters never
 * renders `CharacterAIProfileEditor` at all, so that would have made the
 * feature invisible for a brand-new user. `features/save/` itself
 * (`saveActions`/`saveRestore`/`saveStorage`/`saveTypes`/`saveValidate`) is
 * untouched and already fully tested in `features/save/save.test.ts` — this
 * only exercises the real buttons through the real `localStorage`, exactly
 * as a user clicking them on this actual screen would.
 */
describe('SetupScreen: 데이터 섹션 (저장/불러오기)', () => {
  beforeEach(() => {
    localStorage.clear()
    useCharacterStore.setState({ characters: [] })
  })

  afterEach(() => {
    cleanup()
  })

  it('등록된 캐릭터가 하나도 없어도 "데이터" 섹션과 저장/불러오기 버튼이 보인다', () => {
    render(<SetupScreen />)
    expect(screen.getByText('데이터')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '불러오기' })).toBeInTheDocument()
  })

  it('저장 버튼을 누르면 localStorage에 기존과 동일한 키/schemaVersion으로 저장되고 성공 메시지가 뜬다', async () => {
    const user = userEvent.setup()
    render(<SetupScreen />)

    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByText('저장했어요.')).toBeInTheDocument()
    const stored = localStorage.getItem('dearly-save-slot-1')
    expect(stored).not.toBeNull()
    expect(JSON.parse(stored!).schemaVersion).toBe(2) // bumped for the needs/mood system
  })

  it('저장된 데이터가 없을 때 불러오기를 누르면 안내 메시지가 뜬다', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<SetupScreen />)

    await user.click(screen.getByRole('button', { name: '불러오기' }))

    expect(await screen.findByText('저장된 데이터가 없어요.')).toBeInTheDocument()
    confirmSpy.mockRestore()
  })

  it('불러오기 버튼을 누르면 저장된 캐릭터가 기존과 동일하게 복원된다', async () => {
    const user = userEvent.setup()
    render(<SetupScreen />)
    await registerCharacter(user, 'Milo', [])
    await user.click(screen.getByRole('button', { name: '저장' }))

    useCharacterStore.getState().updateCharacter(useCharacterStore.getState().characters[0].id, { name: '다른 이름' })

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: '불러오기' }))

    expect(await screen.findByText('불러왔어요.')).toBeInTheDocument()
    expect(useCharacterStore.getState().characters[0].name).toBe('Milo')
    confirmSpy.mockRestore()
  })
})
