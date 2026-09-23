import { describe, expect, it } from 'vitest'
import type { CharacterDialogueLine } from '../character/types'
import type { DefaultDialogueBundleDef } from './defaultDialogueLibrary'
import {
  buildAutoDialogueBundle,
  pickFirstSpeaker,
  rollShouldStartConversation,
  type AutoDialogueParticipant,
} from './autoDialogueEngine'

const NOON = new Date(2026, 8, 19, 12, 0, 0).getTime()

function line(overrides: Partial<CharacterDialogueLine> = {}): CharacterDialogueLine {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    categoryId: 'casual-chat',
    situationNote: '',
    text: '안녕!',
    emotion: 'neutral',
    tags: [],
    isFallback: false,
    ...overrides,
  }
}

function participant(id: string, overrides: Partial<AutoDialogueParticipant> = {}): AutoDialogueParticipant {
  return {
    id,
    personalityTags: [],
    dialogueLines: [line({ id: `${id}-line-1` }), line({ id: `${id}-line-2` })],
    baseTone: 'casual',
    ...overrides,
  }
}

function fixedRandom(...values: number[]): () => number {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

describe('rollShouldStartConversation', () => {
  it('never starts in quiet mode regardless of the roll', () => {
    const result = rollShouldStartConversation({
      frequencyMode: 'quiet',
      relationshipType: 'close',
      now: NOON,
      lastConversationEndAt: 0,
      random: fixedRandom(0),
    })
    expect(result).toBe(false)
  })

  it('respects the cooldown even when the roll would otherwise succeed', () => {
    const result = rollShouldStartConversation({
      frequencyMode: 'rowdy',
      relationshipType: 'close',
      now: 100_000,
      lastConversationEndAt: 95_000, // rowdy cooldown is 12_000ms — not enough time has passed
      random: fixedRandom(0),
    })
    expect(result).toBe(false)
  })

  it('starts once the roll is under the effective chance', () => {
    const result = rollShouldStartConversation({
      frequencyMode: 'normal',
      relationshipType: 'close',
      now: 1_000_000,
      lastConversationEndAt: 0,
      random: fixedRandom(0.01),
    })
    expect(result).toBe(true)
  })

  it('does not start when the roll exceeds the effective chance', () => {
    const result = rollShouldStartConversation({
      frequencyMode: 'occasional',
      relationshipType: 'close',
      now: 1_000_000,
      lastConversationEndAt: 0,
      random: fixedRandom(0.99),
    })
    expect(result).toBe(false)
  })

  it('rowdy rolls a conversation far more often than occasional at the same fixed roll', () => {
    const occasional = rollShouldStartConversation({
      frequencyMode: 'occasional',
      relationshipType: 'close',
      now: 1_000_000,
      lastConversationEndAt: 0,
      random: fixedRandom(0.5),
    })
    const rowdy = rollShouldStartConversation({
      frequencyMode: 'rowdy',
      relationshipType: 'close',
      now: 1_000_000,
      lastConversationEndAt: 0,
      random: fixedRandom(0.5),
    })
    expect(occasional).toBe(false)
    expect(rowdy).toBe(true)
  })

  it('awkward relationships lower the effective chance below what close relationships get', () => {
    const awkward = rollShouldStartConversation({
      frequencyMode: 'normal',
      relationshipType: 'awkward',
      now: 1_000_000,
      lastConversationEndAt: 0,
      random: fixedRandom(0.3),
    })
    const close = rollShouldStartConversation({
      frequencyMode: 'normal',
      relationshipType: 'close',
      now: 1_000_000,
      lastConversationEndAt: 0,
      random: fixedRandom(0.3),
    })
    expect(awkward).toBe(false)
    expect(close).toBe(true)
  })
})

describe('pickFirstSpeaker', () => {
  it('picks the sociable character far more often than a shy one at the same roll', () => {
    const sociable = participant('a', { personalityTags: ['sociable'] })
    const shy = participant('b', { personalityTags: ['shy'] })
    // sociable weight ~1.35, shy weight ~0.7 → total ~2.05; a roll of 0.5 lands in a's share.
    const speaker = pickFirstSpeaker([sociable, shy], fixedRandom(0.5))
    expect(speaker.id).toBe('a')
  })

  it('still returns a valid participant when neither has any personality tags', () => {
    const a = participant('a')
    const b = participant('b')
    const speaker = pickFirstSpeaker([a, b], fixedRandom(0.9))
    expect(['a', 'b']).toContain(speaker.id)
  })
})

describe('buildAutoDialogueBundle — registered-line path (unchanged from before the default library existed)', () => {
  // These pin the *registered-line* mechanism's own behavior in isolation,
  // via `defaultBundleCatalog: []` — without that override, every one of
  // these "should fail" scenarios would now succeed anyway, via the default
  // library fallback (see the next describe block). That fallback existing
  // doesn't mean the registered-line rules themselves changed.

  it('finds no candidate from an empty registered-line catalog when the default library is also empty', () => {
    const a = participant('a', { dialogueLines: [] })
    const b = participant('b', { dialogueLines: [] })
    const bundle = buildAutoDialogueBundle({
      participants: [a, b],
      firstSpeakerId: 'a',
      relationshipType: 'close',
      recentLineIdsByCharacter: {},
      now: NOON,
      random: fixedRandom(0),
      defaultBundleCatalog: [],
    })
    expect(bundle).toBeNull()
  })

  it('builds a 2-4 line bundle alternating speakers starting from the given first speaker', () => {
    const a = participant('a', {
      dialogueLines: [line({ id: 'a1' }), line({ id: 'a2' }), line({ id: 'a3' })],
    })
    const b = participant('b', {
      dialogueLines: [line({ id: 'b1' }), line({ id: 'b2' }), line({ id: 'b3' })],
    })
    const bundle = buildAutoDialogueBundle({
      participants: [a, b],
      firstSpeakerId: 'a',
      relationshipType: 'close',
      recentLineIdsByCharacter: {},
      now: NOON,
      random: fixedRandom(0.99, 0, 0, 0, 0), // 0.99 -> max bundle length (4)
    })
    expect(bundle).not.toBeNull()
    expect(bundle!.lines).toHaveLength(4)
    expect(bundle!.lines.map((l) => l.speakerId)).toEqual(['a', 'b', 'a', 'b'])
    expect(bundle!.usedDefaultBundleId).toBeUndefined()
  })

  it('excludes a character\'s recently-used lines, falling through to the default library once nothing else qualifies', () => {
    const a = participant('a', { dialogueLines: [line({ id: 'a1' })] })
    const b = participant('b')
    const bundle = buildAutoDialogueBundle({
      participants: [a, b],
      firstSpeakerId: 'a',
      relationshipType: 'close',
      recentLineIdsByCharacter: { a: ['a1'] },
      now: NOON,
      random: fixedRandom(0),
    })
    // The registered-line path alone can't fill this turn (a's only line was just used) — with the real default library available, the conversation still happens instead of being skipped.
    expect(bundle).not.toBeNull()
    expect(bundle!.usedDefaultBundleId).toBeDefined()
  })

  it('excludes a character\'s recently-used lines, and skips the conversation if the default library is also empty', () => {
    const a = participant('a', { dialogueLines: [line({ id: 'a1' })] })
    const b = participant('b')
    const bundle = buildAutoDialogueBundle({
      participants: [a, b],
      firstSpeakerId: 'a',
      relationshipType: 'close',
      recentLineIdsByCharacter: { a: ['a1'] },
      now: NOON,
      random: fixedRandom(0),
      defaultBundleCatalog: [],
    })
    expect(bundle).toBeNull()
  })

  it('falls back to a line marked isFallback when every other candidate was recently used', () => {
    const fallbackLine = line({ id: 'a-fallback', isFallback: true })
    const a = participant('a', { dialogueLines: [line({ id: 'a1' }), fallbackLine] })
    const b = participant('b')
    const bundle = buildAutoDialogueBundle({
      participants: [a, b],
      firstSpeakerId: 'a',
      relationshipType: 'close',
      recentLineIdsByCharacter: { a: ['a1', 'a-fallback'] },
      now: NOON,
      random: fixedRandom(0),
    })
    // both of a's lines are "recently used", so the strict pass fails, but the
    // fallback pass ignores recency for isFallback lines — a-fallback should win,
    // via the registered-line path (never touching the default library).
    expect(bundle).not.toBeNull()
    expect(bundle!.lines[0].speakerId).toBe('a')
    expect(bundle!.usedDefaultBundleId).toBeUndefined()
  })

  it('hard-excludes romantic-tagged lines when the relationship type does not allow them', () => {
    const romanticLine = line({ id: 'a-romantic', tags: ['로맨틱'] })
    const plainLine = line({ id: 'a-plain' })
    const a = participant('a', { dialogueLines: [romanticLine, plainLine] })
    const b = participant('b')

    const bundle = buildAutoDialogueBundle({
      participants: [a, b],
      firstSpeakerId: 'a',
      relationshipType: 'friend',
      recentLineIdsByCharacter: {},
      now: NOON,
      random: fixedRandom(0),
    })

    expect(bundle).not.toBeNull()
    const usedIds = bundle!.usedLineIds.filter((u) => u.characterId === 'a').map((u) => u.lineId)
    expect(usedIds).not.toContain('a-romantic')
  })

  it('allows romantic-tagged lines when the relationship type is romantic', () => {
    const romanticLine = line({ id: 'a-romantic', tags: ['로맨틱'] })
    const a = participant('a', { dialogueLines: [romanticLine] })
    const b = participant('b')

    const bundle = buildAutoDialogueBundle({
      participants: [a, b],
      firstSpeakerId: 'a',
      relationshipType: 'romantic',
      recentLineIdsByCharacter: {},
      now: NOON,
      random: fixedRandom(0),
    })

    expect(bundle).not.toBeNull()
    const usedIds = bundle!.usedLineIds.filter((u) => u.characterId === 'a').map((u) => u.lineId)
    expect(usedIds).toContain('a-romantic')
  })

  it('excludes conflict/reconciliation-category lines from auto-dialogue entirely, even with no default-library safety net', () => {
    const a = participant('a', { dialogueLines: [line({ id: 'a1', categoryId: 'conflict' })] })
    const b = participant('b', { dialogueLines: [] })
    const bundle = buildAutoDialogueBundle({
      participants: [a, b],
      firstSpeakerId: 'a',
      relationshipType: 'close',
      recentLineIdsByCharacter: {},
      now: NOON,
      random: fixedRandom(0),
      defaultBundleCatalog: [],
    })
    expect(bundle).toBeNull()
  })

  it('gates morning-greeting lines to the real-clock morning window', () => {
    const a = participant('a', { dialogueLines: [line({ id: 'a1', categoryId: 'morning-greeting' })] })
    const b = participant('b')
    const noonBundle = buildAutoDialogueBundle({
      participants: [a, b],
      firstSpeakerId: 'a',
      relationshipType: 'close',
      recentLineIdsByCharacter: {},
      now: NOON, // hour 12 — outside the 5-10 window
      random: fixedRandom(0),
      defaultBundleCatalog: [],
    })
    expect(noonBundle).toBeNull()

    const morning = new Date(2026, 8, 19, 8, 0, 0).getTime()
    const morningBundle = buildAutoDialogueBundle({
      participants: [a, b],
      firstSpeakerId: 'a',
      relationshipType: 'close',
      recentLineIdsByCharacter: {},
      now: morning,
      random: fixedRandom(0),
      defaultBundleCatalog: [],
    })
    expect(morningBundle).not.toBeNull()
  })
})

describe('buildAutoDialogueBundle — default-library fallback (no example lines required)', () => {
  function bundleFixture(overrides: Partial<DefaultDialogueBundleDef> = {}): DefaultDialogueBundleDef {
    return {
      id: overrides.id ?? 'fixture-bundle',
      categoryId: 'casual-chat',
      turns: [
        { speaker: 'first', emotion: 'neutral', tags: [], text: { formal: '안녕하세요.', casual: '안녕.' } },
        { speaker: 'second', emotion: 'neutral', tags: [], text: { formal: '네, 안녕하세요.', casual: '어, 안녕.' } },
      ],
      ...overrides,
    }
  }

  it('produces a full conversation for two characters with zero registered dialogue lines', () => {
    const a = participant('a', { dialogueLines: [] })
    const b = participant('b', { dialogueLines: [] })
    const bundle = buildAutoDialogueBundle({
      participants: [a, b],
      firstSpeakerId: 'a',
      relationshipType: 'close',
      recentLineIdsByCharacter: {},
      now: NOON,
      random: fixedRandom(0),
      defaultBundleCatalog: [bundleFixture()],
    })
    expect(bundle).not.toBeNull()
    expect(bundle!.lines.length).toBeGreaterThan(0)
    expect(bundle!.usedDefaultBundleId).toBe('fixture-bundle')
  })

  it('renders the formal (존댓말) variant for a speaker whose baseTone is formal, and the casual variant otherwise', () => {
    const a = participant('a', { dialogueLines: [], baseTone: 'formal' })
    const b = participant('b', { dialogueLines: [], baseTone: 'casual' })
    const bundle = buildAutoDialogueBundle({
      participants: [a, b],
      firstSpeakerId: 'a',
      relationshipType: 'close',
      recentLineIdsByCharacter: {},
      now: NOON,
      random: fixedRandom(0),
      defaultBundleCatalog: [bundleFixture()],
    })
    expect(bundle!.lines[0]).toMatchObject({ speakerId: 'a', text: '안녕하세요.' })
    expect(bundle!.lines[1]).toMatchObject({ speakerId: 'b', text: '어, 안녕.' })
  })

  it('falls back to the casual variant for mixed/custom tone (no single correct register to pick)', () => {
    const a = participant('a', { dialogueLines: [], baseTone: 'mixed' })
    const b = participant('b', { dialogueLines: [], baseTone: 'custom' })
    const bundle = buildAutoDialogueBundle({
      participants: [a, b],
      firstSpeakerId: 'a',
      relationshipType: 'close',
      recentLineIdsByCharacter: {},
      now: NOON,
      random: fixedRandom(0),
      defaultBundleCatalog: [bundleFixture()],
    })
    expect(bundle!.lines[0].text).toBe('안녕.')
    expect(bundle!.lines[1].text).toBe('어, 안녕.')
  })

  it('never uses independent lines from two different bundles — the whole exchange comes from one bundle', () => {
    const a = participant('a', { dialogueLines: [] })
    const b = participant('b', { dialogueLines: [] })
    const catalog = [
      bundleFixture({ id: 'bundle-x', turns: [{ speaker: 'first', emotion: 'neutral', tags: [], text: { formal: 'X', casual: 'x' } }] }),
      bundleFixture({ id: 'bundle-y', turns: [{ speaker: 'first', emotion: 'neutral', tags: [], text: { formal: 'Y', casual: 'y' } }] }),
    ]
    const bundle = buildAutoDialogueBundle({
      participants: [a, b],
      firstSpeakerId: 'a',
      relationshipType: 'close',
      recentLineIdsByCharacter: {},
      now: NOON,
      random: fixedRandom(0),
      defaultBundleCatalog: catalog,
    })
    expect(['bundle-x', 'bundle-y']).toContain(bundle!.usedDefaultBundleId)
    // Every used line id shares the same bundle prefix as usedDefaultBundleId.
    for (const used of bundle!.usedLineIds) {
      expect(used.lineId.startsWith(bundle!.usedDefaultBundleId!)).toBe(true)
    }
  })

  it('hard-excludes a romantic-flagged default bundle unless the relationship type is romantic', () => {
    const a = participant('a', { dialogueLines: [] })
    const b = participant('b', { dialogueLines: [] })
    const catalog = [bundleFixture({ id: 'romantic-bundle', romantic: true, relationshipTypes: ['romantic'] })]

    const friendResult = buildAutoDialogueBundle({
      participants: [a, b],
      firstSpeakerId: 'a',
      relationshipType: 'friend',
      recentLineIdsByCharacter: {},
      now: NOON,
      random: fixedRandom(0),
      defaultBundleCatalog: catalog,
    })
    expect(friendResult).toBeNull()

    const romanticResult = buildAutoDialogueBundle({
      participants: [a, b],
      firstSpeakerId: 'a',
      relationshipType: 'romantic',
      recentLineIdsByCharacter: {},
      now: NOON,
      random: fixedRandom(0),
      defaultBundleCatalog: catalog,
    })
    expect(romanticResult).not.toBeNull()
  })

  it('gates a default bundle\'s category to its real-clock time window, same as a registered line would be', () => {
    const a = participant('a', { dialogueLines: [] })
    const b = participant('b', { dialogueLines: [] })
    const catalog = [bundleFixture({ id: 'morning-only', categoryId: 'morning-greeting' })]

    const noonResult = buildAutoDialogueBundle({
      participants: [a, b],
      firstSpeakerId: 'a',
      relationshipType: 'close',
      recentLineIdsByCharacter: {},
      now: NOON,
      random: fixedRandom(0),
      defaultBundleCatalog: catalog,
    })
    expect(noonResult).toBeNull()

    const morning = new Date(2026, 8, 19, 8, 0, 0).getTime()
    const morningResult = buildAutoDialogueBundle({
      participants: [a, b],
      firstSpeakerId: 'a',
      relationshipType: 'close',
      recentLineIdsByCharacter: {},
      now: morning,
      random: fixedRandom(0),
      defaultBundleCatalog: catalog,
    })
    expect(morningResult).not.toBeNull()
  })

  it('avoids a pair\'s recently-used bundle id when a fresh alternative exists', () => {
    const a = participant('a', { dialogueLines: [] })
    const b = participant('b', { dialogueLines: [] })
    const catalog = [bundleFixture({ id: 'seen-before' }), bundleFixture({ id: 'fresh-one' })]

    const bundle = buildAutoDialogueBundle({
      participants: [a, b],
      firstSpeakerId: 'a',
      relationshipType: 'close',
      recentLineIdsByCharacter: {},
      recentDefaultBundleIdsByPair: ['seen-before'],
      now: NOON,
      random: fixedRandom(0),
      defaultBundleCatalog: catalog,
    })
    expect(bundle!.usedDefaultBundleId).toBe('fresh-one')
  })

  it('still succeeds (repeats a bundle) when every eligible bundle was recently used, rather than skipping the conversation', () => {
    const a = participant('a', { dialogueLines: [] })
    const b = participant('b', { dialogueLines: [] })
    const catalog = [bundleFixture({ id: 'only-option' })]

    const bundle = buildAutoDialogueBundle({
      participants: [a, b],
      firstSpeakerId: 'a',
      relationshipType: 'close',
      recentLineIdsByCharacter: {},
      recentDefaultBundleIdsByPair: ['only-option'],
      now: NOON,
      random: fixedRandom(0),
      defaultBundleCatalog: catalog,
    })
    expect(bundle!.usedDefaultBundleId).toBe('only-option')
  })

  it('prefers a longer bundle when both speakers are talkative, and a shorter one when both are reticent', () => {
    const shortBundle = bundleFixture({
      id: 'short',
      turns: [{ speaker: 'first', emotion: 'neutral', tags: [], text: { formal: 'A', casual: 'a' } }],
    })
    const longBundle = bundleFixture({
      id: 'long',
      turns: [
        { speaker: 'first', emotion: 'neutral', tags: [], text: { formal: 'A', casual: 'a' } },
        { speaker: 'second', emotion: 'neutral', tags: [], text: { formal: 'B', casual: 'b' } },
        { speaker: 'first', emotion: 'neutral', tags: [], text: { formal: 'C', casual: 'c' } },
        { speaker: 'second', emotion: 'neutral', tags: [], text: { formal: 'D', casual: 'd' } },
      ],
    })

    const talkativeA = participant('a', { dialogueLines: [], personalityTags: ['talkative'] })
    const talkativeB = participant('b', { dialogueLines: [], personalityTags: ['talkative'] })
    // A roll that would land on the shorter bundle under equal weights (0.5 of 2) should land on the longer, up-weighted one instead.
    const talkativeResult = buildAutoDialogueBundle({
      participants: [talkativeA, talkativeB],
      firstSpeakerId: 'a',
      relationshipType: 'close',
      recentLineIdsByCharacter: {},
      now: NOON,
      random: fixedRandom(0.7),
      defaultBundleCatalog: [shortBundle, longBundle],
    })
    expect(talkativeResult!.usedDefaultBundleId).toBe('long')

    const reticentA = participant('a', { dialogueLines: [], personalityTags: ['reticent'] })
    const reticentB = participant('b', { dialogueLines: [], personalityTags: ['reticent'] })
    const reticentResult = buildAutoDialogueBundle({
      participants: [reticentA, reticentB],
      firstSpeakerId: 'a',
      relationshipType: 'close',
      recentLineIdsByCharacter: {},
      now: NOON,
      random: fixedRandom(0.7),
      defaultBundleCatalog: [shortBundle, longBundle],
    })
    expect(reticentResult!.usedDefaultBundleId).toBe('short')
  })

  it('returns null when even the default library has nothing eligible for the current relationship/time', () => {
    const a = participant('a', { dialogueLines: [] })
    const b = participant('b', { dialogueLines: [] })
    const bundle = buildAutoDialogueBundle({
      participants: [a, b],
      firstSpeakerId: 'a',
      relationshipType: 'close',
      recentLineIdsByCharacter: {},
      now: NOON,
      random: fixedRandom(0),
      defaultBundleCatalog: [],
    })
    expect(bundle).toBeNull()
  })
})
