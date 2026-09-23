import { bgmActions } from './bgmActions'
import { BGM_TRACKS } from './bgmConfig'
import { useBgmStore } from './bgmStore'
import { TIME_BAND_LABELS } from './timeBand'
import './BgmPlayer.css'

/**
 * Small fixed player bar, mounted once in `App.tsx` alongside
 * `useBgmController()` — every control here is a thin wrapper around
 * `bgmActions`/`useBgmStore`; no audio logic lives in this component.
 */
export function BgmPlayer() {
  const isPlaying = useBgmStore((state) => state.isPlaying)
  const currentBand = useBgmStore((state) => state.currentBand)
  const currentTrackId = useBgmStore((state) => state.currentTrackId)
  const volume = useBgmStore((state) => state.volume)
  const muted = useBgmStore((state) => state.muted)
  const bgmEnabled = useBgmStore((state) => state.bgmEnabled)
  const loopEnabled = useBgmStore((state) => state.loopEnabled)
  const errorMessage = useBgmStore((state) => state.errorMessage)

  const currentTrack = BGM_TRACKS.find((t) => t.id === currentTrackId) ?? null
  const hasTrack = currentTrack !== null

  return (
    <footer className="bgm-player" aria-label="배경음악 플레이어">
      <div className="bgm-player-info">
        <span className="bgm-player-band">{currentBand ? TIME_BAND_LABELS[currentBand] : ''}</span>
        <span className="bgm-player-title">
          {hasTrack ? currentTrack.title : '등록된 음악이 없어요'}
        </span>
        {errorMessage && <span className="bgm-player-error">{errorMessage}</span>}
      </div>

      <div className="bgm-player-controls">
        <button type="button" onClick={() => void bgmActions.previous()} disabled={!bgmEnabled || !hasTrack} aria-label="이전 곡">
          ⏮
        </button>
        <button
          type="button"
          className="bgm-player-play"
          onClick={() => (isPlaying ? bgmActions.pause() : void bgmActions.play())}
          disabled={!bgmEnabled || !hasTrack}
          aria-label={isPlaying ? '일시정지' : '재생'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button type="button" onClick={() => void bgmActions.next()} disabled={!bgmEnabled || !hasTrack} aria-label="다음 곡">
          ⏭
        </button>
      </div>

      <div className="bgm-player-volume">
        <button type="button" onClick={() => bgmActions.toggleMuted()} aria-label={muted ? '음소거 해제' : '음소거'}>
          {muted ? '🔇' : '🔊'}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(event) => bgmActions.setVolume(Number(event.target.value))}
          aria-label="볼륨"
        />
      </div>

      <div className="bgm-player-toggles">
        <button
          type="button"
          className={loopEnabled ? 'bgm-player-toggle active' : 'bgm-player-toggle'}
          onClick={() => bgmActions.toggleLoopEnabled()}
          aria-pressed={loopEnabled}
          title="반복 재생"
        >
          🔁
        </button>
        <button
          type="button"
          className={bgmEnabled ? 'bgm-player-toggle active' : 'bgm-player-toggle'}
          onClick={() => bgmActions.toggleBgmEnabled()}
          aria-pressed={bgmEnabled}
        >
          {bgmEnabled ? 'BGM 켜짐' : 'BGM 꺼짐'}
        </button>
      </div>
    </footer>
  )
}
