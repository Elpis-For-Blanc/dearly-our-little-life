import { beforeEach, describe, expect, it } from 'vitest'
import { getAllSituationCategories, useSituationCategoryStore } from './situationCategoryStore'
import { DEFAULT_SITUATION_CATEGORIES } from './situationCategories'

describe('situationCategoryStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useSituationCategoryStore.setState({ customCategories: [] })
  })

  it('starts with no custom categories, only the built-in 10', () => {
    expect(getAllSituationCategories(useSituationCategoryStore.getState().customCategories)).toHaveLength(
      DEFAULT_SITUATION_CATEGORIES.length,
    )
  })

  it('adds a custom category and returns it', () => {
    const category = useSituationCategoryStore.getState().addCategory('기념일')

    expect(category.label).toBe('기념일')
    expect(useSituationCategoryStore.getState().customCategories).toHaveLength(1)
    expect(getAllSituationCategories(useSituationCategoryStore.getState().customCategories)).toHaveLength(
      DEFAULT_SITUATION_CATEGORIES.length + 1,
    )
  })

  it('removes a custom category by id', () => {
    const category = useSituationCategoryStore.getState().addCategory('기념일')
    useSituationCategoryStore.getState().removeCategory(category.id)

    expect(useSituationCategoryStore.getState().customCategories).toHaveLength(0)
  })

  it('persists custom categories to localStorage', () => {
    useSituationCategoryStore.getState().addCategory('기념일')

    const stored = JSON.parse(localStorage.getItem('dearly-situation-categories') ?? '{}')
    expect(stored.state.customCategories).toHaveLength(1)
  })
})
