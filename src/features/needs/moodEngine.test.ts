import { describe, expect, it } from 'vitest'
import { deriveMood, MOOD_LABELS } from './moodEngine'

const GOOD = { hunger: 90, energy: 90, fun: 90, social: 90 }

describe('moodEngine: deriveMood', () => {
  it('energy가 매우 낮으면 tired', () => {
    expect(deriveMood({ ...GOOD, energy: 10 })).toBe('tired')
  })

  it('hunger가 매우 낮으면 hungry', () => {
    expect(deriveMood({ ...GOOD, hunger: 10 })).toBe('hungry')
  })

  it('fun이 매우 낮으면 bored', () => {
    expect(deriveMood({ ...GOOD, fun: 10 })).toBe('bored')
  })

  it('social이 매우 낮으면 lonely', () => {
    expect(deriveMood({ ...GOOD, social: 10 })).toBe('lonely')
  })

  it('전체 상태가 좋으면 happy', () => {
    expect(deriveMood(GOOD)).toBe('happy')
  })

  it('전체 상태가 중간이면 neutral', () => {
    expect(deriveMood({ hunger: 50, energy: 50, fun: 50, social: 50 })).toBe('neutral')
  })

  it('여러 욕구가 동시에 매우 낮으면 hunger > energy > social > fun 순으로 우선한다 (명시적 우선순위)', () => {
    expect(deriveMood({ hunger: 10, energy: 10, fun: 10, social: 10 })).toBe('hungry')
    expect(deriveMood({ hunger: 90, energy: 10, fun: 10, social: 10 })).toBe('tired')
    expect(deriveMood({ hunger: 90, energy: 90, fun: 10, social: 10 })).toBe('lonely')
    expect(deriveMood({ hunger: 90, energy: 90, fun: 10, social: 90 })).toBe('bored')
  })

  it('경계값(정확히 threshold)도 "매우 낮음"으로 취급한다', () => {
    expect(deriveMood({ ...GOOD, hunger: 25 })).toBe('hungry')
  })

  it('여섯 가지 mood 모두 표시용 라벨을 갖는다', () => {
    for (const mood of ['happy', 'neutral', 'tired', 'hungry', 'bored', 'lonely'] as const) {
      expect(MOOD_LABELS[mood]).toBeTruthy()
    }
  })
})
