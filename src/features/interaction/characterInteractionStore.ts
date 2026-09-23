import { create } from 'zustand'
import type { CharacterInteractionSession } from './characterInteractionTypes'

/**
 * Ephemeral, session-only character-to-character interaction state —
 * deliberately has **no** `persist` middleware, the exact same rationale as
 * `furnitureUsageStore.ts`/`characterMovementStore.ts`/`dialogueStore.ts`'s
 * own conversation-tracking fields: an in-progress hug or a cooldown timer
 * is exactly as reproducible on reload as any other in-progress movement,
 * and none of it is real save data. A reload (or a manual "불러오기") always
 * comes back with every character free — `features/save/saveRestore.ts`
 * explicitly calls this store's `reset()` for that reason (see its own
 * comment there).
 */
interface CharacterInteractionState {
  sessions: Record<string, CharacterInteractionSession>
  /** character id -> session id, for O(1) "is this character already in a session" lookups. */
  byCharacterId: Record<string, string>
  /** pairKey(idA, idB) -> when their last interaction *successfully* ended — the normal, longer cooldown. */
  lastEndedAtByPair: Record<string, number>
  /** pairKey(idA, idB) -> when their last interaction *attempt* failed (lost a seat race, approach timed out, a participant became busy mid-approach) — a separate, shorter retry cooldown. */
  lastFailedAtByPair: Record<string, number>
  isCharacterBusy: (characterId: string) => boolean
  /** Registers a new session and locks both participants busy — refuses (returns null) if either is already in a session. */
  start: (session: CharacterInteractionSession) => string | null
  update: (sessionId: string, patch: Partial<CharacterInteractionSession>) => void
  /** Removes the session and frees both participants — safe to call on an id that no longer exists (no-op). */
  end: (sessionId: string) => void
  markEndedForPair: (pairKeyValue: string, now: number) => void
  markFailedForPair: (pairKeyValue: string, now: number) => void
  reset: () => void
}

const INITIAL = { sessions: {}, byCharacterId: {}, lastEndedAtByPair: {}, lastFailedAtByPair: {} }

export const useCharacterInteractionStore = create<CharacterInteractionState>((set, get) => ({
  ...INITIAL,
  isCharacterBusy: (characterId) => characterId in get().byCharacterId,
  start: (session) => {
    const state = get()
    if (state.byCharacterId[session.characterAId] || state.byCharacterId[session.characterBId]) return null
    set({
      sessions: { ...state.sessions, [session.id]: session },
      byCharacterId: { ...state.byCharacterId, [session.characterAId]: session.id, [session.characterBId]: session.id },
    })
    return session.id
  },
  update: (sessionId, patch) =>
    set((state) => {
      const session = state.sessions[sessionId]
      if (!session) return state
      return { sessions: { ...state.sessions, [sessionId]: { ...session, ...patch } } }
    }),
  end: (sessionId) =>
    set((state) => {
      const session = state.sessions[sessionId]
      if (!session) return state
      const { [sessionId]: _removedSession, ...restSessions } = state.sessions
      const { [session.characterAId]: _a, [session.characterBId]: _b, ...restByCharacter } = state.byCharacterId
      return { sessions: restSessions, byCharacterId: restByCharacter }
    }),
  markEndedForPair: (pairKeyValue, now) => set((state) => ({ lastEndedAtByPair: { ...state.lastEndedAtByPair, [pairKeyValue]: now } })),
  markFailedForPair: (pairKeyValue, now) => set((state) => ({ lastFailedAtByPair: { ...state.lastFailedAtByPair, [pairKeyValue]: now } })),
  reset: () => set({ ...INITIAL }),
}))
