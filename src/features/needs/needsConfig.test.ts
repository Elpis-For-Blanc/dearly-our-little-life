import { describe, expect, it } from 'vitest'
import { clampNeed, createDefaultNeeds, NEED_DEFAULT_MAX, NEED_DEFAULT_MIN, NEED_MAX, NEED_MIN } from './needsConfig'

describe('needsConfig: clampNeed', () => {
  it('욕구값은 항상 0~100 범위로 clamp된다 (0 미만 방지)', () => {
    expect(clampNeed(-50)).toBe(NEED_MIN)
    expect(clampNeed(-0.001)).toBe(NEED_MIN)
  })

  it('욕구값은 항상 0~100 범위로 clamp된다 (100 초과 방지)', () => {
    expect(clampNeed(150)).toBe(NEED_MAX)
    expect(clampNeed(100.001)).toBe(NEED_MAX)
  })

  it('범위 안의 값은 그대로 유지된다', () => {
    expect(clampNeed(0)).toBe(0)
    expect(clampNeed(50)).toBe(50)
    expect(clampNeed(100)).toBe(100)
  })

  it('NaN/Infinity 같은 비정상 값은 안전한 기본값으로 대체된다', () => {
    expect(clampNeed(NaN)).toBe(NEED_DEFAULT_MIN)
    expect(clampNeed(Infinity)).toBe(NEED_DEFAULT_MIN)
  })
})

describe('needsConfig: createDefaultNeeds', () => {
  it('캐릭터 생성 시 네 가지 욕구 기본값이 모두 존재한다', () => {
    const needs = createDefaultNeeds()
    expect(needs).toHaveProperty('hunger')
    expect(needs).toHaveProperty('energy')
    expect(needs).toHaveProperty('fun')
    expect(needs).toHaveProperty('social')
  })

  it('초기값은 너무 극단적이지 않게 65~85 범위 안에서 생성된다', () => {
    for (let i = 0; i < 50; i++) {
      const needs = createDefaultNeeds()
      for (const value of Object.values(needs)) {
        expect(value).toBeGreaterThanOrEqual(NEED_DEFAULT_MIN)
        expect(value).toBeLessThanOrEqual(NEED_DEFAULT_MAX)
      }
    }
  })

  it('injectable random으로 결정적으로 테스트할 수 있다', () => {
    const needs = createDefaultNeeds(() => 0.5)
    expect(needs).toEqual({ hunger: 75, energy: 75, fun: 75, social: 75 })
  })
})
