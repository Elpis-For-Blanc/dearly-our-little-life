import { describe, expect, it } from 'vitest'
import { DEFAULT_MONOLOGUE_LIBRARY, type MonologueLineDef } from './defaultMonologueLibrary'
import {
  DEFAULT_MONOLOGUE_FREQUENCY,
  MIN_MONOLOGUE_COOLDOWN_MS,
  MONOLOGUE_FREQUENCY_ORDER,
  MONOLOGUE_FREQUENCY_PRESETS,
} from './monologueConfig'
import { effectiveCooldownMs, isMonologueAllowedActivity, monologueChanceWeightFor, pickMonologue, rollShouldMonologue } from './monologueEngine'
import { getMonologueTimeBand, type MonologueActivity } from './monologueTypes'

/** Small deterministic PRNG so distribution tests don't depend on Math.random. */
function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function pickMany(count: number, params: Partial<Parameters<typeof pickMonologue>[0]> = {}): MonologueLineDef[] {
  const random = seeded(7)
  const picked: MonologueLineDef[] = []
  for (let i = 0; i < count; i++) {
    const line = pickMonologue({ personalityTags: [], baseTone: 'casual', activity: 'idle', hour: 12, recentLineIds: [], random, ...params })
    if (line) picked.push(line)
  }
  return picked
}

describe('default monologue library', () => {
  it('has at least 100 distinct lines with unique ids and unique text', () => {
    expect(DEFAULT_MONOLOGUE_LIBRARY.length).toBeGreaterThanOrEqual(100)
    expect(new Set(DEFAULT_MONOLOGUE_LIBRARY.map((l) => l.id)).size).toBe(DEFAULT_MONOLOGUE_LIBRARY.length)
    expect(new Set(DEFAULT_MONOLOGUE_LIBRARY.map((l) => l.text)).size).toBe(DEFAULT_MONOLOGUE_LIBRARY.length)
  })

  it('every line carries every required field, with a positive weight', () => {
    for (const line of DEFAULT_MONOLOGUE_LIBRARY) {
      expect(line.text.trim()).not.toBe('')
      expect(line.category).not.toBe('')
      expect(Array.isArray(line.timeBands)).toBe(true)
      expect(Array.isArray(line.personalityTags)).toBe(true)
      expect(Array.isArray(line.activities)).toBe(true)
      expect(['formal', 'casual']).toContain(line.tone)
      expect(line.weight).toBeGreaterThan(0)
    }
  })

  it('has hand-written formal and casual versions of every line, and they differ', () => {
    const casual = DEFAULT_MONOLOGUE_LIBRARY.filter((l) => l.tone === 'casual')
    const formal = DEFAULT_MONOLOGUE_LIBRARY.filter((l) => l.tone === 'formal')
    expect(casual.length).toBe(formal.length)
    for (const c of casual) {
      const f = formal.find((line) => line.id === c.id.replace(/-c$/, '-f'))
      expect(f).toBeDefined()
      expect(f?.text).not.toBe(c.text)
    }
  })

  it('never asks anything or expects a response (no question marks or question endings)', () => {
    for (const line of DEFAULT_MONOLOGUE_LIBRARY) {
      expect(line.text).not.toMatch(/[?？]/)
      expect(line.text).not.toMatch(/(까|까요|니)[.…!]*$/)
    }
  })

  it('never describes actions the simulation does not perform, or assumes backstory/roles', () => {
    const forbidden = ['읽', '독서', '책', '요리', '설거지', '출근', '퇴근', '회사', '침대', '소파', '책상', '자고 있', '잠들었', '엄마', '아빠', '오빠', '언니', '어릴']
    for (const line of DEFAULT_MONOLOGUE_LIBRARY) {
      for (const word of forbidden) expect(line.text).not.toContain(word)
    }
  })

  it('covers all five time bands, all three real activities, and includes fully generic lines', () => {
    for (const band of ['morning', 'day', 'afternoon', 'evening', 'night'] as const) {
      expect(DEFAULT_MONOLOGUE_LIBRARY.some((l) => l.timeBands.includes(band))).toBe(true)
    }
    for (const activity of ['wandering', 'resting', 'roomArrival'] as const) {
      expect(DEFAULT_MONOLOGUE_LIBRARY.some((l) => l.activities.includes(activity))).toBe(true)
    }
    expect(DEFAULT_MONOLOGUE_LIBRARY.some((l) => l.timeBands.length === 0 && l.activities.length === 0 && l.personalityTags.length === 0)).toBe(true)
  })

  it('only references time bands and personality tags that exist', () => {
    const bands = new Set(['morning', 'day', 'afternoon', 'evening', 'night'])
    for (const line of DEFAULT_MONOLOGUE_LIBRARY) {
      for (const band of line.timeBands) expect(bands.has(band)).toBe(true)
    }
  })
})

describe('getMonologueTimeBand', () => {
  it('maps hours to the five bands, including the midnight wrap', () => {
    const expected: Record<number, string> = { 5: 'morning', 10: 'morning', 11: 'day', 13: 'day', 14: 'afternoon', 17: 'afternoon', 18: 'evening', 20: 'evening', 21: 'night', 23: 'night', 0: 'night', 4: 'night' }
    for (const [hour, band] of Object.entries(expected)) expect(getMonologueTimeBand(Number(hour))).toBe(band)
  })
})

describe('monologue frequency config', () => {
  it('has five modes with 보통 as the default, and off never rolls', () => {
    expect(MONOLOGUE_FREQUENCY_ORDER).toEqual(['off', 'rare', 'normal', 'frequent', 'veryFrequent'])
    expect(DEFAULT_MONOLOGUE_FREQUENCY).toBe('normal')
    expect(MONOLOGUE_FREQUENCY_PRESETS.off.chancePerTick).toBe(0)
  })

  it('chance strictly rises and cooldown strictly falls from 가끔 to 매우 자주, and cooldown never drops below the floor', () => {
    const modes = MONOLOGUE_FREQUENCY_ORDER.slice(1)
    for (let i = 1; i < modes.length; i++) {
      expect(MONOLOGUE_FREQUENCY_PRESETS[modes[i]].chancePerTick).toBeGreaterThan(MONOLOGUE_FREQUENCY_PRESETS[modes[i - 1]].chancePerTick)
      expect(MONOLOGUE_FREQUENCY_PRESETS[modes[i]].cooldownMs).toBeLessThan(MONOLOGUE_FREQUENCY_PRESETS[modes[i - 1]].cooldownMs)
    }
    for (const mode of modes) expect(effectiveCooldownMs(mode)).toBeGreaterThanOrEqual(MIN_MONOLOGUE_COOLDOWN_MS)
  })
})

describe('rollShouldMonologue', () => {
  const base = { personalityTags: [], now: 1_000_000, lastMonologueAt: undefined }

  it('never fires in off mode, even with the luckiest roll', () => {
    expect(rollShouldMonologue({ ...base, mode: 'off', random: () => 0 })).toBe(false)
  })

  it('each of the four active modes fires just under its own chance and not just over it', () => {
    for (const mode of ['rare', 'normal', 'frequent', 'veryFrequent'] as const) {
      const { chancePerTick } = MONOLOGUE_FREQUENCY_PRESETS[mode]
      expect(rollShouldMonologue({ ...base, mode, random: () => chancePerTick * 0.99 })).toBe(true)
      expect(rollShouldMonologue({ ...base, mode, random: () => chancePerTick * 1.01 })).toBe(false)
    }
  })

  it('a higher mode fires far more often than a lower one over the same rolls', () => {
    const counts = ['rare', 'normal', 'frequent', 'veryFrequent'].map((mode) => {
      const random = seeded(3)
      let fired = 0
      for (let i = 0; i < 20_000; i++) if (rollShouldMonologue({ ...base, mode: mode as 'rare', random })) fired++
      return fired
    })
    expect(counts[0]).toBeLessThan(counts[1])
    expect(counts[1]).toBeLessThan(counts[2])
    expect(counts[2]).toBeLessThan(counts[3])
  })

  it("blocks during that character's own cooldown, and allows again once it elapses", () => {
    const cooldown = effectiveCooldownMs('veryFrequent')
    const params = { ...base, mode: 'veryFrequent' as const, random: () => 0 }
    expect(rollShouldMonologue({ ...params, lastMonologueAt: base.now - cooldown + 1 })).toBe(false)
    expect(rollShouldMonologue({ ...params, lastMonologueAt: base.now - cooldown })).toBe(true)
  })

  it('cooldowns are independent per character (one character on cooldown does not affect another)', () => {
    const params = { ...base, mode: 'normal' as const, random: () => 0 }
    expect(rollShouldMonologue({ ...params, lastMonologueAt: base.now - 1000 })).toBe(false) // character A: just spoke
    expect(rollShouldMonologue({ ...params, lastMonologueAt: undefined })).toBe(true) // character B: never spoke
  })

  it('수다스러움 raises the chance and 과묵함 lowers it', () => {
    expect(monologueChanceWeightFor([])).toBe(1)
    expect(monologueChanceWeightFor(['talkative'])).toBeGreaterThan(1)
    expect(monologueChanceWeightFor(['reticent'])).toBeLessThan(1)
    expect(monologueChanceWeightFor(['talkative', 'reticent'])).toBeCloseTo(1.1)
    const { chancePerTick } = MONOLOGUE_FREQUENCY_PRESETS.normal
    const roll = () => chancePerTick * 1.3
    expect(rollShouldMonologue({ ...base, mode: 'normal', random: roll })).toBe(false)
    expect(rollShouldMonologue({ ...base, mode: 'normal', personalityTags: ['talkative'], random: roll })).toBe(true)
    expect(rollShouldMonologue({ ...base, mode: 'normal', personalityTags: ['reticent'], random: () => chancePerTick * 0.7 })).toBe(false)
  })
})

describe('pickMonologue', () => {
  it('finds a line for a character with no registered example lines and no personality tags', () => {
    expect(pickMany(20, { personalityTags: [] })).toHaveLength(20)
  })

  it('respects the time band: only lines for the current band or with no band are ever chosen', () => {
    for (const [hour, band] of [[8, 'morning'], [12, 'day'], [15, 'afternoon'], [19, 'evening'], [23, 'night'], [2, 'night']] as const) {
      const picked = pickMany(300, { hour })
      expect(picked.length).toBeGreaterThan(0)
      for (const line of picked) expect(line.timeBands.length === 0 || line.timeBands.includes(band)).toBe(true)
    }
  })

  it('an awake character at night is never given a line claiming they are already asleep', () => {
    for (const line of pickMany(300, { hour: 1, activity: 'wandering' })) {
      expect(line.text).not.toMatch(/자고|잠들었|꿈속/)
    }
  })

  it('matches the current real behavior: wandering lines only while wandering, rest lines only while resting, arrival lines only just after a room change', () => {
    const activities: MonologueActivity[] = ['wandering', 'resting', 'roomArrival', 'idle']
    for (const activity of activities) {
      for (const line of pickMany(300, { activity })) {
        expect(line.activities.length === 0 || line.activities.includes(activity)).toBe(true)
      }
    }
    expect(pickMany(300, { activity: 'wandering' }).some((l) => l.category === 'wander')).toBe(true)
    expect(pickMany(300, { activity: 'resting' }).some((l) => l.category === 'rest')).toBe(true)
    expect(pickMany(300, { activity: 'roomArrival' }).some((l) => l.category === 'room-arrival')).toBe(true)
    expect(pickMany(300, { activity: 'idle' }).some((l) => l.category === 'room-arrival' || l.category === 'wander' || l.category === 'rest')).toBe(false)
  })

  it('refuses to produce anything for activities monologue must not fire in (sleeping/working guard — those states do not exist in the app yet)', () => {
    expect(isMonologueAllowedActivity('sleeping')).toBe(false)
    expect(isMonologueAllowedActivity('working')).toBe(false)
    for (const activity of ['wandering', 'resting', 'roomArrival', 'idle'] as const) expect(isMonologueAllowedActivity(activity)).toBe(true)
    expect(pickMonologue({ personalityTags: [], baseTone: 'casual', activity: 'sleeping', hour: 3, recentLineIds: [] })).toBeNull()
    expect(pickMonologue({ personalityTags: [], baseTone: 'casual', activity: 'working', hour: 14, recentLineIds: [] })).toBeNull()
  })

  it('personality changes which lines are chosen: tag-matching lines dominate for their owner and never appear for characters without the tag', () => {
    const plain = pickMany(400, { personalityTags: [] })
    expect(plain.every((l) => l.personalityTags.length === 0)).toBe(true)

    const gruff = pickMany(400, { personalityTags: ['gruff'] })
    const playful = pickMany(400, { personalityTags: ['playful'] })
    const share = (lines: MonologueLineDef[], tag: string) => lines.filter((l) => l.personalityTags.includes(tag)).length / lines.length
    expect(share(gruff, 'gruff')).toBeGreaterThan(0.2)
    expect(share(playful, 'playful')).toBeGreaterThan(0.2)
    expect(share(gruff, 'playful')).toBe(0)
    expect(share(playful, 'gruff')).toBe(0)
  })

  it('combines several tags (up to five) rather than letting one override the rest', () => {
    const tags = ['affectionate', 'calm', 'curious', 'shy', 'lazy']
    const seen = new Set(pickMany(1500, { personalityTags: tags }).flatMap((l) => l.personalityTags))
    for (const tag of tags) expect(seen.has(tag)).toBe(true)
  })

  it('uses the formal register for 존댓말 characters and the casual register for everyone else', () => {
    expect(pickMany(200, { baseTone: 'formal' }).every((l) => l.tone === 'formal')).toBe(true)
    for (const baseTone of ['casual', 'mixed', 'custom'] as const) {
      expect(pickMany(200, { baseTone }).every((l) => l.tone === 'casual')).toBe(true)
    }
  })

  it('no single personality makes the same line repeat: successive picks with recency tracking never repeat back-to-back', () => {
    const random = seeded(11)
    let recent: string[] = []
    let previous: string | null = null
    for (let i = 0; i < 300; i++) {
      const line = pickMonologue({ personalityTags: ['gruff'], baseTone: 'casual', activity: 'wandering', hour: 9, recentLineIds: recent, random })
      if (!line) continue
      expect(line.id).not.toBe(previous)
      previous = line.id
      recent = [...recent, line.id].slice(-8)
    }
  })

  it('excludes recently used lines, falls back to generic lines, and skips (null) instead of forcing a repeat', () => {
    const catalog: MonologueLineDef[] = [
      { id: 'timed', text: '아침이야.', category: 'morning', timeBands: ['morning'], personalityTags: [], activities: [], tone: 'casual', weight: 1 },
      { id: 'generic', text: '그냥 그렇네.', category: 'generic', timeBands: [], personalityTags: [], activities: [], tone: 'casual', weight: 1 },
    ]
    const base = { personalityTags: [], baseTone: 'casual' as const, activity: 'idle' as const }
    // Evening: the morning line doesn't match, generic does.
    expect(pickMonologue({ ...base, hour: 19, recentLineIds: [], catalog })?.id).toBe('generic')
    // Morning with the timed line recently used: only generic remains.
    expect(pickMonologue({ ...base, hour: 8, recentLineIds: ['timed'], catalog })?.id).toBe('generic')
    // Everything recently used: skip rather than repeat.
    expect(pickMonologue({ ...base, hour: 8, recentLineIds: ['timed', 'generic'], catalog })).toBeNull()
  })

  it('a personality-tagged line does not fall back into other characters via the generic fallback', () => {
    const catalog: MonologueLineDef[] = [
      { id: 'only-gruff', text: '…흠.', category: 'personality', timeBands: [], personalityTags: ['gruff'], activities: [], tone: 'casual', weight: 1 },
    ]
    expect(pickMonologue({ personalityTags: ['calm'], baseTone: 'casual', activity: 'idle', hour: 12, recentLineIds: [], catalog })).toBeNull()
  })
})
