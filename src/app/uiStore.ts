import { create } from 'zustand'

export type AppPhase = 'setup' | 'decorate' | 'live'

interface UiState {
  phase: AppPhase
  setPhase: (phase: AppPhase) => void
}

export const useUiStore = create<UiState>((set) => ({
  phase: 'setup',
  setPhase: (phase) => set({ phase }),
}))
