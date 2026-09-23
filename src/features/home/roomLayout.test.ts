import { describe, expect, it } from 'vitest'
import { clampToRoom, ROOM_HEIGHT, ROOM_WIDTH } from './roomLayout'

describe('clampToRoom', () => {
  it('leaves a position that is already in bounds unchanged', () => {
    expect(clampToRoom(200, 150, 60, 40)).toEqual({ x: 200, y: 150 })
  })

  it('clamps a position past the left/top edge to the furniture half-extent', () => {
    expect(clampToRoom(-50, -50, 60, 40)).toEqual({ x: 30, y: 20 })
  })

  it('clamps a position past the right/bottom edge to stay fully inside the room', () => {
    expect(clampToRoom(ROOM_WIDTH + 200, ROOM_HEIGHT + 200, 60, 40)).toEqual({
      x: ROOM_WIDTH - 30,
      y: ROOM_HEIGHT - 20,
    })
  })
})
