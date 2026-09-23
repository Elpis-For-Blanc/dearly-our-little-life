import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_RELATIONSHIP_TYPE, RELATIONSHIP_PRESETS, type RelationshipType } from './relationshipConfig'
import { pairKey } from './pairKey'

/**
 * With up to 5 characters there can be up to 10 pairs, so relationships are
 * now per-pair (`relationshipsByPair`, keyed by `pairKey`) rather than one
 * global value. `defaultRelationshipType` is what a pair gets until the user
 * explicitly sets one — this is also exactly the old (pre-5-character)
 * single `relationshipType` field, so migrating a 2-character save just
 * renames the field and changes nothing observable for that pair.
 */
interface RelationshipState {
  defaultRelationshipType: RelationshipType
  relationshipsByPair: Record<string, RelationshipType>
  getRelationshipType: (idA: string, idB: string) => RelationshipType
  /**
   * Whether this pair's relationship was actually chosen by the user, as
   * opposed to just falling back to the default type. An unchosen pair still
   * *resolves* to `defaultRelationshipType` (so nothing that reads
   * `getRelationshipType` changes), but relationship-specific content — which
   * the user never asked for — must only reach pairs where this is true.
   * A default that isn't the built-in one can only be a saved choice (the
   * pre-per-pair single relationship), so it counts as chosen.
   */
  isRelationshipExplicit: (idA: string, idB: string) => boolean
  setRelationshipType: (idA: string, idB: string, type: RelationshipType) => void
}

function normalizeRelationshipType(value: unknown): RelationshipType {
  return typeof value === 'string' && value in RELATIONSHIP_PRESETS ? (value as RelationshipType) : DEFAULT_RELATIONSHIP_TYPE
}

function normalizePairMap(value: unknown): Record<string, RelationshipType> {
  if (typeof value !== 'object' || value === null) return {}
  const result: Record<string, RelationshipType> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'string' && raw in RELATIONSHIP_PRESETS) result[key] = raw as RelationshipType
  }
  return result
}

export const useRelationshipStore = create<RelationshipState>()(
  persist(
    (set, get) => ({
      defaultRelationshipType: DEFAULT_RELATIONSHIP_TYPE,
      relationshipsByPair: {},
      getRelationshipType: (idA, idB) => {
        const state = get()
        return state.relationshipsByPair[pairKey(idA, idB)] ?? state.defaultRelationshipType
      },
      isRelationshipExplicit: (idA, idB) => {
        const state = get()
        return pairKey(idA, idB) in state.relationshipsByPair || state.defaultRelationshipType !== DEFAULT_RELATIONSHIP_TYPE
      },
      setRelationshipType: (idA, idB, type) =>
        set((state) => ({ relationshipsByPair: { ...state.relationshipsByPair, [pairKey(idA, idB)]: type } })),
    }),
    {
      name: 'dearly-relationship',
      merge: (persistedState, currentState) => {
        const persisted = persistedState as
          | Partial<RelationshipState>
          // Pre-5-character legacy shape: a single global `relationshipType`.
          | { relationshipType?: unknown }
          | undefined

        const legacy = persisted as { relationshipType?: unknown } | undefined
        const defaultRelationshipType =
          persisted && 'defaultRelationshipType' in persisted
            ? normalizeRelationshipType((persisted as Partial<RelationshipState>).defaultRelationshipType)
            : normalizeRelationshipType(legacy?.relationshipType)

        return {
          ...currentState,
          defaultRelationshipType,
          relationshipsByPair: normalizePairMap((persisted as Partial<RelationshipState> | undefined)?.relationshipsByPair),
        }
      },
    },
  ),
)
