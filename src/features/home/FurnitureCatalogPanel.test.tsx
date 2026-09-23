import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FurnitureCatalog } from './FurnitureCatalogPanel'
import { getActiveDecorateRoom, useHomeStore } from './homeStore'

function activeFurniture() {
  return getActiveDecorateRoom(useHomeStore.getState()).furniture
}

describe('FurnitureCatalog', () => {
  beforeEach(() => {
    localStorage.clear()
    const roomId = useHomeStore.getState().activeDecorateRoomId
    useHomeStore.setState((state) => ({
      rooms: state.rooms.map((room) => (room.id === roomId ? { ...room, furniture: [] } : room)),
      selectedFurnitureId: null,
    }))
  })

  afterEach(() => {
    cleanup()
  })

  it('adds a furniture placement with sensible defaults and selects it', async () => {
    const user = userEvent.setup()
    render(<FurnitureCatalog />)

    const sofaCard = screen.getByText('소파').closest('article')
    if (!sofaCard) throw new Error('sofa card not found')
    await user.click(within(sofaCard).getByRole('button', { name: '+ 배치' }))

    const furniture = activeFurniture()
    expect(furniture).toHaveLength(1)
    expect(furniture[0]).toMatchObject({ furnitureId: 'sofa', scale: 1, rotation: 0, layer: 0 })
    expect(useHomeStore.getState().selectedFurnitureId).toBe(furniture[0].id)
  })

  it('groups furniture cards by category: 거실/침실/주방/서재/조명/장식/창문·러그', () => {
    render(<FurnitureCatalog />)
    // heading role scopes this to the <h3> category labels.
    for (const label of ['거실', '침실', '주방', '서재', '조명', '장식', '창문·러그']) {
      expect(screen.getByRole('heading', { name: label })).toBeInTheDocument()
    }
  })

  it('places a rug and a window through the same "+ 배치" flow as other furniture', async () => {
    const user = userEvent.setup()
    render(<FurnitureCatalog />)

    const rugCard = screen.getByText('러그').closest('article')
    const windowCard = screen.getByText('창문').closest('article')
    if (!rugCard || !windowCard) throw new Error('rug/window card not found')

    await user.click(within(rugCard).getByRole('button', { name: '+ 배치' }))
    await user.click(within(windowCard).getByRole('button', { name: '+ 배치' }))

    const ids = activeFurniture().map((f) => f.furnitureId)
    expect(ids).toContain('rug')
    expect(ids).toContain('window')
  })

  it('assigns increasing layer values as furniture is added', async () => {
    const user = userEvent.setup()
    render(<FurnitureCatalog />)

    const buttons = screen.getAllByRole('button', { name: '+ 배치' })
    await user.click(buttons[0])
    await user.click(buttons[1])

    expect(activeFurniture().map((f) => f.layer)).toEqual([0, 1])
  })
})
