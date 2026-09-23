import type { SaveData } from './saveTypes'

/**
 * A single, fixed save slot for this phase — per the spec's own explicit
 * scope limit, multiple slots/auto-save/cloud/export-import are not built
 * here. A distinct key from every store's own `persist` key (`dearly-home`,
 * `dearly-characters`, …) — this is a deliberate manual snapshot, not
 * another auto-persisted store.
 */
export const SAVE_STORAGE_KEY = 'dearly-save-slot-1'

/** Never throws on a full/blocked localStorage (private browsing, quota) — the caller (`saveActions.ts`) surfaces a user-facing message instead of letting an exception escape. */
export function writeSaveData(data: SaveData): void {
  localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data))
}

export type ReadSaveResult = { ok: true; raw: unknown } | { ok: false; reason: 'missing' | 'invalid-json' }

/** Reads and JSON-parses the raw save blob. A missing key and invalid JSON are reported as two distinct, non-throwing outcomes — never an exception, and never confused with each other (the caller shows a different message for "nothing saved yet" vs. "the save data is corrupted"). */
export function readRawSaveData(): ReadSaveResult {
  const stored = localStorage.getItem(SAVE_STORAGE_KEY)
  if (stored === null) return { ok: false, reason: 'missing' }
  try {
    return { ok: true, raw: JSON.parse(stored) }
  } catch {
    return { ok: false, reason: 'invalid-json' }
  }
}
