import { useCharacterStore } from './characterStore'
import type { BaseTone, CharacterToneSettings } from './types'

const BASE_TONE_OPTIONS: { value: BaseTone; label: string }[] = [
  { value: 'formal', label: '존댓말' },
  { value: 'casual', label: '반말' },
  { value: 'mixed', label: '혼합' },
  { value: 'custom', label: '직접 설정' },
]

interface CharacterToneFormProps {
  characterId: string
  tone: CharacterToneSettings
}

/**
 * The baseTone select is a shortcut only — toneDetail (free text) is always
 * shown and is what actually gets sent to the AI, per the spec's rule that
 * free input takes priority over the picker.
 */
export function CharacterToneForm({ characterId, tone }: CharacterToneFormProps) {
  const updateToneSettings = useCharacterStore((state) => state.updateToneSettings)

  function set<K extends keyof CharacterToneSettings>(key: K, value: CharacterToneSettings[K]) {
    updateToneSettings(characterId, { [key]: value })
  }

  return (
    <div className="character-tone-form">
      <label className="character-ai-profile-field">
        <span>기본 말투</span>
        <select value={tone.baseTone} onChange={(event) => set('baseTone', event.target.value as BaseTone)}>
          {BASE_TONE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="character-ai-profile-field">
        <span>말투 특징 (자유 입력 — 항상 우선 적용돼요)</span>
        <textarea
          value={tone.toneDetail}
          placeholder="예: 다정하지만 무뚝뚝하게 표현함"
          rows={2}
          onChange={(event) => set('toneDetail', event.target.value)}
        />
      </label>

      <label className="character-ai-profile-field">
        <span>일인칭 표현</span>
        <input type="text" value={tone.firstPerson} placeholder="예: 나, 저" onChange={(event) => set('firstPerson', event.target.value)} />
      </label>

      <label className="character-ai-profile-field">
        <span>상대를 부르는 호칭</span>
        <input
          type="text"
          value={tone.addressForPartner}
          placeholder="예: 자기야"
          onChange={(event) => set('addressForPartner', event.target.value)}
        />
      </label>

      <label className="character-ai-profile-field">
        <span>자주 사용하는 표현</span>
        <textarea
          value={tone.catchphrases}
          placeholder="쉼표로 구분해 여러 개 입력 가능"
          rows={2}
          onChange={(event) => set('catchphrases', event.target.value)}
        />
      </label>

      <label className="character-ai-profile-field">
        <span>사용하지 않는 표현</span>
        <textarea
          value={tone.avoidPhrases}
          placeholder="쉼표로 구분해 여러 개 입력 가능"
          rows={2}
          onChange={(event) => set('avoidPhrases', event.target.value)}
        />
      </label>

      <label className="character-ai-profile-field">
        <span>말버릇</span>
        <input type="text" value={tone.verbalTic} placeholder="예: 문장 끝에 '~냥' 붙이기" onChange={(event) => set('verbalTic', event.target.value)} />
      </label>
    </div>
  )
}
