import { useCharacterStore } from '../character/characterStore'
import { useCharacterMovementStore } from '../simulation/characterMovementStore'
import { applyNeedsDecayTick } from './needsSimulation'
import { useNeedsStore } from './needsStore'

/**
 * The single entry point for the needs simulation — called exactly once per
 * movement tick from `useCharacterMovementSimulation.ts`, mirroring
 * `monologueTrigger.ts`'s `runMonologuePass`/`autoFurnitureUseTrigger.ts`'s
 * `runAutoFurnitureUsePass` hook-point pattern exactly: no timer of its
 * own, reuses the one existing simulation tick (so needs only ever change
 * while the Live screen is open and the simulation isn't paused — never on
 * every React render, per the spec's own "앱 렌더링마다 값을 깎지 말 것").
 *
 * For each registered character: ensure a needs entry exists (covers a
 * character added since the last tick — `CharacterForm.tsx`'s own
 * registration handler already does this too, so this is a defensive
 * fallback, not the only place it happens), then apply exactly one decay/
 * recovery tick, observing that character's *current* movement status and
 * room-mates — never reading or writing `furnitureUsageStore`/
 * `characterMovementStore` itself, only observing what's already there.
 */
export function runNeedsPass(): void {
  const characters = useCharacterStore.getState().characters
  if (characters.length === 0) return

  const needsStore = useNeedsStore.getState()
  for (const character of characters) needsStore.ensureCharacter(character.id)

  const movementById = useCharacterMovementStore.getState().byId

  // How many registered characters currently occupy each room — used only to answer "is anyone else here with me",
  // never to identify *who* (that's not needed for the social decay rule).
  const occupantCountByRoom = new Map<string, number>()
  for (const character of characters) {
    const roomId = movementById[character.id]?.roomId
    if (!roomId) continue
    occupantCountByRoom.set(roomId, (occupantCountByRoom.get(roomId) ?? 0) + 1)
  }

  for (const character of characters) {
    const movement = movementById[character.id]
    if (!movement) continue // not yet synced into characterMovementStore this session — next tick will have it
    const current = useNeedsStore.getState().byId[character.id]
    if (!current) continue // ensureCharacter above should have created it; stay safe rather than throw
    const hasRoommate = (occupantCountByRoom.get(movement.roomId) ?? 0) > 1
    const next = applyNeedsDecayTick(current, { status: movement.status, hasRoommate })
    useNeedsStore.getState().setNeeds(character.id, next)
  }
}
