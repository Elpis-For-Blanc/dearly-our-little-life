import { useCharacterStore } from '../character/characterStore'
import { useDialogueFrequencyStore } from '../dialogue/dialogueFrequencyStore'
import { useMonologueFrequencyStore } from '../dialogue/monologueFrequencyStore'
import { useRelationshipStore } from '../dialogue/relationshipStore'
import { useHomeStore } from '../home/homeStore'
import { useRoomLightingSettingsStore } from '../lighting/roomLightingSettingsStore'
import { useNeedsStore } from '../needs/needsStore'
import { useAutoFurnitureUseSettingsStore } from '../simulation/autoFurnitureUseSettingsStore'
import { useCharacterMovementStore } from '../simulation/characterMovementStore'
import { SAVE_SCHEMA_VERSION, type SaveData } from './saveTypes'

/**
 * Builds a save snapshot from live store state — explicit field-by-field,
 * never a wholesale `JSON.stringify(store.getState())` (which would also
 * capture ephemeral fields like `homeStore.selectedFurnitureId` and every
 * store's action functions, and couldn't be given its own independent
 * `schemaVersion`). Runtime simulation state — exact position, destination,
 * seated/talking status, stuckTicks, active conversations/monologues — is
 * deliberately excluded; see `saveTypes.ts`'s own doc comment on
 * `roomIdByCharacterId` for the one piece of movement state that *is* saved.
 */
export function serializeSaveData(): SaveData {
  const home = useHomeStore.getState()
  const characters = useCharacterStore.getState().characters
  const movementById = useCharacterMovementStore.getState().byId
  const relationship = useRelationshipStore.getState()
  const roomLighting = useRoomLightingSettingsStore.getState()

  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    home: {
      rooms: home.rooms,
      activeDecorateRoomId: home.activeDecorateRoomId,
      activeLiveRoomId: home.activeLiveRoomId,
    },
    characters: {
      list: characters,
      roomIdByCharacterId: Object.fromEntries(characters.map((c) => [c.id, movementById[c.id]?.roomId ?? home.activeLiveRoomId])),
      needs: useNeedsStore.getState().byId,
    },
    settings: {
      dialogueFrequency: useDialogueFrequencyStore.getState().mode,
      monologueFrequency: useMonologueFrequencyStore.getState().mode,
      relationship: {
        defaultRelationshipType: relationship.defaultRelationshipType,
        relationshipsByPair: relationship.relationshipsByPair,
      },
      autoFurnitureUseEnabled: useAutoFurnitureUseSettingsStore.getState().enabled,
      roomLighting: { enabled: roomLighting.enabled, intensity: roomLighting.intensity },
    },
  }
}
