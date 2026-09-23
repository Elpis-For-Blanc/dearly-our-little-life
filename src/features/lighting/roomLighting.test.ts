import { beforeEach, describe, expect, it } from 'vitest'
import { getRoomLightingStyle } from './roomLightingEngine'
import { ROOM_LIGHTING_TINTS, DEFAULT_ROOM_LIGHTING_INTENSITY } from './roomLightingConfig'
import { useRoomLightingSettingsStore } from './roomLightingSettingsStore'

describe('roomLightingEngine: getRoomLightingStyle', () => {
  it('at 100% intensity, resolves exactly each band’s own authored tint', () => {
    for (const band of ['morning', 'daytime', 'evening', 'night'] as const) {
      const style = getRoomLightingStyle(band, 100)
      const tint = ROOM_LIGHTING_TINTS[band]
      expect(style.backgroundColor).toBe(tint.color)
      expect(style.mixBlendMode).toBe(tint.blendMode)
      expect(style.opacity).toBeCloseTo(tint.baseOpacity, 5)
    }
  })

  it('at 0% intensity, every band is fully invisible (opacity 0) regardless of its own baseOpacity', () => {
    for (const band of ['morning', 'daytime', 'evening', 'night'] as const) {
      expect(getRoomLightingStyle(band, 0).opacity).toBe(0)
    }
  })

  it('scales linearly between 0% and 100%', () => {
    const style = getRoomLightingStyle('night', 50)
    expect(style.opacity).toBeCloseTo(ROOM_LIGHTING_TINTS.night.baseOpacity * 0.5, 5)
  })

  it('daytime never tints at all, at any intensity — "원래 색감에 가까운 밝기" is implemented as literally no overlay', () => {
    expect(getRoomLightingStyle('daytime', 0).opacity).toBe(0)
    expect(getRoomLightingStyle('daytime', 50).opacity).toBe(0)
    expect(getRoomLightingStyle('daytime', 100).opacity).toBe(0)
  })

  it('night has genuinely higher opacity than evening, which is higher than morning — a real day-to-night darkening curve', () => {
    const morning = getRoomLightingStyle('morning', 100).opacity
    const evening = getRoomLightingStyle('evening', 100).opacity
    const night = getRoomLightingStyle('night', 100).opacity
    expect(night).toBeGreaterThan(evening)
    expect(evening).toBeGreaterThan(morning)
  })

  it('night never reaches full opaque black-out — furniture stays visually identifiable, never crushed to solid black', () => {
    expect(getRoomLightingStyle('night', 100).opacity).toBeLessThan(1)
    expect(getRoomLightingStyle('night', 100).mixBlendMode).toBe('multiply') // scales each pixel's own color down, never flattens to one solid color
  })

  it('clamps an out-of-range or non-finite intensity defensively', () => {
    expect(getRoomLightingStyle('night', 150).opacity).toBeCloseTo(ROOM_LIGHTING_TINTS.night.baseOpacity, 5)
    expect(getRoomLightingStyle('night', -20).opacity).toBe(0)
    expect(getRoomLightingStyle('night', Number.NaN).opacity).toBe(0)
  })
})

describe('roomLightingSettingsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useRoomLightingSettingsStore.setState({ enabled: false, intensity: DEFAULT_ROOM_LIGHTING_INTENSITY })
  })

  it('defaults to off, at a sensible default intensity', () => {
    expect(useRoomLightingSettingsStore.getState().enabled).toBe(false)
    expect(useRoomLightingSettingsStore.getState().intensity).toBe(DEFAULT_ROOM_LIGHTING_INTENSITY)
  })

  it('setEnabled/setIntensity update state, and setIntensity clamps to [0, 100]', () => {
    useRoomLightingSettingsStore.getState().setEnabled(true)
    expect(useRoomLightingSettingsStore.getState().enabled).toBe(true)

    useRoomLightingSettingsStore.getState().setIntensity(150)
    expect(useRoomLightingSettingsStore.getState().intensity).toBe(100)
    useRoomLightingSettingsStore.getState().setIntensity(-30)
    expect(useRoomLightingSettingsStore.getState().intensity).toBe(0)
    useRoomLightingSettingsStore.getState().setIntensity(45)
    expect(useRoomLightingSettingsStore.getState().intensity).toBe(45)
  })

  it('persists to its own localStorage key, separate from every other setting', () => {
    useRoomLightingSettingsStore.getState().setEnabled(true)
    useRoomLightingSettingsStore.getState().setIntensity(55)
    const saved = localStorage.getItem('dearly-room-lighting')
    expect(saved).toContain('"enabled":true')
    expect(saved).toContain('"intensity":55')
  })

  it('rehydrates a saved value correctly, and falls back to safe defaults for corrupt data', async () => {
    localStorage.setItem('dearly-room-lighting', JSON.stringify({ state: { enabled: true, intensity: 33 }, version: 0 }))
    await useRoomLightingSettingsStore.persist.rehydrate()
    expect(useRoomLightingSettingsStore.getState().enabled).toBe(true)
    expect(useRoomLightingSettingsStore.getState().intensity).toBe(33)

    localStorage.setItem('dearly-room-lighting', JSON.stringify({ state: { enabled: 'yes', intensity: 'bright' }, version: 0 }))
    await useRoomLightingSettingsStore.persist.rehydrate()
    expect(useRoomLightingSettingsStore.getState().enabled).toBe(false)
    expect(useRoomLightingSettingsStore.getState().intensity).toBe(DEFAULT_ROOM_LIGHTING_INTENSITY)
  })
})
