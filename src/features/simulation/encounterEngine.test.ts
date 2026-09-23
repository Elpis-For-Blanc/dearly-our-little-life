import { describe, expect, it } from 'vitest'
import { detectEncounters } from './encounterEngine'
import { pairKey } from '../dialogue/pairKey'

describe('detectEncounters', () => {
  it('reports a new encounter when two characters are within range for the first time', () => {
    const { newlyEncountered, currentlyNear } = detectEncounters(
      [
        { id: 'a', position: { x: 0, y: 0 } },
        { id: 'b', position: { x: 10, y: 0 } },
      ],
      new Set(),
    )
    expect(newlyEncountered).toEqual([['a', 'b']])
    expect(currentlyNear.has(pairKey('a', 'b'))).toBe(true)
  })

  it('does not re-report the same pair on the next call while they remain near (no re-triggering every tick)', () => {
    const first = detectEncounters(
      [
        { id: 'a', position: { x: 0, y: 0 } },
        { id: 'b', position: { x: 10, y: 0 } },
      ],
      new Set(),
    )
    const second = detectEncounters(
      [
        { id: 'a', position: { x: 0, y: 0 } },
        { id: 'b', position: { x: 12, y: 0 } },
      ],
      first.currentlyNear,
    )
    expect(second.newlyEncountered).toEqual([])
  })

  it('reports a fresh encounter after the pair leaves range and comes back', () => {
    const near = detectEncounters(
      [
        { id: 'a', position: { x: 0, y: 0 } },
        { id: 'b', position: { x: 10, y: 0 } },
      ],
      new Set(),
    )
    const far = detectEncounters(
      [
        { id: 'a', position: { x: 0, y: 0 } },
        { id: 'b', position: { x: 500, y: 0 } },
      ],
      near.currentlyNear,
    )
    expect(far.currentlyNear.size).toBe(0)

    const backAgain = detectEncounters(
      [
        { id: 'a', position: { x: 0, y: 0 } },
        { id: 'b', position: { x: 10, y: 0 } },
      ],
      far.currentlyNear,
    )
    expect(backAgain.newlyEncountered).toEqual([['a', 'b']])
  })

  it('does not report characters that are far apart', () => {
    const { newlyEncountered } = detectEncounters(
      [
        { id: 'a', position: { x: 0, y: 0 } },
        { id: 'b', position: { x: 1000, y: 0 } },
      ],
      new Set(),
    )
    expect(newlyEncountered).toEqual([])
  })

  it('tracks every pair independently among more than two characters', () => {
    const { newlyEncountered } = detectEncounters(
      [
        { id: 'a', position: { x: 0, y: 0 } },
        { id: 'b', position: { x: 10, y: 0 } },
        { id: 'c', position: { x: 1000, y: 0 } },
        { id: 'd', position: { x: 1005, y: 0 } },
      ],
      new Set(),
    )
    const pairs = newlyEncountered.map(([x, y]) => pairKey(x, y)).sort()
    expect(pairs).toEqual([pairKey('a', 'b'), pairKey('c', 'd')].sort())
  })
})
