import { pairKey } from '../dialogue/pairKey'
import { distanceBetween, type Point } from './movementEngine'
import { ENCOUNTER_DISTANCE } from './movementConfig'

export interface EncounterResult {
  /** Pairs that just crossed into ENCOUNTER_DISTANCE this call (a rising edge) — the only ones that should ever trigger a new auto-dialogue attempt. */
  newlyEncountered: Array<[string, string]>
  /** Every pair currently within range, by pairKey — pass this back in as `previouslyNear` on the next call. */
  currentlyNear: Set<string>
}

/**
 * Computes which character pairs are within ENCOUNTER_DISTANCE right now,
 * and — by diffing against the near-set from the previous call — which
 * pairs just entered range. Only entries (far→near transitions) are
 * reported, never "still near", so a caller polling this every tick never
 * re-fires for two characters that are simply standing next to each other.
 */
export function detectEncounters(
  positions: Array<{ id: string; position: Point }>,
  previouslyNear: Set<string>,
): EncounterResult {
  const currentlyNear = new Set<string>()
  const newlyEncountered: Array<[string, string]> = []

  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const a = positions[i]
      const b = positions[j]
      if (distanceBetween(a.position, b.position) > ENCOUNTER_DISTANCE) continue

      const key = pairKey(a.id, b.id)
      currentlyNear.add(key)
      if (!previouslyNear.has(key)) newlyEncountered.push([a.id, b.id])
    }
  }

  return { newlyEncountered, currentlyNear }
}
