import type { TimeBand } from '../bgm/bgmConfig'
import { ROOM_LIGHTING_TINTS, type RoomLightingTint } from './roomLightingConfig'

export interface RoomLightingStyle {
  backgroundColor: string
  opacity: number
  mixBlendMode: RoomLightingTint['blendMode']
}

/**
 * Pure function: which real overlay style a given time band + user
 * intensity setting (0-100) resolves to. `intensityPercent` scales each
 * band's own `baseOpacity` linearly — 0% always means fully invisible
 * (opacity 0) regardless of band, 100% means exactly that band's authored
 * baseline. Clamped defensively so an out-of-range or non-finite intensity
 * (e.g. corrupt persisted data) can never produce a negative or >1 opacity.
 */
export function getRoomLightingStyle(band: TimeBand, intensityPercent: number): RoomLightingStyle {
  const tint = ROOM_LIGHTING_TINTS[band]
  const safeIntensity = Number.isFinite(intensityPercent) ? Math.min(100, Math.max(0, intensityPercent)) : 0
  return { backgroundColor: tint.color, opacity: tint.baseOpacity * (safeIntensity / 100), mixBlendMode: tint.blendMode }
}
