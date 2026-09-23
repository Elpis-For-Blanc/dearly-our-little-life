import type { CharacterImageBounds } from './characterImageAnalysis'

export interface CharacterTraits {
  personality: string
  favoriteColor: string
}

export type BaseTone = 'formal' | 'casual' | 'mixed' | 'custom'

/**
 * The `baseTone` select is only a convenience shortcut — `toneDetail` (free
 * text) is what's actually authoritative and always sent to the AI, per the
 * spec's "선택형 설정은 보조 수단, 자유 입력이 우선" rule.
 */
export interface CharacterToneSettings {
  baseTone: BaseTone
  toneDetail: string
  addressForPartner: string
  firstPerson: string
  catchphrases: string
  avoidPhrases: string
  verbalTic: string
}

export const EMPTY_TONE_SETTINGS: CharacterToneSettings = {
  baseTone: 'casual',
  toneDetail: '',
  addressForPartner: '',
  firstPerson: '',
  catchphrases: '',
  avoidPhrases: '',
  verbalTic: '',
}

/**
 * One registered example line. `categoryId` references either a built-in
 * id from situationCategories.ts or a custom SituationCategory's id.
 * `isFallback` marks a line as safe to use even when no line exists for
 * the exact situation being asked for — Phase 3's (not yet built) playback
 * logic must never invent a line outside what's registered here, per the
 * spec: skip the bubble, or use only a line explicitly marked this way.
 */
export interface CharacterDialogueLine {
  id: string
  categoryId: string
  situationNote: string
  text: string
  emotion: string
  tags: string[]
  isFallback: boolean
}

/**
 * A user-typed personality not in the built-in list (personalityTags.ts).
 * `mappedTagId`, if set, means the user explicitly chose "치면 이 성격처럼
 * 행동해요" for a built-in tag — only then does this custom tag borrow that
 * tag's behavior/dialogue weighting. Never invent an effect for an
 * unmapped custom tag.
 */
export interface CustomPersonalityTag {
  id: string
  label: string
  mappedTagId?: string
}

/**
 * Detailed persona used only for AI dialogue prompting — kept separate from
 * `traits` (the lightweight Phase 1 fields shown in the character card) so
 * this can grow without touching the original registration flow.
 */
export interface CharacterAIProfile {
  personality: string
  habits: string
  preferredActivities: string
  relationship: string
  /** Facts about this character the AI must never contradict or invent around. */
  neverChange: string
  tone: CharacterToneSettings
  dialogueLines: CharacterDialogueLine[]
  /** Up to MAX_PERSONALITY_TAGS ids — a mix of personalityTags.ts built-in ids and this character's own `customPersonalityTags` ids — used only by the auto-dialogue/movement engines' weighting, separate from the free-text `personality` field above, which stays AI-prompt-only. */
  personalityTags: string[]
  /** User-added personalities not in the built-in list, stored per character. Counted toward the same MAX_PERSONALITY_TAGS limit as built-in tags. */
  customPersonalityTags: CustomPersonalityTag[]
}

export const EMPTY_AI_PROFILE: CharacterAIProfile = {
  personality: '',
  habits: '',
  preferredActivities: '',
  relationship: '',
  neverChange: '',
  tone: EMPTY_TONE_SETTINGS,
  dialogueLines: [],
  personalityTags: [],
  customPersonalityTags: [],
}

export interface Character {
  id: string
  name: string
  imageDataUrl: string
  traits: CharacterTraits
  aiProfile: CharacterAIProfile
  /** Multiplier on the base sprite display height in the Live room (character/characterDisplay.ts) — purely visual, never affects movement/collision math. */
  displayScale: number
  /** Per-character correction (fraction of rendered height) for transparent padding under the feet in the uploaded PNG — see character/characterDisplay.ts. Shifts only the sprite/placeholder image, never the logical movement coordinate or the shadow. Combines additively with the automatic `imageBounds`-derived correction below — this is the user's own extra nudge on top of it, never a replacement for it. */
  footOffsetRatio: number
  /** The uploaded PNG's detected opaque-pixel bounding box (character/characterImageAnalysis.ts), computed once at registration. `null` means never analyzed or analysis failed — every consumer must fall back to treating the full image as the character (the pre-analysis behavior), never crash or guess. */
  imageBounds: CharacterImageBounds | null
}
