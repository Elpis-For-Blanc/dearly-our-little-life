import { SAVE_SCHEMA_VERSION, type SaveData } from './saveTypes'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export type ValidateSaveResult = { ok: true; data: SaveData } | { ok: false; reason: string }

/**
 * Structural validation only — deliberately shallow. It refuses a blob that
 * isn't recognizably *this feature's* save shape at all (missing
 * `schemaVersion`, a schema version this build doesn't know how to read,
 * or a missing top-level section), before any restore action ever runs.
 * It does **not** re-validate every room/placement/character/needs field
 * one by one — that finer-grained defense already exists and is reused
 * as-is: `homeStore.restoreHomeState`/`characterStore.restoreCharacters`/
 * `needsStore.restoreNeeds` run whatever arrives through the exact same
 * `usableRooms`/`normalizeRoom`/`loadCharacters`/`normalizeNeedsById`
 * normalizers the ordinary persist `merge` path already applies on every
 * page load, so a damaged individual entry is dropped there, not here.
 *
 * Accepts both schema 1 (the original shape, no `characters.needs` at all)
 * and schema 2 — a v1 blob is upgraded in place to the current shape here,
 * with an empty needs map (every character then gets a fresh default via
 * `saveRestore.ts`'s own per-character fallback) — never refused just for
 * predating the needs system.
 */
export function validateSaveData(raw: unknown): ValidateSaveResult {
  if (!isRecord(raw)) return { ok: false, reason: 'save data is not an object' }
  if (raw.schemaVersion !== 1 && raw.schemaVersion !== SAVE_SCHEMA_VERSION) {
    return { ok: false, reason: `unsupported schemaVersion: ${String(raw.schemaVersion)}` }
  }
  if (typeof raw.savedAt !== 'string') return { ok: false, reason: 'missing savedAt' }

  const home = raw.home
  if (!isRecord(home) || !Array.isArray(home.rooms) || typeof home.activeDecorateRoomId !== 'string' || typeof home.activeLiveRoomId !== 'string') {
    return { ok: false, reason: 'missing or malformed home section' }
  }

  const characters = raw.characters
  if (!isRecord(characters) || !Array.isArray(characters.list) || !isRecord(characters.roomIdByCharacterId)) {
    return { ok: false, reason: 'missing or malformed characters section' }
  }

  if (!isRecord(raw.settings)) return { ok: false, reason: 'missing settings section' }

  // v1 has no `characters.needs` at all (`undefined`, not just empty) — treat that, and anything else that isn't a
  // plain object, as "nothing saved for anyone", never a crash. `saveRestore.ts` fills in a fresh default per
  // character from there, the same "detect by field absence, never guess a shape" discipline `homeStore.ts`'s own
  // SCHEMA_VERSION migrations already established for window/rug and for legacy personality strings.
  const needs = isRecord(characters.needs) ? characters.needs : {}

  return {
    ok: true,
    data: {
      schemaVersion: SAVE_SCHEMA_VERSION,
      savedAt: raw.savedAt,
      home: raw.home,
      characters: { list: characters.list, roomIdByCharacterId: characters.roomIdByCharacterId, needs },
      settings: raw.settings,
    } as SaveData,
  }
}
