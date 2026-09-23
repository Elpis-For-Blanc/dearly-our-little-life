import { useState } from 'react'
import { applyDecorPreset, revertLastDecorPreset } from './decorPresetApply'
import {
  DECOR_PRESET_CATEGORY_LABELS,
  DECOR_PRESET_CATEGORY_ORDER,
  DECOR_PRESETS,
  type DecorPresetCategory,
  type DecorPresetDefinition,
} from './decorPresets'
import { DecorPresetPreview } from './DecorPresetPreview'
import { getActiveDecorateRoom, useHomeStore } from './homeStore'
import { useRoomDecorBackupStore } from './roomDecorBackupStore'
import './DecorPresetPanel.css'

type CategoryFilter = 'all' | DecorPresetCategory

const CATEGORY_FILTER_LABELS: Record<CategoryFilter, string> = { all: '전체', ...DECOR_PRESET_CATEGORY_LABELS }
const CATEGORY_FILTER_ORDER: CategoryFilter[] = ['all', ...DECOR_PRESET_CATEGORY_ORDER]

/**
 * "방 프리셋" tab in `DecorateScreen.tsx` — a filterable card grid, a
 * store-independent full-room preview (`DecorPresetPreview.tsx`), and the
 * confirm-then-apply / one-step-revert flow (`decorPresetApply.ts`).
 * Selecting a preset or opening its preview never touches the real room —
 * only clicking "적용" (either on a card or inside the preview modal) does,
 * and only after the explicit confirmation dialog the spec requires.
 */
export function DecorPresetPanel() {
  const room = useHomeStore((state) => getActiveDecorateRoom(state))
  const backupByRoomId = useRoomDecorBackupStore((state) => state.byRoomId)
  const canRevert = room.id in backupByRoomId

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [previewPreset, setPreviewPreset] = useState<DecorPresetDefinition | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const visiblePresets = categoryFilter === 'all' ? DECOR_PRESETS : DECOR_PRESETS.filter((preset) => preset.category === categoryFilter)

  function handleApply(preset: DecorPresetDefinition) {
    const confirmed = window.confirm(
      `이 프리셋을 적용하면 "${room.name}" 방의 벽지·바닥·가구 배치가 변경돼요. 기존 배치로 되돌릴 수 있도록 백업할까요? (적용 직후 한 번만 되돌릴 수 있고, 새로고침하면 백업이 사라져요)`,
    )
    if (!confirmed) return

    const outcome = applyDecorPreset(preset)
    setMessage(outcome.ok ? `"${preset.name}" 프리셋을 적용했어요.` : outcome.reason)
    if (outcome.ok) setPreviewPreset(null)
  }

  function handleRevert() {
    const outcome = revertLastDecorPreset()
    setMessage(outcome.ok ? '이전 상태로 되돌렸어요.' : outcome.reason)
  }

  return (
    <div className="decor-preset-panel">
      <div className="decor-preset-panel-header">
        <span>방 프리셋</span>
        {canRevert && (
          <button type="button" className="decor-preset-panel-revert" onClick={handleRevert}>
            되돌리기
          </button>
        )}
      </div>
      <p className="decor-preset-panel-hint">
        프리셋을 적용하면 &quot;{room.name}&quot; 방의 벽지·바닥·가구가 모두 교체돼요. 적용 직전 상태는 한 번 되돌릴 수 있도록 백업되지만, 새로고침하면 사라져요.
      </p>

      <div className="decor-preset-panel-filters" role="group" aria-label="프리셋 카테고리">
        {CATEGORY_FILTER_ORDER.map((category) => (
          <button
            key={category}
            type="button"
            className={category === categoryFilter ? 'decor-preset-panel-filter active' : 'decor-preset-panel-filter'}
            onClick={() => setCategoryFilter(category)}
          >
            {CATEGORY_FILTER_LABELS[category]}
          </button>
        ))}
      </div>

      <div className="decor-preset-grid">
        {visiblePresets.map((preset) => (
          <article key={preset.id} className="decor-preset-card">
            <div className="decor-preset-card-swatches">
              {preset.accentColors.map((color) => (
                <span key={color} className="decor-preset-card-swatch" style={{ backgroundColor: color }} />
              ))}
            </div>
            <h3>{preset.name}</h3>
            <p className="decor-preset-card-description">{preset.description}</p>
            <div className="decor-preset-card-tags">
              {preset.tags.map((tag) => (
                <span key={tag} className="decor-preset-card-tag">
                  #{tag}
                </span>
              ))}
            </div>
            <div className="decor-preset-card-actions">
              <button type="button" onClick={() => setPreviewPreset(preset)}>
                미리보기
              </button>
              <button type="button" className="decor-preset-card-apply" onClick={() => handleApply(preset)}>
                적용
              </button>
            </div>
          </article>
        ))}
      </div>

      {message && <p className="decor-preset-panel-message">{message}</p>}

      {previewPreset && (
        <div className="decor-preset-preview-overlay" role="dialog" aria-label={`${previewPreset.name} 미리보기`}>
          <div className="decor-preset-preview-modal">
            <div className="decor-preset-preview-modal-header">
              <h3>{previewPreset.name}</h3>
              <button type="button" onClick={() => setPreviewPreset(null)} aria-label="미리보기 닫기">
                ×
              </button>
            </div>
            <DecorPresetPreview preset={previewPreset} />
            <div className="decor-preset-preview-modal-actions">
              <button type="button" className="decor-preset-card-apply" onClick={() => handleApply(previewPreset)}>
                이 프리셋 적용
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
