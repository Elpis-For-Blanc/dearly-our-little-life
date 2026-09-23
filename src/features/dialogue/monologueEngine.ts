import type { BaseTone } from '../character/types'
import { DEFAULT_MONOLOGUE_LIBRARY, type MonologueLineDef } from './defaultMonologueLibrary'
import {
  MIN_MONOLOGUE_COOLDOWN_MS,
  MONOLOGUE_CHANCE_WEIGHT_MAX,
  MONOLOGUE_CHANCE_WEIGHT_MIN,
  MONOLOGUE_FREQUENCY_PRESETS,
  type MonologueFrequencyMode,
} from './monologueConfig'
import { getMonologueTimeBand, type MonologueActivity, type MonologuePartner } from './monologueTypes'

/** Personality's effect on *how often* a character mutters: 수다스러움 up, 과묵함 down (summed, then clamped). Other tags shape *which* line, never how often. Callers pass ids already run through `resolveWeightingTagIds`. */
const CHANCE_DELTA_BY_TAG: Record<string, number> = { talkative: 0.6, reticent: -0.5 }

/** Extra weight per personality-tag match on a tag-restricted line. */
const PERSONALITY_MATCH_BOOST = 2

export function monologueChanceWeightFor(tags: string[]): number {
  const sum = tags.reduce((total, tag) => total + (CHANCE_DELTA_BY_TAG[tag] ?? 0), 1)
  return Math.min(MONOLOGUE_CHANCE_WEIGHT_MAX, Math.max(MONOLOGUE_CHANCE_WEIGHT_MIN, sum))
}

/** The one gate for activities a character mustn't mutter through. Add future states here (e.g. commuting) — nothing else in the engine changes. */
const BLOCKED_ACTIVITIES: ReadonlySet<MonologueActivity> = new Set<MonologueActivity>(['sleeping', 'working'])

export function isMonologueAllowedActivity(activity: MonologueActivity): boolean {
  return !BLOCKED_ACTIVITIES.has(activity)
}

export function effectiveCooldownMs(mode: MonologueFrequencyMode): number {
  return Math.max(MIN_MONOLOGUE_COOLDOWN_MS, MONOLOGUE_FREQUENCY_PRESETS[mode].cooldownMs)
}

export interface MonologueRollParams {
  mode: MonologueFrequencyMode
  /** Resolved weighting tag ids of this character. */
  personalityTags: string[]
  now: number
  /** When *this character's* last monologue started; undefined/0 if never. */
  lastMonologueAt: number | undefined
  random?: () => number
}

/** Frequency gate for one character on one tick: off → never; this character's own cooldown → blocked; otherwise a per-tick roll scaled by personality. */
export function rollShouldMonologue({ mode, personalityTags, now, lastMonologueAt, random = Math.random }: MonologueRollParams): boolean {
  const { chancePerTick } = MONOLOGUE_FREQUENCY_PRESETS[mode]
  if (chancePerTick <= 0) return false
  if (lastMonologueAt !== undefined && now - lastMonologueAt < effectiveCooldownMs(mode)) return false
  return random() < Math.min(1, chancePerTick * monologueChanceWeightFor(personalityTags))
}

export interface PickMonologueParams {
  personalityTags: string[]
  baseTone: BaseTone
  activity: MonologueActivity
  hour: number
  recentLineIds: string[]
  /** Other characters this one has a relationship with, as seen right now. Empty (the default) means relationship-specific lines can never match. */
  partners?: MonologuePartner[]
  random?: () => number
  /** Test-only override, same idea as `defaultBundleCatalog` in autoDialogueEngine. */
  catalog?: MonologueLineDef[]
}

/** Whether a relationship-specific line's condition holds: some partner has one of the line's relationship type ids *and* is in the required (checkable) presence state. Lines without a condition are unaffected. */
export function partnerConditionMet(line: MonologueLineDef, partners: MonologuePartner[]): boolean {
  const condition = line.partnerCondition
  if (!condition) return true
  return partners.some((partner) => {
    if (!condition.relationships.includes(partner.relationship)) return false
    if (condition.presence === 'sameRoom') return partner.sameRoom
    if (condition.presence === 'otherRoom') return !partner.sameRoom
    return partner.recentTalk
  })
}

function matchesTone(line: MonologueLineDef, baseTone: BaseTone): boolean {
  return line.tone === (baseTone === 'formal' ? 'formal' : 'casual')
}

/**
 * Picks one line, or null (say nothing) if nothing suits. A line qualifies
 * when its register, time band, activity and personality conditions all
 * match (an empty condition list means "any"); recently used ids are excluded
 * outright. If that leaves nothing, retries with only fully-generic lines
 * (no conditions at all) — and if those are exhausted too, skips rather than
 * repeating.
 */
export function pickMonologue({
  personalityTags,
  baseTone,
  activity,
  hour,
  recentLineIds,
  partners = [],
  random = Math.random,
  catalog = DEFAULT_MONOLOGUE_LIBRARY,
}: PickMonologueParams): MonologueLineDef | null {
  if (!isMonologueAllowedActivity(activity)) return null

  const band = getMonologueTimeBand(hour)
  const recent = new Set(recentLineIds)
  const usable = catalog.filter((line) => matchesTone(line, baseTone) && !recent.has(line.id) && partnerConditionMet(line, partners))

  const matching = usable.filter(
    (line) =>
      (line.timeBands.length === 0 || line.timeBands.includes(band)) &&
      (line.activities.length === 0 || line.activities.includes(activity)) &&
      (line.personalityTags.length === 0 || line.personalityTags.some((tag) => personalityTags.includes(tag))),
  )
  const candidates =
    matching.length > 0
      ? matching
      : usable.filter(
          (line) => line.timeBands.length === 0 && line.activities.length === 0 && line.personalityTags.length === 0 && !line.partnerCondition,
        )
  if (candidates.length === 0) return null

  const weights = candidates.map((line) => {
    const matches = line.personalityTags.filter((tag) => personalityTags.includes(tag)).length
    return line.weight * (1 + matches * PERSONALITY_MATCH_BOOST)
  })
  const total = weights.reduce((sum, w) => sum + w, 0)
  let roll = random() * total
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return candidates[i]
  }
  return candidates[candidates.length - 1]
}
