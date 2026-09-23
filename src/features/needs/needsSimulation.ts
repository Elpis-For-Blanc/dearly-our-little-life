import type { MovementStatus } from '../simulation/characterMovementStore'
import { clampNeed, NEEDS_RATES } from './needsConfig'
import type { CharacterNeeds } from './needsTypes'

/** What `applyNeedsDecayTick` needs to know about a character's *current* real state — nothing more, and nothing it stores itself; the caller (`needsTrigger.ts`) reads this fresh from `characterMovementStore`/room membership every tick. */
export interface NeedsTickContext {
  status: MovementStatus
  /** Whether at least one other registered character currently shares this character's room. */
  hasRoommate: boolean
}

/**
 * One tick's worth of decay/recovery, pure and side-effect-free — called
 * once per character per movement tick from `needsTrigger.ts`'s
 * `runNeedsPass`, never on every React render. Every field is clamped to
 * [0, 100] on the way out, so a caller can apply this repeatedly without
 * ever needing to clamp separately.
 */
export function applyNeedsDecayTick(needs: CharacterNeeds, context: NeedsTickContext): CharacterNeeds {
  const isResting = context.status === 'seated' || context.status === 'lying'
  const isMoving = context.status === 'moving'
  const isIdle = context.status === 'idle'

  const hunger = needs.hunger - NEEDS_RATES.hunger
  const energy = isResting ? needs.energy + NEEDS_RATES.energyRecovery : needs.energy - (isMoving ? NEEDS_RATES.energyActive : NEEDS_RATES.energyIdle)
  const fun = needs.fun - (isIdle ? NEEDS_RATES.funIdle : NEEDS_RATES.funActive)
  const social = needs.social - (context.hasRoommate ? 0 : NEEDS_RATES.socialAlone)

  return {
    hunger: clampNeed(hunger),
    energy: clampNeed(energy),
    fun: clampNeed(fun),
    social: clampNeed(social),
  }
}
