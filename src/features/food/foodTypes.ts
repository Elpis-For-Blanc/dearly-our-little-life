export type FoodId = 'toast' | 'sandwich' | 'salad' | 'pasta' | 'curry' | 'pancakes' | 'cake' | 'cookies'

export interface FoodDefinition {
  id: FoodId
  name: string
  emoji: string
  hungerRestore: number
  funRestore: number
  timeBands: Array<'morning' | 'day' | 'evening'>
}

export type MealStage = 'approaching' | 'eating'

export interface MealSession {
  characterId: string
  placementId: string
  slotId: string
  foodId: FoodId
  stage: MealStage
  startedAt: number
  eatingStartedAt: number | null
  automatic: boolean
  /** Runtime-only id shared by characters who intentionally started one meal together. */
  sharedMealId?: string
}
