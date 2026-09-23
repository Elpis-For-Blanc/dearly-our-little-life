import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startManualConversation } from './autoDialogueTrigger'
import { useCharacterStore } from '../character/characterStore'
import { EMPTY_AI_PROFILE, type Character } from '../character/types'
import { useCharacterMovementStore } from '../simulation/characterMovementStore'
import { useSimulationStore } from '../simulation/simulationStore'
import { useDialogueStore } from './dialogueStore'
import { useDialogueFrequencyStore } from './dialogueFrequencyStore'
import { useRelationshipStore } from './relationshipStore'
import { pairKey } from './pairKey'

function characterWithLines(id: string, name: string): Character {
  return {
    id,
    name,
    imageDataUrl: 'data:image/png;base64,',
    displayScale: 1,
    footOffsetRatio: 0,
    imageBounds: null,
    traits: { personality: '', favoriteColor: '' },
    aiProfile: {
      ...EMPTY_AI_PROFILE,
      dialogueLines: [
        { id: `${id}-1`, categoryId: 'casual-chat', situationNote: '', text: `${name} 안녕`, emotion: 'neutral', tags: [], isFallback: false },
        { id: `${id}-2`, categoryId: 'casual-chat', situationNote: '', text: `${name} 반가워`, emotion: 'neutral', tags: [], isFallback: false },
      ],
    },
  }
}

const situationRef = { current: { time: '오후', place: '거실', actionA: '', actionB: '' } }
const mountedRef = { current: true }

describe('startManualConversation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useDialogueStore.setState({
      entries: [],
      activeConversations: {},
      lastConversationEndAtByPair: {},
      recentAutoLineIdsByCharacter: {},
      activeBubbleByCharacter: {},
    })
    useCharacterStore.setState({ characters: [characterWithLines('a', 'Milo'), characterWithLines('b', 'Luna')] })
    useCharacterMovementStore.setState({
      byId: {
        a: { id: 'a', roomId: 'room-1', x: 300, y: 300, destination: null, destinationRoomId: null, currentBehavior: null, status: 'idle', restTicksRemaining: 0, stuckTicks: 0 },
        b: { id: 'b', roomId: 'room-1', x: 310, y: 300, destination: null, destinationRoomId: null, currentBehavior: null, status: 'idle', restTicksRemaining: 0, stuckTicks: 0 },
      },
    })
    useRelationshipStore.setState({ defaultRelationshipType: 'close', relationshipsByPair: {} })
    useSimulationStore.setState({ isRunning: true, tick: 0 })
    mountedRef.current = true
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('works in quiet mode — the frequency gate only applies to the automatic (encounter) trigger', async () => {
    useDialogueFrequencyStore.setState({ mode: 'quiet' })
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    const promise = startManualConversation('a', 'b', situationRef, mountedRef)
    await vi.runAllTimersAsync()
    const outcome = await promise

    expect(outcome).toBe('started')
    expect(useDialogueStore.getState().entries.length).toBeGreaterThan(0)
  })

  it('marks both characters talking during the conversation and idle again after', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    const promise = startManualConversation('a', 'b', situationRef, mountedRef)
    expect(useCharacterMovementStore.getState().byId.a.status).toBe('talking')
    expect(useCharacterMovementStore.getState().byId.b.status).toBe('talking')

    await vi.runAllTimersAsync()
    await promise

    expect(useCharacterMovementStore.getState().byId.a.status).toBe('idle')
    expect(useCharacterMovementStore.getState().byId.b.status).toBe('idle')
  })

  it('sets and clears each speaker\'s floating bubble text as the conversation runs, keyed by character id', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    const promise = startManualConversation('a', 'b', situationRef, mountedRef)
    await vi.advanceTimersByTimeAsync(0)
    // At least one participant should have an active bubble while the conversation is running.
    const midFlight = useDialogueStore.getState().activeBubbleByCharacter
    expect(Object.keys(midFlight).length).toBeGreaterThan(0)

    await vi.runAllTimersAsync()
    await promise

    expect(useDialogueStore.getState().activeBubbleByCharacter).toEqual({})
  })

  it('refuses to start (returns "busy") if a participant is already in another conversation', async () => {
    useDialogueStore.getState().startConversation(['a', 'c'])

    const outcome = await startManualConversation('a', 'b', situationRef, mountedRef)

    expect(outcome).toBe('busy')
    expect(useDialogueStore.getState().entries).toHaveLength(0)
  })

  it('still starts a conversation via the default dialogue library when neither character has any registered example line', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    useCharacterStore.setState({
      characters: [
        { ...characterWithLines('a', 'Milo'), aiProfile: { ...EMPTY_AI_PROFILE, dialogueLines: [] } },
        { ...characterWithLines('b', 'Luna'), aiProfile: { ...EMPTY_AI_PROFILE, dialogueLines: [] } },
      ],
    })

    const promise = startManualConversation('a', 'b', situationRef, mountedRef)
    await vi.runAllTimersAsync()
    const outcome = await promise

    expect(outcome).toBe('started')
    expect(useDialogueStore.getState().entries.length).toBeGreaterThan(0)
  })

  it('returns "missing_characters" for an unknown id instead of throwing', async () => {
    const outcome = await startManualConversation('a', 'does-not-exist', situationRef, mountedRef)
    expect(outcome).toBe('missing_characters')
  })

  it('stamps the pair cooldown on completion, same as the automatic trigger', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    const promise = startManualConversation('a', 'b', situationRef, mountedRef)
    await vi.runAllTimersAsync()
    await promise

    expect(useDialogueStore.getState().lastConversationEndAtByPair[pairKey('a', 'b')]).toBeGreaterThan(0)
  })
})
