import { FLOOR_HEIGHT_RATIO, ROOM_HEIGHT } from '../home/roomLayout'

/** How often the movement tick loop advances every character's position. */
export const MOVEMENT_TICK_MS = 250

/** Logical room units a character covers per tick — chosen so crossing the room takes roughly 10-13s, since there's no existing movement-speed constant anywhere in the project to match against (checked first). */
export const MOVE_SPEED_PER_TICK = 14

/** A character's collision footprint, as a circle radius in room-logical units. */
export const CHARACTER_RADIUS = 20

/** Two characters this close (logical units) count as "encountered". A bit more than 2x CHARACTER_RADIUS so they visibly approach before it fires. */
export const ENCOUNTER_DISTANCE = 55

/** How many random points to try before giving up and falling back to the floor's center. */
export const MAX_DESTINATION_ATTEMPTS = 20

/** Top edge (in room-logical Y) of the walkable floor area — characters never wander into the wall band above it. */
export const FLOOR_TOP_Y = ROOM_HEIGHT * (1 - FLOOR_HEIGHT_RATIO)

/** How many movement ticks a "rest" behavior pause lasts (~2s at MOVEMENT_TICK_MS) before the character picks a new destination again. */
export const REST_TICKS = 8

/**
 * How many *consecutive* blocked ticks a character tolerates before forcing
 * its next step through regardless of collision. Exists because
 * CHARACTER_RADIUS*2 (40 units — the minimum separation two characters'
 * collision circles enforce) is larger than MOVE_SPEED_PER_TICK (14 units):
 * a character that starts a tick exactly on top of another (this happens in
 * practice — every room's doorway is the same fixed point, so two
 * characters can genuinely end up stacked there) can mathematically never
 * complete a single step away, since *any* reachable point within one
 * tick's move distance is still within the other's collision radius. Without
 * this escape valve that is a permanent deadlock, not a retry that
 * eventually succeeds. A brief visual overlap for one tick is far better
 * than a character frozen forever.
 */
export const MAX_STUCK_TICKS = 6

/**
 * How far outside a piece of furniture's own solid collision footprint a
 * character stops to use it — the point the ordinary movement engine walks
 * them to before "sitting down" (see furnitureInteractionEngine.ts). A small
 * margin beyond CHARACTER_RADIUS so the character doesn't end up exactly
 * grazing the furniture's edge.
 */
export const FURNITURE_APPROACH_CLEARANCE = CHARACTER_RADIUS + 6

/**
 * How many consecutive movement ticks a character may spend walking toward a
 * furniture-use approach point before the reservation is released and the
 * attempt treated as failed. Generous — crossing the whole room takes
 * roughly 50 ticks (see MOVE_SPEED_PER_TICK's comment) — since
 * MAX_STUCK_TICKS already forces a blocked character's step through after a
 * few ticks, so a genuinely reachable approach point is reached long before
 * this fires; this exists only as a last-resort safety net (see CLAUDE.md's
 * "가구 상호작용" section for why an unreachable point can never leave a
 * reservation dangling forever).
 */
export const MAX_FURNITURE_APPROACH_TICKS = 80
