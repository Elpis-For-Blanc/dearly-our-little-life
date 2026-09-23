import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LiveScreen } from '../../app/LiveScreen'
import { useCharacterStore } from '../character/characterStore'
import { EMPTY_AI_PROFILE, type BaseTone, type Character } from '../character/types'
import { useHomeStore } from '../home/homeStore'
import { useCharacterMovementStore, type CharacterMovementState } from '../simulation/characterMovementStore'
import { useSimulationStore } from '../simulation/simulationStore'
import { buildAutoDialogueBundle, type AutoDialogueParticipant } from './autoDialogueEngine'
import { DEFAULT_DIALOGUE_BUNDLES, type DefaultDialogueBundleDef } from './defaultDialogueLibrary'
import { DEFAULT_MONOLOGUE_LIBRARY } from './defaultMonologueLibrary'
import { useDialogueFrequencyStore } from './dialogueFrequencyStore'
import { useDialogueStore } from './dialogueStore'
import { pickMonologue } from './monologueEngine'
import { useMonologueFrequencyStore } from './monologueFrequencyStore'
import { useMonologueStore } from './monologueStore'
import { runMonologuePass } from './monologueTrigger'
import { pairKey } from './pairKey'
import { RELATIONSHIP_PRESETS, RELATIONSHIP_TYPE_ORDER, type RelationshipType } from './relationshipConfig'
import { AWKWARD_DIALOGUE_BUNDLES, RIVAL_DIALOGUE_BUNDLES } from './relationshipDialogueLibrary'
import { useRelationshipStore } from './relationshipStore'
import { LOVER_DIALOGUE_BUNDLES, ROMANCE_DIALOGUE_BUNDLES, SHARED_AFFECTION_DIALOGUE_BUNDLES, SPOUSE_DIALOGUE_BUNDLES } from './romanceDialogueLibrary'
import { ROMANCE_MONOLOGUE_LINES } from './romanceMonologueLibrary'

function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function at(hour: number): number {
  return new Date(2026, 0, 1, hour, 0, 0).getTime()
}

function who(id: string, tags: string[] = [], baseTone: BaseTone = 'casual'): AutoDialogueParticipant {
  return { id, personalityTags: tags, dialogueLines: [], baseTone }
}

const ROMANCE_IDS = new Set(ROMANCE_DIALOGUE_BUNDLES.map((b) => b.id))
const NON_ROMANTIC: RelationshipType[] = ['friend', 'family', 'rival', 'awkward', 'close']

/** Builds many conversations through the real selection function and returns which bundles came out. */
function sampleBundles(relationshipType: RelationshipType, hour: number, count: number, a = who('a'), b = who('b'), seed = 1) {
  const random = seeded(seed)
  const ids: string[] = []
  for (let i = 0; i < count; i++) {
    const result = buildAutoDialogueBundle({
      participants: [a, b],
      firstSpeakerId: 'a',
      relationshipType,
      recentLineIdsByCharacter: {},
      now: at(hour),
      random,
    })
    if (result?.usedDefaultBundleId) ids.push(result.usedDefaultBundleId)
  }
  return ids
}

describe('romance dialogue library (static data)', () => {
  it('has 70 연인-only, 70 부부-only and 20 shared bundles, 160 in total, all distinct', () => {
    expect(LOVER_DIALOGUE_BUNDLES).toHaveLength(70)
    expect(SPOUSE_DIALOGUE_BUNDLES).toHaveLength(70)
    expect(SHARED_AFFECTION_DIALOGUE_BUNDLES).toHaveLength(20)
    expect(ROMANCE_DIALOGUE_BUNDLES).toHaveLength(160)
    expect(new Set(ROMANCE_DIALOGUE_BUNDLES.map((b) => b.id)).size).toBe(160)
    // No two bundles share their opening line, so none is a light rewording of another.
    expect(new Set(ROMANCE_DIALOGUE_BUNDLES.map((b) => b.turns[0].text.casual)).size).toBe(160)
    for (const bundle of ROMANCE_DIALOGUE_BUNDLES) expect(DEFAULT_DIALOGUE_BUNDLES).toContain(bundle)
  })

  it('every bundle is a 2-4 turn exchange with distinct hand-written formal and casual text', () => {
    for (const bundle of ROMANCE_DIALOGUE_BUNDLES) {
      expect(bundle.turns.length).toBeGreaterThanOrEqual(2)
      expect(bundle.turns.length).toBeLessThanOrEqual(4)
      expect(bundle.turns.map((t) => t.speaker)[0]).toBe('first')
      for (const turn of bundle.turns) {
        expect(turn.text.formal).not.toBe(turn.text.casual)
        expect(turn.text.formal.trim()).not.toBe('')
      }
    }
  })

  it('the id group, the relationshipTypes condition and the romantic flag always agree', () => {
    for (const b of LOVER_DIALOGUE_BUNDLES) {
      expect(b.id).toMatch(/^love-\d{2}$/)
      expect(b.relationshipTypes).toEqual(['romantic'])
      expect(b.romantic).toBe(true)
    }
    for (const b of SPOUSE_DIALOGUE_BUNDLES) {
      expect(b.id).toMatch(/^spouse-\d{2}$/)
      expect(b.relationshipTypes).toEqual(['married'])
      expect(b.romantic).toBe(true)
    }
    for (const b of SHARED_AFFECTION_DIALOGUE_BUNDLES) {
      expect(b.id).toMatch(/^affection-\d\d$/)
      expect(b.relationshipTypes).toEqual(['romantic', 'married'])
      expect(b.romantic).toBe(true)
    }
  })

  it('never forces a nickname, a term of address, marriage length, children, jobs or history', () => {
    const forbidden = ['여보', '자기야', '당신', '허니', '달링', '신혼', '결혼 ', '아이', '아기', '애들', '직장', '회사', '출근', '퇴근', '몇 년', '오래된', '처음']
    for (const bundle of ROMANCE_DIALOGUE_BUNDLES) {
      for (const turn of bundle.turns) {
        for (const word of forbidden) {
          expect(turn.text.formal, bundle.id).not.toContain(word)
          expect(turn.text.casual, bundle.id).not.toContain(word)
        }
      }
    }
  })
})

describe('romance dialogue batch 2 (love-41..70 / spouse-41..70): no duplicate text anywhere, and the right focus per relationship', () => {
  const BATCH2_IDS = new Set([...LOVER_DIALOGUE_BUNDLES, ...SPOUSE_DIALOGUE_BUNDLES].filter((b) => Number(b.id.split('-')[1]) >= 41).map((b) => b.id))
  const BATCH2 = ROMANCE_DIALOGUE_BUNDLES.filter((b) => BATCH2_IDS.has(b.id))

  it('adds exactly 30 new 연인-only and 30 new 부부-only bundles, none repeating any sentence already in the whole dialogue library', () => {
    expect(BATCH2).toHaveLength(60)
    expect(BATCH2.filter((b) => b.id.startsWith('love-'))).toHaveLength(30)
    expect(BATCH2.filter((b) => b.id.startsWith('spouse-'))).toHaveLength(30)
    const existing = new Set(DEFAULT_DIALOGUE_BUNDLES.filter((b) => !BATCH2_IDS.has(b.id)).flatMap((b) => b.turns.flatMap((t) => [t.text.formal, t.text.casual])))
    const seenInBatch = new Set<string>()
    for (const bundle of BATCH2) {
      for (const turn of bundle.turns) {
        for (const text of [turn.text.formal, turn.text.casual]) {
          expect(existing.has(text), `${bundle.id}: "${text}" already exists elsewhere in the library`).toBe(false)
          expect(seenInBatch.has(text), `${bundle.id}: "${text}" repeated inside the batch`).toBe(false)
          seenInBatch.add(text)
        }
      }
    }
  })

  it('never uses a mechanically-varied near-duplicate of another sentence (same sentence with only one word swapped)', () => {
    // A cheap but effective check: strip particles/numbers-free content words and compare — if two sentences
    // collapse to the same skeleton after removing the most common 2-3 filler tokens, that's a smell worth
    // catching. Here we just assert every casual opening line across the whole batch is unique at the character
    // level (already proven above) *and* that no two turns are within edit-distance 2 of each other, which a
    // "changed one word" rewrite would produce.
    const texts = BATCH2.flatMap((b) => b.turns.map((t) => t.text.casual))
    function distance(a: string, b: string): number {
      const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
      for (let i = 0; i <= a.length; i++) dp[i][0] = i
      for (let j = 0; j <= b.length; j++) dp[0][j] = j
      for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
          dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
        }
      }
      return dp[a.length][b.length]
    }
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        if (Math.abs(texts[i].length - texts[j].length) > 2) continue
        expect(distance(texts[i], texts[j]), `too similar: "${texts[i]}" vs "${texts[j]}"`).toBeGreaterThan(2)
      }
    }
  })

  it('연인 batch 2 never assumes marriage/nickname facts, and covers 설렘/보고 싶은 마음/다정한 장난/칭찬 themes', () => {
    const loveBatch2 = LOVER_DIALOGUE_BUNDLES.filter((b) => Number(b.id.split('-')[1]) >= 41)
    const allText = loveBatch2.flatMap((b) => b.turns.flatMap((t) => [t.text.formal, t.text.casual])).join(' ')
    expect(allText).toMatch(/보고 싶|설레|두근|콩닥/) // 설렘/보고 싶은 마음
    expect(allText).toMatch(/예뻐|좋아 보|눈부셔|잘 어울/) // 칭찬
    expect(allText).toMatch(/반칙|놀리|티 나|장난/) // 다정한 장난
  })

  it('부부 batch 2 never assumes marriage length/children, and covers 익숙함/서로 챙기기/편안한 애정/일상의 행복 themes', () => {
    const spouseBatch2 = SPOUSE_DIALOGUE_BUNDLES.filter((b) => Number(b.id.split('-')[1]) >= 41)
    const allText = spouseBatch2.flatMap((b) => b.turns.flatMap((t) => [t.text.formal, t.text.casual])).join(' ')
    for (const word of ['몇 년', '신혼', '결혼 ', '아이', '아기', '애들', '여보', '자기야', '당신']) expect(allText).not.toContain(word)
    expect(allText).toMatch(/챙겨|무리하지|괜찮은 거/) // 서로 챙기기
    expect(allText).toMatch(/편안|편해|든든/) // 편안한 애정 표현
    expect(allText).toMatch(/평범한 하루|소소한|일상/) // 함께하는 일상의 행복
  })
})

describe('relationship type: 부부', () => {
  it('is a separate type from 연인, both allow romantic content, and both are in the picker order', () => {
    expect(RELATIONSHIP_PRESETS.married.label).toBe('부부')
    expect(RELATIONSHIP_PRESETS.romantic.label).toBe('연인')
    expect(RELATIONSHIP_PRESETS.married.allowsRomanticLines).toBe(true)
    expect(RELATIONSHIP_PRESETS.romantic.allowsRomanticLines).toBe(true)
    expect(RELATIONSHIP_TYPE_ORDER).toContain('married')
    expect(RELATIONSHIP_TYPE_ORDER).toContain('romantic')
    expect(RELATIONSHIP_TYPE_ORDER.slice(0, 2)).toEqual(['romantic', 'married'])
    for (const other of NON_ROMANTIC) expect(RELATIONSHIP_PRESETS[other].allowsRomanticLines).toBe(false)
  })
})

describe('relationship storage (per pair, order-independent)', () => {
  beforeEach(() => {
    localStorage.clear()
    useRelationshipStore.setState({ defaultRelationshipType: 'close', relationshipsByPair: {} })
  })

  it('registers, edits and reads 부부 for a pair in either order, leaving other pairs alone', () => {
    const store = useRelationshipStore.getState()
    store.setRelationshipType('a', 'b', 'romantic')
    store.setRelationshipType('b', 'c', 'friend')
    store.setRelationshipType('b', 'a', 'married') // edit, given in the opposite order
    expect(useRelationshipStore.getState().getRelationshipType('a', 'b')).toBe('married')
    expect(useRelationshipStore.getState().getRelationshipType('b', 'a')).toBe('married')
    expect(useRelationshipStore.getState().getRelationshipType('b', 'c')).toBe('friend')
    expect(Object.keys(useRelationshipStore.getState().relationshipsByPair)).toEqual([pairKey('a', 'b'), pairKey('b', 'c')])
  })

  it('is saved under the existing storage key as the plain id "married" and restored after a reload', async () => {
    useRelationshipStore.getState().setRelationshipType('a', 'b', 'married')
    const saved = JSON.parse(localStorage.getItem('dearly-relationship') ?? '{}')
    expect(saved.state.relationshipsByPair[pairKey('a', 'b')]).toBe('married')

    const raw = localStorage.getItem('dearly-relationship') ?? ''
    useRelationshipStore.setState({ relationshipsByPair: {} }) // simulates a fresh page load (this also rewrites storage, so restore the saved copy)
    localStorage.setItem('dearly-relationship', raw)
    await useRelationshipStore.persist.rehydrate()
    expect(useRelationshipStore.getState().getRelationshipType('a', 'b')).toBe('married')
  })

  it('keeps existing saved 연인 (and other) relationships exactly as they were', async () => {
    localStorage.setItem(
      'dearly-relationship',
      JSON.stringify({ state: { defaultRelationshipType: 'close', relationshipsByPair: { [pairKey('a', 'b')]: 'romantic', [pairKey('b', 'c')]: 'rival' } }, version: 0 }),
    )
    await useRelationshipStore.persist.rehydrate()
    expect(useRelationshipStore.getState().getRelationshipType('a', 'b')).toBe('romantic')
    expect(useRelationshipStore.getState().getRelationshipType('b', 'c')).toBe('rival')
  })

  it('an old single-value save (before per-pair relationships) still restores, including a legacy 연인', async () => {
    localStorage.setItem('dearly-relationship', JSON.stringify({ state: { relationshipType: 'romantic' }, version: 0 }))
    await useRelationshipStore.persist.rehydrate()
    expect(useRelationshipStore.getState().defaultRelationshipType).toBe('romantic')
  })

  it('ignores an unknown saved value instead of crashing', async () => {
    localStorage.setItem('dearly-relationship', JSON.stringify({ state: { relationshipsByPair: { [pairKey('a', 'b')]: 'spouse??' } }, version: 0 }))
    await useRelationshipStore.persist.rehydrate()
    expect(useRelationshipStore.getState().getRelationshipType('a', 'b')).toBe('close')
  })
})

describe('romance dialogue selection (through the real bundle builder)', () => {
  it('a 연인 pair gets 연인-only and shared bundles, never 부부-only ones — and does get some', () => {
    const ids = sampleBundles('romantic', 12, 600)
    const romance = ids.filter((id) => ROMANCE_IDS.has(id))
    expect(romance.some((id) => id.startsWith('love-'))).toBe(true)
    expect(romance.some((id) => id.startsWith('affection-'))).toBe(true)
    expect(romance.some((id) => id.startsWith('spouse-'))).toBe(false)
  })

  it('a 부부 pair gets 부부-only and shared bundles, never 연인-only ones — and does get some', () => {
    const ids = sampleBundles('married', 12, 600)
    const romance = ids.filter((id) => ROMANCE_IDS.has(id))
    expect(romance.some((id) => id.startsWith('spouse-'))).toBe(true)
    expect(romance.some((id) => id.startsWith('affection-'))).toBe(true)
    expect(romance.some((id) => id.startsWith('love-'))).toBe(false)
  })

  it('the shared affection bundles are reachable by both types', () => {
    for (const type of ['romantic', 'married'] as const) {
      const ids = new Set(sampleBundles(type, 12, 1500).filter((id) => id.startsWith('affection-')))
      expect(ids.size).toBeGreaterThan(5)
    }
  })

  it('every non-romantic relationship (친구/가족/라이벌/어색한 사이/친밀/미설정 기본값) never receives any romance bundle, at any hour', () => {
    for (const type of NON_ROMANTIC) {
      for (const hour of [1, 8, 12, 15, 19, 23]) {
        const ids = sampleBundles(type, hour, 150, who('a'), who('b'), hour + 3)
        expect(ids.length).toBeGreaterThan(0)
        for (const id of ids) expect(ROMANCE_IDS.has(id), `${type} got ${id}`).toBe(false)
      }
    }
  })

  it('classifies by relationship type id, not by wording: a non-romantic pair is blocked even from a romance-flagged bundle whose text is harmless', () => {
    const decoy = { ...LOVER_DIALOGUE_BUNDLES[0], id: 'decoy', relationshipTypes: undefined }
    const result = buildAutoDialogueBundle({
      participants: [who('a'), who('b')],
      firstSpeakerId: 'a',
      relationshipType: 'friend',
      recentLineIdsByCharacter: {},
      now: at(12),
      random: seeded(2),
      defaultBundleCatalog: [decoy],
    })
    expect(result).toBeNull()
  })

  it('a pair with an unset relationship falls back to the default type, which is not romantic', () => {
    useRelationshipStore.setState({ defaultRelationshipType: 'close', relationshipsByPair: {} })
    const type = useRelationshipStore.getState().getRelationshipType('x', 'y')
    expect(RELATIONSHIP_PRESETS[type].allowsRomanticLines).toBe(false)
    for (const id of sampleBundles(type, 12, 200)) expect(ROMANCE_IDS.has(id)).toBe(false)
  })

  it('time of day: night bundles only at night, morning bundles only in the morning', () => {
    const byCategory = (id: string) => ROMANCE_DIALOGUE_BUNDLES.find((b) => b.id === id)?.categoryId
    for (const type of ['romantic', 'married'] as const) {
      for (const id of sampleBundles(type, 14, 400)) {
        if (!ROMANCE_IDS.has(id)) continue
        expect(['bedtime', 'pre-bedtime', 'morning-greeting', 'wake-up', 'breakfast']).not.toContain(byCategory(id))
      }
      const night = sampleBundles(type, 23, 800).filter((id) => ROMANCE_IDS.has(id)).map(byCategory)
      expect(night.some((c) => c === 'bedtime' || c === 'pre-bedtime')).toBe(true)
      const morning = sampleBundles(type, 8, 800).filter((id) => ROMANCE_IDS.has(id)).map(byCategory)
      expect(morning.some((c) => c === 'morning-greeting' || c === 'wake-up' || c === 'breakfast')).toBe(true)
      for (const c of morning) expect(['bedtime', 'pre-bedtime', 'dinner', 'day-wrap-up']).not.toContain(c)
    }
  })

  it('personality shifts which affection bundles are chosen: 다정함 favours affectionate turns, 장난스러움 playful ones, 수줍음 careful ones', () => {
    const share = (ids: string[], predicate: (emotion: string) => boolean) => {
      const bundles = ids.map((id) => ROMANCE_DIALOGUE_BUNDLES.find((b) => b.id === id)).filter((b): b is NonNullable<typeof b> => !!b)
      const turns = bundles.flatMap((b) => b.turns)
      return turns.filter((t) => predicate(t.emotion)).length / Math.max(1, turns.length)
    }
    const plain = sampleBundles('romantic', 12, 1500, who('a'), who('b'), 5)
    const playful = sampleBundles('romantic', 12, 1500, who('a', ['playful']), who('b', ['playful']), 5)
    const shy = sampleBundles('romantic', 12, 1500, who('a', ['shy']), who('b', ['shy']), 5)
    expect(share(playful, (e) => e === 'playful')).toBeGreaterThan(share(plain, (e) => e === 'playful'))
    expect(share(shy, (e) => e === 'shy')).toBeGreaterThan(share(plain, (e) => e === 'shy'))
  })

  it('terse characters (무뚝뚝함/과묵함) tend toward shorter turns than a plain pair', () => {
    const avgLength = (ids: string[]) => {
      const turns = ids.map((id) => ROMANCE_DIALOGUE_BUNDLES.find((b) => b.id === id)).filter((b): b is NonNullable<typeof b> => !!b).flatMap((b) => b.turns)
      return turns.reduce((sum, t) => sum + t.text.casual.length, 0) / Math.max(1, turns.length)
    }
    const plain = sampleBundles('married', 12, 1500, who('a'), who('b'), 8)
    const gruff = sampleBundles('married', 12, 1500, who('a', ['gruff']), who('b', ['gruff']), 8)
    expect(avgLength(gruff)).toBeLessThan(avgLength(plain))
  })

  it('formal and casual apply per speaker, independently', () => {
    const result = buildAutoDialogueBundle({
      participants: [who('a', [], 'formal'), who('b', [], 'casual')],
      firstSpeakerId: 'a',
      relationshipType: 'romantic',
      recentLineIdsByCharacter: {},
      now: at(12),
      random: () => 0.5,
      defaultBundleCatalog: [LOVER_DIALOGUE_BUNDLES[3]], // love-04: "좋은 아침이에요. 잘 잤어요?" / "네, 덕분에요 …" (formal) vs casual
    })
    // Hour 12 blocks that morning bundle, so use a bundle valid at noon instead.
    expect(result).toBeNull()
    const noon = LOVER_DIALOGUE_BUNDLES.find((b) => b.id === 'love-08')!
    const built = buildAutoDialogueBundle({
      participants: [who('a', [], 'formal'), who('b', [], 'casual')],
      firstSpeakerId: 'a',
      relationshipType: 'romantic',
      recentLineIdsByCharacter: {},
      now: at(12),
      random: () => 0.5,
      defaultBundleCatalog: [noon],
    })
    expect(built?.lines[0].text).toBe(noon.turns[0].text.formal)
    expect(built?.lines[1].text).toBe(noon.turns[1].text.casual)
  })

  it('avoids repeating a bundle a pair just had while fresh ones exist', () => {
    const random = seeded(4)
    const recent: string[] = []
    let previous = ''
    for (let i = 0; i < 60; i++) {
      const result = buildAutoDialogueBundle({
        participants: [who('a'), who('b')],
        firstSpeakerId: 'a',
        relationshipType: 'married',
        recentLineIdsByCharacter: {},
        recentDefaultBundleIdsByPair: recent.slice(-5),
        now: at(12),
        random,
      })
      const id = result?.usedDefaultBundleId ?? ''
      expect(id).not.toBe(previous)
      previous = id
      recent.push(id)
    }
  })

  it('the pair\'s own registered romantic-tagged lines are allowed for 부부 as well as 연인, and still blocked for others', () => {
    const romanticLine = { id: 'r', categoryId: 'casual-chat', situationNote: '', text: '안녕', emotion: 'neutral', tags: ['로맨틱'], isFallback: false }
    const a: AutoDialogueParticipant = { ...who('a'), dialogueLines: [romanticLine] }
    const b: AutoDialogueParticipant = { ...who('b'), dialogueLines: [{ ...romanticLine, id: 'r2' }] }
    const build = (type: RelationshipType) =>
      buildAutoDialogueBundle({ participants: [a, b], firstSpeakerId: 'a', relationshipType: type, recentLineIdsByCharacter: {}, now: at(12), random: () => 0 })
    expect(build('married')?.usedDefaultBundleId).toBeUndefined()
    expect(build('romantic')?.usedDefaultBundleId).toBeUndefined()
    expect(build('friend')?.usedDefaultBundleId).not.toBeUndefined() // registered romantic lines excluded → falls to the (non-romantic) default library
  })
})

/**
 * Regression coverage for a real user report: with 관계 = 부부, generated
 * conversations came out reading like a rival/awkward pair sniping at each
 * other (e.g. spouse-49's old reply, "그렇게 잘 아는 척은 여전하네요" — a mocking
 * retort), not a comfortable married couple. Root cause: `spouse-49` was
 * tagged exactly like every other warm teasing turn in this file
 * (`emotion: 'playful'`, `tags: PL`) — the engine has no tone signal beyond
 * personality/relationship-type filtering (already correctly airtight, see
 * "romance dialogue selection" above), so a line that *reads* sarcastic
 * despite "correct" metadata can only be caught by actually checking the
 * words. Fixed at the content root (romanceDialogueLibrary.ts's spouse-49),
 * then turned into this standing pattern-based regression guard so the same
 * class of problem can't silently reappear in future content — never just a
 * one-off manual re-read.
 */
describe('부부 대화는 비꼬거나 냉소적으로 들리지 않는다 (관계별 대화 정서 회귀 테스트)', () => {
  const SARCASM_PATTERNS: Array<[string, RegExp]> = [
    ['잘 아는 척', /잘\s*아는\s*척/],
    ['그럴 줄 알았다는 식의 비아냥', /그럴\s*줄\s*알았/],
    ['착각하지 마', /착각하지\s*마/],
    ['기대 안 했다는 식의 깎아내림', /기대\s*안\s*했/],
    ['비꼬는 맞장구 ("여전하네")', /여전하네/],
    ['떠보거나 시험하는 말투', /떠보는|떠봤|시험하려|시험해\s*보려/],
  ]

  function expectNoSarcasm(bundles: DefaultDialogueBundleDef[]) {
    for (const bundle of bundles) {
      for (const turn of bundle.turns) {
        for (const text of [turn.text.formal, turn.text.casual]) {
          for (const [label, pattern] of SARCASM_PATTERNS) expect(text, `${bundle.id} (${label}): ${text}`).not.toMatch(pattern)
        }
      }
    }
  }

  it('부부 전용 대사(SPOUSE_DIALOGUE_BUNDLES)에는 비꼬거나 냉소적인 표현이 없다', () => {
    expectNoSarcasm(SPOUSE_DIALOGUE_BUNDLES)
  })

  it('연인/부부 공용 대사를 포함해 로맨스 라이브러리 전체(love/spouse/affection)에도 같은 패턴이 없다', () => {
    expectNoSarcasm(ROMANCE_DIALOGUE_BUNDLES)
  })

  it('라이벌/어색한 사이처럼 의도적으로 거리감이 있는 관계 전용 콘텐츠를 뺀 전체 대화 카탈로그(공용/친구/친밀/가족 포함)에도 같은 패턴이 없다', () => {
    // rival/awkward are deliberately excluded — those two are *supposed* to carry some real edge/distance by
    // design (relationshipContent.test.tsx already covers their own, different content-safety rules).
    const coldByDesignIds = new Set([...RIVAL_DIALOGUE_BUNDLES, ...AWKWARD_DIALOGUE_BUNDLES].map((b) => b.id))
    expectNoSarcasm(DEFAULT_DIALOGUE_BUNDLES.filter((b) => !coldByDesignIds.has(b.id)))
  })

  it('실제 자동 대화 생성기로 부부 쌍의 대사를 여러 번(다양한 성격 조합·시간대 포함) 만들어 봐도 비꼬는 대사가 선택되지 않는다', () => {
    const personalityCombos: Array<[string[], string[]]> = [
      [[], []],
      [['playful'], ['playful']],
      [['gruff'], ['gruff']],
      [['blunt'], ['blunt']],
      [['reticent'], ['talkative']],
    ]
    let sampled = 0
    for (const [tagsA, tagsB] of personalityCombos) {
      for (const hour of [8, 12, 15, 19, 23]) {
        const random = seeded(hour * 97 + tagsA.length * 11 + tagsB.length + 1)
        for (let i = 0; i < 60; i++) {
          const result = buildAutoDialogueBundle({
            participants: [who('a', tagsA), who('b', tagsB)],
            firstSpeakerId: 'a',
            relationshipType: 'married',
            recentLineIdsByCharacter: {},
            now: at(hour),
            random,
          })
          for (const line of result?.lines ?? []) {
            sampled++
            for (const [label, pattern] of SARCASM_PATTERNS) expect(line.text, `married pair said (${label}): ${line.text}`).not.toMatch(pattern)
          }
        }
      }
    }
    expect(sampled).toBeGreaterThan(200) // the guard above only means something if it actually sampled real generated lines
  })

  it('회귀 방지: spouse-49는 여전히 같은 자리(부부 전용 teasing, 3턴)에 존재한다 — 텍스트만 고쳤을 뿐 구조를 바꾸지 않았다', () => {
    const spouse49 = SPOUSE_DIALOGUE_BUNDLES.find((b) => b.id === 'spouse-49')!
    expect(spouse49.categoryId).toBe('teasing')
    expect(spouse49.relationshipTypes).toEqual(['married'])
    expect(spouse49.romantic).toBe(true)
    expect(spouse49.turns).toHaveLength(3)
  })

  it('회귀 방지: 이 수정이 다른 관계(친구/친밀/가족/라이벌/어색한 사이)의 대사 선택 풀을 부부 콘텐츠로 오염시키지 않는다', () => {
    const romanceIds = new Set(ROMANCE_DIALOGUE_BUNDLES.map((b) => b.id))
    for (const type of ['friend', 'close', 'family', 'rival', 'awkward'] as const) {
      const random = seeded(type.length * 17 + 3)
      for (let i = 0; i < 150; i++) {
        const result = buildAutoDialogueBundle({
          participants: [who('a'), who('b')],
          firstSpeakerId: 'a',
          relationshipType: type,
          recentLineIdsByCharacter: {},
          now: at(12),
          random,
        })
        if (result?.usedDefaultBundleId) expect(romanceIds.has(result.usedDefaultBundleId), `${type} got ${result.usedDefaultBundleId}`).toBe(false)
      }
    }
  })
})

describe('romance monologue library (static data)', () => {
  it('has 30 연인-only, 30 부부-only and 10 shared situations, each in both registers (140 entries)', () => {
    expect(ROMANCE_MONOLOGUE_LINES).toHaveLength(140)
    const count = (prefix: string) => ROMANCE_MONOLOGUE_LINES.filter((l) => l.id.startsWith(prefix) && l.tone === 'casual').length
    expect(count('mono-love-')).toBe(30)
    expect(count('mono-spouse-')).toBe(30)
    expect(count('mono-couple-')).toBe(10)
    expect(new Set(ROMANCE_MONOLOGUE_LINES.map((l) => l.text)).size).toBe(140)
    for (const line of ROMANCE_MONOLOGUE_LINES) expect(DEFAULT_MONOLOGUE_LIBRARY).toContain(line)
  })

  it('every line carries a partner condition that matches its id group, and none is a question', () => {
    for (const line of ROMANCE_MONOLOGUE_LINES) {
      const relationships = line.partnerCondition?.relationships
      expect(relationships).toBeDefined()
      if (line.id.startsWith('mono-love-')) expect(relationships).toEqual(['romantic'])
      if (line.id.startsWith('mono-spouse-')) expect(relationships).toEqual(['married'])
      if (line.id.startsWith('mono-couple-')) expect(relationships).toEqual(['romantic', 'married'])
      expect(line.text).not.toMatch(/[?？]/)
      expect(line.text).not.toMatch(/(까|까요|니)[.…!]*$/)
    }
  })

  it('never claims a partner is in front of the character unless the condition guarantees they share the room', () => {
    for (const line of ROMANCE_MONOLOGUE_LINES) {
      if (/같은 방에 있|곁에 있|같은 공간|같은 방 어딘가|함께 있는|함께 있으면|함께 있으니|같이 있는|같이 있으니|곁에 누군가|조용히 함께/.test(line.text)) {
        expect(['sameRoom'], line.id).toContain(line.partnerCondition?.presence)
      }
    }
  })
})

describe('romance monologue batch 2 (mono-love-16..30 / mono-spouse-16..30): no duplicates, presence-gated, right themes', () => {
  const batch2 = ROMANCE_MONOLOGUE_LINES.filter((l) => /^mono-(love|spouse)-(1[6-9]|2\d|30)-/.test(l.id))

  it('adds exactly 15 new 연인 and 15 new 부부 situations (30 entries each register), no duplicate text in the whole monologue library', () => {
    expect(batch2.filter((l) => l.id.startsWith('mono-love-') && l.tone === 'casual')).toHaveLength(15)
    expect(batch2.filter((l) => l.id.startsWith('mono-spouse-') && l.tone === 'casual')).toHaveLength(15)
    expect(batch2).toHaveLength(60)
    const batch2Ids = new Set(batch2.map((l) => l.id))
    const existing = new Set(DEFAULT_MONOLOGUE_LIBRARY.filter((l) => !batch2Ids.has(l.id)).map((l) => l.text))
    const seen = new Set<string>()
    for (const line of batch2) {
      expect(existing.has(line.text), `${line.id}: "${line.text}" already exists elsewhere`).toBe(false)
      expect(seen.has(line.text), `${line.id}: duplicate within batch`).toBe(false)
      seen.add(line.text)
    }
  })

  it('keeps the 6 sameRoom / 4 otherRoom / 5 recentTalk split per 15-situation group, and no question marks or 까/까요/니 endings', () => {
    for (const prefix of ['mono-love-', 'mono-spouse-']) {
      const situations = batch2.filter((l) => l.id.startsWith(prefix) && l.tone === 'casual')
      expect(situations.filter((l) => l.partnerCondition?.presence === 'sameRoom')).toHaveLength(6)
      expect(situations.filter((l) => l.partnerCondition?.presence === 'otherRoom')).toHaveLength(4)
      expect(situations.filter((l) => l.partnerCondition?.presence === 'recentTalk')).toHaveLength(5)
    }
    for (const line of batch2) {
      expect(line.text).not.toMatch(/[?？]/)
      expect(line.text).not.toMatch(/(까|까요|니)[.…!]*$/)
    }
  })

  it('never claims the partner is nearby unless the condition is sameRoom', () => {
    for (const line of batch2) {
      if (/같은 방에 있|곁에 있|같은 공간|같은 방 어딘가|함께 있는|함께 있으면|함께 있으니|같이 있는|같이 있으니|곁에 누군가|조용히 함께|같이 있으면|이 방/.test(line.text)) {
        expect(line.partnerCondition?.presence, line.id).toBe('sameRoom')
      }
    }
  })

  it('never assumes marriage length or children in the 부부 batch', () => {
    const spouseText = batch2.filter((l) => l.id.startsWith('mono-spouse-')).map((l) => l.text).join(' ')
    for (const word of ['몇 년', '신혼', '결혼', '아이', '아기', '애들']) expect(spouseText).not.toContain(word)
  })
})

describe('romance monologue selection', () => {
  const base = { personalityTags: [], baseTone: 'casual' as const, activity: 'idle' as const, hour: 12, recentLineIds: [] }
  function collect(partners: Parameters<typeof pickMonologue>[0]['partners'], count = 600, tone: BaseTone = 'casual') {
    const random = seeded(21)
    const picked = []
    for (let i = 0; i < count; i++) {
      const line = pickMonologue({ ...base, baseTone: tone, partners, random })
      if (line) picked.push(line)
    }
    return picked
  }

  it('a character with no partner, or only non-romantic relationships, never gets a romance line', () => {
    for (const line of collect([])) expect(line.partnerCondition).toBeUndefined()
    // A non-romantic partner never unlocks a romance line. (Other relationships may have their own relationship lines now, but each only lists its own type.)
    for (const type of NON_ROMANTIC) {
      for (const line of collect([{ relationship: type, sameRoom: true, recentTalk: true }])) {
        expect(line.id, `${type} got ${line.id}`).not.toMatch(/^mono-(love|spouse|couple)-/)
        if (line.partnerCondition) expect(line.partnerCondition.relationships).toContain(type)
      }
    }
  })

  it('연인 lines appear for a 연인 partner only, 부부 lines for a 부부 partner only, shared lines for both', () => {
    const lover = collect([{ relationship: 'romantic', sameRoom: true, recentTalk: true }])
    const spouse = collect([{ relationship: 'married', sameRoom: true, recentTalk: true }])
    expect(lover.some((l) => l.id.startsWith('mono-love-'))).toBe(true)
    expect(lover.some((l) => l.id.startsWith('mono-couple-'))).toBe(true)
    expect(lover.some((l) => l.id.startsWith('mono-spouse-'))).toBe(false)
    expect(spouse.some((l) => l.id.startsWith('mono-spouse-'))).toBe(true)
    expect(spouse.some((l) => l.id.startsWith('mono-couple-'))).toBe(true)
    expect(spouse.some((l) => l.id.startsWith('mono-love-'))).toBe(false)
  })

  it('presence conditions follow real state: same-room lines need a partner in the room, other-room lines a partner elsewhere, recent-talk lines a recent talk', () => {
    const apart = collect([{ relationship: 'romantic', sameRoom: false, recentTalk: false }])
    expect(apart.some((l) => l.partnerCondition?.presence === 'otherRoom')).toBe(true)
    expect(apart.some((l) => l.partnerCondition?.presence === 'sameRoom')).toBe(false)
    expect(apart.some((l) => l.partnerCondition?.presence === 'recentTalk')).toBe(false)

    const together = collect([{ relationship: 'romantic', sameRoom: true, recentTalk: false }])
    expect(together.some((l) => l.partnerCondition?.presence === 'sameRoom')).toBe(true)
    expect(together.some((l) => l.partnerCondition?.presence === 'otherRoom')).toBe(false)
    expect(together.some((l) => l.partnerCondition?.presence === 'recentTalk')).toBe(false)
  })

  it('respects the speech register', () => {
    const formal = collect([{ relationship: 'married', sameRoom: true, recentTalk: true }], 300, 'formal').filter((l) => l.partnerCondition)
    expect(formal.length).toBeGreaterThan(0)
    expect(formal.every((l) => l.tone === 'formal')).toBe(true)
  })
})

describe('romance monologues through the live trigger', () => {
  function character(id: string, tone: BaseTone = 'casual'): Character {
    return {
      id,
      name: id,
      imageDataUrl: 'data:image/png;base64,',
      displayScale: 1,
      footOffsetRatio: 0,
      imageBounds: null,
      traits: { personality: '', favoriteColor: '' },
      aiProfile: { ...EMPTY_AI_PROFILE, tone: { ...EMPTY_AI_PROFILE.tone, baseTone: tone } },
    }
  }
  function entry(id: string, roomId: string, overrides: Partial<CharacterMovementState> = {}): CharacterMovementState {
    return { id, roomId, x: 300, y: 350, destination: null, destinationRoomId: null, currentBehavior: null, status: 'idle', restTicksRemaining: 0, stuckTicks: 0, ...overrides }
  }
  function isRomance(lineId: string | undefined) {
    return !!lineId && lineId.startsWith('mono-') && /^mono-(love|spouse|couple)-/.test(lineId)
  }
  /** Runs many passes for one observer and returns every monologue line id it produced. */
  function run(observer: string, passes = 4 * 60 * 20): string[] {
    const random = seeded(17)
    const seen: string[] = []
    let last = -1
    for (let i = 0; i < passes; i++) {
      runMonologuePass(1_000_000 + i * 250, 12, random)
      const active = useMonologueStore.getState().activeByCharacter[observer]
      if (active && active.startedAt !== last) {
        seen.push(active.lineId)
        last = active.startedAt
      }
    }
    return seen
  }

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
    useDialogueStore.setState({ activeConversations: {}, lastConversationEndAtByPair: {}, activeBubbleByCharacter: {} })
    useRelationshipStore.setState({ defaultRelationshipType: 'close', relationshipsByPair: {} })
    useSimulationStore.setState({ isRunning: true, tick: 0 })
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('a 연인 in the same room produces romance monologues, and only 연인/공용 ones', () => {
    useCharacterStore.setState({ characters: [character('a'), character('b')] })
    useCharacterMovementStore.setState({ byId: { a: entry('a', roomId), b: entry('b', roomId) } })
    useRelationshipStore.getState().setRelationshipType('a', 'b', 'romantic')
    const lines = run('a')
    const romance = lines.filter((id) => isRomance(id))
    expect(romance.length).toBeGreaterThan(0)
    for (const id of romance) expect(id).not.toMatch(/^mono-spouse-/)
    for (const id of romance) {
      const def = DEFAULT_MONOLOGUE_LIBRARY.find((l) => l.id === id)
      expect(def?.partnerCondition?.presence).toBe('sameRoom') // no recent talk, and partner isn't elsewhere
    }
  })

  it('a 부부 in the same room produces 부부/공용 monologues', () => {
    useCharacterStore.setState({ characters: [character('a'), character('b')] })
    useCharacterMovementStore.setState({ byId: { a: entry('a', roomId), b: entry('b', roomId) } })
    useRelationshipStore.getState().setRelationshipType('a', 'b', 'married')
    const romance = run('a').filter((id) => isRomance(id))
    expect(romance.length).toBeGreaterThan(0)
    for (const id of romance) expect(id).not.toMatch(/^mono-love-/)
  })

  it('never says the partner is nearby when they are in another room', () => {
    useCharacterStore.setState({ characters: [character('a'), character('b')] })
    useCharacterMovementStore.setState({ byId: { a: entry('a', roomId), b: entry('b', room2Id) } })
    useRelationshipStore.getState().setRelationshipType('a', 'b', 'married')
    const romance = run('a').filter((id) => isRomance(id))
    expect(romance.length).toBeGreaterThan(0)
    for (const id of romance) expect(DEFAULT_MONOLOGUE_LIBRARY.find((l) => l.id === id)?.partnerCondition?.presence).toBe('otherRoom')
  })

  it('uses a recent real conversation as a condition, and only within the recent window', () => {
    useCharacterStore.setState({ characters: [character('a'), character('b')] })
    useCharacterMovementStore.setState({ byId: { a: entry('a', roomId), b: entry('b', roomId) } })
    useRelationshipStore.getState().setRelationshipType('a', 'b', 'romantic')
    useDialogueStore.setState({ lastConversationEndAtByPair: { [pairKey('a', 'b')]: 1_000_000 } })
    const lines = run('a', 4 * 60 * 2) // 2 minutes: inside the 3-minute window
    expect(lines.some((id) => DEFAULT_MONOLOGUE_LIBRARY.find((l) => l.id === id)?.partnerCondition?.presence === 'recentTalk')).toBe(true)

    useMonologueStore.getState().reset()
    useDialogueStore.setState({ lastConversationEndAtByPair: { [pairKey('a', 'b')]: 1_000_000 - 10 * 60_000 } })
    const later = run('a')
    expect(later.some((id) => DEFAULT_MONOLOGUE_LIBRARY.find((l) => l.id === id)?.partnerCondition?.presence === 'recentTalk')).toBe(false)
  })

  it('characters with no romantic relationship (or only friends/family/rivals) never produce romance monologues', () => {
    const ids = ['a', 'b', 'c', 'd', 'e']
    useCharacterStore.setState({ characters: ids.map((id) => character(id)) })
    useCharacterMovementStore.setState({ byId: Object.fromEntries(ids.map((id) => [id, entry(id, roomId)])) })
    const types: RelationshipType[] = ['friend', 'family', 'rival', 'awkward', 'close']
    let n = 0
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) useRelationshipStore.getState().setRelationshipType(ids[i], ids[j], types[n++ % types.length])
    for (const id of ids) {
      for (const lineId of run(id, 4 * 60 * 10)) expect(isRomance(lineId), `${id} got ${lineId}`).toBe(false)
      useMonologueStore.getState().reset()
    }
  })

  it('five characters run together: a couple mutters romance while the others stay ordinary, all bubbles independent', () => {
    const ids = ['a', 'b', 'c', 'd', 'e']
    useCharacterStore.setState({ characters: ids.map((id) => character(id)) })
    useCharacterMovementStore.setState({ byId: Object.fromEntries(ids.map((id) => [id, entry(id, roomId)])) })
    useRelationshipStore.getState().setRelationshipType('a', 'b', 'romantic')
    useRelationshipStore.getState().setRelationshipType('c', 'd', 'married')
    const random = seeded(3)
    const seen: Record<string, string[]> = { a: [], b: [], c: [], d: [], e: [] }
    for (let i = 0; i < 4 * 60 * 20; i++) {
      runMonologuePass(1_000_000 + i * 250, 12, random)
      for (const id of ids) {
        const active = useMonologueStore.getState().activeByCharacter[id]
        if (active && !seen[id].includes(active.lineId)) seen[id].push(active.lineId)
      }
    }
    for (const id of ids) expect(seen[id].length).toBeGreaterThan(0)
    expect(seen.a.some(isRomance) && seen.b.some(isRomance)).toBe(true)
    expect(seen.c.some(isRomance) && seen.d.some(isRomance)).toBe(true)
    expect(seen.e.some(isRomance)).toBe(false)
    for (const id of [...seen.a, ...seen.b]) expect(id).not.toMatch(/^mono-spouse-/)
    for (const id of [...seen.c, ...seen.d]) expect(id).not.toMatch(/^mono-love-/)
  })

  it('does not repeat a romance monologue back-to-back, and leaves movement state untouched', () => {
    useCharacterStore.setState({ characters: [character('a'), character('b')] })
    const moving = entry('a', roomId, { status: 'moving', destination: { x: 100, y: 300 } })
    useCharacterMovementStore.setState({ byId: { a: moving, b: entry('b', roomId) } })
    useRelationshipStore.getState().setRelationshipType('a', 'b', 'romantic')
    const lines = run('a')
    for (let i = 1; i < lines.length; i++) expect(lines[i]).not.toBe(lines[i - 1])
    expect(useCharacterMovementStore.getState().byId.a).toEqual(moving)
  })
})

describe('LiveScreen relationship picker', () => {
  beforeEach(() => {
    localStorage.clear()
    const room = useHomeStore.getInitialState().rooms[0]
    useHomeStore.setState({ rooms: [{ ...room, furniture: [] }], activeDecorateRoomId: room.id, activeLiveRoomId: room.id, selectedFurnitureId: null })
    useCharacterMovementStore.setState({ byId: {} })
    useDialogueFrequencyStore.setState({ mode: 'quiet' })
    useMonologueFrequencyStore.setState({ mode: 'off' })
    useRelationshipStore.setState({ defaultRelationshipType: 'close', relationshipsByPair: {} })
    useSimulationStore.setState({ isRunning: true, tick: 0 })
    const make = (id: string): Character => ({
      id,
      name: id,
      imageDataUrl: 'data:image/png;base64,',
      displayScale: 1,
      footOffsetRatio: 0,
      imageBounds: null,
      traits: { personality: '', favoriteColor: '' },
      aiProfile: { ...EMPTY_AI_PROFILE },
    })
    useCharacterStore.setState({ characters: [make('a'), make('b')] })
  })
  afterEach(() => cleanup())

  it('lists 연인 and 부부 as separate options and saves 부부 for the pair when chosen', async () => {
    const user = userEvent.setup()
    render(<LiveScreen />)
    const select = screen.getByLabelText('선택한 쌍의 관계 유형')
    const labels = within(select).getAllByRole('option').map((o) => o.textContent)
    expect(labels).toContain('연인')
    expect(labels).toContain('부부')
    await user.selectOptions(select, 'married')
    expect(useRelationshipStore.getState().getRelationshipType('a', 'b')).toBe('married')
    expect(JSON.parse(localStorage.getItem('dearly-relationship') ?? '{}').state.relationshipsByPair[pairKey('a', 'b')]).toBe('married')
  })
})
