import { create } from 'zustand'

interface SimulationState {
  isRunning: boolean
  tick: number
  start: () => void
  pause: () => void
  advanceTick: () => void
}

export const useSimulationStore = create<SimulationState>((set) => ({
  isRunning: false,
  tick: 0,
  start: () => set({ isRunning: true }),
  pause: () => set({ isRunning: false }),
  advanceTick: () => set((state) => ({ tick: state.tick + 1 })),
}))
