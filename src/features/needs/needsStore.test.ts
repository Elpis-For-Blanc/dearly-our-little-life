import { beforeEach, describe, expect, it } from 'vitest'
import { normalizeNeedsById, useNeedsStore } from './needsStore'

describe('needsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useNeedsStore.setState({ byId: {} })
  })

  it('ensureCharacter는 없는 캐릭터에만 기본 욕구를 생성한다', () => {
    useNeedsStore.getState().ensureCharacter('a')
    expect(useNeedsStore.getState().byId.a).toBeDefined()
  })

  it('ensureCharacter는 이미 있는 캐릭터의 욕구를 덮어쓰지 않는다', () => {
    useNeedsStore.getState().setNeeds('a', { hunger: 12, energy: 34, fun: 56, social: 78 })
    useNeedsStore.getState().ensureCharacter('a')
    expect(useNeedsStore.getState().byId.a).toEqual({ hunger: 12, energy: 34, fun: 56, social: 78 })
  })

  it('setNeeds는 값을 0~100으로 clamp해서 저장한다', () => {
    useNeedsStore.getState().setNeeds('a', { hunger: 150, energy: -10, fun: 50, social: 50 })
    expect(useNeedsStore.getState().byId.a).toEqual({ hunger: 100, energy: 0, fun: 50, social: 50 })
  })

  it('캐릭터 삭제 시 해당 캐릭터의 욕구 상태가 정리된다', () => {
    useNeedsStore.getState().ensureCharacter('a')
    useNeedsStore.getState().ensureCharacter('b')
    useNeedsStore.getState().removeCharacter('a')
    expect(useNeedsStore.getState().byId.a).toBeUndefined()
    expect(useNeedsStore.getState().byId.b).toBeDefined()
  })

  it('removeCharacter는 없는 id에 대해서도 안전하다 (no-op)', () => {
    expect(() => useNeedsStore.getState().removeCharacter('ghost')).not.toThrow()
  })

  it('localStorage에 자동으로 저장된다 (자동 저장, dearly-needs 키)', () => {
    useNeedsStore.getState().setNeeds('a', { hunger: 40, energy: 40, fun: 40, social: 40 })
    const stored = JSON.parse(localStorage.getItem('dearly-needs') ?? '{}')
    expect(stored.state.byId.a).toEqual({ hunger: 40, energy: 40, fun: 40, social: 40 })
  })
})

describe('needsStore: normalizeNeedsById — 손상된 저장 데이터 방어', () => {
  it('정상적인 항목은 그대로 유지된다', () => {
    const result = normalizeNeedsById({ a: { hunger: 10, energy: 20, fun: 30, social: 40 } })
    expect(result.a).toEqual({ hunger: 10, energy: 20, fun: 30, social: 40 })
  })

  it('손상된 항목 하나가 다른 정상 항목까지 무너뜨리지 않는다', () => {
    const result = normalizeNeedsById({
      a: { hunger: 10, energy: 20, fun: 30, social: 40 },
      b: null,
      c: { hunger: 'not-a-number' },
    })
    expect(result.a).toBeDefined()
    expect(result.b).toBeUndefined()
    expect(result.c).toBeUndefined()
  })

  it('배열/문자열/undefined 등 객체가 아닌 값은 빈 맵으로 처리된다', () => {
    expect(normalizeNeedsById(undefined)).toEqual({})
    expect(normalizeNeedsById('garbage')).toEqual({})
    expect(normalizeNeedsById([1, 2, 3])).toEqual({})
  })
})
