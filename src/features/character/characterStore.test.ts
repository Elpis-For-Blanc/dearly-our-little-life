import { describe, expect, it, beforeEach } from 'vitest'
import { useCharacterStore } from './characterStore'
import { EMPTY_AI_PROFILE } from './types'

describe('characterStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useCharacterStore.setState({ characters: [] })
  })

  it('adds, updates, and removes a character', () => {
    const character = {
      id: '1',
      name: 'Milo',
      imageDataUrl: 'data:image/png;base64,',
      displayScale: 1, footOffsetRatio: 0, imageBounds: null,
      traits: { personality: 'playful', favoriteColor: 'blue' },
      aiProfile: EMPTY_AI_PROFILE,
    }

    useCharacterStore.getState().addCharacter(character)
    expect(useCharacterStore.getState().characters).toHaveLength(1)

    useCharacterStore.getState().updateCharacter('1', { name: 'Milo Jr.' })
    expect(useCharacterStore.getState().characters[0].name).toBe('Milo Jr.')

    useCharacterStore.getState().removeCharacter('1')
    expect(useCharacterStore.getState().characters).toHaveLength(0)
  })

  it('updateAIProfile merges a partial patch without touching other fields', () => {
    useCharacterStore.getState().addCharacter({
      id: '1',
      name: 'Milo',
      imageDataUrl: 'data:image/png;base64,',
      displayScale: 1, footOffsetRatio: 0, imageBounds: null,
      traits: { personality: 'playful', favoriteColor: 'blue' },
      aiProfile: EMPTY_AI_PROFILE,
    })

    useCharacterStore.getState().updateAIProfile('1', { relationship: '연인' })

    const updated = useCharacterStore.getState().characters[0].aiProfile
    expect(updated.relationship).toBe('연인')
    expect(updated.personality).toBe('')
  })

  it('updateToneSettings merges into the nested tone object only', () => {
    useCharacterStore.getState().addCharacter({
      id: '1',
      name: 'Milo',
      imageDataUrl: 'data:image/png;base64,',
      displayScale: 1, footOffsetRatio: 0, imageBounds: null,
      traits: { personality: '', favoriteColor: '' },
      aiProfile: EMPTY_AI_PROFILE,
    })

    useCharacterStore.getState().updateToneSettings('1', { baseTone: 'formal', catchphrases: '그치?' })

    const tone = useCharacterStore.getState().characters[0].aiProfile.tone
    expect(tone.baseTone).toBe('formal')
    expect(tone.catchphrases).toBe('그치?')
    expect(tone.addressForPartner).toBe('')
  })

  it('adds, edits, removes, and reorders dialogue lines independently per character', () => {
    useCharacterStore.getState().addCharacter({
      id: 'a',
      name: 'Milo',
      imageDataUrl: 'data:image/png;base64,',
      displayScale: 1, footOffsetRatio: 0, imageBounds: null,
      traits: { personality: '', favoriteColor: '' },
      aiProfile: EMPTY_AI_PROFILE,
    })
    useCharacterStore.getState().addCharacter({
      id: 'b',
      name: 'Luna',
      imageDataUrl: 'data:image/png;base64,',
      displayScale: 1, footOffsetRatio: 0, imageBounds: null,
      traits: { personality: '', favoriteColor: '' },
      aiProfile: EMPTY_AI_PROFILE,
    })

    useCharacterStore.getState().addDialogueLine('a', {
      id: 'line-1',
      categoryId: 'morning-greeting',
      situationNote: '',
      text: '좋은 아침!',
      emotion: 'happy',
      tags: ['아침'],
      isFallback: false,
    })
    useCharacterStore.getState().addDialogueLine('a', {
      id: 'line-2',
      categoryId: 'meal',
      situationNote: '',
      text: '밥 먹자',
      emotion: 'neutral',
      tags: [],
      isFallback: false,
    })

    expect(useCharacterStore.getState().characters.find((c) => c.id === 'a')?.aiProfile.dialogueLines).toHaveLength(2)
    expect(useCharacterStore.getState().characters.find((c) => c.id === 'b')?.aiProfile.dialogueLines).toHaveLength(0)

    useCharacterStore.getState().updateDialogueLine('a', 'line-1', { text: '좋은 아침이에요!' })
    expect(useCharacterStore.getState().characters[0].aiProfile.dialogueLines[0].text).toBe('좋은 아침이에요!')

    useCharacterStore.getState().reorderDialogueLines('a', ['line-2', 'line-1'])
    expect(useCharacterStore.getState().characters[0].aiProfile.dialogueLines.map((l) => l.id)).toEqual(['line-2', 'line-1'])

    useCharacterStore.getState().removeDialogueLine('a', 'line-1')
    expect(useCharacterStore.getState().characters[0].aiProfile.dialogueLines.map((l) => l.id)).toEqual(['line-2'])
  })

  it('persists characters (including tone and dialogue lines) to localStorage', () => {
    useCharacterStore.getState().addCharacter({
      id: '1',
      name: 'Milo',
      imageDataUrl: 'data:image/png;base64,',
      displayScale: 1, footOffsetRatio: 0, imageBounds: null,
      traits: { personality: '', favoriteColor: '' },
      aiProfile: EMPTY_AI_PROFILE,
    })
    useCharacterStore.getState().updateToneSettings('1', { baseTone: 'formal' })
    useCharacterStore.getState().addDialogueLine('1', {
      id: 'line-1',
      categoryId: 'meal',
      situationNote: '',
      text: '식사하세요',
      emotion: '',
      tags: [],
      isFallback: false,
    })

    const stored = JSON.parse(localStorage.getItem('dearly-characters') ?? '{}')
    expect(stored.state.characters[0].aiProfile.tone.baseTone).toBe('formal')
    expect(stored.state.characters[0].aiProfile.dialogueLines).toHaveLength(1)
  })

  it('migrates a pre-tone-system character (old string tone + sampleLines) without losing data', () => {
    const legacy = {
      id: '1',
      name: 'Milo',
      imageDataUrl: 'data:image/png;base64,',
      traits: { personality: '', favoriteColor: '' },
      aiProfile: {
        personality: '장난기 많음',
        tone: '반말로 장난스럽게',
        addressForPartner: '자기야',
        catchphrases: '헤헤',
        avoidPhrases: '',
        sampleLines: '오늘 저녁 뭐 먹을까?',
        habits: '',
        preferredActivities: '',
        relationship: '',
        neverChange: '',
      },
    }

    useCharacterStore.getState().addCharacter(legacy as never)

    const migrated = useCharacterStore.getState().characters[0].aiProfile
    expect(migrated.tone.baseTone).toBe('custom')
    expect(migrated.tone.toneDetail).toBe('반말로 장난스럽게')
    expect(migrated.tone.addressForPartner).toBe('자기야')
    expect(migrated.dialogueLines).toHaveLength(1)
    expect(migrated.dialogueLines[0].text).toBe('오늘 저녁 뭐 먹을까?')
  })

  it('defaults personalityTags to an empty array for a character saved before the field existed', () => {
    const legacy = {
      id: '1',
      name: 'Milo',
      imageDataUrl: 'data:image/png;base64,',
      traits: { personality: '', favoriteColor: '' },
      aiProfile: { ...EMPTY_AI_PROFILE, personalityTags: undefined },
    }

    useCharacterStore.getState().addCharacter(legacy as never)

    expect(useCharacterStore.getState().characters[0].aiProfile.personalityTags).toEqual([])
  })

  it('defaults displayScale to 1 for a character saved before the field existed, without disturbing anything else', () => {
    const legacy = {
      id: '1',
      name: 'Milo',
      imageDataUrl: 'data:image/png;base64,',
      traits: { personality: '', favoriteColor: '' },
      aiProfile: EMPTY_AI_PROFILE,
    }

    useCharacterStore.getState().addCharacter(legacy as never)

    expect(useCharacterStore.getState().characters[0].displayScale).toBe(1)
  })

  it('clamps an out-of-range saved displayScale into the 0.5-2 range on load', () => {
    const outOfRange = {
      id: '1',
      name: 'Milo',
      imageDataUrl: 'data:image/png;base64,',
      displayScale: 5,
      traits: { personality: '', favoriteColor: '' },
      aiProfile: EMPTY_AI_PROFILE,
    }

    useCharacterStore.getState().addCharacter(outOfRange as never)

    expect(useCharacterStore.getState().characters[0].displayScale).toBe(2)
  })

  it('migrates a legacy free-text traits.personality value matching a built-in label into that tag, preserving the original string', () => {
    const legacy = {
      id: '1',
      name: 'Milo',
      imageDataUrl: 'data:image/png;base64,',
      traits: { personality: '활발함', favoriteColor: '' },
      aiProfile: { ...EMPTY_AI_PROFILE, personalityTags: undefined },
    }

    useCharacterStore.getState().addCharacter(legacy as never)

    const character = useCharacterStore.getState().characters[0]
    expect(character.aiProfile.personalityTags).toEqual(['energetic'])
    expect(character.aiProfile.customPersonalityTags).toEqual([])
    expect(character.traits.personality).toBe('활발함')
  })

  it('migrates a legacy free-text traits.personality value with no built-in match into a preserved custom tag', () => {
    const legacy = {
      id: '1',
      name: 'Milo',
      imageDataUrl: 'data:image/png;base64,',
      traits: { personality: '엉뚱함', favoriteColor: '' },
      aiProfile: { ...EMPTY_AI_PROFILE, personalityTags: undefined },
    }

    useCharacterStore.getState().addCharacter(legacy as never)

    const character = useCharacterStore.getState().characters[0]
    expect(character.aiProfile.customPersonalityTags).toHaveLength(1)
    expect(character.aiProfile.customPersonalityTags[0].label).toBe('엉뚱함')
    expect(character.aiProfile.personalityTags).toEqual([character.aiProfile.customPersonalityTags[0].id])
    expect(character.traits.personality).toBe('엉뚱함')
  })

  it('does not re-migrate or duplicate tags once personalityTags is already a real (even empty) array', () => {
    const alreadyMigrated = {
      id: '1',
      name: 'Milo',
      imageDataUrl: 'data:image/png;base64,',
      traits: { personality: '활발함', favoriteColor: '' },
      aiProfile: { ...EMPTY_AI_PROFILE, personalityTags: [], customPersonalityTags: [] },
    }

    useCharacterStore.getState().addCharacter(alreadyMigrated as never)

    // The user already cleared their tags after the one-time migration — an empty
    // (but present) array must be respected, not silently re-populated from the old string.
    expect(useCharacterStore.getState().characters[0].aiProfile.personalityTags).toEqual([])
  })

  it('updateAIProfile can set personalityTags without disturbing other fields', () => {
    useCharacterStore.getState().addCharacter({
      id: '1',
      name: 'Milo',
      imageDataUrl: 'data:image/png;base64,',
      displayScale: 1, footOffsetRatio: 0, imageBounds: null,
      traits: { personality: '', favoriteColor: '' },
      aiProfile: EMPTY_AI_PROFILE,
    })

    useCharacterStore.getState().updateAIProfile('1', { personalityTags: ['sociable', 'playful'] })

    const updated = useCharacterStore.getState().characters[0].aiProfile
    expect(updated.personalityTags).toEqual(['sociable', 'playful'])
    expect(updated.relationship).toBe('')
  })
})
