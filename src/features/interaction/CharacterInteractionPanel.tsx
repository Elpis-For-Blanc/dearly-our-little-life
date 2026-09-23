import { useEffect, useMemo, useRef, useState } from 'react'
import type { Character } from '../character/types'
import { startManualConversation, type ConversationOutcome } from '../dialogue/autoDialogueTrigger'
import { useDialogueStore } from '../dialogue/dialogueStore'
import type { DialogueSituation } from '../dialogue/types'
import { useSimulationStore } from '../simulation/simulationStore'
import { useCharacterInteractionSettingsStore } from './characterInteractionSettingsStore'
import { useCharacterInteractionStore } from './characterInteractionStore'
import { startManualCharacterInteraction, type CharacterInteractionOutcome } from './characterInteractionTrigger'
import type { ManualInteractionChoice } from './characterInteractionTypes'
import './CharacterInteractionPanel.css'

interface ActionSpec {
  type: ManualInteractionChoice
  label: string
}

const ACTIONS: ActionSpec[] = [
  { type: 'talk', label: '대화하기' },
  { type: 'stayTogether', label: '같이 있기' },
  { type: 'sitTogether', label: '같이 앉기' },
  { type: 'hug', label: '안아주기' },
  { type: 'holdHands', label: '손잡기' },
]

const OUTCOME_MESSAGE: Partial<Record<ConversationOutcome | CharacterInteractionOutcome, string>> = {
  no_candidates: '지금 상황에 맞는 대사가 없어요. 캐릭터의 예시 대사를 더 등록해 보세요.',
  busy: '선택한 캐릭터가 이미 다른 활동 중이에요.',
  missing_characters: '캐릭터를 찾을 수 없어요.',
  not_found: '캐릭터를 찾을 수 없어요.',
  same_character: '같은 캐릭터끼리는 상호작용할 수 없어요.',
  not_same_room: '두 캐릭터가 같은 방에 있어야 해요.',
  no_seats_available: '같이 앉을 수 있는 자리가 없어요.',
  seat_reservation_failed: '자리를 예약하지 못했어요. 다시 시도해 주세요.',
}

interface CharacterInteractionPanelProps {
  /** Scoped to the observed room only — same `roomCharacters` list `LiveNeedsPanel`/the manual-dialogue picker already use (see this project's own "no cross-room character dashboard" rule). */
  characters: Character[]
  /** The Live screen's own shared situation (time/place/actions) — passed through so a `talk` click here produces a conversation with the exact same real context as the existing manual "대화하기" button, not a second, weaker/default one. */
  situationRef: { current: DialogueSituation }
}

/**
 * Manual character-to-character interaction UI (생활 시뮬레이션 2단계) — one
 * pair picker plus five action buttons, all dispatching through the exact
 * same engine the automatic pass uses: `talk` calls the pre-existing
 * `startManualConversation` directly (no fake duplicate talk logic), the
 * other four call `startManualCharacterInteraction`, which itself reuses
 * `furnitureUsageTrigger.ts`'s seat system for `sitTogether` — see
 * `characterInteractionTrigger.ts`'s own doc comment. Deliberately a
 * *separate* pair picker from the existing manual-dialogue section in
 * `LiveScreen.tsx`, not a merge into it — this project already established
 * that precedent for the relationship-type picker ("which pair currently
 * talks and which pair's relationship you're editing are unrelated choices,
 * and conflating their state would let picking one accidentally change the
 * other"); the same reasoning applies here.
 */
export function CharacterInteractionPanel({ characters, situationRef }: CharacterInteractionPanelProps) {
  const enabled = useCharacterInteractionSettingsStore((state) => state.enabled)
  const setEnabled = useCharacterInteractionSettingsStore((state) => state.setEnabled)
  const activeConversations = useDialogueStore((state) => state.activeConversations)
  const interactionByCharacterId = useCharacterInteractionStore((state) => state.byCharacterId)
  const isRunning = useSimulationStore((state) => state.isRunning)

  const pairs = useMemo(() => {
    const result: Array<{ idA: string; idB: string; label: string }> = []
    for (let i = 0; i < characters.length; i++) {
      for (let j = i + 1; j < characters.length; j++) {
        result.push({ idA: characters[i].id, idB: characters[j].id, label: `${characters[i].name} & ${characters[j].name}` })
      }
    }
    return result
  }, [characters])

  const busyIds = useMemo(() => {
    const ids = new Set(Object.values(activeConversations).flat())
    for (const id of Object.keys(interactionByCharacterId)) ids.add(id)
    return ids
  }, [activeConversations, interactionByCharacterId])
  const availablePairs = useMemo(() => pairs.filter((p) => !busyIds.has(p.idA) && !busyIds.has(p.idB)), [pairs, busyIds])

  const [pairIndex, setPairIndex] = useState(0)
  const selectedPair = availablePairs[Math.min(pairIndex, availablePairs.length - 1)]
  const [pendingType, setPendingType] = useState<ManualInteractionChoice | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  if (characters.length < 2) return null

  const disabledReason = !isRunning
    ? '일시정지 중에는 상호작용을 시작할 수 없어요. 재생 버튼을 눌러주세요.'
    : availablePairs.length === 0
      ? '이 방에서 지금 상호작용할 수 있는 캐릭터가 2명 미만이에요.'
      : undefined

  async function handleAction(type: ManualInteractionChoice) {
    if (!selectedPair || pendingType) return
    setMessage(null)
    setPendingType(type)
    const outcome =
      type === 'talk'
        ? await startManualConversation(selectedPair.idA, selectedPair.idB, situationRef, mountedRef)
        : startManualCharacterInteraction(type, selectedPair.idA, selectedPair.idB)
    if (!mountedRef.current) return
    setPendingType(null)
    const text = OUTCOME_MESSAGE[outcome]
    setMessage(text ?? null)
  }

  return (
    <div className="live-frequency-panel character-interaction-panel">
      <div className="live-frequency-header">
        <span>캐릭터 상호작용</span>
        <button
          type="button"
          className="live-pause-toggle"
          aria-pressed={enabled}
          aria-label={`캐릭터 상호작용 ${enabled ? '켜짐' : '꺼짐'}`}
          onClick={() => setEnabled(!enabled)}
        >
          {enabled ? '켜짐' : '꺼짐'}
        </button>
      </div>
      <p className="live-frequency-description">
        {enabled
          ? '캐릭터가 가끔 스스로 서로에게 다가가 같이 있거나, 같이 앉거나, 안아주거나, 손을 잡아요.'
          : '캐릭터가 스스로 서로 상호작용하지 않아요. 아래 버튼으로 직접 시킬 수 있어요.'}
      </p>

      <div className="live-manual-dialogue character-interaction-actions">
        {availablePairs.length > 1 && (
          <select aria-label="상호작용할 캐릭터 쌍" value={pairIndex} onChange={(event) => setPairIndex(Number(event.target.value))}>
            {availablePairs.map((pair, index) => (
              <option key={`${pair.idA}-${pair.idB}`} value={index}>
                {pair.label}
              </option>
            ))}
          </select>
        )}
        {ACTIONS.map((action) => (
          <button
            key={action.type}
            type="button"
            className="live-manual-talk-button"
            aria-label={`캐릭터 상호작용: ${action.label}`}
            disabled={pendingType !== null || !selectedPair || disabledReason !== undefined}
            title={disabledReason}
            onClick={() => void handleAction(action.type)}
          >
            {pendingType === action.type ? '진행 중...' : action.label}
          </button>
        ))}
        {message && <p className="live-manual-message">{message}</p>}
      </div>
    </div>
  )
}
