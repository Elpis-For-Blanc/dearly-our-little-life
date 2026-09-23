import { beforeEach, describe, expect, it } from 'vitest'
import { getActiveDecorateRoom, useHomeStore } from './homeStore'
import { MAX_ROOMS } from './roomTypes'

function activeRoom() {
  return getActiveDecorateRoom(useHomeStore.getState())
}

describe('homeStore', () => {
  beforeEach(() => {
    localStorage.clear()
    // Reset all the way back to a single, empty room each test — several
    // tests in this file (room CRUD in particular) add/remove rooms, and
    // this store is a module-level singleton that otherwise carries state
    // across tests within the same file.
    const room = useHomeStore.getInitialState().rooms[0]
    useHomeStore.setState({
      rooms: [{ ...room, furniture: [] }],
      activeDecorateRoomId: room.id,
      activeLiveRoomId: room.id,
      selectedFurnitureId: null,
    })
  })

  it('adds, moves, and removes furniture', () => {
    const placement = { id: '1', furnitureId: 'sofa', x: 10, y: 20, scale: 1, rotation: 0 as const, colorway: 'rose', layer: 0 }

    useHomeStore.getState().addFurniture(placement)
    expect(activeRoom().furniture).toHaveLength(1)

    useHomeStore.getState().moveFurniture('1', 50, 60)
    expect(activeRoom().furniture[0]).toMatchObject({ x: 50, y: 60 })

    useHomeStore.getState().removeFurniture('1')
    expect(activeRoom().furniture).toHaveLength(0)
  })

  it('clears the selection when the selected item is removed', () => {
    useHomeStore
      .getState()
      .addFurniture({ id: '1', furnitureId: 'sofa', x: 0, y: 0, scale: 1, rotation: 0, colorway: 'rose', layer: 0 })
    useHomeStore.getState().selectFurniture('1')
    expect(useHomeStore.getState().selectedFurnitureId).toBe('1')

    useHomeStore.getState().removeFurniture('1')
    expect(useHomeStore.getState().selectedFurnitureId).toBeNull()
  })

  it('does not persist the selection to localStorage', () => {
    useHomeStore
      .getState()
      .addFurniture({ id: '1', furnitureId: 'sofa', x: 0, y: 0, scale: 1, rotation: 0, colorway: 'rose', layer: 0 })
    useHomeStore.getState().selectFurniture('1')

    const stored = JSON.parse(localStorage.getItem('dearly-home') ?? '{}')
    expect(stored.state).not.toHaveProperty('selectedFurnitureId')
  })

  it('persists furniture placements to localStorage, inside the active room', () => {
    const roomId = useHomeStore.getState().activeDecorateRoomId
    useHomeStore.getState().addFurniture({
      id: '1',
      furnitureId: 'plant',
      x: 5,
      y: 5,
      scale: 1,
      rotation: 0,
      colorway: 'sage',
      layer: 0,
    })

    const stored = JSON.parse(localStorage.getItem('dearly-home') ?? '{}')
    const room = stored.state.rooms.find((r: { id: string }) => r.id === roomId)
    expect(room.furniture).toHaveLength(1)
    expect(room.furniture[0].furnitureId).toBe('plant')
  })

  it('fills in scale/rotation/colorway defaults for a placement saved before those fields existed', () => {
    // Simulates data written by an earlier version of the app.
    const legacy = { id: '1', furnitureId: 'sofa', x: 10, y: 20, layer: 0 }
    useHomeStore.getState().addFurniture(legacy as never)

    const normalized = activeRoom().furniture[0]
    expect(normalized.scale).toBe(1)
    expect(normalized.rotation).toBe(0)
    expect(normalized.colorway).toBe('rose')
  })

  it('updateFurniture merges a partial patch without touching other fields', () => {
    useHomeStore
      .getState()
      .addFurniture({ id: '1', furnitureId: 'bed', x: 10, y: 20, scale: 1, rotation: 0, colorway: 'blush', layer: 0 })

    useHomeStore.getState().updateFurniture('1', { scale: 1.2, colorway: 'sky' })

    const updated = activeRoom().furniture[0]
    expect(updated).toMatchObject({ x: 10, y: 20, scale: 1.2, colorway: 'sky' })
  })

  it('bringToFront and sendToBack move a placement above/below its siblings', () => {
    useHomeStore
      .getState()
      .addFurniture({ id: '1', furnitureId: 'sofa', x: 0, y: 0, scale: 1, rotation: 0, colorway: 'rose', layer: 0 })
    useHomeStore
      .getState()
      .addFurniture({ id: '2', furnitureId: 'table', x: 0, y: 0, scale: 1, rotation: 0, colorway: 'natural', layer: 1 })

    useHomeStore.getState().bringToFront('1')
    let [first, second] = activeRoom().furniture
    expect(first.layer).toBeGreaterThan(second.layer)

    useHomeStore.getState().sendToBack('1')
    ;[first, second] = activeRoom().furniture
    expect(first.layer).toBeLessThan(second.layer)
  })

  it('resetLayout clears furniture (including rug/window) and selection but keeps wallpaper/floor settings', () => {
    useHomeStore.getState().setWallpaper({ baseColor: '#ff0000' })
    useHomeStore
      .getState()
      .addFurniture({ id: '1', furnitureId: 'sofa', x: 0, y: 0, scale: 1, rotation: 0, colorway: 'rose', layer: 0 })
    useHomeStore
      .getState()
      .addFurniture({ id: '2', furnitureId: 'rug', x: 0, y: 0, scale: 1, rotation: 0, colorway: 'blush', layer: -1 })
    useHomeStore.getState().selectFurniture('2')

    useHomeStore.getState().resetLayout()

    expect(activeRoom().furniture).toHaveLength(0)
    expect(useHomeStore.getState().selectedFurnitureId).toBeNull()
    expect(activeRoom().wallpaper.baseColor).toBe('#ff0000')
  })

  it('persists every editable field so a reload keeps drag/scale/color/layer changes', () => {
    const roomId = useHomeStore.getState().activeDecorateRoomId
    useHomeStore
      .getState()
      .addFurniture({ id: '1', furnitureId: 'bed', x: 0, y: 0, scale: 1, rotation: 0, colorway: 'blush', layer: 0 })

    useHomeStore.getState().moveFurniture('1', 210, 88)
    useHomeStore.getState().updateFurniture('1', { scale: 1.15, colorway: 'sky', rotation: 180 })
    useHomeStore.getState().bringToFront('1')

    // Re-read exactly what a page reload would rehydrate from.
    const stored = JSON.parse(localStorage.getItem('dearly-home') ?? '{}')
    const room = stored.state.rooms.find((r: { id: string }) => r.id === roomId)
    expect(room.furniture[0]).toMatchObject({
      x: 210,
      y: 88,
      scale: 1.15,
      colorway: 'sky',
      rotation: 180,
      layer: 1,
    })
  })

  describe('rug and window as ordinary furniture', () => {
    it('a brand-new session starts with a default window and rug already placed', () => {
      const initial = useHomeStore.getInitialState()
      const furnitureIds = getActiveDecorateRoom(initial).furniture.map((f) => f.furnitureId)

      expect(furnitureIds).toContain('window')
      expect(furnitureIds).toContain('rug')
    })

    it('rug/window are selectable, movable, resizable, and deletable exactly like other furniture', () => {
      useHomeStore.getState().addFurniture({ id: 'rug-1', furnitureId: 'rug', x: 100, y: 100, scale: 1, rotation: 0, colorway: 'blush', layer: -1 })

      useHomeStore.getState().selectFurniture('rug-1')
      expect(useHomeStore.getState().selectedFurnitureId).toBe('rug-1')

      useHomeStore.getState().moveFurniture('rug-1', 200, 150)
      useHomeStore.getState().updateFurniture('rug-1', { scale: 1.2, colorway: 'sage' })
      const moved = activeRoom().furniture[0]
      expect(moved).toMatchObject({ x: 200, y: 150, scale: 1.2, colorway: 'sage' })

      useHomeStore.getState().removeFurniture('rug-1')
      expect(activeRoom().furniture).toHaveLength(0)
      expect(useHomeStore.getState().selectedFurnitureId).toBeNull()
    })

    it('does not resurrect window/rug when migrating already-migrated (version >= 1) data with an intentionally empty layout', () => {
      // Version 1 already went through the showWindow/showRug -> furniture
      // migration once — an empty furniture array here means the user
      // genuinely cleared their layout, not "never migrated".
      const migrate = useHomeStore.persist.getOptions().migrate!
      const migrated = migrate({ furniture: [], showWindow: true, showRug: true }, 1) as unknown as {
        rooms: [{ furniture: { furnitureId: string }[] }]
      }

      const ids = migrated.rooms[0].furniture.map((f) => f.furnitureId)
      expect(ids).not.toContain('window')
      expect(ids).not.toContain('rug')
    })

    it('migrates version-0 data (pre-furniture decor, showWindow/showRug:true) into real placements', () => {
      const migrate = useHomeStore.persist.getOptions().migrate!
      const migrated = migrate({ backgroundId: 'living-room', furniture: [], showWindow: true, showRug: true }, 0) as unknown as {
        rooms: [{ furniture: { furnitureId: string }[] }]
      }

      const ids = migrated.rooms[0].furniture.map((f) => f.furnitureId)
      expect(ids).toContain('window')
      expect(ids).toContain('rug')
    })

    it('respects a legacy showWindow:false — does not re-add what the user had already hidden', () => {
      const migrate = useHomeStore.persist.getOptions().migrate!
      const migrated = migrate({ backgroundId: 'living-room', furniture: [], showWindow: false, showRug: true }, 0) as unknown as {
        rooms: [{ furniture: { furnitureId: string }[] }]
      }

      const ids = migrated.rooms[0].furniture.map((f) => f.furnitureId)
      expect(ids).not.toContain('window')
      expect(ids).toContain('rug')
    })
  })

  describe('wallpaper and floor', () => {
    it('setWallpaper/setFloor merge a partial patch without touching other fields', () => {
      useHomeStore.getState().setWallpaper({ baseColor: '#ffe3ec' })
      useHomeStore.getState().setFloor({ pattern: 'herringbone' })

      expect(activeRoom().wallpaper.baseColor).toBe('#ffe3ec')
      expect(activeRoom().wallpaper.pattern).toBe('solid') // untouched
      expect(activeRoom().floor.pattern).toBe('herringbone')
    })

    it('persists wallpaper and floor settings to localStorage', () => {
      const roomId = useHomeStore.getState().activeDecorateRoomId
      useHomeStore.getState().setWallpaper({ baseColor: '#d9eaf8', pattern: 'dot', patternColor: '#cfe8f7' })
      useHomeStore.getState().setFloor({ baseColor: '#efe3d0', pattern: 'marble' })

      const stored = JSON.parse(localStorage.getItem('dearly-home') ?? '{}')
      const room = stored.state.rooms.find((r: { id: string }) => r.id === roomId)
      expect(room.wallpaper).toMatchObject({ baseColor: '#d9eaf8', pattern: 'dot' })
      expect(room.floor).toMatchObject({ baseColor: '#efe3d0', pattern: 'marble' })
    })

    it('migrates a version < 2 backgroundId theme preset into equivalent wallpaper/floor colors', () => {
      const migrate = useHomeStore.persist.getOptions().migrate!
      const migrated = migrate({ backgroundId: 'rose', furniture: [], showWindow: true, showRug: true }, 0) as unknown as {
        rooms: [{ wallpaper: { baseColor: string }; floor: { baseColor: string } }]
      }

      // 'rose' theme's wallFrom/floorFrom — carried over so an existing room looks as close as possible to before.
      expect(migrated.rooms[0].wallpaper.baseColor).toBe('#faeef4')
      expect(migrated.rooms[0].floor.baseColor).toBe('#f6e2e9')
    })

    it('a brand-new session starts with sensible default wallpaper/floor settings', () => {
      const initial = useHomeStore.getInitialState()
      const room = getActiveDecorateRoom(initial)
      expect(room.wallpaper.pattern).toBe('solid')
      expect(room.floor.baseColor).toBeTruthy()
    })
  })

  describe('multi-room: migration of a pre-multi-room single-room save (schema v3)', () => {
    it('wraps an old flat furniture/wallpaper/floor save (version 2, no rooms field) into a single first room', () => {
      const migrate = useHomeStore.persist.getOptions().migrate!
      const legacyFurniture = [{ id: '1', furnitureId: 'sofa', x: 12, y: 34, scale: 1, rotation: 0 as const, colorway: 'rose', layer: 0 }]
      const migrated = migrate(
        {
          furniture: legacyFurniture,
          wallpaper: { baseColor: '#123456', pattern: 'dot', patternColor: '#abcdef', patternScale: 1 },
          floor: { baseColor: '#654321', pattern: 'marble', patternColor: '#fedcba', patternScale: 1, orientation: 0 },
        },
        2,
      ) as { rooms: Array<{ id: string; furniture: unknown[]; wallpaper: { baseColor: string }; floor: { baseColor: string } }>; activeDecorateRoomId: string; activeLiveRoomId: string }

      expect(migrated.rooms).toHaveLength(1)
      expect(migrated.rooms[0].furniture).toMatchObject(legacyFurniture)
      expect(migrated.rooms[0].wallpaper.baseColor).toBe('#123456')
      expect(migrated.rooms[0].floor.baseColor).toBe('#654321')
      // Both the decorate and live phases must land on this same, only, room.
      expect(migrated.activeDecorateRoomId).toBe(migrated.rooms[0].id)
      expect(migrated.activeLiveRoomId).toBe(migrated.rooms[0].id)
    })

    it('preserves character-independent room data end-to-end: furniture, wallpaper, and floor all survive the v2 -> v3 migration together', () => {
      const migrate = useHomeStore.persist.getOptions().migrate!
      const migrated = migrate(
        {
          furniture: [
            { id: 'a', furnitureId: 'bed', x: 1, y: 2, scale: 1, rotation: 0 as const, colorway: 'blush', layer: 0 },
            { id: 'b', furnitureId: 'rug', x: 3, y: 4, scale: 1, rotation: 0 as const, colorway: 'sage', layer: -1 },
          ],
          wallpaper: { baseColor: '#111111', pattern: 'solid', patternColor: '#222222', patternScale: 1 },
          floor: { baseColor: '#333333', pattern: 'solid', patternColor: '#444444', patternScale: 1, orientation: 0 },
        },
        2,
      ) as unknown as { rooms: [{ furniture: { id: string }[] }] }

      expect(migrated.rooms[0].furniture.map((f) => f.id)).toEqual(['a', 'b'])
    })
  })

  describe('multi-room: merge (rehydration) behavior', () => {
    it('keeps a persisted multi-room layout and its active room pointers as-is when they are still valid', () => {
      const merge = useHomeStore.persist.getOptions().merge!
      const persisted = {
        rooms: [
          { id: 'room-a', kind: 'living', name: '거실', furniture: [], wallpaper: undefined, floor: undefined, doorway: undefined },
          { id: 'room-b', kind: 'bedroom', name: '침실', furniture: [], wallpaper: undefined, floor: undefined, doorway: undefined },
        ],
        activeDecorateRoomId: 'room-b',
        activeLiveRoomId: 'room-a',
      }
      const merged = merge(persisted, useHomeStore.getState()) as { rooms: { id: string }[]; activeDecorateRoomId: string; activeLiveRoomId: string }

      expect(merged.rooms.map((r) => r.id)).toEqual(['room-a', 'room-b'])
      expect(merged.activeDecorateRoomId).toBe('room-b')
      expect(merged.activeLiveRoomId).toBe('room-a')
    })

    it('falls back to the first room when a persisted active room id no longer exists among the persisted rooms', () => {
      const merge = useHomeStore.persist.getOptions().merge!
      const persisted = {
        rooms: [{ id: 'room-a', kind: 'living', name: '거실', furniture: [], wallpaper: undefined, floor: undefined, doorway: undefined }],
        activeDecorateRoomId: 'deleted-room',
        activeLiveRoomId: 'also-deleted',
      }
      const merged = merge(persisted, useHomeStore.getState()) as { rooms: { id: string }[]; activeDecorateRoomId: string; activeLiveRoomId: string }

      expect(merged.activeDecorateRoomId).toBe('room-a')
      expect(merged.activeLiveRoomId).toBe('room-a')
    })
  })

  describe('room CRUD', () => {
    it('addRoom appends a new room and switches nothing by itself (caller decides whether to switch to it)', () => {
      const before = useHomeStore.getState().rooms.length
      const id = useHomeStore.getState().addRoom('bedroom', '내 침실', 'empty')

      expect(useHomeStore.getState().rooms).toHaveLength(before + 1)
      const added = useHomeStore.getState().rooms.find((r) => r.id === id)
      expect(added?.name).toBe('내 침실')
      expect(added?.kind).toBe('bedroom')
      expect(added?.furniture).toHaveLength(0)
    })

    it('refuses to add a 6th room past MAX_ROOMS', () => {
      while (useHomeStore.getState().rooms.length < MAX_ROOMS) {
        useHomeStore.getState().addRoom('free', '방', 'empty')
      }
      expect(useHomeStore.getState().rooms).toHaveLength(MAX_ROOMS)

      const result = useHomeStore.getState().addRoom('free', '초과된 방', 'empty')
      expect(result).toBe('')
      expect(useHomeStore.getState().rooms).toHaveLength(MAX_ROOMS)
    })

    it('renameRoom updates only that room name', () => {
      const id = useHomeStore.getState().addRoom('kitchen', '주방', 'empty')
      useHomeStore.getState().renameRoom(id, '작은 주방')
      expect(useHomeStore.getState().rooms.find((r) => r.id === id)?.name).toBe('작은 주방')
    })

    it('removeRoom refuses to delete the last remaining room', () => {
      const before = useHomeStore.getState().rooms
      expect(before).toHaveLength(1)

      useHomeStore.getState().removeRoom(before[0].id)
      expect(useHomeStore.getState().rooms).toHaveLength(1)
    })

    it('removeRoom deletes a non-last room and reassigns active pointers that pointed at it', () => {
      const originalId = useHomeStore.getState().activeDecorateRoomId
      const newId = useHomeStore.getState().addRoom('study', '서재', 'empty')
      useHomeStore.getState().setActiveDecorateRoom(newId)
      useHomeStore.getState().setActiveLiveRoom(newId)

      useHomeStore.getState().removeRoom(newId)

      expect(useHomeStore.getState().rooms.find((r) => r.id === newId)).toBeUndefined()
      expect(useHomeStore.getState().activeDecorateRoomId).toBe(originalId)
      expect(useHomeStore.getState().activeLiveRoomId).toBe(originalId)
    })
  })
})
