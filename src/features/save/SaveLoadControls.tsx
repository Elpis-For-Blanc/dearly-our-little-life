import { useState } from 'react'
import { loadGame, saveGame } from './saveActions'

/**
 * Manual save/load for the one fixed save slot — mounted in
 * `DecorateToolbar.tsx`. No auto-save, no auto-load-on-refresh, no slot
 * picker: exactly the two buttons the spec asked for, each showing an
 * inline result message. All the actual logic lives in `saveActions.ts`;
 * this component only wires clicks to it and renders the result.
 */
export function SaveLoadControls() {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  function handleSave() {
    setResult(saveGame())
  }

  function handleLoad() {
    const confirmed = window.confirm('저장된 데이터를 불러오면 지금 화면의 저장하지 않은 변경 사항은 사라져요. 계속할까요?')
    if (!confirmed) return
    setResult(loadGame())
  }

  return (
    <>
      <button type="button" onClick={handleSave}>
        저장
      </button>
      <button type="button" onClick={handleLoad}>
        불러오기
      </button>
      {result && (
        <span className={`save-load-status ${result.ok ? 'save-load-status-ok' : 'save-load-status-error'}`} role="status">
          {result.message}
        </span>
      )}
    </>
  )
}
