import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_DIALOGUE_FREQUENCY, DIALOGUE_FREQUENCY_PRESETS, type DialogueFrequencyMode } from './autoDialogueConfig'

interface DialogueFrequencyState {
  mode: DialogueFrequencyMode
  setMode: (mode: DialogueFrequencyMode) => void
}

function normalizeMode(value: unknown): DialogueFrequencyMode {
  return typeof value === 'string' && value in DIALOGUE_FREQUENCY_PRESETS ? (value as DialogueFrequencyMode) : DEFAULT_DIALOGUE_FREQUENCY
}

export const useDialogueFrequencyStore = create<DialogueFrequencyState>()(
  persist(
    (set) => ({
      mode: DEFAULT_DIALOGUE_FREQUENCY,
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'dearly-dialogue-frequency',
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<DialogueFrequencyState> | undefined
        return { ...currentState, mode: normalizeMode(persisted?.mode) }
      },
    },
  ),
)
