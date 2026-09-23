import type { FurnitureStyle } from '../furnitureStyle'

export interface FurnitureIllustrationProps {
  width: number
  height: number
  colorway: string
  /** The placement's chosen shape (see `FurnitureVariant`); only pieces with variants read it. */
  variant?: string
  /** Per-part color overrides and surface patterns (see furnitureStyle.ts). Absent for anything uncustomized — the illustration then paints exactly its preset colorway. */
  style?: FurnitureStyle
}
