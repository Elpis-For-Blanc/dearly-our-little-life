import { beforeEach, describe, expect, it } from 'vitest'
import { useFurnitureUsageStore } from './furnitureUsageStore'

function reserve(characterId: string, placementId: string, slotId = 'sofa-left', roomId = 'room-1') {
  return useFurnitureUsageStore.getState().reserve({ characterId, placementId, roomId, slotId })
}

describe('furnitureUsageStore (per-seat, not per-placement)', () => {
  beforeEach(() => {
    useFurnitureUsageStore.getState().reset()
  })

  it('reserving starts a seat at status "approaching" with 0 approach ticks, keyed by placement+slot', () => {
    expect(reserve('a', 'sofa-1', 'sofa-left')).toBe(true)
    const usage = useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left']
    expect(usage).toEqual({ characterId: 'a', placementId: 'sofa-1', roomId: 'room-1', slotId: 'sofa-left', status: 'approaching', approachTicks: 0 })
    expect(useFurnitureUsageStore.getState().byCharacterId.a).toBe('sofa-1:sofa-left')
  })

  it('refuses to reserve an already-reserved/occupied seat — one occupant per seat', () => {
    expect(reserve('a', 'sofa-1', 'sofa-left')).toBe(true)
    expect(reserve('b', 'sofa-1', 'sofa-left')).toBe(false)
    expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left'].characterId).toBe('a')
  })

  it('two DIFFERENT seats on the same placement are fully independent — both can be reserved at once', () => {
    expect(reserve('a', 'sofa-1', 'sofa-left')).toBe(true)
    expect(reserve('b', 'sofa-1', 'sofa-right')).toBe(true)
    expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left'].characterId).toBe('a')
    expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-right'].characterId).toBe('b')
  })

  it('refuses to let one character reserve two seats at once (even on different placements)', () => {
    expect(reserve('a', 'sofa-1', 'sofa-left')).toBe(true)
    expect(reserve('a', 'sofa-1', 'sofa-right')).toBe(false)
    expect(reserve('a', 'chair-1', 'seat')).toBe(false)
    expect(useFurnitureUsageStore.getState().byCharacterId.a).toBe('sofa-1:sofa-left')
    expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-right']).toBeUndefined()
    expect(useFurnitureUsageStore.getState().bySeatKey['chair-1:seat']).toBeUndefined()
  })

  it('markSeated transitions status and resets approachTicks; no-op for a character with no reservation', () => {
    reserve('a', 'sofa-1', 'sofa-left')
    useFurnitureUsageStore.getState().incrementApproachTicks('a')
    useFurnitureUsageStore.getState().incrementApproachTicks('a')
    useFurnitureUsageStore.getState().markSeated('a')
    expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left']).toEqual({
      characterId: 'a', placementId: 'sofa-1', roomId: 'room-1', slotId: 'sofa-left', status: 'seated', approachTicks: 0,
    })
    expect(() => useFurnitureUsageStore.getState().markSeated('nobody')).not.toThrow()
  })

  it('incrementApproachTicks counts up per call and returns 0 for a character with no reservation', () => {
    reserve('a', 'sofa-1', 'sofa-left')
    expect(useFurnitureUsageStore.getState().incrementApproachTicks('a')).toBe(1)
    expect(useFurnitureUsageStore.getState().incrementApproachTicks('a')).toBe(2)
    expect(useFurnitureUsageStore.getState().incrementApproachTicks('a')).toBe(3)
    expect(useFurnitureUsageStore.getState().incrementApproachTicks('nobody')).toBe(0)
  })

  it('release drops only that character\'s own seat, freeing it for someone else, and never touches a seatmate\'s seat', () => {
    reserve('a', 'sofa-1', 'sofa-left')
    reserve('b', 'sofa-1', 'sofa-right')
    useFurnitureUsageStore.getState().release('a')
    expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left']).toBeUndefined()
    expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
    expect(reserve('c', 'sofa-1', 'sofa-left')).toBe(true)
    // b's seat is completely untouched.
    expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-right'].characterId).toBe('b')
  })

  it('release is a safe no-op for a character using nothing', () => {
    expect(() => useFurnitureUsageStore.getState().release('nobody')).not.toThrow()
    expect(useFurnitureUsageStore.getState().bySeatKey).toEqual({})
  })

  it('releaseSeat drops one specific seat by placement+slot id, without touching another seat on the same placement', () => {
    reserve('a', 'sofa-1', 'sofa-left')
    reserve('b', 'sofa-1', 'sofa-right')
    useFurnitureUsageStore.getState().releaseSeat('sofa-1', 'sofa-left')
    expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left']).toBeUndefined()
    expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
    expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-right'].characterId).toBe('b')
  })

  it('releaseSeat is a safe no-op for a seat nobody is using', () => {
    expect(() => useFurnitureUsageStore.getState().releaseSeat('nothing-here', 'seat')).not.toThrow()
  })

  it('releasePlacement drops EVERY seat on that placement at once — a whole-furniture deletion cleans up both occupants of a 2-seat sofa', () => {
    reserve('a', 'sofa-1', 'sofa-left')
    reserve('b', 'sofa-1', 'sofa-right')
    reserve('c', 'chair-1', 'seat') // an unrelated placement, must survive
    useFurnitureUsageStore.getState().releasePlacement('sofa-1')
    expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-left']).toBeUndefined()
    expect(useFurnitureUsageStore.getState().bySeatKey['sofa-1:sofa-right']).toBeUndefined()
    expect(useFurnitureUsageStore.getState().byCharacterId.a).toBeUndefined()
    expect(useFurnitureUsageStore.getState().byCharacterId.b).toBeUndefined()
    expect(useFurnitureUsageStore.getState().bySeatKey['chair-1:seat'].characterId).toBe('c')
  })

  it('releasePlacement is a safe no-op for a placement nobody is using', () => {
    expect(() => useFurnitureUsageStore.getState().releasePlacement('nothing-here')).not.toThrow()
  })

  it('reset clears everything', () => {
    reserve('a', 'sofa-1', 'sofa-left')
    reserve('b', 'sofa-1', 'sofa-right')
    useFurnitureUsageStore.getState().reset()
    expect(useFurnitureUsageStore.getState().bySeatKey).toEqual({})
    expect(useFurnitureUsageStore.getState().byCharacterId).toEqual({})
  })
})
