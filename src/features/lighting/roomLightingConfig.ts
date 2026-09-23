import type { TimeBand } from '../bgm/bgmConfig'

/**
 * Time-of-day room lighting — a purely visual overlay layered on top of the
 * existing room rendering (`Room.tsx`/`LiveRoomView.tsx`), never touching
 * wallpaper/floor/furniture color data itself. See `RoomLightingOverlay.tsx`
 * for the rendering side.
 *
 * **Reuses the BGM feature's existing time band, per the spec's own "조명과
 * BGM은 반드시 동일한 시간 기준을 사용해야" instruction** — `TimeBand` and
 * its exact hour boundaries (아침 05-10, 낮 11-16, 저녁 17-20, 밤 21-04) come
 * from `bgm/bgmConfig.ts`/`bgm/timeBand.ts`, not redefined here. A separate
 * band system with the spec's own fallback boundaries (06-10:59/…) was
 * *not* built, because a real, existing one already covers this exact need
 * — see the spec's own "기존 시간대 구간이 있다면 그 구간을 우선 사용".
 */
export interface RoomLightingTint {
  /** The overlay's blend color. */
  color: string
  /**
   * Opacity (0-1) applied when the user's own intensity setting is at its
   * maximum (100%) — see `roomLightingEngine.ts`'s `getRoomLightingStyle`
   * for how the user's 0-100% setting scales this down. `daytime` is 0: "낮
   * 11:00~16:59: 원래 색감에 가까운 밝기" is implemented literally — no tint
   * at all — rather than an arbitrarily-small nonzero value.
   */
  baseOpacity: number
  /**
   * `'multiply'` genuinely darkens the room underneath (used for the two
   * bands that should look dimmer, evening and night) while still letting
   * each pixel's own color show through proportionally — this is what
   * keeps furniture shapes/colors identifiable even at night's higher
   * opacity, rather than crushing everything toward a flat, undifferentiated
   * color the way a solid black scrim would. `'soft-light'` adds a warm
   * color cast without meaningfully darkening (morning's soft sunlight).
   * `'normal'` (daytime, at opacity 0) is inert either way.
   */
  blendMode: 'multiply' | 'soft-light' | 'normal'
}

export const ROOM_LIGHTING_TINTS: Record<TimeBand, RoomLightingTint> = {
  morning: { color: '#FFCB8E', baseOpacity: 0.22, blendMode: 'soft-light' }, // 따뜻하고 부드러운 햇살
  daytime: { color: '#FFFFFF', baseOpacity: 0, blendMode: 'normal' }, // 원래 색감에 가까운 밝기
  evening: { color: '#FF8F6B', baseOpacity: 0.28, blendMode: 'multiply' }, // 은은한 분홍·주황빛 노을
  night: { color: '#232A52', baseOpacity: 0.58, blendMode: 'multiply' }, // 차분한 남보라·남색 조명
}

export const DEFAULT_ROOM_LIGHTING_INTENSITY = 70

/** How long a band-to-band (or on/off, or intensity) change takes to visually settle — a CSS `transition` duration, not a JS interpolation loop, so "부드러운 변화" costs zero extra JS work per frame. */
export const ROOM_LIGHTING_TRANSITION_MS = 900
