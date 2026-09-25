import { ColorSwatchPicker } from './ColorSwatchPicker'
import { FURNITURE_COLOR_GROUPS } from './colorPresets'
import { getActiveDecorateRoom, useHomeStore } from './homeStore'
import { getWallpaperPatternContent } from './patterns/wallpaperPatterns'
import { WALLPAPER_PATTERN_LABELS, WALLPAPER_PATTERN_ORDER } from './roomSurface'

const PREVIEW_TILE = 40

/** Applies immediately — every control here writes straight to homeStore (the active decorate room), which Room.tsx renders reactively. */
export function WallpaperEditor() {
  const wallpaper = useHomeStore((state) => getActiveDecorateRoom(state).wallpaper)
  const setWallpaper = useHomeStore((state) => state.setWallpaper)

  return (
    <div className="surface-editor">
      <h3>벽 색상</h3>
      <ColorSwatchPicker value={wallpaper.baseColor} onChange={(hex) => setWallpaper({ baseColor: hex })} groups={FURNITURE_COLOR_GROUPS} label="벽 색상" />

      <h3>패턴</h3>
      <div className="pattern-grid">
        {WALLPAPER_PATTERN_ORDER.map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={wallpaper.pattern === type}
            className={wallpaper.pattern === type ? 'pattern-swatch pattern-swatch-selected' : 'pattern-swatch'}
            onClick={() => setWallpaper({ pattern: type })}
          >
            <svg viewBox={`0 0 ${PREVIEW_TILE} ${PREVIEW_TILE}`} width="100%" height="100%">
              <rect width={PREVIEW_TILE} height={PREVIEW_TILE} fill={wallpaper.baseColor} />
              {getWallpaperPatternContent(type, PREVIEW_TILE, wallpaper.patternColor)}
            </svg>
            <span>{WALLPAPER_PATTERN_LABELS[type]}</span>
          </button>
        ))}
      </div>

      {wallpaper.pattern !== 'solid' && (
        <>
          <h3>무늬 색상</h3>
          <ColorSwatchPicker value={wallpaper.patternColor} onChange={(hex) => setWallpaper({ patternColor: hex })} groups={FURNITURE_COLOR_GROUPS} label="벽 무늬 색상" />

          <label className="surface-editor-field">
            <span>패턴 크기 ({Math.round(wallpaper.patternScale * 100)}%)</span>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={wallpaper.patternScale}
              onChange={(event) => setWallpaper({ patternScale: Number(event.target.value) })}
            />
          </label>
        </>
      )}
    </div>
  )
}
