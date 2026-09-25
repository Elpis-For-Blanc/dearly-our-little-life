import type { FoodDefinition, FoodId } from './foodTypes'

export const FOOD_CATALOG: FoodDefinition[] = [
  { id: 'toast', name: '토스트', emoji: '🍞', hungerRestore: 34, funRestore: 1, timeBands: ['morning', 'day'] },
  { id: 'pancakes', name: '팬케이크', emoji: '🥞', hungerRestore: 38, funRestore: 4, timeBands: ['morning'] },
  { id: 'sandwich', name: '샌드위치', emoji: '🥪', hungerRestore: 40, funRestore: 2, timeBands: ['morning', 'day'] },
  { id: 'salad', name: '샐러드', emoji: '🥗', hungerRestore: 36, funRestore: 1, timeBands: ['day', 'evening'] },
  { id: 'pasta', name: '파스타', emoji: '🍝', hungerRestore: 48, funRestore: 4, timeBands: ['day', 'evening'] },
  { id: 'curry', name: '카레', emoji: '🍛', hungerRestore: 50, funRestore: 3, timeBands: ['day', 'evening'] },
  { id: 'cake', name: '케이크', emoji: '🍰', hungerRestore: 24, funRestore: 8, timeBands: ['day', 'evening'] },
  { id: 'cookies', name: '쿠키', emoji: '🍪', hungerRestore: 18, funRestore: 6, timeBands: ['day', 'evening'] },
]

export function getFood(id: FoodId): FoodDefinition {
  return FOOD_CATALOG.find((food) => food.id === id) ?? FOOD_CATALOG[0]
}

export function foodTimeBand(hour: number): 'morning' | 'day' | 'evening' {
  if (hour >= 5 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 17) return 'day'
  return 'evening'
}

export function pickFoodForHour(hour: number, random: () => number = Math.random): FoodDefinition {
  const band = foodTimeBand(hour)
  const choices = FOOD_CATALOG.filter((food) => food.timeBands.includes(band))
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))] ?? FOOD_CATALOG[0]
}
