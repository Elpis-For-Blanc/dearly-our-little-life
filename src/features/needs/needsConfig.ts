import { MOVEMENT_TICK_MS } from '../simulation/movementConfig'
import type { CharacterNeeds } from './needsTypes'

export const NEED_MIN = 0
export const NEED_MAX = 100

/** A new character's needs start in this range — "너무 극단적이지 않게 65~85 범위의 안정적인 값" — never exactly 100 or 0, and each need is rolled independently so a fresh character doesn't look like a flat, identical gauge across all four. */
export const NEED_DEFAULT_MIN = 65
export const NEED_DEFAULT_MAX = 85

export function clampNeed(value: number): number {
  if (!Number.isFinite(value)) return NEED_DEFAULT_MIN
  return Math.min(NEED_MAX, Math.max(NEED_MIN, value))
}

/** One instance's starting needs — each of the four rolled independently within [NEED_DEFAULT_MIN, NEED_DEFAULT_MAX]. */
export function createDefaultNeeds(random: () => number = Math.random): CharacterNeeds {
  const roll = () => Math.round(NEED_DEFAULT_MIN + random() * (NEED_DEFAULT_MAX - NEED_DEFAULT_MIN))
  return { hunger: roll(), energy: roll(), fun: roll(), social: roll() }
}

const ticksPerMinute = 60_000 / MOVEMENT_TICK_MS

/** Points lost per movement tick if a need decayed continuously at its base rate for `minutes` real minutes before reaching 0 from a full 100. Keeps every rate below readable in terms of "약 N분 만에 바닥난다" instead of a bare magic number. */
function perTickRateForMinutesToEmpty(minutes: number): number {
  return NEED_MAX / (minutes * ticksPerMinute)
}

/**
 * Every decay/recovery rate the needs simulation uses, calibrated so nothing
 * empties out within "a few minutes" of leaving the Live screen open (the
 * spec's own explicit anti-goal) — each is phrased as "~N 분 만에 100→0"
 * for the base case, not a bare unexplained constant. All decay only ever
 * runs from the one shared movement tick (see `needsTrigger.ts`), never on
 * every render.
 */
export const NEEDS_RATES = {
  /** hunger: "서서히 감소" — a flat trickle regardless of what the character is doing. ~70 minutes 100→0. */
  hunger: perTickRateForMinutesToEmpty(70),
  /** energy: "활동 중 감소" — decays faster while actually walking (`'moving'`) than while merely standing idle. ~50 min moving, ~140 min idle, to fully deplete. */
  energyActive: perTickRateForMinutesToEmpty(50),
  energyIdle: perTickRateForMinutesToEmpty(140),
  /** energy recovers while resting on furniture (`'seated'`/`'lying'`) — a full recovery from 0 in about 10 minutes of continuous rest, deliberately much faster than the drain so a short rest is worth taking. */
  energyRecovery: NEED_MAX / (10 * ticksPerMinute),
  /** fun: "아무 활동이 없으면 감소" — decays faster while genuinely idle (no destination) than while doing something (walking/resting/talking). ~55 min idle, ~160 min otherwise. */
  funIdle: perTickRateForMinutesToEmpty(55),
  funActive: perTickRateForMinutesToEmpty(160),
  /** social: "혼자 오래 있으면 감소" — decays only while no other registered character currently shares the same room; doesn't decay at all while accompanied (no explicit "recovers together" ask, so left flat rather than invented). ~65 minutes alone, 100→0. */
  socialAlone: perTickRateForMinutesToEmpty(65),
} as const

/** A need at or below this is "매우 낮음" — the mood engine's per-need critical thresholds, and the auto-furniture-use bonus's own "low enough to bias behavior" cutoff (see `needsFurnitureBonus.ts`). One shared number so both stay in agreement. */
export const NEED_CRITICAL_THRESHOLD = 25

/** Average of all four needs at or above this, with none critical, reads as `'happy'`; otherwise `'neutral'`. */
export const MOOD_HAPPY_AVERAGE = 70
