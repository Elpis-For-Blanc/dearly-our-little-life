import { CHARACTER_RADIUS } from '../simulation/movementConfig'
import { circleIntersectsRect, furnitureObstacles, pickRandomDestination } from '../simulation/movementEngine'
import { useCharacterMovementStore } from '../simulation/characterMovementStore'
import { evictPlacementUsage } from '../simulation/furnitureUsageTrigger'
import type { DecorPresetDefinition } from './decorPresets'
import { resolveDecorPresetFurniture, validateDecorPreset } from './decorPresetEngine'
import { getActiveDecorateRoom, useHomeStore } from './homeStore'
import { useRoomDecorBackupStore } from './roomDecorBackupStore'
import { normalizeFloor, normalizeWallpaper } from './roomSurface'
import type { FurniturePlacement } from './types'

export type ApplyDecorPresetOutcome = { ok: true } | { ok: false; reason: string }

/**
 * Ends every in-progress furniture interaction on every placement a room
 * currently has — manual (착석/눕기/머무르기, or still walking over) and
 * automatic alike, since `furnitureUsageStore` (the one reservation ledger
 * both share) never distinguished who started a session. Reuses
 * `evictPlacementUsage`, the exact function every existing furniture
 * delete/move/rotate call site already uses (`FurnitureItem.tsx`,
 * `FurniturePropertiesPanel.tsx`, `DecorateScreen.tsx`) — never a duplicate
 * cleanup path. An auto-furniture-use session on one of these placements
 * needs no separate handling here either: `autoFurnitureUseTrigger.ts`'s
 * `reconcile()` already detects — on its own, the very next movement tick —
 * that the seat it was tracking no longer matches `furnitureUsageStore`,
 * and forgets its own bookkeeping accordingly. This is the same
 * `stillActive`-guard pattern `runConversation`'s own `finally` block uses,
 * and it's what prevents a late-resolving auto-approach from ever trying to
 * seat a character on furniture a preset has since replaced.
 */
function evictAllUsage(furniture: FurniturePlacement[]): void {
  for (const placement of furniture) evictPlacementUsage(placement.id)
}

/**
 * After new furniture lands, any character currently standing in this room
 * whose position now overlaps a *new* solid piece is moved to a free point
 * via the same retry-based safe-destination search every other "find
 * somewhere to stand" case in this app already uses
 * (`movementEngine.ts`'s `pickRandomDestination`, which never throws — it
 * falls back to the floor's center if every retry is blocked). Never
 * deletes or relocates a character to a different room, per the spec's
 * explicit "캐릭터를 삭제하거나 다른 방으로 강제 이동시키지 마".
 */
function repositionCollidingCharacters(roomId: string, furniture: FurniturePlacement[]): void {
  const obstacles = furnitureObstacles(furniture)
  const movement = useCharacterMovementStore.getState()
  const inRoom = Object.values(movement.byId).filter((c) => c.roomId === roomId)

  for (const character of inRoom) {
    const colliding = obstacles.some((rect) => circleIntersectsRect(character.x, character.y, CHARACTER_RADIUS, rect))
    if (!colliding) continue
    const others = inRoom.filter((c) => c.id !== character.id).map((c) => ({ x: c.x, y: c.y }))
    const safePoint = pickRandomDestination(obstacles, others, CHARACTER_RADIUS)
    useCharacterMovementStore.getState().setPosition(character.id, safePoint)
  }
}

/**
 * Applies a decor preset to the currently active decorate room — the same
 * room every other decorate-phase mutator (`setWallpaper`, `addFurniture`,
 * …) implicitly targets via `activeDecorateRoomId`, so "다른 방의 가구와
 * 설정을 변경하지 않는다" holds for free, the same way it already does for
 * every existing mutator.
 *
 * Order matters and is what makes this safe: validate → back up → end
 * furniture usage → resolve the new furniture → **one** atomic commit
 * (`homeStore.applyRoomDecor`) → reposition any now-colliding character.
 * Nothing before the commit step touches persisted state at all, so a
 * validation failure or a thrown exception anywhere before it leaves the
 * room completely untouched — there is no partial-apply state to roll back
 * from, because nothing partial can ever be written.
 */
export function applyDecorPreset(preset: DecorPresetDefinition): ApplyDecorPresetOutcome {
  const validation = validateDecorPreset(preset)
  if (!validation.ok) return { ok: false, reason: validation.reason! }

  const room = getActiveDecorateRoom(useHomeStore.getState())

  let resolvedFurniture: FurniturePlacement[]
  try {
    resolvedFurniture = resolveDecorPresetFurniture(preset)
  } catch {
    return { ok: false, reason: '프리셋을 적용하는 중 문제가 발생했어요.' }
  }

  useRoomDecorBackupStore.getState().save(room.id, {
    wallpaper: room.wallpaper,
    floor: room.floor,
    furniture: room.furniture,
    savedAt: Date.now(),
  })

  evictAllUsage(room.furniture)

  useHomeStore.getState().applyRoomDecor({
    wallpaper: normalizeWallpaper(preset.wallpaper),
    floor: normalizeFloor(preset.floor),
    furniture: resolvedFurniture,
  })

  repositionCollidingCharacters(room.id, resolvedFurniture)

  return { ok: true }
}

/** Whether the active decorate room currently has a backup to revert to. */
export function hasActiveDecorPresetBackup(): boolean {
  const room = getActiveDecorateRoom(useHomeStore.getState())
  return room.id in useRoomDecorBackupStore.getState().byRoomId
}

/**
 * Restores the active decorate room's wallpaper/floor/furniture to exactly
 * what they were right before the most recent `applyDecorPreset` call on
 * *this* room — including each restored placement's *original* id (never
 * re-minted), since these are the very ids that were freed the moment the
 * preset replaced them and nothing else could have taken them in the
 * meantime. Symmetric with `applyDecorPreset`, and resolves "which room" the
 * same implicit way every other decorate-phase mutator does (via
 * `activeDecorateRoomId`) rather than taking an explicit room id: ends
 * furniture usage on the preset's furniture first, commits atomically, then
 * repositions any character the restored layout now collides with.
 * Consumes the backup — a second revert attempt (with nothing left to
 * restore) is refused rather than silently reapplying the same backup
 * twice.
 */
export function revertLastDecorPreset(): ApplyDecorPresetOutcome {
  const room = getActiveDecorateRoom(useHomeStore.getState())
  const backup = useRoomDecorBackupStore.getState().byRoomId[room.id]
  if (!backup) return { ok: false, reason: '되돌릴 이전 상태가 없어요.' }

  evictAllUsage(room.furniture)

  useHomeStore.getState().applyRoomDecor({
    wallpaper: backup.wallpaper,
    floor: backup.floor,
    furniture: backup.furniture,
  })

  repositionCollidingCharacters(room.id, backup.furniture)
  useRoomDecorBackupStore.getState().clear(room.id)

  return { ok: true }
}
