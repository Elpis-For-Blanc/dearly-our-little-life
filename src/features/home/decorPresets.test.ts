import { describe, expect, it } from 'vitest'
import { getColorwayOptions } from './colorways'
import { DECOR_PRESETS } from './decorPresets'
import { resolveDecorPresetFurniture, validateDecorPreset } from './decorPresetEngine'
import { getFurnitureDefinition, getFurnitureSize, isValidVariant } from './furnitureCatalog'
import { clampFurniturePlacement, FLOOR_SURFACE_TOP_Y } from './furniturePlacementEngine'
import { ROOM_HEIGHT, ROOM_WIDTH } from './roomLayout'
import { createDefaultDoorway } from './roomTypes'
import { getSitSlots, getStandSlots, getUsableLieSlots, isWalkDestinationBlocked, resolveWalkDestination } from '../simulation/furnitureInteractionEngine'
import { CHARACTER_RADIUS } from '../simulation/movementConfig'
import { furnitureObstacles, type Rect } from '../simulation/movementEngine'
import type { FurniturePlacement } from './types'

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY
}

const DOORWAY_POINT = createDefaultDoorway('test-room').entryPosition

describe('decorPresets: 데이터 유효성', () => {
  it('6종 프리셋이 정의되어 있고, id가 서로 중복되지 않는다', () => {
    expect(DECOR_PRESETS).toHaveLength(6)
    const ids = DECOR_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('모든 프리셋이 validateDecorPreset을 통과한다 (실제 카탈로그 기준)', () => {
    for (const preset of DECOR_PRESETS) {
      expect(validateDecorPreset(preset)).toEqual({ ok: true })
    }
  })

  it('모든 프리셋의 가구는 실제 카탈로그에 존재하는 id만 사용한다', () => {
    for (const preset of DECOR_PRESETS) {
      for (const item of preset.furniture) {
        expect(getFurnitureDefinition(item.furnitureId), `${preset.id}: ${item.furnitureId}`).toBeDefined()
      }
    }
  })

  it('모든 프리셋의 색상(colorway)은 해당 가구가 실제로 지원하는 옵션이다', () => {
    for (const preset of DECOR_PRESETS) {
      for (const item of preset.furniture) {
        const options = getColorwayOptions(item.furnitureId).map((o) => o.id)
        expect(options, `${preset.id}: ${item.furnitureId}`).toContain(item.colorway)
      }
    }
  })

  it('패턴을 지정한 항목은 모두 해당 가구가 실제로 가진 패턴 표면(patternSurfaces)이다', () => {
    for (const preset of DECOR_PRESETS) {
      for (const item of preset.furniture) {
        if (!item.patterns) continue
        const definition = getFurnitureDefinition(item.furnitureId)!
        const validSurfaceIds = new Set(definition.patternSurfaces.map((s) => s.id))
        for (const surfaceId of Object.keys(item.patterns)) {
          expect(validSurfaceIds.has(surfaceId), `${preset.id}: ${item.furnitureId}/${surfaceId}`).toBe(true)
        }
      }
    }
  })

  it('variant를 지정한 항목은 모두 해당 가구의 실제 모양이다', () => {
    for (const preset of DECOR_PRESETS) {
      for (const item of preset.furniture) {
        if (item.variant === undefined) continue
        const definition = getFurnitureDefinition(item.furnitureId)
        expect(isValidVariant(definition, item.variant), `${preset.id}: ${item.furnitureId}`).toBe(true)
      }
    }
  })

  it('6종 모두 서로 다른 가구 조합을 가진다 (단순 색상 변경이 아니다)', () => {
    const combos = DECOR_PRESETS.map((preset) => [...new Set(preset.furniture.map((f) => f.furnitureId))].sort().join(','))
    expect(new Set(combos).size).toBe(combos.length)
  })

  it('각 프리셋은 카테고리 필터 목록(공주/빈티지/심플/판타지/생활감) 중 하나에 속한다', () => {
    const categories = new Set(DECOR_PRESETS.map((p) => p.category))
    for (const category of ['princess', 'vintage', 'simple', 'fantasy', 'lifestyle']) {
      expect(categories.has(category as never)).toBe(true)
    }
  })
})

describe('decorPresets: 배치 기하학 (실제 방 크기·충돌 규칙 기준)', () => {
  for (const preset of DECOR_PRESETS) {
    describe(preset.name, () => {
      const resolved = resolveDecorPresetFurniture(preset)

      it('모든 가구가 방 범위 안에 있다 (clampFurniturePlacement이 좌표를 바꾸지 않는다)', () => {
        for (const [index, placement] of resolved.entries()) {
          const definition = getFurnitureDefinition(placement.furnitureId)
          const size = getFurnitureSize(definition, placement.variant)
          const clamped = clampFurniturePlacement(definition, placement.x, placement.y, size.width * placement.scale, size.height * placement.scale)
          expect(clamped.x, `entry ${index} (${placement.furnitureId}) x`).toBeCloseTo(placement.x, 5)
          expect(clamped.y, `entry ${index} (${placement.furnitureId}) y`).toBeCloseTo(placement.y, 5)
        }
      })

      it('바닥에 서는 solid 가구는 바닥 표면 위에 정확히 놓인다 (벽에 떠 보이지 않는다)', () => {
        for (const placement of resolved) {
          const definition = getFurnitureDefinition(placement.furnitureId)
          if (!definition || definition.zone !== 'floor' || definition.collision.mode !== 'solid') continue
          const size = getFurnitureSize(definition, placement.variant)
          const bottom = placement.y + (size.height * placement.scale) / 2
          expect(bottom, `${placement.furnitureId}'s bottom edge`).toBeGreaterThanOrEqual(FLOOR_SURFACE_TOP_Y - 0.01)
        }
      })

      it('모든 가구 좌표가 유한수이고 방 경계(0~ROOM_WIDTH/HEIGHT) 안에 있다', () => {
        for (const placement of resolved) {
          expect(Number.isFinite(placement.x)).toBe(true)
          expect(Number.isFinite(placement.y)).toBe(true)
          expect(placement.x).toBeGreaterThanOrEqual(0)
          expect(placement.x).toBeLessThanOrEqual(ROOM_WIDTH)
          expect(placement.y).toBeGreaterThanOrEqual(0)
          expect(placement.y).toBeLessThanOrEqual(ROOM_HEIGHT)
        }
      })

      it('충돌하는(solid) 가구끼리 서로 겹치지 않는다', () => {
        const obstacles = furnitureObstacles(resolved)
        for (let i = 0; i < obstacles.length; i++) {
          for (let j = i + 1; j < obstacles.length; j++) {
            expect(rectsOverlap(obstacles[i], obstacles[j]), `obstacle ${i} vs ${j}`).toBe(false)
          }
        }
      })

      it('방의 출입구 지점이 가구에 막히지 않는다', () => {
        const obstacles = furnitureObstacles(resolved)
        const blocked = obstacles.some((rect) => {
          const closestX = Math.min(Math.max(DOORWAY_POINT.x, rect.minX), rect.maxX)
          const closestY = Math.min(Math.max(DOORWAY_POINT.y, rect.minY), rect.maxY)
          const dx = DOORWAY_POINT.x - closestX
          const dy = DOORWAY_POINT.y - closestY
          return dx * dx + dy * dy < CHARACTER_RADIUS * CHARACTER_RADIUS
        })
        expect(blocked).toBe(false)
      })

      it('상호작용 가구(소파/침대/테이블/의자)의 접근·머무름 지점이 실제로 도달 가능하다', () => {
        for (const placement of resolved) {
          const definition = getFurnitureDefinition(placement.furnitureId)
          if (!definition) continue
          const otherPlacements = resolved.filter((p) => p !== placement)
          const obstaclesExcludingSelf = furnitureObstacles(otherPlacements)

          const allSlots = [...getSitSlots(definition), ...getUsableLieSlots(definition), ...getStandSlots(definition)]
          for (const slot of allSlots) {
            const destination = resolveWalkDestination(placement, definition, slot)
            expect(
              isWalkDestinationBlocked(destination, obstaclesExcludingSelf, []),
              `${preset.id}: ${placement.furnitureId}/${slot.id} approach point blocked`,
            ).toBe(false)
          }
        }
      })
    })
  }
})

describe('decorPresets: 불변성과 반복 적용', () => {
  it('resolveDecorPresetFurniture는 원본 preset 객체를 수정하지 않는다', () => {
    const preset = DECOR_PRESETS[0]
    const before = JSON.parse(JSON.stringify(preset))
    resolveDecorPresetFurniture(preset)
    resolveDecorPresetFurniture(preset)
    expect(JSON.parse(JSON.stringify(preset))).toEqual(before)
  })

  it('같은 프리셋을 여러 번 적용해도 가구 id가 절대 중복되지 않는다', () => {
    const preset = DECOR_PRESETS[0]
    const first = resolveDecorPresetFurniture(preset)
    const second = resolveDecorPresetFurniture(preset)
    const allIds = [...first, ...second].map((p) => p.id)
    expect(new Set(allIds).size).toBe(allIds.length)
  })

  it('모든 프리셋을 반복 적용해도 매번 유효한 FurniturePlacement 형태를 만든다', () => {
    for (const preset of DECOR_PRESETS) {
      const resolved: FurniturePlacement[] = resolveDecorPresetFurniture(preset)
      expect(resolved.length).toBe(preset.furniture.length)
      for (const placement of resolved) {
        expect(typeof placement.id).toBe('string')
        expect(placement.id.length).toBeGreaterThan(0)
        expect(placement.rotation === 0 || placement.rotation === 180).toBe(true)
      }
    }
  })
})
