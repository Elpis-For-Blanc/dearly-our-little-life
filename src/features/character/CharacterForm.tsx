import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { createDefaultNeeds } from '../needs/needsConfig'
import { useNeedsStore } from '../needs/needsStore'
import { useCharacterStore } from './characterStore'
import { DEFAULT_DISPLAY_SCALE, DEFAULT_FOOT_OFFSET_RATIO } from './characterDisplay'
import { analyzeCharacterImageBounds, type CharacterImageBounds } from './characterImageAnalysis'
import { readImageAsDataUrl } from './imageFile'
import { PersonalityPicker } from './PersonalityPicker'
import { EMPTY_AI_PROFILE, type Character, type CustomPersonalityTag } from './types'

export const MAX_CHARACTERS = 5

export function CharacterForm() {
  const characterCount = useCharacterStore((state) => state.characters.length)
  const addCharacter = useCharacterStore((state) => state.addCharacter)

  const [name, setName] = useState('')
  const [personalityTags, setPersonalityTags] = useState<string[]>([])
  const [customPersonalityTags, setCustomPersonalityTags] = useState<CustomPersonalityTag[]>([])
  const [favoriteColor, setFavoriteColor] = useState('')
  const [imageDataUrl, setImageDataUrl] = useState('')
  const [imageBounds, setImageBounds] = useState<CharacterImageBounds | null>(null)
  const [error, setError] = useState('')

  const isFull = characterCount >= MAX_CHARACTERS

  // Guards a background analysis result against landing after the user has
  // already picked a *different* image (or cleared the form) — each upload
  // gets its own token, and only the most recent one is allowed to apply.
  const analysisTokenRef = useRef(0)

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있어요.')
      event.target.value = ''
      return
    }

    setError('')
    const dataUrl = await readImageAsDataUrl(file)
    setImageDataUrl(dataUrl)
    setImageBounds(null)

    // Analysis runs in the background and never blocks the preview or the
    // submit button — if it hasn't finished (or fails) by the time the user
    // submits, the character is still created normally, just without the
    // bbox-based correction (the same safe fallback as never having it).
    const token = ++analysisTokenRef.current
    void analyzeCharacterImageBounds(dataUrl).then((bounds) => {
      if (analysisTokenRef.current === token) setImageBounds(bounds)
    })
  }

  function handlePersonalitySelectionChange(nextSelectedTagIds: string[]) {
    setPersonalityTags(nextSelectedTagIds)
    setCustomPersonalityTags((prev) => prev.filter((tag) => nextSelectedTagIds.includes(tag.id)))
  }

  function handleAddCustomPersonalityTag(tag: CustomPersonalityTag) {
    setCustomPersonalityTags((prev) => [...prev, tag])
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (isFull) return

    if (!name.trim() || !imageDataUrl) {
      setError('이름과 이미지를 모두 입력해 주세요.')
      return
    }

    const character: Character = {
      id: crypto.randomUUID(),
      name: name.trim(),
      imageDataUrl,
      displayScale: DEFAULT_DISPLAY_SCALE,
      footOffsetRatio: DEFAULT_FOOT_OFFSET_RATIO,
      imageBounds,
      traits: {
        personality: '',
        favoriteColor: favoriteColor.trim(),
      },
      aiProfile: {
        ...EMPTY_AI_PROFILE,
        personalityTags,
        customPersonalityTags,
      },
    }

    addCharacter(character)
    // A brand-new character gets its own genuinely randomized starting needs (65–85 each) the moment it's
    // registered — deliberately `setNeeds` with a fresh `createDefaultNeeds()` roll here, not the store's own
    // `ensureCharacter` (which is a *deterministic* tick-time fallback only — see its doc comment for why).
    useNeedsStore.getState().setNeeds(character.id, createDefaultNeeds())
    setName('')
    setImageBounds(null)
    setPersonalityTags([])
    setCustomPersonalityTags([])
    setFavoriteColor('')
    setImageDataUrl('')
    setError('')
  }

  if (isFull) {
    return <p className="character-form-full">캐릭터는 최대 {MAX_CHARACTERS}명까지 등록할 수 있어요.</p>
  }

  return (
    <form className="character-form" onSubmit={handleSubmit}>
      <label className="character-form-field">
        이미지
        <input type="file" accept="image/*" onChange={handleImageChange} />
      </label>

      {imageDataUrl && (
        <img src={imageDataUrl} alt="" className="character-form-preview" />
      )}

      <label className="character-form-field">
        이름
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="캐릭터 이름"
        />
      </label>

      <PersonalityPicker
        selectedTagIds={personalityTags}
        customTags={customPersonalityTags}
        onChange={handlePersonalitySelectionChange}
        onAddCustomTag={handleAddCustomPersonalityTag}
      />

      <label className="character-form-field">
        좋아하는 색
        <input
          type="text"
          value={favoriteColor}
          onChange={(event) => setFavoriteColor(event.target.value)}
          placeholder="예: 파랑"
        />
      </label>

      {error && <p className="character-form-error">{error}</p>}

      <button type="submit">캐릭터 등록</button>
    </form>
  )
}
