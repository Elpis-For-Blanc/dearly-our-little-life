import { useRef, useState, type ChangeEvent } from 'react'
import { loadGame, saveGame } from './saveActions'
import { exportBackup } from './saveExport'
import { commitBackupImport, prepareBackupImport } from './saveImport'

/**
 * Manual save/load for the one fixed save slot plus JSON backup
 * export/import — mounted in `SetupScreen.tsx`'s 데이터 section. No
 * auto-save, no auto-load-on-refresh, no slot picker. All the actual logic
 * lives in `saveActions.ts` (저장/불러오기) and `saveExport.ts`/`saveImport.ts`
 * (내보내기/가져오기); this component only wires clicks and the file picker
 * to them, asks for confirmation, and renders the one shared status line.
 */
export function SaveLoadControls() {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleSave() {
    setResult(saveGame())
  }

  function handleLoad() {
    const confirmed = window.confirm('저장된 데이터를 불러오면 지금 화면의 저장하지 않은 변경 사항은 사라져요. 계속할까요?')
    if (!confirmed) return
    setResult(loadGame())
  }

  function handleExport() {
    setResult(exportBackup())
  }

  function handleImportClick() {
    fileInputRef.current?.click()
  }

  async function handleFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target
    const file = input.files?.[0]
    // Cleared so choosing the same file again (e.g. after fixing it) still fires a change event.
    input.value = ''
    if (!file) return

    // Validated first, before any prompt or state change — a bad file never even reaches the confirm.
    const prepared = await prepareBackupImport(file)
    if (!prepared.ok) {
      setResult({ ok: false, message: prepared.message })
      return
    }

    const confirmed = window.confirm('가져오면 현재 집 상태가 가져온 데이터로 바뀌어요.\n계속할까요?')
    if (!confirmed) {
      setResult({ ok: true, message: '가져오기를 취소했어요.' })
      return
    }
    setResult(commitBackupImport(prepared.data))
  }

  return (
    <>
      <button type="button" onClick={handleSave}>
        저장
      </button>
      <button type="button" onClick={handleLoad}>
        불러오기
      </button>
      <span className="setup-screen-data-break" aria-hidden="true" />
      <button type="button" onClick={handleExport}>
        내보내기
      </button>
      <button type="button" onClick={handleImportClick}>
        가져오기
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="setup-screen-data-file-input"
        aria-label="백업 파일 선택"
        tabIndex={-1}
        onChange={(event) => void handleFileChosen(event)}
      />
      {result && (
        <span className={`save-load-status ${result.ok ? 'save-load-status-ok' : 'save-load-status-error'}`} role="status">
          {result.message}
        </span>
      )}
    </>
  )
}
