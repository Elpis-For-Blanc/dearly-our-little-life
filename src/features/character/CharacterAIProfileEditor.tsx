import { useState } from 'react'
import { NeedsStatusPanel } from '../needs/NeedsStatusPanel'
import { useCharacterStore } from './characterStore'
import { MAX_DISPLAY_SCALE, MAX_FOOT_OFFSET_RATIO, MIN_DISPLAY_SCALE, MIN_FOOT_OFFSET_RATIO } from './characterDisplay'
import { CharacterDialogueLineManager } from './CharacterDialogueLineManager'
import { CharacterToneForm } from './CharacterToneForm'
import { PersonalityPicker } from './PersonalityPicker'
import type { Character, CustomPersonalityTag } from './types'
import './CharacterAIProfileEditor.css'

type Tab = 'tone' | 'other'

interface OtherFieldSpec {
  key: 'personality' | 'habits' | 'preferredActivities' | 'relationship' | 'neverChange'
  label: string
  placeholder: string
}

const OTHER_FIELDS: OtherFieldSpec[] = [
  { key: 'personality', label: '성격 설명', placeholder: '예: 다정하지만 무뚝뚝하게 표현함' },
  { key: 'habits', label: '생활 습관', placeholder: '예: 아침에 늦잠을 잔다' },
  { key: 'preferredActivities', label: '선호 활동', placeholder: '예: 함께 요리하기' },
  { key: 'relationship', label: '관계 설정', placeholder: '예: 오래된 연인' },
  { key: 'neverChange', label: '절대 변경하면 안 되는 설정', placeholder: 'AI가 임의로 바꾸면 안 되는 사실을 입력하세요' },
]

interface CharacterAIProfileEditorProps {
  character: Character
}

export function CharacterAIProfileEditor({ character }: CharacterAIProfileEditorProps) {
  const updateAIProfile = useCharacterStore((state) => state.updateAIProfile)
  const setDisplayScale = useCharacterStore((state) => state.setDisplayScale)
  const setFootOffsetRatio = useCharacterStore((state) => state.setFootOffsetRatio)
  const [tab, setTab] = useState<Tab>('tone')

  function handleAddCustomTag(tag: CustomPersonalityTag) {
    updateAIProfile(character.id, { customPersonalityTags: [...character.aiProfile.customPersonalityTags, tag] })
  }

  // A deselected custom tag has nowhere else to live, so it's pruned from the registry too — re-adding it just means typing it again.
  function handleSelectionChange(nextSelectedTagIds: string[]) {
    const nextCustomTags = character.aiProfile.customPersonalityTags.filter((tag) => nextSelectedTagIds.includes(tag.id))
    updateAIProfile(character.id, { personalityTags: nextSelectedTagIds, customPersonalityTags: nextCustomTags })
  }

  return (
    <div className="character-ai-profile">
      <div className="character-ai-profile-tabs">
        <button type="button" className={tab === 'tone' ? 'active' : ''} onClick={() => setTab('tone')}>
          말투 및 대사
        </button>
        <button type="button" className={tab === 'other' ? 'active' : ''} onClick={() => setTab('other')}>
          기타 설정
        </button>
      </div>

      {tab === 'tone' ? (
        <>
          <CharacterToneForm characterId={character.id} tone={character.aiProfile.tone} />
          <CharacterDialogueLineManager character={character} />
        </>
      ) : (
        <div className="character-ai-profile-other">
          <NeedsStatusPanel characterId={character.id} />
          <label className="character-ai-profile-field character-display-scale-field">
            <span>
              함께 생활하기 화면 표시 크기 ({Math.round(character.displayScale * 100)}%)
            </span>
            <input
              type="range"
              min={MIN_DISPLAY_SCALE}
              max={MAX_DISPLAY_SCALE}
              step={0.05}
              value={character.displayScale}
              onChange={(event) => setDisplayScale(character.id, Number(event.target.value))}
            />
          </label>
          <label className="character-ai-profile-field character-display-scale-field">
            <span>발 위치 보정 ({character.footOffsetRatio > 0 ? '+' : ''}{Math.round(character.footOffsetRatio * 100)}%)</span>
            <input
              type="range"
              min={MIN_FOOT_OFFSET_RATIO}
              max={MAX_FOOT_OFFSET_RATIO}
              step={0.01}
              value={character.footOffsetRatio}
              onChange={(event) => setFootOffsetRatio(character.id, Number(event.target.value))}
            />
            <span className="character-ai-profile-hint">캐릭터가 공중에 떠 보이면 이미지 아래 여백만큼 조절하세요. 이동 좌표에는 영향을 주지 않아요.</span>
          </label>
          <PersonalityPicker
            selectedTagIds={character.aiProfile.personalityTags}
            customTags={character.aiProfile.customPersonalityTags}
            onChange={handleSelectionChange}
            onAddCustomTag={handleAddCustomTag}
          />
          {OTHER_FIELDS.map((field) => (
            <label key={field.key} className="character-ai-profile-field">
              <span>{field.label}</span>
              <textarea
                value={character.aiProfile[field.key]}
                placeholder={field.placeholder}
                rows={2}
                onChange={(event) => updateAIProfile(character.id, { [field.key]: event.target.value })}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
