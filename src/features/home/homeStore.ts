import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getDefaultColorway } from './colorways'
import { getFurnitureDefinition, isValidVariant } from './furnitureCatalog'
import { normalizePartColors, normalizePatterns } from './furnitureStyle'
import { ROOM_HEIGHT, ROOM_WIDTH } from './roomLayout'
import { createDefaultDoorway, MAX_ROOMS, ROOM_KIND_LABELS, ROOM_KIND_ORDER, type Doorway, type Room, type RoomKind } from './roomTypes'
import { getRoomTheme } from './roomThemes'
import {
  DEFAULT_FLOOR,
  DEFAULT_WALLPAPER,
  normalizeFloor,
  normalizeWallpaper,
  type FloorSettings,
  type WallpaperSettings,
} from './roomSurface'
import type { FurniturePlacement } from './types'

/**
 * Bumped whenever the persisted shape changes in a way `migrate` needs to
 * handle. 1 = window/rug became furniture instead of booleans. 2 =
 * wallpaper/floor became independent settings instead of a fixed
 * `backgroundId` theme preset. 3 = the single flat room became a `rooms`
 * array (multi-room support) — the old flat `furniture`/`wallpaper`/`floor`
 * become the first room ("거실"). 4 = placements gained optional per-part
 * `colors` and surface `patterns` (furnitureStyle.ts) — additive, so the v4
 * step only re-validates them. 5 = placements gained an optional `variant`
 * (the rug's shape) and the rug/window gained parts and patterns — likewise
 * additive. All data saved before this field existed
 * is implicitly version 0 (zustand's own default).
 */
const SCHEMA_VERSION = 5

export type RoomPreset = 'default' | 'empty'

interface HomeState {
  rooms: Room[]
  /** Which room `Room.tsx`/the decorate-phase panels currently edit. Independent of `activeLiveRoomId` on purpose — decorating one room while a different one is "currently observed" in Live is a normal thing to want. */
  activeDecorateRoomId: string
  /** Which room `LiveRoomView.tsx` currently renders. */
  activeLiveRoomId: string
  /** UI-only — not persisted. Meaningful only for whichever room is `activeDecorateRoomId`; cleared on room switch/deletion so it can never point at a placement in a different room. */
  selectedFurnitureId: string | null
  addRoom: (kind: RoomKind, name: string, preset: RoomPreset) => string
  renameRoom: (id: string, name: string) => void
  /** Refuses (no-op) if `id` is the last remaining room — callers must check `rooms.length > 1` before offering deletion at all. */
  removeRoom: (id: string) => void
  setActiveDecorateRoom: (id: string) => void
  setActiveLiveRoom: (id: string) => void
  addFurniture: (placement: FurniturePlacement) => void
  moveFurniture: (id: string, x: number, y: number) => void
  /** `colors`/`patterns` in a patch replace the whole map; pass `undefined` to clear it back to the preset look. `variant` picks one of the piece's shapes. */
  updateFurniture: (id: string, patch: Partial<Pick<FurniturePlacement, 'scale' | 'rotation' | 'colorway' | 'variant' | 'colors' | 'patterns'>>) => void
  removeFurniture: (id: string) => void
  selectFurniture: (id: string | null) => void
  bringToFront: (id: string) => void
  sendToBack: (id: string) => void
  resetLayout: () => void
  setWallpaper: (patch: Partial<WallpaperSettings>) => void
  setFloor: (patch: Partial<FloorSettings>) => void
  /**
   * Replaces the active decorate room's wallpaper, floor, and *entire*
   * furniture list in one atomic call — the one mutation
   * `decorPresetApply.ts`'s `applyDecorPreset`/`revertLastDecorPreset` ever
   * make. Deliberately one `set()`, not a sequence of `setWallpaper`/
   * `setFloor`/per-piece `addFurniture` calls: since zustand's `set` is
   * synchronous, this is what guarantees a room decor preset (or its
   * revert) is never observed half-applied — either every field lands
   * together, or (if something throws before this is ever called) nothing
   * changes at all.
   */
  applyRoomDecor: (patch: { wallpaper: WallpaperSettings; floor: FloorSettings; furniture: FurniturePlacement[] }) => void
  /**
   * Replaces the *entire* `rooms` array plus both active-room ids in one
   * atomic call — the one mutation the manual save/load feature
   * (`features/save/saveRestore.ts`) ever makes. Reuses the exact same
   * defensive `usableRooms`/`normalizeRoom` pipeline the persist `merge`
   * hook already runs on every page load, so a save blob with a damaged
   * room/placement is handled exactly as gracefully as corrupted
   * `localStorage` already is — a bad entry is dropped, never a crash, and
   * an active-room id that doesn't survive normalization falls back to the
   * first room, same as `merge`'s own fallback. Never bumps
   * `SCHEMA_VERSION` — this is a new way to *construct* the same `rooms`
   * shape, not a shape change.
   */
  restoreHomeState: (rooms: Room[], activeDecorateRoomId: string, activeLiveRoomId: string) => void
}

export function getActiveDecorateRoom(state: HomeState): Room {
  return state.rooms.find((r) => r.id === state.activeDecorateRoomId) ?? state.rooms[0]
}

export function getActiveLiveRoom(state: HomeState): Room {
  return state.rooms.find((r) => r.id === state.activeLiveRoomId) ?? state.rooms[0]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/**
 * Keeps the usable entries of a saved list and skips the rest: anything that
 * isn't an object, lacks a string id (or `requiredString` field), or repeats an
 * id already seen (first one wins). A damaged entry is dropped on its own — it
 * must never take the healthy entries of the same list down with it — and a
 * value that isn't a list at all is an empty list.
 */
function usableEntries<T>(raw: unknown, requiredStrings: string[]): T[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const result: T[] = []
  for (const entry of raw) {
    if (!isRecord(entry)) continue
    if (!requiredStrings.every((key) => typeof entry[key] === 'string' && (entry[key] as string) !== '')) continue
    const id = entry.id as string
    if (seen.has(id)) continue
    seen.add(id)
    result.push(entry as T)
  }
  return result
}

const usablePlacements = (raw: unknown) => usableEntries<Partial<FurniturePlacement> & { id: string; furnitureId: string }>(raw, ['id', 'furnitureId'])
const usableRooms = (raw: unknown) => usableEntries<Partial<Room> & { id: string }>(raw, ['id'])

/** Fills in fields introduced after a layout may have already been saved, and replaces a malformed number/string with its default instead of letting it poison layout math. */
function normalizePlacement(placement: Partial<FurniturePlacement> & { id: string; furnitureId: string }): FurniturePlacement {
  const colors = normalizePartColors(placement.colors)
  const patterns = normalizePatterns(placement.patterns)
  return {
    id: placement.id,
    furnitureId: placement.furnitureId,
    x: finiteOr(placement.x, 0),
    y: finiteOr(placement.y, 0),
    scale: finiteOr(placement.scale, 1) > 0 ? finiteOr(placement.scale, 1) : 1,
    rotation: placement.rotation === 180 ? 180 : 0,
    colorway: typeof placement.colorway === 'string' ? placement.colorway : getDefaultColorway(placement.furnitureId),
    layer: finiteOr(placement.layer, 0),
    // Only present once the user customized something, so an untouched placement is byte-for-byte what it was before these fields existed.
    // A `variant` must name one of the piece's own shapes; anything else (or a piece with no shapes) is dropped, i.e. the default shape.
    ...(isValidVariant(getFurnitureDefinition(placement.furnitureId), placement.variant) ? { variant: placement.variant } : {}),
    ...(colors ? { colors } : {}),
    ...(patterns ? { patterns } : {}),
  }
}

/**
 * Window and rug used to be fixed, non-placeable decorations toggled by
 * booleans (`showWindow`/`showRug`) — they're now ordinary furniture, just
 * placed by default. Negative layers keep them behind anything the user
 * adds afterward (which starts at `layer: furnitureCount`, always >= 0),
 * so a freshly placed sofa naturally sits on top of the rug without any
 * special-casing in the add flow.
 */
function createDefaultDecorPlacements(): FurniturePlacement[] {
  return [
    {
      id: crypto.randomUUID(),
      furnitureId: 'window',
      x: ROOM_WIDTH / 2,
      y: ROOM_HEIGHT * 0.22,
      scale: 1,
      rotation: 0,
      colorway: getDefaultColorway('window'),
      layer: -2,
    },
    {
      id: crypto.randomUUID(),
      furnitureId: 'rug',
      x: ROOM_WIDTH * 0.42,
      y: ROOM_HEIGHT * 0.83,
      scale: 1,
      rotation: 0,
      colorway: getDefaultColorway('rug'),
      layer: -1,
    },
  ]
}

function createRoom(kind: RoomKind, name: string, preset: RoomPreset): Room {
  const id = crypto.randomUUID()
  return {
    id,
    kind,
    name,
    wallpaper: DEFAULT_WALLPAPER,
    floor: DEFAULT_FLOOR,
    furniture: preset === 'default' ? createDefaultDecorPlacements() : [],
    doorway: createDefaultDoorway(id),
  }
}

function normalizeDoorway(raw: unknown, roomId: string): Doorway {
  if (typeof raw !== 'object' || raw === null) return createDefaultDoorway(roomId)
  const candidate = raw as Partial<Doorway>
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.entryPosition?.x !== 'number' ||
    typeof candidate.entryPosition?.y !== 'number' ||
    typeof candidate.exitPosition?.x !== 'number' ||
    typeof candidate.exitPosition?.y !== 'number'
  ) {
    return createDefaultDoorway(roomId)
  }
  return {
    id: candidate.id,
    roomId,
    entryPosition: candidate.entryPosition,
    exitPosition: candidate.exitPosition,
    passable: candidate.passable !== false,
  }
}

function normalizeRoom(raw: Partial<Room> & { id: string }): Room {
  const kind = raw.kind && ROOM_KIND_ORDER.includes(raw.kind) ? raw.kind : 'free'
  return {
    id: raw.id,
    kind,
    name: typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name : ROOM_KIND_LABELS[kind],
    wallpaper: normalizeWallpaper(raw.wallpaper),
    floor: normalizeFloor(raw.floor),
    furniture: usablePlacements(raw.furniture).map(normalizePlacement),
    doorway: normalizeDoorway(raw.doorway, raw.id),
  }
}

function migrateRoomToV4(room: Room): Room {
  return { ...room, furniture: room.furniture.map(normalizePlacement) }
}

function migrateRoomToV5(room: Room): Room {
  return { ...room, furniture: room.furniture.map(normalizePlacement) }
}

/** Legacy persisted shapes this store has had at various points — only `migrate` ever sees these. */
interface LegacyPersistedShape {
  backgroundId?: string
  furniture?: Array<Partial<FurniturePlacement> & { id: string; furnitureId: string }>
  showWindow?: boolean
  showRug?: boolean
  wallpaper?: Partial<WallpaperSettings>
  floor?: Partial<FloorSettings>
  rooms?: Array<Partial<Room> & { id: string }>
  activeDecorateRoomId?: string
  activeLiveRoomId?: string
}

function updateRoom(rooms: Room[], roomId: string, updater: (room: Room) => Room): Room[] {
  return rooms.map((room) => (room.id === roomId ? updater(room) : room))
}

const defaultRoom = createRoom('living', ROOM_KIND_LABELS.living, 'default')

export const useHomeStore = create<HomeState>()(
  persist(
    (set, get) => ({
      rooms: [defaultRoom],
      activeDecorateRoomId: defaultRoom.id,
      activeLiveRoomId: defaultRoom.id,
      selectedFurnitureId: null,
      addRoom: (kind, name, preset) => {
        const state = get()
        if (state.rooms.length >= MAX_ROOMS) return ''
        const room = createRoom(kind, name.trim() || ROOM_KIND_LABELS[kind], preset)
        set({ rooms: [...state.rooms, room] })
        return room.id
      },
      renameRoom: (id, name) =>
        set((state) => ({
          rooms: state.rooms.map((room) => (room.id === id ? { ...room, name: name.trim() || room.name } : room)),
        })),
      removeRoom: (id) =>
        set((state) => {
          if (state.rooms.length <= 1) return state
          const rooms = state.rooms.filter((room) => room.id !== id)
          const fallbackId = rooms[0].id
          return {
            rooms,
            activeDecorateRoomId: state.activeDecorateRoomId === id ? fallbackId : state.activeDecorateRoomId,
            activeLiveRoomId: state.activeLiveRoomId === id ? fallbackId : state.activeLiveRoomId,
            selectedFurnitureId: state.activeDecorateRoomId === id ? null : state.selectedFurnitureId,
          }
        }),
      setActiveDecorateRoom: (id) => set({ activeDecorateRoomId: id, selectedFurnitureId: null }),
      setActiveLiveRoom: (id) => set({ activeLiveRoomId: id }),
      addFurniture: (placement) =>
        set((state) => ({
          rooms: updateRoom(state.rooms, state.activeDecorateRoomId, (room) => ({
            ...room,
            furniture: [...room.furniture, normalizePlacement(placement)],
          })),
        })),
      moveFurniture: (id, x, y) =>
        set((state) => ({
          rooms: updateRoom(state.rooms, state.activeDecorateRoomId, (room) => ({
            ...room,
            furniture: room.furniture.map((f) => (f.id === id ? { ...f, x, y } : f)),
          })),
        })),
      updateFurniture: (id, patch) =>
        set((state) => ({
          rooms: updateRoom(state.rooms, state.activeDecorateRoomId, (room) => ({
            ...room,
            // Re-normalizing keeps the optional maps well-formed (and absent when empty) no matter what a caller passes.
            furniture: room.furniture.map((f) => (f.id === id ? normalizePlacement({ ...f, ...patch }) : f)),
          })),
        })),
      removeFurniture: (id) =>
        set((state) => ({
          rooms: updateRoom(state.rooms, state.activeDecorateRoomId, (room) => ({
            ...room,
            furniture: room.furniture.filter((f) => f.id !== id),
          })),
          selectedFurnitureId: state.selectedFurnitureId === id ? null : state.selectedFurnitureId,
        })),
      selectFurniture: (id) => set({ selectedFurnitureId: id }),
      bringToFront: (id) =>
        set((state) => {
          const room = getActiveDecorateRoom(state)
          const topLayer = Math.max(0, ...room.furniture.map((f) => f.layer))
          return {
            rooms: updateRoom(state.rooms, state.activeDecorateRoomId, (r) => ({
              ...r,
              furniture: r.furniture.map((f) => (f.id === id ? { ...f, layer: topLayer + 1 } : f)),
            })),
          }
        }),
      sendToBack: (id) =>
        set((state) => {
          const room = getActiveDecorateRoom(state)
          const bottomLayer = Math.min(0, ...room.furniture.map((f) => f.layer))
          return {
            rooms: updateRoom(state.rooms, state.activeDecorateRoomId, (r) => ({
              ...r,
              furniture: r.furniture.map((f) => (f.id === id ? { ...f, layer: bottomLayer - 1 } : f)),
            })),
          }
        }),
      resetLayout: () =>
        set((state) => ({
          rooms: updateRoom(state.rooms, state.activeDecorateRoomId, (room) => ({ ...room, furniture: [] })),
          selectedFurnitureId: null,
        })),
      setWallpaper: (patch) =>
        set((state) => ({
          rooms: updateRoom(state.rooms, state.activeDecorateRoomId, (room) => ({
            ...room,
            wallpaper: { ...room.wallpaper, ...patch },
          })),
        })),
      setFloor: (patch) =>
        set((state) => ({
          rooms: updateRoom(state.rooms, state.activeDecorateRoomId, (room) => ({
            ...room,
            floor: { ...room.floor, ...patch },
          })),
        })),
      applyRoomDecor: (patch) =>
        set((state) => ({
          rooms: updateRoom(state.rooms, state.activeDecorateRoomId, (room) => ({
            ...room,
            wallpaper: patch.wallpaper,
            floor: patch.floor,
            furniture: patch.furniture,
          })),
          // The previous selection may no longer exist once the furniture list is fully replaced — clear it
          // defensively, mirroring resetLayout's own behavior.
          selectedFurnitureId: null,
        })),
      restoreHomeState: (rooms, activeDecorateRoomId, activeLiveRoomId) =>
        set((state) => {
          const normalizedRooms = usableRooms(rooms).map(normalizeRoom)
          const finalRooms = normalizedRooms.length > 0 ? normalizedRooms : state.rooms
          const hasRoom = (id: string) => finalRooms.some((r) => r.id === id)
          return {
            rooms: finalRooms,
            activeDecorateRoomId: hasRoom(activeDecorateRoomId) ? activeDecorateRoomId : finalRooms[0].id,
            activeLiveRoomId: hasRoom(activeLiveRoomId) ? activeLiveRoomId : finalRooms[0].id,
            selectedFurnitureId: null,
          }
        }),
    }),
    {
      name: 'dearly-home',
      version: SCHEMA_VERSION,
      partialize: (state) => ({
        rooms: state.rooms,
        activeDecorateRoomId: state.activeDecorateRoomId,
        activeLiveRoomId: state.activeLiveRoomId,
      }),
      migrate: (persistedState, version) => {
        let state = { ...(persistedState as LegacyPersistedShape) }

        if (version < 1) {
          // Pre-furniture-based decor: window/rug were booleans (default
          // true), not placements. Only inject a replacement if one isn't
          // already there and the flag wasn't explicitly turned off.
          const furniture = usablePlacements(state.furniture).map(normalizePlacement)
          const hasWindow = furniture.some((f) => f.furnitureId === 'window')
          const hasRug = furniture.some((f) => f.furnitureId === 'rug')
          const [defaultWindow, defaultRug] = createDefaultDecorPlacements()
          if (!hasWindow && state.showWindow !== false) furniture.push(defaultWindow)
          if (!hasRug && state.showRug !== false) furniture.push(defaultRug)
          state = { ...state, furniture }
        }

        if (version < 2) {
          // Fixed backgroundId theme presets replaced by independent
          // wallpaper/floor settings — carry the old preset's colors over
          // as a plain solid color so an existing room looks as close as
          // possible to before, rather than resetting to the app default.
          const theme = getRoomTheme(state.backgroundId ?? 'living-room')
          state = {
            ...state,
            wallpaper: { baseColor: theme.wallFrom, pattern: 'solid', patternColor: theme.wallTo, patternScale: 1 },
            floor: { baseColor: theme.floorFrom, pattern: 'solid', patternColor: theme.floorTo, patternScale: 1, orientation: 0 },
          }
        }

        if (version < 3) {
          // Single flat room -> first entry in a `rooms` array. Nothing about
          // the room's actual decor changes, only its shape — this is the
          // exact furniture/wallpaper/floor the user already had, just now
          // addressable by room id.
          const livingRoom = createRoom('living', ROOM_KIND_LABELS.living, 'empty')
          const room: Room = {
            ...livingRoom,
            furniture: usablePlacements(state.furniture).map(normalizePlacement),
            wallpaper: normalizeWallpaper(state.wallpaper),
            floor: normalizeFloor(state.floor),
          }
          state = { rooms: [room], activeDecorateRoomId: room.id, activeLiveRoomId: room.id }
        }

        let rooms = usableRooms(state.rooms).map(normalizeRoom)

        if (version < 4) {
          // v4 added optional per-part `colors` and surface `patterns` to a
          // placement. Data written before v4 cannot contain them, so every
          // existing placement (position, scale, rotation, colorway, layer,
          // wallpaper, floor, doorway, room ids) is carried over exactly and
          // simply has no customization yet — it keeps its preset look. Any
          // stray/malformed value under those two keys is dropped rather than
          // trusted; nothing else is touched.
          rooms = rooms.map(migrateRoomToV4)
        }

        if (version < 5) {
          // v5 added the optional `variant` (a rug's shape). Nothing saved
          // earlier has one, so every placement — including every existing
          // rug, which is by definition the original 타원형 — is carried over
          // unchanged; a stray/invalid `variant` value is dropped.
          rooms = rooms.map(migrateRoomToV5)
        }

        return {
          rooms,
          activeDecorateRoomId: state.activeDecorateRoomId ?? '',
          activeLiveRoomId: state.activeLiveRoomId ?? '',
        }
      },
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<Pick<HomeState, 'rooms' | 'activeDecorateRoomId' | 'activeLiveRoomId'>> | undefined
        const savedRooms = usableRooms(persisted?.rooms).map(normalizeRoom)
        const rooms = savedRooms.length > 0 ? savedRooms : currentState.rooms
        const hasRoom = (id: string | undefined) => !!id && rooms.some((r) => r.id === id)
        return {
          ...currentState,
          rooms,
          activeDecorateRoomId: hasRoom(persisted?.activeDecorateRoomId) ? (persisted!.activeDecorateRoomId as string) : rooms[0].id,
          activeLiveRoomId: hasRoom(persisted?.activeLiveRoomId) ? (persisted!.activeLiveRoomId as string) : rooms[0].id,
        }
      },
    },
  ),
)
