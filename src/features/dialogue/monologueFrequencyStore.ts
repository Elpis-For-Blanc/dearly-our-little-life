import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_MONOLOGUE_FREQUENCY, MONOLOGUE_FREQUENCY_PRESETS, type MonologueFrequencyMode } from './monologueConfig'

interface MonologueFrequencyState {
  mode: MonologueFrequencyMode
  setMode: (mode: MonologueFrequencyMode) => void
}

function normalizeMode(value: unknown): MonologueFrequencyMode {
  return typeof value === 'string' && Object.hasOwn(MONOLOGUE_FREQUENCY_PRESETS, value)
    ? (value as MonologueFrequencyMode)
    : DEFAULT_MONOLOGUE_FREQUENCY
}

/** Persists only the chosen mode — cooldown timestamps, recent ids and active bubbles live in the non-persisted monologueStore. Missing/corrupt saved data falls back to '보통'. */
export const useMonologueFrequencyStore = create<MonologueFrequencyState>()(
  persist(
    (set) => ({
      mode: DEFAULT_MONOLOGUE_FREQUENCY,
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'dearly-monologue-frequency',
      partialize: (state) => ({ mode: state.mode }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<MonologueFrequencyState> | undefined
        return { ...currentState, mode: normalizeMode(persisted?.mode) }
      },
    },
  ),
)
