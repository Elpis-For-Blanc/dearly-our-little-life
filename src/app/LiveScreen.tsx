import { useEffect, useMemo, useRef, useState } from 'react'
import type { TimeBand } from '../features/bgm/bgmConfig'
import { TIME_BAND_LABELS } from '../features/bgm/timeBand'
import { useCharacterStore } from '../features/character/characterStore'
import { DIALOGUE_FREQUENCY_ORDER, DIALOGUE_FREQUENCY_PRESETS } from '../features/dialogue/autoDialogueConfig'
import { startManualConversation, type ConversationOutcome } from '../features/dialogue/autoDialogueTrigger'
import { DialogueFeed } from '../features/dialogue/DialogueFeed'
import { useDialogueFrequencyStore } from '../features/dialogue/dialogueFrequencyStore'
import { useDialogueStore } from '../features/dialogue/dialogueStore'
import { MONOLOGUE_FREQUENCY_ORDER, MONOLOGUE_FREQUENCY_PRESETS } from '../features/dialogue/monologueConfig'
import { useMonologueFrequencyStore } from '../features/dialogue/monologueFrequencyStore'
import { RELATIONSHIP_PRESETS, RELATIONSHIP_TYPE_ORDER, type RelationshipType } from '../features/dialogue/relationshipConfig'
import { useRelationshipStore } from '../features/dialogue/relationshipStore'
import type { DialogueSituation } from '../features/dialogue/types'
import { useHomeStore } from '../features/home/homeStore'
import { RoomTabs } from '../features/home/RoomTabs'
import { CharacterInteractionPanel } from '../features/interaction/CharacterInteractionPanel'
import { getRoomLightingStyle } from '../features/lighting/roomLightingEngine'
import { useRoomLightingSettingsStore } from '../features/lighting/roomLightingSettingsStore'
import { LiveNeedsPanel } from '../features/needs/LiveNeedsPanel'
import { PhotoMode } from '../features/photo/PhotoMode'
import { useAutoFurnitureUseSettingsStore } from '../features/simulation/autoFurnitureUseSettingsStore'
import { LiveRoomView } from '../features/simulation/LiveRoomView'
import { useCharacterMovementStore } from '../features/simulation/characterMovementStore'
import { useCharacterMovementSimulation } from '../features/simulation/useCharacterMovementSimulation'
import { useSimulationStore } from '../features/simulation/simulationStore'
import './LiveScreen.css'

const TIME_BAND_ORDER: TimeBand[] = ['morning', 'daytime', 'evening', 'night']

function defaultTime() {
  return new Date().toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })
}

const OUTCOME_MESSAGE: Partial<Record<ConversationOutcome, string>> = {
  no_candidates: '지금 상황에 맞는 대사가 없어요. 캐릭터의 예시 대사를 더 등록해 보세요.',
  busy: '선택한 캐릭터가 이미 다른 대화 중이에요.',
  missing_characters: '캐릭터를 찾을 수 없어요.',
}

export function LiveScreen() {
  const characters = useCharacterStore((state) => state.characters)

  const frequencyMode = useDialogueFrequencyStore((state) => state.mode)
  const setFrequencyMode = useDialogueFrequencyStore((state) => state.setMode)
  const monologueMode = useMonologueFrequencyStore((state) => state.mode)
  const setMonologueMode = useMonologueFrequencyStore((state) => state.setMode)
  const autoFurnitureUseEnabled = useAutoFurnitureUseSettingsStore((state) => state.enabled)
  const setAutoFurnitureUseEnabled = useAutoFurnitureUseSettingsStore((state) => state.setEnabled)
  const lightingEnabled = useRoomLightingSettingsStore((state) => state.enabled)
  const setLightingEnabled = useRoomLightingSettingsStore((state) => state.setEnabled)
  const lightingIntensity = useRoomLightingSettingsStore((state) => state.intensity)
  const setLightingIntensity = useRoomLightingSettingsStore((state) => state.setIntensity)
  const getRelationshipType = useRelationshipStore((state) => state.getRelationshipType)
  const isRelationshipExplicit = useRelationshipStore((state) => state.isRelationshipExplicit)
  const setRelationshipType = useRelationshipStore((state) => state.setRelationshipType)
  // Re-render when any pair relationship changes, even though this component reads through getRelationshipType().
  useRelationshipStore((state) => state.relationshipsByPair)
  useRelationshipStore((state) => state.defaultRelationshipType)
  const isRunning = useSimulationStore((state) => state.isRunning)
  const start = useSimulationStore((state) => state.start)
  const pause = useSimulationStore((state) => state.pause)
  const activeConversations = useDialogueStore((state) => state.activeConversations)
  const activeLiveRoomId = useHomeStore((state) => state.activeLiveRoomId)
  const setActiveLiveRoom = useHomeStore((state) => state.setActiveLiveRoom)
  const movementById = useCharacterMovementStore((state) => state.byId)

  const [time, setTime] = useState(defaultTime)
  const [place, setPlace] = useState('거실')
  const [actionA, setActionA] = useState('')
  const [actionB, setActionB] = useState('')
  const [photoModeOpen, setPhotoModeOpen] = useState(false)

  const pairs = useMemo(() => {
    const result: Array<{ idA: string; idB: string; label: string }> = []
    for (let i = 0; i < characters.length; i++) {
      for (let j = i + 1; j < characters.length; j++) {
        result.push({ idA: characters[i].id, idB: characters[j].id, label: `${characters[i].name} & ${characters[j].name}` })
      }
    }
    return result
  }, [characters])

  const [selectedPairIndex, setSelectedPairIndex] = useState(0)
  const selectedPair = pairs[Math.min(selectedPairIndex, pairs.length - 1)]

  // Manual dialogue is scoped to the room currently being observed (spec §9)
  // — a character in another room, even if registered and free, is never an
  // offerable candidate here. Relationship editing above stays global since
  // a relationship type is a property of the pair, not of where they stand.
  const roomCharacters = useMemo(
    () => characters.filter((c) => movementById[c.id]?.roomId === activeLiveRoomId),
    [characters, movementById, activeLiveRoomId],
  )
  const roomPairs = useMemo(() => {
    const result: Array<{ idA: string; idB: string; label: string }> = []
    for (let i = 0; i < roomCharacters.length; i++) {
      for (let j = i + 1; j < roomCharacters.length; j++) {
        result.push({ idA: roomCharacters[i].id, idB: roomCharacters[j].id, label: `${roomCharacters[i].name} & ${roomCharacters[j].name}` })
      }
    }
    return result
  }, [roomCharacters])

  const busyIds = useMemo(() => new Set(Object.values(activeConversations).flat()), [activeConversations])
  const availablePairs = useMemo(() => roomPairs.filter((p) => !busyIds.has(p.idA) && !busyIds.has(p.idB)), [roomPairs, busyIds])
  const [manualPairIndex, setManualPairIndex] = useState(0)
  const selectedManualPair = availablePairs[Math.min(manualPairIndex, availablePairs.length - 1)]
  const [isManualTalking, setIsManualTalking] = useState(false)
  const [manualMessage, setManualMessage] = useState<string | null>(null)

  const situationRef = useRef<DialogueSituation>({ time, place, actionA, actionB })
  const manualMountedRef = useRef(true)

  useEffect(() => {
    situationRef.current = { time, place, actionA, actionB }
  }, [time, place, actionA, actionB])

  useEffect(() => {
    manualMountedRef.current = true
    return () => {
      manualMountedRef.current = false
    }
  }, [])

  useCharacterMovementSimulation({ time, place, actionA, actionB })

  // Entering the Live screen starts the simulation (so auto-dialogue works out of the box) unless the user already paused it.
  useEffect(() => {
    // Runs once on mount only — the pause button controls isRunning afterward.
    if (!isRunning) start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleManualTalk() {
    if (!selectedManualPair || isManualTalking) return
    setManualMessage(null)
    setIsManualTalking(true)
    const outcome = await startManualConversation(selectedManualPair.idA, selectedManualPair.idB, situationRef, manualMountedRef)
    if (!manualMountedRef.current) return
    setIsManualTalking(false)
    const message = OUTCOME_MESSAGE[outcome]
    if (message) setManualMessage(message)
  }

  if (characters.length < 2) {
    return (
      <section className="live-screen">
        <p className="live-screen-guard">캐릭터 설정에서 두 캐릭터를 모두 등록하면 대화를 생성할 수 있어요.</p>
      </section>
    )
  }

  const manualDisabledReason = !isRunning
    ? '일시정지 중에는 대화를 시작할 수 없어요. 재생 버튼을 눌러주세요.'
    : availablePairs.length === 0
      ? '이 방에서 지금 대화할 수 있는 캐릭터가 2명 미만이에요.'
      : undefined
  const isManualDisabled = isManualTalking || manualDisabledReason !== undefined

  return (
    <section className="live-screen">
      <div className="live-room-toolbar">
        <RoomTabs activeRoomId={activeLiveRoomId} onSelectRoom={setActiveLiveRoom} />
        <button type="button" className="live-photo-button" onClick={() => setPhotoModeOpen(true)}>📷 스크린샷</button>
      </div>
      <LiveRoomView />
      {photoModeOpen && <PhotoMode onClose={() => setPhotoModeOpen(false)} />}
      <LiveNeedsPanel characters={roomCharacters} />

      <div className="live-frequency-panel">
        <div className="live-frequency-header">
          <span>대화 빈도</span>
          <span className="live-frequency-current">현재: {DIALOGUE_FREQUENCY_PRESETS[frequencyMode].label}</span>
          <button type="button" className="live-pause-toggle" onClick={() => (isRunning ? pause() : start())}>
            {isRunning ? '일시정지' : '재생'}
          </button>
        </div>
        <div className="live-frequency-options" role="group" aria-label="대화 빈도">
          {DIALOGUE_FREQUENCY_ORDER.map((mode) => {
            const preset = DIALOGUE_FREQUENCY_PRESETS[mode]
            return (
              <button
                key={mode}
                type="button"
                className={mode === frequencyMode ? 'live-frequency-option active' : 'live-frequency-option'}
                onClick={() => setFrequencyMode(mode)}
                title={preset.description}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
        <p className="live-frequency-description">{DIALOGUE_FREQUENCY_PRESETS[frequencyMode].description}</p>

        <div className="live-frequency-header">
          <span>혼잣말 빈도</span>
          <span className="live-frequency-current">현재: {MONOLOGUE_FREQUENCY_PRESETS[monologueMode].label}</span>
        </div>
        <div className="live-frequency-options" role="group" aria-label="혼잣말 빈도">
          {MONOLOGUE_FREQUENCY_ORDER.map((mode) => {
            const preset = MONOLOGUE_FREQUENCY_PRESETS[mode]
            return (
              <button
                key={mode}
                type="button"
                className={mode === monologueMode ? 'live-frequency-option active' : 'live-frequency-option'}
                onClick={() => setMonologueMode(mode)}
                title={preset.description}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
        <p className="live-frequency-description">{MONOLOGUE_FREQUENCY_PRESETS[monologueMode].description}</p>

        <div className="live-frequency-header">
          <span>자동 가구 사용</span>
          <button
            type="button"
            className="live-pause-toggle"
            aria-pressed={autoFurnitureUseEnabled}
            aria-label={`자동 가구 사용 ${autoFurnitureUseEnabled ? '켜짐' : '꺼짐'}`}
            onClick={() => setAutoFurnitureUseEnabled(!autoFurnitureUseEnabled)}
          >
            {autoFurnitureUseEnabled ? '켜짐' : '꺼짐'}
          </button>
        </div>
        <p className="live-frequency-description">
          {autoFurnitureUseEnabled
            ? '캐릭터가 가끔 스스로 소파·의자·침대·테이블을 사용해요.'
            : '캐릭터가 스스로 가구를 사용하지 않아요. 직접 사용은 그대로 할 수 있어요.'}
        </p>

        <div className="live-frequency-header">
          <span>시간대별 방 조명</span>
          <button
            type="button"
            className="live-pause-toggle"
            aria-pressed={lightingEnabled}
            aria-label={`시간대별 방 조명 ${lightingEnabled ? '켜짐' : '꺼짐'}`}
            onClick={() => setLightingEnabled(!lightingEnabled)}
          >
            {lightingEnabled ? '켜짐' : '꺼짐'}
          </button>
        </div>
        <p className="live-frequency-description">
          {lightingEnabled
            ? '시간대에 따라 방 안이 자연스럽게 밝아지고 어두워져요. 메뉴·대화창은 어두워지지 않아요.'
            : '방 안 조명이 항상 원래 벽지·바닥·가구 색상 그대로 유지돼요.'}
        </p>
        {lightingEnabled && (
          <label className="room-lighting-intensity-field">
            <span>조명 강도 ({lightingIntensity}%)</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={lightingIntensity}
              onChange={(event) => setLightingIntensity(Number(event.target.value))}
              aria-label="조명 강도"
            />
          </label>
        )}
        <div className="room-lighting-preview-row" role="group" aria-label="시간대 조명 미리보기">
          {TIME_BAND_ORDER.map((band) => {
            const preview = getRoomLightingStyle(band, 100)
            return (
              <div key={band} className="room-lighting-preview-swatch">
                <span
                  className="room-lighting-preview-swatch-box"
                  style={{ backgroundColor: preview.backgroundColor, opacity: Math.max(preview.opacity, 0.06) }}
                />
                <span className="room-lighting-preview-swatch-label">{TIME_BAND_LABELS[band]}</span>
              </div>
            )
          })}
        </div>

        {selectedPair && (
          <div className="live-relationship-row">
            <span>관계</span>
            {pairs.length > 1 && (
              <select
                aria-label="관계를 설정할 캐릭터 쌍"
                value={selectedPairIndex}
                onChange={(event) => setSelectedPairIndex(Number(event.target.value))}
              >
                {pairs.map((pair, index) => (
                  <option key={`${pair.idA}-${pair.idB}`} value={index}>
                    {pair.label}
                  </option>
                ))}
              </select>
            )}
            <select
              aria-label="선택한 쌍의 관계 유형"
              // A pair whose relationship was never chosen shows blank (rather than looking like it already has the default relationship); it still gets only neutral dialogue. Picking any type — including 친밀한 관계 — fires a change.
              value={isRelationshipExplicit(selectedPair.idA, selectedPair.idB) ? getRelationshipType(selectedPair.idA, selectedPair.idB) : ''}
              onChange={(event) => setRelationshipType(selectedPair.idA, selectedPair.idB, event.target.value as RelationshipType)}
            >
              <option value="" disabled hidden>
                관계 선택
              </option>
              {RELATIONSHIP_TYPE_ORDER.map((type) => (
                <option key={type} value={type}>
                  {RELATIONSHIP_PRESETS[type].label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="live-manual-dialogue">
          {availablePairs.length > 1 && (
            <select
              aria-label="대화할 캐릭터 쌍"
              value={manualPairIndex}
              onChange={(event) => setManualPairIndex(Number(event.target.value))}
            >
              {availablePairs.map((pair, index) => (
                <option key={`${pair.idA}-${pair.idB}`} value={index}>
                  {pair.label}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="live-manual-talk-button"
            disabled={isManualDisabled}
            title={manualDisabledReason}
            onClick={() => void handleManualTalk()}
          >
            {isManualTalking ? '대화 생성 중...' : '대화하기'}
          </button>
          {manualMessage && <p className="live-manual-message">{manualMessage}</p>}
        </div>
      </div>

      <CharacterInteractionPanel characters={roomCharacters} situationRef={situationRef} />

      <div className="live-situation">
        <label className="live-situation-field">
          <span>현재 시간</span>
          <input type="text" value={time} onChange={(event) => setTime(event.target.value)} />
        </label>
        <label className="live-situation-field">
          <span>현재 장소</span>
          <input type="text" value={place} onChange={(event) => setPlace(event.target.value)} />
        </label>
        <label className="live-situation-field">
          <span>{characters[0].name}의 행동</span>
          <input type="text" value={actionA} onChange={(event) => setActionA(event.target.value)} placeholder="예: 소파에 앉아 쉬는 중" />
        </label>
        <label className="live-situation-field">
          <span>{characters[1].name}의 행동</span>
          <input type="text" value={actionB} onChange={(event) => setActionB(event.target.value)} placeholder="예: 책을 읽는 중" />
        </label>
      </div>

      <DialogueFeed />
    </section>
  )
}
