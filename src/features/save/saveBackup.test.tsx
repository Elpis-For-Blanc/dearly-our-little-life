import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useCharacterStore } from '../character/characterStore'
import { EMPTY_AI_PROFILE, type Character } from '../character/types'
import { DEFAULT_DIALOGUE_FREQUENCY } from '../dialogue/autoDialogueConfig'
import { useDialogueFrequencyStore } from '../dialogue/dialogueFrequencyStore'
import { DEFAULT_MONOLOGUE_FREQUENCY } from '../dialogue/monologueConfig'
import { useMonologueFrequencyStore } from '../dialogue/monologueFrequencyStore'
import { useRelationshipStore } from '../dialogue/relationshipStore'
import { useHomeStore } from '../home/homeStore'
import type { FurniturePlacement } from '../home/types'
import { useCharacterInteractionStore } from '../interaction/characterInteractionStore'
import { useRoomLightingSettingsStore } from '../lighting/roomLightingSettingsStore'
import { useNeedsStore } from '../needs/needsStore'
import { useAutoFurnitureUseSettingsStore } from '../simulation/autoFurnitureUseSettingsStore'
import { useCharacterMovementStore, type CharacterMovementState } from '../simulation/characterMovementStore'
import { useFurnitureUsageStore } from '../simulation/furnitureUsageStore'
import { loadGame, saveGame } from './saveActions'
import { buildBackupFileName, exportBackup, serializeBackupJson } from './saveExport'
import { BACKUP_MAX_BYTES, commitBackupImport, prepareBackupImport } from './saveImport'
import { SaveLoadControls } from './SaveLoadControls'
import { serializeSaveData } from './saveSerializer'
import { SAVE_STORAGE_KEY } from './saveStorage'
import { validateSaveData } from './saveValidate'

const REJECTED = '가져올 수 없는 백업 파일이에요.'

function character(id: string, name = id): Character {
  return {
    id,
    name,
    imageDataUrl: 'data:image/png;base64,',
    displayScale: 1,
    footOffsetRatio: 0,
    imageBounds: null,
    traits: { personality: '', favoriteColor: '' },
    aiProfile: { ...EMPTY_AI_PROFILE },
  }
}

function movementEntry(id: string, roomId: string, overrides: Partial<CharacterMovementState> = {}): CharacterMovementState {
  return { id, roomId, x: 100, y: 100, destination: null, destinationRoomId: null, currentBehavior: null, status: 'idle', restTicksRemaining: 0, stuckTicks: 0, ...overrides }
}

const SOFA: FurniturePlacement = { id: 'f1', furnitureId: 'sofa', x: 200, y: 300, scale: 1, rotation: 0, colorway: 'rose', layer: 0 }

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
  useCharacterInteractionStore.getState().reset()
  useFurnitureUsageStore.getState().reset()
  const room = useHomeStore.getState().rooms[0]
  useHomeStore.setState({
    rooms: [{ ...room, name: '거실', furniture: [] }],
    activeDecorateRoomId: room.id,
    activeLiveRoomId: room.id,
    selectedFurnitureId: null,
  })
}

/** A recognizable, non-default game state — used as "what the backup contains". */
function buildBackedUpState() {
  const room = useHomeStore.getState().rooms[0]
  useHomeStore.setState({ rooms: [{ ...room, name: '내 거실', furniture: [SOFA] }] })
  useCharacterStore.setState({ characters: [character('a', '밀로')] })
  useNeedsStore.setState({ byId: { a: { hunger: 12, energy: 34, fun: 56, social: 78 } } })
  useCharacterMovementStore.setState({ byId: { a: movementEntry('a', room.id) } })
  useDialogueFrequencyStore.setState({ mode: 'chatty' })
  useAutoFurnitureUseSettingsStore.setState({ enabled: true })
  useRoomLightingSettingsStore.setState({ enabled: true, intensity: 40 })
}

/** A different state, standing in for "the game as it is right now, before importing". */
function buildCurrentState() {
  const room = useHomeStore.getState().rooms[0]
  useHomeStore.setState({ rooms: [{ ...room, name: '지금의 거실', furniture: [] }] })
  useCharacterStore.setState({ characters: [character('z', '현재캐릭터')] })
  useNeedsStore.setState({ byId: { z: { hunger: 90, energy: 90, fun: 90, social: 90 } } })
  useCharacterMovementStore.setState({ byId: { z: movementEntry('z', room.id) } })
}

function jsonFile(content: string, name = 'dearly-backup-2026-09-24.json'): File {
  return new File([content], name, { type: 'application/json' })
}

function snapshotOfCurrentState() {
  return JSON.stringify({
    rooms: useHomeStore.getState().rooms,
    characters: useCharacterStore.getState().characters,
    needs: useNeedsStore.getState().byId,
    dialogue: useDialogueFrequencyStore.getState().mode,
    auto: useAutoFurnitureUseSettingsStore.getState().enabled,
    lighting: useRoomLightingSettingsStore.getState(),
  })
}

function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

describe('백업 내보내기 (export)', () => {
  beforeEach(resetAllStores)
  afterEach(() => vi.restoreAllMocks())

  it('내보내기 JSON은 기존 SaveData 규격 그대로이며 유효성 검사를 통과한다', () => {
    buildBackedUpState()
    const parsed: unknown = JSON.parse(serializeBackupJson())
    const validated = validateSaveData(parsed)
    expect(validated.ok).toBe(true)
    const data = parsed as ReturnType<typeof serializeSaveData>
    expect(data.schemaVersion).toBe(2)
    expect(typeof data.savedAt).toBe('string')
    expect(Number.isNaN(Date.parse(data.savedAt))).toBe(false)
    expect(data.home.rooms[0].name).toBe('내 거실')
    expect(data.home.rooms[0].furniture).toHaveLength(1)
    expect(data.characters.list.map((c) => c.id)).toEqual(['a'])
    expect(data.characters.needs.a).toEqual({ hunger: 12, energy: 34, fun: 56, social: 78 })
    expect(data.settings.dialogueFrequency).toBe('chatty')
    expect(data.settings.autoFurnitureUseEnabled).toBe(true)
    expect(data.settings.roomLighting).toEqual({ enabled: true, intensity: 40 })
  })

  it('localStorage 저장과 완전히 같은 필드 구성을 쓴다 (별도 포맷 없음)', () => {
    buildBackedUpState()
    const fromBackup = JSON.parse(serializeBackupJson()) as Record<string, unknown>
    const fromSerializer = JSON.parse(JSON.stringify(serializeSaveData())) as Record<string, unknown>
    expect(Object.keys(fromBackup).sort()).toEqual(Object.keys(fromSerializer).sort())
    expect(Object.keys(fromBackup).sort()).toEqual(['characters', 'home', 'savedAt', 'schemaVersion', 'settings'])
  })

  it('runtime-only 데이터(이동/가구 사용/상호작용 세션/선택 상태)는 포함되지 않는다', () => {
    buildBackedUpState()
    const roomId = useHomeStore.getState().rooms[0].id
    useHomeStore.setState({ selectedFurnitureId: 'f1' })
    useCharacterMovementStore.setState({
      byId: { a: movementEntry('a', roomId, { x: 4321, y: 8765, destination: { x: 9999, y: 7777 }, status: 'seated', stuckTicks: 3, restTicksRemaining: 5 }) },
    })
    useCharacterInteractionStore.getState().start({
      id: 'RUNTIME-SESSION-MARKER',
      type: 'hug',
      characterAId: 'a',
      characterBId: 'b',
      roomId,
      phase: 'approaching',
      startedAt: null,
      duration: 1,
      socialRecoveryApplied: 0,
      facing: null,
    })
    useFurnitureUsageStore.getState().reserve({ characterId: 'a', placementId: 'f1', roomId, slotId: 'sofa-left' })

    const json = serializeBackupJson()
    for (const marker of ['RUNTIME-SESSION-MARKER', '4321', '8765', '9999', '7777', 'stuckTicks', 'restTicksRemaining', 'destination', 'selectedFurnitureId', 'bySeatKey', 'f1:sofa-left', 'socialRecoveryApplied']) {
      // 'f1' appears as the furniture placement's own id — only the *runtime* fields/values above must be absent.
      expect(json, marker).not.toContain(marker)
    }
    const data = JSON.parse(json) as ReturnType<typeof serializeSaveData>
    expect(Object.keys(data.characters).sort()).toEqual(['list', 'needs', 'roomIdByCharacterId'])
    expect(data.characters.roomIdByCharacterId).toEqual({ a: roomId }) // only *which room*, never a coordinate
  })

  it('파일명은 dearly-backup-YYYY-MM-DD.json (로컬 날짜, 한 자리 월/일은 0으로 채움)', () => {
    expect(buildBackupFileName(new Date(2026, 8, 24, 13, 5))).toBe('dearly-backup-2026-09-24.json')
    expect(buildBackupFileName(new Date(2026, 0, 5, 0, 30))).toBe('dearly-backup-2026-01-05.json')
    expect(buildBackupFileName()).toMatch(/^dearly-backup-\d{4}-\d{2}-\d{2}\.json$/)
  })

  describe('다운로드와 object URL 정리', () => {
    let createSpy: ReturnType<typeof vi.fn>
    let revokeSpy: ReturnType<typeof vi.fn>

    beforeEach(() => {
      createSpy = vi.fn(() => 'blob:mock-backup')
      revokeSpy = vi.fn()
      URL.createObjectURL = createSpy as unknown as typeof URL.createObjectURL
      URL.revokeObjectURL = revokeSpy as unknown as typeof URL.revokeObjectURL
    })
    afterEach(() => {
      Reflect.deleteProperty(URL, 'createObjectURL')
      Reflect.deleteProperty(URL, 'revokeObjectURL')
    })

    it('Blob으로 다운로드를 시작하고, 끝나면 object URL을 revoke한다', async () => {
      buildBackedUpState()
      let clickedDownload = ''
      let clickedHref = ''
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        clickedDownload = this.download
        clickedHref = this.href
      })

      const result = exportBackup()

      expect(result).toEqual({ ok: true, message: '백업 파일을 만들었어요.' })
      expect(createSpy).toHaveBeenCalledTimes(1)
      const blob = createSpy.mock.calls[0][0] as Blob
      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('application/json')
      expect(clickedDownload).toMatch(/^dearly-backup-\d{4}-\d{2}-\d{2}\.json$/)
      expect(clickedHref).toBe('blob:mock-backup')
      expect(revokeSpy).toHaveBeenCalledTimes(1)
      expect(revokeSpy).toHaveBeenCalledWith('blob:mock-backup')
      // 다운로드용 임시 링크가 문서에 남아 있지 않다
      expect(document.querySelector('a[download]')).toBeNull()
      // 파일 내용은 유효한 SaveData
      const parsed: unknown = JSON.parse(await readBlobText(blob))
      expect(validateSaveData(parsed).ok).toBe(true)
    })

    it('내보내기는 localStorage 저장 슬롯을 건드리지 않는다', () => {
      buildBackedUpState()
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
      localStorage.setItem(SAVE_STORAGE_KEY, 'existing-slot-content')
      exportBackup()
      expect(localStorage.getItem(SAVE_STORAGE_KEY)).toBe('existing-slot-content')
    })

    it('다운로드 도중 오류가 나도 앱이 죽지 않고 부드러운 메시지를 돌려주며, 이미 만든 URL은 정리한다', () => {
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
        throw new Error('blocked')
      })
      vi.spyOn(console, 'debug').mockImplementation(() => {})
      const result = exportBackup()
      expect(result.ok).toBe(false)
      expect(result.message).toContain('백업 파일을 만들지 못했어요')
      expect(revokeSpy).toHaveBeenCalledWith('blob:mock-backup')
    })
  })
})

describe('백업 가져오기 (import) — 검증과 복원', () => {
  beforeEach(() => {
    resetAllStores()
    vi.spyOn(console, 'debug').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('정상 백업 파일: 검증 성공 후 commit하면 저장된 집/캐릭터/욕구/설정이 그대로 복원된다', async () => {
    buildBackedUpState()
    const json = serializeBackupJson()
    buildCurrentState() // 지금 상태는 백업과 다르다

    const prepared = await prepareBackupImport(jsonFile(json))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    // 검증 단계는 아무것도 바꾸지 않는다
    expect(useHomeStore.getState().rooms[0].name).toBe('지금의 거실')

    const result = commitBackupImport(prepared.data)

    expect(result).toEqual({ ok: true, message: '가져왔어요.' })
    expect(useHomeStore.getState().rooms[0].name).toBe('내 거실')
    expect(useHomeStore.getState().rooms[0].furniture.map((f) => f.id)).toEqual(['f1'])
    expect(useCharacterStore.getState().characters.map((c) => c.name)).toEqual(['밀로'])
    expect(useNeedsStore.getState().byId.a).toEqual({ hunger: 12, energy: 34, fun: 56, social: 78 })
    expect(useDialogueFrequencyStore.getState().mode).toBe('chatty')
    expect(useAutoFurnitureUseSettingsStore.getState().enabled).toBe(true)
    expect(useRoomLightingSettingsStore.getState().intensity).toBe(40)
  })

  it('성공하면 복원된 상태가 localStorage 저장 슬롯에도 저장되어, 이후 "불러오기"로 다시 돌아올 수 있다', async () => {
    buildBackedUpState()
    const json = serializeBackupJson()
    buildCurrentState()
    expect(localStorage.getItem(SAVE_STORAGE_KEY)).toBeNull()

    const prepared = await prepareBackupImport(jsonFile(json))
    if (!prepared.ok) throw new Error('prepare failed')
    commitBackupImport(prepared.data)

    const stored = localStorage.getItem(SAVE_STORAGE_KEY)
    expect(stored).not.toBeNull()
    expect(validateSaveData(JSON.parse(stored!)).ok).toBe(true)

    buildCurrentState() // 새로고침 뒤 다른 상태가 되었다고 가정
    expect(loadGame()).toEqual({ ok: true, message: '불러왔어요.' })
    expect(useHomeStore.getState().rooms[0].name).toBe('내 거실')
    expect(useCharacterStore.getState().characters.map((c) => c.name)).toEqual(['밀로'])
  })

  it('구버전(schemaVersion 1, 욕구 정보 없음) 백업도 기존 마이그레이션 경로로 가져와지고 기본 욕구가 채워진다', async () => {
    const room = useHomeStore.getState().rooms[0]
    const v1 = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      home: { rooms: [{ ...room, name: '옛날 거실' }], activeDecorateRoomId: room.id, activeLiveRoomId: room.id },
      characters: { list: [character('old', '옛캐릭터')], roomIdByCharacterId: { old: room.id } },
      settings: {
        dialogueFrequency: DEFAULT_DIALOGUE_FREQUENCY,
        monologueFrequency: DEFAULT_MONOLOGUE_FREQUENCY,
        relationship: { defaultRelationshipType: 'close', relationshipsByPair: {} },
        autoFurnitureUseEnabled: false,
        roomLighting: { enabled: false, intensity: 70 },
      },
    }
    buildCurrentState()

    const prepared = await prepareBackupImport(jsonFile(JSON.stringify(v1)))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.data.schemaVersion).toBe(2) // 현재 규격으로 올라왔다
    expect(commitBackupImport(prepared.data).ok).toBe(true)

    expect(useHomeStore.getState().rooms[0].name).toBe('옛날 거실')
    expect(useCharacterStore.getState().characters.map((c) => c.id)).toEqual(['old'])
    const needs = useNeedsStore.getState().byId.old
    expect(needs).toBeDefined()
    for (const value of Object.values(needs)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
    }
    // 슬롯에는 현재 규격(v2)으로 저장된다
    expect((JSON.parse(localStorage.getItem(SAVE_STORAGE_KEY)!) as { schemaVersion: number }).schemaVersion).toBe(2)
  })

  describe('가져올 수 없는 파일은 거부하고, 현재 상태와 localStorage를 전혀 바꾸지 않는다', () => {
    const goodSettings = {
      dialogueFrequency: DEFAULT_DIALOGUE_FREQUENCY,
      monologueFrequency: DEFAULT_MONOLOGUE_FREQUENCY,
      relationship: { defaultRelationshipType: 'close', relationshipsByPair: {} },
      autoFurnitureUseEnabled: false,
      roomLighting: { enabled: false, intensity: 70 },
    }
    const roomShell = () => {
      const room = useHomeStore.getState().rooms[0]
      return { room, home: { rooms: [room], activeDecorateRoomId: room.id, activeLiveRoomId: room.id } }
    }

    const badFiles: Array<[string, () => File]> = [
      ['JSON이 아님', () => jsonFile('이건 JSON이 아니에요 {{{')],
      ['빈 파일', () => jsonFile('')],
      ['JSON이지만 객체가 아님 (배열)', () => jsonFile('[1,2,3]')],
      ['JSON이지만 객체가 아님 (숫자)', () => jsonFile('42')],
      ['SaveData 형식이 아님', () => jsonFile('{"hello":"world"}')],
      ['schemaVersion 없음', () => jsonFile(JSON.stringify({ savedAt: 'x', home: roomShell().home, characters: { list: [], roomIdByCharacterId: {} }, settings: goodSettings }))],
      ['지원하지 않는 미래 schemaVersion', () => jsonFile(JSON.stringify({ schemaVersion: 3, savedAt: 'x', home: roomShell().home, characters: { list: [], roomIdByCharacterId: {}, needs: {} }, settings: goodSettings }))],
      ['schemaVersion 타입이 문자열', () => jsonFile(JSON.stringify({ schemaVersion: '2', savedAt: 'x', home: roomShell().home, characters: { list: [], roomIdByCharacterId: {}, needs: {} }, settings: goodSettings }))],
      ['home 섹션 없음', () => jsonFile(JSON.stringify({ schemaVersion: 2, savedAt: 'x', characters: { list: [], roomIdByCharacterId: {}, needs: {} }, settings: goodSettings }))],
      ['rooms 타입이 잘못됨', () => jsonFile(JSON.stringify({ schemaVersion: 2, savedAt: 'x', home: { rooms: 'nope', activeDecorateRoomId: 'a', activeLiveRoomId: 'a' }, characters: { list: [], roomIdByCharacterId: {}, needs: {} }, settings: goodSettings }))],
      ['characters 섹션 손상', () => jsonFile(JSON.stringify({ schemaVersion: 2, savedAt: 'x', home: roomShell().home, characters: { list: 'x' }, settings: goodSettings }))],
      ['settings 섹션 없음', () => jsonFile(JSON.stringify({ schemaVersion: 2, savedAt: 'x', home: roomShell().home, characters: { list: [], roomIdByCharacterId: {}, needs: {} } }))],
      ['사용할 수 있는 방이 하나도 없음', () => jsonFile(JSON.stringify({ schemaVersion: 2, savedAt: 'x', home: { rooms: [null, {}, 5], activeDecorateRoomId: 'a', activeLiveRoomId: 'a' }, characters: { list: [character('ghost')], roomIdByCharacterId: {}, needs: {} }, settings: goodSettings }))],
      ['방 목록이 비어 있음', () => jsonFile(JSON.stringify({ schemaVersion: 2, savedAt: 'x', home: { rooms: [], activeDecorateRoomId: 'a', activeLiveRoomId: 'a' }, characters: { list: [character('ghost')], roomIdByCharacterId: {}, needs: {} }, settings: goodSettings }))],
    ]

    it.each(badFiles)('%s', async (_label, makeFile) => {
      buildCurrentState()
      localStorage.setItem(SAVE_STORAGE_KEY, 'sentinel-existing-slot')
      const before = snapshotOfCurrentState()

      const prepared = await prepareBackupImport(makeFile())

      expect(prepared).toEqual({ ok: false, message: REJECTED })
      expect(snapshotOfCurrentState()).toBe(before)
      expect(localStorage.getItem(SAVE_STORAGE_KEY)).toBe('sentinel-existing-slot')
    })

    it('너무 큰 파일은 읽지도 않고 거부한다', async () => {
      buildCurrentState()
      const big = jsonFile('{}')
      Object.defineProperty(big, 'size', { value: BACKUP_MAX_BYTES + 1 })
      const readSpy = vi.spyOn(FileReader.prototype, 'readAsText')

      expect(await prepareBackupImport(big)).toEqual({ ok: false, message: REJECTED })
      expect(readSpy).not.toHaveBeenCalled()
    })

    it('사용자 메시지에는 내부 오류 상세를 노출하지 않고 console.debug로만 남긴다', async () => {
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      const result = await prepareBackupImport(jsonFile('{{{'))
      expect(result).toEqual({ ok: false, message: REJECTED })
      expect(result.ok === false && /JSON|parse|Unexpected|schema/i.test(result.message)).toBe(false)
      expect(debugSpy).toHaveBeenCalled()
    })
  })

  it('validation은 통과했지만 restore 도중 예기치 않게 실패하면, 이전 상태로 되돌리고 localStorage는 건드리지 않는다', async () => {
    buildBackedUpState()
    const json = serializeBackupJson()
    buildCurrentState()
    localStorage.setItem(SAVE_STORAGE_KEY, 'sentinel-existing-slot')
    const before = snapshotOfCurrentState()

    const prepared = await prepareBackupImport(jsonFile(json))
    if (!prepared.ok) throw new Error('prepare failed')

    // restoreHomeState는 이미 적용된 뒤, restoreCharacters가 처음 한 번만 실패한다 (되돌리기 때의 두 번째 호출은 정상 동작).
    const original = useCharacterStore.getState().restoreCharacters
    let calls = 0
    useCharacterStore.setState({
      restoreCharacters: (characters) => {
        calls += 1
        if (calls === 1) throw new Error('boom')
        original(characters)
      },
    })

    const result = commitBackupImport(prepared.data)

    expect(result).toEqual({ ok: false, message: REJECTED })
    expect(calls).toBe(2) // 실패 1회 + 되돌리기 1회
    expect(useHomeStore.getState().rooms[0].name).toBe('지금의 거실')
    expect(useCharacterStore.getState().characters.map((c) => c.id)).toEqual(['z'])
    expect(localStorage.getItem(SAVE_STORAGE_KEY)).toBe('sentinel-existing-slot')
    useCharacterStore.setState({ restoreCharacters: original })
    expect(snapshotOfCurrentState()).toBe(before)
  })

  it('가져오기는 성공했지만 저장 슬롯에 쓰지 못하면(저장 공간 부족 등) 성공으로 처리하되 그 사실을 알려준다', async () => {
    buildBackedUpState()
    const json = serializeBackupJson()
    buildCurrentState()
    const prepared = await prepareBackupImport(jsonFile(json))
    if (!prepared.ok) throw new Error('prepare failed')

    const originalSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === SAVE_STORAGE_KEY) throw new Error('quota')
      originalSetItem.call(this, key, value)
    })

    const result = commitBackupImport(prepared.data)

    expect(result.ok).toBe(true)
    expect(result.message).toContain('저장 공간')
    expect(useHomeStore.getState().rooms[0].name).toBe('내 거실')
  })
})

describe('SaveLoadControls UI: 내보내기 / 가져오기', () => {
  beforeEach(() => {
    resetAllStores()
    vi.spyOn(console, 'debug').mockImplementation(() => {})
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  function fileInput(): HTMLInputElement {
    return screen.getByLabelText('백업 파일 선택') as HTMLInputElement
  }

  function chooseFile(file: File) {
    fireEvent.change(fileInput(), { target: { files: [file] } })
  }

  it('저장/불러오기 아래에 내보내기/가져오기 버튼이 있고, 파일 선택은 .json 하나만 받는다', () => {
    render(<SaveLoadControls />)
    for (const name of ['저장', '불러오기', '내보내기', '가져오기']) expect(screen.getByRole('button', { name })).toBeInTheDocument()
    expect(fileInput().accept).toBe('.json')
    expect(fileInput().multiple).toBe(false)
    const labels = screen.getAllByRole('button').map((b) => b.textContent)
    expect(labels).toEqual(['저장', '불러오기', '내보내기', '가져오기'])
  })

  it('"가져오기" 버튼은 파일 선택창을 연다', () => {
    render(<SaveLoadControls />)
    const clickSpy = vi.spyOn(fileInput(), 'click')
    fireEvent.click(screen.getByRole('button', { name: '가져오기' }))
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('정상 파일: 확인 문구를 묻고, 확인하면 복원되며 "가져왔어요."가 표시되고 저장 슬롯도 갱신된다', async () => {
    buildBackedUpState()
    const json = serializeBackupJson()
    buildCurrentState()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<SaveLoadControls />)

    chooseFile(jsonFile(json))

    expect(await screen.findByText('가져왔어요.')).toBeInTheDocument()
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(confirmSpy).toHaveBeenCalledWith('가져오면 현재 집 상태가 가져온 데이터로 바뀌어요.\n계속할까요?')
    expect(useHomeStore.getState().rooms[0].name).toBe('내 거실')
    expect(useCharacterStore.getState().characters.map((c) => c.id)).toEqual(['a'])
    expect(localStorage.getItem(SAVE_STORAGE_KEY)).not.toBeNull()
  })

  it('확인 창에서 취소하면 현재 상태도, localStorage도 전혀 바뀌지 않는다', async () => {
    buildBackedUpState()
    const json = serializeBackupJson()
    buildCurrentState()
    localStorage.setItem(SAVE_STORAGE_KEY, 'sentinel-existing-slot')
    const before = snapshotOfCurrentState()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<SaveLoadControls />)

    chooseFile(jsonFile(json))

    expect(await screen.findByText('가져오기를 취소했어요.')).toBeInTheDocument()
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(snapshotOfCurrentState()).toBe(before)
    expect(localStorage.getItem(SAVE_STORAGE_KEY)).toBe('sentinel-existing-slot')
  })

  it('잘못된 파일: 확인 창 없이 부드러운 오류 메시지만 보이고, 현재 상태와 저장 슬롯은 그대로다', async () => {
    buildCurrentState()
    localStorage.setItem(SAVE_STORAGE_KEY, 'sentinel-existing-slot')
    const before = snapshotOfCurrentState()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<SaveLoadControls />)

    chooseFile(jsonFile('not json at all'))

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent(REJECTED)
    expect(status.className).toContain('save-load-status-error')
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(snapshotOfCurrentState()).toBe(before)
    expect(localStorage.getItem(SAVE_STORAGE_KEY)).toBe('sentinel-existing-slot')
  })

  it('같은 파일을 연달아 다시 선택해도 다시 처리된다 (입력값을 비워 둔다)', async () => {
    buildCurrentState()
    render(<SaveLoadControls />)
    chooseFile(jsonFile('bad'))
    await screen.findByText(REJECTED)
    expect(fileInput().value).toBe('')
  })

  it('"내보내기" 버튼: 다운로드를 시작하고 "백업 파일을 만들었어요."를 표시한다', () => {
    buildBackedUpState()
    const create = vi.fn(() => 'blob:ui-mock')
    const revoke = vi.fn()
    URL.createObjectURL = create as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL = revoke as unknown as typeof URL.revokeObjectURL
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    try {
      render(<SaveLoadControls />)
      fireEvent.click(screen.getByRole('button', { name: '내보내기' }))
      expect(screen.getByRole('status')).toHaveTextContent('백업 파일을 만들었어요.')
      expect(create).toHaveBeenCalledTimes(1)
      expect(revoke).toHaveBeenCalledWith('blob:ui-mock')
    } finally {
      Reflect.deleteProperty(URL, 'createObjectURL')
      Reflect.deleteProperty(URL, 'revokeObjectURL')
    }
  })

  it('회귀: 기존 저장/불러오기 버튼은 그대로 동작한다', () => {
    buildBackedUpState()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<SaveLoadControls />)

    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(screen.getByRole('status')).toHaveTextContent('저장했어요.')
    expect(validateSaveData(JSON.parse(localStorage.getItem(SAVE_STORAGE_KEY)!)).ok).toBe(true)

    buildCurrentState()
    fireEvent.click(screen.getByRole('button', { name: '불러오기' }))
    expect(screen.getByRole('status')).toHaveTextContent('불러왔어요.')
    expect(useHomeStore.getState().rooms[0].name).toBe('내 거실')
  })
})

describe('기존 저장/불러오기 함수는 변경되지 않았다', () => {
  beforeEach(resetAllStores)

  it('saveGame/loadGame은 여전히 같은 localStorage 키와 같은 SaveData를 사용한다', () => {
    buildBackedUpState()
    expect(saveGame()).toEqual({ ok: true, message: '저장했어요.' })
    expect(SAVE_STORAGE_KEY).toBe('dearly-save-slot-1')
    buildCurrentState()
    expect(loadGame()).toEqual({ ok: true, message: '불러왔어요.' })
    expect(useCharacterStore.getState().characters.map((c) => c.id)).toEqual(['a'])
  })

  it('불러오기의 오류 메시지도 그대로다', () => {
    expect(loadGame()).toEqual({ ok: false, message: '저장된 데이터가 없어요.' })
    localStorage.setItem(SAVE_STORAGE_KEY, '{{{')
    expect(loadGame().message).toBe('저장된 데이터를 읽을 수 없어요. 파일이 손상되었을 수 있어요.')
  })

  it('내보낸 백업 파일을 저장 슬롯에 그대로 넣어도 기존 불러오기로 읽힌다 (같은 규격)', () => {
    buildBackedUpState()
    localStorage.setItem(SAVE_STORAGE_KEY, serializeBackupJson())
    buildCurrentState()
    expect(loadGame().ok).toBe(true)
    expect(useHomeStore.getState().rooms[0].name).toBe('내 거실')
  })
})
