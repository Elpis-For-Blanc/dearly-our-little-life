import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LiveScreen } from '../../app/LiveScreen'
import { useCharacterStore } from '../character/characterStore'
import { EMPTY_AI_PROFILE, type BaseTone, type Character } from '../character/types'
import { useHomeStore } from '../home/homeStore'
import { useCharacterMovementStore, type CharacterMovementState } from '../simulation/characterMovementStore'
import { useSimulationStore } from '../simulation/simulationStore'
import { BUBBLE_REVEAL_INTERVAL_MS, MAX_BUNDLE_LINES } from './autoDialogueConfig'
import { startManualConversation } from './autoDialogueTrigger'
import { buildAutoDialogueBundle, type AutoDialogueParticipant } from './autoDialogueEngine'
import { DEFAULT_DIALOGUE_BUNDLES, type DefaultDialogueBundleDef } from './defaultDialogueLibrary'
import { DEFAULT_MONOLOGUE_LIBRARY } from './defaultMonologueLibrary'
import { useDialogueFrequencyStore } from './dialogueFrequencyStore'
import { useDialogueStore } from './dialogueStore'
import { useMonologueFrequencyStore } from './monologueFrequencyStore'
import { useMonologueStore } from './monologueStore'
import { runMonologuePass } from './monologueTrigger'
import { pairKey } from './pairKey'
import { DEFAULT_RELATIONSHIP_TYPE, RELATIONSHIP_TYPE_ORDER, type RelationshipType } from './relationshipConfig'
import {
  AWKWARD_DIALOGUE_BUNDLES,
  CLOSE_DIALOGUE_BUNDLES,
  FAMILY_DIALOGUE_BUNDLES,
  FRIEND_DIALOGUE_BUNDLES,
  NEUTRAL_DIALOGUE_BUNDLES,
  RIVAL_DIALOGUE_BUNDLES,
} from './relationshipDialogueLibrary'
import { RELATIONSHIP_MONOLOGUE_LINES } from './relationshipMonologueLibrary'
import { useRelationshipStore } from './relationshipStore'
import { LOVER_DIALOGUE_BUNDLES, SHARED_AFFECTION_DIALOGUE_BUNDLES, SPOUSE_DIALOGUE_BUNDLES } from './romanceDialogueLibrary'
import { DEFAULT_SITUATION_CATEGORIES } from './situationCategories'

function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

const at = (hour: number) => new Date(2026, 0, 1, hour, 0, 0).getTime()
const who = (id: string, tags: string[] = [], baseTone: BaseTone = 'casual'): AutoDialogueParticipant => ({ id, personalityTags: tags, dialogueLines: [], baseTone })

const BATCH1_BUNDLES = [...NEUTRAL_DIALOGUE_BUNDLES, ...FRIEND_DIALOGUE_BUNDLES, ...CLOSE_DIALOGUE_BUNDLES]
const BATCH2_BUNDLES = [...FAMILY_DIALOGUE_BUNDLES, ...RIVAL_DIALOGUE_BUNDLES, ...AWKWARD_DIALOGUE_BUNDLES]
const NEW_BUNDLES = [...BATCH1_BUNDLES, ...BATCH2_BUNDLES]
const NEW_IDS = new Set(NEW_BUNDLES.map((b) => b.id))
const UNIVERSAL = DEFAULT_DIALOGUE_BUNDLES.filter((b) => !b.relationshipTypes)
const textsOf = (bundles: DefaultDialogueBundleDef[]) => new Set(bundles.flatMap((b) => b.turns.flatMap((t) => [t.text.formal, t.text.casual])))
const byId = (id: string) => DEFAULT_DIALOGUE_BUNDLES.find((b) => b.id === id)!

/** Which hours each time-gated category may be used in (mirrors autoDialogueEngine's gate). */
const HOURS: Record<string, (h: number) => boolean> = {
  'morning-greeting': (h) => h >= 5 && h <= 10,
  'wake-up': (h) => h >= 5 && h <= 10,
  breakfast: (h) => h >= 6 && h <= 9,
  lunch: (h) => h >= 11 && h <= 14,
  'afternoon-chat': (h) => h >= 13 && h <= 18,
  snack: (h) => h >= 13 && h <= 18,
  dinner: (h) => h >= 17 && h <= 20,
  'day-wrap-up': (h) => h >= 19 && h <= 23,
  'pre-bedtime': (h) => h >= 21 || h <= 4,
  bedtime: (h) => h >= 21 || h <= 4,
}

function sample(type: RelationshipType, explicit: boolean, hour: number, count: number, a = who('a'), b = who('b'), seed = 1) {
  const random = seeded(seed)
  const ids: string[] = []
  for (let i = 0; i < count; i++) {
    const result = buildAutoDialogueBundle({ participants: [a, b], firstSpeakerId: 'a', relationshipType: type, relationshipExplicit: explicit, recentLineIdsByCharacter: {}, now: at(hour), random })
    if (result?.usedDefaultBundleId) ids.push(result.usedDefaultBundleId)
  }
  return ids
}

describe('batch 1+2 dialogue library: 공용 / 친구 / 친밀한 관계 / 가족 / 라이벌 / 어색한 사이', () => {
  it('adds 30 bundles for each of the six relationship-flavored groups, all new and distinct, with the earlier content untouched', () => {
    expect([NEUTRAL_DIALOGUE_BUNDLES.length, FRIEND_DIALOGUE_BUNDLES.length, CLOSE_DIALOGUE_BUNDLES.length, FAMILY_DIALOGUE_BUNDLES.length, RIVAL_DIALOGUE_BUNDLES.length, AWKWARD_DIALOGUE_BUNDLES.length]).toEqual([30, 30, 30, 30, 30, 30])
    expect(NEW_IDS.size).toBe(180)
    expect(new Set(DEFAULT_DIALOGUE_BUNDLES.map((b) => b.id)).size).toBe(DEFAULT_DIALOGUE_BUNDLES.length)
    expect(DEFAULT_DIALOGUE_BUNDLES).toHaveLength(34 + 160 + 180)
    expect(DEFAULT_DIALOGUE_BUNDLES.filter((b) => b.id.startsWith('default-'))).toHaveLength(34)
    expect([LOVER_DIALOGUE_BUNDLES.length, SPOUSE_DIALOGUE_BUNDLES.length, SHARED_AFFECTION_DIALOGUE_BUNDLES.length]).toEqual([70, 70, 20])
    expect(DEFAULT_MONOLOGUE_LIBRARY.filter((l) => /^mono-(love|spouse|couple)-/.test(l.id))).toHaveLength(140)
    expect(DEFAULT_MONOLOGUE_LIBRARY.filter((l) => /^mono-(family|rival|awkward)-/.test(l.id))).toHaveLength(60)
  })

  it('every bundle is a connected 2-4 turn exchange starting with the first speaker, with different hand-written 존댓말 and 반말 text', () => {
    for (const bundle of NEW_BUNDLES) {
      expect(bundle.turns.length, bundle.id).toBeGreaterThanOrEqual(2)
      expect(bundle.turns.length, bundle.id).toBeLessThanOrEqual(4)
      expect(bundle.turns[0].speaker).toBe('first')
      for (const turn of bundle.turns) {
        expect(turn.text.formal.trim(), bundle.id).not.toBe('')
        expect(turn.text.formal, bundle.id).not.toBe(turn.text.casual)
      }
    }
  })

  it('never repeats a sentence already in the library — new bundles share no turn text with any other bundle, and no opening line', () => {
    const existing = textsOf(DEFAULT_DIALOGUE_BUNDLES.filter((b) => !NEW_IDS.has(b.id)))
    const seen = new Set<string>()
    for (const bundle of NEW_BUNDLES) {
      for (const turn of bundle.turns) {
        for (const text of [turn.text.formal, turn.text.casual]) {
          expect(existing.has(text), `${bundle.id}: "${text}" already exists`).toBe(false)
          expect(seen.has(text), `${bundle.id}: "${text}" repeated inside the batch`).toBe(false)
          seen.add(text)
        }
      }
    }
    const openings = DEFAULT_DIALOGUE_BUNDLES.map((b) => b.turns[0].text.casual)
    expect(new Set(openings).size).toBe(openings.length)
  })

  it('uses only registered situation categories, and the relationship metadata the filter reads', () => {
    const valid = new Set(DEFAULT_SITUATION_CATEGORIES.map((c) => c.id))
    for (const bundle of NEW_BUNDLES) expect(valid.has(bundle.categoryId), bundle.id).toBe(true)
    for (const b of NEUTRAL_DIALOGUE_BUNDLES) expect(b.relationshipTypes, b.id).toBeUndefined()
    for (const b of FRIEND_DIALOGUE_BUNDLES) expect(b.relationshipTypes, b.id).toEqual(['friend'])
    for (const b of CLOSE_DIALOGUE_BUNDLES) expect(b.relationshipTypes, b.id).toEqual(['close'])
    for (const b of FAMILY_DIALOGUE_BUNDLES) expect(b.relationshipTypes, b.id).toEqual(['family'])
    for (const b of RIVAL_DIALOGUE_BUNDLES) expect(b.relationshipTypes, b.id).toEqual(['rival'])
    for (const b of AWKWARD_DIALOGUE_BUNDLES) expect(b.relationshipTypes, b.id).toEqual(['awkward'])
    for (const b of NEW_BUNDLES) expect(b.romantic, b.id).toBeUndefined()
  })

  it('assumes nothing that does not exist: no jobs/work, buying, cooking, completed sleep, past events, kinship/rank/nickname terms, or romance', () => {
    const forbidden: Array<[string, RegExp]> = [
      ['unimplemented actions', /요리|출근|퇴근|회의|회사|직장|업무|야근|월급|구매|쇼핑|상점|결제|주문|배달|샀|돈/],
      ['completed sleep', /푹 잤|잠들었|자고 일어|꿈/],
      // Concrete backstory only — "아까"(a moment ago)/"처음보다"(easing-over-time, explicitly requested for 어색한 사이) are legitimate and not a fabricated event.
      ['past events', /저번에|지난번에|옛날에|그때 그 일/],
      ['kinship / rank / nickname', /형|누나|언니|오빠|동생|엄마|아빠|아들|딸|할머니|할아버지|여보|자기야|당신|애기|선배|후배|부장|팀장|대리|사장|님\b/],
      ['romance', /사랑|좋아해|설레|보고 싶|애인|두근|연인|남친|여친|키스|안아|손잡/],
    ]
    for (const bundle of NEW_BUNDLES) {
      for (const turn of bundle.turns) {
        for (const text of [turn.text.formal, turn.text.casual]) {
          const cleaned = text.replace(/그때그때/g, '')
          for (const [label, pattern] of forbidden) expect(cleaned, `${bundle.id} (${label}): ${text}`).not.toMatch(pattern)
        }
      }
    }
  })

  it('가족: never assumes a specific blood relation or age order (no 형/누나/언니/오빠/동생/부모 terms — already covered above — and never states an age or birth order)', () => {
    for (const bundle of FAMILY_DIALOGUE_BUNDLES) {
      for (const turn of bundle.turns) {
        for (const text of [turn.text.formal, turn.text.casual]) expect(text, bundle.id).not.toMatch(/살\b|나이|첫째|둘째|막내|장남|장녀/)
      }
    }
  })

  it('라이벌: never states a win or loss that never happened — competitive mood only, no scored outcome', () => {
    for (const bundle of RIVAL_DIALOGUE_BUNDLES) {
      for (const turn of bundle.turns) {
        for (const text of [turn.text.formal, turn.text.casual]) expect(text, bundle.id).not.toMatch(/이겼|졌|승리|패배|우승|1등|꼴찌|점수|스코어/)
      }
    }
  })

  it('어색한 사이: no bundle drifts into a romantic mood (romance already checked above; also no butterflies/nervous-around-you framing)', () => {
    for (const bundle of AWKWARD_DIALOGUE_BUNDLES) {
      for (const turn of bundle.turns) {
        for (const text of [turn.text.formal, turn.text.casual]) expect(text, bundle.id).not.toMatch(/떨려|심쿵|고백|썸/)
      }
    }
  })
})

describe('relationship filtering (through the real bundle builder)', () => {
  it('neutral bundles reach every relationship; friend/close bundles reach only their own — for every relationship id and every hour', () => {
    for (const type of RELATIONSHIP_TYPE_ORDER) {
      for (const hour of [1, 8, 12, 15, 19, 23]) {
        const ids = sample(type, true, hour, 300, who('a'), who('b'), hour + 5)
        expect(ids.length, `${type}@${hour}`).toBeGreaterThan(0)
        for (const id of ids) {
          if (id.startsWith('friend-')) expect(type, `${id} leaked to ${type}`).toBe('friend')
          if (id.startsWith('close-')) expect(type, `${id} leaked to ${type}`).toBe('close')
          if (id.startsWith('family-')) expect(type, `${id} leaked to ${type}`).toBe('family')
          if (id.startsWith('rival-')) expect(type, `${id} leaked to ${type}`).toBe('rival')
          if (id.startsWith('awkward-')) expect(type, `${id} leaked to ${type}`).toBe('awkward')
        }
      }
      expect(sample(type, true, 12, 600).some((id) => id.startsWith('neutral-')), `${type} never gets neutral content`).toBe(true)
    }
    for (const [type, prefix] of [['friend', 'friend-'], ['close', 'close-'], ['family', 'family-'], ['rival', 'rival-'], ['awkward', 'awkward-']] as const) {
      expect(sample(type, true, 12, 800).some((id) => id.startsWith(prefix)), type).toBe(true)
    }
  })

  it('a pair whose relationship was never chosen gets only neutral (relationship-independent) bundles at every hour, never friend/close/rival/awkward/romance content', () => {
    const universalIds = new Set(UNIVERSAL.map((b) => b.id))
    for (let hour = 0; hour < 24; hour++) {
      const ids = sample(DEFAULT_RELATIONSHIP_TYPE, false, hour, 200, who('a'), who('b'), hour + 1)
      expect(ids.length, `hour ${hour} produced nothing`).toBeGreaterThan(0)
      for (const id of ids) expect(universalIds.has(id), `${id} reached an unset pair at ${hour}:00`).toBe(true)
    }
    const unset = new Set(sample(DEFAULT_RELATIONSHIP_TYPE, false, 12, 800))
    expect([...unset].some((id) => id.startsWith('neutral-'))).toBe(true)
    expect([...unset].some((id) => /^(friend|close|spouse|love|affection)-|default-.*(rival|awkward|romantic)/.test(id))).toBe(false)
  })

  it('explicitly choosing 친밀한 관계 unlocks its content; leaving it unset does not (same resolved type, different result)', () => {
    expect(sample('close', true, 12, 800).some((id) => id.startsWith('close-'))).toBe(true)
    expect(sample('close', false, 12, 800).some((id) => id.startsWith('close-'))).toBe(false)
  })

  it('time of day: greetings only in the morning, bedtime talk only at night, meals in their windows — for all new content', () => {
    for (const type of ['friend', 'close'] as const) {
      for (let hour = 0; hour < 24; hour++) {
        for (const id of new Set(sample(type, true, hour, 250, who('a'), who('b'), hour + 9))) {
          const gate = HOURS[byId(id).categoryId]
          if (gate) expect(gate(hour), `${id} (${byId(id).categoryId}) at ${hour}:00`).toBe(true)
        }
      }
    }
    expect(sample('friend', true, 14, 400).map((id) => byId(id).categoryId)).not.toContain('morning-greeting')
    expect(sample('close', true, 12, 400).map((id) => byId(id).categoryId)).not.toContain('bedtime')
  })

  it('plays a chosen bundle whole and in order, one speaker per turn, never mixing turns from different bundles', () => {
    for (const type of ['friend', 'close'] as const) {
      const random = seeded(3)
      for (let i = 0; i < 80; i++) {
        const result = buildAutoDialogueBundle({ participants: [who('a'), who('b')], firstSpeakerId: 'a', relationshipType: type, relationshipExplicit: true, recentLineIdsByCharacter: {}, now: at(12), random })!
        const bundle = byId(result.usedDefaultBundleId!)
        expect(result.lines).toHaveLength(bundle.turns.length)
        result.lines.forEach((line, index) => {
          expect(line.text).toBe(bundle.turns[index].text.casual)
          expect(line.speakerId).toBe(bundle.turns[index].speaker === 'first' ? 'a' : 'b')
        })
      }
    }
  })

  it('applies each speaker\'s own register: a 존댓말 character and a 반말 character in the same conversation', () => {
    const bundle = FRIEND_DIALOGUE_BUNDLES.find((b) => b.id === 'friend-10')! // noon-safe
    const result = buildAutoDialogueBundle({
      participants: [who('a', [], 'formal'), who('b', [], 'casual')],
      firstSpeakerId: 'a',
      relationshipType: 'friend',
      relationshipExplicit: true,
      recentLineIdsByCharacter: {},
      now: at(12),
      random: () => 0.5,
      defaultBundleCatalog: [bundle],
    })!
    result.lines.forEach((line, i) => expect(line.text).toBe(bundle.turns[i].speaker === 'first' ? bundle.turns[i].text.formal : bundle.turns[i].text.casual))
    expect(new Set(result.lines.map((l) => l.speakerId))).toEqual(new Set(['a', 'b']))
  })
})

describe('personality weighting and repetition', () => {
  const share = (ids: string[], predicate: (emotion: string) => boolean) => {
    const turns = ids.map(byId).flatMap((b) => b.turns)
    return turns.filter((t) => predicate(t.emotion)).length / Math.max(1, turns.length)
  }

  it('a playful pair hears more jokes and a shy pair more careful lines than a plain pair, without ever losing the other content', () => {
    const plain = sample('friend', true, 12, 2000, who('a'), who('b'), 5)
    const playful = sample('friend', true, 12, 2000, who('a', ['playful']), who('b', ['playful']), 5)
    const shy = sample('friend', true, 12, 2000, who('a', ['shy']), who('b', ['shy']), 5)
    expect(share(playful, (e) => e === 'playful')).toBeGreaterThan(share(plain, (e) => e === 'playful'))
    expect(share(shy, (e) => e === 'shy')).toBeGreaterThan(share(plain, (e) => e === 'shy'))
    for (const ids of [plain, playful, shy]) expect(new Set(ids).size).toBeGreaterThan(20) // weighting never shrinks the pool to a few bundles
  })

  it('terse characters get shorter turns, and five personalities together still leave a wide, mixed pool', () => {
    const avg = (ids: string[]) => {
      const turns = ids.map(byId).flatMap((b) => b.turns)
      return turns.reduce((sum, t) => sum + t.text.casual.length, 0) / Math.max(1, turns.length)
    }
    const plain = sample('close', true, 12, 2000, who('a'), who('b'), 8)
    const gruff = sample('close', true, 12, 2000, who('a', ['gruff']), who('b', ['gruff']), 8)
    expect(avg(gruff)).toBeLessThan(avg(plain))

    const five = ['affectionate', 'playful', 'calm', 'shy', 'energetic']
    const mixed = sample('close', true, 12, 2000, who('a', five), who('b', five), 9)
    expect(new Set(mixed).size).toBeGreaterThan(20)
    expect(mixed.some((id) => id.startsWith('neutral-'))).toBe(true)
    expect(mixed.some((id) => id.startsWith('close-'))).toBe(true)
  })

  it('never repeats the previous bundle for a pair while others exist, and every hour still has plenty to say', () => {
    for (const [type, explicit] of [['friend', true], ['close', true], ['close', false]] as const) {
      const random = seeded(11)
      let recent: string[] = []
      let previous = ''
      for (let i = 0; i < 120; i++) {
        const result = buildAutoDialogueBundle({ participants: [who('a'), who('b')], firstSpeakerId: 'a', relationshipType: type, relationshipExplicit: explicit, recentLineIdsByCharacter: {}, recentDefaultBundleIdsByPair: recent.slice(-5), now: at(12), random })!
        const id = result.usedDefaultBundleId!
        expect(id).not.toBe(previous)
        previous = id
        recent.push(id)
      }
      recent = []
      for (let hour = 0; hour < 24; hour++) {
        expect(new Set(sample(type, explicit, hour, 400, who('a'), who('b'), hour + 2)).size, `${type}/${explicit}@${hour}`).toBeGreaterThanOrEqual(10)
      }
    }
  })

  it('a character\'s own registered lines still take priority over the built-in library, even for a chosen relationship', () => {
    const line = { id: 'mine', categoryId: 'casual-chat', situationNote: '', text: '내가 쓴 대사', emotion: 'neutral', tags: [], isFallback: false }
    const a: AutoDialogueParticipant = { ...who('a'), dialogueLines: [line, { ...line, id: 'mine2' }] }
    const b: AutoDialogueParticipant = { ...who('b'), dialogueLines: [{ ...line, id: 'theirs' }, { ...line, id: 'theirs2' }] }
    const result = buildAutoDialogueBundle({ participants: [a, b], firstSpeakerId: 'a', relationshipType: 'friend', relationshipExplicit: true, recentLineIdsByCharacter: {}, now: at(12), random: () => 0.3 })!
    expect(result.usedDefaultBundleId).toBeUndefined()
    expect(result.lines.every((l) => l.text === '내가 쓴 대사')).toBe(true)
  })
})

describe('whether a pair\'s relationship was chosen', () => {
  beforeEach(() => {
    localStorage.clear()
    useRelationshipStore.setState({ defaultRelationshipType: DEFAULT_RELATIONSHIP_TYPE, relationshipsByPair: {} })
  })

  it('is false until the user picks one, true afterwards in either pair order, and other pairs are unaffected', () => {
    const store = () => useRelationshipStore.getState()
    expect(store().isRelationshipExplicit('a', 'b')).toBe(false)
    expect(store().getRelationshipType('a', 'b')).toBe('close') // still resolves to the default, exactly as before
    store().setRelationshipType('b', 'a', 'close') // choosing the default type explicitly counts
    expect(store().isRelationshipExplicit('a', 'b')).toBe(true)
    expect(store().isRelationshipExplicit('a', 'c')).toBe(false)
  })

  it('a saved non-default "default" (the old single-relationship save) counts as chosen, and the flag survives a reload', async () => {
    useRelationshipStore.setState({ defaultRelationshipType: 'romantic' })
    expect(useRelationshipStore.getState().isRelationshipExplicit('x', 'y')).toBe(true)

    useRelationshipStore.setState({ defaultRelationshipType: 'close', relationshipsByPair: {} })
    localStorage.setItem('dearly-relationship', JSON.stringify({ state: { defaultRelationshipType: 'close', relationshipsByPair: { [pairKey('a', 'b')]: 'friend' } }, version: 0 }))
    await useRelationshipStore.persist.rehydrate()
    expect(useRelationshipStore.getState().isRelationshipExplicit('a', 'b')).toBe(true)
    expect(useRelationshipStore.getState().isRelationshipExplicit('a', 'c')).toBe(false)
  })
})

describe('the real conversation path (manual talk button)', () => {
  const situationRef = { current: { time: '', place: '', actionA: '', actionB: '' } }
  const mountedRef = { current: true }

  function character(id: string): Character {
    return { id, name: id, imageDataUrl: '', displayScale: 1, footOffsetRatio: 0, imageBounds: null, traits: { personality: '', favoriteColor: '' }, aiProfile: { ...EMPTY_AI_PROFILE } }
  }

  async function talkOnce() {
    useDialogueStore.setState({ entries: [], activeConversations: {}, activeBubbleByCharacter: {} })
    const done = startManualConversation('a', 'b', situationRef, mountedRef)
    await vi.advanceTimersByTimeAsync(BUBBLE_REVEAL_INTERVAL_MS * (MAX_BUNDLE_LINES + 1))
    await done
    return useDialogueStore.getState().entries.map((e) => e.text)
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockImplementation(seeded(77))
    localStorage.clear()
    useCharacterStore.setState({ characters: [character('a'), character('b')] })
    useCharacterMovementStore.setState({ byId: {} })
    useDialogueStore.setState({ entries: [], activeConversations: {}, lastConversationEndAtByPair: {}, recentAutoLineIdsByCharacter: {}, recentDefaultBundleIdsByPair: {}, activeBubbleByCharacter: {} })
    useRelationshipStore.setState({ defaultRelationshipType: DEFAULT_RELATIONSHIP_TYPE, relationshipsByPair: {} })
    useSimulationStore.setState({ isRunning: true, tick: 0 })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('an unset pair only ever says neutral lines; after choosing 친구 the friend bundles join in, and nothing from another relationship ever does', async () => {
    const universal = textsOf(UNIVERSAL)
    for (let i = 0; i < 40; i++) for (const text of await talkOnce()) expect(universal.has(text), `unset pair said: ${text}`).toBe(true)

    useRelationshipStore.getState().setRelationshipType('a', 'b', 'friend')
    const allowed = textsOf([...UNIVERSAL, ...FRIEND_DIALOGUE_BUNDLES])
    const friendTexts = textsOf(FRIEND_DIALOGUE_BUNDLES)
    let heardFriend = false
    for (let i = 0; i < 60; i++) {
      for (const text of await talkOnce()) {
        expect(allowed.has(text), `friend pair said: ${text}`).toBe(true)
        if (friendTexts.has(text)) heardFriend = true
      }
    }
    expect(heardFriend).toBe(true)
  })

  it('choosing 가족/라이벌 etc. never surfaces 친구 or 친밀한 관계 content', async () => {
    const forbidden = new Set([...textsOf(FRIEND_DIALOGUE_BUNDLES), ...textsOf(CLOSE_DIALOGUE_BUNDLES)])
    for (const type of ['family', 'rival', 'awkward', 'romantic', 'married'] as const) {
      useRelationshipStore.getState().setRelationshipType('a', 'b', type)
      for (let i = 0; i < 25; i++) for (const text of await talkOnce()) expect(forbidden.has(text), `${type} pair said: ${text}`).toBe(false)
    }
  })

  it('each of 가족/라이벌/어색한 사이 actually surfaces its own content via manual talk, and never another one of the three', async () => {
    const byGroup = { family: FAMILY_DIALOGUE_BUNDLES, rival: RIVAL_DIALOGUE_BUNDLES, awkward: AWKWARD_DIALOGUE_BUNDLES }
    for (const type of ['family', 'rival', 'awkward'] as const) {
      useRelationshipStore.getState().setRelationshipType('a', 'b', type)
      const own = textsOf(byGroup[type])
      const others = new Set(Object.entries(byGroup).filter(([k]) => k !== type).flatMap(([, bundles]) => [...textsOf(bundles)]))
      let heardOwn = false
      for (let i = 0; i < 60; i++) {
        for (const text of await talkOnce()) {
          expect(others.has(text), `${type} pair said another relationship's line: ${text}`).toBe(false)
          if (own.has(text)) heardOwn = true
        }
      }
      expect(heardOwn, `${type} pair never said its own content`).toBe(true)
    }
  })
})

describe('relationship monologues (친구 / 친밀한 관계 / 가족 / 라이벌 / 어색한 사이)', () => {
  const MONO = RELATIONSHIP_MONOLOGUE_LINES

  function character(id: string): Character {
    return { id, name: id, imageDataUrl: '', displayScale: 1, footOffsetRatio: 0, imageBounds: null, traits: { personality: '', favoriteColor: '' }, aiProfile: { ...EMPTY_AI_PROFILE } }
  }
  const entry = (id: string, roomId: string): CharacterMovementState => ({ id, roomId, x: 300, y: 350, destination: null, destinationRoomId: null, currentBehavior: null, status: 'idle', restTicksRemaining: 0, stuckTicks: 0 })

  let roomId: string
  let room2Id: string
  beforeEach(() => {
    localStorage.clear()
    const room = useHomeStore.getInitialState().rooms[0]
    roomId = room.id
    useHomeStore.setState({ rooms: [{ ...room, furniture: [] }], activeDecorateRoomId: room.id, activeLiveRoomId: room.id, selectedFurnitureId: null })
    room2Id = useHomeStore.getState().addRoom('bedroom', '침실', 'empty')
    useMonologueStore.getState().reset()
    useMonologueFrequencyStore.setState({ mode: 'veryFrequent' })
    useDialogueFrequencyStore.setState({ mode: 'quiet' })
    useDialogueStore.setState({ activeConversations: {}, lastConversationEndAtByPair: {}, activeBubbleByCharacter: {} })
    useRelationshipStore.setState({ defaultRelationshipType: DEFAULT_RELATIONSHIP_TYPE, relationshipsByPair: {} })
    useSimulationStore.setState({ isRunning: true, tick: 0 })
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  function run(observer: string, passes = 4 * 60 * 20): string[] {
    const random = seeded(17)
    const seen = new Set<string>()
    let last = -1
    for (let i = 0; i < passes; i++) {
      runMonologuePass(1_000_000 + i * 250, 12, random)
      const active = useMonologueStore.getState().activeByCharacter[observer]
      if (active && active.startedAt !== last) {
        seen.add(active.lineId)
        last = active.startedAt
      }
    }
    return [...seen]
  }
  const setup = (ids: string[], rooms: Record<string, string>) => {
    useCharacterStore.setState({ characters: ids.map(character) })
    useCharacterMovementStore.setState({ byId: Object.fromEntries(ids.map((id) => [id, entry(id, rooms[id] ?? roomId)])) })
  }

  const GROUPS = ['friend', 'close', 'family', 'rival', 'awkward'] as const

  it('adds 10 situations for each of the five groups, each in both registers (100 entries total), gated by relationship id and presence', () => {
    expect(MONO).toHaveLength(100)
    for (const group of GROUPS) expect(MONO.filter((l) => l.id.startsWith(`mono-${group}-`) && l.tone === 'casual')).toHaveLength(10)
    const existing = new Set(DEFAULT_MONOLOGUE_LIBRARY.filter((l) => !MONO.includes(l)).map((l) => l.text))
    const seen = new Set<string>()
    for (const line of MONO) {
      expect(existing.has(line.text), line.id).toBe(false)
      expect(seen.has(line.text), `duplicate within batch: ${line.id}`).toBe(false)
      seen.add(line.text)
      expect(line.text).not.toMatch(/[?？]/)
      expect(line.text).not.toMatch(/사랑|좋아해|설레|보고 싶|형|누나|언니|오빠|동생|출근|회사|어제|예전|승리|패배|우승|꼴찌/)
      const group = GROUPS.find((g) => line.id.startsWith(`mono-${g}-`))!
      expect(line.partnerCondition?.relationships).toEqual([group])
    }
    expect(new Set(DEFAULT_MONOLOGUE_LIBRARY.map((l) => l.id)).size).toBe(DEFAULT_MONOLOGUE_LIBRARY.length)
  })

  it('a friend in the same room produces friend lines about being together — and nothing about another relationship', () => {
    setup(['a', 'b'], {})
    useRelationshipStore.getState().setRelationshipType('a', 'b', 'friend')
    const lines = run('a')
    const friend = lines.filter((id) => id.startsWith('mono-friend-'))
    expect(friend.length).toBeGreaterThan(0)
    for (const id of lines.filter((l) => /^mono-(close|love|spouse|couple)-/.test(l))) throw new Error(`friend got ${id}`)
    for (const id of friend) expect(MONO.find((l) => l.id === id)!.partnerCondition!.presence).toBe('sameRoom')
  })

  it('never describes a friend as nearby when they are in another room', () => {
    setup(['a', 'b'], { b: room2Id })
    useRelationshipStore.getState().setRelationshipType('a', 'b', 'close')
    const close = run('a').filter((id) => id.startsWith('mono-close-'))
    expect(close.length).toBeGreaterThan(0)
    for (const id of close) expect(MONO.find((l) => l.id === id)!.partnerCondition!.presence).toBe('otherRoom')
  })

  it('a pair whose relationship was never chosen, a rival, or a couple never gets friend/close monologues', () => {
    setup(['a', 'b', 'c', 'd', 'e'], {})
    // a-b unset (resolves to the default 친밀한 관계 but was never chosen); c-d rival; e has no relationship at all
    useRelationshipStore.getState().setRelationshipType('c', 'd', 'rival')
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      for (const line of run(id, 4 * 60 * 8)) expect(/^mono-(friend|close)-/.test(line), `${id} got ${line}`).toBe(false)
      useMonologueStore.getState().reset()
    }
    setup(['a', 'b'], {})
    useRelationshipStore.getState().setRelationshipType('a', 'b', 'romantic')
    for (const line of run('a', 4 * 60 * 8)) expect(/^mono-(friend|close)-/.test(line)).toBe(false)
  })

  it.each(['family', 'rival', 'awkward'] as const)('%s in the same room produces its own lines about being together, never another relationship\'s lines', (type) => {
    setup(['a', 'b'], {})
    useRelationshipStore.getState().setRelationshipType('a', 'b', type)
    const lines = run('a')
    const own = lines.filter((id) => id.startsWith(`mono-${type}-`))
    expect(own.length).toBeGreaterThan(0)
    // Ordinary generic monologue lines (no partnerCondition) may still surface — only another relationship's own prefix must never appear.
    const others = GROUPS.filter((g) => g !== type)
    for (const id of lines) expect(others.some((g) => id.startsWith(`mono-${g}-`)), `${type} got ${id}`).toBe(false)
    for (const id of own) expect(MONO.find((l) => l.id === id)!.partnerCondition!.presence).toBe('sameRoom')
  })

  it.each(['family', 'rival', 'awkward'] as const)('%s: never describes the partner as nearby when they are in another room', (type) => {
    setup(['a', 'b'], { b: room2Id })
    useRelationshipStore.getState().setRelationshipType('a', 'b', type)
    const own = run('a').filter((id) => id.startsWith(`mono-${type}-`))
    expect(own.length).toBeGreaterThan(0)
    for (const id of own) expect(MONO.find((l) => l.id === id)!.partnerCondition!.presence).toBe('otherRoom')
  })

  it('a pair whose relationship was never chosen, or a friend pair, never gets family/rival/awkward monologues', () => {
    setup(['a', 'b', 'c', 'd'], {})
    useRelationshipStore.getState().setRelationshipType('c', 'd', 'friend')
    for (const id of ['a', 'b', 'c', 'd']) {
      for (const line of run(id, 4 * 60 * 8)) expect(/^mono-(family|rival|awkward)-/.test(line), `${id} got ${line}`).toBe(false)
      useMonologueStore.getState().reset()
    }
  })

  it('five characters at once: each gets only the lines of the relationships it really has', () => {
    const ids = ['a', 'b', 'c', 'd', 'e']
    setup(ids, {})
    useRelationshipStore.getState().setRelationshipType('a', 'b', 'friend')
    useRelationshipStore.getState().setRelationshipType('c', 'd', 'close')
    const random = seeded(3)
    const seen: Record<string, Set<string>> = Object.fromEntries(ids.map((id) => [id, new Set<string>()]))
    for (let i = 0; i < 4 * 60 * 25; i++) {
      runMonologuePass(1_000_000 + i * 250, 12, random)
      for (const id of ids) {
        const active = useMonologueStore.getState().activeByCharacter[id]
        if (active) seen[id].add(active.lineId)
      }
    }
    for (const id of ['a', 'b']) {
      expect([...seen[id]].some((l) => l.startsWith('mono-friend-')), `${id} friend`).toBe(true)
      expect([...seen[id]].some((l) => l.startsWith('mono-close-'))).toBe(false)
    }
    for (const id of ['c', 'd']) {
      expect([...seen[id]].some((l) => l.startsWith('mono-close-')), `${id} close`).toBe(true)
      expect([...seen[id]].some((l) => l.startsWith('mono-friend-'))).toBe(false)
    }
    expect([...seen.e].some((l) => /^mono-(friend|close)-/.test(l))).toBe(false)
  })
})

describe('the relationship picker', () => {
  beforeEach(() => {
    localStorage.clear()
    const room = useHomeStore.getInitialState().rooms[0]
    useHomeStore.setState({ rooms: [{ ...room, furniture: [] }], activeDecorateRoomId: room.id, activeLiveRoomId: room.id, selectedFurnitureId: null })
    useCharacterMovementStore.setState({ byId: {} })
    useDialogueFrequencyStore.setState({ mode: 'quiet' })
    useMonologueFrequencyStore.setState({ mode: 'off' })
    useRelationshipStore.setState({ defaultRelationshipType: DEFAULT_RELATIONSHIP_TYPE, relationshipsByPair: {} })
    useSimulationStore.setState({ isRunning: true, tick: 0 })
    const make = (id: string): Character => ({ id, name: id, imageDataUrl: '', displayScale: 1, footOffsetRatio: 0, imageBounds: null, traits: { personality: '', favoriteColor: '' }, aiProfile: { ...EMPTY_AI_PROFILE } })
    useCharacterStore.setState({ characters: [make('a'), make('b')] })
  })
  afterEach(() => cleanup())

  it('still lists exactly the seven relationships (no new item), shows an unchosen pair as unselected, and lets the user choose 친밀한 관계 explicitly', async () => {
    const user = userEvent.setup()
    render(<LiveScreen />)
    const select = screen.getByLabelText('선택한 쌍의 관계 유형') as HTMLSelectElement
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['연인', '부부', '친밀한 관계', '친구', '가족', '라이벌', '어색한 관계'])
    expect(select.value).toBe('') // unchosen: nothing is selected, it does not pretend to be 친밀한 관계
    expect(useRelationshipStore.getState().isRelationshipExplicit('a', 'b')).toBe(false)

    await user.selectOptions(select, 'close')
    expect(useRelationshipStore.getState().getRelationshipType('a', 'b')).toBe('close')
    expect(useRelationshipStore.getState().isRelationshipExplicit('a', 'b')).toBe(true)
    expect((screen.getByLabelText('선택한 쌍의 관계 유형') as HTMLSelectElement).value).toBe('close')
    expect(RELATIONSHIP_TYPE_ORDER).toEqual(['romantic', 'married', 'close', 'friend', 'family', 'rival', 'awkward']) // ids and order untouched
  })
})
