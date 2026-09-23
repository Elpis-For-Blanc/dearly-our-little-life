import { beforeEach, describe, expect, it } from 'vitest'
import { useCharacterStore } from '../character/characterStore'
import { EMPTY_AI_PROFILE, type Character } from '../character/types'
import { useCharacterMovementStore, type CharacterMovementState } from '../simulation/characterMovementStore'
import { runNeedsPass } from './needsTrigger'
import { useNeedsStore } from './needsStore'

function character(id: string): Character {
  return {
    id,
    name: id,
    imageDataUrl: 'data:image/png;base64,',
    displayScale: 1,
    footOffsetRatio: 0,
    imageBounds: null,
    traits: { personality: '', favoriteColor: '' },
    aiProfile: { ...EMPTY_AI_PROFILE },
  }
}

function movementEntry(id: string, roomId: string, overrides: Partial<CharacterMovementState> = {}): CharacterMovementState {
  return { id, roomId, x: 100, y: 100, destination: null, destinationRoomId: null, currentBehavior: null, status: 'idle', restTicksRemaining: 0, stuckTicks: 0, ...overrides }
}

describe('needsTrigger: runNeedsPass', () => {
  beforeEach(() => {
    localStorage.clear()
    useCharacterStore.setState({ characters: [] })
    useCharacterMovementStore.setState({ byId: {} })
    useNeedsStore.setState({ byId: {} })
  })

  it('등록된 캐릭터가 없으면 아무 일도 하지 않는다', () => {
    expect(() => runNeedsPass()).not.toThrow()
    expect(useNeedsStore.getState().byId).toEqual({})
  })

  it('욕구 기록이 없는 등록된 캐릭터에게 기본 욕구를 만들어 준다 (defensive fallback)', () => {
    useCharacterStore.setState({ characters: [character('a')] })
    useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 'room-1') } })
    runNeedsPass()
    expect(useNeedsStore.getState().byId.a).toBeDefined()
  })

  it('이 defensive fallback은 Math.random()을 전혀 호출하지 않는다 (시드 기반 시뮬레이션 테스트와의 충돌 방지)', () => {
    useCharacterStore.setState({ characters: [character('a')] })
    useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 'room-1') } })
    let calls = 0
    const original = Math.random
    Math.random = () => {
      calls++
      return original()
    }
    try {
      runNeedsPass()
    } finally {
      Math.random = original
    }
    expect(calls).toBe(0)
  })

  it('한 번의 pass는 욕구를 한 tick만큼만 깎는다 (렌더링마다 깎이지 않는다)', () => {
    useCharacterStore.setState({ characters: [character('a')] })
    useCharacterMovementStore.setState({ byId: { a: movementEntry('a', 'room-1') } })
    useNeedsStore.getState().setNeeds('a', { hunger: 100, energy: 100, fun: 100, social: 100 })

    runNeedsPass()
    const afterOne = useNeedsStore.getState().byId.a!.hunger

    runNeedsPass()
    const afterTwo = useNeedsStore.getState().byId.a!.hunger

    expect(afterOne).toBeLessThan(100)
    expect(afterTwo).toBeLessThan(afterOne)
    // exactly one tick's worth of decay each call, not a runaway/compounding rate
    expect(100 - afterOne).toBeCloseTo(afterOne - afterTwo, 6)
  })

  it('characterMovementStore에 아직 동기화되지 않은 캐릭터는 건너뛴다 (크래시하지 않음)', () => {
    useCharacterStore.setState({ characters: [character('a')] })
    // no movement entry for 'a' yet
    expect(() => runNeedsPass()).not.toThrow()
  })

  it('같은 방에 다른 캐릭터가 있으면 social이 감소하지 않는다', () => {
    useCharacterStore.setState({ characters: [character('a'), character('b')] })
    useCharacterMovementStore.setState({
      byId: { a: movementEntry('a', 'room-1'), b: movementEntry('b', 'room-1') },
    })
    useNeedsStore.getState().setNeeds('a', { hunger: 100, energy: 100, fun: 100, social: 100 })

    runNeedsPass()

    expect(useNeedsStore.getState().byId.a!.social).toBe(100)
  })

  it('혼자 있는 캐릭터는 social이 감소한다', () => {
    useCharacterStore.setState({ characters: [character('a'), character('b')] })
    useCharacterMovementStore.setState({
      byId: { a: movementEntry('a', 'room-1'), b: movementEntry('b', 'room-2') },
    })
    useNeedsStore.getState().setNeeds('a', { hunger: 100, energy: 100, fun: 100, social: 100 })

    runNeedsPass()

    expect(useNeedsStore.getState().byId.a!.social).toBeLessThan(100)
  })
})
