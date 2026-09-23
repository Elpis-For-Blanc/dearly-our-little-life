import { useState } from 'react'
import { getAllSituationCategories, useSituationCategoryStore } from '../dialogue/situationCategoryStore'
import { CharacterDialoguePreview } from './CharacterDialoguePreview'
import { useCharacterStore } from './characterStore'
import type { Character, CharacterDialogueLine } from './types'

interface CharacterDialogueLineManagerProps {
  character: Character
}

function parseTags(input: string): string[] {
  return input
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

/**
 * Add/edit/delete/reorder for one character's example dialogue lines, plus
 * a preview trigger (CharacterDialoguePreview) reusing the real bubble
 * component. Add and edit share one form: clicking "수정" pre-fills it and
 * switches the submit button into an update.
 */
export function CharacterDialogueLineManager({ character }: CharacterDialogueLineManagerProps) {
  const lines = character.aiProfile.dialogueLines
  const addDialogueLine = useCharacterStore((state) => state.addDialogueLine)
  const updateDialogueLine = useCharacterStore((state) => state.updateDialogueLine)
  const removeDialogueLine = useCharacterStore((state) => state.removeDialogueLine)
  const reorderDialogueLines = useCharacterStore((state) => state.reorderDialogueLines)

  const customCategories = useSituationCategoryStore((state) => state.customCategories)
  const addCategory = useSituationCategoryStore((state) => state.addCategory)
  const categories = getAllSituationCategories(customCategories)

  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [situationNote, setSituationNote] = useState('')
  const [text, setText] = useState('')
  const [emotion, setEmotion] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [isFallback, setIsFallback] = useState(false)
  const [newCategoryLabel, setNewCategoryLabel] = useState('')
  const [previewLineId, setPreviewLineId] = useState<string | null>(null)
  const [editingLineId, setEditingLineId] = useState<string | null>(null)

  function resetForm() {
    setSituationNote('')
    setText('')
    setEmotion('')
    setTagsInput('')
    setIsFallback(false)
  }

  function handleAddCategory() {
    if (!newCategoryLabel.trim()) return
    const category = addCategory(newCategoryLabel.trim())
    setNewCategoryLabel('')
    setCategoryId(category.id)
  }

  function handleSubmit() {
    if (!text.trim()) return
    const patch = {
      categoryId: categoryId || categories[0]?.id || '',
      situationNote: situationNote.trim(),
      text: text.trim(),
      emotion: emotion.trim(),
      tags: parseTags(tagsInput),
      isFallback,
    }

    if (editingLineId) {
      updateDialogueLine(character.id, editingLineId, patch)
      setEditingLineId(null)
    } else {
      addDialogueLine(character.id, { id: crypto.randomUUID(), ...patch })
    }
    resetForm()
  }

  function startEdit(line: CharacterDialogueLine) {
    setEditingLineId(line.id)
    setCategoryId(line.categoryId)
    setSituationNote(line.situationNote)
    setText(line.text)
    setEmotion(line.emotion)
    setTagsInput(line.tags.join(', '))
    setIsFallback(line.isFallback)
  }

  function cancelEdit() {
    setEditingLineId(null)
    resetForm()
  }

  function moveLine(lineId: string, direction: -1 | 1) {
    const index = lines.findIndex((line) => line.id === lineId)
    if (index === -1) return
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= lines.length) return

    const orderedIds = lines.map((line) => line.id)
    const [moved] = orderedIds.splice(index, 1)
    orderedIds.splice(targetIndex, 0, moved)
    reorderDialogueLines(character.id, orderedIds)
  }

  function categoryLabel(id: string) {
    return categories.find((category) => category.id === id)?.label ?? id
  }

  const previewLine = lines.find((line) => line.id === previewLineId) ?? null

  return (
    <div className="dialogue-line-manager">
      <div className="dialogue-line-add-form">
        <label className="character-ai-profile-field">
          <span>상황 카테고리</span>
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </label>

        <div className="dialogue-line-add-category">
          <input
            type="text"
            value={newCategoryLabel}
            placeholder="새 카테고리 이름"
            onChange={(event) => setNewCategoryLabel(event.target.value)}
          />
          <button type="button" onClick={handleAddCategory}>
            카테고리 추가
          </button>
        </div>

        <label className="character-ai-profile-field">
          <span>상황 (선택)</span>
          <input
            type="text"
            value={situationNote}
            placeholder="예: 아침에 상대를 깨울 때"
            onChange={(event) => setSituationNote(event.target.value)}
          />
        </label>

        <label className="character-ai-profile-field">
          <span>대사</span>
          <textarea value={text} rows={2} placeholder="예: 일어날 시간입니다." onChange={(event) => setText(event.target.value)} />
        </label>

        <label className="character-ai-profile-field">
          <span>감정</span>
          <input type="text" value={emotion} placeholder="예: 다정함" onChange={(event) => setEmotion(event.target.value)} />
        </label>

        <label className="character-ai-profile-field">
          <span>태그</span>
          <input type="text" value={tagsInput} placeholder="쉼표로 구분: 아침, 기상" onChange={(event) => setTagsInput(event.target.value)} />
        </label>

        <label className="dialogue-line-fallback-toggle">
          <input type="checkbox" checked={isFallback} onChange={(event) => setIsFallback(event.target.checked)} />
          <span>이 카테고리에 등록된 다른 대사가 없을 때도 사용할 기본 대사로 허용</span>
        </label>

        <div className="dialogue-line-form-actions">
          <button type="button" onClick={handleSubmit} disabled={!text.trim()}>
            {editingLineId ? '대사 수정 저장' : '대사 추가'}
          </button>
          {editingLineId && (
            <button type="button" onClick={cancelEdit}>
              취소
            </button>
          )}
        </div>
      </div>

      {lines.length === 0 ? (
        <p className="dialogue-line-empty">아직 등록된 예시 대사가 없어요.</p>
      ) : (
        <ul className="dialogue-line-list">
          {lines.map((line, index) => (
            <li key={line.id} className="dialogue-line-item">
              <div className="dialogue-line-item-header">
                <span className="dialogue-line-category">{categoryLabel(line.categoryId)}</span>
                {line.isFallback && <span className="dialogue-line-fallback-badge">기본 대사</span>}
              </div>
              {line.situationNote && <p className="dialogue-line-note">{line.situationNote}</p>}
              <p className="dialogue-line-text">{line.text}</p>
              {(line.emotion || line.tags.length > 0) && (
                <p className="dialogue-line-meta">
                  {line.emotion && `감정: ${line.emotion}`}
                  {line.emotion && line.tags.length > 0 && ' · '}
                  {line.tags.length > 0 && `태그: ${line.tags.join(', ')}`}
                </p>
              )}
              <div className="dialogue-line-actions">
                <button type="button" onClick={() => moveLine(line.id, -1)} disabled={index === 0}>
                  위로
                </button>
                <button type="button" onClick={() => moveLine(line.id, 1)} disabled={index === lines.length - 1}>
                  아래로
                </button>
                <button type="button" onClick={() => setPreviewLineId(line.id)}>
                  미리보기
                </button>
                <button type="button" onClick={() => startEdit(line)}>
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeDialogueLine(character.id, line.id)
                    if (previewLineId === line.id) setPreviewLineId(null)
                    if (editingLineId === line.id) cancelEdit()
                  }}
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CharacterDialoguePreview character={character} line={previewLine} />
    </div>
  )
}
