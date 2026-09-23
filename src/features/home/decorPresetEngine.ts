import { getColorwayOptions } from './colorways'
import type { DecorPresetDefinition, DecorPresetFurnitureEntry } from './decorPresets'
import { getFurnitureDefinition, getFurnitureSize, isValidVariant } from './furnitureCatalog'
import { FURNITURE_PATTERN_LABELS, isHexColor } from './furnitureStyle'
import { clampFurniturePlacement, isPlacementWithinBounds } from './furniturePlacementEngine'
import { ROOM_HEIGHT, ROOM_WIDTH } from './roomLayout'
import type { FurniturePlacement } from './types'

export interface DecorPresetValidation {
  ok: boolean
  reason?: string
}

/**
 * The exact same coordinate resolution `resolveDecorPresetFurniture` uses
 * for a single entry — factored out so validation checks the *real*
 * resolved position (after the shared `clampFurniturePlacement` pipeline
 * every manual placement path also goes through — see
 * `furniturePlacementEngine.ts`), not a separately-recomputed guess that
 * could quietly drift from what actually gets applied.
 */
function resolveEntryPoint(item: DecorPresetFurnitureEntry): { x: number; y: number; width: number; height: number } {
  const definition = getFurnitureDefinition(item.furnitureId)
  const size = getFurnitureSize(definition, item.variant)
  const width = size.width * item.scale
  const height = size.height * item.scale
  const rawX = item.xRatio * ROOM_WIDTH
  const rawY = item.yRatio * ROOM_HEIGHT
  return { ...clampFurniturePlacement(definition, rawX, rawY, width, height), width, height }
}

/**
 * Checks a preset's data against the *real* catalog/colorway/variant/
 * pattern tables and the *real* shared placement pipeline before anything
 * is ever applied — never trusts hand-authored preset data blindly, even
 * though every entry in `decorPresets.ts` is also checked offline by
 * `decorPresets.test.ts`. Run before any state mutation in
 * `decorPresetApply.ts`'s `applyDecorPreset` — a failure here means the
 * room is left completely untouched.
 *
 * **Never silently relocates a piece.** A preset entry whose authored
 * `xRatio`/`yRatio` would need *any* adjustment once resolved through the
 * shared placement pipeline (clamped to the room's outer bounds, or pushed
 * down to keep a solid floor piece's bottom edge on the floor — see
 * `furniturePlacementEngine.ts`) fails validation outright instead of
 * quietly landing somewhere different from what the preset's own data (and
 * therefore its preview) describes. This is a deliberate, disclosed
 * boundary: the spec's own "가구 일부를 제외하거나 자동으로 다른 위치에
 * 배치하는 대체 적용은 사용자가 변경 내용을 미리 확인하고 명시적으로
 * 승인했을 때만 허용" describes a *further*, optional escape hatch (an
 * approve-the-adjusted-result flow) that isn't built — every one of the six
 * built-in presets is authored precisely enough to need zero adjustment at
 * all (proven by `decorPresets.test.ts`), so that escape hatch is never
 * actually reachable with the shipped presets, and building a whole
 * separate confirm-the-diff UI for a scenario nothing in this app can
 * currently trigger would be speculative complexity ahead of any real need.
 */
export function validateDecorPreset(preset: DecorPresetDefinition): DecorPresetValidation {
  if (preset.furniture.length === 0) return { ok: false, reason: '프리셋에 가구가 없어요.' }

  for (const item of preset.furniture) {
    const definition = getFurnitureDefinition(item.furnitureId)
    if (!definition) return { ok: false, reason: `등록되지 않은 가구(${item.furnitureId})가 포함되어 있어요.` }

    if (!getColorwayOptions(item.furnitureId).some((option) => option.id === item.colorway)) {
      return { ok: false, reason: `${definition.name}의 색상 설정이 올바르지 않아요.` }
    }
    if (item.variant !== undefined && !isValidVariant(definition, item.variant)) {
      return { ok: false, reason: `${definition.name}의 모양 설정이 올바르지 않아요.` }
    }
    if (item.colors) {
      const validPartIds = new Set(definition.colorParts.map((part) => part.id))
      for (const [partId, hex] of Object.entries(item.colors)) {
        if (!validPartIds.has(partId) || !isHexColor(hex)) return { ok: false, reason: `${definition.name}의 부분 색상 설정이 올바르지 않아요.` }
      }
    }
    if (item.patterns) {
      const validSurfaceIds = new Set(definition.patternSurfaces.map((surface) => surface.id))
      for (const [surfaceId, pattern] of Object.entries(item.patterns)) {
        // PatternSetting['type'] is already typed to exclude 'solid' (choosing 단색 removes the entry instead), so
        // this only needs to check real membership in the pattern-type table, not re-exclude 'solid' at runtime.
        const validType = Object.hasOwn(FURNITURE_PATTERN_LABELS, pattern.type)
        if (!validSurfaceIds.has(surfaceId) || !validType || !isHexColor(pattern.baseColor) || !isHexColor(pattern.color)) {
          return { ok: false, reason: `${definition.name}의 패턴 설정이 올바르지 않아요.` }
        }
      }
    }

    // Generic room-size fit check. Every room in this app currently shares the exact same fixed ROOM_WIDTH/
    // ROOM_HEIGHT (roomLayout.ts) — there is no per-room size variation to actually trigger this today, so it's
    // structurally unreachable with the six hand-authored presets in decorPresets.ts. It's still a real, generic
    // guard (checked against the actual constants, not hardcoded per preset) rather than a fake scenario: if room
    // sizing is ever made configurable, a piece too large to ever fit is refused honestly instead of being silently
    // squashed into an invalid spot by clamping.
    const size = getFurnitureSize(definition, item.variant)
    const width = size.width * item.scale
    const height = size.height * item.scale
    if (width > ROOM_WIDTH || height > ROOM_HEIGHT) {
      return { ok: false, reason: `${definition.name}이(가) 이 방 크기에 비해 너무 커서 배치할 수 없어요.` }
    }

    const rawX = item.xRatio * ROOM_WIDTH
    const rawY = item.yRatio * ROOM_HEIGHT
    if (!isPlacementWithinBounds(definition, rawX, rawY, width, height)) {
      return { ok: false, reason: `${definition.name}의 배치 위치가 유효하지 않아요 (벽이나 바닥 경계를 벗어나요).` }
    }
  }

  return { ok: true }
}

/**
 * Resolves a preset's furniture templates into real placements sized for
 * the room's *current* logical dimensions — `xRatio`/`yRatio` (see
 * decorPresets.ts's own doc comment) are multiplied back out against
 * `ROOM_WIDTH`/`ROOM_HEIGHT` here, the one place that conversion happens.
 * Every piece is then clamped through the exact same zone/collision-aware
 * `clampFurniturePlacement` (`furniturePlacementEngine.ts`) that manual
 * drag, the properties panel's X/Y inputs, and the catalog's
 * initial-placement grid all go through — this, together with
 * `DecorPresetPreview.tsx` calling this very function instead of
 * recomputing its own position math, is what guarantees the preview and
 * the real applied result can never disagree.
 *
 * A fresh `crypto.randomUUID()` per call/per piece is what makes applying
 * the same preset twice — even in the same room, even in two different
 * rooms — never collide on placement id; nothing here mutates `preset`
 * itself, so the same immutable definition can be resolved repeatedly.
 */
export function resolveDecorPresetFurniture(preset: DecorPresetDefinition): FurniturePlacement[] {
  return preset.furniture.map((item, index) => {
    const { x, y } = resolveEntryPoint(item)

    return {
      id: crypto.randomUUID(),
      furnitureId: item.furnitureId,
      x,
      y,
      scale: item.scale,
      rotation: item.rotation,
      colorway: item.colorway,
      layer: index,
      ...(item.variant !== undefined ? { variant: item.variant } : {}),
      ...(item.colors !== undefined ? { colors: item.colors } : {}),
      ...(item.patterns !== undefined ? { patterns: item.patterns } : {}),
    }
  })
}
