import { useEffect, useMemo, useState } from 'react'
import { useCharacterStore } from '../character/characterStore'
import type { Character } from '../character/types'
import { useDialogueStore } from '../dialogue/dialogueStore'
import { useCharacterInteractionStore } from '../interaction/characterInteractionStore'
import { describeInteractionStatus } from '../interaction/interactionStatusText'
import { getFood } from '../food/foodCatalog'
import { cancelMeal, startMeal, startSharedMeal } from '../food/mealEngine'
import { useMealStore } from '../food/mealStore'
import { deriveMood, MOOD_LABELS } from './moodEngine'
import { createDefaultNeeds, NEED_CRITICAL_THRESHOLD } from './needsConfig'
import { useNeedsStore } from './needsStore'
import './LiveNeedsPanel.css'

interface NeedGaugeSpec {
  key: 'hunger' | 'energy' | 'fun' | 'social'
  label: string
}

const GAUGES: NeedGaugeSpec[] = [
  { key: 'hunger', label: '배고픔' },
  { key: 'energy', label: '기력' },
  { key: 'fun', label: '즐거움' },
  { key: 'social', label: '교류' },
]

interface LiveNeedsPanelProps {
  /**
   * Deliberately scoped by the caller to only the characters currently in
   * the *observed* room (`LiveScreen.tsx`'s own `roomCharacters`, the exact
   * same list its manual-dialogue picker already uses) — never every
   * registered character. Mirrors the same "you only ever see characters
   * currently in the room you're looking at" rule `LiveRoomView.tsx`'s own
   * character tokens already follow; a global cross-room status dashboard
   * would be a new kind of character-location tracker this project has
   * repeatedly and deliberately avoided building.
   */
  characters: Character[]
}

/**
 * Small, compact per-character status strip for the 함께 생활하기 screen —
 * name + mood text + four mini gauges, no numbers by default (title/
 * aria-label carry the exact value). Reads `needsStore`/`deriveMood`
 * exactly as `NeedsStatusPanel.tsx` (the 캐릭터 설정 screen's own version)
 * does; neither file computes or stores anything itself, both are pure
 * display layers over the one shared `needsStore` + `moodEngine.ts`. Kept as
 * a second, deliberately more compact component rather than reusing
 * `NeedsStatusPanel` directly, since the two contexts want different
 * visual density (one full-size panel for a single character being edited,
 * vs. several small cards side by side here) — same "don't force one
 * component to serve two very different layouts" reasoning already
 * governs this codebase's other presentational splits.
 */
export function LiveNeedsPanel({ characters }: LiveNeedsPanelProps) {
  const needsById = useNeedsStore((state) => state.byId)
  const ensureCharacter = useNeedsStore((state) => state.ensureCharacter)
  const allCharacters = useCharacterStore((state) => state.characters)
  const activeConversations = useDialogueStore((state) => state.activeConversations)
  const interactionSessions = useCharacterInteractionStore((state) => state.sessions)
  const interactionByCharacterId = useCharacterInteractionStore((state) => state.byCharacterId)
  const meals = useMealStore((state) => state.byCharacterId)
  const [mealMessage, setMealMessage] = useState<Record<string, string>>({})
  const [sharedMealMessage, setSharedMealMessage] = useState('')

  const nameById = useMemo(() => Object.fromEntries(allCharacters.map((c) => [c.id, c.name])), [allCharacters])

  useEffect(() => {
    for (const character of characters) ensureCharacter(character.id)
  }, [characters, ensureCharacter])

  if (characters.length === 0) return null

  const mealPairs = characters.flatMap((first, firstIndex) =>
    characters.slice(firstIndex + 1).map((second) => ({ first, second })),
  )
  const mealOutcomeMessage = (outcome: ReturnType<typeof startSharedMeal>) =>
    outcome === 'started' ? '' : outcome === 'no_table' ? '이 방에 식탁이 필요해요.' : outcome === 'full' ? '두 자리가 비어 있는 식탁이 필요해요.' : outcome === 'busy' ? '둘 중 한 명이 지금 다른 행동 중이에요.' : '같이 식사를 시작할 수 없어요.'

  return (
    <div className="live-needs-panel" aria-label="캐릭터 상태">
      {characters.map((character) => {
        // Falls back to a plain default-shaped display for the one render before the effect above lands the real
        // entry — never blank, same pattern NeedsStatusPanel.tsx already uses.
        const needs = needsById[character.id] ?? createDefaultNeeds(() => 0.5)
        const mood = deriveMood(needs)
        const interactionStatus = describeInteractionStatus(character.id, nameById, activeConversations, interactionSessions, interactionByCharacterId)
        const meal = meals[character.id]
        const mealStatus = meal ? (meal.stage === 'eating' ? `${getFood(meal.foodId).emoji} ${getFood(meal.foodId).name} 먹는 중` : `${getFood(meal.foodId).emoji} 식사하러 가는 중`) : null
        const handleMeal = () => {
          if (meal) {
            cancelMeal(character.id)
            setMealMessage((current) => ({ ...current, [character.id]: '' }))
            return
          }
          const outcome = startMeal(character.id)
          const message = outcome === 'started' ? '' : outcome === 'no_table' ? '이 방에 식탁이 필요해요.' : outcome === 'full' ? '식탁 자리가 모두 사용 중이에요.' : outcome === 'busy' ? '지금은 다른 행동 중이에요.' : '식사를 시작할 수 없어요.'
          setMealMessage((current) => ({ ...current, [character.id]: message }))
        }
        return (
          <div key={character.id} className="live-needs-card">
            <div className="live-needs-card-header">
              <strong className="live-needs-card-name">{character.name}</strong>
              <span className="live-needs-card-mood">기분: {MOOD_LABELS[mood]}</span>
            </div>
            {interactionStatus && <p className="live-needs-card-interaction">{interactionStatus}</p>}
            {mealStatus && <p className="live-needs-card-meal">{mealStatus}</p>}
            <div className="live-needs-gauges">
              {GAUGES.map((gauge) => {
                const value = needs[gauge.key]
                const isLow = value <= NEED_CRITICAL_THRESHOLD
                return (
                  <div
                    key={gauge.key}
                    className={isLow ? 'live-needs-gauge live-needs-gauge-low' : 'live-needs-gauge'}
                    role="progressbar"
                    aria-label={`${character.name}의 ${gauge.label}`}
                    aria-valuenow={Math.round(value)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    title={`${gauge.label} ${Math.round(value)}%`}
                  >
                    <span className="live-needs-gauge-label">{gauge.label}</span>
                    <span className="live-needs-gauge-track">
                      <span className="live-needs-gauge-fill" style={{ width: `${value}%` }} />
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="live-needs-meal-actions">
              <button type="button" onClick={handleMeal}>
                {meal ? '식사 취소' : '🍽️ 식사하기'}
              </button>
              {mealMessage[character.id] && <span>{mealMessage[character.id]}</span>}
            </div>
          </div>
        )
      })}
      {mealPairs.length > 0 && (
        <div className="live-needs-shared-meals" aria-label="같이 식사하기">
          {mealPairs.map(({ first, second }) => {
            return (
              <button
                key={`${first.id}:${second.id}`}
                type="button"
                onClick={() => setSharedMealMessage(mealOutcomeMessage(startSharedMeal(first.id, second.id)))}
              >
                🍽️ {first.name} · {second.name} 같이 식사하기
              </button>
            )
          })}
          {sharedMealMessage && <span>{sharedMealMessage}</span>}
        </div>
      )}
    </div>
  )
}
