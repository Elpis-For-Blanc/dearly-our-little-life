import { useState } from 'react'
import { useCharacterStore } from '../character/characterStore'
import { endActiveConversationsFor } from '../dialogue/autoDialogueTrigger'
import { endActiveCharacterInteractionsFor } from '../interaction/characterInteractionTrigger'
import { useCharacterMovementStore } from '../simulation/characterMovementStore'
import { releaseFurnitureUsage } from '../simulation/furnitureUsageTrigger'
import { useHomeStore, type RoomPreset } from './homeStore'
import { MAX_ROOMS, ROOM_KIND_LABELS, ROOM_KIND_ORDER, type RoomKind } from './roomTypes'
import './RoomTabs.css'

interface RoomTabsProps {
  activeRoomId: string
  onSelectRoom: (id: string) => void
}

/**
 * Shared room-selection UI for both the decorate screen (decorates the
 * selected room) and the live screen (observes the selected room) —
 * `activeRoomId`/`onSelectRoom` are the only things that differ between the
 * two call sites (`activeDecorateRoomId`/`setActiveDecorateRoom` vs.
 * `activeLiveRoomId`/`setActiveLiveRoom`). Deliberately shows no character
 * counts or location hints on the tabs themselves — finding characters by
 * clicking around is the point (see the multi-room spec's §6).
 */
export function RoomTabs({ activeRoomId, onSelectRoom }: RoomTabsProps) {
  const rooms = useHomeStore((state) => state.rooms)
  const addRoom = useHomeStore((state) => state.addRoom)
  const renameRoom = useHomeStore((state) => state.renameRoom)
  const removeRoom = useHomeStore((state) => state.removeRoom)
  const characters = useCharacterStore((state) => state.characters)
  const movementById = useCharacterMovementStore((state) => state.byId)
  const moveCharacterToRoom = useCharacterMovementStore((state) => state.moveCharacterToRoom)

  const [isAdding, setIsAdding] = useState(false)
  const [newKind, setNewKind] = useState<RoomKind>('free')
  const [newName, setNewName] = useState('')
  const [newPreset, setNewPreset] = useState<RoomPreset>('empty')

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState('')

  function startAdd() {
    setIsAdding(true)
    setNewKind('free')
    setNewName('')
    setNewPreset('empty')
  }

  function confirmAdd() {
    const id = addRoom(newKind, newName.trim() || ROOM_KIND_LABELS[newKind], newPreset)
    if (id) onSelectRoom(id)
    setIsAdding(false)
  }

  function startRename(id: string, currentName: string) {
    setRenamingId(id)
    setRenameValue(currentName)
  }

  function confirmRename() {
    if (renamingId) renameRoom(renamingId, renameValue)
    setRenamingId(null)
  }

  function occupantsOf(roomId: string) {
    return characters.filter((c) => movementById[c.id]?.roomId === roomId)
  }

  function startDelete(id: string) {
    setDeletingId(id)
    setDeleteTargetId('')
  }

  function confirmDelete() {
    if (!deletingId) return
    const occupants = occupantsOf(deletingId)
    if (occupants.length > 0) {
      if (!deleteTargetId) return // the user must explicitly pick a room — no silent default
      const targetRoom = rooms.find((r) => r.id === deleteTargetId)
      if (!targetRoom) return
      for (const character of occupants) {
        // End first, relocate second: a mid-conversation occupant gets a clean, immediate conversation end (bubble
        // cleared, movement freed) before moveCharacterToRoom repositions it — never the reverse order, which would
        // leave dialogueStore thinking the character is still busy in a room it no longer occupies. Furniture usage
        // (approaching or seated on a piece in the room being deleted) is dropped the same way — bookkeeping only,
        // since moveCharacterToRoom is about to reposition the character into a different room anyway.
        endActiveConversationsFor(character.id)
        endActiveCharacterInteractionsFor(character.id)
        releaseFurnitureUsage(character.id)
        moveCharacterToRoom(character.id, targetRoom.id, targetRoom.doorway.entryPosition)
      }
    }
    removeRoom(deletingId)
    setDeletingId(null)
  }

  const deletingRoom = rooms.find((r) => r.id === deletingId)
  const deletingOccupants = deletingId ? occupantsOf(deletingId) : []

  return (
    <div className="room-tabs">
      <div className="room-tabs-list">
        {rooms.map((room) => (
          <div key={room.id} className={room.id === activeRoomId ? 'room-tab room-tab-active' : 'room-tab'}>
            {renamingId === room.id ? (
              <input
                className="room-tab-rename-input"
                aria-label="방 이름"
                value={renameValue}
                autoFocus
                onChange={(event) => setRenameValue(event.target.value)}
                onBlur={confirmRename}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') confirmRename()
                  if (event.key === 'Escape') setRenamingId(null)
                }}
              />
            ) : (
              <button
                type="button"
                className="room-tab-select"
                onClick={() => onSelectRoom(room.id)}
                onDoubleClick={() => startRename(room.id, room.name)}
                title="더블클릭하면 이름을 바꿀 수 있어요"
              >
                {room.name}
              </button>
            )}
            {rooms.length > 1 && (
              <button type="button" className="room-tab-delete" aria-label={`${room.name} 삭제`} onClick={() => startDelete(room.id)}>
                ×
              </button>
            )}
          </div>
        ))}

        {isAdding ? (
          <div className="room-tab-add-form">
            <select aria-label="새 방 종류" value={newKind} onChange={(event) => setNewKind(event.target.value as RoomKind)}>
              {ROOM_KIND_ORDER.map((kind) => (
                <option key={kind} value={kind}>
                  {ROOM_KIND_LABELS[kind]}
                </option>
              ))}
            </select>
            <input
              aria-label="새 방 이름"
              placeholder={ROOM_KIND_LABELS[newKind]}
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
            <select aria-label="새 방 초기 구성" value={newPreset} onChange={(event) => setNewPreset(event.target.value as RoomPreset)}>
              <option value="empty">빈 방으로 시작</option>
              <option value="default">기본 구성으로 시작</option>
            </select>
            <button type="button" onClick={confirmAdd}>
              추가
            </button>
            <button type="button" onClick={() => setIsAdding(false)}>
              취소
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="room-tab-add"
            disabled={rooms.length >= MAX_ROOMS}
            title={rooms.length >= MAX_ROOMS ? `방은 최대 ${MAX_ROOMS}개까지 만들 수 있어요.` : undefined}
            onClick={startAdd}
          >
            + 방 추가
          </button>
        )}
      </div>

      {deletingRoom && (
        <div className="room-tab-delete-confirm">
          <p>&quot;{deletingRoom.name}&quot; 방을 삭제할까요? 이 방의 가구와 소품도 함께 삭제됩니다.</p>
          {deletingOccupants.length > 0 && (
            <div className="room-tab-delete-reassign">
              <span>{deletingOccupants.map((c) => c.name).join(', ')}이(가) 이 방에 있어요. 옮길 방을 선택해 주세요.</span>
              <select aria-label="캐릭터를 옮길 방" value={deleteTargetId} onChange={(event) => setDeleteTargetId(event.target.value)}>
                <option value="">방 선택...</option>
                {rooms
                  .filter((r) => r.id !== deletingId)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </div>
          )}
          <div className="room-tab-delete-actions">
            <button type="button" onClick={confirmDelete} disabled={deletingOccupants.length > 0 && !deleteTargetId}>
              삭제
            </button>
            <button type="button" onClick={() => setDeletingId(null)}>
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
