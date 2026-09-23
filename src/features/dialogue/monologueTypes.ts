import type { RelationshipType } from './relationshipConfig'

/**
 * Five monologue time bands, from the real system clock (same source as
 * autoDialogueEngine's time gating and BGM's band — no separate in-game
 * clock exists). Intentionally not identical to BGM's four bands: the spec
 * asks monologue for a distinct 낮/오후 split.
 */
export type MonologueTimeBand = 'morning' | 'day' | 'afternoon' | 'evening' | 'night'

/**
 * What a character is doing right now, as far as monologue is concerned.
 * `wandering`/`resting`/`roomArrival`/`idle` are derived from real simulation
 * state (monologueTrigger.ts). `sleeping` and `working` do NOT exist in this
 * app yet (no sleep or job system) — they're reserved so that when those
 * systems land they only need to *report* the activity, and the engine's
 * gate (`isMonologueAllowedActivity`) already refuses to mutter through them.
 */
export type MonologueActivity = 'wandering' | 'resting' | 'roomArrival' | 'idle' | 'sleeping' | 'working'

/**
 * What a monologue may say about another character, using only facts the
 * simulation can check: `sameRoom` (they're in the same room right now),
 * `otherRoom` (in a different room), `recentTalk` (a real conversation with
 * them ended within the last few minutes).
 */
export type PartnerPresence = 'sameRoom' | 'otherRoom' | 'recentTalk'

/** One other character this one has a relationship with, as seen right now. A character can have several (up to four). */
export interface MonologuePartner {
  relationship: RelationshipType
  sameRoom: boolean
  recentTalk: boolean
}

/** 05-10 morning, 11-13 day, 14-17 afternoon, 18-20 evening, 21-04 night (the wrap past midnight is the `else`). */
export function getMonologueTimeBand(hour: number): MonologueTimeBand {
  if (hour >= 5 && hour <= 10) return 'morning'
  if (hour >= 11 && hour <= 13) return 'day'
  if (hour >= 14 && hour <= 17) return 'afternoon'
  if (hour >= 18 && hour <= 20) return 'evening'
  return 'night'
}
