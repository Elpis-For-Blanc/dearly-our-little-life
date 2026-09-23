import type { CharacterDialogueLine, CustomPersonalityTag } from './types'

export type PersonalityCategory = 'temperament' | 'social' | 'emotional' | 'behavior' | 'conversation' | 'relational'

export const PERSONALITY_CATEGORY_LABELS: Record<PersonalityCategory, string> = {
  temperament: '기본 성향',
  social: '대인관계',
  emotional: '감정 표현',
  behavior: '행동과 생활',
  conversation: '대화 성향',
  relational: '관계에서의 태도',
}

export const PERSONALITY_CATEGORY_ORDER: PersonalityCategory[] = [
  'temperament',
  'social',
  'emotional',
  'behavior',
  'conversation',
  'relational',
]

/**
 * Real, implemented autonomous-movement behaviors (features/simulation) a
 * character can be biased toward. Only a handful of tags below actually
 * carry a non-zero `behaviorWeightDelta` for these — see the `OVERRIDES`
 * table and CLAUDE.md's personality section for the honest list of what's
 * connected vs. still purely decorative.
 */
export type BehaviorType = 'wander' | 'rest' | 'approach' | 'seekSolitude' | 'changeRoom'

export const MAX_PERSONALITY_TAGS = 5

export interface PersonalityTagDef {
  id: string
  label: string
  category: PersonalityCategory
  description: string
  /** Additive delta to a character's chance of being picked as the *first speaker*, once a conversation has already started. */
  initiateWeightDelta: number
  /** Additive delta to how much this character's own presence raises/lowers the chance a pair's conversation starts at all (combined with the other participant's). */
  startChanceDelta: number
  /** Additive delta per behavior type. Empty for the large majority of tags — those are honestly neutral, not silently broken. */
  behaviorWeightDelta: Partial<Record<BehaviorType, number>>
  /** Heuristic: does this registered line look like a match for the tag's affinity? Scored, not a hard filter. */
  lineAffinity: (line: CharacterDialogueLine) => number
}

function textIncludesAny(haystack: string, keywords: string[]): boolean {
  const lower = haystack.toLowerCase()
  return keywords.some((keyword) => lower.includes(keyword.toLowerCase()))
}

function tagsOrEmotionMatch(line: CharacterDialogueLine, keywords: string[]): boolean {
  return textIncludesAny(line.emotion, keywords) || line.tags.some((tag) => textIncludesAny(tag, keywords))
}

interface RawTagSpec {
  id: string
  label: string
  category: PersonalityCategory
  description: string
}

/**
 * 71 built-in personality tags across the 6 requested categories (72 labels
 * in the original spec minus one duplicate: "헌신적" appeared under both
 * 대인관계 and 관계에서의 태도 — per the spec's own instruction, it's unified
 * into a single id/category here rather than listed twice).
 */
const RAW_TAGS: RawTagSpec[] = [
  // 기본 성향
  { id: 'affectionate', label: '다정함', category: 'temperament', description: '상대를 다정하게 챙겨요.' },
  { id: 'gruff', label: '무뚝뚝함', category: 'temperament', description: '표현이 짧고 무뚝뚝해요.' },
  { id: 'calm', label: '차분함', category: 'temperament', description: '차분하고 안정적이에요.' },
  { id: 'energetic', label: '활발함', category: 'temperament', description: '활동적이고 에너지가 넘쳐요.' },
  { id: 'quiet', label: '조용함', category: 'temperament', description: '조용하고 잔잔해요.' },
  { id: 'coolHeaded', label: '냉정함', category: 'temperament', description: '감정에 잘 휘둘리지 않아요.' },
  { id: 'warmHearted', label: '따뜻함', category: 'temperament', description: '마음이 따뜻해요.' },
  { id: 'optimistic', label: '낙천적', category: 'temperament', description: '긍정적으로 생각해요.' },
  { id: 'pessimistic', label: '비관적', category: 'temperament', description: '부정적인 면을 먼저 봐요.' },
  { id: 'prudent', label: '신중함', category: 'temperament', description: '행동하기 전에 신중히 생각해요.' },
  { id: 'impulsive', label: '충동적', category: 'temperament', description: '생각보다 행동이 앞서요.' },
  { id: 'realistic', label: '현실적', category: 'temperament', description: '현실적으로 판단해요.' },

  // 대인관계
  { id: 'sociable', label: '사교적', category: 'social', description: '사람들과 잘 어울려요.' },
  { id: 'introverted', label: '내향적', category: 'social', description: '혼자 있는 시간을 편안해해요.' },
  { id: 'shy', label: '수줍음', category: 'social', description: '낯선 상황에서 수줍어해요.' },
  { id: 'strangerShy', label: '낯가림', category: 'social', description: '처음 보는 사람을 어려워해요.' },
  { id: 'friendly', label: '친화적', category: 'social', description: '누구와도 쉽게 친해져요.' },
  { id: 'guarded', label: '경계심', category: 'social', description: '쉽게 마음을 열지 않아요.' },
  { id: 'considerate', label: '배려심', category: 'social', description: '상대를 잘 배려해요.' },
  { id: 'protective', label: '보호적', category: 'social', description: '상대를 보호하려는 마음이 커요.' },
  { id: 'dependent', label: '의존적', category: 'social', description: '상대에게 많이 의지해요.' },
  { id: 'independent', label: '독립적', category: 'social', description: '스스로 해결하는 걸 선호해요.' },
  { id: 'devoted', label: '헌신적', category: 'social', description: '상대에게 헌신적이에요.' },
  { id: 'jealous', label: '질투심', category: 'social', description: '질투심이 많아요.' },

  // 감정 표현
  { id: 'candid', label: '솔직함', category: 'emotional', description: '생각을 솔직하게 표현해요.' },
  { id: 'emotionallyReserved', label: '감정 표현이 적음', category: 'emotional', description: '감정을 잘 드러내지 않아요.' },
  { id: 'emotionallyExpressive', label: '감정 표현이 풍부함', category: 'emotional', description: '감정을 풍부하게 표현해요.' },
  { id: 'aegyo', label: '애교 많음', category: 'emotional', description: '애교가 많아요.' },
  { id: 'playful', label: '장난스러움', category: 'emotional', description: '장난기가 많아요.' },
  { id: 'sensitive', label: '예민함', category: 'emotional', description: '작은 변화에도 예민해요.' },
  { id: 'sentimental', label: '감성적', category: 'emotional', description: '감성적으로 생각해요.' },
  { id: 'rational', label: '이성적', category: 'emotional', description: '이성적으로 판단해요.' },
  { id: 'hotTempered', label: '다혈질', category: 'emotional', description: '욱하는 편이에요.' },
  { id: 'patient', label: '인내심', category: 'emotional', description: '참을성이 많아요.' },
  { id: 'moody', label: '감정 기복', category: 'emotional', description: '기분 변화가 큰 편이에요.' },
  { id: 'bashful', label: '부끄럼 많음', category: 'emotional', description: '쉽게 부끄러워해요.' },

  // 행동과 생활
  { id: 'diligent', label: '부지런함', category: 'behavior', description: '부지런히 움직여요.' },
  { id: 'lazy', label: '게으름', category: 'behavior', description: '느긋하게 쉬는 걸 좋아해요.' },
  { id: 'earnest', label: '성실함', category: 'behavior', description: '맡은 일에 성실해요.' },
  { id: 'perfectionist', label: '완벽주의', category: 'behavior', description: '완벽하게 해내려고 해요.' },
  { id: 'methodical', label: '계획적', category: 'behavior', description: '계획을 세워 움직여요.' },
  { id: 'spontaneous', label: '즉흥적', category: 'behavior', description: '즉흥적으로 행동해요.' },
  { id: 'curious', label: '호기심', category: 'behavior', description: '호기심이 많아요.' },
  { id: 'adventurous', label: '모험심', category: 'behavior', description: '새로운 걸 시도하길 좋아해요.' },
  { id: 'responsible', label: '책임감', category: 'behavior', description: '책임감이 강해요.' },
  { id: 'scatterbrained', label: '덤벙거림', category: 'behavior', description: '덤벙대는 편이에요.' },
  { id: 'meticulous', label: '꼼꼼함', category: 'behavior', description: '세심하고 꼼꼼해요.' },
  { id: 'easygoing', label: '느긋함', category: 'behavior', description: '여유롭고 느긋해요.' },

  // 대화 성향
  { id: 'talkative', label: '수다스러움', category: 'conversation', description: '말이 많은 편이에요.' },
  { id: 'reticent', label: '과묵함', category: 'conversation', description: '말수가 적어요.' },
  { id: 'humorous', label: '유머러스함', category: 'conversation', description: '유머 감각이 있어요.' },
  { id: 'blunt', label: '직설적', category: 'conversation', description: '직접적으로 말해요.' },
  { id: 'indirect', label: '돌려 말함', category: 'conversation', description: '에둘러 표현해요.' },
  { id: 'coy', label: '능청스러움', category: 'conversation', description: '능청스럽게 넘어가요.' },
  { id: 'sharpTongued', label: '독설가', category: 'conversation', description: '말이 날카로운 편이에요.' },
  { id: 'courteous', label: '정중함', category: 'conversation', description: '예의를 갖춰 말해요.' },
  { id: 'quirkySpeech', label: '말버릇이 많음', category: 'conversation', description: '특유의 말버릇이 있어요.' },
  { id: 'bigReactions', label: '리액션이 큼', category: 'conversation', description: '반응이 크고 확실해요.' },
  { id: 'goodListener', label: '경청함', category: 'conversation', description: '상대의 말을 잘 들어줘요.' },
  { id: 'inquisitive', label: '질문이 많음', category: 'conversation', description: '궁금한 게 많아요.' },

  // 관계에서의 태도
  { id: 'proactive', label: '적극적', category: 'relational', description: '관계에 적극적이에요.' },
  { id: 'passive', label: '소극적', category: 'relational', description: '관계에 소극적이에요.' },
  { id: 'hardToApproach', label: '다가가기 어려움', category: 'relational', description: '처음엔 다가가기 어려워요.' },
  { id: 'warmsUpSlowly', label: '친해지면 다정함', category: 'relational', description: '친해질수록 다정해져요.' },
  { id: 'competitive', label: '경쟁심', category: 'relational', description: '경쟁심이 강해요.' },
  { id: 'possessive', label: '소유욕', category: 'relational', description: '소유욕이 강한 편이에요.' },
  { id: 'obsessive', label: '집착적', category: 'relational', description: '한 번 집착하면 깊어져요.' },
  { id: 'keepsDistance', label: '거리 유지', category: 'relational', description: '적당한 거리를 유지해요.' },
  { id: 'loyal', label: '의리', category: 'relational', description: '의리를 중요하게 여겨요.' },
  { id: 'conflictAvoidant', label: '갈등 회피', category: 'relational', description: '갈등을 피하려고 해요.' },
  { id: 'eagerToReconcile', label: '화해에 적극적', category: 'relational', description: '먼저 화해를 청해요.' },
]

function neutralDef(spec: RawTagSpec): PersonalityTagDef {
  return { ...spec, initiateWeightDelta: 0, startChanceDelta: 0, behaviorWeightDelta: {}, lineAffinity: () => 0 }
}

/**
 * Honest, explicit overrides for the tags the spec actually named an effect
 * for (§3/§4's examples) — every tag *not* listed here stays fully neutral
 * (label/category/description only, zero weight anywhere). This is
 * deliberate, not an oversight: the spec explicitly says not to claim an
 * effect that isn't real, and to leave room to connect more tags later
 * rather than inventing behavior for all 71. See CLAUDE.md for the full
 * A/B/C breakdown.
 */
const OVERRIDES: Partial<Record<string, Partial<PersonalityTagDef>>> = {
  sociable: { initiateWeightDelta: 0.35, startChanceDelta: 0.3, behaviorWeightDelta: { approach: 1.2 } },
  energetic: {
    initiateWeightDelta: 0.25,
    behaviorWeightDelta: { wander: 1, changeRoom: 0.4 },
    lineAffinity: (line) => (tagsOrEmotionMatch(line, ['반가', '활발', 'excited', 'energetic']) ? 1 : 0),
  },
  introverted: { initiateWeightDelta: -0.2, behaviorWeightDelta: { seekSolitude: 1.2, changeRoom: -0.2 } },
  affectionate: {
    lineAffinity: (line) =>
      tagsOrEmotionMatch(line, ['다정', '애정', 'affection', 'caring', '따뜻']) ||
      line.categoryId === 'calling-partner' ||
      line.categoryId === 'worried'
        ? 1
        : 0,
  },
  gruff: { lineAffinity: (line) => (line.text.trim().length > 0 && line.text.trim().length <= 12 ? 1 : 0) },
  playful: {
    lineAffinity: (line) =>
      tagsOrEmotionMatch(line, ['장난', 'playful', 'teasing', '놀림']) || line.categoryId === 'teasing' ? 1 : 0,
  },
  calm: {
    behaviorWeightDelta: { rest: 1 },
    lineAffinity: (line) =>
      tagsOrEmotionMatch(line, ['차분', 'calm', '조용', 'quiet']) ||
      line.categoryId === 'resting-together' ||
      line.categoryId === 'casual-chat'
        ? 1
        : 0,
  },
  lazy: { behaviorWeightDelta: { rest: 0.8, changeRoom: -0.2 } },
  // "다양한 장소 탐색" now also biases toward changing rooms, not just wandering in place — a curious character is the one most likely to go looking through the house.
  curious: { behaviorWeightDelta: { wander: 0.6, changeRoom: 0.4 } },
  talkative: { startChanceDelta: 0.3 },
  // Terse: short lines suit 과묵함 the same way they suit 무뚝뚝함 (affection can be short and sincere). Affects only which line is picked, not how often.
  reticent: { startChanceDelta: -0.3, lineAffinity: (line) => (line.text.trim().length > 0 && line.text.trim().length <= 12 ? 1 : 0) },
  // 수줍음: careful, hesitant expressions. 활발함: eager, delighted ones (반가움).
  shy: {
    initiateWeightDelta: -0.3,
    startChanceDelta: -0.25,
    lineAffinity: (line) => (tagsOrEmotionMatch(line, ['수줍', '조심', '쑥스', 'shy']) ? 1 : 0),
  },
  blunt: { lineAffinity: (line) => (tagsOrEmotionMatch(line, ['직설', '직접', '단도직입', 'blunt', 'direct']) ? 1 : 0) },
}

export const PERSONALITY_TAG_DEFS: Record<string, PersonalityTagDef> = Object.fromEntries(
  RAW_TAGS.map((spec) => {
    const def = neutralDef(spec)
    const override = OVERRIDES[spec.id]
    return [spec.id, override ? { ...def, ...override } : def]
  }),
)

export const PERSONALITY_TAG_ORDER: string[] = RAW_TAGS.map((spec) => spec.id)

export function getTagsByCategory(category: PersonalityCategory): PersonalityTagDef[] {
  return PERSONALITY_TAG_ORDER.map((id) => PERSONALITY_TAG_DEFS[id]).filter((def) => def.category === category)
}

/** Display label for any selected tag id — built-in or custom — shared by the picker UI and anywhere else that needs to show a character's personality (e.g. the character list summary). */
export function getPersonalityLabel(id: string, customTags: CustomPersonalityTag[]): string {
  return PERSONALITY_TAG_DEFS[id]?.label ?? customTags.find((tag) => tag.id === id)?.label ?? id
}

/** Sum of each selected tag's initiate delta, clamped to a sane multiplier range — no single tag can zero out or explode the base chance. */
export function initiateWeightFor(tags: string[]): number {
  const delta = tags.reduce((sum, tagId) => sum + (PERSONALITY_TAG_DEFS[tagId]?.initiateWeightDelta ?? 0), 0)
  return Math.min(2.5, Math.max(0.15, 1 + delta))
}

/** Sum of each selected tag's start-chance delta — how much this character's own presence in a pair raises/lowers the odds their encounter turns into a conversation at all. */
export function startChanceWeightFor(tags: string[]): number {
  const delta = tags.reduce((sum, tagId) => sum + (PERSONALITY_TAG_DEFS[tagId]?.startChanceDelta ?? 0), 0)
  return Math.min(2.5, Math.max(0.15, 1 + delta))
}

/** Sum of each selected tag's weight delta for one behavior type, on top of a base weight of 1 so an untagged character still picks among all behaviors normally. */
export function behaviorWeightFor(tags: string[], behavior: BehaviorType): number {
  const bonus = tags.reduce((sum, tagId) => sum + (PERSONALITY_TAG_DEFS[tagId]?.behaviorWeightDelta[behavior] ?? 0), 0)
  return Math.max(0.05, 1 + bonus)
}

/** Sum of each selected tag's affinity bonus for this line, on top of a base weight of 1 so untagged/no-tag characters still select lines normally. */
export function lineAffinityWeightFor(tags: string[], line: CharacterDialogueLine): number {
  const bonus = tags.reduce((sum, tagId) => sum + (PERSONALITY_TAG_DEFS[tagId]?.lineAffinity(line) ?? 0), 0)
  return 1 + bonus
}

export interface CustomPersonalityTagLike {
  id: string
  mappedTagId?: string
}

/**
 * Translates a character's raw selected tag ids (a mix of built-in ids and
 * custom-tag ids) into the subset of *built-in* ids that actually drive any
 * weighting function above. A custom tag with no `mappedTagId` contributes
 * nothing — per spec, a user-typed custom personality never gets an
 * invented effect, only the effect of a built-in tag the user explicitly
 * chose to borrow.
 */
export function resolveWeightingTagIds(rawTagIds: string[], customTags: CustomPersonalityTagLike[]): string[] {
  const customById = new Map(customTags.map((tag) => [tag.id, tag]))
  const resolved: string[] = []
  for (const id of rawTagIds) {
    if (id in PERSONALITY_TAG_DEFS) {
      resolved.push(id)
      continue
    }
    const mappedTagId = customById.get(id)?.mappedTagId
    if (mappedTagId && mappedTagId in PERSONALITY_TAG_DEFS) resolved.push(mappedTagId)
  }
  return resolved
}
