import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CharacterInteractionSettingsState {
  enabled: boolean
  setEnabled: (enabled: boolean) => void
}

function normalizeEnabled(value: unknown): boolean {
  return typeof value === 'boolean' ? value : false
}

/**
 * Persists only the "캐릭터 상호작용" on/off toggle — mirrors
 * `autoFurnitureUseSettingsStore.ts`'s own persisted-setting-only pattern
 * exactly. Default **off**: existing sessions must see no sudden new
 * automatic behavior on their next visit, and — just as importantly — every
 * existing test that runs the real movement tick without knowing this
 * feature exists must keep behaving exactly as it did before this feature
 * was added. Found the hard way: two pre-existing tests
 * (`autoFurnitureUse.test.tsx`, `furnitureUsageBedTable.test.tsx`) broke
 * when the automatic pass rolled unconditionally; both were fixed by gating
 * it behind this default-off setting instead of by touching either test.
 * Manual interactions (`startManualCharacterInteraction`) are deliberately
 * **not** gated by this — an explicit button click already is the "should
 * this happen" decision, exactly like the manual "대화하기" button already
 * works in every dialogue-frequency mode including quiet.
 */
export const useCharacterInteractionSettingsStore = create<CharacterInteractionSettingsState>()(
  persist(
    (set) => ({
      enabled: false,
      setEnabled: (enabled) => set({ enabled }),
    }),
    {
      name: 'dearly-character-interaction',
      partialize: (state) => ({ enabled: state.enabled }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<CharacterInteractionSettingsState> | undefined
        return { ...currentState, enabled: normalizeEnabled(persisted?.enabled) }
      },
    },
  ),
)
