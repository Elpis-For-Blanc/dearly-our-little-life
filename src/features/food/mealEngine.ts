import { useCharacterStore } from '../character/characterStore'
import { useHomeStore } from '../home/homeStore'
import { useNeedsStore } from '../needs/needsStore'
import { endActiveConversationsFor } from '../dialogue/autoDialogueTrigger'
import { endActiveCharacterInteractionsFor } from '../interaction/characterInteractionTrigger'
import { useCharacterMovementStore } from '../simulation/characterMovementStore'
import { startLingering, standUp } from '../simulation/furnitureUsageTrigger'
import { useFurnitureUsageStore } from '../simulation/furnitureUsageStore'
import { FOOD_CATALOG, getFood, pickFoodForHour } from './foodCatalog'
import { useMealStore } from './mealStore'
import type { FoodId, MealSession } from './foodTypes'

const DINING_TABLE_IDS = new Set(['dining-table', 'dining-table-large'])
export const MEAL_EATING_MS = 7000
export const AUTO_MEAL_HUNGER_THRESHOLD = 32
export const AUTO_MEAL_COOLDOWN_MS = 45_000

export type StartMealOutcome = 'started' | 'busy' | 'not_found' | 'no_table' | 'full'

interface FreeTablePair {
  placementId: string
  leftSlotId: 'table-left'
  rightSlotId: 'table-right'
}

function freeTablePair(roomId: string): FreeTablePair | null {
  const room = useHomeStore.getState().rooms.find((item) => item.id === roomId)
  if (!room) return null
  const occupied = useFurnitureUsageStore.getState().bySeatKey
  for (const placement of room.furniture) {
    if (!DINING_TABLE_IDS.has(placement.furnitureId)) continue
    const leftKey = `${placement.id}:table-left`
    const rightKey = `${placement.id}:table-right`
    if (!occupied[leftKey] && !occupied[rightKey]) {
      return { placementId: placement.id, leftSlotId: 'table-left', rightSlotId: 'table-right' }
    }
  }
  return null
}

function freeTableSlot(roomId: string): { placementId: string; slotId: string } | null {
  const room = useHomeStore.getState().rooms.find((item) => item.id === roomId)
  if (!room) return null
  const occupied = useFurnitureUsageStore.getState().bySeatKey
  for (const placement of room.furniture) {
    if (!DINING_TABLE_IDS.has(placement.furnitureId)) continue
    // Dining tables currently expose the shared left/right stand slots.
    for (const slotId of ['table-left', 'table-right']) {
      if (!occupied[`${placement.id}:${slotId}`]) return { placementId: placement.id, slotId }
    }
  }
  return null
}


/**
 * Manual meal commands are user overrides. Clear the character's current
 * runtime-only activity first so the meal buttons stay genuinely usable at
 * any moment instead of only during the brief idle window between actions.
 */
function prepareForManualMeal(characterId: string): void {
  if (useMealStore.getState().byCharacterId[characterId]) cancelMeal(characterId)
  endActiveCharacterInteractionsFor(characterId)
  endActiveConversationsFor(characterId)
  standUp(characterId)

  const movementStore = useCharacterMovementStore.getState()
  if (!movementStore.byId[characterId]) return
  movementStore.setDestination(characterId, null)
  movementStore.setDestinationRoomId(characterId, null)
  movementStore.setCurrentBehavior(characterId, null)
  movementStore.setRestTicksRemaining(characterId, 0)
  movementStore.setStuckTicks(characterId, 0)
  movementStore.setStatus(characterId, 'idle')
}

export function canEatInRoom(roomId: string): boolean {
  return !!freeTableSlot(roomId)
}

export function startMeal(characterId: string, foodId?: FoodId, automatic = false, now = Date.now(), hour = new Date().getHours()): StartMealOutcome {
  if (!useCharacterStore.getState().characters.some((c) => c.id === characterId)) return 'not_found'
  if (!automatic) prepareForManualMeal(characterId)
  if (useMealStore.getState().byCharacterId[characterId]) return 'busy'
  const movement = useCharacterMovementStore.getState().byId[characterId]
  if (!movement) return 'not_found'
  if (movement.status !== 'idle') return 'busy'

  const target = freeTableSlot(movement.roomId)
  if (!target) {
    const room = useHomeStore.getState().rooms.find((item) => item.id === movement.roomId)
    const hasTable = room?.furniture.some((placement) => DINING_TABLE_IDS.has(placement.furnitureId))
    return hasTable ? 'full' : 'no_table'
  }

  const chosen = foodId ? getFood(foodId) : pickFoodForHour(hour)
  const outcome = startLingering(characterId, target.placementId, target.slotId)
  if (outcome !== 'started') return outcome === 'occupied' ? 'full' : 'busy'
  useMealStore.getState().start({ characterId, placementId: target.placementId, slotId: target.slotId, foodId: chosen.id, stage: 'approaching', startedAt: now, eatingStartedAt: null, automatic })
  return 'started'
}

export function startSharedMeal(firstCharacterId: string, secondCharacterId: string, now = Date.now(), hour = new Date().getHours()): StartMealOutcome {
  if (firstCharacterId === secondCharacterId) return 'not_found'
  const characters = useCharacterStore.getState().characters
  if (!characters.some((c) => c.id === firstCharacterId) || !characters.some((c) => c.id === secondCharacterId)) return 'not_found'
  prepareForManualMeal(firstCharacterId)
  prepareForManualMeal(secondCharacterId)

  const firstMovement = useCharacterMovementStore.getState().byId[firstCharacterId]
  const secondMovement = useCharacterMovementStore.getState().byId[secondCharacterId]
  if (!firstMovement || !secondMovement) return 'not_found'
  if (firstMovement.status !== 'idle' || secondMovement.status !== 'idle') return 'busy'
  if (firstMovement.roomId !== secondMovement.roomId) return 'busy'

  const target = freeTablePair(firstMovement.roomId)
  if (!target) {
    const room = useHomeStore.getState().rooms.find((item) => item.id === firstMovement.roomId)
    const hasTable = room?.furniture.some((placement) => DINING_TABLE_IDS.has(placement.furnitureId))
    return hasTable ? 'full' : 'no_table'
  }

  const firstFood = pickFoodForHour(hour)
  const secondFood = pickFoodForHour(hour)
  const firstOutcome = startLingering(firstCharacterId, target.placementId, target.leftSlotId)
  if (firstOutcome !== 'started') return firstOutcome === 'occupied' ? 'full' : 'busy'
  const secondOutcome = startLingering(secondCharacterId, target.placementId, target.rightSlotId)
  if (secondOutcome !== 'started') {
    standUp(firstCharacterId)
    return secondOutcome === 'occupied' ? 'full' : 'busy'
  }

  const sharedMealId = `shared:${now}:${firstCharacterId}:${secondCharacterId}`
  const store = useMealStore.getState()
  store.start({ characterId: firstCharacterId, placementId: target.placementId, slotId: target.leftSlotId, foodId: firstFood.id, stage: 'approaching', startedAt: now, eatingStartedAt: null, automatic: false, sharedMealId })
  store.start({ characterId: secondCharacterId, placementId: target.placementId, slotId: target.rightSlotId, foodId: secondFood.id, stage: 'approaching', startedAt: now, eatingStartedAt: null, automatic: false, sharedMealId })
  return 'started'
}

export function cancelMeal(characterId: string): void {
  const session = useMealStore.getState().byCharacterId[characterId]
  if (!session) return
  const participants = session.sharedMealId
    ? Object.values(useMealStore.getState().byCharacterId).filter((item) => item.sharedMealId === session.sharedMealId).map((item) => item.characterId)
    : [characterId]
  for (const participantId of participants) {
    useMealStore.getState().cancel(participantId)
    standUp(participantId)
  }
}

export function runMealPass(now = Date.now(), hour = new Date().getHours(), random: () => number = Math.random): void {
  const sessions = { ...useMealStore.getState().byCharacterId }
  const sharedGroups = new Map<string, MealSession[]>()
  for (const session of Object.values(sessions)) {
    if (!session.sharedMealId) continue
    const group = sharedGroups.get(session.sharedMealId) ?? []
    group.push(session)
    sharedGroups.set(session.sharedMealId, group)
  }

  // A shared meal waits until both characters have reached their two sides of the same table,
  // so one character never finishes dinner while their companion is still walking over.
  for (const group of sharedGroups.values()) {
    if (group.length !== 2) continue
    const approaching = group.filter((session) => session.stage === 'approaching')
    if (approaching.length === 0) continue
    let invalid = false
    let everyoneArrived = true
    for (const session of group) {
      const movement = useCharacterMovementStore.getState().byId[session.characterId]
      const seatKey = useFurnitureUsageStore.getState().byCharacterId[session.characterId]
      const usage = seatKey ? useFurnitureUsageStore.getState().bySeatKey[seatKey] : undefined
      const expected = `${session.placementId}:${session.slotId}`
      if (!movement || seatKey !== expected || !usage) {
        invalid = true
        break
      }
      if (usage.status !== 'seated' || movement.status !== 'lingering') everyoneArrived = false
    }
    if (invalid) {
      for (const session of group) {
        useMealStore.getState().cancel(session.characterId)
        standUp(session.characterId)
      }
    } else if (everyoneArrived) {
      for (const session of group) useMealStore.getState().markEating(session.characterId, now)
    }
  }

  for (const session of Object.values(sessions)) {
    const movement = useCharacterMovementStore.getState().byId[session.characterId]
    const seatKey = useFurnitureUsageStore.getState().byCharacterId[session.characterId]
    const usage = seatKey ? useFurnitureUsageStore.getState().bySeatKey[seatKey] : undefined
    const expected = `${session.placementId}:${session.slotId}`
    if (!movement || seatKey !== expected || !usage) {
      useMealStore.getState().cancel(session.characterId)
      continue
    }
    if (session.stage === 'approaching') {
      if (!session.sharedMealId && usage.status === 'seated' && movement.status === 'lingering') useMealStore.getState().markEating(session.characterId, now)
      continue
    }
    if (session.eatingStartedAt !== null && now - session.eatingStartedAt >= MEAL_EATING_MS) {
      const needs = useNeedsStore.getState().byId[session.characterId]
      if (needs) {
        const food = getFood(session.foodId)
        useNeedsStore.getState().setNeeds(session.characterId, {
          ...needs,
          hunger: Math.min(100, needs.hunger + food.hungerRestore),
          fun: Math.min(100, needs.fun + food.funRestore),
        })
      }
      useMealStore.getState().finish(session.characterId, now)
      standUp(session.characterId)
    }
  }

  // Hungry idle characters occasionally decide to eat. The low per-tick chance prevents every character
  // from snapping into a meal on the exact tick hunger crosses the threshold.
  for (const character of useCharacterStore.getState().characters) {
    if (useMealStore.getState().byCharacterId[character.id]) continue
    const movement = useCharacterMovementStore.getState().byId[character.id]
    const needs = useNeedsStore.getState().byId[character.id]
    if (!movement || movement.status !== 'idle' || !needs || needs.hunger > AUTO_MEAL_HUNGER_THRESHOLD) continue
    const last = useMealStore.getState().lastFinishedAt[character.id] ?? 0
    if (now - last < AUTO_MEAL_COOLDOWN_MS || random() > 0.035) continue
    startMeal(character.id, undefined, true, now, hour)
  }
}

export { FOOD_CATALOG }
