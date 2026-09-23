import { useState } from 'react'
import { useCharacterStore } from '../character/characterStore'
import { useDialogueStore } from '../dialogue/dialogueStore'
import { getFurnitureDefinition } from '../home/furnitureCatalog'
import { useHomeStore } from '../home/homeStore'
import type { InteractionKind } from '../home/types'
import { useCharacterMovementStore } from './characterMovementStore'
import './FurnitureUsagePanel.css'
import { getSitSlots, getStandSlots, getUsableLieSlots, isWalkDestinationBlocked, resolveStandDestination } from './furnitureInteractionEngine'
import { useFurnitureUsageStore } from './furnitureUsageStore'
import { standUp, startLingering, startLyingDown, startSitting, type SitOutcome } from './furnitureUsageTrigger'
import { furnitureObstacles } from './movementEngine'

const BLOCKED_REASON = '이 자리는 다른 가구나 캐릭터에 막혀 있어서 사용할 수 없어요.'

/** Per-kind display copy — sofa/chair ('sit') keeps its exact original wording (nothing here changed for it); 'lie' (bed) and 'stand' (table) get their own, per CLAUDE.md's §4 button names (눕기/일어나기 for the bed, 다가가기/머무르기 종료 for the table). */
const ACTION_LABEL: Record<InteractionKind, string> = { sit: '앉기', lie: '눕기', stand: '다가가기' }
const PICKER_LABEL: Record<InteractionKind, string> = { sit: '앉을 캐릭터', lie: '누울 캐릭터', stand: '다가갈 캐릭터' }
const OCCUPIED_LABEL: Record<InteractionKind, string> = { sit: '앉아 있어요', lie: '누워 있어요', stand: '머무르고 있어요' }
const END_LABEL: Record<InteractionKind, string> = { sit: '일어나기', lie: '일어나기', stand: '머무르기 종료' }
const NO_CANDIDATE_REASON: Record<InteractionKind, string> = {
  sit: '이 방에서 지금 앉을 수 있는 캐릭터가 없어요.',
  lie: '이 방에서 지금 누울 수 있는 캐릭터가 없어요.',
  stand: '이 방에서 지금 다가갈 수 있는 캐릭터가 없어요.',
}
const OUTCOME_MESSAGE: Record<InteractionKind, Partial<Record<SitOutcome, string>>> = {
  sit: {
    not_found: '캐릭터나 가구를 찾을 수 없어요.',
    not_sittable: '이 가구는 앉을 수 없어요.',
    not_same_room: '캐릭터가 이 방에 없어요.',
    occupied: '이미 다른 캐릭터가 사용 중이에요.',
    busy: '이 캐릭터는 지금 앉을 수 없어요.',
  },
  lie: {
    not_found: '캐릭터나 가구를 찾을 수 없어요.',
    not_sittable: '이 침대에는 누울 수 없어요.',
    not_same_room: '캐릭터가 이 방에 없어요.',
    occupied: '이미 다른 캐릭터가 사용 중이에요.',
    busy: '이 캐릭터는 지금 누울 수 없어요.',
  },
  stand: {
    not_found: '캐릭터나 가구를 찾을 수 없어요.',
    not_sittable: '이 테이블에는 다가갈 수 없어요.',
    not_same_room: '캐릭터가 이 방에 없어요.',
    occupied: '이미 다른 캐릭터가 사용 중이에요.',
    busy: '이 캐릭터는 지금 다가갈 수 없어요.',
  },
}
const START: Record<InteractionKind, (characterId: string, placementId: string, slotId?: string) => SitOutcome> = {
  sit: startSitting,
  lie: startLyingDown,
  stand: startLingering,
}

/**
 * Two slots offset left/right of center get labeled by side — purely a
 * display label, derived from the slot's own offsetX, never a hardcoded id
 * match. The sofa's two seats and the table's two stand spots (왼쪽/오른쪽
 * 자리 — see CLAUDE.md's table-approach-direction fix) both go through this.
 * A single slot with no left/right sense to disambiguate just says the bare
 * word ("좌석" for a one-seat chair, unchanged from phase 1/2) — except a
 * bed's single 'lie' slot, which shows no label at all (there was never one
 * to disambiguate from in the first place).
 */
function slotLabel(kind: InteractionKind, offsetX: number, index: number, total: number): string | null {
  const word = kind === 'sit' ? '좌석' : '자리'
  if (total === 1) return kind === 'lie' ? null : word
  if (offsetX < 0) return `왼쪽 ${word}`
  if (offsetX > 0) return `오른쪽 ${word}`
  return `${word} ${index + 1}`
}

interface FurnitureUsagePanelProps {
  roomId: string
  placementId: string
  onClose: () => void
}

/**
 * Small floating control for a selected piece of usable furniture in
 * LiveRoomView — one row per interaction slot the piece actually has (two
 * independent ones for the 2-seat sofa or a 2-spot table, one for an
 * ordinary chair or a bed). A piece is assumed to only ever declare slots of
 * one kind (checked in order sit → lie → stand; true for every catalog
 * entry today), so exactly one of those three UIs renders per piece — the
 * row-rendering structure itself is fully shared, only the labels/outcome
 * messages/start function differ by kind (see the tables above), per
 * CLAUDE.md's "공통 좌석 정의와 공통 상태 전환 로직을 재사용" requirement.
 *
 * "앉기"/"눕기"/"다가가기" (with a character picker whenever there's a real
 * choice, per the "never silently pick for the user" rule the manual
 * 대화하기 picker already follows) when a slot is free; "일어나기"/"머무르기
 * 종료" or "다가가기 취소" (still approaching) when it's taken. Picking an
 * already-occupying character for a *different*, still-empty slot
 * reassigns them (see `startSitting`'s own release-old-slot-first handling)
 * rather than being refused. All state is read live from
 * `furnitureUsageStore`/`characterMovementStore`/`dialogueStore`, so it
 * reflects the simulation in real time without any local mirroring.
 */
export function FurnitureUsagePanel({ roomId, placementId, onClose }: FurnitureUsagePanelProps) {
  const room = useHomeStore((state) => state.rooms.find((r) => r.id === roomId))
  const placement = room?.furniture.find((f) => f.id === placementId)
  const bySeatKey = useFurnitureUsageStore((state) => state.bySeatKey)
  const usageByCharacterId = useFurnitureUsageStore((state) => state.byCharacterId)
  const characters = useCharacterStore((state) => state.characters)
  const movementById = useCharacterMovementStore((state) => state.byId)
  const activeConversations = useDialogueStore((state) => state.activeConversations)

  const [selectedId, setSelectedId] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  if (!room || !placement) return null
  const definition = getFurnitureDefinition(placement.furnitureId)
  const sitSlots = getSitSlots(definition)
  const lieSlots = getUsableLieSlots(definition) // capped to one, even for a bed with real two-pillow data — see its own doc comment
  const standSlots = getStandSlots(definition)
  const kind: InteractionKind | null = sitSlots.length > 0 ? 'sit' : lieSlots.length > 0 ? 'lie' : standSlots.length > 0 ? 'stand' : null
  if (!definition || !kind) return null
  const slots = kind === 'sit' ? sitSlots : kind === 'lie' ? lieSlots : standSlots

  // Proactive "이 지점은 막혀 있어요" check — 'stand' (table) only, per this fix's own scope. Excludes the table's
  // own footprint from the obstacle list (resolveWalkDestination already keeps the destination outside it) and
  // checks every other character currently in the room, so a spot already blocked by a nearby piece of furniture or
  // another character standing right there is flagged *before* the user tries, not only discovered via the movement
  // engine's own retry/timeout handling once they've already committed to walking there.
  const roomObstacles = kind === 'stand' ? furnitureObstacles(room.furniture.filter((f) => f.id !== placementId)) : []
  const otherPositions =
    kind === 'stand'
      ? characters
          .filter((c) => movementById[c.id]?.roomId === roomId)
          .map((c) => movementById[c.id])
          .filter((m): m is NonNullable<typeof m> => m !== undefined)
          .map((m) => ({ x: m.x, y: m.y }))
      : []

  // Eligible to be picked and assigned to a (different, empty) slot: physically in this room, not mid-conversation,
  // not `'talking'`. Deliberately NOT excluding a character already occupying a slot somewhere — selecting them and
  // clicking a different empty slot is exactly how a reassignment is triggered (startSitting/etc. release the old
  // slot first). Their *own current* slot shows 일어나기/종료/취소 instead of an action button, so they can't double-book.
  // Characters not currently using any furniture are listed (and defaulted to) first — clicking the action button
  // without touching the picker should always pick a free character, never silently steal an already-occupying one
  // off a different slot just because they happen to come first in the roster.
  const busyIds = new Set(Object.values(activeConversations).flat())
  const eligible = characters
    .filter((character) => {
      const movement = movementById[character.id]
      if (!movement || movement.roomId !== roomId) return false
      if (movement.status === 'talking') return false
      if (busyIds.has(character.id)) return false
      return true
    })
    .sort((a, b) => Number(!!usageByCharacterId[a.id]) - Number(!!usageByCharacterId[b.id]))

  function handleUse(slotId: string) {
    const characterId = selectedId || eligible[0]?.id
    if (!characterId || !kind) return
    const outcome = START[kind](characterId, placementId, slotId)
    setMessage(outcome === 'started' ? null : (OUTCOME_MESSAGE[kind][outcome] ?? null))
  }

  return (
    <div className="furniture-usage-panel">
      <div className="furniture-usage-panel-header">
        <span>{definition.name}</span>
        <button type="button" className="furniture-usage-panel-close" onClick={onClose} aria-label="선택 해제">
          ×
        </button>
      </div>

      {eligible.length > 1 && (
        <div className="furniture-usage-panel-picker">
          <span>{PICKER_LABEL[kind]}</span>
          <select aria-label={PICKER_LABEL[kind]} value={selectedId || eligible[0].id} onChange={(event) => setSelectedId(event.target.value)}>
            {eligible.map((character) => (
              <option key={character.id} value={character.id}>
                {character.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {slots.map((slot, index) => {
        const usage = bySeatKey[`${placementId}:${slot.id}`]
        const occupant = usage ? characters.find((c) => c.id === usage.characterId) : undefined
        const label = slotLabel(kind, slot.offsetX, index, slots.length)
        const stand = kind === 'stand' ? resolveStandDestination(placement, definition, slot) : null
        const blocked = !usage && kind === 'stand' && (!stand!.clearOfFootprint || isWalkDestinationBlocked(stand!.point, roomObstacles, otherPositions))
        return (
          <div key={slot.id} className="furniture-usage-panel-seat">
            {label && <span className="furniture-usage-panel-seat-label">{label}</span>}
            {usage && occupant ? (
              <>
                <span>{occupant.name}이(가) {usage.status === 'seated' ? OCCUPIED_LABEL[kind] : '다가가는 중이에요'}</span>
                <button type="button" onClick={() => standUp(usage.characterId)}>
                  {usage.status === 'seated' ? END_LABEL[kind] : '다가가기 취소'}
                </button>
              </>
            ) : blocked ? (
              <p className="furniture-usage-panel-reason">{BLOCKED_REASON}</p>
            ) : eligible.length === 0 ? (
              <p className="furniture-usage-panel-reason">{NO_CANDIDATE_REASON[kind]}</p>
            ) : (
              <button type="button" onClick={() => handleUse(slot.id)}>
                {ACTION_LABEL[kind]}
              </button>
            )}
          </div>
        )
      })}
      {message && <p className="furniture-usage-panel-reason">{message}</p>}
    </div>
  )
}
