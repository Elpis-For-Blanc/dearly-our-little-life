/**
 * The room is rendered at a fixed logical resolution, then scaled to fit
 * whatever width it's actually given (via CSS aspect-ratio + percentage
 * layout, not pixels). Furniture x/y are stored in this logical space, so a
 * saved layout looks the same on any screen size instead of drifting with
 * the viewport.
 */
export const ROOM_WIDTH = 720
export const ROOM_HEIGHT = 440
/** Fraction of the room's height the floor occupies, from the bottom — shared by Room.css and FloorSurface.tsx so they can never drift apart. */
export const FLOOR_HEIGHT_RATIO = 0.38

export function clampToRoom(x: number, y: number, effectiveWidth: number, effectiveHeight: number) {
  const halfW = effectiveWidth / 2
  const halfH = effectiveHeight / 2

  return {
    x: Math.min(Math.max(x, halfW), ROOM_WIDTH - halfW),
    y: Math.min(Math.max(y, halfH), ROOM_HEIGHT - halfH),
  }
}
