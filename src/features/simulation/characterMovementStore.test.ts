import { beforeEach, describe, expect, it } from 'vitest'
import { useCharacterMovementStore } from './characterMovementStore'

const ROOM_1 = 'room-1'
const ROOM_2 = 'room-2'

describe('characterMovementStore', () => {
  beforeEach(() => {
    useCharacterMovementStore.setState({ byId: {} })
  })

  it('syncCharacterIds spawns an entry for each new id, including its spawn room', () => {
    useCharacterMovementStore.getState().syncCharacterIds(['a', 'b'], () => ({ position: { x: 10, y: 20 }, roomId: ROOM_1 }))
    const { byId } = useCharacterMovementStore.getState()
    expect(byId.a).toMatchObject({ id: 'a', roomId: ROOM_1, x: 10, y: 20, status: 'idle', destination: null, destinationRoomId: null, currentBehavior: null })
    expect(byId.b).toMatchObject({ id: 'b', roomId: ROOM_1, x: 10, y: 20, status: 'idle' })
  })

  it('syncCharacterIds preserves existing entries instead of re-spawning them', () => {
    useCharacterMovementStore.getState().syncCharacterIds(['a'], () => ({ position: { x: 10, y: 20 }, roomId: ROOM_1 }))
    useCharacterMovementStore.getState().setPosition('a', { x: 99, y: 88 })
    useCharacterMovementStore.getState().syncCharacterIds(['a'], () => ({ position: { x: 0, y: 0 }, roomId: ROOM_2 }))
    expect(useCharacterMovementStore.getState().byId.a).toMatchObject({ x: 99, y: 88, roomId: ROOM_1 })
  })

  it('syncCharacterIds drops entries for ids no longer present (a character was removed)', () => {
    useCharacterMovementStore.getState().syncCharacterIds(['a', 'b'], () => ({ position: { x: 0, y: 0 }, roomId: ROOM_1 }))
    useCharacterMovementStore.getState().syncCharacterIds(['a'], () => ({ position: { x: 0, y: 0 }, roomId: ROOM_1 }))
    expect(useCharacterMovementStore.getState().byId.b).toBeUndefined()
    expect(useCharacterMovementStore.getState().byId.a).toBeDefined()
  })

  it('setPosition/setDestination/setStatus update only the targeted character', () => {
    useCharacterMovementStore.getState().syncCharacterIds(['a', 'b'], () => ({ position: { x: 0, y: 0 }, roomId: ROOM_1 }))
    useCharacterMovementStore.getState().setPosition('a', { x: 5, y: 5 })
    useCharacterMovementStore.getState().setDestination('a', { x: 50, y: 50 })
    useCharacterMovementStore.getState().setStatus('a', 'talking')

    const { byId } = useCharacterMovementStore.getState()
    expect(byId.a).toMatchObject({ x: 5, y: 5, destination: { x: 50, y: 50 }, status: 'talking' })
    expect(byId.b).toMatchObject({ x: 0, y: 0, status: 'idle' })
  })

  it('setRoomId/setDestinationRoomId/setCurrentBehavior update only the targeted character', () => {
    useCharacterMovementStore.getState().syncCharacterIds(['a', 'b'], () => ({ position: { x: 0, y: 0 }, roomId: ROOM_1 }))
    useCharacterMovementStore.getState().setDestinationRoomId('a', ROOM_2)
    useCharacterMovementStore.getState().setCurrentBehavior('a', 'changeRoom')
    useCharacterMovementStore.getState().setRoomId('a', ROOM_2)

    const { byId } = useCharacterMovementStore.getState()
    expect(byId.a).toMatchObject({ roomId: ROOM_2, destinationRoomId: ROOM_2, currentBehavior: 'changeRoom' })
    expect(byId.b).toMatchObject({ roomId: ROOM_1, destinationRoomId: null, currentBehavior: null })
  })

  it('moveCharacterToRoom teleports directly, clearing destination/destinationRoomId and resetting status/rest', () => {
    useCharacterMovementStore.getState().syncCharacterIds(['a'], () => ({ position: { x: 0, y: 0 }, roomId: ROOM_1 }))
    useCharacterMovementStore.getState().setDestination('a', { x: 10, y: 10 })
    useCharacterMovementStore.getState().setDestinationRoomId('a', ROOM_2)
    useCharacterMovementStore.getState().setStatus('a', 'moving')
    useCharacterMovementStore.getState().setRestTicksRemaining('a', 5)

    useCharacterMovementStore.getState().moveCharacterToRoom('a', ROOM_2, { x: 77, y: 88 })

    expect(useCharacterMovementStore.getState().byId.a).toMatchObject({
      roomId: ROOM_2,
      x: 77,
      y: 88,
      destination: null,
      destinationRoomId: null,
      status: 'idle',
      restTicksRemaining: 0,
      stuckTicks: 0,
    })
  })
})
