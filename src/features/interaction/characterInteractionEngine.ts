import { NEED_CRITICAL_THRESHOLD } from '../needs/needsConfig'
import type { CharacterNeeds, Mood } from '../needs/needsTypes'
import { getFurnitureDefinition } from '../home/furnitureCatalog'
import { getSitSlots } from '../simulation/furnitureInteractionEngine'
import { distanceBetween, type Point } from '../simulation/movementEngine'
import type { FurniturePlacement } from '../home/types'
import { CHARACTER_INTERACTION_BASE_WEIGHT, CHARACTER_INTERACTION_CHANCE_PER_TICK, CHARACTER_INTERACTION_COOLDOWN_MS, CHARACTER_INTERACTION_RETRY_COOLDOWN_MS } from './characterInteractionConfig'
import type { CharacterInteractionSession, CharacterInteractionType } from './characterInteractionTypes'

/**
 * Pure, injectable-random decision functions — mirrors the shape
 * `autoFurnitureUseEngine.ts`/`monologueEngine.ts` already established (a
 * frequency/cooldown gate, then a weighted pick), so this feature's tests
 * can be deterministic the same way theirs already are. Nothing here touches
 * a store or moves a character — see `characterInteractionTrigger.ts` for
 * the imperative side.
 */

export interface RollCharacterInteractionParams {
  enabled: boolean
  now: number
  lastEndedAt: number | undefined
  lastFailedAt: number | undefined
  random?: () => number
}

/** Settings-toggle gate → cooldown gate (success, then failure-retry) → a per-tick roll. Mirrors `autoFurnitureUseEngine.ts`'s `rollShouldStartAutoFurnitureUse` shape exactly. */
export function rollShouldStartCharacterInteraction({ enabled, now, lastEndedAt, lastFailedAt, random = Math.random }: RollCharacterInteractionParams): boolean {
  if (!enabled) return false
  if (lastEndedAt !== undefined && now - lastEndedAt < CHARACTER_INTERACTION_COOLDOWN_MS) return false
  if (lastFailedAt !== undefined && now - lastFailedAt < CHARACTER_INTERACTION_RETRY_COOLDOWN_MS) return false
  return random() < CHARACTER_INTERACTION_CHANCE_PER_TICK
}

/**
 * "hunger/energy가 심각하면 기본 욕구 행동 우선" — a character interaction
 * never even starts while either participant's hunger or energy is
 * critically low (the same threshold `moodEngine.ts`'s own `deriveMood`
 * uses for "매우 낮음"), leaving that tick free for `autoFurnitureUseTrigger.ts`'s
 * own needs-weighted bed/sofa bonus to address the *actual* need instead.
 * This is a hard gate, not a soft weight — a starving/exhausted character
 * should never be nudged into a hug over eating/resting.
 */
export function hasCriticalBasicNeed(needs: CharacterNeeds): boolean {
  return needs.hunger <= NEED_CRITICAL_THRESHOLD || needs.energy <= NEED_CRITICAL_THRESHOLD
}

/**
 * A small, disclosed subset of moods nudge the weighted type pick — never a
 * hard override (the spec's own "기분 때문에 행동을 완전히 강제하지 말 것").
 * `tired` isn't listed here at all: a tired character is already excluded
 * entirely by `hasCriticalBasicNeed` before this function is ever reached
 * (tired *is* low energy), so no separate "tired deprioritizes hug/
 * holdHands" rule is needed — it's already structurally true.
 */
const MOOD_TYPE_BONUS: Partial<Record<Mood, Partial<Record<CharacterInteractionType, number>>>> = {
  lonely: { stayTogether: 0.6 },
  bored: { stayTogether: 0.3, sitTogether: 0.3 },
}

/** How much extra weight a low `social` need adds — a bonus on top of the base weight, never a multiplier that could dominate or zero out the pool, so a character interaction stays genuinely random even when social is low. */
const LOW_SOCIAL_BONUS = 1.5

export interface InteractionTypeCandidate {
  type: CharacterInteractionType
  weight: number
}

/**
 * Builds the weighted candidate list for one pair about to start an
 * interaction — `sitTogetherAvailable` must already reflect whether a real,
 * currently-free two-seat placement exists in their shared room (see
 * `findSitTogetherPlacement` below); this function never assumes furniture
 * availability on its own.
 */
export function buildInteractionTypeCandidates(
  needsA: CharacterNeeds,
  moodA: Mood,
  needsB: CharacterNeeds,
  moodB: Mood,
  sitTogetherAvailable: boolean,
): InteractionTypeCandidate[] {
  const types: CharacterInteractionType[] = sitTogetherAvailable ? ['stayTogether', 'sitTogether', 'hug', 'holdHands'] : ['stayTogether', 'hug', 'holdHands']
  const lowestSocial = Math.min(needsA.social, needsB.social)

  return types.map((type) => {
    let weight = CHARACTER_INTERACTION_BASE_WEIGHT[type]
    if (lowestSocial <= NEED_CRITICAL_THRESHOLD) weight += LOW_SOCIAL_BONUS
    weight += MOOD_TYPE_BONUS[moodA]?.[type] ?? 0
    weight += MOOD_TYPE_BONUS[moodB]?.[type] ?? 0
    return { type, weight: Math.max(0.0001, weight) }
  })
}

/** Weighted random pick among the candidates `buildInteractionTypeCandidates` built — genuinely probabilistic, never "always pick the highest weight" (see that function's own doc comment on why). */
export function pickInteractionType(candidates: InteractionTypeCandidate[], random: () => number = Math.random): CharacterInteractionType | null {
  if (candidates.length === 0) return null
  const total = candidates.reduce((sum, c) => sum + c.weight, 0)
  let roll = random() * total
  for (const candidate of candidates) {
    roll -= candidate.weight
    if (roll <= 0) return candidate.type
  }
  return candidates[candidates.length - 1].type
}

export interface SitTogetherSlotPair {
  placementId: string
  slotAId: string
  slotBId: string
}

/**
 * Finds a placement with **two** real `'sit'` slots that are *both*
 * currently free — reusing the exact same `getSitSlots` every solo seat use
 * already goes through, never a new/hardcoded seat lookup (per the spec's
 * own "좌석 좌표를 새로 하드코딩하지 말 것"). Today the only real
 * two-real-seat pieces are the 2-seat `sofa` (`sofa-left`/`sofa-right`) and
 * `dining-bench`/other multi-seat benches — this works for any of them, or
 * any future piece with 2+ sit slots, without change. Returns `null` if
 * nothing qualifies (an ordinary one-seat chair never does).
 */
export function findSitTogetherPlacement(furniture: FurniturePlacement[], bySeatKey: Record<string, unknown>): SitTogetherSlotPair | null {
  for (const placement of furniture) {
    const definition = getFurnitureDefinition(placement.furnitureId)
    const slots = getSitSlots(definition)
    if (slots.length < 2) continue
    const freeSlots = slots.filter((slot) => !bySeatKey[`${placement.id}:${slot.id}`])
    if (freeSlots.length >= 2) {
      return { placementId: placement.id, slotAId: freeSlots[0].id, slotBId: freeSlots[1].id }
    }
  }
  return null
}

/**
 * The point exactly `distance` away from `target`, along the straight line
 * from `target` toward `from` — i.e. "walk directly at the target and stop
 * `distance` short of it", never a random angle around them (the generic
 * `pickApproachDestination` movement.ts already offers approaches *someone
 * they encountered by chance* from an arbitrary side; two characters who are
 * specifically walking toward each other for a hug/hand-hold approach head-on
 * instead, which is what also makes `resolveFacing` below meaningful — the
 * mover ends up on the same side it started from, not a random one).
 * Degenerates to a fixed, arbitrary direction only when `from` and `target`
 * are exactly the same point (nothing meaningful to aim away from).
 */
export function pointTowardTarget(from: Point, target: Point, distance: number): Point {
  const dx = from.x - target.x
  const dy = from.y - target.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return { x: target.x + distance, y: target.y }
  const ratio = distance / length
  return { x: target.x + dx * ratio, y: target.y + dy * ratio }
}

/**
 * Whether the mover's *current* destination is still good enough to keep
 * walking toward, or genuinely needs recomputing — true only the first time
 * (no destination yet) or once the partner has moved more than
 * `APPROACH_TARGET_RECOMPUTE_EPSILON` since the destination was last aimed at
 * them. This is the one thing standing between "follows a partner who
 * genuinely moved" (item 8 of the spec) and "recomputes every tick and
 * jitters" (the spec's own explicit anti-goal) — see that constant's own doc
 * comment.
 */
export function shouldRecomputeApproachTarget(
  currentDestination: Point | null,
  lastTargetPos: Point | null,
  currentTargetPos: Point,
  epsilon: number,
): boolean {
  if (!currentDestination || !lastTargetPos) return true
  return distanceBetween(lastTargetPos, currentTargetPos) > epsilon
}

/**
 * Which horizontal side each participant faces once arrived — whoever is
 * further left (`x` smaller) faces `'right'` (toward the partner) and vice
 * versa. Returns `null` for an (essentially never reachable in practice,
 * given `pointTowardTarget`'s own head-on approach) exactly-equal-x
 * degenerate case, where there's no meaningful left/right to assign.
 */
export function resolveFacing(posA: Point, posB: Point): CharacterInteractionSession['facing'] {
  if (posA.x === posB.x) return null
  return posA.x < posB.x
    ? { characterAId: 'right', characterBId: 'left' }
    : { characterAId: 'left', characterBId: 'right' }
}
