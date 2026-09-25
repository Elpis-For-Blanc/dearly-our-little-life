import { create } from 'zustand'
import type { MealSession } from './foodTypes'

interface MealState {
  byCharacterId: Record<string, MealSession>
  lastFinishedAt: Record<string, number>
  start: (session: MealSession) => void
  markEating: (characterId: string, now: number) => void
  finish: (characterId: string, now: number) => void
  cancel: (characterId: string) => void
}

export const useMealStore = create<MealState>((set) => ({
  byCharacterId: {},
  lastFinishedAt: {},
  start: (session) => set((state) => ({ byCharacterId: { ...state.byCharacterId, [session.characterId]: session } })),
  markEating: (characterId, now) => set((state) => {
    const current = state.byCharacterId[characterId]
    if (!current || current.stage === 'eating') return state
    return { byCharacterId: { ...state.byCharacterId, [characterId]: { ...current, stage: 'eating', eatingStartedAt: now } } }
  }),
  finish: (characterId, now) => set((state) => {
    const next = { ...state.byCharacterId }
    delete next[characterId]
    return { byCharacterId: next, lastFinishedAt: { ...state.lastFinishedAt, [characterId]: now } }
  }),
  cancel: (characterId) => set((state) => {
    if (!state.byCharacterId[characterId]) return state
    const next = { ...state.byCharacterId }
    delete next[characterId]
    return { byCharacterId: next }
  }),
}))
