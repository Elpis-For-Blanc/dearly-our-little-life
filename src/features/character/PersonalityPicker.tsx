import { useState } from 'react'
import {
  getPersonalityLabel,
  MAX_PERSONALITY_TAGS,
  PERSONALITY_CATEGORY_LABELS,
  PERSONALITY_CATEGORY_ORDER,
  PERSONALITY_TAG_DEFS,
  PERSONALITY_TAG_ORDER,
  type PersonalityCategory,
} from './personalityTags'
import type { CustomPersonalityTag } from './types'
import './PersonalityPicker.css'

interface PersonalityPickerProps {
  selectedTagIds: string[]
  customTags: CustomPersonalityTag[]
  onChange: (nextSelectedTagIds: string[]) => void
  onAddCustomTag: (tag: CustomPersonalityTag) => void
}

/**
 * The full personality-selection UI: category filter + search over the 71
 * built-in tags, selected tags shown as removable pills, a 0/5 counter, and
 * custom-tag creation. Reused as-is regardless of which character is being
 * edited — all selection state lives in `character.aiProfile` (via props),
 * never in this component, so switching characters or reloading never
 * loses anything this component itself would need to remember.
 */
export function PersonalityPicker({ selectedTagIds, customTags, onChange, onAddCustomTag }: PersonalityPickerProps) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<PersonalityCategory | 'all'>('all')
  const [customLabel, setCustomLabel] = useState('')
  const [customMappedTagId, setCustomMappedTagId] = useState('')

  const isFull = selectedTagIds.length >= MAX_PERSONALITY_TAGS

  function toggleTag(tagId: string) {
    const isSelected = selectedTagIds.includes(tagId)
    if (!isSelected && isFull) return
    onChange(isSelected ? selectedTagIds.filter((id) => id !== tagId) : [...selectedTagIds, tagId])
  }

  function removeTag(tagId: string) {
    onChange(selectedTagIds.filter((id) => id !== tagId))
  }

  function handleAddCustomTag() {
    const label = customLabel.trim()
    if (!label || isFull) return
    const tag: CustomPersonalityTag = {
      id: crypto.randomUUID(),
      label,
      mappedTagId: customMappedTagId || undefined,
    }
    onAddCustomTag(tag)
    onChange([...selectedTagIds, tag.id])
    setCustomLabel('')
    setCustomMappedTagId('')
  }

  const query = search.trim().toLowerCase()
  const visibleTagIds = PERSONALITY_TAG_ORDER.filter((id) => {
    const def = PERSONALITY_TAG_DEFS[id]
    if (category !== 'all' && def.category !== category) return false
    if (query && !def.label.toLowerCase().includes(query)) return false
    return true
  })

  return (
    <div className="personality-picker">
      <div className="personality-picker-header">
        <span>성격 (최대 {MAX_PERSONALITY_TAGS}개)</span>
        <span className="personality-picker-count">
          {selectedTagIds.length} / {MAX_PERSONALITY_TAGS}
        </span>
      </div>

      {selectedTagIds.length > 0 && (
        <div className="personality-selected-tags">
          {selectedTagIds.map((id) => (
            <span key={id} className="personality-selected-pill">
              {getPersonalityLabel(id, customTags)}
              <button type="button" aria-label={`${getPersonalityLabel(id, customTags)} 제거`} onClick={() => removeTag(id)}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {isFull && <p className="personality-limit-notice">최대 {MAX_PERSONALITY_TAGS}개까지 선택할 수 있어요. 다른 성격을 고르려면 먼저 하나를 해제해 주세요.</p>}

      <div className="personality-picker-controls">
        <input
          type="text"
          className="personality-search-input"
          placeholder="성격 검색"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="성격 검색"
        />
        <div className="personality-category-filter">
          <button type="button" className={category === 'all' ? 'personality-category-chip active' : 'personality-category-chip'} onClick={() => setCategory('all')}>
            전체
          </button>
          {PERSONALITY_CATEGORY_ORDER.map((cat) => (
            <button
              key={cat}
              type="button"
              className={category === cat ? 'personality-category-chip active' : 'personality-category-chip'}
              onClick={() => setCategory(cat)}
            >
              {PERSONALITY_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      <div className="personality-tag-grid">
        {visibleTagIds.length === 0 ? (
          <p className="personality-empty">검색 결과가 없어요.</p>
        ) : (
          visibleTagIds.map((id) => {
            const def = PERSONALITY_TAG_DEFS[id]
            const isSelected = selectedTagIds.includes(id)
            return (
              <button
                key={id}
                type="button"
                className={isSelected ? 'personality-tag active' : 'personality-tag'}
                title={def.description}
                disabled={!isSelected && isFull}
                onClick={() => toggleTag(id)}
              >
                {def.label}
              </button>
            )
          })
        )}
      </div>

      <div className="personality-custom-form">
        <input
          type="text"
          value={customLabel}
          onChange={(event) => setCustomLabel(event.target.value)}
          placeholder="직접 성격 추가하기"
          aria-label="커스텀 성격 이름"
        />
        <select
          value={customMappedTagId}
          onChange={(event) => setCustomMappedTagId(event.target.value)}
          aria-label="비슷한 기본 성격 (선택)"
        >
          <option value="">비슷한 기본 성격 없음</option>
          {PERSONALITY_TAG_ORDER.map((id) => (
            <option key={id} value={id}>
              {PERSONALITY_TAG_DEFS[id].label}
            </option>
          ))}
        </select>
        <button type="button" onClick={handleAddCustomTag} disabled={!customLabel.trim() || isFull}>
          추가
        </button>
      </div>
    </div>
  )
}
