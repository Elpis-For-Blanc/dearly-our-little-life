import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AutoFurnitureUseSettingsState {
  enabled: boolean
  setEnabled: (enabled: boolean) => void
}

function normalizeEnabled(value: unknown): boolean {
  return typeof value === 'boolean' ? value : false
}

/**
 * Persists only the "자동 가구 사용" on/off toggle — mirrors
 * dialogueFrequencyStore.ts's/monologueFrequencyStore.ts's own
 * persisted-setting-only pattern (runtime cooldowns/recent-use history live
 * in the separate, non-persisted autoFurnitureUseStore.ts, same split as
 * dialogueFrequencyStore vs. dialogueStore / monologueFrequencyStore vs.
 * monologueStore).
 *
 * Default **OFF**, per spec — existing users must see no sudden behavior
 * change on their next visit. Missing or corrupt saved data also falls back
 * to OFF, never to "on" by accident. No `SCHEMA_VERSION`/migration needed:
 * this is a brand-new store (its own localStorage key), not a shape change
 * to an existing one, so there is no old data to migrate away from.
 */
export const useAutoFurnitureUseSettingsStore = create<AutoFurnitureUseSettingsState>()(
  persist(
    (set) => ({
      enabled: false,
      setEnabled: (enabled) => set({ enabled }),
    }),
    {
      name: 'dearly-auto-furniture-use',
      partialize: (state) => ({ enabled: state.enabled }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AutoFurnitureUseSettingsState> | undefined
        return { ...currentState, enabled: normalizeEnabled(persisted?.enabled) }
      },
    },
  ),
)
