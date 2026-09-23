import { describe, expect, it } from 'vitest'
import { clampDisplayScale, clampFootOffsetRatio, computeCharacterDisplayGeometry } from './characterDisplay'
import type { CharacterImageBounds } from './characterImageAnalysis'

const BASE_HEIGHT = 120

describe('computeCharacterDisplayGeometry', () => {
  it('with no detected bounds, reduces exactly to the pre-analysis behavior (full image = character)', () => {
    const geometry = computeCharacterDisplayGeometry(BASE_HEIGHT, 1, 0, null)
    expect(geometry.renderedImageHeightUnits).toBe(BASE_HEIGHT)
    expect(geometry.footOffsetUnits).toBe(0)
    expect(geometry.bubbleOffsetUnits).toBe(-BASE_HEIGHT)
  })

  it('scales the rendered height up when the character occupies only part of the image (auto real-size correction)', () => {
    // Character body is the middle 50% of the image's height (25% padding top and bottom).
    const bounds: CharacterImageBounds = { topRatio: 0.25, bottomRatio: 0.75, leftRatio: 0.25, rightRatio: 0.75 }
    const geometry = computeCharacterDisplayGeometry(BASE_HEIGHT, 1, 0, bounds)
    // To make the 50%-tall body render at BASE_HEIGHT, the full image must render at 2x that.
    expect(geometry.renderedImageHeightUnits).toBeCloseTo(BASE_HEIGHT * 2, 5)
  })

  it('auto-corrects for padding below the feet, pushing the sprite down so the real feet meet the ground point', () => {
    // No padding above (topRatio 0), but 20% padding below the feet (bottomRatio 0.8).
    const bounds: CharacterImageBounds = { topRatio: 0, bottomRatio: 0.8, leftRatio: 0, rightRatio: 1 }
    const geometry = computeCharacterDisplayGeometry(BASE_HEIGHT, 1, 0, bounds)
    // renderedImageHeightUnits = BASE_HEIGHT / 0.8
    const expectedRendered = BASE_HEIGHT / 0.8
    expect(geometry.renderedImageHeightUnits).toBeCloseTo(expectedRendered, 5)
    // auto offset = renderedHeight * (1 - 0.8) — positive, pushes down.
    expect(geometry.footOffsetUnits).toBeCloseTo(expectedRendered * 0.2, 5)
    expect(geometry.footOffsetUnits).toBeGreaterThan(0)
  })

  it('applies no auto correction when the opaque region already touches the image bottom edge (bottomRatio 1)', () => {
    const bounds: CharacterImageBounds = { topRatio: 0.1, bottomRatio: 1, leftRatio: 0, rightRatio: 1 }
    const geometry = computeCharacterDisplayGeometry(BASE_HEIGHT, 1, 0, bounds)
    expect(geometry.footOffsetUnits).toBeCloseTo(0, 5)
  })

  it('combines the automatic correction additively with the manual footOffsetRatio, never replacing it', () => {
    const bounds: CharacterImageBounds = { topRatio: 0, bottomRatio: 0.8, leftRatio: 0, rightRatio: 1 }
    const withoutManual = computeCharacterDisplayGeometry(BASE_HEIGHT, 1, 0, bounds)
    const withManual = computeCharacterDisplayGeometry(BASE_HEIGHT, 1, 0.1, bounds)
    const expectedManualUnits = withManual.renderedImageHeightUnits * 0.1
    expect(withManual.footOffsetUnits).toBeCloseTo(withoutManual.footOffsetUnits + expectedManualUnits, 5)
  })

  it('a negative manual footOffsetRatio can partially or fully cancel the automatic correction', () => {
    const bounds: CharacterImageBounds = { topRatio: 0, bottomRatio: 0.8, leftRatio: 0, rightRatio: 1 }
    const geometry = computeCharacterDisplayGeometry(BASE_HEIGHT, 1, -0.2, bounds)
    expect(geometry.footOffsetUnits).toBeLessThan(computeCharacterDisplayGeometry(BASE_HEIGHT, 1, 0, bounds).footOffsetUnits)
  })

  it('scales proportionally with displayScale, keeping the ground point fixed regardless of size', () => {
    const bounds: CharacterImageBounds = { topRatio: 0, bottomRatio: 0.8, leftRatio: 0, rightRatio: 1 }
    const at1x = computeCharacterDisplayGeometry(BASE_HEIGHT, 1, 0, bounds)
    const at2x = computeCharacterDisplayGeometry(BASE_HEIGHT, 2, 0, bounds)
    expect(at2x.renderedImageHeightUnits).toBeCloseTo(at1x.renderedImageHeightUnits * 2, 5)
    expect(at2x.footOffsetUnits).toBeCloseTo(at1x.footOffsetUnits * 2, 5)
  })

  it('positions the speech bubble at the real drawn character\'s top edge, not the image file\'s own top edge', () => {
    const bounds: CharacterImageBounds = { topRatio: 0.3, bottomRatio: 0.8, leftRatio: 0, rightRatio: 1 }
    const geometry = computeCharacterDisplayGeometry(BASE_HEIGHT, 1, 0, bounds)
    const opaqueHeightUnits = geometry.renderedImageHeightUnits * (0.8 - 0.3)
    expect(geometry.bubbleOffsetUnits).toBeCloseTo(geometry.footOffsetUnits - opaqueHeightUnits, 5)
  })

  it('guards against an absurd blow-up from an implausibly thin detected bbox', () => {
    const bounds: CharacterImageBounds = { topRatio: 0.499, bottomRatio: 0.5, leftRatio: 0, rightRatio: 1 }
    const geometry = computeCharacterDisplayGeometry(BASE_HEIGHT, 1, 0, bounds)
    // Clamped, not BASE_HEIGHT / 0.001 (a 120,000-unit sprite).
    expect(geometry.renderedImageHeightUnits).toBeLessThan(BASE_HEIGHT * 30)
  })
})

describe('clampDisplayScale / clampFootOffsetRatio (regression — unrelated to imageBounds)', () => {
  it('still clamp to their existing ranges', () => {
    expect(clampDisplayScale(10)).toBe(2)
    expect(clampFootOffsetRatio(10)).toBe(0.3)
  })
})
