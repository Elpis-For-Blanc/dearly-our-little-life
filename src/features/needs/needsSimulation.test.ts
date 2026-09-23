import { describe, expect, it } from 'vitest'
import { NEED_MAX, NEED_MIN, NEEDS_RATES } from './needsConfig'
import { applyNeedsDecayTick } from './needsSimulation'

const FULL: { hunger: number; energy: number; fun: number; social: number } = { hunger: 100, energy: 100, fun: 100, social: 100 }
const EMPTY = { hunger: 0, energy: 0, fun: 0, social: 0 }

describe('needsSimulation: applyNeedsDecayTick — 욕구 감소 tick', () => {
  it('한 tick마다 hunger는 항상 서서히 감소한다', () => {
    const next = applyNeedsDecayTick(FULL, { status: 'idle', hasRoommate: false })
    expect(next.hunger).toBeCloseTo(100 - NEEDS_RATES.hunger, 5)
    expect(next.hunger).toBeLessThan(100)
  })

  it('energy는 이동(moving) 중에 더 빠르게 감소한다', () => {
    const movingNext = applyNeedsDecayTick(FULL, { status: 'moving', hasRoommate: false })
    const idleNext = applyNeedsDecayTick(FULL, { status: 'idle', hasRoommate: false })
    expect(100 - movingNext.energy).toBeGreaterThan(100 - idleNext.energy)
  })

  it('energy는 침대/소파에서 쉬는 중(seated/lying)에는 회복된다', () => {
    const seated = applyNeedsDecayTick(EMPTY, { status: 'seated', hasRoommate: false })
    const lying = applyNeedsDecayTick(EMPTY, { status: 'lying', hasRoommate: false })
    expect(seated.energy).toBeGreaterThan(0)
    expect(lying.energy).toBeGreaterThan(0)
  })

  it('fun은 아무 활동이 없을 때(idle) 더 빠르게 감소한다', () => {
    const idleNext = applyNeedsDecayTick(FULL, { status: 'idle', hasRoommate: false })
    const movingNext = applyNeedsDecayTick(FULL, { status: 'moving', hasRoommate: false })
    expect(100 - idleNext.fun).toBeGreaterThan(100 - movingNext.fun)
  })

  it('social은 혼자 있을 때만 감소하고, 같은 방에 다른 캐릭터가 있으면 감소하지 않는다', () => {
    const alone = applyNeedsDecayTick(FULL, { status: 'idle', hasRoommate: false })
    const accompanied = applyNeedsDecayTick(FULL, { status: 'idle', hasRoommate: true })
    expect(alone.social).toBeLessThan(100)
    expect(accompanied.social).toBe(100)
  })

  it('실시간으로 몇 분 만에 바닥나지 않는다 — 5분(1200틱) 동안 idle해도 대부분의 욕구가 남아있다', () => {
    let needs = FULL
    const TICKS_IN_FIVE_MINUTES = (5 * 60_000) / 250 // MOVEMENT_TICK_MS
    for (let i = 0; i < TICKS_IN_FIVE_MINUTES; i++) {
      needs = applyNeedsDecayTick(needs, { status: 'idle', hasRoommate: false })
    }
    expect(needs.hunger).toBeGreaterThan(80)
    expect(needs.fun).toBeGreaterThan(70)
  })

  it('0 미만으로 내려가지 않는다', () => {
    let needs = { hunger: 0.001, energy: 0.001, fun: 0.001, social: 0.001 }
    for (let i = 0; i < 10; i++) needs = applyNeedsDecayTick(needs, { status: 'idle', hasRoommate: false })
    for (const value of Object.values(needs)) {
      expect(value).toBeGreaterThanOrEqual(NEED_MIN)
    }
  })

  it('100을 초과하지 않는다 (energy 회복 중에도)', () => {
    let needs = { ...FULL, energy: 99.999 }
    for (let i = 0; i < 10; i++) needs = applyNeedsDecayTick(needs, { status: 'seated', hasRoommate: false })
    expect(needs.energy).toBeLessThanOrEqual(NEED_MAX)
  })
})
