import { classifyInteractionType } from '../home/furnitureInteractionType'
import type { FurnitureDefinition } from '../home/types'
import { NEED_CRITICAL_THRESHOLD } from './needsConfig'
import type { CharacterNeeds } from './needsTypes'

/**
 * How much extra weight a low need adds to a matching furniture candidate
 * in `autoFurnitureUseEngine.ts`'s weighted pick — a *bonus* on top of the
 * base weight of 1, not a multiplier that could ever zero out or dominate
 * the pool, per the spec's own "욕구 하나 때문에 매번 동일 행동만 반복하면
 * 안 됨". A candidate with two matching low needs (e.g. tired *and* bored,
 * both drawn to a sofa) gets both bonuses added — a compounding nudge, not
 * a separate mechanism.
 */
const NEEDS_BONUS_WEIGHT = 2

/**
 * Reuses the existing, already-tested `classifyInteractionType` classifier
 * (`furnitureInteractionType.ts`) — never a second, duplicate "is this a
 * bed/sofa/desk" lookup — to decide which of a piece's real interaction
 * kinds count as "rest-like" (energy) or "leisure-like" (fun) for the auto
 * furniture-use bonus. Reading `classifyInteractionType`'s doc comment: it
 * is purely a UI/behavior-biasing label, never consulted by the actual
 * reservation/seating logic itself — using it here for a *bonus weight* on
 * top of that real logic is exactly the kind of use it was built for.
 *
 * hunger is deliberately not checked here — there's no `'eat'`
 * `InteractionKind` or "먹기" furniture in this catalog to bias toward, and
 * the spec explicitly says not to invent one just for this. social is also
 * not checked — per the spec, it isn't tied to automatic behavior yet since
 * character-to-character interaction doesn't exist.
 */
export function needsFurnitureWeight(definition: FurnitureDefinition, needs: Pick<CharacterNeeds, 'energy' | 'fun'>): number {
  const type = classifyInteractionType(definition)
  let weight = 1
  if (needs.energy <= NEED_CRITICAL_THRESHOLD && (type === 'seat' || type === 'lie')) weight += NEEDS_BONUS_WEIGHT
  if (needs.fun <= NEED_CRITICAL_THRESHOLD && (type === 'seat' || type === 'table')) weight += NEEDS_BONUS_WEIGHT
  return weight
}
