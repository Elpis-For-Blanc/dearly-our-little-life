import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { clampNeed, createDefaultNeeds } from './needsConfig'
import type { CharacterNeeds } from './needsTypes'

interface NeedsState {
  byId: Record<string, CharacterNeeds>
  /**
   * Creates default needs for `id` if it doesn't already have an entry —
   * safe to call every tick/every render, a no-op once the character has
   * real data. Deliberately **deterministic** (no `Math.random()` call at
   * all) — this exists as a defensive fallback for a character somehow
   * missing an entry when `needsTrigger.ts`'s tick pass or
   * `NeedsStatusPanel.tsx` observes it, called automatically and
   * repeatedly, not as the real "새 캐릭터의 욕구를 뽑는" moment. That real
   * moment is `CharacterForm.tsx`'s registration handler, which calls
   * `createDefaultNeeds()` (genuinely randomized within 65–85) directly and
   * writes it with `setNeeds` instead. Keeping this fallback non-random is
   * what keeps the movement tick's own `Math.random()` call sequence
   * unaffected by whether a character's needs entry already existed —
   * found and fixed via `integration.test.tsx`'s seeded 20-minute
   * simulation, which failed once this call started silently consuming
   * `Math.random()` rolls that every other seeded system in the same tick
   * also depends on.
   */
  ensureCharacter: (id: string) => void
  removeCharacter: (id: string) => void
  setNeeds: (id: string, needs: CharacterNeeds) => void
  /** Replaces the entire map — the one mutation the manual save/load feature (`features/save/saveRestore.ts`) ever makes. Reuses the same defensive per-entry normalization `merge` already runs on every reload. */
  restoreNeeds: (byId: Record<string, CharacterNeeds>) => void
}

function normalizeOneNeeds(raw: unknown): CharacterNeeds | null {
  if (typeof raw !== 'object' || raw === null) return null
  const candidate = raw as Partial<CharacterNeeds>
  const values = [candidate.hunger, candidate.energy, candidate.fun, candidate.social]
  if (!values.every((v) => typeof v === 'number' && Number.isFinite(v))) return null
  return { hunger: clampNeed(candidate.hunger!), energy: clampNeed(candidate.energy!), fun: clampNeed(candidate.fun!), social: clampNeed(candidate.social!) }
}

/** Keeps every well-formed entry and silently drops anything malformed — a single damaged character's needs must never take the healthy ones down with it, same discipline `homeStore`/`characterStore`'s own defensive loaders already follow. */
export function normalizeNeedsById(raw: unknown): Record<string, CharacterNeeds> {
  if (typeof raw !== 'object' || raw === null) return {}
  const result: Record<string, CharacterNeeds> = {}
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const needs = normalizeOneNeeds(value)
    if (needs) result[id] = needs
  }
  return result
}

/**
 * Persisted independently (`localStorage` key `dearly-needs`), same
 * "auto-save on every change" pattern `homeStore`/`characterStore` already
 * use — a plain page refresh must not reset a character's needs back to
 * default, any more than it resets their name or their room's furniture.
 * The manual save/load feature (`features/save/`) *additionally* captures
 * a snapshot of this store's data into its own save blob, exactly the same
 * "auto-persisted AND manually snapshotted" relationship `characters`/
 * `home` already have there.
 *
 * Deliberately **not** merged into `characterStore` — a character's needs
 * are simulation state that changes every tick, not persona/customization
 * data, and jamming a fast-changing field into the same store as
 * `aiProfile`/dialogue lines would make every needs tick also re-serialize
 * a character's entire dialogue-line library to `localStorage`.
 */
export const useNeedsStore = create<NeedsState>()(
  persist(
    (set, get) => ({
      byId: {},
      ensureCharacter: (id) => {
        if (get().byId[id]) return
        // A fixed, non-random default (the exact midpoint of the real 65–85 registration range) — see this
        // action's own doc comment for why this must never call Math.random().
        set((state) => ({ byId: { ...state.byId, [id]: createDefaultNeeds(() => 0.5) } }))
      },
      removeCharacter: (id) =>
        set((state) => {
          if (!(id in state.byId)) return state
          const next = { ...state.byId }
          delete next[id]
          return { byId: next }
        }),
      setNeeds: (id, needs) =>
        set((state) => ({
          byId: {
            ...state.byId,
            [id]: { hunger: clampNeed(needs.hunger), energy: clampNeed(needs.energy), fun: clampNeed(needs.fun), social: clampNeed(needs.social) },
          },
        })),
      restoreNeeds: (byId) => set({ byId: normalizeNeedsById(byId) }),
    }),
    {
      name: 'dearly-needs',
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<NeedsState> | undefined
        return { ...currentState, byId: normalizeNeedsById(persisted?.byId) }
      },
    },
  ),
)
