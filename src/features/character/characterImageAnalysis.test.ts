import { describe, expect, it } from 'vitest'
import { ALPHA_THRESHOLD, computeOpaqueBounds } from './characterImageAnalysis'

/** Builds a flat RGBA buffer for a `width`x`height` image, transparent everywhere except the given rect (inclusive bounds), which gets `alpha`. */
function makeImage(width: number, height: number, rect: { x0: number; y0: number; x1: number; y1: number; alpha: number } | null) {
  const data = new Uint8ClampedArray(width * height * 4)
  if (rect) {
    for (let y = rect.y0; y <= rect.y1; y++) {
      for (let x = rect.x0; x <= rect.x1; x++) {
        const i = (y * width + x) * 4
        data[i] = 255
        data[i + 1] = 255
        data[i + 2] = 255
        data[i + 3] = rect.alpha
      }
    }
  }
  return { data, width, height }
}

describe('computeOpaqueBounds', () => {
  it('detects an opaque region that fills almost the entire image (little/no padding)', () => {
    const image = makeImage(100, 100, { x0: 2, y0: 1, x1: 98, y1: 99, alpha: 255 })
    const bounds = computeOpaqueBounds(image)
    expect(bounds).not.toBeNull()
    expect(bounds!.topRatio).toBeCloseTo(0.01, 2)
    expect(bounds!.bottomRatio).toBeCloseTo(1, 2)
    expect(bounds!.leftRatio).toBeCloseTo(0.02, 2)
    expect(bounds!.rightRatio).toBeCloseTo(0.99, 2)
  })

  it('detects a small character drawn in the center of a much larger canvas (lots of padding)', () => {
    const image = makeImage(200, 200, { x0: 80, y0: 80, x1: 120, y1: 120, alpha: 255 })
    const bounds = computeOpaqueBounds(image)
    expect(bounds).not.toBeNull()
    expect(bounds!.topRatio).toBeCloseTo(0.4, 2)
    expect(bounds!.bottomRatio).toBeCloseTo(0.605, 2)
    expect(bounds!.leftRatio).toBeCloseTo(0.4, 2)
    expect(bounds!.rightRatio).toBeCloseTo(0.605, 2)
  })

  it('detects an off-center character (asymmetric padding on each side)', () => {
    const image = makeImage(100, 100, { x0: 60, y0: 10, x1: 90, y1: 95, alpha: 255 })
    const bounds = computeOpaqueBounds(image)
    expect(bounds).not.toBeNull()
    expect(bounds!.leftRatio).toBeCloseTo(0.6, 2)
    expect(bounds!.rightRatio).toBeCloseTo(0.91, 2)
    expect(bounds!.topRatio).toBeCloseTo(0.1, 2)
    expect(bounds!.bottomRatio).toBeCloseTo(0.96, 2)
  })

  it('handles a vertically tall (full-body) silhouette correctly', () => {
    const image = makeImage(50, 300, { x0: 10, y0: 5, x1: 40, y1: 295, alpha: 255 })
    const bounds = computeOpaqueBounds(image)
    expect(bounds!.bottomRatio - bounds!.topRatio).toBeGreaterThan(0.9)
  })

  it('handles a horizontally wide image correctly', () => {
    const image = makeImage(300, 60, { x0: 100, y0: 5, x1: 200, y1: 55, alpha: 255 })
    const bounds = computeOpaqueBounds(image)
    expect(bounds!.rightRatio - bounds!.leftRatio).toBeCloseTo((200 - 100 + 1) / 300, 2)
  })

  it('ignores a translucent/anti-aliased fringe at or below the alpha threshold', () => {
    // A solid 20x20 core, surrounded by a 1px fringe of alpha == ALPHA_THRESHOLD (must not count).
    const width = 40
    const height = 40
    const data = new Uint8ClampedArray(width * height * 4)
    for (let y = 9; y <= 30; y++) {
      for (let x = 9; x <= 30; x++) {
        const i = (y * width + x) * 4
        data[i + 3] = y === 9 || y === 30 || x === 9 || x === 30 ? ALPHA_THRESHOLD : 255
      }
    }
    const bounds = computeOpaqueBounds({ data, width, height })
    // The fringe ring (alpha exactly at threshold, filtered by `<=`) must not widen the detected box.
    expect(bounds!.topRatio).toBeCloseTo(10 / height, 2)
    expect(bounds!.bottomRatio).toBeCloseTo(30 / height, 2)
  })

  it('returns null for a fully transparent image', () => {
    const image = makeImage(50, 50, null)
    expect(computeOpaqueBounds(image)).toBeNull()
  })

  it('returns null for an implausibly tiny detected region (likely a stray pixel, not a real character)', () => {
    const image = makeImage(1000, 1000, { x0: 500, y0: 500, x1: 501, y1: 501, alpha: 255 })
    expect(computeOpaqueBounds(image)).toBeNull()
  })

  it('returns null for a zero-size image', () => {
    expect(computeOpaqueBounds({ data: new Uint8ClampedArray(0), width: 0, height: 0 })).toBeNull()
  })

  it('respects a custom alpha threshold', () => {
    const image = makeImage(50, 50, { x0: 10, y0: 10, x1: 40, y1: 40, alpha: 50 })
    expect(computeOpaqueBounds(image, 60)).toBeNull() // below the stricter threshold
    expect(computeOpaqueBounds(image, 40)).not.toBeNull() // above the looser threshold
  })
})
