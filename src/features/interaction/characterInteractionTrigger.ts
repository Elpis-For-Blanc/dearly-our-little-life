import { useCharacterStore } from '../character/characterStore'
import { useDialogueStore } from '../dialogue/dialogueStore'
import { pairKey } from '../dialogue/pairKey'
import { useHomeStore } from '../home/homeStore'
import { deriveMood } from '../needs/moodEngine'
import { createDefaultNeeds } from '../needs/needsConfig'
import { useNeedsStore } from '../needs/needsStore'
import type { CharacterNeeds } from '../needs/needsTypes'
import { useCharacterMovementStore } from '../simulation/characterMovementStore'
import { standUp, startSitting } from '../simulation/furnitureUsageTrigger'
import { useFurnitureUsageStore } from '../simulation/furnitureUsageStore'
import { clampToFloorBounds, distanceBetween, furnitureObstacles, hasArrived, stepToward, wouldCollide, type Point } from '../simulation/movementEngine'
import { CHARACTER_RADIUS, MOVE_SPEED_PER_TICK } from '../simulation/movementConfig'
import {
  buildInteractionTypeCandidates,
  findSitTogetherPlacement,
  hasCriticalBasicNeed,
  pickInteractionType,
  pointTowardTarget,
  resolveFacing,
  rollShouldStartCharacterInteraction,
  shouldRecomputeApproachTarget,
} from './characterInteractionEngine'
import {
  APPROACH_TARGET_RECOMPUTE_EPSILON,
  CHARACTER_INTERACTION_DURATION_MS,
  FREEFORM_INTERACTION_DISTANCE,
  MAX_INTERACTION_APPROACH_TICKS,
  SOCIAL_RECOVERY,
} from './characterInteractionConfig'
import { useCharacterInteractionSettingsStore } from './characterInteractionSettingsStore'
import { useCharacterInteractionStore } from './characterInteractionStore'
import type { CharacterInteractionSession, CharacterInteractionType } from './characterInteractionTypes'

/**
 * `talk` (one of the five interaction kinds the spec asks for) is
 * deliberately **not** implemented here — it delegates entirely to the
 * already-existing, already-tested conversation system
 * (`dialogue/autoDialogueTrigger.ts`'s `attemptEncounterConversation`/
 * `startManualConversation`), reusing its own encounter-triggered auto
 * path, its own manual entry point, and its own "○○와 대화 중" bubble UI,
 * rather than building a second, duplicate talk engine — exactly the same
 * "공통 엔진을 확장하되 별도의 중복 엔진을 만들지 마" discipline this
 * project's furniture-interaction phases already established. The two
 * systems stay mutually aware so neither can double-book a character the
 * other is using:
 *  - `isCharacterEligibleForInteraction` (below) checks `dialogueStore.isCharacterBusy`.
 *  - `dialogue/autoDialogueTrigger.ts`'s own trigger functions check this
 *    module's `useCharacterInteractionStore.isCharacterBusy` before starting
 *    a conversation (see the small addition there).
 *
 * `sitTogether` also builds on an existing system rather than a new one —
 * it reserves two real seats via the exact same `startSitting`/`standUp`
 * every solo seat use already goes through (`furnitureUsageTrigger.ts`),
 * which already handles the real, collision-checked walk and the seat
 * reservation/occupancy rules; this module only decides *when* to call them
 * and tracks the pairing. `stayTogether`/`hug`/`holdHands` have no existing
 * engine to reuse, so they get a small, self-contained approach-then-hold
 * loop here (`progressFreeformInteraction`), built entirely from
 * `movementEngine.ts`'s existing primitives (`stepToward`, `hasArrived`,
 * `wouldCollide`, `clampToFloorBounds`, `furnitureObstacles`,
 * `distanceBetween`) plus this feature's own small, pure directional helpers
 * in `characterInteractionEngine.ts` (`pointTowardTarget`,
 * `shouldRecomputeApproachTarget`, `resolveFacing`) — never new collision/
 * position math duplicated from scratch. See `FREEFORM_INTERACTION_DISTANCE`
 * (`characterInteractionConfig.ts`) for the per-type approach/final distance
 * this loop actually walks toward, and that constant's own doc comment for
 * why the real interaction effect never starts until real arrival.
 */

export type CharacterInteractionOutcome =
  | 'started'
  | 'not_found'
  | 'same_character'
  | 'not_same_room'
  | 'busy'
  | 'no_seats_available'
  | 'seat_reservation_failed'

/**
 * Whether the given movement status counts as "doing something important" —
 * shared by both the auto idle-candidate gate (strict: only `'idle'`
 * counts) and the eligibility check every start path runs. Kept as a
 * single source so the two can never silently drift apart.
 */
function isBusyStatus(status: string): boolean {
  return status === 'talking' || status === 'seated' || status === 'lying' || status === 'lingering' || status === 'interacting'
}

interface EligibilityResult {
  ok: boolean
  reason?: CharacterInteractionOutcome
  roomId?: string
}

/**
 * The shared preconditions every start path (auto and manual) checks before
 * even picking a type: both characters real and tracked, different from
 * each other, in the same room, and not already busy anywhere — this
 * system's own sessions, an active conversation, or (for the *strict*
 * variant used by the automatic idle-candidate path only) currently moving/
 * resting/seated/talking/interacting. Manual requests are intentionally
 * more permissive about movement status (mirroring how the existing manual
 * "대화하기" button already doesn't require `'idle'` either, and simply
 * stands a character up out of furniture use first) — see
 * `startManualCharacterInteraction`'s own handling.
 */
function checkEligibility(idA: string, idB: string, requireIdle: boolean): EligibilityResult {
  if (idA === idB) return { ok: false, reason: 'same_character' }

  const characters = useCharacterStore.getState().characters
  if (!characters.some((c) => c.id === idA) || !characters.some((c) => c.id === idB)) return { ok: false, reason: 'not_found' }

  const movementById = useCharacterMovementStore.getState().byId
  const moveA = movementById[idA]
  const moveB = movementById[idB]
  if (!moveA || !moveB) return { ok: false, reason: 'not_found' }
  if (moveA.roomId !== moveB.roomId) return { ok: false, reason: 'not_same_room' }

  if (useCharacterInteractionStore.getState().isCharacterBusy(idA) || useCharacterInteractionStore.getState().isCharacterBusy(idB)) {
    return { ok: false, reason: 'busy' }
  }
  if (useDialogueStore.getState().isCharacterBusy(idA) || useDialogueStore.getState().isCharacterBusy(idB)) {
    return { ok: false, reason: 'busy' }
  }
  if (requireIdle && (isBusyStatus(moveA.status) || isBusyStatus(moveB.status) || moveA.status === 'moving' || moveB.status === 'moving')) {
    return { ok: false, reason: 'busy' }
  }

  return { ok: true, roomId: moveA.roomId }
}

function needsFor(characterId: string): CharacterNeeds {
  return useNeedsStore.getState().byId[characterId] ?? createDefaultNeeds(() => 0.5)
}

/** Both participants' `social` recovers by `amount`, clamped 0–100 like every other needs write — reused for both the lump-sum end-of-interaction recovery and `stayTogether`'s incremental per-tick recovery. */
function recoverSocial(idA: string, idB: string, amount: number) {
  if (amount <= 0) return
  const needsStore = useNeedsStore.getState()
  for (const id of [idA, idB]) {
    const current = needsStore.byId[id] ?? createDefaultNeeds(() => 0.5)
    needsStore.setNeeds(id, { ...current, social: current.social + amount })
  }
}

function resetToIdle(characterId: string) {
  const movement = useCharacterMovementStore.getState()
  movement.setStatus(characterId, 'idle')
  movement.setDestination(characterId, null)
  movement.setCurrentBehavior(characterId, null)
  movement.setStuckTicks(characterId, 0)
}

/**
 * Immediately, synchronously ends whatever character-interaction session
 * `characterId` is part of, if any — the character-interaction equivalent
 * of `autoDialogueTrigger.ts`'s `endActiveConversationsFor`, for the same
 * reason: a character deletion or a room deletion needs this gone *now*,
 * not several ticks later. For `sitTogether`, releases both seats via the
 * existing `standUp`; for the other kinds, resets both participants'
 * movement to idle directly. Safe to call on a character with no active
 * session (no-op).
 */
export function endActiveCharacterInteractionsFor(characterId: string): void {
  const store = useCharacterInteractionStore.getState()
  const sessionId = store.byCharacterId[characterId]
  if (!sessionId) return
  const session = store.sessions[sessionId]
  if (!session) return

  if (session.type === 'sitTogether') {
    standUp(session.characterAId)
    standUp(session.characterBId)
  } else {
    resetToIdle(session.characterAId)
    resetToIdle(session.characterBId)
  }
  store.end(sessionId)
}

/** Whether a `sitTogether` session's two seats are still exactly the ones it reserved — the same `stillActive`-guard pattern `autoFurnitureUseTrigger.ts`'s own `reconcile()` already established, reused here for the same reason: a seat can be freed out from under this session by something else entirely (the furniture was deleted/moved, or a character was manually stood up) without this module ever being told directly. */
function sitTogetherSeatsStillValid(session: CharacterInteractionSession): boolean {
  if (!session.seatKeys) return false
  const usage = useFurnitureUsageStore.getState()
  return usage.byCharacterId[session.characterAId] === session.seatKeys.a && usage.byCharacterId[session.characterBId] === session.seatKeys.b
}

function progressSitTogether(session: CharacterInteractionSession, now: number) {
  const store = useCharacterInteractionStore.getState()

  if (!sitTogetherSeatsStillValid(session)) {
    // Something external already invalidated one or both seats (furniture deleted/moved, or a character was
    // manually/otherwise stood up) — release whichever seat, if either, is still this session's own, then forget
    // our own bookkeeping. Never call standUp again for a seat something else already resolved.
    if (useFurnitureUsageStore.getState().byCharacterId[session.characterAId] === session.seatKeys?.a) standUp(session.characterAId)
    if (useFurnitureUsageStore.getState().byCharacterId[session.characterBId] === session.seatKeys?.b) standUp(session.characterBId)
    store.markFailedForPair(pairKey(session.characterAId, session.characterBId), now)
    store.end(session.id)
    return
  }

  const movementById = useCharacterMovementStore.getState().byId
  const bothSeated = movementById[session.characterAId]?.status === 'seated' && movementById[session.characterBId]?.status === 'seated'

  if (session.phase === 'approaching') {
    if (bothSeated) store.update(session.id, { phase: 'active', startedAt: now })
    return
  }

  // phase === 'active'
  if (session.startedAt !== null && now - session.startedAt >= session.duration) {
    standUp(session.characterAId)
    standUp(session.characterBId)
    recoverSocial(session.characterAId, session.characterBId, SOCIAL_RECOVERY.sitTogether)
    store.markEndedForPair(pairKey(session.characterAId, session.characterBId), now)
    store.end(session.id)
  }
}

/** Every same-room character's current position except the given ids — used to keep the freeform approach collision-checked against furniture and *third-party* characters, while deliberately excluding the interaction partner itself (see FREEFORM_INTERACTION_DISTANCE's own doc comment for why). */
function otherCharacterPositions(roomId: string, excludeIds: ReadonlySet<string>): Point[] {
  return Object.values(useCharacterMovementStore.getState().byId)
    .filter((entry) => entry.roomId === roomId && !excludeIds.has(entry.id))
    .map((entry) => ({ x: entry.x, y: entry.y }))
}

/**
 * `stayTogether`/`hug`/`holdHands` — no furniture, so this module owns the
 * whole approach-then-hold loop itself, built entirely from movementEngine's
 * existing primitives (`stepToward`/`hasArrived`/`wouldCollide`/
 * `clampToFloorBounds`/`furnitureObstacles`), never a new position/collision
 * system. Character A is always the one who walks; B stays put at the
 * position it was in when the session started (a deliberate simplification,
 * explicitly allowed by the spec's own "한쪽 또는 양쪽" wording — chasing a
 * *moving* target would need real pathfinding this project doesn't have).
 *
 * The approach is genuinely two-stage, driven by `FREEFORM_INTERACTION_DISTANCE`
 * per type: the mover walks a real, collision-checked path (furniture and
 * *other* characters still block; only the specific partner is excluded from
 * that check, so a close-contact type like `hug` can actually reach its own,
 * closer-than-the-ordinary-collision-floor `finalDistance`) toward a point
 * `approachDistance` short of the partner, computed head-on via
 * `pointTowardTarget` rather than a random angle. `'active'` (the real
 * hug/hold-hands effect and social recovery) never starts until the real,
 * live distance is at or under `finalDistance` — never on session creation.
 */
function progressFreeformInteraction(
  session: CharacterInteractionSession,
  now: number,
  approachTicksRef: Map<string, number>,
  approachTargetRef: Map<string, Point>,
) {
  const store = useCharacterInteractionStore.getState()
  const movement = useCharacterMovementStore.getState()
  const entryA = movement.byId[session.characterAId]
  const entryB = movement.byId[session.characterBId]

  function cleanupTracking() {
    approachTicksRef.delete(session.id)
    approachTargetRef.delete(session.id)
  }

  if (!entryA || !entryB) {
    // A participant was deleted mid-interaction without going through endActiveCharacterInteractionsFor (e.g. a
    // programmatic/test removal) — clean up defensively rather than throw.
    store.end(session.id)
    cleanupTracking()
    return
  }

  const distanceConfig = FREEFORM_INTERACTION_DISTANCE[session.type as 'stayTogether' | 'hug' | 'holdHands']

  if (session.phase === 'approaching') {
    const posA: Point = { x: entryA.x, y: entryA.y }
    const posB: Point = { x: entryB.x, y: entryB.y }
    const distance = distanceBetween(posA, posB)

    if (distance <= distanceConfig.finalDistance) {
      // Real arrival, checked against the *live* distance every tick — this is what stops "interaction starts while
      // still far apart": phase only ever becomes 'active' (and, with it, the real hug/hold-hands effect and social
      // recovery) here, never at session creation.
      movement.setDestination(session.characterAId, null)
      const facing = distanceConfig.facingMode === 'faceEachOther' ? resolveFacing(posA, posB) : null
      store.update(session.id, { phase: 'active', startedAt: now, facing })
      cleanupTracking()
      return
    }

    // A genuine overall timeout for the whole approach, incremented every tick it's still in progress — not only
    // while actively blocked by collision — mirroring MAX_FURNITURE_APPROACH_TICKS's own "total time" safety net
    // (see MAX_INTERACTION_APPROACH_TICKS's doc comment), so an approach that's merely far (not colliding at all,
    // just slow) is still bounded, and one that's genuinely unreachable (enclosed by furniture, no path around it —
    // this project has no real pathfinding) can never leave a character 'interacting' forever.
    const ticks = (approachTicksRef.get(session.id) ?? 0) + 1
    approachTicksRef.set(session.id, ticks)
    if (ticks > MAX_INTERACTION_APPROACH_TICKS) {
      resetToIdle(session.characterAId)
      resetToIdle(session.characterBId)
      store.markFailedForPair(pairKey(session.characterAId, session.characterBId), now)
      store.end(session.id)
      cleanupTracking()
      return
    }

    const room = useHomeStore.getState().rooms.find((r) => r.id === session.roomId)
    const obstacles = room ? furnitureObstacles(room.furniture) : []
    const otherPositions = otherCharacterPositions(session.roomId, new Set([session.characterAId, session.characterBId]))

    // Recomputed head-on (never a random angle) only when there's no destination yet or the partner has genuinely
    // moved since it was last aimed at them — never every tick, which is what would make the mover visibly jitter
    // (see APPROACH_TARGET_RECOMPUTE_EPSILON's own doc comment). B is frozen for the whole interaction in this
    // project's current design, so in practice this fires once; the check still holds if that ever changes.
    let destination = entryA.destination
    if (shouldRecomputeApproachTarget(destination, approachTargetRef.get(session.id) ?? null, posB, APPROACH_TARGET_RECOMPUTE_EPSILON)) {
      const raw = pointTowardTarget(posA, posB, distanceConfig.approachDistance)
      destination = clampToFloorBounds(raw.x, raw.y, CHARACTER_RADIUS)
      movement.setDestination(session.characterAId, destination)
      approachTargetRef.set(session.id, posB)
    }

    const next = stepToward(posA, destination!, MOVE_SPEED_PER_TICK)
    if (wouldCollide(next, CHARACTER_RADIUS, obstacles, otherPositions)) {
      // Blocked by furniture or a *third* character — never the partner itself, already excluded above. Replanning
      // to an unrelated random point would defeat the whole purpose of walking toward a specific partner, so this
      // just waits; the overall tick counter above is what prevents a permanent stall if it never clears.
      return
    }
    movement.setPosition(session.characterAId, next)
    if (hasArrived(next, destination!)) {
      movement.setDestination(session.characterAId, null)
      approachTargetRef.delete(session.id)
    }
    return
  }

  // phase === 'active'
  if (session.type === 'stayTogether') {
    const total = SOCIAL_RECOVERY.stayTogether
    const elapsed = session.startedAt !== null ? now - session.startedAt : 0
    const targetApplied = Math.min(total, (elapsed / session.duration) * total)
    const delta = targetApplied - session.socialRecoveryApplied
    if (delta > 0) {
      recoverSocial(session.characterAId, session.characterBId, delta)
      store.update(session.id, { socialRecoveryApplied: session.socialRecoveryApplied + delta })
    }
  }

  if (session.startedAt !== null && now - session.startedAt >= session.duration) {
    resetToIdle(session.characterAId)
    resetToIdle(session.characterBId)
    if (session.type !== 'stayTogether') recoverSocial(session.characterAId, session.characterBId, SOCIAL_RECOVERY[session.type])
    store.markEndedForPair(pairKey(session.characterAId, session.characterBId), now)
    store.end(session.id)
  }
}

// Approach-timeout counters and last-recomputed-target positions for the freeform kinds — module-scoped like
// useCharacterMovementSimulation.ts's own nearPairsRef, since this pass has no per-render closure to keep them in;
// keyed by session id, pruned whenever a session ends (every exit path in progressFreeformInteraction clears its own entry).
const freeformApproachTicks = new Map<string, number>()
const freeformApproachTargets = new Map<string, Point>()

function progressSession(session: CharacterInteractionSession, now: number) {
  if (session.type === 'sitTogether') progressSitTogether(session, now)
  else progressFreeformInteraction(session, now, freeformApproachTicks, freeformApproachTargets)
}

function tryStartSitTogether(idA: string, idB: string, roomId: string, now: number): CharacterInteractionOutcome {
  const room = useHomeStore.getState().rooms.find((r) => r.id === roomId)
  if (!room) return 'not_same_room'
  const pair = findSitTogetherPlacement(room.furniture, useFurnitureUsageStore.getState().bySeatKey)
  if (!pair) return 'no_seats_available'

  const outcomeA = startSitting(idA, pair.placementId, pair.slotAId)
  if (outcomeA !== 'started') return 'seat_reservation_failed'
  const outcomeB = startSitting(idB, pair.placementId, pair.slotBId)
  if (outcomeB !== 'started') {
    standUp(idA) // roll back the first reservation — never leave one side seated alone from a failed pairing
    useCharacterInteractionStore.getState().markFailedForPair(pairKey(idA, idB), now)
    return 'seat_reservation_failed'
  }

  const sessionId = crypto.randomUUID()
  useCharacterInteractionStore.getState().start({
    id: sessionId,
    type: 'sitTogether',
    characterAId: idA,
    characterBId: idB,
    roomId,
    phase: 'approaching',
    startedAt: null,
    duration: CHARACTER_INTERACTION_DURATION_MS.sitTogether,
    seatKeys: { a: `${pair.placementId}:${pair.slotAId}`, b: `${pair.placementId}:${pair.slotBId}` },
    socialRecoveryApplied: 0,
    facing: null, // sitTogether has no facingMode concept — seated orientation is furniture-slot-driven, not this system's
  })
  return 'started'
}

function startFreeformInteraction(type: Exclude<CharacterInteractionType, 'sitTogether'>, idA: string, idB: string, roomId: string): CharacterInteractionOutcome {
  const movement = useCharacterMovementStore.getState()
  movement.setStatus(idA, 'interacting')
  movement.setStatus(idB, 'interacting')
  movement.setDestination(idB, null)
  movement.setCurrentBehavior(idA, null)
  movement.setCurrentBehavior(idB, null)

  const sessionId = crypto.randomUUID()
  useCharacterInteractionStore.getState().start({
    id: sessionId,
    type,
    characterAId: idA,
    characterBId: idB,
    roomId,
    phase: 'approaching',
    startedAt: null,
    duration: CHARACTER_INTERACTION_DURATION_MS[type],
    socialRecoveryApplied: 0,
    facing: null, // resolved once real arrival is detected in progressFreeformInteraction — never guessed up front
  })
  return 'started'
}

/** The shared start dispatch both the automatic pass and the manual UI call — see this module's own top doc comment for why `sitTogether` delegates to `furnitureUsageTrigger.ts` while the other three are handled directly here. */
function startInteraction(type: CharacterInteractionType, idA: string, idB: string, roomId: string, now: number): CharacterInteractionOutcome {
  return type === 'sitTogether' ? tryStartSitTogether(idA, idB, roomId, now) : startFreeformInteraction(type, idA, idB, roomId)
}

function tryStartForCharacter(characterId: string, now: number, random: () => number) {
  if (!useCharacterInteractionSettingsStore.getState().enabled) return
  const movement = useCharacterMovementStore.getState().byId[characterId]
  if (!movement || movement.status !== 'idle') return

  const needsA = needsFor(characterId)
  if (hasCriticalBasicNeed(needsA)) return

  const store = useCharacterInteractionStore.getState()
  const characters = useCharacterStore.getState().characters
  const movementById = useCharacterMovementStore.getState().byId
  const partners = characters.filter((c) => {
    if (c.id === characterId) return false
    const m = movementById[c.id]
    if (!m || m.status !== 'idle' || m.roomId !== movement.roomId) return false
    // A candidate partner's own hunger/energy must also be checked, not just the initiating character's — otherwise
    // a non-critical character could still drag a critical-need partner into an interaction it never itself rolled
    // the hard gate against (this exact gap was caught by characterInteraction.test.tsx's own "기력이 위급한
    // 캐릭터는... 자동으로 상호작용을 시작하지 않는다" test, which exercises it from the critical character's own
    // idle-candidate position, not just as an initiator).
    if (hasCriticalBasicNeed(needsFor(c.id))) return false
    return checkEligibility(characterId, c.id, true).ok
  })
  if (partners.length === 0) return

  const partner = partners[Math.floor(random() * partners.length)]
  const key = pairKey(characterId, partner.id)
  const shouldStart = rollShouldStartCharacterInteraction({
    enabled: useCharacterInteractionSettingsStore.getState().enabled,
    now,
    lastEndedAt: store.lastEndedAtByPair[key],
    lastFailedAt: store.lastFailedAtByPair[key],
    random,
  })
  if (!shouldStart) return

  const room = useHomeStore.getState().rooms.find((r) => r.id === movement.roomId)
  const sitTogetherAvailable = !!room && findSitTogetherPlacement(room.furniture, useFurnitureUsageStore.getState().bySeatKey) !== null
  const needsB = needsFor(partner.id)
  const candidates = buildInteractionTypeCandidates(needsA, deriveMood(needsA), needsB, deriveMood(needsB), sitTogetherAvailable)
  const type = pickInteractionType(candidates, random)
  if (!type) return

  const outcome = startInteraction(type, characterId, partner.id, movement.roomId, now)
  if (outcome !== 'started') store.markFailedForPair(key, now)
}

/**
 * The single entry point for automatic character-to-character interaction —
 * called exactly once per movement tick from `useCharacterMovementSimulation.ts`,
 * mirroring `autoFurnitureUseTrigger.ts`'s `runAutoFurnitureUsePass`/
 * `monologueTrigger.ts`'s `runMonologuePass` hook-point pattern exactly: no
 * timer of its own, reuses the one existing simulation tick. Every existing
 * session is progressed first (so a session can never both finish and
 * attempt to start a new one within the same pass for the same character);
 * only characters with no active session afterward are even considered for
 * starting one.
 */
export function runCharacterInteractionPass(now: number = Date.now(), random: () => number = Math.random): void {
  for (const session of Object.values(useCharacterInteractionStore.getState().sessions)) {
    progressSession(session, now)
  }

  for (const character of useCharacterStore.getState().characters) {
    if (useCharacterInteractionStore.getState().isCharacterBusy(character.id)) continue
    tryStartForCharacter(character.id, now, random)
  }
}

/**
 * Manual entry point — reuses the exact same `startInteraction` dispatch
 * (and, through it, the exact same `startSitting`/movement-status logic) the
 * automatic pass uses, per the spec's own "수동 실행도 자동 시스템과 완전히
 * 같은 interaction engine을 사용해야 함". Deliberately more permissive about
 * movement status than the automatic idle-only gate (mirroring how the
 * existing manual "대화하기" button already doesn't require `'idle'` either)
 * — an explicit click already *is* the "should this happen" decision; any
 * pre-existing furniture use is simply stood up out of first, exactly like
 * starting a manual conversation already does.
 */
export function startManualCharacterInteraction(type: CharacterInteractionType, idA: string, idB: string): CharacterInteractionOutcome {
  const eligibility = checkEligibility(idA, idB, false)
  if (!eligibility.ok) return eligibility.reason ?? 'busy'

  standUp(idA)
  standUp(idB)

  return startInteraction(type, idA, idB, eligibility.roomId!, Date.now())
}
