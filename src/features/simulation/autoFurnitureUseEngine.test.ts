import { describe, expect, it } from 'vitest'
import type { FurniturePlacement } from '../home/types'
import {
  AUTO_FURNITURE_USE_CHANCE_PER_TICK,
  AUTO_FURNITURE_USE_COOLDOWN_MS,
  AUTO_FURNITURE_USE_MAX_HOLD_MS,
  AUTO_FURNITURE_USE_MIN_HOLD_MS,
  AUTO_FURNITURE_USE_RETRY_COOLDOWN_MS,
} from './autoFurnitureUseConfig'
import { collectAutoFurnitureCandidates, pickAutoFurnitureCandidate, pickHoldDurationMs, rollShouldStartAutoFurnitureUse } from './autoFurnitureUseEngine'
import type { FurnitureUsageEntry } from './furnitureUsageStore'

function sofaPlacement(id: string, overrides: Partial<FurniturePlacement> = {}): FurniturePlacement {
  return { id, furnitureId: 'sofa', x: 360, y: 340, scale: 1, rotation: 0, colorway: 'rose', layer: 0, ...overrides }
}

function chairPlacement(id: string, overrides: Partial<FurniturePlacement> = {}): FurniturePlacement {
  return { id, furnitureId: 'dining-chair', x: 560, y: 340, scale: 1, rotation: 0, colorway: 'natural', layer: 0, ...overrides }
}

function bedPlacement(id: string, overrides: Partial<FurniturePlacement> = {}): FurniturePlacement {
  return { id, furnitureId: 'bed', x: 200, y: 200, scale: 1, rotation: 0, colorway: 'blush', layer: 0, ...overrides }
}

describe('autoFurnitureUseEngine (순수 함수)', () => {
  describe('rollShouldStartAutoFurnitureUse: 시작 조건 게이트', () => {
    it('설정이 꺼져 있으면 확률과 무관하게 항상 false', () => {
      expect(rollShouldStartAutoFurnitureUse({ enabled: false, now: 100_000, lastEndedAt: undefined, lastFailedAt: undefined, random: () => 0 })).toBe(false)
    })

    it('성공 쿨다운이 지나지 않았으면 false', () => {
      const now = 100_000
      expect(
        rollShouldStartAutoFurnitureUse({ enabled: true, now, lastEndedAt: now - (AUTO_FURNITURE_USE_COOLDOWN_MS - 1), lastFailedAt: undefined, random: () => 0 }),
      ).toBe(false)
    })

    it('성공 쿨다운이 정확히 지나면 다시 허용된다', () => {
      const now = 200_000
      expect(
        rollShouldStartAutoFurnitureUse({ enabled: true, now, lastEndedAt: now - AUTO_FURNITURE_USE_COOLDOWN_MS, lastFailedAt: undefined, random: () => 0 }),
      ).toBe(true)
    })

    it('실패 재시도 쿨다운이 지나지 않았으면 false (성공 쿨다운과 별도로 적용된다)', () => {
      const now = 100_000
      expect(
        rollShouldStartAutoFurnitureUse({ enabled: true, now, lastEndedAt: undefined, lastFailedAt: now - (AUTO_FURNITURE_USE_RETRY_COOLDOWN_MS - 1), random: () => 0 }),
      ).toBe(false)
    })

    it('실패 재시도 쿨다운이 지나면 다시 허용된다', () => {
      const now = 100_000
      expect(
        rollShouldStartAutoFurnitureUse({ enabled: true, now, lastEndedAt: undefined, lastFailedAt: now - AUTO_FURNITURE_USE_RETRY_COOLDOWN_MS, random: () => 0 }),
      ).toBe(true)
    })

    it('확률 롤: chancePerTick 미만이면 시작, 이상이면 시작하지 않는다', () => {
      expect(
        rollShouldStartAutoFurnitureUse({ enabled: true, now: 0, lastEndedAt: undefined, lastFailedAt: undefined, random: () => AUTO_FURNITURE_USE_CHANCE_PER_TICK - 0.0001 }),
      ).toBe(true)
      expect(
        rollShouldStartAutoFurnitureUse({ enabled: true, now: 0, lastEndedAt: undefined, lastFailedAt: undefined, random: () => AUTO_FURNITURE_USE_CHANCE_PER_TICK }),
      ).toBe(false)
    })
  })

  describe('collectAutoFurnitureCandidates: 실제 사용 가능한 슬롯만 후보로 수집', () => {
    it('빈 가구 목록이면 후보도 없다', () => {
      expect(collectAutoFurnitureCandidates([], {})).toEqual([])
    })

    it('소파(2석)·의자(1석)·침대(2석) 모두에서 kind별 후보를 모은다', () => {
      const furniture = [sofaPlacement('sofa-1'), chairPlacement('chair-1'), bedPlacement('bed-1')]
      const candidates = collectAutoFurnitureCandidates(furniture, {})
      const bySlot = new Set(candidates.map((c) => `${c.placementId}:${c.slotId}`))
      expect(bySlot).toEqual(new Set(['sofa-1:sofa-left', 'sofa-1:sofa-right', 'chair-1:seat', 'bed-1:bed-left', 'bed-1:bed-right']))
      // Bed availability is per slot: both sides are automatic-use candidates while free.
      expect(candidates.some((c) => c.slotId === 'bed-right')).toBe(true)
      expect(candidates.find((c) => c.placementId === 'sofa-1' && c.slotId === 'sofa-left')?.kind).toBe('sit')
      expect(candidates.find((c) => c.placementId === 'bed-1')?.kind).toBe('lie')
    })

    it('예약/점유된 좌석은 후보에서 제외된다', () => {
      const furniture = [sofaPlacement('sofa-1')]
      const bySeatKey: Record<string, FurnitureUsageEntry> = {
        'sofa-1:sofa-left': { characterId: 'x', placementId: 'sofa-1', roomId: 'r', slotId: 'sofa-left', status: 'seated', approachTicks: 0 },
      }
      const candidates = collectAutoFurnitureCandidates(furniture, bySeatKey)
      expect(candidates).toHaveLength(1)
      expect(candidates[0].slotId).toBe('sofa-right')
    })

    it('상호작용 슬롯이 없는(또는 알 수 없는) 가구는 조용히 건너뛴다', () => {
      const rugPlacement: FurniturePlacement = { id: 'rug-1', furnitureId: 'rug', x: 100, y: 100, scale: 1, rotation: 0, colorway: 'cream', layer: -1 }
      const unknownPlacement: FurniturePlacement = { id: 'ghost-1', furnitureId: 'nonexistent-item', x: 0, y: 0, scale: 1, rotation: 0, colorway: 'cream', layer: 0 }
      expect(collectAutoFurnitureCandidates([rugPlacement, unknownPlacement], {})).toEqual([])
    })
  })

  describe('pickAutoFurnitureCandidate: 무작위 선택 + 최근 사용 가구 반복 억제', () => {
    const A = { placementId: 'p-a', slotId: 's', kind: 'sit' as const }
    const B = { placementId: 'p-b', slotId: 's', kind: 'sit' as const }
    const C = { placementId: 'p-c', slotId: 's', kind: 'sit' as const }

    it('후보가 없으면 null', () => {
      expect(pickAutoFurnitureCandidate([], [], () => 0)).toBeNull()
    })

    it('최근 사용한 가구가 있고 다른 후보도 있으면 최근 것을 피한다', () => {
      // random=0 always selects index 0 of whatever pool survives filtering.
      const picked = pickAutoFurnitureCandidate([A, B, C], ['p-a'], () => 0)
      expect(picked?.placementId).toBe('p-b') // first non-recent candidate
    })

    it('후보가 하나뿐이고 그것이 최근 사용한 가구여도 다시 선택될 수 있다 (반복 억제가 후보를 0개로 만들지 않는다)', () => {
      const picked = pickAutoFurnitureCandidate([A], ['p-a'], () => 0)
      expect(picked?.placementId).toBe('p-a')
    })

    it('여러 후보가 모두 최근 사용 목록에 있어도(억제 적용 시 0개) 전체 풀로 폴백한다', () => {
      const picked = pickAutoFurnitureCandidate([A, B], ['p-a', 'p-b'], () => 0)
      expect(picked?.placementId).toBe('p-a')
    })

    it('random 값에 따라 실제로 다른 후보를 선택한다', () => {
      expect(pickAutoFurnitureCandidate([A, B, C], [], () => 0)?.placementId).toBe('p-a')
      expect(pickAutoFurnitureCandidate([A, B, C], [], () => 0.5)?.placementId).toBe('p-b')
      expect(pickAutoFurnitureCandidate([A, B, C], [], () => 0.99)?.placementId).toBe('p-c')
    })

    /**
     * "자동 가구 사용에 욕구 bonus가 들어가도 기존 behavior regression 없음":
     * `weightFor` is a purely additive, opt-in 4th parameter. Every existing
     * test above omits it and is provably unaffected — this block covers the
     * new weighted path itself in isolation, kept in `autoFurnitureUseEngine`
     * (not `needs/`) since it's testing the generic weighting mechanism, not
     * the needs system's own weight values (see `needsFurnitureBonus.test.ts`
     * for that).
     */
    describe('pickAutoFurnitureCandidate: weightFor (needs bonus의 기반 메커니즘)', () => {
      it('weightFor를 생략하면 기존과 완전히 동일한 균등 선택 결과를 낸다', () => {
        expect(pickAutoFurnitureCandidate([A, B, C], [], () => 0.5)?.placementId).toBe(pickAutoFurnitureCandidate([A, B, C], [], () => 0.5, undefined)?.placementId)
      })

      it('가중치가 균등하면(모두 1) weightFor를 줘도 결과가 동일하다', () => {
        const uniform = pickAutoFurnitureCandidate([A, B, C], [], () => 0.5)
        const weighted = pickAutoFurnitureCandidate([A, B, C], [], () => 0.5, () => 1)
        expect(weighted?.placementId).toBe(uniform?.placementId)
      })

      it('가중치가 높은 후보가 더 넓은 확률 구간을 차지한다 (강제/결정적이지 않고 여전히 확률적)', () => {
        // B has 3x the weight of A/C — total weight 5, B's slice is [1,4) out of [0,5)
        const weightFor = (c: { placementId: string }) => (c.placementId === 'p-b' ? 3 : 1)
        expect(pickAutoFurnitureCandidate([A, B, C], [], () => 0, weightFor)?.placementId).toBe('p-a')
        expect(pickAutoFurnitureCandidate([A, B, C], [], () => 2 / 5, weightFor)?.placementId).toBe('p-b')
        expect(pickAutoFurnitureCandidate([A, B, C], [], () => 4.5 / 5, weightFor)?.placementId).toBe('p-c')
      })

      it('가중치가 0 이하여도 항상 어떤 후보든 선택될 수 있다 (완전히 배제되지 않는다)', () => {
        const weightFor = (c: { placementId: string }) => (c.placementId === 'p-a' ? 0 : 1)
        const picked = pickAutoFurnitureCandidate([A, B, C], [], () => 0, weightFor)
        expect(picked).not.toBeNull()
      })
    })
  })

  describe('pickHoldDurationMs: 사용 지속 시간 범위', () => {
    it('random=0이면 최솟값', () => {
      expect(pickHoldDurationMs(() => 0)).toBe(AUTO_FURNITURE_USE_MIN_HOLD_MS)
    })

    it('random이 1에 가까우면 최댓값에 가깝다', () => {
      const value = pickHoldDurationMs(() => 0.999999)
      expect(value).toBeGreaterThan(AUTO_FURNITURE_USE_MIN_HOLD_MS)
      expect(value).toBeLessThanOrEqual(AUTO_FURNITURE_USE_MAX_HOLD_MS)
    })

    it('항상 [MIN, MAX] 범위 안에 있다', () => {
      for (const r of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
        const value = pickHoldDurationMs(() => r)
        expect(value).toBeGreaterThanOrEqual(AUTO_FURNITURE_USE_MIN_HOLD_MS)
        expect(value).toBeLessThanOrEqual(AUTO_FURNITURE_USE_MAX_HOLD_MS)
      }
    })
  })
})
