import { describe, expect, it } from 'vitest'
import { initiateWeightFor, lineAffinityWeightFor } from './personalityTags'
import type { CharacterDialogueLine } from './types'

function line(overrides: Partial<CharacterDialogueLine> = {}): CharacterDialogueLine {
  return {
    id: '1',
    categoryId: 'casual-chat',
    situationNote: '',
    text: '안녕',
    emotion: 'neutral',
    tags: [],
    isFallback: false,
    ...overrides,
  }
}

describe('initiateWeightFor', () => {
  it('returns the neutral weight (1) when no tags are selected', () => {
    expect(initiateWeightFor([])).toBe(1)
  })

  it('raises the weight for sociable and energetic', () => {
    expect(initiateWeightFor(['sociable'])).toBeGreaterThan(1)
    expect(initiateWeightFor(['energetic'])).toBeGreaterThan(1)
  })

  it('lowers the weight for shy and introverted', () => {
    expect(initiateWeightFor(['shy'])).toBeLessThan(1)
    expect(initiateWeightFor(['introverted'])).toBeLessThan(1)
  })

  it('combines multiple tags additively rather than letting one dominate', () => {
    const sociableOnly = initiateWeightFor(['sociable'])
    const sociableAndShy = initiateWeightFor(['sociable', 'shy'])
    expect(sociableAndShy).toBeLessThan(sociableOnly)
    expect(sociableAndShy).toBeGreaterThan(initiateWeightFor(['shy']))
  })

  it('never goes to zero or negative even with many suppressing tags', () => {
    expect(initiateWeightFor(['shy', 'introverted', 'shy', 'introverted'])).toBeGreaterThan(0)
  })

  it('ignores unknown tag ids gracefully', () => {
    expect(initiateWeightFor(['not-a-real-tag'])).toBe(1)
  })
})

describe('lineAffinityWeightFor', () => {
  it('gives a base weight of 1 with no tags, so untagged characters still select lines normally', () => {
    expect(lineAffinityWeightFor([], line())).toBe(1)
  })

  it('boosts short lines for gruff characters', () => {
    const short = line({ text: '응' })
    const long = line({ text: '오늘 저녁에 뭐 먹을지 같이 정해볼까?' })
    expect(lineAffinityWeightFor(['gruff'], short)).toBeGreaterThan(lineAffinityWeightFor(['gruff'], long))
  })

  it('boosts teasing-category lines for playful characters', () => {
    const teasing = line({ categoryId: 'teasing' })
    const plain = line({ categoryId: 'casual-chat' })
    expect(lineAffinityWeightFor(['playful'], teasing)).toBeGreaterThan(lineAffinityWeightFor(['playful'], plain))
  })

  it('boosts lines tagged affectionate for affectionate characters', () => {
    const caring = line({ tags: ['다정'] })
    const plain = line()
    expect(lineAffinityWeightFor(['affectionate'], caring)).toBeGreaterThan(lineAffinityWeightFor(['affectionate'], plain))
  })
})
