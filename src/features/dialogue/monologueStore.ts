import { create } from 'zustand'
import { RECENT_MONOLOGUE_HISTORY_SIZE } from './monologueConfig'

export interface ActiveMonologue {
  lineId: string
  text: string
  startedAt: number
  expiresAt: number
}

/**
 * Runtime-only monologue state — never persisted (only the frequency *mode*
 * is, see monologueFrequencyStore.ts). Deliberately separate from
 * `dialogueStore`: its `activeBubbleByCharacter` stays "the character's line
 * in a real conversation", and its recency records
 * (`recentAutoLineIdsByCharacter`, `recentDefaultBundleIdsByPair`) stay
 * two-person-dialogue-only, per spec. CharacterToken shows at most one of the
 * two bubbles per character, with the conversation bubble winning.
 */
interface MonologueState {
  activeByCharacter: Record<string, ActiveMonologue>
  /** When each character's most recent monologue started — the per-character cooldown reference. */
  lastMonologueAtByCharacter: Record<string, number>
  recentLineIdsByCharacter: Record<string, string[]>
  /** When each character most recently arrived in a different room (a monologue trigger context). */
  lastRoomArrivalAtByCharacter: Record<string, number>
  showMonologue: (characterId: string, lineId: string, text: string, now: number, durationMs: number) => void
  clearMonologue: (characterId: string) => void
  markRoomArrival: (characterId: string, now: number) => void
  /** Drops every per-character reference this store holds for `characterId` — call once, when a character is actually deleted (not on an ordinary room change, which should keep its history). Ephemeral state anyway (never persisted), but this avoids an unbounded, never-visited entry lingering for the rest of the session. */
  forgetCharacter: (characterId: string) => void
  reset: () => void
}

const INITIAL = {
  activeByCharacter: {},
  lastMonologueAtByCharacter: {},
  recentLineIdsByCharacter: {},
  lastRoomArrivalAtByCharacter: {},
}

export const useMonologueStore = create<MonologueState>((set) => ({
  ...INITIAL,
  showMonologue: (characterId, lineId, text, now, durationMs) =>
    set((state) => ({
      activeByCharacter: { ...state.activeByCharacter, [characterId]: { lineId, text, startedAt: now, expiresAt: now + durationMs } },
      lastMonologueAtByCharacter: { ...state.lastMonologueAtByCharacter, [characterId]: now },
      recentLineIdsByCharacter: {
        ...state.recentLineIdsByCharacter,
        [characterId]: [...(state.recentLineIdsByCharacter[characterId] ?? []), lineId].slice(-RECENT_MONOLOGUE_HISTORY_SIZE),
      },
    })),
  clearMonologue: (characterId) =>
    set((state) => {
      if (!(characterId in state.activeByCharacter)) return state
      const { [characterId]: _removed, ...rest } = state.activeByCharacter
      return { activeByCharacter: rest }
    }),
  markRoomArrival: (characterId, now) =>
    set((state) => ({ lastRoomArrivalAtByCharacter: { ...state.lastRoomArrivalAtByCharacter, [characterId]: now } })),
  forgetCharacter: (characterId) =>
    set((state) => {
      const drop = <T,>(record: Record<string, T>): Record<string, T> => {
        if (!(characterId in record)) return record
        const { [characterId]: _removed, ...rest } = record
        return rest
      }
      return {
        activeByCharacter: drop(state.activeByCharacter),
        lastMonologueAtByCharacter: drop(state.lastMonologueAtByCharacter),
        recentLineIdsByCharacter: drop(state.recentLineIdsByCharacter),
        lastRoomArrivalAtByCharacter: drop(state.lastRoomArrivalAtByCharacter),
      }
    }),
  reset: () => set({ ...INITIAL }),
}))
