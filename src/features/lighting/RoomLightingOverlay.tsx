import type { CSSProperties } from 'react'
import { useBgmStore } from '../bgm/bgmStore'
import { getCurrentHour, getTimeBand } from '../bgm/timeBand'
import { getRoomLightingStyle } from './roomLightingEngine'
import { useRoomLightingSettingsStore } from './roomLightingSettingsStore'
import './RoomLightingOverlay.css'

/**
 * The one shared "independent visual effect layer" mounted as the very last
 * child of both `Room.tsx` (decorate) and `LiveRoomView.tsx` (live) — see
 * each of their own render trees. Renders **nothing at all** (`null`, no
 * DOM node) while the setting is off, which is what makes "조명을 꺼도" and
 * "기본값은 꺼짐" cost precisely zero — no invisible-but-present overlay
 * div, no wasted style computation.
 *
 * **Time source**: reads `bgmStore`'s `currentBand` — the *exact* shared
 * value `useBgmController.ts`'s own periodic real-clock hour-check (see
 * `BGM_HOUR_CHECK_INTERVAL_MS`) already keeps current, mounted once in
 * `App.tsx` for the whole app session. This is what satisfies both "조명과
 * BGM은 반드시 동일한 시간 기준을 사용해야" (literally the same value, not
 * two independently-ticked copies) and "조명만을 위한 불필요한 반복 타이머는
 * 만들지 마" (zero timers of this component's own — it's a plain reactive
 * selector that re-renders only when that shared value, or this component's
 * own settings, actually change). Falls back to a direct
 * `getTimeBand(getCurrentHour())` computation only for the brief instant
 * before `useBgmController`'s first effect has run (`currentBand` starts
 * `null`) — converges to the shared value immediately after.
 *
 * **Scope**: mounted only inside the room's own container
 * (`.room`/`.live-room`), never at the app or `<body>` level — this is what
 * makes "기존 연분홍 UI와 대화창은 어두워지지 않아야" and "전체 앱에 CSS
 * filter를 적용하지 마" hold structurally, not by convention. `pointer-
 * events: none` (RoomLightingOverlay.css) guarantees it can never intercept
 * a click/drag/keyboard event meant for furniture underneath it, satisfying
 * "조명 레이어는 클릭·드래그·선택 이벤트 차단 금지" the same way. It touches
 * no wallpaper/floor/furniture color data at all — a color overlay
 * `<div>` painted on top, nothing more — so furniture's own shadows,
 * outlines, and patterns (drawn inside each furniture SVG) are completely
 * unaffected underneath it.
 */
export function RoomLightingOverlay() {
  const enabled = useRoomLightingSettingsStore((state) => state.enabled)
  const intensity = useRoomLightingSettingsStore((state) => state.intensity)
  const sharedBand = useBgmStore((state) => state.currentBand)

  if (!enabled) return null

  const band = sharedBand ?? getTimeBand(getCurrentHour())
  const style = getRoomLightingStyle(band, intensity)

  return (
    <div
      className="room-lighting-overlay"
      aria-hidden="true"
      style={{ backgroundColor: style.backgroundColor, opacity: style.opacity, mixBlendMode: style.mixBlendMode } as CSSProperties}
    />
  )
}
