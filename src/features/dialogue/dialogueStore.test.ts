import { beforeEach, describe, expect, it } from 'vitest'
import { useDialogueStore } from './dialogueStore'
import { pairKey } from './pairKey'

describe('dialogueStore conversation tracking', () => {
  beforeEach(() => {
    useDialogueStore.setState({
      entries: [],
      activeConversations: {},
      lastConversationEndAtByPair: {},
      recentAutoLineIdsByCharacter: {},
      recentDefaultBundleIdsByPair: {},
    })
  })

  it('startConversation succeeds when all participants are idle and marks them busy', () => {
    const id = useDialogueStore.getState().startConversation(['a', 'b'])
    expect(id).not.toBeNull()
    expect(useDialogueStore.getState().isCharacterBusy('a')).toBe(true)
    expect(useDialogueStore.getState().isCharacterBusy('b')).toBe(true)
    expect(useDialogueStore.getState().isCharacterBusy('c')).toBe(false)
  })

  it('refuses to start a conversation if any participant is already busy', () => {
    useDialogueStore.getState().startConversation(['a', 'b'])
    const secondAttempt = useDialogueStore.getState().startConversation(['b', 'c'])
    expect(secondAttempt).toBeNull()
    expect(useDialogueStore.getState().isCharacterBusy('c')).toBe(false)
  })

  it('allows two fully disjoint pairs to converse at the same time', () => {
    const first = useDialogueStore.getState().startConversation(['a', 'b'])
    const second = useDialogueStore.getState().startConversation(['c', 'd'])
    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    expect(first).not.toBe(second)
    expect(useDialogueStore.getState().isCharacterBusy('a')).toBe(true)
    expect(useDialogueStore.getState().isCharacterBusy('c')).toBe(true)
  })

  it('endConversation frees the participants and stamps that pair\'s cooldown only', () => {
    const id = useDialogueStore.getState().startConversation(['a', 'b'])!
    const before = Date.now()
    useDialogueStore.getState().endConversation(id, pairKey('a', 'b'))

    expect(useDialogueStore.getState().isCharacterBusy('a')).toBe(false)
    expect(useDialogueStore.getState().isCharacterBusy('b')).toBe(false)
    expect(useDialogueStore.getState().lastConversationEndAtByPair[pairKey('a', 'b')]).toBeGreaterThanOrEqual(before)
    expect(useDialogueStore.getState().lastConversationEndAtByPair[pairKey('c', 'd')]).toBeUndefined()
  })

  it('a character freed from one conversation can immediately join a new one', () => {
    const id = useDialogueStore.getState().startConversation(['a', 'b'])!
    useDialogueStore.getState().endConversation(id, pairKey('a', 'b'))
    const secondId = useDialogueStore.getState().startConversation(['a', 'c'])
    expect(secondId).not.toBeNull()
  })

  it('recordAutoLineUsed tracks recent lines per character and caps the history size', () => {
    for (let i = 0; i < 10; i++) {
      useDialogueStore.getState().recordAutoLineUsed('char-a', `line-${i}`)
    }
    const recent = useDialogueStore.getState().recentAutoLineIdsByCharacter['char-a']
    expect(recent.length).toBeLessThanOrEqual(6)
    expect(recent).toContain('line-9')
    expect(recent).not.toContain('line-0')
  })

  it('recordDefaultBundleUsed tracks recent bundle ids per pair, separate from per-character line tracking, and caps its own history size', () => {
    for (let i = 0; i < 10; i++) {
      useDialogueStore.getState().recordDefaultBundleUsed(pairKey('a', 'b'), `bundle-${i}`)
    }
    const recent = useDialogueStore.getState().recentDefaultBundleIdsByPair[pairKey('a', 'b')]
    expect(recent.length).toBeLessThanOrEqual(5)
    expect(recent).toContain('bundle-9')
    expect(recent).not.toContain('bundle-0')

    // A different pair's record is untouched.
    expect(useDialogueStore.getState().recentDefaultBundleIdsByPair[pairKey('c', 'd')]).toBeUndefined()
    // recordAutoLineUsed and recordDefaultBundleUsed write to genuinely separate state.
    useDialogueStore.getState().recordAutoLineUsed('a', 'some-line')
    expect(useDialogueStore.getState().recentDefaultBundleIdsByPair[pairKey('a', 'b')]).toEqual(recent)
  })
})
