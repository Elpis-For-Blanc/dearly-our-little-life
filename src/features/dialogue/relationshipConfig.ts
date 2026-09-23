/** `'romantic'` is the persisted id for 연인 and `'married'` for 부부 — two distinct types that share affection content but keep their own exclusive content. Never rename an id: it's what saved data stores. */
export type RelationshipType = 'romantic' | 'married' | 'close' | 'friend' | 'family' | 'rival' | 'awkward'

/** The relationship types that count as romantic — the single place "is this pair a couple" is answered. */
export const ROMANTIC_RELATIONSHIP_TYPES: readonly RelationshipType[] = ['romantic', 'married']

export function isRomanticRelationship(type: RelationshipType): boolean {
  return ROMANTIC_RELATIONSHIP_TYPES.includes(type)
}

export interface RelationshipPreset {
  label: string
  description: string
  /** Multiplies the auto-dialogue start chance from autoDialogueConfig.ts — relationship type alone never fully decides whether a conversation starts. */
  startProbabilityMultiplier: number
  /** Only the romantic types ('romantic', 'married') allow lines tagged/emoted as romantic to be auto-selected — every other type hard-excludes them. */
  allowsRomanticLines: boolean
}

export const RELATIONSHIP_PRESETS: Record<RelationshipType, RelationshipPreset> = {
  romantic: {
    label: '연인',
    description: '로맨틱한 대사도 자동 대화 후보에 포함돼요.',
    startProbabilityMultiplier: 1.2,
    allowsRomanticLines: true,
  },
  married: {
    label: '부부',
    description: '오래 함께한 듯 편안하고 다정한 애정 대사도 자동 대화 후보에 포함돼요.',
    startProbabilityMultiplier: 1.2,
    allowsRomanticLines: true,
  },
  close: {
    label: '친밀한 관계',
    description: '가깝고 편안한 사이예요.',
    startProbabilityMultiplier: 1.1,
    allowsRomanticLines: false,
  },
  friend: {
    label: '친구',
    description: '편하게 대화를 주고받는 사이예요.',
    startProbabilityMultiplier: 1,
    allowsRomanticLines: false,
  },
  family: {
    label: '가족',
    description: '가족으로서 대화해요.',
    startProbabilityMultiplier: 0.9,
    allowsRomanticLines: false,
  },
  rival: {
    label: '라이벌',
    description: '서로를 의식하는 사이라 대화를 조금 덜 걸어요.',
    startProbabilityMultiplier: 0.8,
    allowsRomanticLines: false,
  },
  awkward: {
    label: '어색한 관계',
    description: '아직 어색해서 먼저 말을 거는 일이 드물어요.',
    startProbabilityMultiplier: 0.5,
    allowsRomanticLines: false,
  },
}

export const RELATIONSHIP_TYPE_ORDER: RelationshipType[] = ['romantic', 'married', 'close', 'friend', 'family', 'rival', 'awkward']

export const DEFAULT_RELATIONSHIP_TYPE: RelationshipType = 'close'

/** Best-effort heuristic over user-entered free text (tags/emotion) — there's no structured "romantic line" field, so this can miss or over-match; the hard guard is still enforced in the engine regardless. */
const ROMANTIC_KEYWORDS = ['로맨틱', '연인', '애정표현', '설렘', 'romance', 'romantic']

export function isRomanticLine(tags: string[], emotion: string): boolean {
  const lower = emotion.toLowerCase()
  if (ROMANTIC_KEYWORDS.some((k) => lower.includes(k.toLowerCase()))) return true
  return tags.some((tag) => ROMANTIC_KEYWORDS.some((k) => tag.toLowerCase().includes(k.toLowerCase())))
}
