import { usableRooms } from '../home/homeStore'
import type { SaveActionResult } from './saveActions'
import { restoreSaveData } from './saveRestore'
import { serializeSaveData } from './saveSerializer'
import { writeSaveData } from './saveStorage'
import type { SaveData } from './saveTypes'
import { validateSaveData } from './saveValidate'

/** Far larger than any real backup (a handful of characters' PNGs as data URLs is a few MB at most), small enough that a wrong/hostile file can't make the tab read and parse hundreds of MB. */
export const BACKUP_MAX_BYTES = 50 * 1024 * 1024

const REJECTED_MESSAGE = '가져올 수 없는 백업 파일이에요.'

export type PrepareImportResult = { ok: true; data: SaveData } | { ok: false; message: string }

function readFileAsText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

/**
 * Step 1 of an import — read, parse and validate, **without touching any
 * app state or storage**. Validation is the existing `validateSaveData` (the
 * same function "불러오기" uses, including its schema 1 → 2 upgrade), plus one
 * check specific to importing a file from outside: at least one usable room.
 * `restoreHomeState` quietly keeps the *current* rooms when a save has none
 * usable, which for "불러오기" of the app's own save is a harmless fallback but
 * for a foreign file would mean half the current state survives next to
 * the imported characters — so a backup with no usable room is refused here.
 *
 * Never throws; every failure returns the same soft user message and keeps
 * the technical reason for `console.debug` only.
 */
export async function prepareBackupImport(file: File): Promise<PrepareImportResult> {
  try {
    if (file.size > BACKUP_MAX_BYTES) {
      console.debug('[save] import rejected: file too large', file.size)
      return { ok: false, message: REJECTED_MESSAGE }
    }

    const text = await readFileAsText(file)

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (error) {
      console.debug('[save] import rejected: invalid JSON', error)
      return { ok: false, message: REJECTED_MESSAGE }
    }

    const validated = validateSaveData(parsed)
    if (!validated.ok) {
      console.debug('[save] import rejected:', validated.reason)
      return { ok: false, message: REJECTED_MESSAGE }
    }

    if (usableRooms(validated.data.home.rooms).length === 0) {
      console.debug('[save] import rejected: no usable room')
      return { ok: false, message: REJECTED_MESSAGE }
    }

    return { ok: true, data: validated.data }
  } catch (error) {
    console.debug('[save] import failed unexpectedly', error)
    return { ok: false, message: REJECTED_MESSAGE }
  }
}

/**
 * Step 2 — apply already-validated data through the existing
 * `restoreSaveData`, then mirror the *restored* state into the one
 * localStorage slot (so "불러오기" after a refresh returns to it). The slot is
 * only ever written after the restore fully succeeded; a failed import never
 * touches it. If the restore itself throws part-way (unexpected — validation
 * already ran), the pre-import state is put back from a snapshot taken
 * beforehand, again through the existing restore path.
 */
export function commitBackupImport(data: SaveData): SaveActionResult {
  let snapshot: SaveData | null = null
  try {
    snapshot = serializeSaveData()
    restoreSaveData(data)
  } catch (error) {
    console.debug('[save] import restore failed', error)
    if (snapshot) {
      try {
        restoreSaveData(snapshot)
      } catch (rollbackError) {
        console.debug('[save] import rollback failed', rollbackError)
      }
    }
    return { ok: false, message: REJECTED_MESSAGE }
  }

  try {
    writeSaveData(serializeSaveData())
  } catch (error) {
    // The import itself worked; only mirroring it into the browser's save slot failed (full/blocked storage).
    console.debug('[save] import succeeded but the save slot could not be updated', error)
    return { ok: true, message: '가져왔어요. 다만 브라우저 저장 공간에는 저장하지 못했어요.' }
  }
  return { ok: true, message: '가져왔어요.' }
}
