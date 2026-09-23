import { useState } from 'react'
import { endActiveConversationsFor } from '../dialogue/autoDialogueTrigger'
import { useMonologueStore } from '../dialogue/monologueStore'
import { endActiveCharacterInteractionsFor } from '../interaction/characterInteractionTrigger'
import { useNeedsStore } from '../needs/needsStore'
import { useAutoFurnitureUseStore } from '../simulation/autoFurnitureUseStore'
import { releaseFurnitureUsage } from '../simulation/furnitureUsageTrigger'
import { useCharacterStore } from './characterStore'
import { CharacterAIProfileEditor } from './CharacterAIProfileEditor'
import { getPersonalityLabel } from './personalityTags'
import type { Character } from './types'

function personalitySummary(character: Character): string {
  const { personalityTags, customPersonalityTags } = character.aiProfile
  if (personalityTags.length > 0) {
    return personalityTags.map((id) => getPersonalityLabel(id, customPersonalityTags)).join(', ')
  }
  // Falls back to the pre-tag-system free-text value for the rare case a character hasn't gone through normalizeCharacter's migration yet.
  return character.traits.personality || '성격 미입력'
}

export function CharacterList() {
  const characters = useCharacterStore((state) => state.characters)
  const removeCharacter = useCharacterStore((state) => state.removeCharacter)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Ends any conversation this character is part of *right now* (survivor's bubble/movement recover immediately,
  // rather than waiting for that conversation's own async tail to finish several seconds later) and drops this
  // character's monologue and auto-furniture-use history, before actually removing it — see
  // autoDialogueTrigger.ts's endActiveConversationsFor. forgetCharacter (both monologue and auto-furniture-use) is
  // called here specifically because removeCharacter drops the character from characterStore immediately — neither
  // runMonologuePass nor runAutoFurnitureUsePass would ever visit this id again to clean up its own bookkeeping on
  // its own.
  function handleRemove(id: string) {
    endActiveConversationsFor(id)
    endActiveCharacterInteractionsFor(id)
    releaseFurnitureUsage(id)
    useMonologueStore.getState().forgetCharacter(id)
    useAutoFurnitureUseStore.getState().forgetCharacter(id)
    useNeedsStore.getState().removeCharacter(id)
    removeCharacter(id)
  }

  if (characters.length === 0) {
    return <p className="character-list-empty">아직 등록된 캐릭터가 없어요.</p>
  }

  return (
    <ul className="character-list">
      {characters.map((character) => {
        const isExpanded = expandedId === character.id
        return (
          <li key={character.id} className="character-list-item">
            <div className="character-list-item-row">
              <img src={character.imageDataUrl} alt={character.name} />
              <div className="character-list-item-info">
                <strong>{character.name}</strong>
                <p>
                  {personalitySummary(character)} ·{' '}
                  {character.traits.favoriteColor || '색상 미입력'}
                </p>
              </div>
              <button type="button" onClick={() => setExpandedId(isExpanded ? null : character.id)}>
                말투·대사 설정
              </button>
              <button type="button" onClick={() => handleRemove(character.id)}>
                삭제
              </button>
            </div>
            {isExpanded && <CharacterAIProfileEditor character={character} />}
          </li>
        )
      })}
    </ul>
  )
}
