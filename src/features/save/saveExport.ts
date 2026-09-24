import type { SaveActionResult } from './saveActions'
import { serializeSaveData } from './saveSerializer'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** `dearly-backup-YYYY-MM-DD.json`, using the user's *local* calendar date (not UTC) — a backup made at 1 AM shouldn't be labeled with yesterday's date. */
export function buildBackupFileName(date: Date = new Date()): string {
  return `dearly-backup-${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}.json`
}

/**
 * The backup file's contents are exactly the existing `SaveData` shape
 * (`saveSerializer.ts`'s `serializeSaveData`, the same function the
 * localStorage "저장" button uses) pretty-printed — never a separate export
 * format, so runtime-only state is excluded for the same reason it already is
 * there (see that file's own doc comment).
 */
export function serializeBackupJson(): string {
  return JSON.stringify(serializeSaveData(), null, 2)
}

/** Downloads the current state as a JSON backup file. Never throws — a failure (e.g. the browser refusing the download) becomes a user-facing message. */
export function exportBackup(): SaveActionResult {
  let url: string | null = null
  try {
    const blob = new Blob([serializeBackupJson()], { type: 'application/json' })
    url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = buildBackupFileName()
    // Some browsers only honor a download click on an anchor that's actually in the document.
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    return { ok: true, message: '백업 파일을 만들었어요.' }
  } catch (error) {
    console.debug('[save] export failed', error)
    return { ok: false, message: '백업 파일을 만들지 못했어요. 잠시 후 다시 시도해 주세요.' }
  } finally {
    if (url) URL.revokeObjectURL(url)
  }
}
