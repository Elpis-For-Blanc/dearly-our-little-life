import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_SITUATION_CATEGORIES, type SituationCategory } from './situationCategories'

/**
 * Custom situation categories the user adds, on top of the 10 built-in
 * ones — shared across both characters (a situation like "아침" isn't
 * specific to one character), so this isn't nested under characterStore.
 */
interface SituationCategoryState {
  customCategories: SituationCategory[]
  addCategory: (label: string) => SituationCategory
  removeCategory: (id: string) => void
}

export const useSituationCategoryStore = create<SituationCategoryState>()(
  persist(
    (set) => ({
      customCategories: [],
      addCategory: (label) => {
        const category: SituationCategory = { id: crypto.randomUUID(), label: label.trim() }
        set((state) => ({ customCategories: [...state.customCategories, category] }))
        return category
      },
      removeCategory: (id) => set((state) => ({ customCategories: state.customCategories.filter((c) => c.id !== id) })),
    }),
    {
      name: 'dearly-situation-categories',
      // Keep the real categories (objects with a string id and label); junk entries or a non-list become nothing instead of crashing the pickers that spread this list.
      merge: (persistedState, currentState) => {
        const raw = (persistedState as { customCategories?: unknown } | undefined)?.customCategories
        const customCategories = Array.isArray(raw)
          ? raw.filter(
              (entry): entry is SituationCategory =>
                typeof entry === 'object' && entry !== null && typeof (entry as SituationCategory).id === 'string' && typeof (entry as SituationCategory).label === 'string',
            )
          : []
        return { ...currentState, customCategories }
      },
    },
  ),
)

export function getAllSituationCategories(customCategories: SituationCategory[]): SituationCategory[] {
  return [...DEFAULT_SITUATION_CATEGORIES, ...customCategories]
}
