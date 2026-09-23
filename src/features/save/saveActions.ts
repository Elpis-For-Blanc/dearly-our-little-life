import { restoreSaveData } from './saveRestore'
import { serializeSaveData } from './saveSerializer'
import { readRawSaveData, writeSaveData } from './saveStorage'
import { validateSaveData } from './saveValidate'

export interface SaveActionResult {
  ok: boolean
  message: string
}

/** Writes the current state to the one save slot. Never throws — a full/blocked `localStorage` (private browsing, quota) becomes a user-facing message instead of an uncaught exception. */
export function saveGame(): SaveActionResult {
  try {
    writeSaveData(serializeSaveData())
    return { ok: true, message: '저장했어요.' }
  } catch {
    return { ok: false, message: '저장하지 못했어요. 잠시 후 다시 시도해 주세요.' }
  }
}

/**
 * Reads, validates, and restores the one save slot. Every failure mode —
 * nothing saved yet, invalid JSON, a missing/unsupported `schemaVersion`, a
 * missing required section, or an unexpected error while applying the
 * restore — returns a distinct, non-throwing result with its own message;
 * none of them ever crash the app or leave it half-restored (every restore
 * action either fully replaces its own store's state or is skipped
 * entirely — see `saveRestore.ts`).
 */
export function loadGame(): SaveActionResult {
  const raw = readRawSaveData()
  if (!raw.ok) {
    if (raw.reason === 'missing') return { ok: false, message: '저장된 데이터가 없어요.' }
    return { ok: false, message: '저장된 데이터를 읽을 수 없어요. 파일이 손상되었을 수 있어요.' }
  }

  const validated = validateSaveData(raw.raw)
  if (!validated.ok) {
    return { ok: false, message: '저장된 데이터 형식이 올바르지 않아요.' }
  }

  try {
    restoreSaveData(validated.data)
    return { ok: true, message: '불러왔어요.' }
  } catch {
    return { ok: false, message: '불러오는 중 문제가 발생했어요.' }
  }
}
