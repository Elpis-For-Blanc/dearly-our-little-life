import { create } from 'zustand'
import { AUTO_FURNITURE_USE_RECENT_HISTORY_SIZE } from './autoFurnitureUseConfig'

export interface ActiveAutoFurnitureUse {
  placementId: string
  slotId: string
  roomId: string
  /**
   * Set once the character actually arrives and is occupying the slot
   * (`markSeated`) — the real-time deadline after which
   * `autoFurnitureUseTrigger.ts`'s pass calls the existing `standUp`. Null
   * while still walking over (mirrors `furnitureUsageStore`'s own
   * `'approaching'` vs. `'seated'` split, one level up).
   */
  standUpAt: number | null
}

/**
 * Ephemeral, session-only bookkeeping for *automatically*-initiated
 * furniture use — deliberately separate from `furnitureUsageStore` (the one
 * real reservation/occupancy ledger every manual and automatic use shares)
 * the same way `monologueStore` stays separate from `dialogueStore`'s
 * conversation-tracking fields: this store only ever tracks "is this
 * particular session one *I* (the auto system) started, and when should it
 * end", never the seat reservation itself. No `persist` — regenerates every
 * session, same rationale as every other simulation runtime store.
 */
interface AutoFurnitureUseState {
  activeByCharacter: Record<string, ActiveAutoFurnitureUse>
  /** When each character's most recent auto furniture use *successfully ended* — the per-character success-cooldown reference. */
  lastEndedAtByCharacter: Record<string, number>
  /** When each character's most recent auto furniture use *attempt failed* (lost a reservation race, or timed out before arriving) — the separate, shorter retry-cooldown reference. */
  lastFailedAtByCharacter: Record<string, number>
  /** Each character's own most-recently auto-used placement ids (capped to AUTO_FURNITURE_USE_RECENT_HISTORY_SIZE) — soft repeat-suppression. */
  recentPlacementIdsByCharacter: Record<string, string[]>
  /** Begins tracking a newly-started auto session (status 'approaching' in furnitureUsageStore terms — standUpAt starts null). */
  startAuto: (characterId: string, placementId: string, slotId: string, roomId: string) => void
  /** Marks the character's current auto session as seated/lying/lingering, recording when it should end. No-op if the character has no active session. */
  markSeated: (characterId: string, standUpAt: number) => void
  /** Ends the character's current auto session as a success — clears it and stamps the success cooldown. */
  endAuto: (characterId: string, now: number) => void
  /** Ends the character's current auto session (if any) as a failure — clears it and stamps the shorter retry cooldown instead of the success cooldown. */
  markFailed: (characterId: string, now: number) => void
  /** Records `placementId` as this character's most recent auto pick, for repeat-suppression. */
  recordUsed: (characterId: string, placementId: string) => void
  /** Drops every per-character reference this store holds for `characterId` — call once, when a character is actually deleted, mirroring monologueStore.ts's own `forgetCharacter`. */
  forgetCharacter: (characterId: string) => void
  reset: () => void
}

const INITIAL = {
  activeByCharacter: {},
  lastEndedAtByCharacter: {},
  lastFailedAtByCharacter: {},
  recentPlacementIdsByCharacter: {},
}

export const useAutoFurnitureUseStore = create<AutoFurnitureUseState>((set) => ({
  ...INITIAL,
  startAuto: (characterId, placementId, slotId, roomId) =>
    set((state) => ({
      activeByCharacter: { ...state.activeByCharacter, [characterId]: { placementId, slotId, roomId, standUpAt: null } },
    })),
  markSeated: (characterId, standUpAt) =>
    set((state) => {
      const active = state.activeByCharacter[characterId]
      if (!active) return state
      return { activeByCharacter: { ...state.activeByCharacter, [characterId]: { ...active, standUpAt } } }
    }),
  endAuto: (characterId, now) =>
    set((state) => {
      if (!(characterId in state.activeByCharacter)) return state
      const { [characterId]: _removed, ...restActive } = state.activeByCharacter
      return { activeByCharacter: restActive, lastEndedAtByCharacter: { ...state.lastEndedAtByCharacter, [characterId]: now } }
    }),
  markFailed: (characterId, now) =>
    set((state) => {
      const { [characterId]: _removed, ...restActive } = state.activeByCharacter
      return { activeByCharacter: restActive, lastFailedAtByCharacter: { ...state.lastFailedAtByCharacter, [characterId]: now } }
    }),
  recordUsed: (characterId, placementId) =>
    set((state) => ({
      recentPlacementIdsByCharacter: {
        ...state.recentPlacementIdsByCharacter,
        [characterId]: [...(state.recentPlacementIdsByCharacter[characterId] ?? []), placementId].slice(-AUTO_FURNITURE_USE_RECENT_HISTORY_SIZE),
      },
    })),
  forgetCharacter: (characterId) =>
    set((state) => {
      const drop = <T,>(record: Record<string, T>): Record<string, T> => {
        if (!(characterId in record)) return record
        const { [characterId]: _removed, ...rest } = record
        return rest
      }
      return {
        activeByCharacter: drop(state.activeByCharacter),
        lastEndedAtByCharacter: drop(state.lastEndedAtByCharacter),
        lastFailedAtByCharacter: drop(state.lastFailedAtByCharacter),
        recentPlacementIdsByCharacter: drop(state.recentPlacementIdsByCharacter),
      }
    }),
  reset: () => set({ ...INITIAL }),
}))
