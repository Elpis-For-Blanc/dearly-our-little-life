import { create } from 'zustand'
import type { BehaviorType } from '../character/personalityTags'
import type { Point } from './movementEngine'

/**
 * `'seated'`/`'lying'`/`'lingering'` are a character currently occupying a
 * furniture interaction slot (see furnitureUsageStore.ts) — movement-paused
 * exactly like `'talking'`, one status per interaction *kind* (`'sit'` →
 * `'seated'` on a sofa/chair, `'lie'` → `'lying'` on a bed, `'stand'` →
 * `'lingering'` at a table) so the three stay clearly distinguishable, per
 * CLAUDE.md's "소파·의자 착석 상태와 테이블 머무르기 상태는 명확히 구분"
 * requirement. A character walking toward a furniture destination stays
 * `'moving'` (ordinary, collision-checked movement) right up until arrival;
 * only the final transition sets the kind-appropriate status.
 *
 * `'interacting'` (added for the character-to-character interaction system,
 * `features/interaction/`) covers `stayTogether`/`hug`/`holdHands` — the
 * three new interaction kinds that don't use furniture at all, for both
 * their approach *and* held phase (see `characterInteractionTrigger.ts`'s
 * own doc comment for why: it steps the two characters toward each other
 * itself, reusing movementEngine's primitives directly, rather than letting
 * the ordinary per-character wander loop touch them mid-interaction). `talk`
 * reuses the existing `'talking'` status (no new status needed — it
 * delegates entirely to the existing dialogue system); `sitTogether` reuses
 * the existing `'seated'` status (it delegates entirely to the existing
 * furniture-seat system, via the same `startSitting`/`standUp` any other
 * seat use already goes through).
 */
export type MovementStatus = 'idle' | 'moving' | 'talking' | 'seated' | 'lying' | 'lingering' | 'interacting'

export interface CharacterMovementState {
  id: string
  /** Which room this character is physically in right now — the single source of truth `LiveRoomView.tsx` filters on and `useCharacterMovementSimulation.ts` groups movement/encounters by. */
  roomId: string
  x: number
  y: number
  destination: Point | null
  /** Non-null only while walking to `roomId`'s doorway to leave — the room this character will switch into on arrival. Cleared (not preserved) if a collision forces a replan, so a blocked room-change attempt doesn't leave stale intent lying around; it can simply be re-rolled later. */
  destinationRoomId: string | null
  /** The behavior currently driving `destination` — the spec's "현재 행동". Null only very briefly, before the first tick ever picks one. */
  currentBehavior: BehaviorType | null
  status: MovementStatus
  /** Ticks left in a "rest" (게으름/차분함-weighted) pause before picking a new destination — 0 means not resting. */
  restTicksRemaining: number
  /** Consecutive ticks this character's step has been blocked by collision — resets to 0 on any successful step. See MAX_STUCK_TICKS (movementConfig.ts) for why this exists: without it, two characters landing on the exact same point (which happens routinely at doorways, since every room's doorway is the same fixed coordinate) can deadlock forever. */
  stuckTicks: number
}

export interface SpawnResult {
  position: Point
  roomId: string
}

/**
 * Runtime-only positions/status for the movement simulation, keyed by
 * character id — deliberately not persisted (no `persist` middleware),
 * same rationale as `dialogueStore`'s conversation-tracking fields: this is
 * ephemeral simulation state, not save data, and regenerates every session.
 */
interface CharacterMovementStoreState {
  byId: Record<string, CharacterMovementState>
  /** Adds a starting entry for any id not yet tracked, and drops entries for ids no longer in `ids` (a character was removed). */
  syncCharacterIds: (ids: string[], spawn: (id: string) => SpawnResult) => void
  setPosition: (id: string, position: Point) => void
  setDestination: (id: string, destination: Point | null) => void
  setDestinationRoomId: (id: string, roomId: string | null) => void
  setRoomId: (id: string, roomId: string) => void
  setCurrentBehavior: (id: string, behavior: BehaviorType | null) => void
  setStatus: (id: string, status: MovementStatus) => void
  setRestTicksRemaining: (id: string, ticks: number) => void
  setStuckTicks: (id: string, ticks: number) => void
  /** Used by the room-deletion flow to relocate every character out of a room being removed — teleports directly (no doorway walk), since the room they're standing in is about to stop existing. */
  moveCharacterToRoom: (id: string, roomId: string, position: Point) => void
}

function updateEntry(
  byId: Record<string, CharacterMovementState>,
  id: string,
  patch: Partial<CharacterMovementState>,
): Record<string, CharacterMovementState> {
  const entry = byId[id]
  if (!entry) return byId
  return { ...byId, [id]: { ...entry, ...patch } }
}

export const useCharacterMovementStore = create<CharacterMovementStoreState>((set, get) => ({
  byId: {},
  syncCharacterIds: (ids, spawn) => {
    const current = get().byId
    const idSet = new Set(ids)
    const next: Record<string, CharacterMovementState> = {}

    for (const id of ids) {
      if (current[id]) {
        next[id] = current[id]
      } else {
        const { position, roomId } = spawn(id)
        next[id] = {
          id,
          roomId,
          x: position.x,
          y: position.y,
          destination: null,
          destinationRoomId: null,
          currentBehavior: null,
          status: 'idle',
          restTicksRemaining: 0,
          stuckTicks: 0,
        }
      }
    }

    // Only actually update the store if membership changed — avoids a redundant re-render every tick when nothing was added/removed.
    const currentIds = Object.keys(current)
    const changed = currentIds.length !== ids.length || currentIds.some((id) => !idSet.has(id))
    if (changed) set({ byId: next })
  },
  setPosition: (id, position) => set((state) => ({ byId: updateEntry(state.byId, id, { x: position.x, y: position.y }) })),
  setDestination: (id, destination) => set((state) => ({ byId: updateEntry(state.byId, id, { destination }) })),
  setDestinationRoomId: (id, destinationRoomId) => set((state) => ({ byId: updateEntry(state.byId, id, { destinationRoomId }) })),
  setRoomId: (id, roomId) => set((state) => ({ byId: updateEntry(state.byId, id, { roomId }) })),
  setCurrentBehavior: (id, currentBehavior) => set((state) => ({ byId: updateEntry(state.byId, id, { currentBehavior }) })),
  setStatus: (id, status) => set((state) => ({ byId: updateEntry(state.byId, id, { status }) })),
  setRestTicksRemaining: (id, restTicksRemaining) => set((state) => ({ byId: updateEntry(state.byId, id, { restTicksRemaining }) })),
  setStuckTicks: (id, stuckTicks) => set((state) => ({ byId: updateEntry(state.byId, id, { stuckTicks }) })),
  moveCharacterToRoom: (id, roomId, position) =>
    set((state) => ({
      byId: updateEntry(state.byId, id, {
        roomId,
        x: position.x,
        y: position.y,
        destination: null,
        destinationRoomId: null,
        status: 'idle',
        restTicksRemaining: 0,
        stuckTicks: 0,
      }),
    })),
}))
