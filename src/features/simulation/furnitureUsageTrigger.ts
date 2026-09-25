import { useCharacterStore } from '../character/characterStore'
import { getFurnitureDefinition } from '../home/furnitureCatalog'
import { useHomeStore } from '../home/homeStore'
import type { FurnitureInteractionSlot, FurniturePlacement, InteractionKind } from '../home/types'
import { useDialogueStore } from '../dialogue/dialogueStore'
import { useCharacterMovementStore } from './characterMovementStore'
import { getUsableLieSlots, resolveApproachPoint, resolveWalkDestination } from './furnitureInteractionEngine'
import { useFurnitureUsageStore } from './furnitureUsageStore'

/** Shared across every interaction kind (sit/lie/stand) — the outcome vocabulary was already generic in shape (the sofa/chair UI's own messages are unaffected; see FurnitureUsagePanel.tsx for how bed/table give kind-appropriate wording for the same values). */
export type SitOutcome = 'started' | 'not_found' | 'not_sittable' | 'not_same_room' | 'occupied' | 'busy'

/**
 * Finds which room currently holds `placementId` and the placement itself —
 * furniture usage isn't scoped to whichever room the decorate screen happens
 * to have active, so every room is searched (mirroring how `RoomTabs`' own
 * occupant lookup works off `characterMovementStore`, not `activeDecorateRoomId`).
 */
function findPlacement(placementId: string): { roomId: string; placement: FurniturePlacement } | null {
  for (const room of useHomeStore.getState().rooms) {
    const placement = room.furniture.find((f) => f.id === placementId)
    if (placement) return { roomId: room.id, placement }
  }
  return null
}

/** Which of a set of slot ids (if any) is free right now — the first one in catalog order with no reservation/occupant, or undefined if every one is taken (or the set is empty). */
function firstAvailableSlotId(placementId: string, slotIds: string[]): string | undefined {
  const usage = useFurnitureUsageStore.getState().bySeatKey
  return slotIds.find((slotId) => !usage[`${placementId}:${slotId}`])
}

/**
 * The one shared reservation+approach flow every interaction kind (sit, lie,
 * stand) goes through — `startSitting`/`startLyingDown`/`startLingering`
 * below are thin, kind-fixed wrappers around this, per CLAUDE.md's "기존
 * 상호작용 엔진을 확장하되... 별도의 중복 엔진을 만들지 마": validates
 * same-room, availability and occupancy, then reserves the target slot and
 * hands the character to the *ordinary* movement engine via
 * `resolveWalkDestination` (which is itself the only place sit/lie vs. stand
 * actually differ — see its own doc comment) — this function itself never
 * moves the character or marks them occupying; that only happens once
 * `useCharacterMovementSimulation.ts`'s tick actually sees them arrive, so
 * an approach that never completes (blocked, room deleted, furniture moved)
 * can never silently fake success.
 *
 * `slotId` is optional: omit it to let the first currently-free slot of
 * `kind` on the piece be picked automatically (the only real choice for a
 * one-slot chair or bed, and what every sofa call site already relies on);
 * pass it to target one specific slot (the 2-seat sofa's/2-spot table's UI).
 *
 * If `characterId` is already using a *different* slot (any kind, any
 * piece), that slot is released first — bookkeeping only, no walk back to
 * it, since they're about to walk somewhere else anyway — before reserving
 * the new one, per the spec's "이미 앉아 있는 캐릭터를 다른 좌석으로 옮길
 * 때는 기존 좌석을 안전하게 해제한 뒤 새 좌석을 예약". Targeting the exact
 * slot they're already on/walking to is a harmless no-op.
 */
function startUsingSlot(characterId: string, placementId: string, kind: InteractionKind, slotId?: string): SitOutcome {
  const character = useCharacterStore.getState().characters.find((c) => c.id === characterId)
  const movement = useCharacterMovementStore.getState().byId[characterId]
  if (!character || !movement) return 'not_found'

  const found = findPlacement(placementId)
  if (!found) return 'not_found'
  const { roomId, placement } = found

  const definition = getFurnitureDefinition(placement.furnitureId)
  // 'lie' goes through getUsableLieSlots (every bed's two slots, capped at MAX_LIE_OCCUPANTS) so this, the panel and
  // the automatic pass always agree on which slots exist.
  const slotsOfKind = kind === 'lie' ? getUsableLieSlots(definition) : (definition?.interactionSlots.filter((s) => s.kind === kind) ?? [])
  if (!definition || slotsOfKind.length === 0) return 'not_sittable'

  const targetSlot = slotId ? slotsOfKind.find((s) => s.id === slotId) : undefined
  if (slotId && !targetSlot) return 'not_sittable' // the given slotId doesn't name a real slot of this kind on this piece

  // Character and furniture must share a room — never routed through a cross-room walk in this phase.
  if (movement.roomId !== roomId) return 'not_same_room'

  if (useDialogueStore.getState().isCharacterBusy(characterId)) return 'busy'
  if (movement.status === 'talking') return 'busy'

  const existingSeatKey = useFurnitureUsageStore.getState().byCharacterId[characterId]
  const resolvedSlot = targetSlot ?? slotsOfKind.find((s) => firstAvailableSlotId(placementId, [s.id]) === s.id)
  if (!resolvedSlot) return 'occupied' // no slotId given, and every slot of this kind on this piece is already taken

  if (existingSeatKey === `${placementId}:${resolvedSlot.id}`) return 'started' // already on (or walking to) exactly this slot — nothing to do
  if (existingSeatKey) useFurnitureUsageStore.getState().release(characterId) // move to a different slot: release the old one first, bookkeeping only

  // Reserve before moving anyone — a second character targeting the same slot a moment later sees it occupied, never a race.
  const reserved = useFurnitureUsageStore.getState().reserve({ characterId, placementId, roomId, slotId: resolvedSlot.id })
  if (!reserved) return 'occupied'

  // Hand off to the real, collision-checked movement engine — same mechanism as every other destination.
  const destination = resolveWalkDestination(placement, definition, resolvedSlot)
  useCharacterMovementStore.getState().setDestination(characterId, destination)
  useCharacterMovementStore.getState().setDestinationRoomId(characterId, null)
  useCharacterMovementStore.getState().setCurrentBehavior(characterId, null)
  useCharacterMovementStore.getState().setStatus(characterId, 'moving')
  return 'started'
}

/** Sit on a sofa or chair — unchanged in behavior and signature from phase 1/2 (a thin wrapper around the shared `startUsingSlot` core). */
export function startSitting(characterId: string, placementId: string, slotId?: string): SitOutcome {
  return startUsingSlot(characterId, placementId, 'sit', slotId)
}

/**
 * Lie down on a bed. Every bed has two independent lie slots
 * (furnitureCatalog.ts's `bedLieSlots`): omit `slotId` to take the first
 * free one (`'occupied'` once both are taken — a third character is refused),
 * or pass one to target a specific side (the panel's per-side "눕기" buttons,
 * and the automatic pass, which has already chosen a free slot).
 */
export function startLyingDown(characterId: string, placementId: string, slotId?: string): SitOutcome {
  return startUsingSlot(characterId, placementId, 'lie', slotId)
}

/** Walk up to and linger at a table's north/south spot. */
export function startLingering(characterId: string, placementId: string, slotId?: string): SitOutcome {
  return startUsingSlot(characterId, placementId, 'stand', slotId)
}

interface ResolvedUsageSlot {
  placement: FurniturePlacement
  definition: NonNullable<ReturnType<typeof getFurnitureDefinition>>
  slot: FurnitureInteractionSlot
}

function findUsageSlot(usage: { placementId: string; slotId: string }): ResolvedUsageSlot | null {
  for (const room of useHomeStore.getState().rooms) {
    const placement = room.furniture.find((f) => f.id === usage.placementId)
    if (!placement) continue
    const definition = getFurnitureDefinition(placement.furnitureId)
    const slot = definition?.interactionSlots.find((s) => s.id === usage.slotId)
    return definition && slot ? { placement, definition, slot } : null
  }
  return null
}

/**
 * Ends furniture use for `characterId` — whatever kind it is (sit, lie, or
 * stand), whether they were still walking over (a "취소") or had already
 * arrived (일어나기 / 머무르기 종료) — the one shared "end use" function
 * every UI button (소파/의자의 일어나기, 침대의 일어나기, 테이블의 머무르기
 * 종료) and every cleanup path (conversation starting, etc.) calls.
 *
 * For a 'sit'/'lie' slot, repositions them to the slot's own approach point
 * (always outside the furniture's solid footprint, so always safe,
 * recomputed fresh from the placement's *current* data — never a value
 * cached from when they arrived). For a 'stand' slot, **no repositioning
 * happens at all** — a table's linger spot is already outside the
 * furniture's footprint by construction (see `resolveWalkDestination`), so
 * moving them anywhere else on standing up would be a pointless, unrequested
 * extra hop, not a safety requirement the way it is for sit/lie.
 *
 * Movement status resets to `'idle'` either way, which is what lets the
 * very next tick's ordinary behavior selection take back over — the same
 * "reset to idle, let the next tick pick something new" pattern
 * `completeRoomChange` already uses. A no-op (touches nothing) if the
 * character isn't using any furniture right now. Releases only *this
 * character's own slot* — never any other slot on the same piece (see
 * `furnitureUsageStore.ts`'s `release`, which is already seat-scoped).
 */
export function standUp(characterId: string): void {
  const usageState = useFurnitureUsageStore.getState()
  const seatKey = usageState.byCharacterId[characterId]
  const usage = seatKey ? usageState.bySeatKey[seatKey] : undefined
  useFurnitureUsageStore.getState().release(characterId)
  if (!usage) return

  const found = findUsageSlot(usage)
  const movement = useCharacterMovementStore.getState().byId[characterId]

  if (found && movement && found.slot.kind !== 'stand') {
    const safePoint = resolveApproachPoint(found.placement, found.definition, found.slot)
    useCharacterMovementStore.getState().setPosition(characterId, safePoint)
  }
  useCharacterMovementStore.getState().setStatus(characterId, 'idle')
  useCharacterMovementStore.getState().setDestination(characterId, null)
  useCharacterMovementStore.getState().setCurrentBehavior(characterId, null)
}

/**
 * Drops `characterId`'s furniture reservation/occupancy bookkeeping only —
 * never repositions them or touches their movement status. For paths where
 * the caller is about to reposition or remove the character itself anyway
 * (character deletion, room deletion/relocation) and a `standUp`-style
 * "return to a safe point" would be redundant or actively wrong (that point
 * might be in a room about to be deleted). Safe to call unconditionally —
 * a no-op if the character isn't using any furniture. Releases only that
 * one character's own slot, never a neighbor's.
 */
export function releaseFurnitureUsage(characterId: string): void {
  useFurnitureUsageStore.getState().release(characterId)
}

/**
 * Ends *every* slot's occupant on `placementId` right now (a 2-seat sofa or
 * a 2-spot table can have two at once), resetting each one's movement
 * status too (unlike `releaseFurnitureUsage`, since here the *furniture* is
 * the thing changing/disappearing, not the character — they stay right
 * where they are, just no longer "using" anything; no repositioning here
 * either, for the same reason `standUp` doesn't reposition a 'stand' user —
 * only sit/lie ever needed it in the first place, and this function never
 * repositioned anyone even for those, by design, since the caller is about
 * to change the furniture's own geometry right after this call anyway).
 * Used whenever the furniture itself is deleted, moved, rotated, or resized
 * (see the call sites in FurnitureItem.tsx/FurniturePropertiesPanel.tsx/
 * DecorateScreen.tsx) — its geometry change invalidates every slot on it at
 * once, not just one, so a stale position must never be left standing for
 * *any* occupant. A no-op if nobody is using any slot on `placementId`.
 */
export function evictPlacementUsage(placementId: string): void {
  const occupants = Object.values(useFurnitureUsageStore.getState().bySeatKey).filter((usage) => usage.placementId === placementId)
  if (occupants.length === 0) return
  useFurnitureUsageStore.getState().releasePlacement(placementId)
  for (const usage of occupants) {
    const movement = useCharacterMovementStore.getState().byId[usage.characterId]
    if (!movement) continue
    useCharacterMovementStore.getState().setStatus(usage.characterId, 'idle')
    useCharacterMovementStore.getState().setDestination(usage.characterId, null)
    useCharacterMovementStore.getState().setCurrentBehavior(usage.characterId, null)
  }
}
