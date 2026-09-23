import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LiveScreen } from './LiveScreen'
import { useCharacterStore } from '../features/character/characterStore'
import { EMPTY_AI_PROFILE } from '../features/character/types'
import { useDialogueStore } from '../features/dialogue/dialogueStore'
import { useDialogueFrequencyStore } from '../features/dialogue/dialogueFrequencyStore'
import { useMonologueFrequencyStore } from '../features/dialogue/monologueFrequencyStore'
import { useRelationshipStore } from '../features/dialogue/relationshipStore'
import { useSimulationStore } from '../features/simulation/simulationStore'
import { useCharacterMovementStore } from '../features/simulation/characterMovementStore'
import { useHomeStore } from '../features/home/homeStore'
import { useNeedsStore } from '../features/needs/needsStore'

function clearActiveRoomFurniture() {
  const roomId = useHomeStore.getState().activeDecorateRoomId
  useHomeStore.setState((state) => ({
    rooms: state.rooms.map((room) => (room.id === roomId ? { ...room, furniture: [] } : room)),
  }))
}

// Manual dialogue is scoped to the currently-observed live room — these
// tests care about the dialogue/pair-picker logic, not movement, so they
// place every registered character directly into the active live room
// instead of waiting for a real movement tick to spawn them there.
function seedCharactersInActiveRoom(ids: string[]) {
  const roomId = useHomeStore.getState().activeLiveRoomId
  useCharacterMovementStore.setState({
    byId: Object.fromEntries(
      ids.map((id, i) => [
        id,
        {
          id,
          roomId,
          x: 100 + i * 30,
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
}
import { MOVEMENT_TICK_MS } from '../features/simulation/movementConfig'
import { BUBBLE_REVEAL_INTERVAL_MS, MAX_BUNDLE_LINES } from '../features/dialogue/autoDialogueConfig'

const characterA = {
  id: 'a',
  name: 'Milo',
  imageDataUrl: 'data:image/png;base64,',
  displayScale: 1, footOffsetRatio: 0, imageBounds: null,
  traits: { personality: '', favoriteColor: '' },
  aiProfile: EMPTY_AI_PROFILE,
}
const characterB = {
  id: 'b',
  name: 'Luna',
  imageDataUrl: 'data:image/png;base64,',
  displayScale: 1, footOffsetRatio: 0, imageBounds: null,
  traits: { personality: '', favoriteColor: '' },
  aiProfile: EMPTY_AI_PROFILE,
}

function withLines(base: typeof characterA) {
  return {
    ...base,
    aiProfile: {
      ...EMPTY_AI_PROFILE,
      dialogueLines: [
        { id: `${base.id}-1`, categoryId: 'casual-chat', situationNote: '', text: `${base.name} 안녕`, emotion: 'neutral', tags: [], isFallback: false },
        { id: `${base.id}-2`, categoryId: 'casual-chat', situationNote: '', text: `${base.name} 반가워`, emotion: 'neutral', tags: [], isFallback: false },
      ],
    },
  }
}

describe('LiveScreen', () => {
  beforeEach(() => {
    useDialogueStore.setState({
      entries: [],
      activeConversations: {},
      lastConversationEndAtByPair: {},
      recentAutoLineIdsByCharacter: {},
      activeBubbleByCharacter: {},
    })
    useDialogueFrequencyStore.setState({ mode: 'normal' })
    useMonologueFrequencyStore.setState({ mode: 'normal' })
    useRelationshipStore.setState({ defaultRelationshipType: 'close', relationshipsByPair: {} })
    useSimulationStore.setState({ isRunning: false, tick: 0 })
    useCharacterMovementStore.setState({ byId: {} })
    useNeedsStore.setState({ byId: {} })
    clearActiveRoomFurniture()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('shows a guard message instead of the room when fewer than two characters are registered', () => {
    useCharacterStore.setState({ characters: [characterA] })
    render(<LiveScreen />)

    expect(screen.getByText(/두 캐릭터를 모두 등록/)).toBeInTheDocument()
  })

  it('has no AI/API UI anywhere on the screen (the manual 대화하기 button is local-only, not an AI call)', () => {
    useCharacterStore.setState({ characters: [characterA, characterB] })
    render(<LiveScreen />)

    expect(screen.queryByText(/API/)).not.toBeInTheDocument()
    // No cancel button — there's no in-flight network request to cancel anymore, local generation is effectively instant/synchronous per line.
    expect(screen.queryByRole('button', { name: '중단' })).not.toBeInTheDocument()
  })

  it('produces auto-dialogue from the local dialogue-line library alone when two characters encounter each other, with no network call', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    useCharacterStore.setState({ characters: [withLines(characterA), withLines(characterB)] })
    useDialogueFrequencyStore.setState({ mode: 'rowdy' })
    const roomId = useHomeStore.getState().activeLiveRoomId
    useCharacterMovementStore.setState({
      byId: {
        a: { id: 'a', roomId, x: 300, y: 350, destination: null, destinationRoomId: null, currentBehavior: null, status: 'idle', restTicksRemaining: 0, stuckTicks: 0 },
        b: { id: 'b', roomId, x: 310, y: 350, destination: null, destinationRoomId: null, currentBehavior: null, status: 'idle', restTicksRemaining: 0, stuckTicks: 0 },
      },
    })

    render(<LiveScreen />)

    await vi.advanceTimersByTimeAsync(MOVEMENT_TICK_MS)
    await vi.advanceTimersByTimeAsync(BUBBLE_REVEAL_INTERVAL_MS * MAX_BUNDLE_LINES)

    expect(useDialogueStore.getState().entries.length).toBeGreaterThan(0)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('shows all 5 dialogue frequency modes and switches the mode immediately on click', async () => {
    useCharacterStore.setState({ characters: [characterA, characterB] })
    const user = userEvent.setup()
    render(<LiveScreen />)

    // The 혼잣말 빈도 selector below shares the labels 가끔/보통, so scope to the 대화 빈도 group.
    const dialogueGroup = within(screen.getByRole('group', { name: '대화 빈도' }))
    for (const label of ['조용히', '가끔', '보통', '수다쟁이', '왁자지껄']) {
      expect(dialogueGroup.getByRole('button', { name: label })).toBeInTheDocument()
    }

    await user.click(dialogueGroup.getByRole('button', { name: '왁자지껄' }))

    expect(screen.getByText('현재: 왁자지껄')).toBeInTheDocument()
    expect(useDialogueFrequencyStore.getState().mode).toBe('rowdy')
  })

  it('shows the separate 혼잣말 빈도 selector with all 5 modes, defaulting to 보통, and it does not touch the 대화 빈도 setting', async () => {
    useCharacterStore.setState({ characters: [characterA, characterB] })
    const user = userEvent.setup()
    render(<LiveScreen />)

    const monologueGroup = within(screen.getByRole('group', { name: '혼잣말 빈도' }))
    for (const label of ['끄기', '가끔', '보통', '자주', '매우 자주']) {
      expect(monologueGroup.getByRole('button', { name: label })).toBeInTheDocument()
    }
    expect(monologueGroup.getByRole('button', { name: '보통' })).toHaveClass('active')

    await user.click(monologueGroup.getByRole('button', { name: '끄기' }))

    expect(useMonologueFrequencyStore.getState().mode).toBe('off')
    expect(useDialogueFrequencyStore.getState().mode).toBe('normal') // '조용히'-style dialogue setting is independent
    expect(screen.getByText('현재: 끄기')).toBeInTheDocument()
  })

  it('starts the simulation on mount and toggles pause/resume via the button', async () => {
    useCharacterStore.setState({ characters: [characterA, characterB] })
    const user = userEvent.setup()
    render(<LiveScreen />)

    expect(useSimulationStore.getState().isRunning).toBe(true)
    expect(screen.getByRole('button', { name: '일시정지' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '일시정지' }))
    expect(useSimulationStore.getState().isRunning).toBe(false)
    expect(screen.getByRole('button', { name: '재생' })).toBeInTheDocument()
  })

  it('lets the user change the relationship type for a pair, which updates the shared store', async () => {
    useCharacterStore.setState({ characters: [characterA, characterB] })
    const user = userEvent.setup()
    render(<LiveScreen />)

    await user.selectOptions(screen.getByRole('combobox', { name: '선택한 쌍의 관계 유형' }), '연인')
    expect(useRelationshipStore.getState().getRelationshipType('a', 'b')).toBe('romantic')
  })

  it('lets the user pick which pair to set a relationship for when 3+ characters are registered', async () => {
    const characterC = {
      id: 'c',
      name: 'Coco',
      imageDataUrl: 'data:image/png;base64,',
      displayScale: 1, footOffsetRatio: 0, imageBounds: null,
      traits: { personality: '', favoriteColor: '' },
      aiProfile: EMPTY_AI_PROFILE,
    }
    useCharacterStore.setState({ characters: [characterA, characterB, characterC] })
    const user = userEvent.setup()
    render(<LiveScreen />)

    const pairSelect = screen.getByRole('combobox', { name: '관계를 설정할 캐릭터 쌍' })
    expect(pairSelect).toBeInTheDocument()

    await user.selectOptions(pairSelect, '2')
    await user.selectOptions(screen.getByRole('combobox', { name: '선택한 쌍의 관계 유형' }), '가족')

    expect(useRelationshipStore.getState().getRelationshipType('b', 'c')).toBe('family')
    expect(useRelationshipStore.getState().getRelationshipType('a', 'b')).toBe('close')
  })

  describe('manual 대화하기 button', () => {
    // fireEvent (not userEvent) throughout this block — userEvent's internal
    // timing machinery does not play well with fake timers while
    // useCharacterMovementSimulation's own recurring setInterval is mounted
    // (it hung the test runner). A plain click/change event is all a button
    // and a <select> need here.
    beforeEach(() => {
      vi.useFakeTimers()
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
    })

    it('is visible and, with exactly 2 registered characters, auto-selects both (no pair picker needed)', async () => {
      useCharacterStore.setState({ characters: [withLines(characterA), withLines(characterB)] })
      seedCharactersInActiveRoom(['a', 'b'])
      render(<LiveScreen />)

      expect(screen.queryByRole('combobox', { name: '대화할 캐릭터 쌍' })).not.toBeInTheDocument()
      const button = screen.getByRole('button', { name: '대화하기' })
      expect(button).toBeEnabled()

      fireEvent.click(button)
      await vi.advanceTimersByTimeAsync(BUBBLE_REVEAL_INTERVAL_MS * MAX_BUNDLE_LINES)

      expect(useDialogueStore.getState().entries.length).toBeGreaterThan(0)
    })

    it('works even in quiet mode — quiet only disables the automatic (encounter) trigger', async () => {
      useDialogueFrequencyStore.setState({ mode: 'quiet' })
      useCharacterStore.setState({ characters: [withLines(characterA), withLines(characterB)] })
      seedCharactersInActiveRoom(['a', 'b'])
      render(<LiveScreen />)

      fireEvent.click(screen.getByRole('button', { name: '대화하기' }))
      await vi.advanceTimersByTimeAsync(BUBBLE_REVEAL_INTERVAL_MS * MAX_BUNDLE_LINES)

      expect(useDialogueStore.getState().entries.length).toBeGreaterThan(0)
    })

    it('is disabled while the simulation is paused, with an explanatory title', () => {
      useCharacterStore.setState({ characters: [withLines(characterA), withLines(characterB)] })
      seedCharactersInActiveRoom(['a', 'b'])
      render(<LiveScreen />)

      fireEvent.click(screen.getByRole('button', { name: '일시정지' }))

      const button = screen.getByRole('button', { name: '대화하기' })
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('title', expect.stringContaining('일시정지'))
    })

    it('shows a pair picker restricted to available (non-busy) characters when 3+ are registered, and talks between the selected pair', async () => {
      const characterC = { ...characterA, id: 'c', name: 'Coco' }
      useCharacterStore.setState({ characters: [withLines(characterA), withLines(characterB), withLines(characterC)] })
      seedCharactersInActiveRoom(['a', 'b', 'c'])
      render(<LiveScreen />)

      const pairSelect = screen.getByRole('combobox', { name: '대화할 캐릭터 쌍' }) as HTMLSelectElement
      expect(within(pairSelect).getAllByRole('option', { name: /&/ }).length).toBeGreaterThanOrEqual(3)

      const targetOption = within(pairSelect).getByRole('option', { name: 'Luna & Coco' }) as HTMLOptionElement
      fireEvent.change(pairSelect, { target: { value: targetOption.value } })
      fireEvent.click(screen.getByRole('button', { name: '대화하기' }))
      await vi.advanceTimersByTimeAsync(BUBBLE_REVEAL_INTERVAL_MS * MAX_BUNDLE_LINES)

      const speakerIds = new Set(useDialogueStore.getState().entries.map((e) => e.speakerId))
      expect(speakerIds.has('a')).toBe(false)
    })

    it('disables manual dialogue entirely when every registered character is already busy in some pair', () => {
      const characterC = { ...characterA, id: 'c', name: 'Coco' }
      useCharacterStore.setState({ characters: [withLines(characterA), withLines(characterB), withLines(characterC)] })
      seedCharactersInActiveRoom(['a', 'b', 'c'])
      useDialogueStore.getState().startConversation(['a', 'b'])
      render(<LiveScreen />)

      // With a/b already talking to each other, c has no free partner left — 0 available pairs, so no picker renders at all.
      expect(screen.queryByRole('combobox', { name: '대화할 캐릭터 쌍' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: '대화하기' })).toBeDisabled()
    })

    it('excludes only the busy character\'s pairings, still auto-usable for an available pair among the rest', () => {
      const characterC = { ...characterA, id: 'c', name: 'Coco' }
      const characterD = { ...characterA, id: 'd', name: 'Dodo' }
      useCharacterStore.setState({
        characters: [withLines(characterA), withLines(characterB), withLines(characterC), withLines(characterD)],
      })
      seedCharactersInActiveRoom(['a', 'b', 'c', 'd'])
      useDialogueStore.getState().startConversation(['a', 'b'])
      render(<LiveScreen />)

      // Only one available pair remains (Coco & Dodo) — same convenience rule as exactly-2-characters, so no picker is needed.
      expect(screen.queryByRole('combobox', { name: '대화할 캐릭터 쌍' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: '대화하기' })).toBeEnabled()
    })

    it('prevents a duplicate click while a manual conversation is already in flight', async () => {
      useCharacterStore.setState({ characters: [withLines(characterA), withLines(characterB)] })
      seedCharactersInActiveRoom(['a', 'b'])
      render(<LiveScreen />)

      const button = screen.getByRole('button', { name: '대화하기' })
      fireEvent.click(button)

      expect(screen.getByRole('button', { name: '대화 생성 중...' })).toBeDisabled()

      await vi.advanceTimersByTimeAsync(BUBBLE_REVEAL_INTERVAL_MS * MAX_BUNDLE_LINES)
      expect(screen.getByRole('button', { name: '대화하기' })).toBeEnabled()
    })

    it('still produces a conversation from the default dialogue library when neither character has any registered example line', async () => {
      useCharacterStore.setState({ characters: [characterA, characterB] }) // no dialogueLines registered
      seedCharactersInActiveRoom(['a', 'b'])
      render(<LiveScreen />)

      fireEvent.click(screen.getByRole('button', { name: '대화하기' }))
      await vi.advanceTimersByTimeAsync(BUBBLE_REVEAL_INTERVAL_MS * MAX_BUNDLE_LINES)

      expect(screen.queryByText(/대사가 없어요/)).not.toBeInTheDocument()
      expect(useDialogueStore.getState().entries.length).toBeGreaterThan(0)
    })

    it('excludes a registered character who is currently in a different room from the candidate pool (spec §9)', () => {
      const characterC = { ...characterA, id: 'c', name: 'Coco' }
      useCharacterStore.setState({ characters: [withLines(characterA), withLines(characterB), withLines(characterC)] })
      const otherRoomId = useHomeStore.getState().addRoom('bedroom', '침실', 'empty')
      const activeRoomId = useHomeStore.getState().activeLiveRoomId
      useCharacterMovementStore.setState({
        byId: {
          a: { id: 'a', roomId: activeRoomId, x: 100, y: 300, destination: null, destinationRoomId: null, currentBehavior: null, status: 'idle', restTicksRemaining: 0, stuckTicks: 0 },
          b: { id: 'b', roomId: activeRoomId, x: 130, y: 300, destination: null, destinationRoomId: null, currentBehavior: null, status: 'idle', restTicksRemaining: 0, stuckTicks: 0 },
          // Coco is registered and free, but currently in a different room — must never be offerable here.
          c: { id: 'c', roomId: otherRoomId, x: 100, y: 300, destination: null, destinationRoomId: null, currentBehavior: null, status: 'idle', restTicksRemaining: 0, stuckTicks: 0 },
        },
      })
      render(<LiveScreen />)

      // Only one pair (a & b) is available in the observed room — same convenience rule as exactly-2-characters, so no picker is needed, and it must not include Coco.
      expect(screen.queryByRole('combobox', { name: '대화할 캐릭터 쌍' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: '대화하기' })).toBeEnabled()
    })
  })

  /**
   * The needs/mood system's own logic (`needsSimulation.ts`/`moodEngine.ts`/
   * `needsStore.ts`) is fully covered in `features/needs/`'s own test
   * files — these only cover that `LiveNeedsPanel` (mounted directly here in
   * `LiveScreen.tsx`, scoped to `roomCharacters`) correctly displays and
   * reactively updates from that already-tested system, without touching
   * any needs logic itself.
   */
  describe('캐릭터 상태(욕구/기분) 표시', () => {
    it('관찰 중인 방의 캐릭터별로 기분이 표시된다', () => {
      useCharacterStore.setState({ characters: [characterA, characterB] })
      seedCharactersInActiveRoom(['a', 'b'])
      useNeedsStore.getState().setNeeds('a', { hunger: 90, energy: 90, fun: 90, social: 90 })
      useNeedsStore.getState().setNeeds('b', { hunger: 90, energy: 90, fun: 90, social: 90 })

      render(<LiveScreen />)

      const statusPanel = screen.getByLabelText('캐릭터 상태')
      expect(within(statusPanel).getAllByText(/기분:/)).toHaveLength(2)
    })

    it('배고픔/기력/즐거움/교류 4개 상태가 모두 표시된다', () => {
      useCharacterStore.setState({ characters: [characterA, characterB] })
      seedCharactersInActiveRoom(['a', 'b'])
      useNeedsStore.getState().setNeeds('a', { hunger: 50, energy: 50, fun: 50, social: 50 })

      render(<LiveScreen />)

      expect(screen.getByRole('progressbar', { name: 'Milo의 배고픔' })).toBeInTheDocument()
      expect(screen.getByRole('progressbar', { name: 'Milo의 기력' })).toBeInTheDocument()
      expect(screen.getByRole('progressbar', { name: 'Milo의 즐거움' })).toBeInTheDocument()
      expect(screen.getByRole('progressbar', { name: 'Milo의 교류' })).toBeInTheDocument()
    })

    it('needs 값이 바뀌면 화면도 즉시 갱신된다 (새로고침/화면 전환 없이)', () => {
      useCharacterStore.setState({ characters: [characterA, characterB] })
      seedCharactersInActiveRoom(['a', 'b'])
      useNeedsStore.getState().setNeeds('a', { hunger: 80, energy: 80, fun: 80, social: 80 })

      render(<LiveScreen />)
      expect(screen.getByRole('progressbar', { name: 'Milo의 배고픔' })).toHaveAttribute('aria-valuenow', '80')

      act(() => {
        useNeedsStore.getState().setNeeds('a', { hunger: 15, energy: 80, fun: 80, social: 80 })
      })

      expect(screen.getByRole('progressbar', { name: 'Milo의 배고픔' })).toHaveAttribute('aria-valuenow', '15')
    })

    it('mood가 바뀌면 기분 텍스트도 함께 갱신된다', () => {
      useCharacterStore.setState({ characters: [characterA, characterB] })
      seedCharactersInActiveRoom(['a', 'b'])
      useNeedsStore.getState().setNeeds('a', { hunger: 90, energy: 90, fun: 90, social: 90 })

      render(<LiveScreen />)
      const statusPanel = screen.getByLabelText('캐릭터 상태')
      const miloCard = within(statusPanel).getByText('Milo').closest('.live-needs-card')!
      expect(within(miloCard as HTMLElement).getByText('기분: 행복해요')).toBeInTheDocument()

      act(() => {
        useNeedsStore.getState().setNeeds('a', { hunger: 90, energy: 5, fun: 90, social: 90 })
      })

      expect(within(miloCard as HTMLElement).getByText('기분: 피곤해요')).toBeInTheDocument()
    })

    it('캐릭터가 여러 명일 때 각자 다른 욕구값이 올바르게 각각 표시된다', () => {
      useCharacterStore.setState({ characters: [characterA, characterB] })
      seedCharactersInActiveRoom(['a', 'b'])
      useNeedsStore.getState().setNeeds('a', { hunger: 20, energy: 20, fun: 20, social: 20 })
      useNeedsStore.getState().setNeeds('b', { hunger: 90, energy: 90, fun: 90, social: 90 })

      render(<LiveScreen />)

      expect(screen.getByRole('progressbar', { name: 'Milo의 배고픔' })).toHaveAttribute('aria-valuenow', '20')
      expect(screen.getByRole('progressbar', { name: 'Luna의 배고픔' })).toHaveAttribute('aria-valuenow', '90')
    })

    it('캐릭터를 삭제하면 해당 캐릭터의 상태 UI도 사라진다', () => {
      useCharacterStore.setState({ characters: [characterA, characterB] })
      seedCharactersInActiveRoom(['a', 'b'])
      useNeedsStore.getState().setNeeds('a', { hunger: 90, energy: 90, fun: 90, social: 90 })

      render(<LiveScreen />)
      const statusPanel = screen.getByLabelText('캐릭터 상태')
      expect(within(statusPanel).getByText('Milo')).toBeInTheDocument()

      // simulates the same cleanup CharacterList.tsx's own delete handler performs
      act(() => {
        useNeedsStore.getState().removeCharacter('a')
        useCharacterStore.setState({ characters: [characterB] })
      })

      expect(within(statusPanel).queryByText('Milo')).not.toBeInTheDocument()
    })

    it('save/load로 복원된 욕구값이 화면에 즉시 반영된다', () => {
      useCharacterStore.setState({ characters: [characterA, characterB] })
      seedCharactersInActiveRoom(['a', 'b'])
      useNeedsStore.getState().setNeeds('a', { hunger: 42, energy: 42, fun: 42, social: 42 })

      render(<LiveScreen />)
      expect(screen.getByRole('progressbar', { name: 'Milo의 배고픔' })).toHaveAttribute('aria-valuenow', '42')

      // the same store action saveRestore.ts calls on a real "불러오기"
      act(() => {
        useNeedsStore.getState().restoreNeeds({ a: { hunger: 77, energy: 77, fun: 77, social: 77 }, b: { hunger: 30, energy: 30, fun: 30, social: 30 } })
      })

      expect(screen.getByRole('progressbar', { name: 'Milo의 배고픔' })).toHaveAttribute('aria-valuenow', '77')
    })

    it('다른 방에 있는 캐릭터는 상태 패널에도 나타나지 않는다 (관찰 중인 방으로만 범위 제한)', () => {
      const characterC = { ...characterA, id: 'c', name: 'Coco' }
      useCharacterStore.setState({ characters: [characterA, characterB, characterC] })
      const otherRoomId = useHomeStore.getState().addRoom('bedroom', '침실', 'empty')
      const activeRoomId = useHomeStore.getState().activeLiveRoomId
      useCharacterMovementStore.setState({
        byId: {
          a: { id: 'a', roomId: activeRoomId, x: 100, y: 300, destination: null, destinationRoomId: null, currentBehavior: null, status: 'idle', restTicksRemaining: 0, stuckTicks: 0 },
          b: { id: 'b', roomId: activeRoomId, x: 130, y: 300, destination: null, destinationRoomId: null, currentBehavior: null, status: 'idle', restTicksRemaining: 0, stuckTicks: 0 },
          c: { id: 'c', roomId: otherRoomId, x: 100, y: 300, destination: null, destinationRoomId: null, currentBehavior: null, status: 'idle', restTicksRemaining: 0, stuckTicks: 0 },
        },
      })

      render(<LiveScreen />)

      const statusPanel = screen.getByLabelText('캐릭터 상태')
      expect(within(statusPanel).getByText('Milo')).toBeInTheDocument()
      expect(within(statusPanel).queryByText('Coco')).not.toBeInTheDocument()
    })
  })
})
