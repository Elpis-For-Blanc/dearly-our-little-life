import { useEffect, useRef } from 'react'
import { resolveWeightingTagIds } from '../character/personalityTags'
import { useCharacterStore } from '../character/characterStore'
import { attemptEncounterConversation, endActiveConversationsFor } from '../dialogue/autoDialogueTrigger'
import { runMonologuePass } from '../dialogue/monologueTrigger'
import { useMonologueStore } from '../dialogue/monologueStore'
import type { DialogueSituation } from '../dialogue/types'
import { getFurnitureDefinition } from '../home/furnitureCatalog'
import { getActiveLiveRoom, useHomeStore } from '../home/homeStore'
import type { Room } from '../home/roomTypes'
import type { InteractionKind } from '../home/types'
import { runNeedsPass } from '../needs/needsTrigger'
import { endActiveCharacterInteractionsFor, runCharacterInteractionPass } from '../interaction/characterInteractionTrigger'
import { runAutoFurnitureUsePass } from './autoFurnitureUseTrigger'
import { useCharacterMovementStore, type CharacterMovementState, type MovementStatus } from './characterMovementStore'
import { detectEncounters } from './encounterEngine'
import { resolveSeatPosition } from './furnitureInteractionEngine'
import { releaseFurnitureUsage } from './furnitureUsageTrigger'
import { useFurnitureUsageStore } from './furnitureUsageStore'
import {
  furnitureObstacles,
  hasArrived,
  pickApproachDestination,
  pickBehavior,
  pickDestinationRoomId,
  pickDoorwayArrivalPosition,
  pickRandomDestination,
  pickSeekSolitudeDestination,
  stepToward,
  wouldCollide,
  type Rect,
} from './movementEngine'
import { CHARACTER_RADIUS, MAX_FURNITURE_APPROACH_TICKS, MAX_STUCK_TICKS, MOVEMENT_TICK_MS, MOVE_SPEED_PER_TICK, REST_TICKS } from './movementConfig'
import { useSimulationStore } from './simulationStore'

/**
 * Handles a character that just arrived at its origin room's doorway while
 * mid-room-change (`destinationRoomId` set) — switches `roomId` and appears
 * at the destination room's own doorway, per the spec's "step 4/5" (switch
 * on reaching the doorway, appear at the destination room's doorway) rather
 * than a center-to-center teleport. The landing point is nudged off the
 * exact doorway coordinate if another character (or furniture) already
 * occupies it — see `pickDoorwayArrivalPosition` for why that matters: every
 * room's doorway is the same fixed point, so two characters landing exactly
 * on top of each other there is a real, recurring scenario, not a
 * theoretical edge case.
 */
function completeRoomChange(
  id: string,
  entry: CharacterMovementState,
  roomById: Map<string, Room>,
  obstaclesByRoom: Map<string, Rect[]>,
) {
  const movement = useCharacterMovementStore.getState()
  const targetRoom = entry.destinationRoomId ? roomById.get(entry.destinationRoomId) : undefined

  if (targetRoom) {
    const targetObstacles = obstaclesByRoom.get(targetRoom.id) ?? []
    const targetOtherPositions = Object.values(movement.byId)
      .filter((c) => c.id !== id && c.roomId === targetRoom.id)
      .map((c) => ({ x: c.x, y: c.y }))
    const landingPosition = pickDoorwayArrivalPosition(targetRoom.doorway.entryPosition, targetObstacles, targetOtherPositions, CHARACTER_RADIUS)

    movement.setRoomId(id, targetRoom.id)
    movement.setPosition(id, landingPosition)
    useMonologueStore.getState().markRoomArrival(id, Date.now())
  }
  movement.setDestination(id, null)
  movement.setDestinationRoomId(id, null)
  movement.setCurrentBehavior(id, null)
  movement.setStatus(id, 'idle')
  movement.setStuckTicks(id, 0)
}

/**
 * A character just arrived at a furniture approach point it was walking to
 * (see `furnitureUsageTrigger.ts`'s `startSitting`) — the same
 * "walk-to-a-designated-point, then a direct final placement on arrival"
 * pattern `completeRoomChange` above already uses for doorways. Re-resolves
 * the seat position fresh from the placement's *current* data (never a
 * value cached from reservation time) so a placement that's still exactly
 * where it was when the approach started seats the character correctly; if
 * the room/placement/definition/slot can no longer be found — the reserving
 * flow should already have evicted this usage on any move/rotate/delete, so
 * this is a defensive fallback, not the expected path — the reservation is
 * released and the character simply stands at the approach point instead of
 * ending up seated on nothing.
 */
/** The MovementStatus a character ends up in after actually arriving and occupying a slot of this kind — see characterMovementStore.ts's MovementStatus doc for why sit/lie/stand each get their own, clearly distinguishable status. */
function occupiedStatusFor(kind: InteractionKind): MovementStatus {
  return kind === 'sit' ? 'seated' : kind === 'lie' ? 'lying' : 'lingering'
}

function completeFurnitureApproach(id: string, roomById: Map<string, Room>) {
  const movement = useCharacterMovementStore.getState()
  const usage = useFurnitureUsageStore.getState().bySeatKey[useFurnitureUsageStore.getState().byCharacterId[id] ?? '']
  const room = usage ? roomById.get(usage.roomId) : undefined
  const placement = room?.furniture.find((f) => f.id === usage?.placementId)
  const definition = placement ? getFurnitureDefinition(placement.furnitureId) : undefined
  const slot = definition?.interactionSlots.find((s) => s.id === usage?.slotId)

  if (usage && placement && definition && slot) {
    useFurnitureUsageStore.getState().markSeated(id)
    // A 'stand' slot's own resolved position is already the character's current position — that's what they just
    // walked straight to (see resolveWalkDestination) — so re-setting it here would be a harmless no-op; skipped
    // simply to avoid the redundant call. 'sit'/'lie' slots sit inside the furniture's solid footprint, reachable
    // only by this direct final placement (bypassing collision on purpose, exactly like every furniture use before this).
    if (slot.kind !== 'stand') movement.setPosition(id, resolveSeatPosition(placement, slot))
    movement.setStatus(id, occupiedStatusFor(slot.kind))
  } else {
    if (usage) useFurnitureUsageStore.getState().release(id)
    movement.setStatus(id, 'idle')
  }
  movement.setDestination(id, null)
  movement.setCurrentBehavior(id, null)
  movement.setStuckTicks(id, 0)
}

/**
 * Module-level (not a component closure) so it never depends on props/state
 * — every value it needs is read live via `.getState()`, same pattern as
 * `autoDialogueTrigger.ts`'s conversation logic.
 */
function tick(mountedRef: { current: boolean }, nearPairsRef: { current: Set<string> }, situationRef: { current: DialogueSituation }) {
  if (!mountedRef.current) return
  if (!useSimulationStore.getState().isRunning) return

  const characters = useCharacterStore.getState().characters
  const ids = characters.map((c) => c.id)
  if (ids.length === 0) return

  const weightingTagsById = new Map(
    characters.map((c) => [c.id, resolveWeightingTagIds(c.aiProfile.personalityTags, c.aiProfile.customPersonalityTags)]),
  )

  const homeState = useHomeStore.getState()
  const rooms = homeState.rooms
  const roomById = new Map(rooms.map((room) => [room.id, room]))
  const obstaclesByRoom = new Map<string, Rect[]>(rooms.map((room) => [room.id, furnitureObstacles(room.furniture)]))
  const canChangeRoom = rooms.length > 1
  const hour = new Date().getHours()

  const movement = useCharacterMovementStore.getState()

  movement.syncCharacterIds(ids, () => {
    const spawnRoom = getActiveLiveRoom(homeState)
    const obstacles = obstaclesByRoom.get(spawnRoom.id) ?? []
    const others = Object.values(useCharacterMovementStore.getState().byId)
      .filter((c) => c.roomId === spawnRoom.id)
      .map((c) => ({ x: c.x, y: c.y }))
    return { position: pickRandomDestination(obstacles, others, CHARACTER_RADIUS), roomId: spawnRoom.id }
  })

  // The room-deletion UI relocates occupants first, but a character can still be left pointing at a room that no
  // longer exists (a room removed some other way). Skipping it would leave it frozen and invisible in every room, so
  // bring it into the observed room (or the first one) at that room's doorway, landing clear of anyone already there.
  const rescueRoom = getActiveLiveRoom(homeState)
  for (const orphan of Object.values(useCharacterMovementStore.getState().byId)) {
    if (roomById.has(orphan.roomId)) continue
    // Same rule as RoomTabs' own relocation: end any conversation this orphan is still in before moving it, so a
    // room deleted through some other path (not the RoomTabs confirm flow — e.g. programmatic/test removal) can't
    // leave dialogueStore thinking a relocated character is still busy in a room it no longer occupies.
    endActiveConversationsFor(orphan.id)
    releaseFurnitureUsage(orphan.id)
    endActiveCharacterInteractionsFor(orphan.id)
    const others = Object.values(useCharacterMovementStore.getState().byId)
      .filter((c) => c.id !== orphan.id && c.roomId === rescueRoom.id)
      .map((c) => ({ x: c.x, y: c.y }))
    const landing = pickDoorwayArrivalPosition(rescueRoom.doorway.entryPosition, obstaclesByRoom.get(rescueRoom.id) ?? [], others, CHARACTER_RADIUS)
    movement.moveCharacterToRoom(orphan.id, rescueRoom.id, landing)
  }

  for (const id of ids) {
    const entry = useCharacterMovementStore.getState().byId[id]
    // 'interacting' (stayTogether/hug/holdHands) is skipped here for the same reason 'seated'/'lying'/'lingering'
    // already are — characterInteractionTrigger.ts's own runCharacterInteractionPass owns their movement entirely
    // while paired up (it steps the one "mover" character itself, reusing this file's own stepToward/hasArrived/
    // wouldCollide primitives), so the ordinary per-character wander logic below must never touch them.
    if (!entry || entry.status === 'talking' || entry.status === 'seated' || entry.status === 'lying' || entry.status === 'lingering' || entry.status === 'interacting') continue

    const room = roomById.get(entry.roomId)
    if (!room) continue // unreachable after the rescue above; kept so the type narrows

    const obstacles = obstaclesByRoom.get(entry.roomId) ?? []
    const otherPositions = ids
      .filter((otherId) => otherId !== id)
      .map((otherId) => useCharacterMovementStore.getState().byId[otherId])
      .filter((e): e is NonNullable<typeof e> => e !== undefined && e.roomId === entry.roomId)
      .map((e) => ({ x: e.x, y: e.y }))

    if (entry.restTicksRemaining > 0) {
      useCharacterMovementStore.getState().setRestTicksRemaining(id, entry.restTicksRemaining - 1)
      useCharacterMovementStore.getState().setStatus(id, 'idle')
      continue
    }

    // Just reached the origin room's doorway while changing rooms — switch rooms now, rather than treating this as a normal "arrived, pick something new" moment.
    if (entry.destinationRoomId && entry.destination && hasArrived({ x: entry.x, y: entry.y }, entry.destination)) {
      completeRoomChange(id, entry, roomById, obstaclesByRoom)
      continue
    }

    // Walking toward a furniture approach point (see startSitting) — arrival sits the character down instead of the
    // ordinary "picked a new destination" logic below. A generous ticks-since-reserved timeout is the last-resort
    // safety net for an approach point that somehow never gets reached (MAX_STUCK_TICKS's forced-step-through already
    // handles the ordinary "temporarily blocked" case long before this could fire).
    const furnitureUsage = useFurnitureUsageStore.getState().bySeatKey[useFurnitureUsageStore.getState().byCharacterId[id] ?? '']
    if (furnitureUsage?.status === 'approaching') {
      if (entry.destination && hasArrived({ x: entry.x, y: entry.y }, entry.destination)) {
        completeFurnitureApproach(id, roomById)
        continue
      }
      if (useFurnitureUsageStore.getState().incrementApproachTicks(id) > MAX_FURNITURE_APPROACH_TICKS) {
        useFurnitureUsageStore.getState().release(id)
        useCharacterMovementStore.getState().setStatus(id, 'idle')
        useCharacterMovementStore.getState().setDestination(id, null)
        continue
      }
    }

    let destination = entry.destination
    if (!destination || hasArrived({ x: entry.x, y: entry.y }, destination)) {
      const tags = weightingTagsById.get(id) ?? []
      const behavior = pickBehavior(tags, canChangeRoom)
      useCharacterMovementStore.getState().setCurrentBehavior(id, behavior)

      if (behavior === 'rest') {
        useCharacterMovementStore.getState().setRestTicksRemaining(id, REST_TICKS)
        useCharacterMovementStore.getState().setDestination(id, null)
        useCharacterMovementStore.getState().setStatus(id, 'idle')
        continue
      }

      if (behavior === 'changeRoom') {
        const targetRoomId = pickDestinationRoomId(rooms, entry.roomId, hour)
        if (targetRoomId) {
          destination = room.doorway.exitPosition
          useCharacterMovementStore.getState().setDestination(id, destination)
          useCharacterMovementStore.getState().setDestinationRoomId(id, targetRoomId)
        } else {
          // No other room to go to (shouldn't happen while canChangeRoom is true, but stay safe) — wander in place instead.
          destination = pickRandomDestination(obstacles, otherPositions, CHARACTER_RADIUS)
          useCharacterMovementStore.getState().setDestination(id, destination)
        }
      } else {
        destination =
          behavior === 'approach'
            ? pickApproachDestination(otherPositions, obstacles, CHARACTER_RADIUS)
            : behavior === 'seekSolitude'
              ? pickSeekSolitudeDestination(otherPositions, obstacles, CHARACTER_RADIUS)
              : pickRandomDestination(obstacles, otherPositions, CHARACTER_RADIUS)
        useCharacterMovementStore.getState().setDestination(id, destination)
      }
    }

    const next = stepToward({ x: entry.x, y: entry.y }, destination, MOVE_SPEED_PER_TICK)

    if (wouldCollide(next, CHARACTER_RADIUS, obstacles, otherPositions)) {
      // Blocked mid-path by furniture or another character. Normally just
      // replan (pick a new destination) instead of clipping through it —
      // a simple retry-based avoidance, not real pathfinding around the
      // obstacle (see CLAUDE.md). A blocked room-change attempt drops its
      // destinationRoomId too, so the abandoned attempt doesn't leave stale
      // intent to resume later.
      //
      // A furniture approach is the one destination that's never abandoned
      // this way — it's a specific reserved seat, not an interchangeable
      // random point.
      //
      // But MAX_STUCK_TICKS consecutive blocked ticks means replanning
      // alone isn't working — most commonly because another character is
      // sitting exactly on the mover's own current position (this happens
      // routinely at doorways, since every room's doorway is the same fixed
      // point), which makes every possible next step collide regardless of
      // which destination gets picked. Force the step through this once
      // rather than freezing forever — a brief visual overlap is far better
      // than a permanent stall.
      //
      // A furniture approach uses a much lower force-through threshold (1
      // tick, not MAX_STUCK_TICKS) than ordinary wandering: since it never
      // replans to a different point, waiting several ticks first (the way
      // wandering does, to give an ordinary replan a chance to work) serves
      // no purpose here and can genuinely never resolve on its own —
      // `stepToward`'s straight-line math is fully deterministic, so two
      // characters walking toward two nearby seats on the same 2-seat sofa
      // at once can otherwise fall into a stable mutual-blocking oscillation
      // with nothing to perturb it apart (found and reproduced directly by
      // furnitureUsage.test.tsx's "소파 좌석 2개 동시 사용" test). Pushing
      // through immediately instead makes every furniture approach a
      // monotonic walk toward its seat, at the cost of the same brief,
      // already-accepted visual overlap.
      const stuckTicks = entry.stuckTicks + 1
      if (furnitureUsage || stuckTicks >= MAX_STUCK_TICKS) {
        useCharacterMovementStore.getState().setPosition(id, next)
        useCharacterMovementStore.getState().setStatus(id, hasArrived(next, destination) ? 'idle' : 'moving')
        useCharacterMovementStore.getState().setStuckTicks(id, 0)
        continue
      }

      useCharacterMovementStore.getState().setStuckTicks(id, stuckTicks)
      useCharacterMovementStore.getState().setDestination(id, pickRandomDestination(obstacles, otherPositions, CHARACTER_RADIUS))
      if (entry.destinationRoomId) useCharacterMovementStore.getState().setDestinationRoomId(id, null)
      continue
    }

    useCharacterMovementStore.getState().setPosition(id, next)
    useCharacterMovementStore.getState().setStatus(id, hasArrived(next, destination) ? 'idle' : 'moving')
    if (entry.stuckTicks > 0) useCharacterMovementStore.getState().setStuckTicks(id, 0)
  }

  const updated = useCharacterMovementStore.getState().byId
  const idsByRoom = new Map<string, string[]>()
  for (const id of ids) {
    const entry = updated[id]
    if (!entry) continue
    const list = idsByRoom.get(entry.roomId) ?? []
    list.push(id)
    idsByRoom.set(entry.roomId, list)
  }

  // Encounters are detected per room-group only — two characters in different rooms must never be able to "collide" just because the shared logical coordinate space happens to put them at similar x/y.
  const combinedNewlyEncountered: Array<[string, string]> = []
  const combinedCurrentlyNear = new Set<string>()
  for (const roomIds of idsByRoom.values()) {
    const positions = roomIds.map((id) => ({ id, position: { x: updated[id].x, y: updated[id].y } }))
    const { newlyEncountered, currentlyNear } = detectEncounters(positions, nearPairsRef.current)
    combinedNewlyEncountered.push(...newlyEncountered)
    for (const key of currentlyNear) combinedCurrentlyNear.add(key)
  }
  nearPairsRef.current = combinedCurrentlyNear

  for (const [idA, idB] of combinedNewlyEncountered) {
    void attemptEncounterConversation(idA, idB, situationRef, mountedRef)
  }

  // Needs decay/recovery runs after movement/furniture-status is finalized for this tick (so energy recovery sees
  // this tick's freshest 'seated'/'lying' status) and before automatic furniture use, so its needs-based bonus
  // (needsFurnitureBonus.ts) reads this tick's freshest values rather than one tick stale.
  runNeedsPass()

  // Automatic furniture use runs after encounters/conversations (so a conversation that just started this tick
  // already excludes a character via isCharacterBusy) and before monologue (so monologue's activity derivation sees
  // this tick's freshest movement status — e.g. a character auto-seated just now doesn't get an 'idle'-only read).
  const now = Date.now()
  runAutoFurnitureUsePass(now)

  // Character-to-character interaction (stayTogether/sitTogether/hug/holdHands — see features/interaction/) runs
  // right after automatic furniture use, so a character auto-furniture-use just seated this same tick is already
  // excluded (status no longer 'idle') from also starting a character interaction this tick.
  runCharacterInteractionPass(now)

  // Monologues run last so a conversation that just started this tick (marking both talkers busy synchronously) already suppresses them.
  runMonologuePass(now, hour)
}

/** Mounts the character-movement + encounter-detection tick loop for as long as the Live screen is open. */
export function useCharacterMovementSimulation(situation: DialogueSituation) {
  const situationRef = useRef(situation)
  const mountedRef = useRef(true)
  const nearPairsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    situationRef.current = situation
  }, [situation])

  useEffect(() => {
    mountedRef.current = true
    const intervalId = window.setInterval(() => {
      tick(mountedRef, nearPairsRef, situationRef)
    }, MOVEMENT_TICK_MS)

    return () => {
      mountedRef.current = false
      window.clearInterval(intervalId)
    }
  }, [])
}
