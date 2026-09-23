import { BASE_CHARACTER_HEIGHT, SHADOW_WIDTH_RATIO } from '../simulation/characterRenderConfig'
import { CHARACTER_RADIUS } from '../simulation/movementConfig'
import type { CharacterInteractionType } from './characterInteractionTypes'

/** How long the *held* ('active') phase of each interaction kind lasts, in ms, once both characters are actually in position. */
export const CHARACTER_INTERACTION_DURATION_MS: Record<CharacterInteractionType, number> = {
  stayTogether: 8_000,
  sitTogether: 10_000,
  hug: 3_000,
  holdHands: 5_000,
}

/**
 * Base weight (before any needs/mood bonus — see `characterInteractionEngine.ts`'s
 * `pickInteractionType`) when an idle character rolls which of the four
 * types to start. `hug`/`holdHands` are deliberately low, per the spec's own
 * "너무 자주 나오지 않도록 가중치 낮게 설정" for both.
 */
export const CHARACTER_INTERACTION_BASE_WEIGHT: Record<CharacterInteractionType, number> = {
  stayTogether: 1,
  sitTogether: 0.8,
  hug: 0.3,
  holdHands: 0.4,
}

/** Per-tick probability roll for an idle, eligible character to attempt starting *some* character interaction — same order of magnitude as `autoFurnitureUseConfig.ts`'s own `AUTO_FURNITURE_USE_CHANCE_PER_TICK`, since both are "occasionally, not constantly" idle-behavior candidates. */
export const CHARACTER_INTERACTION_CHANCE_PER_TICK = 0.0015

/** Per-*pair* cooldown after an interaction ends successfully — prevents "같은 두 캐릭터가 연속으로 계속 상호작용하는 현상", same order of magnitude as `autoFurnitureUseConfig.ts`'s own cooldown. */
export const CHARACTER_INTERACTION_COOLDOWN_MS = 90_000

/** A separate, shorter per-pair cooldown after a *failed* attempt (lost a seat race, partner became busy mid-approach, approach timed out) — same "don't hammer it again next tick" reasoning `autoFurnitureUseConfig.ts`'s own retry cooldown already established. */
export const CHARACTER_INTERACTION_RETRY_COOLDOWN_MS = 15_000

/**
 * How much each interaction kind restores of *both* participants' `social`
 * need, 0–100 scale, total across the whole `'active'` phase. Every kind but
 * `stayTogether` applies this as one lump sum the moment the interaction
 * ends naturally; `stayTogether` spreads it incrementally, tick by tick,
 * across the `'active'` phase instead — the one kind the spec explicitly
 * describes as recovering "interaction 동안 천천히" (during, not at the end).
 */
export const SOCIAL_RECOVERY: Record<CharacterInteractionType, number> = {
  stayTogether: 10,
  sitTogether: 14,
  hug: 20,
  holdHands: 16,
}

/**
 * Whether the two participants should end up oriented toward each other once
 * `'active'` begins. Stored as data on the session (see
 * `characterInteractionTypes.ts`'s `CharacterInteractionSession.facing`) and
 * genuinely computed/tested — but, like `FurnitureInteractionSlot.facing`
 * before it, **not yet wired to any visual rotation**: unlike furniture
 * (drawn in-house, known orientation, flippable via `scaleX(-1)`), a
 * character's uploaded art has no known "default facing side" this app could
 * read, so blindly mirroring it would face the *wrong* way as often as the
 * right one — worse than not flipping at all. This is the same, disclosed
 * "data captured, rendering deferred" pattern this project already uses for
 * furniture slots, not a forgotten TODO.
 */
export type FacingMode = 'faceEachOther' | 'none'

export interface FreeformInteractionDistanceConfig {
  /**
   * Center-to-center distance (room-logical units) the mover's walking
   * destination targets — where ordinary, collision-checked movement stops
   * walking. Always `<= finalDistance`, so arriving exactly on this point
   * already satisfies the "close enough" check below without a second,
   * separate closing-in step.
   */
  approachDistance: number
  /** Center-to-center distance at or under which the approach ends and the real interaction ('active' phase) begins. */
  finalDistance: number
  facingMode: FacingMode
}

/**
 * A character's real, on-screen footprint width — not the much smaller
 * `CHARACTER_RADIUS` (20), which is sized for *personal-space* collision
 * avoidance between unrelated characters, not for "how close do two sprites
 * need to stand to visually touch". Derived from the same
 * `characterRenderConfig.ts` values `CharacterToken.tsx` itself renders the
 * ground shadow at (`BASE_CHARACTER_HEIGHT * SHADOW_WIDTH_RATIO`), so this
 * stays in agreement with what a character actually looks like on screen
 * rather than a fresh, unrelated guess. Deliberately ignores any individual
 * character's own `displayScale` (0.5–2×) — collision/interaction-distance
 * math never reads it, the same "purely visual multiplier, never touches
 * collision math" rule `CharacterToken.tsx` already documents for
 * `displayScale` and `CHARACTER_RADIUS`.
 */
const CHARACTER_FOOTPRINT_WIDTH = BASE_CHARACTER_HEIGHT * SHADOW_WIDTH_RATIO

/**
 * Per-type approach/final distances, the fix for "캐릭터가 멀리 떨어진 채로
 * 상호작용이 시작되는 문제": previously every freeform kind shared one generic
 * `INTERACTION_CLOSE_DISTANCE` (48, comfortable "personal space" — fine for
 * `stayTogether`, but nowhere near close enough to read as an actual hug or
 * hand-hold once you account for how wide a character sprite really renders).
 *
 * - `stayTogether` keeps exactly its original value/behavior (unchanged, no
 *   visual regression) — "being nearby", not a physical embrace.
 * - `hug` targets *less* than `CHARACTER_RADIUS * 2` (40, the ordinary
 *   character-vs-character collision floor — see `movementConfig.ts`'s
 *   `MAX_STUCK_TICKS` doc) on purpose: two sprites visually embracing need to
 *   overlap a little, which ordinary collision avoidance would otherwise
 *   forever block. `characterInteractionTrigger.ts`'s approach step excludes
 *   the *specific* interaction partner (never third parties/furniture) from
 *   collision, exactly mirroring how a furniture seat's final placement
 *   already bypasses collision on purpose.
 * - `holdHands` stays just *above* that same 40-unit floor — side by side,
 *   arms' reach, no body overlap — so it never actually needs the collision
 *   exclusion above to be reachable, but shares the same mechanism for one
 *   consistent code path.
 */
export const FREEFORM_INTERACTION_DISTANCE: Record<'stayTogether' | 'hug' | 'holdHands', FreeformInteractionDistanceConfig> = {
  stayTogether: {
    approachDistance: CHARACTER_RADIUS * 2.4, // 48 — unchanged from the original single INTERACTION_CLOSE_DISTANCE
    finalDistance: CHARACTER_RADIUS * 2.4,
    facingMode: 'none',
  },
  hug: {
    approachDistance: Math.round(CHARACTER_FOOTPRINT_WIDTH * 0.62), // ~31
    finalDistance: Math.round(CHARACTER_FOOTPRINT_WIDTH * 0.68), // ~34 — sprites visibly overlap, reads as an embrace
    facingMode: 'faceEachOther',
  },
  holdHands: {
    approachDistance: Math.round(CHARACTER_FOOTPRINT_WIDTH * 0.92), // ~46
    finalDistance: Math.round(CHARACTER_FOOTPRINT_WIDTH * 1.0), // ~50 — arm's reach, side by side, no overlap
    facingMode: 'faceEachOther',
  },
}

/**
 * Consecutive movement ticks spent in the `'approaching'` phase (of a
 * non-furniture freeform interaction) before it gives up and cancels cleanly
 * — a plain per-tick counter incremented every tick the approach is still in
 * progress, not just while actively blocked by collision, mirroring
 * `movementConfig.ts`'s own `MAX_FURNITURE_APPROACH_TICKS` (a real overall
 * timeout, not only a "stuck" detector) so an unreachable partner — enclosed
 * by furniture with no way around it, since this project has no real
 * pathfinding — can never leave a character `'interacting'` forever.
 */
export const MAX_INTERACTION_APPROACH_TICKS = 80

/** How far (room-logical units) a partner must have actually moved since the mover's current destination was last computed before it's worth recomputing — a small, deliberate tolerance so a partner standing genuinely still (the normal case, since the partner is otherwise frozen for the whole interaction) never causes the mover's destination to be re-picked every single tick, which would read as visible jitter for no reason. */
export const APPROACH_TARGET_RECOMPUTE_EPSILON = 4
