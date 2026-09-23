import { ROOM_HEIGHT, ROOM_WIDTH } from './roomLayout'
import type { FloorSettings, WallpaperSettings } from './roomSurface'
import type { FurniturePlacement } from './types'

export type RoomKind = 'living' | 'bedroom' | 'kitchen' | 'study' | 'bathroom' | 'hobby' | 'free'

export const ROOM_KIND_LABELS: Record<RoomKind, string> = {
  living: '거실',
  bedroom: '침실',
  kitchen: '주방',
  study: '서재',
  bathroom: '욕실',
  hobby: '취미방',
  free: '자유 방',
}

export const ROOM_KIND_ORDER: RoomKind[] = ['living', 'bedroom', 'kitchen', 'study', 'bathroom', 'hobby', 'free']

export const MAX_ROOMS = 5

/**
 * A character's *required* path between rooms — deliberately separate data
 * from any decorative door a user might place as furniture later, so
 * decorating never risks breaking movement. There is currently no
 * decorative "door" furniture type in `furnitureCatalog.ts` at all, so
 * there's nothing to actually collide with yet, but this stays a distinct
 * concept on purpose.
 *
 * Every room gets exactly one, auto-created, not user-editable in this
 * version. All rooms are mutually reachable through it (a shared virtual
 * "hallway" — see CLAUDE.md for why no literal hallway screen exists).
 * `entryPosition`/`exitPosition` are the same point in this version; kept
 * as two fields because the spec calls for both.
 */
export interface Doorway {
  id: string
  roomId: string
  entryPosition: { x: number; y: number }
  exitPosition: { x: number; y: number }
  passable: boolean
}

export interface Room {
  id: string
  kind: RoomKind
  /** User-editable — independent of `kind`, which only seeds the default value and (not yet) an interior preset. */
  name: string
  wallpaper: WallpaperSettings
  floor: FloorSettings
  furniture: FurniturePlacement[]
  doorway: Doorway
}

/** Bottom-center of the floor — a plausible "toward the hallway" spot, and simple to reason about since every room shares the same logical ROOM_WIDTH/ROOM_HEIGHT. */
export function createDefaultDoorway(roomId: string): Doorway {
  const position = { x: ROOM_WIDTH / 2, y: ROOM_HEIGHT - 24 }
  return {
    id: crypto.randomUUID(),
    roomId,
    entryPosition: position,
    exitPosition: position,
    passable: true,
  }
}
