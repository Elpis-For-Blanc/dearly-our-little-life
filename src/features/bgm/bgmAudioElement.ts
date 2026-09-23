import { BGM_FADE_MS, BGM_FADE_STEP_MS } from './bgmConfig'

/**
 * The one and only `<audio>` element this app ever creates. Module-scoped
 * (not created inside a component or hook body), so it's constructed
 * exactly once when this module first loads and survives every re-render,
 * every phase/room switch, and — critically — React StrictMode's dev-mode
 * double mount/unmount/mount of the whole tree, which would otherwise risk
 * a second `Audio()` instance and two overlapping playbacks if this lived
 * inside `useBgmController.ts`'s hook body instead. Nothing outside this
 * file should ever call `new Audio()` for BGM purposes.
 */
export const bgmAudioElement: HTMLAudioElement = new Audio()
bgmAudioElement.preload = 'auto'

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/**
 * Bumped every time a fade starts or is explicitly cancelled — an in-flight
 * fade checks its own captured token against this before each step, and
 * simply stops (never rejects, never fights back) the moment it no longer
 * matches. This is what stops an old fade-out from clobbering a newer
 * fade-in's volume after the user rapidly pauses, changes time bands, or
 * skips tracks mid-fade (spec: 이전 전환 작업이 남아서 음악이 중복 재생되지 않도록).
 */
let fadeToken = 0

/** Invalidates any in-flight fade without touching the current volume — call this right before any authoritative, immediate volume/track change. */
export function cancelFade(): void {
  fadeToken += 1
}

/** Smoothly ramps the element's volume to `target` (0-1) over `durationMs`. Resolves once finished OR once superseded by a newer fade/cancelFade() — callers awaiting it don't need to know which. */
export function fadeVolumeTo(target: number, durationMs: number = BGM_FADE_MS): Promise<void> {
  const token = ++fadeToken
  const start = bgmAudioElement.volume
  const clampedTarget = clamp01(target)
  const steps = Math.max(1, Math.round(durationMs / BGM_FADE_STEP_MS))
  let step = 0

  return new Promise((resolve) => {
    function tick() {
      if (fadeToken !== token) {
        resolve()
        return
      }
      step += 1
      const progress = step / steps
      bgmAudioElement.volume = clamp01(start + (clampedTarget - start) * progress)
      if (progress >= 1) {
        resolve()
        return
      }
      setTimeout(tick, BGM_FADE_STEP_MS)
    }
    tick()
  })
}

/** Swaps the element's source to `url` and resets playback position to the start — always cancels any in-flight fade first, since a stale fade adjusting volume for the *old* track makes no sense once the source has changed. */
export function loadTrack(url: string): void {
  cancelFade()
  bgmAudioElement.src = url
  bgmAudioElement.currentTime = 0
  bgmAudioElement.load()
}

export type PlayAttemptResult = { ok: true } | { ok: false; errorName: string }

/**
 * Attempts to start playback. Never retried automatically by this function
 * or any caller — a rejected attempt (browser autoplay policy, a decode
 * failure, the file not existing) is reported back once and left to the
 * user to retry via the play button, per the spec's "무한 재시도 금지".
 */
export async function playAudio(): Promise<PlayAttemptResult> {
  try {
    await bgmAudioElement.play()
    return { ok: true }
  } catch (error) {
    const errorName = error instanceof DOMException ? error.name : 'UnknownError'
    return { ok: false, errorName }
  }
}

export function pauseAudio(): void {
  cancelFade()
  bgmAudioElement.pause()
}

/** Immediate (non-fading) effective-volume set — used for volume-slider/mute-toggle changes, which should feel instant, not fade. */
export function setVolumeImmediate(volume: number): void {
  cancelFade()
  bgmAudioElement.volume = clamp01(volume)
}
