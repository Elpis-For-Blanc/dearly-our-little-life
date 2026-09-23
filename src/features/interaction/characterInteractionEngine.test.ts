import { describe, expect, it } from 'vitest'
import { createDefaultNeeds } from '../needs/needsConfig'
import type { CharacterNeeds } from '../needs/needsTypes'
import { CHARACTER_RADIUS } from '../simulation/movementConfig'
import { FREEFORM_INTERACTION_DISTANCE } from './characterInteractionConfig'
import {
  buildInteractionTypeCandidates,
  findSitTogetherPlacement,
  hasCriticalBasicNeed,
  pickInteractionType,
  pointTowardTarget,
  resolveFacing,
  rollShouldStartCharacterInteraction,
  shouldRecomputeApproachTarget,
} from './characterInteractionEngine'

function needs(overrides: Partial<CharacterNeeds> = {}): CharacterNeeds {
  return { ...createDefaultNeeds(() => 0.5), ...overrides }
}

describe('characterInteractionEngine (pure functions)', () => {
  describe('rollShouldStartCharacterInteraction', () => {
    it('설정이 꺼져 있으면 확률이 항상 성공해도 시작하지 않는다', () => {
      expect(rollShouldStartCharacterInteraction({ enabled: false, now: 100_000, lastEndedAt: undefined, lastFailedAt: undefined, random: () => 0 })).toBe(false)
    })

    it('설정이 켜져 있고 쿨다운이 없으면 확률에 따라 시작한다', () => {
      expect(rollShouldStartCharacterInteraction({ enabled: true, now: 100_000, lastEndedAt: undefined, lastFailedAt: undefined, random: () => 0 })).toBe(true)
      expect(rollShouldStartCharacterInteraction({ enabled: true, now: 100_000, lastEndedAt: undefined, lastFailedAt: undefined, random: () => 0.999 })).toBe(false)
    })

    it('성공 쿨다운이 끝나지 않았으면 확률과 무관하게 거부한다', () => {
      expect(rollShouldStartCharacterInteraction({ enabled: true, now: 100_000, lastEndedAt: 99_000, lastFailedAt: undefined, random: () => 0 })).toBe(false)
    })

    it('실패 재시도 쿨다운이 끝나지 않았으면 확률과 무관하게 거부한다', () => {
      expect(rollShouldStartCharacterInteraction({ enabled: true, now: 100_000, lastEndedAt: undefined, lastFailedAt: 99_000, random: () => 0 })).toBe(false)
    })
  })

  describe('hasCriticalBasicNeed', () => {
    it('배고픔 또는 기력이 임계값 이하면 true', () => {
      expect(hasCriticalBasicNeed(needs({ hunger: 20 }))).toBe(true)
      expect(hasCriticalBasicNeed(needs({ energy: 10 }))).toBe(true)
    })

    it('둘 다 임계값보다 높으면 false', () => {
      expect(hasCriticalBasicNeed(needs({ hunger: 70, energy: 70 }))).toBe(false)
    })
  })

  describe('buildInteractionTypeCandidates / pickInteractionType', () => {
    it('교류가 둘 다 낮으면 후보 가중치가 전반적으로 높아진다(더 자주 뽑히는 방향)', () => {
      const highSocial = buildInteractionTypeCandidates(needs({ social: 80 }), 'happy', needs({ social: 80 }), 'happy', true)
      const lowSocial = buildInteractionTypeCandidates(needs({ social: 10 }), 'lonely', needs({ social: 10 }), 'lonely', true)
      for (const type of ['stayTogether', 'sitTogether', 'hug', 'holdHands'] as const) {
        const highWeight = highSocial.find((c) => c.type === type)!.weight
        const lowWeight = lowSocial.find((c) => c.type === type)!.weight
        expect(lowWeight).toBeGreaterThan(highWeight)
      }
    })

    it('sitTogetherAvailable이 false면 sitTogether는 후보에서 아예 빠진다', () => {
      const candidates = buildInteractionTypeCandidates(needs(), 'neutral', needs(), 'neutral', false)
      expect(candidates.some((c) => c.type === 'sitTogether')).toBe(false)
      expect(candidates.map((c) => c.type).sort()).toEqual(['holdHands', 'hug', 'stayTogether'])
    })

    it('외로움은 stayTogether 가중치만 올리고 다른 타입은 그대로 둔다 — 기분이 행동을 완전히 강제하지 않는다', () => {
      const neutral = buildInteractionTypeCandidates(needs(), 'neutral', needs(), 'neutral', true)
      const lonely = buildInteractionTypeCandidates(needs(), 'lonely', needs(), 'neutral', true)
      expect(lonely.find((c) => c.type === 'stayTogether')!.weight).toBeGreaterThan(neutral.find((c) => c.type === 'stayTogether')!.weight)
      expect(lonely.find((c) => c.type === 'hug')!.weight).toBeCloseTo(neutral.find((c) => c.type === 'hug')!.weight)
      // Never fully forced: hug/holdHands/sitTogether remain genuinely pickable even while lonely.
      expect(pickInteractionType(lonely, () => 0.999)).not.toBeNull()
    })

    it('pickInteractionType은 빈 후보에 대해 null을 반환한다', () => {
      expect(pickInteractionType([], () => 0)).toBeNull()
    })

    it('pickInteractionType은 가중치에 비례해 실제로 확률적으로 뽑는다(결정론적으로 항상 최댓값만 뽑지 않는다)', () => {
      const candidates = [
        { type: 'stayTogether' as const, weight: 1 },
        { type: 'hug' as const, weight: 1 },
      ]
      expect(pickInteractionType(candidates, () => 0)).toBe('stayTogether')
      expect(pickInteractionType(candidates, () => 0.99)).toBe('hug')
    })
  })

  describe('findSitTogetherPlacement', () => {
    it('실제 2인용 슬롯(sofa-left/right)이 모두 비어 있으면 그 자리를 반환한다', () => {
      const furniture = [{ id: 'sofa-1', furnitureId: 'sofa', x: 360, y: 340, scale: 1, rotation: 0 as const, colorway: 'rose', layer: 0 }]
      const pair = findSitTogetherPlacement(furniture, {})
      expect(pair).toEqual({ placementId: 'sofa-1', slotAId: 'sofa-left', slotBId: 'sofa-right' })
    })

    it('한쪽 좌석이 이미 점유되어 있으면 그 소파는 후보에서 제외된다', () => {
      const furniture = [{ id: 'sofa-1', furnitureId: 'sofa', x: 360, y: 340, scale: 1, rotation: 0 as const, colorway: 'rose', layer: 0 }]
      const pair = findSitTogetherPlacement(furniture, { 'sofa-1:sofa-left': { characterId: 'x' } })
      expect(pair).toBeNull()
    })

    it('의자처럼 좌석이 1개뿐인 가구는 절대 후보가 되지 않는다', () => {
      const furniture = [{ id: 'chair-1', furnitureId: 'dining-chair', x: 200, y: 200, scale: 1, rotation: 0 as const, colorway: 'natural', layer: 0 }]
      expect(findSitTogetherPlacement(furniture, {})).toBeNull()
    })

    it('가구가 없으면 null', () => {
      expect(findSitTogetherPlacement([], {})).toBeNull()
    })
  })

  describe('FREEFORM_INTERACTION_DISTANCE — 타입별 거리가 실제로 서로 다르고, hug가 가장 가깝다', () => {
    it('hug의 finalDistance가 holdHands/stayTogether보다 뚜렷하게 가깝다', () => {
      expect(FREEFORM_INTERACTION_DISTANCE.hug.finalDistance).toBeLessThan(FREEFORM_INTERACTION_DISTANCE.holdHands.finalDistance)
      expect(FREEFORM_INTERACTION_DISTANCE.hug.finalDistance).toBeLessThan(FREEFORM_INTERACTION_DISTANCE.stayTogether.finalDistance)
    })

    it('hug는 일반적인 캐릭터-캐릭터 충돌 최소 간격(반지름의 2배)보다 가깝다 — 파트너 충돌 예외 없이는 도달 불가능한 거리다', () => {
      expect(FREEFORM_INTERACTION_DISTANCE.hug.finalDistance).toBeLessThan(CHARACTER_RADIUS * 2)
    })

    it('holdHands는 충돌 최소 간격보다 멀다 — 파트너 충돌 예외가 없어도 원래 도달 가능한 거리다', () => {
      expect(FREEFORM_INTERACTION_DISTANCE.holdHands.finalDistance).toBeGreaterThan(CHARACTER_RADIUS * 2)
    })

    it('각 타입의 approachDistance는 finalDistance를 넘지 않는다 — 도착 즉시 근접 판정을 만족해야 한다', () => {
      for (const config of Object.values(FREEFORM_INTERACTION_DISTANCE)) {
        expect(config.approachDistance).toBeLessThanOrEqual(config.finalDistance)
      }
    })

    it('hug/holdHands는 서로 마주보게 설정되어 있고, stayTogether는 방향을 맞추지 않는다', () => {
      expect(FREEFORM_INTERACTION_DISTANCE.hug.facingMode).toBe('faceEachOther')
      expect(FREEFORM_INTERACTION_DISTANCE.holdHands.facingMode).toBe('faceEachOther')
      expect(FREEFORM_INTERACTION_DISTANCE.stayTogether.facingMode).toBe('none')
    })
  })

  describe('pointTowardTarget', () => {
    it('target으로부터 distance만큼 떨어진, from 방향을 향한 지점을 반환한다', () => {
      const point = pointTowardTarget({ x: 200, y: 0 }, { x: 0, y: 0 }, 40)
      expect(point.x).toBeCloseTo(40)
      expect(point.y).toBeCloseTo(0)
    })

    it('from과 target이 완전히 같은 지점이어도 나누기 오류 없이 안전한 값을 반환한다', () => {
      const point = pointTowardTarget({ x: 50, y: 50 }, { x: 50, y: 50 }, 40)
      expect(Number.isFinite(point.x)).toBe(true)
      expect(Number.isFinite(point.y)).toBe(true)
    })
  })

  describe('shouldRecomputeApproachTarget', () => {
    it('목적지가 아직 없으면 항상 재계산한다', () => {
      expect(shouldRecomputeApproachTarget(null, null, { x: 0, y: 0 }, 4)).toBe(true)
    })

    it('상대가 허용 오차 이내로만 움직였다면 재계산하지 않는다 — 떨림 방지', () => {
      const dest = { x: 10, y: 10 }
      const lastTarget = { x: 100, y: 100 }
      expect(shouldRecomputeApproachTarget(dest, lastTarget, { x: 101, y: 100 }, 4)).toBe(false)
    })

    it('상대가 허용 오차를 넘게 움직였다면 재계산한다', () => {
      const dest = { x: 10, y: 10 }
      const lastTarget = { x: 100, y: 100 }
      expect(shouldRecomputeApproachTarget(dest, lastTarget, { x: 150, y: 100 }, 4)).toBe(true)
    })
  })

  describe('resolveFacing', () => {
    it('x가 더 작은 쪽이 right(상대 방향), 더 큰 쪽이 left를 향한다', () => {
      expect(resolveFacing({ x: 100, y: 0 }, { x: 200, y: 0 })).toEqual({ characterAId: 'right', characterBId: 'left' })
      expect(resolveFacing({ x: 200, y: 0 }, { x: 100, y: 0 })).toEqual({ characterAId: 'left', characterBId: 'right' })
    })

    it('x가 완전히 같으면 null — 의미 있는 좌우가 없다', () => {
      expect(resolveFacing({ x: 100, y: 0 }, { x: 100, y: 50 })).toBeNull()
    })
  })
})
