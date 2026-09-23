/**
 * The opaque-pixel bounding box of an uploaded character PNG, as fractions
 * (0-1) of the ORIGINAL image's own width/height — never a pixel count, so
 * it stays meaningful no matter how the image is later scaled for display.
 * `null` (on `Character.imageBounds`) means "never analyzed, or analysis
 * failed" — every consumer must treat that as "no correction", i.e. behave
 * exactly like the image's own edges are the character's real edges (the
 * pre-analysis behavior), never crash or guess.
 */
export interface CharacterImageBounds {
  topRatio: number
  bottomRatio: number
  leftRatio: number
  rightRatio: number
}

/**
 * Alpha values at/below this (out of 255) are treated as "not part of the
 * character" — filters out both fully-transparent padding and the
 * near-transparent anti-aliased fringe a real PNG export leaves around its
 * opaque pixels, so that fringe doesn't get misread as part of the
 * character's real edge.
 */
export const ALPHA_THRESHOLD = 24

/** A bbox this small a fraction of the image is almost certainly a mis-detection (e.g. a stray watermark pixel), not a genuine tiny character — treated the same as "nothing detected". */
const MIN_DETECTABLE_FRACTION = 0.01

interface RawImageData {
  data: Uint8ClampedArray | number[]
  width: number
  height: number
}

/**
 * Pure pixel-scanning core — deliberately separated from the
 * browser-only `<canvas>`/`Image` glue below so it can be unit-tested with
 * synthetic pixel data (jsdom has no real `<canvas>` 2D pixel backend to
 * exercise the real thing against). Returns `null` if no pixel clears the
 * alpha threshold, or if the detected region is implausibly small relative
 * to the full image (see `MIN_DETECTABLE_FRACTION`) — both treated as "we
 * couldn't tell", not "the character occupies zero space".
 */
export function computeOpaqueBounds(image: RawImageData, alphaThreshold: number = ALPHA_THRESHOLD): CharacterImageBounds | null {
  const { data, width, height } = image
  if (width <= 0 || height <= 0) return null

  let minX = width
  let maxX = -1
  let minY = height
  let maxY = -1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3]
      if (alpha <= alphaThreshold) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }

  if (maxX < minX || maxY < minY) return null

  const bounds: CharacterImageBounds = {
    topRatio: minY / height,
    bottomRatio: (maxY + 1) / height,
    leftRatio: minX / width,
    rightRatio: (maxX + 1) / width,
  }

  const widthFraction = bounds.rightRatio - bounds.leftRatio
  const heightFraction = bounds.bottomRatio - bounds.topRatio
  if (widthFraction < MIN_DETECTABLE_FRACTION || heightFraction < MIN_DETECTABLE_FRACTION) return null

  return bounds
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('character image failed to load'))
    image.src = dataUrl
  })
}

/**
 * Analysis is capped to this many pixels on the longer side before
 * scanning — the opaque-region ratios this produces are the same
 * regardless of resolution, and downscaling first keeps a large phone-photo
 * upload from freezing the tab while scanning millions of pixels one by one.
 */
const MAX_ANALYSIS_DIMENSION = 256

/**
 * Browser-only glue: decodes the uploaded PNG into an offscreen `<canvas>`
 * (never mutating or re-saving the original file — this canvas exists only
 * in memory, for reading `getImageData` back out) and runs the alpha scan
 * above on it. Never throws — on any failure (a browser without canvas
 * pixel access, a corrupt file, decode timeout) resolves `null`, which
 * every caller already treats as "no correction available", per the
 * project's "안전한 기본 크기로 표시" requirement. Not unit-tested directly
 * (jsdom has no real canvas pixel backend to exercise this against) —
 * `computeOpaqueBounds` above carries the actual test coverage for the
 * scanning logic itself.
 */
export async function analyzeCharacterImageBounds(dataUrl: string): Promise<CharacterImageBounds | null> {
  try {
    const image = await loadImage(dataUrl)
    const naturalWidth = image.naturalWidth || image.width
    const naturalHeight = image.naturalHeight || image.height
    if (!naturalWidth || !naturalHeight) return null

    const scale = Math.min(1, MAX_ANALYSIS_DIMENSION / Math.max(naturalWidth, naturalHeight))
    const width = Math.max(1, Math.round(naturalWidth * scale))
    const height = Math.max(1, Math.round(naturalHeight * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(image, 0, 0, width, height)
    const imageData = ctx.getImageData(0, 0, width, height)
    return computeOpaqueBounds(imageData)
  } catch {
    return null
  }
}
