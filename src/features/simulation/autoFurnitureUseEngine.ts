import { getFurnitureDefinition } from '../home/furnitureCatalog'
import type { FurnitureInteractionSlot, FurniturePlacement, InteractionKind } from '../home/types'
import {
  AUTO_FURNITURE_USE_CHANCE_PER_TICK,
  AUTO_FURNITURE_USE_COOLDOWN_MS,
  AUTO_FURNITURE_USE_MAX_HOLD_MS,
  AUTO_FURNITURE_USE_MIN_HOLD_MS,
  AUTO_FURNITURE_USE_RETRY_COOLDOWN_MS,
} from './autoFurnitureUseConfig'
import { getSitSlots, getStandSlots, getUsableLieSlots } from './furnitureInteractionEngine'
import type { FurnitureUsageEntry } from './furnitureUsageStore'

/**
 * Pure, injectable-random decision functions for automatic furniture use —
 * mirrors the shape of `monologueEngine.ts`'s `rollShouldMonologue`/
 * `pickMonologue` split (a frequency gate, then a pick), so this feature's
 * tests can be deterministic the same way monologue's already are. Nothing
 * here touches a store or moves a character — see `autoFurnitureUseTrigger.ts`
 * for the imperative side that actually calls the existing
 * `startSitting`/`startLyingDown`/`startLingering`/`standUp` functions.
 */

export interface RollAutoFurnitureUseParams {
  enabled: boolean
  now: number
  /** When this character's auto furniture use last *successfully ended*; undefined if never. */
  lastEndedAt: number | undefined
  /** When this character's auto furniture use last *failed* (lost a race, or timed out before arriving); undefined if never. */
  lastFailedAt: number | undefined
  random?: () => number
}

/** Frequency gate for one eligible character on one tick — settings toggle → success cooldown → failure-retry cooldown → a per-tick roll. Mirrors monologueEngine.ts's `rollShouldMonologue` shape exactly. */
export function rollShouldStartAutoFurnitureUse({ enabled, now, lastEndedAt, lastFailedAt, random = Math.random }: RollAutoFurnitureUseParams): boolean {
  if (!enabled) return false
  if (lastEndedAt !== undefined && now - lastEndedAt < AUTO_FURNITURE_USE_COOLDOWN_MS) return false
  if (lastFailedAt !== undefined && now - lastFailedAt < AUTO_FURNITURE_USE_RETRY_COOLDOWN_MS) return false
  return random() < AUTO_FURNITURE_USE_CHANCE_PER_TICK
}

export interface AutoFurnitureCandidate {
  placementId: string
  slotId: string
  kind: InteractionKind
}

/**
 * Every currently-free (unreserved/unoccupied) interaction slot on the given
 * furniture, across every kind (sit/lie/stand) at once — a sofa/chair, a
 * bed, and a table are all just "furniture with a free slot" here, nothing
 * furniture-type-specific. Reuses the exact same per-kind slot getters
 * (`getSitSlots`/`getUsableLieSlots`/`getStandSlots`) the manual trigger
 * (`furnitureUsageTrigger.ts`) and `FurnitureUsagePanel.tsx` already use, so
 * a candidate here is always something `startSitting`/`startLyingDown`/
 * `startLingering` would actually accept — never a slot the manual path
 * would refuse. Availability is per *slot*, never per piece: a bed with one
 * sleeper still offers its other side, and only stops being a candidate once
 * both are taken.
 */
export function collectAutoFurnitureCandidates(furniture: FurniturePlacement[], bySeatKey: Record<string, FurnitureUsageEntry>): AutoFurnitureCandidate[] {
  const candidates: AutoFurnitureCandidate[] = []
  for (const placement of furniture) {
    const definition = getFurnitureDefinition(placement.furnitureId)
    if (!definition) continue
    const slotsByKind: Array<[InteractionKind, FurnitureInteractionSlot[]]> = [
      ['sit', getSitSlots(definition)],
      ['lie', getUsableLieSlots(definition)],
      ['stand', getStandSlots(definition)],
    ]
    for (const [kind, slots] of slotsByKind) {
      for (const slot of slots) {
        if (bySeatKey[`${placement.id}:${slot.id}`]) continue
        candidates.push({ placementId: placement.id, slotId: slot.id, kind })
      }
    }
  }
  return candidates
}

/**
 * Picks one candidate, softly avoiding the character's own recently-auto-used
 * placement ids — "softly" because if every candidate happens to be recently
 * used (including the common one-piece-of-furniture case), the exclusion is
 * dropped entirely rather than returning null, per the spec's "사용할 수 있는
 * 가구가 하나뿐이라면 쿨다운 이후 다시 선택할 수 있어야 해" — generalized
 * here to "repeat-suppression alone never reduces a real, non-empty
 * candidate pool to zero."
 *
 * `weightFor` is optional and, when omitted, this is byte-identical to the
 * plain uniform pick every existing caller/test already relies on
 * (`pool[Math.floor(random() * pool.length)]`, the exact same line). Passing
 * one (the needs system's `needsFurnitureBonus.ts` is the one real caller
 * today, via `autoFurnitureUseTrigger.ts`) turns this into a weighted random
 * pick — still genuinely random, just biased, so a low need never forces
 * the *same* candidate every time the way a deterministic "pick the best
 * match" rule would.
 */
export function pickAutoFurnitureCandidate(
  candidates: AutoFurnitureCandidate[],
  recentPlacementIds: string[],
  random: () => number = Math.random,
  weightFor?: (candidate: AutoFurnitureCandidate) => number,
): AutoFurnitureCandidate | null {
  if (candidates.length === 0) return null
  const notRecent = candidates.filter((c) => !recentPlacementIds.includes(c.placementId))
  const pool = notRecent.length > 0 ? notRecent : candidates
  if (!weightFor) return pool[Math.floor(random() * pool.length)]

  const weights = pool.map((c) => Math.max(0.0001, weightFor(c)))
  const total = weights.reduce((sum, w) => sum + w, 0)
  let roll = random() * total
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return pool[i]
  }
  return pool[pool.length - 1] // floating-point safety net — roll should always land before this in theory
}

/** A hold duration randomized within the configured range, so every auto-use session doesn't look like an identical, mechanical timer. */
export function pickHoldDurationMs(random: () => number = Math.random): number {
  return AUTO_FURNITURE_USE_MIN_HOLD_MS + random() * (AUTO_FURNITURE_USE_MAX_HOLD_MS - AUTO_FURNITURE_USE_MIN_HOLD_MS)
}
