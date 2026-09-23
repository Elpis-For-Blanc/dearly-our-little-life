/**
 * Config for automatic (no-user-command) furniture use — a character
 * occasionally walks to a free sofa/chair/bed/table slot on its own, uses it
 * for a while, then returns to normal wandering. Values are calibrated
 * against the project's existing per-tick auto-behaviors — MOVEMENT_TICK_MS
 * (movementConfig.ts) = 250ms, monologueConfig.ts's per-tick-roll pattern,
 * autoDialogueConfig.ts's per-pair cooldown pattern — rather than invented
 * from scratch. See each constant's own comment for the specific precedent
 * it's based on. Both the "자동 가구 사용" toggle (LiveScreen.tsx) and the
 * trigger (autoFurnitureUseTrigger.ts) read only from here.
 */

/**
 * Probability [0, 1] that an *eligible* character (see
 * autoFurnitureUseTrigger.ts's start conditions) begins auto furniture use
 * on any single movement tick. Rolled per tick, exactly like
 * monologueConfig.ts's `chancePerTick` — reuses the one existing simulation
 * tick, no timer of its own. Set equal to monologueConfig.ts's 'rare' preset
 * (0.0015): auto furniture use is a bigger, more visually committing action
 * (a real walk across the room plus a multi-second hold) than a monologue
 * bubble, so it should start out at least as conservative as monologue's
 * most infrequent tier, not its 'normal' one — per the spec's own "시작은
 * 보수적으로" instruction.
 */
export const AUTO_FURNITURE_USE_CHANCE_PER_TICK = 0.0015

/**
 * Minimum real time (ms) after one of a character's auto furniture uses
 * *successfully ends* (it actually got seated/lying/lingering for a while)
 * before it may start another. Higher than autoDialogueConfig.ts's 'normal'
 * pair cooldown (60_000) and monologueConfig.ts's 'normal' cooldown
 * (45_000) on purpose — sitting down and holding there is a much more
 * visible, room-crossing commitment than a line of dialogue or a monologue
 * bubble, so repeating it needs a longer rest. Independent per character.
 */
export const AUTO_FURNITURE_USE_COOLDOWN_MS = 90_000

/**
 * A *separate*, shorter cooldown after a *failed* attempt (lost a same-tick
 * reservation race to another auto or manual use, or never reached the
 * furniture before MAX_FURNITURE_APPROACH_TICKS expired) — short enough
 * that one bad attempt doesn't exclude a character from auto behavior for
 * as long as a real success would, but still long enough that a failure
 * can't retry every single tick.
 */
export const AUTO_FURNITURE_USE_RETRY_COOLDOWN_MS = 15_000

/**
 * How long (ms) a character stays seated/lying/lingering once it actually
 * arrives, before standing back up on its own — a real hold, not a blink,
 * so it never reads as "a short repetitive loop" (per the spec). Randomized
 * within this range per session (see autoFurnitureUseEngine.ts's
 * `pickHoldDurationMs`) so sessions don't all look identically timed.
 */
export const AUTO_FURNITURE_USE_MIN_HOLD_MS = 20_000
export const AUTO_FURNITURE_USE_MAX_HOLD_MS = 45_000

/**
 * How many of a character's own most-recently auto-used placement ids are
 * soft-avoided when picking a new one. Small on purpose — this is "don't
 * immediately repeat the exact same piece", not a long history — and, like
 * autoDialogueEngine.ts's bundle recency, never blocks a pick outright if
 * honoring it would leave zero candidates (see
 * autoFurnitureUseEngine.ts's `pickAutoFurnitureCandidate`).
 */
export const AUTO_FURNITURE_USE_RECENT_HISTORY_SIZE = 1
