import { create } from 'zustand'

export type FurnitureUsageStatus = 'approaching' | 'seated'

export interface FurnitureUsageEntry {
  characterId: string
  placementId: string
  roomId: string
  slotId: string
  status: FurnitureUsageStatus
  /** Consecutive movement ticks spent still approaching (not yet arrived) — the safety timeout (MAX_FURNITURE_APPROACH_TICKS) reads this. Meaningless once `status` is 'seated'. */
  approachTicks: number
}

/** One placement can have several independent seats (e.g. the 2-seat sofa's `sofa-left`/`sofa-right`) — this is the map key each seat's own reservation lives under, opaque outside this module (every caller reaches a seat's `placementId`/`slotId` back out through the entry itself, never by parsing the key). */
function seatKey(placementId: string, slotId: string): string {
  return `${placementId}:${slotId}`
}

/**
 * Ephemeral, session-only seat reservation/occupancy state — deliberately
 * has no `persist` middleware, same rationale as `characterMovementStore`
 * and `dialogueStore`'s conversation-tracking fields: a mid-approach walk or
 * a seated character is exactly as reproducible on reload as any other
 * in-progress movement, and nothing here is real save data (the furniture's
 * own placement/color/pattern data lives in `homeStore`, untouched by this
 * store). A reload always comes back with every seat free.
 *
 * Keyed **per seat** (`placementId` + `slotId`, via `seatKey`), not per
 * placement — a piece with multiple `kind: 'sit'` slots (the sofa's two,
 * a chair's one) gets one independent reservation per slot, so one seat
 * filling up or freeing never touches another seat on the very same piece.
 * One seat per character — `reserve` enforces both by refusing if either
 * side is already taken.
 */
interface FurnitureUsageStoreState {
  bySeatKey: Record<string, FurnitureUsageEntry>
  byCharacterId: Record<string, string>
  /** Reserves the seat named by `entry.placementId`+`entry.slotId` for `entry.characterId` (status starts 'approaching'). Returns false — and changes nothing — if that exact seat is already reserved/occupied by someone else, or the character is already using a different seat. */
  reserve: (entry: Pick<FurnitureUsageEntry, 'characterId' | 'placementId' | 'roomId' | 'slotId'>) => boolean
  /** Marks the character's current reservation as seated (no-op if they have none). */
  markSeated: (characterId: string) => void
  /** Increments and returns the approach-tick counter for `characterId`'s current reservation; returns 0 if they have none. */
  incrementApproachTicks: (characterId: string) => number
  /** Releases whatever seat `characterId` is reserving/occupying, if any — safe to call unconditionally from any cleanup path. Touches only that one character's own seat, never any other seat on the same placement. */
  release: (characterId: string) => void
  /** Releases one specific seat by placement+slot id, if occupied — used when moving an already-seated character to a *different* seat (release the old one first), or by `releasePlacement` below. */
  releaseSeat: (placementId: string, slotId: string) => void
  /** Releases *every* seat belonging to `placementId` — used when the whole piece of furniture is deleted, moved, rotated, or resized (its geometry invalidates every seat on it at once, not just one). */
  releasePlacement: (placementId: string) => void
  reset: () => void
}

const INITIAL = { bySeatKey: {}, byCharacterId: {} }

export const useFurnitureUsageStore = create<FurnitureUsageStoreState>((set, get) => ({
  ...INITIAL,
  reserve: (entry) => {
    const state = get()
    const key = seatKey(entry.placementId, entry.slotId)
    if (state.bySeatKey[key]) return false
    if (state.byCharacterId[entry.characterId]) return false
    set({
      bySeatKey: { ...state.bySeatKey, [key]: { ...entry, status: 'approaching', approachTicks: 0 } },
      byCharacterId: { ...state.byCharacterId, [entry.characterId]: key },
    })
    return true
  },
  markSeated: (characterId) =>
    set((state) => {
      const key = state.byCharacterId[characterId]
      const usage = key ? state.bySeatKey[key] : undefined
      if (!key || !usage) return state
      return { bySeatKey: { ...state.bySeatKey, [key]: { ...usage, status: 'seated', approachTicks: 0 } } }
    }),
  incrementApproachTicks: (characterId) => {
    const state = get()
    const key = state.byCharacterId[characterId]
    const usage = key ? state.bySeatKey[key] : undefined
    if (!key || !usage) return 0
    const next = usage.approachTicks + 1
    set({ bySeatKey: { ...state.bySeatKey, [key]: { ...usage, approachTicks: next } } })
    return next
  },
  release: (characterId) =>
    set((state) => {
      const key = state.byCharacterId[characterId]
      if (!key) return state
      const { [key]: _removedSeat, ...restSeats } = state.bySeatKey
      const { [characterId]: _removedCharacter, ...restCharacters } = state.byCharacterId
      return { bySeatKey: restSeats, byCharacterId: restCharacters }
    }),
  releaseSeat: (placementId, slotId) =>
    set((state) => {
      const key = seatKey(placementId, slotId)
      const usage = state.bySeatKey[key]
      if (!usage) return state
      const { [key]: _removedSeat, ...restSeats } = state.bySeatKey
      const { [usage.characterId]: _removedCharacter, ...restCharacters } = state.byCharacterId
      return { bySeatKey: restSeats, byCharacterId: restCharacters }
    }),
  releasePlacement: (placementId) =>
    set((state) => {
      const seatsToDrop = Object.entries(state.bySeatKey).filter(([, usage]) => usage.placementId === placementId)
      if (seatsToDrop.length === 0) return state
      const restSeats = { ...state.bySeatKey }
      const restCharacters = { ...state.byCharacterId }
      for (const [key, usage] of seatsToDrop) {
        delete restSeats[key]
        delete restCharacters[usage.characterId]
      }
      return { bySeatKey: restSeats, byCharacterId: restCharacters }
    }),
  reset: () => set({ ...INITIAL }),
}))
