import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DecorateToolbar } from './DecorateToolbar'
import { getActiveDecorateRoom, useHomeStore } from './homeStore'
import type { FurniturePlacement } from './types'

const placement = { id: '1', furnitureId: 'sofa', x: 0, y: 0, scale: 1, rotation: 0 as const, colorway: 'rose', layer: 0 }

function setActiveRoomFurniture(furniture: FurniturePlacement[]) {
  const roomId = useHomeStore.getState().activeDecorateRoomId
  useHomeStore.setState((state) => ({
    rooms: state.rooms.map((room) => (room.id === roomId ? { ...room, furniture } : room)),
  }))
}

function activeFurniture() {
  return getActiveDecorateRoom(useHomeStore.getState()).furniture
}

describe('DecorateToolbar', () => {
  beforeEach(() => {
    localStorage.clear()
    setActiveRoomFurniture([])
    useHomeStore.setState({ selectedFurnitureId: null })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('disables deselect when nothing is selected, and clears selection when clicked', async () => {
    setActiveRoomFurniture([placement])
    useHomeStore.setState({ selectedFurnitureId: '1' })
    const user = userEvent.setup()
    render(<DecorateToolbar />)

    const deselect = screen.getByRole('button', { name: '선택 해제' })
    expect(deselect).toBeEnabled()

    await user.click(deselect)
    expect(useHomeStore.getState().selectedFurnitureId).toBeNull()
  })

  it('disables reset when there is no furniture', () => {
    render(<DecorateToolbar />)
    expect(screen.getByRole('button', { name: '배치 초기화' })).toBeDisabled()
  })

  it('only resets the layout if the confirmation dialog is accepted', async () => {
    setActiveRoomFurniture([placement])
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<DecorateToolbar />)

    await user.click(screen.getByRole('button', { name: '배치 초기화' }))
    expect(activeFurniture()).toHaveLength(1)

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: '배치 초기화' }))
    expect(activeFurniture()).toHaveLength(0)
  })

  it('저장/불러오기 UI는 캐릭터 설정창으로 옮겨졌으므로 더 이상 여기 남아있지 않다', () => {
    render(<DecorateToolbar />)
    expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '불러오기' })).not.toBeInTheDocument()
  })
})
