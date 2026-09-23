import { SURFACE_COLOR_PRESETS, type ColorPreset, type ColorPresetGroup } from './colorPresets'

interface ColorSwatchPickerProps {
  value: string
  onChange: (hex: string) => void
  /** A flat preset list; defaults to the wallpaper/floor presets. Ignored when `groups` is given. */
  presets?: ColorPreset[]
  /** Presets split into labeled sections (furniture uses this so the long palette stays easy to scan). */
  groups?: ColorPresetGroup[]
  /** Accessible name prefix for the swatches and the free hex picker, so several pickers on one panel stay distinguishable. */
  label?: string
}

/** Shared by wallpaper/floor and furniture color pickers — a preset grid (optionally grouped) plus a free hex picker for anything else. */
export function ColorSwatchPicker({ value, onChange, presets = SURFACE_COLOR_PRESETS, groups, label }: ColorSwatchPickerProps) {
  const selected = value.toLowerCase()

  function renderGrid(list: ColorPreset[]) {
    return (
      <div className="color-swatch-grid">
        {list.map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-label={label ? `${label} ${preset.label}` : preset.label}
            title={preset.label}
            aria-pressed={selected === preset.hex.toLowerCase()}
            className={selected === preset.hex.toLowerCase() ? 'color-swatch color-swatch-selected' : 'color-swatch'}
            style={{ backgroundColor: preset.hex }}
            onClick={() => onChange(preset.hex)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="color-swatch-picker">
      {groups
        ? groups.map((group) => (
            <div key={group.id} className="color-swatch-group" role="group" aria-label={label ? `${label} ${group.label}` : group.label}>
              <span className="color-swatch-group-label">{group.label}</span>
              {renderGrid(group.presets)}
            </div>
          ))
        : renderGrid(presets)}
      <label className="color-swatch-custom">
        <span>직접 선택</span>
        <input type="color" aria-label={label ? `${label} 직접 선택` : undefined} value={value} onChange={(event) => onChange(event.target.value)} />
      </label>
    </div>
  )
}
