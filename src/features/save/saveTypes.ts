import type { DialogueFrequencyMode } from '../dialogue/autoDialogueConfig'
import type { MonologueFrequencyMode } from '../dialogue/monologueConfig'
import type { RelationshipType } from '../dialogue/relationshipConfig'
import type { Character } from '../character/types'
import type { Room } from '../home/roomTypes'
import type { CharacterNeeds } from '../needs/needsTypes'

/**
 * Bumped whenever this save shape changes in a way a future migration would
 * need to handle — independent of `homeStore`'s own `SCHEMA_VERSION` (this
 * feature has its own localStorage key/version, not a shape change to any
 * existing persisted store). 1 = the original shape (rooms/characters/
 * settings, no needs). 2 = added `characters.needs` (the 캐릭터 욕구/기분
 * system) — `saveValidate.ts` accepts both and upgrades a v1 blob in place
 * (an empty needs map, which `saveRestore.ts`'s own per-character fallback
 * then fills with fresh defaults) rather than refusing it; existing v1
 * saves must keep loading correctly.
 */
export const SAVE_SCHEMA_VERSION = 2

interface SaveDataBase {
  /** ISO timestamp of when this save was written — informational only, never read by restore logic. */
  savedAt: string
  home: {
    rooms: Room[]
    /** Which room the 꾸미기 screen was editing when saved. */
    activeDecorateRoomId: string
    /** Which room the 라이브 screen was observing when saved. */
    activeLiveRoomId: string
  }
  settings: {
    dialogueFrequency: DialogueFrequencyMode
    monologueFrequency: MonologueFrequencyMode
    relationship: {
      defaultRelationshipType: RelationshipType
      relationshipsByPair: Record<string, RelationshipType>
    }
    autoFurnitureUseEnabled: boolean
    roomLighting: {
      enabled: boolean
      intensity: number
    }
  }
}

/** The original save shape (schema 1) — kept only as `saveValidate.ts`'s migration input type; nothing else should construct or expect this shape. */
export interface SaveDataV1 extends SaveDataBase {
  schemaVersion: 1
  characters: {
    list: Character[]
    /**
     * Which room each registered character was physically standing in when
     * saved — the one piece of `characterMovementStore` state this feature
     * saves, since "캐릭터의 방 위치" was explicitly requested. Everything
     * else about a character's live movement (exact x/y, destination,
     * seated/lying/lingering/talking status, stuckTicks, walk animation) is
     * deliberately **not** saved — it's ephemeral simulation state that
     * regenerates every session, exactly like `characterMovementStore`
     * itself is never persisted. On restore, a character reappears at their
     * saved room's own doorway (idle), not at their exact last coordinate.
     */
    roomIdByCharacterId: Record<string, string>
  }
}

/**
 * The one explicit save data shape — deliberately its own type, not a
 * wholesale dump of any store's live state (which would also capture
 * ephemeral UI/runtime fields, action functions, and everything else a
 * store shouldn't be re-hydrated from). Every field here is something
 * CLAUDE.md's own "Saved data is loaded defensively" section already
 * treats as real save data (settings/content), never live simulation state.
 */
export interface SaveDataV2 extends SaveDataBase {
  schemaVersion: 2
  characters: {
    list: Character[]
    roomIdByCharacterId: Record<string, string>
    /**
     * Each registered character's hunger/energy/fun/social at save time —
     * added in schema v2. Mood is deliberately **not** saved here: it's
     * always recomputed from needs (`moodEngine.ts`'s `deriveMood`), per the
     * spec's own "기분은 저장되는 원본 데이터라기보다는 욕구값에서 계산되는
     * derived state로". A character missing an entry here (a v1 save, or
     * any save written before that character was registered) falls back to
     * a fresh default on restore rather than guessing — see
     * `saveRestore.ts`.
     */
    needs: Record<string, CharacterNeeds>
  }
}

export type SaveData = SaveDataV2
