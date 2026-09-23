

/**
 * The four real-clock time bands BGM is organized around — see
 * `timeBand.ts`'s `getTimeBand()` for the exact hour boundaries. `'common'`
 * is not a real time band; it's the fallback bucket a track can be assigned
 * to so it plays whenever the current band has no track of its own (see
 * `bgmPlaylist.ts`).
 */
export type TimeBand = 'morning' | 'daytime' | 'evening' | 'night'
export type TrackBand = TimeBand | 'common'

/**
 * One producer-registered track. This app has no music-upload feature for
 * end users — every entry here corresponds to an MP3 the producer placed in
 * `public/music/` by hand (see the project README's "BGM 등록 방법" section).
 * Editing this array is the *only* thing needed to add, remove, reorder, or
 * retire a track — nothing in the player/controller code ever needs to
 * change for that.
 */
export interface BgmTrackDef {
  /** Stable, unique id — used for recent-track bookkeeping and React keys, never shown to the listener. */
  id: string
  /** Shown in the player UI. */
  title: string
  /** Just the filename inside `public/music/` (e.g. `'morning.mp3'`) — never a full path or URL; see `resolveMusicUrl()`. */
  fileName: string
  /** Which time band this track plays for, or `'common'` to act as a fallback for any band with no track of its own. */
  band: TrackBand
  /** Playback order among other *enabled* tracks sharing the same `band` — ties broken by array order. Does not need to be contiguous. */
  order: number
  /** Set to `false` to retire a track without deleting its entry (e.g. while swapping in a replacement file). */
  enabled: boolean
}

/**
 * Empty by design — this project ships with no bundled music. The producer
 * fills this in (and drops the matching MP3s into `public/music/`) when
 * real tracks exist; every part of the BGM system already handles an empty
 * list safely (see `bgmPlaylist.ts`/`BgmPlayer.tsx`: "등록된 음악이 없어요",
 * playback stays off, nothing throws). Do not download or bundle placeholder
 * music — the spec is explicit that only the producer's own files belong here.
 *
 * Example shape, once real files exist:
 * ```
 * { id: 'morning-1', title: '아침 산책', fileName: 'morning.mp3', band: 'morning', order: 0, enabled: true },
 * ```
 */
export const BGM_TRACKS: BgmTrackDef[] = [
  {
    id: 'morning',
    title: '아침의 음악',
    fileName: 'morning.mp3',
    band: 'morning',
    order: 1,
    enabled: true,
  },
  {
    id: 'day',
    title: '낮의 음악',
    fileName: 'day.mp3',
    band: 'daytime',
    order: 1,
    enabled: true,
  },
  {
    id: 'evening',
    title: '저녁의 음악',
    fileName: 'evening.mp3',
    band: 'evening',
    order: 1,
    enabled: true,
  },
  {
    id: 'night',
    title: '밤의 음악',
    fileName: 'night.mp3',
    band: 'night',
    order: 1,
    enabled: true,
  },
]

/**
 * Resolves a `public/music/`-relative filename to a URL that works both in
 * dev and after a build to a non-root `base` path (see `vite.config.ts` —
 * `base` isn't set yet, per CLAUDE.md, but this stays correct once it is).
 * `import.meta.env.BASE_URL` is Vite's own answer to "what's the app's root
 * URL right now", so this needs no separate configuration of its own.
 */
export function resolveMusicUrl(fileName: string): string {
  return `${import.meta.env.BASE_URL}music/${fileName}`
}

/** How often the controller re-checks the real-clock hour for a time-band change. Band transitions only ever happen on the hour, so this doesn't need to be tighter than a minute. */
export const BGM_HOUR_CHECK_INTERVAL_MS = 60_000

/** Fade duration for both the outgoing and incoming track when switching. */
export const BGM_FADE_MS = 900
/** How often the fade adjusts volume — small enough to sound smooth, large enough to not be wasteful. */
export const BGM_FADE_STEP_MS = 50
