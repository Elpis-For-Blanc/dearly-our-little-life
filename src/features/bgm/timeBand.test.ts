import { describe, expect, it } from 'vitest'
import { getTimeBand } from './timeBand'

describe('getTimeBand', () => {
  it('classifies the morning band (05:00-10:59)', () => {
    expect(getTimeBand(5)).toBe('morning')
    expect(getTimeBand(7)).toBe('morning')
    expect(getTimeBand(10)).toBe('morning')
  })

  it('classifies the daytime band (11:00-16:59)', () => {
    expect(getTimeBand(11)).toBe('daytime')
    expect(getTimeBand(13)).toBe('daytime')
    expect(getTimeBand(16)).toBe('daytime')
  })

  it('classifies the evening band (17:00-20:59)', () => {
    expect(getTimeBand(17)).toBe('evening')
    expect(getTimeBand(19)).toBe('evening')
    expect(getTimeBand(20)).toBe('evening')
  })

  it('classifies the night band (21:00-04:59), including both sides of the midnight boundary', () => {
    expect(getTimeBand(21)).toBe('night')
    expect(getTimeBand(23)).toBe('night')
    expect(getTimeBand(0)).toBe('night') // midnight itself
    expect(getTimeBand(4)).toBe('night')
  })

  it('has no gap or overlap across the full 0-23 hour range', () => {
    for (let hour = 0; hour <= 23; hour++) {
      const band = getTimeBand(hour)
      expect(['morning', 'daytime', 'evening', 'night']).toContain(band)
    }
  })

  it('handles exactly the two boundary transitions (10->11, 23->0) correctly', () => {
    expect(getTimeBand(10)).toBe('morning')
    expect(getTimeBand(11)).toBe('daytime')
    expect(getTimeBand(23)).toBe('night')
    expect(getTimeBand(0)).toBe('night')
  })
})
