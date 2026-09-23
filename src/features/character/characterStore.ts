import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { clampDisplayScale, clampFootOffsetRatio, DEFAULT_DISPLAY_SCALE, DEFAULT_FOOT_OFFSET_RATIO } from './characterDisplay'
import type { CharacterImageBounds } from './characterImageAnalysis'
import { PERSONALITY_TAG_DEFS, PERSONALITY_TAG_ORDER } from './personalityTags'
import {
  EMPTY_TONE_SETTINGS,
  type Character,
  type CharacterAIProfile,
  type CharacterDialogueLine,
  type CharacterToneSettings,
  type CustomPersonalityTag,
} from './types'

/** Defensive shape-check for persisted `imageBounds` — anything else (missing, corrupted, an old shape) falls back to `null`, i.e. "no correction", never a crash. */
function normalizeImageBounds(raw: unknown): CharacterImageBounds | null {
  if (typeof raw !== 'object' || raw === null) return null
  const candidate = raw as Partial<CharacterImageBounds>
  const values = [candidate.topRatio, candidate.bottomRatio, candidate.leftRatio, candidate.rightRatio]
  if (!values.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1)) return null
  if (candidate.bottomRatio! <= candidate.topRatio! || candidate.rightRatio! <= candidate.leftRatio!) return null
  return {
    topRatio: candidate.topRatio!,
    bottomRatio: candidate.bottomRatio!,
    leftRatio: candidate.leftRatio!,
    rightRatio: candidate.rightRatio!,
  }
}

interface CharacterState {
  characters: Character[]
  addCharacter: (character: Character) => void
  updateCharacter: (id: string, patch: Partial<Omit<Character, 'id'>>) => void
  setDisplayScale: (id: string, scale: number) => void
  setFootOffsetRatio: (id: string, ratio: number) => void
  updateAIProfile: (id: string, patch: Partial<Omit<CharacterAIProfile, 'tone' | 'dialogueLines'>>) => void
  updateToneSettings: (id: string, patch: Partial<CharacterToneSettings>) => void
  addDialogueLine: (characterId: string, line: CharacterDialogueLine) => void
  updateDialogueLine: (characterId: string, lineId: string, patch: Partial<Omit<CharacterDialogueLine, 'id'>>) => void
  removeDialogueLine: (characterId: string, lineId: string) => void
  reorderDialogueLines: (characterId: string, orderedIds: string[]) => void
  removeCharacter: (id: string) => void
  /**
   * Replaces the entire character list in one call — the one mutation the
   * manual save/load feature (`features/save/saveRestore.ts`) ever makes.
   * Reuses the exact same `loadCharacters` defensive normalizer the persist
   * `merge` hook already runs on every reload, so a save blob with a
   * damaged character entry is handled exactly as gracefully as corrupted
   * `localStorage` already is (a bad entry is dropped, healthy ones with
   * their PNG/dialogue lines load fine, never a crash).
   */
  restoreCharacters: (characters: Character[]) => void
}

/**
 * Fills in fields introduced after a character may have already been
 * saved — including migrating the pre-persistence shape where `tone` was a
 * plain string and `sampleLines` was a single free-text blob, into the
 * current structured `CharacterToneSettings` + `CharacterDialogueLine[]`.
 * No user-entered text is ever dropped or rewritten by this, only reshaped.
 */
function normalizeCharacter(raw: Partial<Character> & { id: string; name: string; imageDataUrl: string }): Character {
  const rawProfile = (raw.aiProfile ?? {}) as Record<string, unknown>
  const rawTone = rawProfile.tone

  let tone: CharacterToneSettings
  let migratedLine: CharacterDialogueLine | null = null

  if (typeof rawTone === 'string') {
    tone = {
      ...EMPTY_TONE_SETTINGS,
      baseTone: 'custom',
      toneDetail: rawTone,
      addressForPartner: typeof rawProfile.addressForPartner === 'string' ? rawProfile.addressForPartner : '',
      catchphrases: typeof rawProfile.catchphrases === 'string' ? rawProfile.catchphrases : '',
      avoidPhrases: typeof rawProfile.avoidPhrases === 'string' ? rawProfile.avoidPhrases : '',
    }
    if (typeof rawProfile.sampleLines === 'string' && rawProfile.sampleLines.trim() !== '') {
      migratedLine = {
        id: crypto.randomUUID(),
        categoryId: 'casual-chat',
        situationNote: '',
        text: rawProfile.sampleLines.trim(),
        emotion: 'neutral',
        tags: [],
        isFallback: false,
      }
    }
  } else {
    tone = { ...EMPTY_TONE_SETTINGS, ...(rawTone as Partial<CharacterToneSettings> | undefined) }
  }

  const dialogueLines = Array.isArray(rawProfile.dialogueLines)
    ? normalizeDialogueLines(rawProfile.dialogueLines)
    : migratedLine
      ? [migratedLine]
      : []

  const legacyPersonalityString = (raw.traits as { personality?: string } | undefined)?.personality ?? ''

  // `personalityTags` field absent entirely (not just empty) means this character predates the
  // personality-tag system — one-time migrate its old free-text `traits.personality` value into a
  // tag (if it matches a built-in label) or a custom tag (if it doesn't), without ever touching or
  // clearing the original string. Once real (even empty) `personalityTags`/`customPersonalityTags`
  // exist, this branch never runs again for that character — see the store's `merge` doc comment.
  let personalityTags: string[]
  let customPersonalityTags: CustomPersonalityTag[]
  if (Array.isArray(rawProfile.personalityTags)) {
    personalityTags = (rawProfile.personalityTags as unknown[]).filter((tag): tag is string => typeof tag === 'string')
    customPersonalityTags = normalizeCustomPersonalityTags(rawProfile.customPersonalityTags)
  } else {
    const migrated = migrateLegacyPersonalityString(legacyPersonalityString)
    personalityTags = migrated.personalityTags
    customPersonalityTags = migrated.customPersonalityTags
  }

  return {
    id: raw.id,
    name: raw.name,
    imageDataUrl: raw.imageDataUrl,
    displayScale: typeof raw.displayScale === 'number' ? clampDisplayScale(raw.displayScale) : DEFAULT_DISPLAY_SCALE,
    footOffsetRatio: typeof raw.footOffsetRatio === 'number' ? clampFootOffsetRatio(raw.footOffsetRatio) : DEFAULT_FOOT_OFFSET_RATIO,
    imageBounds: normalizeImageBounds(raw.imageBounds),
    traits: {
      personality: legacyPersonalityString,
      favoriteColor: (raw.traits as { favoriteColor?: string } | undefined)?.favoriteColor ?? '',
    },
    aiProfile: {
      personality: typeof rawProfile.personality === 'string' ? rawProfile.personality : '',
      habits: typeof rawProfile.habits === 'string' ? rawProfile.habits : '',
      preferredActivities: typeof rawProfile.preferredActivities === 'string' ? rawProfile.preferredActivities : '',
      relationship: typeof rawProfile.relationship === 'string' ? rawProfile.relationship : '',
      neverChange: typeof rawProfile.neverChange === 'string' ? rawProfile.neverChange : '',
      tone,
      dialogueLines,
      personalityTags,
      customPersonalityTags,
    },
  }
}

/**
 * Keeps every saved dialogue line that has an id and text — the text is never
 * touched — and fills the descriptive fields a damaged line may lack. Entries
 * that aren't lines at all (null, numbers, an object without id/text) are
 * skipped so one bad line can't break the dialogue engine for that character.
 */
function normalizeDialogueLines(raw: unknown[]): CharacterDialogueLine[] {
  const seen = new Set<string>()
  const lines: CharacterDialogueLine[] = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue
    const line = entry as Record<string, unknown>
    if (typeof line.id !== 'string' || line.id === '' || typeof line.text !== 'string' || seen.has(line.id)) continue
    seen.add(line.id)
    lines.push({
      id: line.id,
      categoryId: typeof line.categoryId === 'string' ? line.categoryId : 'casual-chat',
      situationNote: typeof line.situationNote === 'string' ? line.situationNote : '',
      text: line.text,
      emotion: typeof line.emotion === 'string' ? line.emotion : 'neutral',
      tags: Array.isArray(line.tags) ? line.tags.filter((tag): tag is string => typeof tag === 'string') : [],
      isFallback: line.isFallback === true,
    })
  }
  return lines
}

/**
 * The characters worth keeping from a saved list: objects with a real id (first
 * one wins for a repeated id). A damaged entry is skipped on its own; the
 * healthy characters — with their uploaded PNG and every registered line —
 * always load. A missing name/image becomes empty text rather than dropping
 * the character.
 */
function loadCharacters(raw: unknown): Character[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const characters: Character[] = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue
    const candidate = entry as Partial<Character>
    if (typeof candidate.id !== 'string' || candidate.id === '' || seen.has(candidate.id)) continue
    seen.add(candidate.id)
    characters.push(
      normalizeCharacter({
        ...candidate,
        id: candidate.id,
        name: typeof candidate.name === 'string' ? candidate.name : '',
        imageDataUrl: typeof candidate.imageDataUrl === 'string' ? candidate.imageDataUrl : '',
      }),
    )
  }
  return characters
}

function normalizeCustomPersonalityTags(raw: unknown): CustomPersonalityTag[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((entry): entry is CustomPersonalityTag => {
    if (typeof entry !== 'object' || entry === null) return false
    const candidate = entry as Record<string, unknown>
    if (typeof candidate.id !== 'string' || typeof candidate.label !== 'string') return false
    return candidate.mappedTagId === undefined || typeof candidate.mappedTagId === 'string'
  })
}

/**
 * Converts a pre-tag-system `traits.personality` free-text value into the
 * new tag shape: an exact label match against a built-in tag becomes that
 * tag id, anything else (including "" — nothing to migrate) becomes a
 * single preserved custom tag, or no tags at all if the string is empty.
 */
function migrateLegacyPersonalityString(value: string): { personalityTags: string[]; customPersonalityTags: CustomPersonalityTag[] } {
  const trimmed = value.trim()
  if (!trimmed) return { personalityTags: [], customPersonalityTags: [] }

  const matchedId = PERSONALITY_TAG_ORDER.find((id) => PERSONALITY_TAG_DEFS[id].label === trimmed)
  if (matchedId) return { personalityTags: [matchedId], customPersonalityTags: [] }

  const customTag: CustomPersonalityTag = { id: crypto.randomUUID(), label: trimmed }
  return { personalityTags: [customTag.id], customPersonalityTags: [customTag] }
}

export const useCharacterStore = create<CharacterState>()(
  persist(
    (set) => ({
      characters: [],
      addCharacter: (character) => set((state) => ({ characters: [...state.characters, normalizeCharacter(character)] })),
      updateCharacter: (id, patch) =>
        set((state) => ({
          characters: state.characters.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      setDisplayScale: (id, scale) =>
        set((state) => ({
          characters: state.characters.map((c) => (c.id === id ? { ...c, displayScale: clampDisplayScale(scale) } : c)),
        })),
      setFootOffsetRatio: (id, ratio) =>
        set((state) => ({
          characters: state.characters.map((c) => (c.id === id ? { ...c, footOffsetRatio: clampFootOffsetRatio(ratio) } : c)),
        })),
      updateAIProfile: (id, patch) =>
        set((state) => ({
          characters: state.characters.map((c) => (c.id === id ? { ...c, aiProfile: { ...c.aiProfile, ...patch } } : c)),
        })),
      updateToneSettings: (id, patch) =>
        set((state) => ({
          characters: state.characters.map((c) =>
            c.id === id ? { ...c, aiProfile: { ...c.aiProfile, tone: { ...c.aiProfile.tone, ...patch } } } : c,
          ),
        })),
      addDialogueLine: (characterId, line) =>
        set((state) => ({
          characters: state.characters.map((c) =>
            c.id === characterId ? { ...c, aiProfile: { ...c.aiProfile, dialogueLines: [...c.aiProfile.dialogueLines, line] } } : c,
          ),
        })),
      updateDialogueLine: (characterId, lineId, patch) =>
        set((state) => ({
          characters: state.characters.map((c) =>
            c.id === characterId
              ? {
                  ...c,
                  aiProfile: {
                    ...c.aiProfile,
                    dialogueLines: c.aiProfile.dialogueLines.map((line) => (line.id === lineId ? { ...line, ...patch } : line)),
                  },
                }
              : c,
          ),
        })),
      removeDialogueLine: (characterId, lineId) =>
        set((state) => ({
          characters: state.characters.map((c) =>
            c.id === characterId
              ? { ...c, aiProfile: { ...c.aiProfile, dialogueLines: c.aiProfile.dialogueLines.filter((line) => line.id !== lineId) } }
              : c,
          ),
        })),
      reorderDialogueLines: (characterId, orderedIds) =>
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== characterId) return c
            const byId = new Map(c.aiProfile.dialogueLines.map((line) => [line.id, line]))
            const reordered = orderedIds.map((id) => byId.get(id)).filter((line): line is CharacterDialogueLine => line !== undefined)
            return { ...c, aiProfile: { ...c.aiProfile, dialogueLines: reordered } }
          }),
        })),
      removeCharacter: (id) => set((state) => ({ characters: state.characters.filter((c) => c.id !== id) })),
      restoreCharacters: (characters) => set({ characters: loadCharacters(characters) }),
    }),
    {
      name: 'dearly-characters',
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<CharacterState> | undefined
        return { ...currentState, characters: loadCharacters(persisted?.characters) }
      },
    },
  ),
)
