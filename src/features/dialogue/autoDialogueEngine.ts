import type { BaseTone, CharacterDialogueLine } from '../character/types'
import { initiateWeightFor, lineAffinityWeightFor, startChanceWeightFor } from '../character/personalityTags'
import {
  DEFAULT_DIALOGUE_BUNDLES,
  type DefaultDialogueBundleDef,
  type DefaultDialogueTurn,
} from './defaultDialogueLibrary'
import type { DialogueLine } from './types'
import {
  DIALOGUE_FREQUENCY_PRESETS,
  MAX_BUNDLE_LINES,
  MIN_BUNDLE_LINES,
  type DialogueFrequencyMode,
} from './autoDialogueConfig'
import { RELATIONSHIP_PRESETS, isRomanticLine, type RelationshipType } from './relationshipConfig'

export interface AutoDialogueParticipant {
  id: string
  personalityTags: string[]
  dialogueLines: CharacterDialogueLine[]
  /** Which text variant of a *default-library* bundle turn (defaultDialogueLibrary.ts) this participant's own lines render as when they speak. Irrelevant for their own registered `dialogueLines`, which are always used verbatim. */
  baseTone: BaseTone
}

/**
 * Categories that presuppose narrative state this app doesn't track
 * (an actual prior conflict) — deliberately excluded from auto-dialogue so
 * the scheduler never invents an argument or reconciliation out of nowhere.
 * Manual "대화하기" generation is unaffected; this only narrows the
 * auto-dialogue candidate pool.
 */
const AUTO_EXCLUDED_CATEGORIES = new Set(['conflict', 'reconciliation'])

/**
 * Real-clock hour windows for time-gated categories — the only honest
 * "시간대" signal available since there's no in-game clock. Every category
 * *not* listed here is time-neutral (eligible at any hour) on purpose —
 * gating is inclusion-based, never exclusion-based, so e.g. `casual-chat`
 * stays available at night instead of the bedtime category becoming the
 * only thing that can ever get picked then (an explicit spec requirement:
 * "밤이라도 캐릭터가 깨어서 활동 중이라면 무조건 취침 대사만 출력하지 마").
 * Only the two original categories (`morning-greeting`/`bedtime`) and the
 * newer, more specific ones added for the default library are gated;
 * everything else — including every existing user-registered category —
 * is unaffected.
 */
function isTimeOfDayEligible(categoryId: string, hour: number): boolean {
  if (categoryId === 'morning-greeting' || categoryId === 'wake-up') return hour >= 5 && hour <= 10
  if (categoryId === 'breakfast') return hour >= 6 && hour <= 9
  if (categoryId === 'lunch') return hour >= 11 && hour <= 14
  if (categoryId === 'afternoon-chat' || categoryId === 'snack') return hour >= 13 && hour <= 18
  if (categoryId === 'dinner') return hour >= 17 && hour <= 20
  if (categoryId === 'day-wrap-up') return hour >= 19 && hour <= 23
  if (categoryId === 'pre-bedtime') return hour >= 21 || hour <= 4
  if (categoryId === 'bedtime') return hour >= 21 || hour <= 4
  return true
}

function weightedPick<T>(items: T[], weights: number[], random: () => number): T {
  const total = weights.reduce((sum, w) => sum + w, 0)
  if (total <= 0) return items[Math.floor(random() * items.length)]
  let roll = random() * total
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return items[i]
  }
  return items[items.length - 1]
}

export interface RollStartParams {
  frequencyMode: DialogueFrequencyMode
  relationshipType: RelationshipType
  now: number
  lastConversationEndAt: number
  /** Each participant's resolved (built-in) personality tag ids — see resolveWeightingTagIds. Optional so existing callers/tests that don't care about personality still work with the neutral (1x) multiplier. */
  participantPersonalityTags?: [string[], string[]]
  random?: () => number
}

/**
 * Steps 3-5 of the 10-step flow: overall frequency gate, cooldown gate, then
 * the probability roll itself, triggered by a real encounter (see
 * useCharacterMovementSimulation.ts). Personality (수다스러움/과묵함/사교적/
 * 수줍음, via `startChanceWeightFor`) and relationship type both multiply
 * the base per-encounter chance — never mode alone, but 'quiet' still
 * short-circuits before either multiplier is ever computed, so no
 * personality combination can produce auto-dialogue in quiet mode.
 */
export function rollShouldStartConversation(params: RollStartParams): boolean {
  const preset = DIALOGUE_FREQUENCY_PRESETS[params.frequencyMode]
  if (preset.chancePerEncounter <= 0) return false
  if (params.now - params.lastConversationEndAt < preset.cooldownMs) return false

  const relationshipMultiplier = RELATIONSHIP_PRESETS[params.relationshipType].startProbabilityMultiplier
  const [tagsA, tagsB] = params.participantPersonalityTags ?? [[], []]
  const personalityMultiplier = startChanceWeightFor(tagsA) * startChanceWeightFor(tagsB)
  const chance = Math.min(1, preset.chancePerEncounter * relationshipMultiplier * personalityMultiplier)
  const random = params.random ?? Math.random
  return random() < chance
}

/** Step 6: personality-weighted pick of which of the two participants speaks first. */
export function pickFirstSpeaker(
  participants: [AutoDialogueParticipant, AutoDialogueParticipant],
  random: () => number = Math.random,
): AutoDialogueParticipant {
  const weights = participants.map((p) => initiateWeightFor(p.personalityTags))
  return weightedPick(participants, weights, random)
}

function eligibleLinesFor(
  speaker: AutoDialogueParticipant,
  opts: { relationshipType: RelationshipType; recentLineIds: string[]; hour: number; excludeIds: Set<string> },
): CharacterDialogueLine[] {
  const allowsRomantic = RELATIONSHIP_PRESETS[opts.relationshipType].allowsRomanticLines

  const filterLine = (line: CharacterDialogueLine, respectRecency: boolean) => {
    if (AUTO_EXCLUDED_CATEGORIES.has(line.categoryId)) return false
    if (!isTimeOfDayEligible(line.categoryId, opts.hour)) return false
    if (!allowsRomantic && isRomanticLine(line.tags, line.emotion)) return false
    if (opts.excludeIds.has(line.id)) return false
    if (respectRecency && opts.recentLineIds.includes(line.id)) return false
    return true
  }

  const withRecency = speaker.dialogueLines.filter((line) => filterLine(line, true))
  if (withRecency.length > 0) return withRecency

  // Too few fresh candidates — fall back to lines explicitly marked safe to reuse, still respecting every other guard.
  return speaker.dialogueLines.filter((line) => line.isFallback && filterLine(line, false))
}

/** `mixed`/`custom` have no single "correct" formal/casual register to pick between, so they fall back to the same casual (반말) variant every other unregistered-tone character gets — never a naive text transform, just picking which hand-authored variant to show. */
function resolveDefaultTurnText(turn: DefaultDialogueTurn, baseTone: BaseTone): string {
  return baseTone === 'formal' ? turn.text.formal : turn.text.casual
}

/**
 * Whether a whole default bundle is usable at all right now — every turn's
 * category must pass the same time-of-day gate a registered line would, and
 * romantic content is hard-excluded unless the pair's relationship type is
 * 'romantic' (mirrors `eligibleLinesFor`'s guard for user lines, but exact
 * rather than keyword-guessed, since this is our own authored content).
 */
function isDefaultBundleEligible(bundle: DefaultDialogueBundleDef, relationshipType: RelationshipType, relationshipExplicit: boolean, hour: number): boolean {
  // A pair whose relationship was never chosen only gets the neutral, relationship-independent bundles — even though it *resolves* to the default type, content written for a specific relationship (친구, 친밀한 관계, 라이벌, …) must not reach it.
  if (!relationshipExplicit && bundle.relationshipTypes) return false
  // Affection content needs a romantic relationship type; `relationshipTypes` (below) then decides *which* one(s) — 연인 only, 부부 only, or both. Both checks read the type id, never the text.
  if (bundle.romantic && !RELATIONSHIP_PRESETS[relationshipType].allowsRomanticLines) return false
  if (bundle.relationshipTypes && !bundle.relationshipTypes.includes(relationshipType)) return false
  return isTimeOfDayEligible(bundle.categoryId, hour)
}

/**
 * §3's personality effect on conversation *length*: 수다스러움 prefers
 * longer bundles, 과묵함 prefers shorter ones — the only two tags the spec
 * names for this. A targeted multiplier here (not a new dimension on
 * `PersonalityTagDef`) since nothing else needs this axis.
 */
function bundleLengthWeight(turnCount: number, tagsA: string[], tagsB: string[]): number {
  const talkative = (tagsA.includes('talkative') ? 1 : 0) + (tagsB.includes('talkative') ? 1 : 0)
  const reticent = (tagsA.includes('reticent') ? 1 : 0) + (tagsB.includes('reticent') ? 1 : 0)
  const bias = talkative - reticent
  if (bias === 0) return 1
  const lengthScore = turnCount - 2 // bundles are typically ~2 turns; longer/shorter than that is what gets biased for/against
  return Math.max(0.2, 1 + bias * lengthScore * 0.3)
}

function turnAsDialogueLine(bundle: DefaultDialogueBundleDef, turn: DefaultDialogueTurn, speakerBaseTone: BaseTone): CharacterDialogueLine {
  return {
    id: '',
    categoryId: bundle.categoryId,
    situationNote: '',
    isFallback: false,
    emotion: turn.emotion,
    tags: turn.tags,
    text: resolveDefaultTurnText(turn, speakerBaseTone),
  }
}

function defaultBundleWeight(
  bundle: DefaultDialogueBundleDef,
  first: AutoDialogueParticipant,
  second: AutoDialogueParticipant,
): number {
  const affinity = bundle.turns.reduce((sum, turn) => {
    const speaker = turn.speaker === 'first' ? first : second
    // lineAffinityWeightFor only reads categoryId/text/emotion/tags — a default turn resolved to this speaker's own tone already has all four, so it scores exactly like a registered CharacterDialogueLine would.
    return sum + lineAffinityWeightFor(speaker.personalityTags, turnAsDialogueLine(bundle, turn, speaker.baseTone))
  }, 0)
  const lengthWeight = bundleLengthWeight(bundle.turns.length, first.personalityTags, second.personalityTags)
  return Math.max(0.05, (1 + affinity) * lengthWeight)
}

/**
 * Picks one whole default bundle (never individual turns from different
 * bundles — that would be exactly the "무작위로 이어 붙이기" the spec says not
 * to do) for the given pair/relationship/hour, weighted by personality
 * affinity and length preference, softly avoiding this *pair's* recently
 * used bundle ids. Returns null only if literally nothing in the library
 * fits the current relationship/time constraints (in practice this should
 * essentially never happen, since several categories — casual-chat, worried,
 * teasing, etc. — are always time/relationship-neutral).
 */
function pickDefaultBundle(
  first: AutoDialogueParticipant,
  second: AutoDialogueParticipant,
  relationshipType: RelationshipType,
  relationshipExplicit: boolean,
  hour: number,
  recentBundleIds: string[],
  random: () => number,
  catalog: DefaultDialogueBundleDef[],
): DefaultDialogueBundleDef | null {
  const eligible = catalog.filter((bundle) => isDefaultBundleEligible(bundle, relationshipType, relationshipExplicit, hour))
  if (eligible.length === 0) return null

  // Soft recency avoidance: prefer bundles this pair hasn't recently had, but never block the conversation entirely just because everything eligible has been seen before — the built-in library is generic/repeatable content, unlike a user's own hand-written lines.
  const fresh = eligible.filter((bundle) => !recentBundleIds.includes(bundle.id))
  const pool = fresh.length > 0 ? fresh : eligible

  const weights = pool.map((bundle) => defaultBundleWeight(bundle, first, second))
  return weightedPick(pool, weights, random)
}

export interface BuildBundleParams {
  participants: [AutoDialogueParticipant, AutoDialogueParticipant]
  firstSpeakerId: string
  relationshipType: RelationshipType
  /** Whether the pair's relationship was chosen by the user (relationshipStore's `isRelationshipExplicit`). `false` limits the default library to neutral bundles; defaults to `true`, i.e. the type is taken at face value. */
  relationshipExplicit?: boolean
  recentLineIdsByCharacter: Record<string, string[]>
  /** This pair's recently-used default-library bundle ids (dialogueStore.ts's `recentDefaultBundleIdsByPair`, pre-resolved by the caller) — kept separate from `recentLineIdsByCharacter` per spec: bundle recency is tracked per-pair, individual-line recency stays per-character. */
  recentDefaultBundleIdsByPair?: string[]
  now: number
  random?: () => number
  /** Overridable only for tests — defaults to the real built-in library. */
  defaultBundleCatalog?: DefaultDialogueBundleDef[]
}

export interface AutoDialogueBundleResult {
  lines: DialogueLine[]
  /** Which registered line id was used per turn, in order — for the caller to feed into recent-use tracking. Populated for both the registered-line path and the default-bundle fallback (using the bundle turn's own stable id), so per-character recency tracking works identically either way. */
  usedLineIds: Array<{ characterId: string; lineId: string }>
  /** Set only when the default-library fallback was used — the caller should record this against the pair's own recency list (dialogueStore.ts's `recordDefaultBundleUsed`). */
  usedDefaultBundleId?: string
}

/** Attempts steps 7-8 using only each speaker's own registered lines, exactly as before this feature — alternating speakers, weighted by personality affinity. Returns null (not a partial bundle) the moment any single turn has zero eligible candidates, so the caller never has to reconcile a half-registered/half-fallback result. */
function tryBuildFromRegisteredLines(
  first: AutoDialogueParticipant,
  second: AutoDialogueParticipant,
  length: number,
  relationshipType: RelationshipType,
  recentLineIdsByCharacter: Record<string, string[]>,
  hour: number,
  random: () => number,
): Pick<AutoDialogueBundleResult, 'lines' | 'usedLineIds'> | null {
  const usedThisBundle = new Set<string>()
  const lines: DialogueLine[] = []
  const usedLineIds: Array<{ characterId: string; lineId: string }> = []

  for (let i = 0; i < length; i++) {
    const speaker = i % 2 === 0 ? first : second
    const recentLineIds = recentLineIdsByCharacter[speaker.id] ?? []
    const candidates = eligibleLinesFor(speaker, { relationshipType, recentLineIds, hour, excludeIds: usedThisBundle })

    if (candidates.length === 0) return null

    const weights = candidates.map((line) => lineAffinityWeightFor(speaker.personalityTags, line))
    const chosen = weightedPick(candidates, weights, random)
    usedThisBundle.add(chosen.id)
    lines.push({ speakerId: speaker.id, emotion: chosen.emotion, text: chosen.text })
    usedLineIds.push({ characterId: speaker.id, lineId: chosen.id })
  }

  return { lines, usedLineIds }
}

/**
 * Steps 7-8: builds a bundle alternating speakers starting from
 * `firstSpeakerId`. Tries each speaker's own registered lines first
 * (`tryBuildFromRegisteredLines`, unchanged from before this feature) — a
 * character's own hand-written lines are always preferred over the
 * built-in library when they fit (spec: "사용자가 작성한 예시 대사는... 상황
 * 조건이 맞을 때 우선 선택"). Only if that per-turn approach can't fill every
 * turn (including the common case of a character with zero registered
 * lines at all) does this fall back to picking one whole, already-coherent
 * default bundle for the entire exchange instead — never a hybrid of
 * registered lines for some turns and default-library lines for others,
 * since that would forfeit the "완성된 대화 묶음" coherence guarantee for the
 * very case (no fitting registered lines) where it matters most. Returns
 * null only if even the default library has nothing eligible for the
 * current relationship/time — the caller must skip the conversation
 * entirely rather than force a mismatched line, same as before.
 */
export function buildAutoDialogueBundle(params: BuildBundleParams): AutoDialogueBundleResult | null {
  const random = params.random ?? Math.random
  const [a, b] = params.participants
  const first = params.firstSpeakerId === a.id ? a : b
  const second = first === a ? b : a

  const length = MIN_BUNDLE_LINES + Math.floor(random() * (MAX_BUNDLE_LINES - MIN_BUNDLE_LINES + 1))
  const hour = new Date(params.now).getHours()

  const registered = tryBuildFromRegisteredLines(first, second, length, params.relationshipType, params.recentLineIdsByCharacter, hour, random)
  if (registered) return registered

  // The registered-line path didn't fill every turn (including having none at all) — fall back to one whole default bundle instead of a partial/hybrid result.
  const bundle = pickDefaultBundle(
    first,
    second,
    params.relationshipType,
    params.relationshipExplicit ?? true,
    hour,
    params.recentDefaultBundleIdsByPair ?? [],
    random,
    params.defaultBundleCatalog ?? DEFAULT_DIALOGUE_BUNDLES,
  )
  if (!bundle) return null

  const bundleLines: DialogueLine[] = []
  const bundleUsedLineIds: Array<{ characterId: string; lineId: string }> = []
  for (let i = 0; i < bundle.turns.length; i++) {
    const turn = bundle.turns[i]
    const speaker = turn.speaker === 'first' ? first : second
    const turnId = `${bundle.id}-t${i}`
    bundleLines.push({ speakerId: speaker.id, emotion: turn.emotion, text: resolveDefaultTurnText(turn, speaker.baseTone) })
    bundleUsedLineIds.push({ characterId: speaker.id, lineId: turnId })
  }

  return { lines: bundleLines, usedLineIds: bundleUsedLineIds, usedDefaultBundleId: bundle.id }
}
