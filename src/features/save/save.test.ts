import { beforeEach, describe, expect, it } from 'vitest'
import { useCharacterStore } from '../character/characterStore'
import { EMPTY_AI_PROFILE, type Character } from '../character/types'
import { DEFAULT_DIALOGUE_FREQUENCY } from '../dialogue/autoDialogueConfig'
import { useDialogueFrequencyStore } from '../dialogue/dialogueFrequencyStore'
import { DEFAULT_MONOLOGUE_FREQUENCY } from '../dialogue/monologueConfig'
import { useMonologueFrequencyStore } from '../dialogue/monologueFrequencyStore'
import { pairKey } from '../dialogue/pairKey'
import { useRelationshipStore } from '../dialogue/relationshipStore'
import { getDefaultColorway } from '../home/colorways'
import { useHomeStore } from '../home/homeStore'
import { useRoomLightingSettingsStore } from '../lighting/roomLightingSettingsStore'
import { useNeedsStore } from '../needs/needsStore'
import { useAutoFurnitureUseSettingsStore } from '../simulation/autoFurnitureUseSettingsStore'
import { useCharacterMovementStore, type CharacterMovementState } from '../simulation/characterMovementStore'
import { loadGame, saveGame } from './saveActions'
import { serializeSaveData } from './saveSerializer'
import { SAVE_STORAGE_KEY } from './saveStorage'

function character(id: string, overrides: Partial<Character> = {}): Character {
  return {
    id,
    name: id,
    imageDataUrl: 'data:image/png;base64,',
    displayScale: 1,
    footOffsetRatio: 0,
    imageBounds: null,
    traits: { personality: '', favoriteColor: '' },
    aiProfile: { ...EMPTY_AI_PROFILE },
    ...overrides,
  }
}

function movementEntry(id: string, roomId: string, overrides: Partial<CharacterMovementState> = {}): CharacterMovementState {
  return { id, roomId, x: 100, y: 100, destination: null, destinationRoomId: null, currentBehavior: null, status: 'idle', restTicksRemaining: 0, stuckTicks: 0, ...overrides }
}

function resetAllStores() {
  localStorage.clear()
  useCharacterStore.setState({ characters: [] })
  useCharacterMovementStore.setState({ byId: {} })
  useNeedsStore.setState({ byId: {} })
  useDialogueFrequencyStore.setState({ mode: DEFAULT_DIALOGUE_FREQUENCY })
  useMonologueFrequencyStore.setState({ mode: DEFAULT_MONOLOGUE_FREQUENCY })
  useRelationshipStore.setState({ defaultRelationshipType: 'close', relationshipsByPair: {} })
  useAutoFurnitureUseSettingsStore.setState({ enabled: false })
  useRoomLightingSettingsStore.setState({ enabled: false, intensity: 70 })
  // homeStore back to exactly one fresh room, matching its own initial-state shape.
  const room = useHomeStore.getState().rooms[0]
  useHomeStore.setState({
    rooms: [{ ...room, name: '거실', furniture: [] }],
    activeDecorateRoomId: room.id,
    activeLiveRoomId: room.id,
    selectedFurnitureId: null,
  })
}

describe('save/load: serialize', () => {
  beforeEach(resetAllStores)

  it('1. 현재 집 상태가 save data로 serialize된다', () => {
    const data = serializeSaveData()
    expect(data.schemaVersion).toBe(2) // bumped for the needs/mood system — see the v1 fallback tests below
    expect(typeof data.savedAt).toBe('string')
    expect(data.home.rooms).toHaveLength(1)
    expect(data.home.activeDecorateRoomId).toBe(useHomeStore.getState().activeDecorateRoomId)
    expect(data.characters.list).toEqual([])
    expect(data.settings.dialogueFrequency).toBe(DEFAULT_DIALOGUE_FREQUENCY)
  })
})

describe('save/load: 저장', () => {
  beforeEach(resetAllStores)

  it('2. 저장 후 localStorage에 데이터가 존재한다', () => {
    expect(localStorage.getItem(SAVE_STORAGE_KEY)).toBeNull()
    const result = saveGame()
    expect(result.ok).toBe(true)
    const stored = localStorage.getItem(SAVE_STORAGE_KEY)
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.schemaVersion).toBe(2)
  })
})

describe('save/load: 불러오기(restore)', () => {
  beforeEach(resetAllStores)

  it('3. 저장 데이터에서 다시 restore할 수 있다', () => {
    useHomeStore.getState().renameRoom(useHomeStore.getState().activeDecorateRoomId, '내 거실')
    saveGame()

    // mutate away from the saved state
    useHomeStore.getState().renameRoom(useHomeStore.getState().activeDecorateRoomId, '다른 이름')

    const result = loadGame()
    expect(result.ok).toBe(true)
    expect(useHomeStore.getState().rooms[0].name).toBe('내 거실')
  })

  it('4. 가구 위치 / variant / colorway가 저장·복원 후에도 유지된다', () => {
    const roomId = useHomeStore.getState().activeDecorateRoomId
    useHomeStore.getState().addFurniture({
      id: 'sofa-1',
      furnitureId: 'sofa',
      x: 123.5,
      y: 246.5,
      scale: 1.1,
      rotation: 180,
      colorway: 'sky',
      layer: 0,
    })
    useHomeStore.getState().addFurniture({
      id: 'rug-1',
      furnitureId: 'rug',
      x: 300,
      y: 300,
      scale: 1,
      rotation: 0,
      colorway: getDefaultColorway('rug'),
      layer: -1,
      variant: 'heart',
    })
    saveGame()

    // mutate everything away, including moving to a different room selection
    useHomeStore.getState().moveFurniture('sofa-1', 0, 0)
    useHomeStore.getState().updateFurniture('sofa-1', { colorway: 'rose', variant: undefined })
    useHomeStore.getState().removeFurniture('rug-1')

    loadGame()

    const restoredRoom = useHomeStore.getState().rooms.find((r) => r.id === roomId)!
    const sofa = restoredRoom.furniture.find((f) => f.id === 'sofa-1')!
    expect(sofa.x).toBe(123.5)
    expect(sofa.y).toBe(246.5)
    expect(sofa.scale).toBe(1.1)
    expect(sofa.rotation).toBe(180)
    expect(sofa.colorway).toBe('sky')

    const rug = restoredRoom.furniture.find((f) => f.id === 'rug-1')!
    expect(rug.variant).toBe('heart')
  })

  it('5. 방 정보(이름/개수/현재 선택된 방)가 저장·복원 후에도 유지된다', () => {
    const secondRoomId = useHomeStore.getState().addRoom('bedroom', '내 침실', 'empty')
    useHomeStore.getState().setActiveDecorateRoom(secondRoomId)
    useHomeStore.getState().setActiveLiveRoom(secondRoomId)
    saveGame()

    // mutate away
    useHomeStore.getState().renameRoom(secondRoomId, '바뀐 이름')
    useHomeStore.getState().setActiveDecorateRoom(useHomeStore.getState().rooms[0].id)

    loadGame()

    const state = useHomeStore.getState()
    expect(state.rooms).toHaveLength(2)
    expect(state.rooms.find((r) => r.id === secondRoomId)?.name).toBe('내 침실')
    expect(state.activeDecorateRoomId).toBe(secondRoomId)
    expect(state.activeLiveRoomId).toBe(secondRoomId)
  })

  it('6. 캐릭터 정보(이름/커스터마이즈)와 방 위치가 저장·복원 후에도 유지된다', () => {
    const roomId = useHomeStore.getState().activeDecorateRoomId
    const secondRoomId = useHomeStore.getState().addRoom('bedroom', '침실', 'empty')
    useCharacterStore.setState({
      characters: [character('a', { name: '루나', displayScale: 1.4, traits: { personality: '', favoriteColor: 'pink' } })],
    })
    useCharacterMovementStore.setState({ byId: { a: movementEntry('a', secondRoomId, { x: 999, y: 999, status: 'seated' }) } })
    saveGame()

    // mutate away
    useCharacterStore.getState().updateCharacter('a', { name: '이름 바뀜' })
    useCharacterMovementStore.getState().setRoomId('a', roomId)

    loadGame()

    const restoredCharacter = useCharacterStore.getState().characters.find((c) => c.id === 'a')!
    expect(restoredCharacter.name).toBe('루나')
    expect(restoredCharacter.displayScale).toBe(1.4)
    expect(restoredCharacter.traits.favoriteColor).toBe('pink')
    // the character's saved room location is restored via the normal syncCharacterIds spawn path
    expect(useCharacterMovementStore.getState().byId.a?.roomId).toBe(secondRoomId)
  })

  it('6b. 캐릭터의 욕구값(hunger/energy/fun/social)이 저장·복원 후에도 유지된다', () => {
    useCharacterStore.setState({ characters: [character('a')] })
    useNeedsStore.getState().setNeeds('a', { hunger: 12, energy: 34, fun: 56, social: 78 })
    saveGame()

    useNeedsStore.getState().setNeeds('a', { hunger: 99, energy: 99, fun: 99, social: 99 })

    loadGame()

    expect(useNeedsStore.getState().byId.a).toEqual({ hunger: 12, energy: 34, fun: 56, social: 78 })
  })

  it('6c. 기존 schemaVersion 1 저장 데이터(욕구 정보 없음)를 불러와도 안전하게 처리되고, 캐릭터에 기본 욕구가 채워진다', () => {
    useCharacterStore.setState({ characters: [character('a')] })
    const roomId = useHomeStore.getState().activeDecorateRoomId
    const v1Save = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      home: { rooms: useHomeStore.getState().rooms, activeDecorateRoomId: roomId, activeLiveRoomId: roomId },
      characters: { list: useCharacterStore.getState().characters, roomIdByCharacterId: { a: roomId } },
      // no `needs` field at all — this is exactly what a real v1 save looked like before the needs system existed
      settings: {
        dialogueFrequency: DEFAULT_DIALOGUE_FREQUENCY,
        monologueFrequency: DEFAULT_MONOLOGUE_FREQUENCY,
        relationship: { defaultRelationshipType: 'close', relationshipsByPair: {} },
        autoFurnitureUseEnabled: false,
        roomLighting: { enabled: false, intensity: 70 },
      },
    }
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(v1Save))

    const result = loadGame()

    expect(result.ok).toBe(true)
    expect(useCharacterStore.getState().characters.find((c) => c.id === 'a')?.name).toBe('a')
    const needs = useNeedsStore.getState().byId.a
    expect(needs).toBeDefined()
    for (const value of Object.values(needs!)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
    }
  })

  it('7. 일시적인 runtime 상태(움직이는 중/앉아 있는 중 등)는 저장되지 않는다', () => {
    const roomId = useHomeStore.getState().activeDecorateRoomId
    useCharacterStore.setState({ characters: [character('a')] })
    useCharacterMovementStore.setState({
      byId: { a: movementEntry('a', roomId, { x: 42, y: 84, status: 'seated', destination: { x: 1, y: 2 }, stuckTicks: 3, restTicksRemaining: 5 }) },
    })

    const data = serializeSaveData()
    const raw = JSON.stringify(data)
    // only roomId is captured from characterMovementStore — none of the runtime fields ever appear in the save blob
    expect(raw).not.toContain('"seated"')
    expect(raw).not.toContain('destination')
    expect(raw).not.toContain('stuckTicks')
    expect(raw).not.toContain('restTicksRemaining')
    expect(data.characters.roomIdByCharacterId.a).toBe(roomId)

    // restoring a fresh character (movement entry not yet re-synced) never resurrects a stale runtime status —
    // the syncCharacterIds spawn path always starts a restored character at 'idle'
    useCharacterMovementStore.setState({ byId: {} })
    saveGame()
    loadGame()
    expect(useCharacterMovementStore.getState().byId.a?.status).toBe('idle')
  })

  it('8. 저장된 데이터가 없을 때 안전하게 처리된다', () => {
    const before = useHomeStore.getState().rooms[0].name
    const result = loadGame()
    expect(result.ok).toBe(false)
    expect(result.message).toBe('저장된 데이터가 없어요.')
    // nothing was mutated
    expect(useHomeStore.getState().rooms[0].name).toBe(before)
  })

  it('9. invalid JSON을 안전하게 처리한다 (크래시하지 않음)', () => {
    localStorage.setItem(SAVE_STORAGE_KEY, '{not valid json')
    expect(() => loadGame()).not.toThrow()
    const result = loadGame()
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/손상|올바르지/)
  })

  it('10. 잘못되거나 없는 schemaVersion을 안전하게 처리한다', () => {
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ savedAt: 'x', home: {}, characters: {}, settings: {} }))
    const noVersion = loadGame()
    expect(noVersion.ok).toBe(false)

    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ schemaVersion: 999, savedAt: 'x', home: {}, characters: {}, settings: {} }))
    const wrongVersion = loadGame()
    expect(wrongVersion.ok).toBe(false)
  })

  it('필수 필드가 빠진 저장 데이터도 안전하게 거부한다', () => {
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, savedAt: 'x' }))
    expect(() => loadGame()).not.toThrow()
    expect(loadGame().ok).toBe(false)
  })
})

describe('save/load: 설정값도 저장·복원된다', () => {
  beforeEach(resetAllStores)

  it('대화 빈도 / 혼잣말 빈도 / 관계 / 자동 가구 사용 / 방 조명 설정이 유지된다', () => {
    useDialogueFrequencyStore.getState().setMode('chatty')
    useMonologueFrequencyStore.getState().setMode('frequent')
    useRelationshipStore.getState().setRelationshipType('a', 'b', 'romantic')
    useAutoFurnitureUseSettingsStore.getState().setEnabled(true)
    useRoomLightingSettingsStore.getState().setEnabled(true)
    useRoomLightingSettingsStore.getState().setIntensity(40)
    saveGame()

    // mutate away
    useDialogueFrequencyStore.getState().setMode('quiet')
    useMonologueFrequencyStore.getState().setMode('off')
    useRelationshipStore.setState({ relationshipsByPair: {} })
    useAutoFurnitureUseSettingsStore.getState().setEnabled(false)
    useRoomLightingSettingsStore.getState().setEnabled(false)

    loadGame()

    expect(useDialogueFrequencyStore.getState().mode).toBe('chatty')
    expect(useMonologueFrequencyStore.getState().mode).toBe('frequent')
    expect(useRelationshipStore.getState().relationshipsByPair[pairKey('a', 'b')]).toBe('romantic')
    expect(useAutoFurnitureUseSettingsStore.getState().enabled).toBe(true)
    expect(useRoomLightingSettingsStore.getState().enabled).toBe(true)
    expect(useRoomLightingSettingsStore.getState().intensity).toBe(40)
  })
})
