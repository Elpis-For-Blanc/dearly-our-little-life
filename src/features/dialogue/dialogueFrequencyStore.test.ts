import { beforeEach, describe, expect, it } from 'vitest'
import { useDialogueFrequencyStore } from './dialogueFrequencyStore'

describe('dialogueFrequencyStore', () => {
  beforeEach(() => {
    useDialogueFrequencyStore.setState({ mode: 'normal' })
  })

  it('defaults to normal', () => {
    expect(useDialogueFrequencyStore.getState().mode).toBe('normal')
  })

  it('setMode updates the mode', () => {
    useDialogueFrequencyStore.getState().setMode('rowdy')
    expect(useDialogueFrequencyStore.getState().mode).toBe('rowdy')
  })

  it('merge falls back to the default when old saved data is missing the field', () => {
    const merge = useDialogueFrequencyStore.persist.getOptions().merge!
    const merged = merge({}, useDialogueFrequencyStore.getState()) as { mode: string }
    expect(merged.mode).toBe('normal')
  })

  it('merge falls back to the default when the saved value is not a known mode', () => {
    const merge = useDialogueFrequencyStore.persist.getOptions().merge!
    const merged = merge({ mode: 'not-a-real-mode' }, useDialogueFrequencyStore.getState()) as { mode: string }
    expect(merged.mode).toBe('normal')
  })
})
