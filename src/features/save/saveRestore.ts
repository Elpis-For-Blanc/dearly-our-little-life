import { DIALOGUE_FREQUENCY_PRESETS } from '../dialogue/autoDialogueConfig'
import { MONOLOGUE_FREQUENCY_PRESETS } from '../dialogue/monologueConfig'
import { RELATIONSHIP_PRESETS } from '../dialogue/relationshipConfig'
import { useDialogueFrequencyStore } from '../dialogue/dialogueFrequencyStore'
import { useMonologueFrequencyStore } from '../dialogue/monologueFrequencyStore'
import { useRelationshipStore } from '../dialogue/relationshipStore'
import { useCharacterStore } from '../character/characterStore'
import { useHomeStore } from '../home/homeStore'
import { useCharacterInteractionStore } from '../interaction/characterInteractionStore'
import { useRoomLightingSettingsStore } from '../lighting/roomLightingSettingsStore'
import { createDefaultNeeds } from '../needs/needsConfig'
import { normalizeNeedsById, useNeedsStore } from '../needs/needsStore'
import { useAutoFurnitureUseSettingsStore } from '../simulation/autoFurnitureUseSettingsStore'
import { useCharacterMovementStore } from '../simulation/characterMovementStore'
import type { RelationshipType } from '../dialogue/relationshipConfig'
import type { SaveData } from './saveTypes'

/** An invalid individual pair entry is simply dropped (that pair falls back to `defaultRelationshipType` at read time, same as any pair that was never set), never coerced to a guessed value. */
function normalizeRelationshipPairs(raw: unknown): Record<string, RelationshipType> {
  if (typeof raw !== 'object' || raw === null) return {}
  const result: Record<string, RelationshipType> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' && value in RELATIONSHIP_PRESETS) result[key] = value as RelationshipType
  }
  return result
}

/**
 * Applies a validated save snapshot through the app's normal store
 * actions/setState — never a raw `localStorage`/store-internals write, per
 * the "정상적인 restore 경로를 사용" requirement. `homeStore.restoreHomeState`
 * and `characterStore.restoreCharacters` reuse the very same defensive
 * normalizers the ordinary persist `merge` path already runs on every
 * reload, so a save blob with a stray malformed field is handled exactly as
 * gracefully as corrupted `localStorage` already is — never a crash.
 *
 * Deliberately touches nothing in `furnitureUsageStore`/`dialogueStore`/
 * `monologueStore`/any other ephemeral runtime store — those were never
 * saved in the first place (see `saveTypes.ts`), so there is nothing to
 * restore into them; they simply keep regenerating fresh, exactly as they
 * already do on an ordinary page reload. `characterInteractionStore`
 * (`features/interaction/`) is the one exception: it's explicitly `reset()`
 * below, not left alone — every restored character's movement status is
 * force-reset to `'idle'` a few lines down, and a stale in-progress hug/
 * sitTogether session left in that store would otherwise keep thinking a
 * now-idle character is still busy, permanently blocking it from starting
 * any new interaction after a restore.
 */
export function restoreSaveData(data: SaveData): void {
  useHomeStore.getState().restoreHomeState(data.home.rooms, data.home.activeDecorateRoomId, data.home.activeLiveRoomId)
  useCharacterStore.getState().restoreCharacters(data.characters.list)
  useCharacterInteractionStore.getState().reset()

  // Every restored character gets real needs data — a well-formed saved entry (schema 2) is used as-is; a missing
  // one (a v1 save migrated by saveValidate.ts, or a v2 save written before that character existed) falls back to
  // a fresh default rather than 0/undefined, exactly the same "never guess, always a safe default" discipline
  // `restoreHomeState`/`restoreCharacters` already follow.
  const normalizedNeeds = normalizeNeedsById(data.characters.needs)
  const needsById: Record<string, ReturnType<typeof createDefaultNeeds>> = {}
  for (const character of data.characters.list) {
    needsById[character.id] = normalizedNeeds[character.id] ?? createDefaultNeeds()
  }
  useNeedsStore.getState().restoreNeeds(needsById)

  // Seed each restored character's room location through the exact same store actions the live movement tick
  // itself uses (`syncCharacterIds` for a character with no entry yet, the ordinary per-field setters otherwise) —
  // never a direct state write. A saved roomId that no longer names a real room (e.g. that room was deleted in a
  // save written by a different session) falls back to the just-restored activeLiveRoomId, mirroring the tick
  // loop's own orphan-rescue fallback.
  //
  // Every restored character's movement entry is explicitly reset to a clean 'idle' state at its saved room's
  // doorway — not just newly-spawned ones. `syncCharacterIds` alone only fills in entries that don't exist yet; a
  // character already tracked in `characterMovementStore` (the ordinary case, since almost anyone visiting the Live
  // screen already has one) would otherwise keep whatever stale room/position/status it had *before* the restore
  // button was clicked, silently reintroducing exactly the runtime state this feature deliberately never saves.
  const restoredHome = useHomeStore.getState()
  const roomById = new Map(restoredHome.rooms.map((room) => [room.id, room]))
  const fallbackRoom = roomById.get(restoredHome.activeLiveRoomId) ?? restoredHome.rooms[0]
  const restoredIds = data.characters.list.map((c) => c.id)
  const movement = useCharacterMovementStore.getState()

  function resolveRestoredRoom(id: string) {
    const savedRoomId = data.characters.roomIdByCharacterId[id]
    return (typeof savedRoomId === 'string' ? roomById.get(savedRoomId) : undefined) ?? fallbackRoom
  }

  movement.syncCharacterIds(restoredIds, (id) => {
    const room = resolveRestoredRoom(id)
    return { position: room.doorway.entryPosition, roomId: room.id }
  })
  for (const id of restoredIds) {
    const room = resolveRestoredRoom(id)
    movement.setRoomId(id, room.id)
    movement.setPosition(id, room.doorway.entryPosition)
    movement.setDestination(id, null)
    movement.setDestinationRoomId(id, null)
    movement.setCurrentBehavior(id, null)
    movement.setStatus(id, 'idle')
    movement.setStuckTicks(id, 0)
    movement.setRestTicksRemaining(id, 0)
  }

  const settings = data.settings
  if (typeof settings.dialogueFrequency === 'string' && settings.dialogueFrequency in DIALOGUE_FREQUENCY_PRESETS) {
    useDialogueFrequencyStore.getState().setMode(settings.dialogueFrequency)
  }
  if (typeof settings.monologueFrequency === 'string' && Object.hasOwn(MONOLOGUE_FREQUENCY_PRESETS, settings.monologueFrequency)) {
    useMonologueFrequencyStore.getState().setMode(settings.monologueFrequency)
  }

  const relationship = settings.relationship
  if (relationship && typeof relationship.defaultRelationshipType === 'string' && relationship.defaultRelationshipType in RELATIONSHIP_PRESETS) {
    useRelationshipStore.setState({
      defaultRelationshipType: relationship.defaultRelationshipType,
      relationshipsByPair: normalizeRelationshipPairs(relationship.relationshipsByPair),
    })
  }

  if (typeof settings.autoFurnitureUseEnabled === 'boolean') {
    useAutoFurnitureUseSettingsStore.getState().setEnabled(settings.autoFurnitureUseEnabled)
  }

  const roomLighting = settings.roomLighting
  if (roomLighting) {
    if (typeof roomLighting.enabled === 'boolean') useRoomLightingSettingsStore.getState().setEnabled(roomLighting.enabled)
    if (typeof roomLighting.intensity === 'number') useRoomLightingSettingsStore.getState().setIntensity(roomLighting.intensity)
  }
}
