import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { RoomTabs } from './RoomTabs'
import { useHomeStore } from './homeStore'
import { MAX_ROOMS } from './roomTypes'
import { useCharacterStore } from '../character/characterStore'
import { EMPTY_AI_PROFILE, type Character } from '../character/types'
import { useCharacterMovementStore } from '../simulation/characterMovementStore'

function makeCharacter(id: string, name: string): Character {
  return {
    id,
    name,
    imageDataUrl: 'data:image/png;base64,',
    displayScale: 1,
    footOffsetRatio: 0,
    imageBounds: null,
    traits: { personality: '', favoriteColor: '' },
    aiProfile: EMPTY_AI_PROFILE,
  }
}

function Harness() {
  const activeRoomId = useHomeStore((state) => state.activeDecorateRoomId)
  const setActiveDecorateRoom = useHomeStore((state) => state.setActiveDecorateRoom)
  return <RoomTabs activeRoomId={activeRoomId} onSelectRoom={setActiveDecorateRoom} />
}

describe('RoomTabs', () => {
  beforeEach(() => {
    const room = useHomeStore.getInitialState().rooms[0]
    useHomeStore.setState({
      rooms: [{ ...room, furniture: [] }],
      activeDecorateRoomId: room.id,
      activeLiveRoomId: room.id,
      selectedFurnitureId: null,
    })
    useCharacterStore.setState({ characters: [] })
    useCharacterMovementStore.setState({ byId: {} })
  })

  afterEach(() => {
    cleanup()
  })

  it('adds a room through the kind/name/preset form and switches to it', () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: '+ 방 추가' }))
    fireEvent.change(screen.getByLabelText('새 방 종류'), { target: { value: 'bedroom' } })
    fireEvent.change(screen.getByLabelText('새 방 이름'), { target: { value: '준희의 서재' } })
    fireEvent.click(screen.getByRole('button', { name: '추가' }))

    const rooms = useHomeStore.getState().rooms
    expect(rooms).toHaveLength(2)
    const added = rooms[1]
    expect(added.name).toBe('준희의 서재')
    expect(added.kind).toBe('bedroom')
    expect(useHomeStore.getState().activeDecorateRoomId).toBe(added.id)
  })

  it('disables "+ 방 추가" once MAX_ROOMS is reached, with an explanatory title', () => {
    while (useHomeStore.getState().rooms.length < MAX_ROOMS) {
      useHomeStore.getState().addRoom('free', '방', 'empty')
    }
    render(<Harness />)

    const addButton = screen.getByRole('button', { name: '+ 방 추가' })
    expect(addButton).toBeDisabled()
    expect(addButton).toHaveAttribute('title', expect.stringContaining(String(MAX_ROOMS)))
  })

  it('renames a room via double-click, Enter to confirm', () => {
    render(<Harness />)
    const roomId = useHomeStore.getState().activeDecorateRoomId

    fireEvent.doubleClick(screen.getByRole('button', { name: useHomeStore.getState().rooms[0].name }))
    const input = screen.getByLabelText('방 이름')
    fireEvent.change(input, { target: { value: '작은 주방' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(useHomeStore.getState().rooms.find((r) => r.id === roomId)?.name).toBe('작은 주방')
  })

  it('does not show a delete button when only one room exists', () => {
    render(<Harness />)
    expect(screen.queryByRole('button', { name: /삭제/ })).not.toBeInTheDocument()
  })

  it('deletes an empty non-last room immediately after confirmation, with no reassignment step needed', () => {
    const secondId = useHomeStore.getState().addRoom('kitchen', '주방', 'empty')
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: '주방 삭제' }))
    expect(screen.getByText(/주방.*방을 삭제할까요/)).toBeInTheDocument()
    expect(screen.queryByLabelText('캐릭터를 옮길 방')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '삭제' }))

    expect(useHomeStore.getState().rooms.find((r) => r.id === secondId)).toBeUndefined()
  })

  it('requires picking a target room before deleting a room that has characters in it, and reassigns them on confirm', () => {
    const livingRoomId = useHomeStore.getState().activeDecorateRoomId
    const bedroomId = useHomeStore.getState().addRoom('bedroom', '침실', 'empty')
    useCharacterStore.setState({ characters: [makeCharacter('a', 'Milo')] })
    useCharacterMovementStore.setState({
      byId: {
        a: { id: 'a', roomId: bedroomId, x: 100, y: 100, destination: null, destinationRoomId: null, currentBehavior: null, status: 'idle', restTicksRemaining: 0, stuckTicks: 0 },
      },
    })
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: '침실 삭제' }))
    expect(screen.getByText(/Milo.*이 방에 있어요/)).toBeInTheDocument()

    const deleteButton = screen.getByRole('button', { name: '삭제' })
    expect(deleteButton).toBeDisabled()

    fireEvent.click(deleteButton)
    // Refused — the room must still exist since no target was chosen.
    expect(useHomeStore.getState().rooms.find((r) => r.id === bedroomId)).toBeDefined()

    fireEvent.change(screen.getByLabelText('캐릭터를 옮길 방'), { target: { value: livingRoomId } })
    expect(deleteButton).toBeEnabled()
    fireEvent.click(deleteButton)

    expect(useHomeStore.getState().rooms.find((r) => r.id === bedroomId)).toBeUndefined()
    expect(useCharacterMovementStore.getState().byId.a.roomId).toBe(livingRoomId)
  })

  it('cancels the delete flow without changing anything', () => {
    const secondId = useHomeStore.getState().addRoom('kitchen', '주방', 'empty')
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: '주방 삭제' }))
    fireEvent.click(screen.getByRole('button', { name: '취소' }))

    expect(screen.queryByText(/삭제할까요/)).not.toBeInTheDocument()
    expect(useHomeStore.getState().rooms.find((r) => r.id === secondId)).toBeDefined()
  })

  it('shows no character-count or location hints on the tabs themselves (finding characters is the point)', () => {
    useCharacterStore.setState({ characters: [makeCharacter('a', 'Milo')] })
    const roomId = useHomeStore.getState().activeDecorateRoomId
    useCharacterMovementStore.setState({
      byId: {
        a: { id: 'a', roomId, x: 100, y: 100, destination: null, destinationRoomId: null, currentBehavior: null, status: 'idle', restTicksRemaining: 0, stuckTicks: 0 },
      },
    })
    render(<Harness />)

    expect(screen.queryByText(/1명|캐릭터 있음|1개/)).not.toBeInTheDocument()
  })
})
