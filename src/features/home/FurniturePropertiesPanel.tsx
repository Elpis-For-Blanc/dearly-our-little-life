import { evictPlacementUsage } from '../simulation/furnitureUsageTrigger'
import { getColorwayOptions } from './colorways'
import { getFurnitureDefinition, getFurnitureSize } from './furnitureCatalog'
import { clampFurniturePlacement } from './furniturePlacementEngine'
import { getActiveDecorateRoom, useHomeStore } from './homeStore'
import { FurnitureStyleEditor } from './FurnitureStyleEditor'
import { FurnitureIcon } from './illustrations'

export function FurniturePropertiesPanel() {
  const selectedId = useHomeStore((state) => state.selectedFurnitureId)
  const placement = useHomeStore((state) => getActiveDecorateRoom(state).furniture.find((f) => f.id === selectedId))
  const moveFurniture = useHomeStore((state) => state.moveFurniture)
  const updateFurniture = useHomeStore((state) => state.updateFurniture)
  const removeFurniture = useHomeStore((state) => state.removeFurniture)
  const bringToFront = useHomeStore((state) => state.bringToFront)
  const sendToBack = useHomeStore((state) => state.sendToBack)

  if (!placement) {
    return (
      <aside className="furniture-properties furniture-properties-empty">
        <p>가구를 선택하면 편집할 수 있어요.</p>
      </aside>
    )
  }

  const definition = getFurnitureDefinition(placement.furnitureId)
  const colorwayOptions = getColorwayOptions(placement.furnitureId)
  // The drawn size follows the chosen shape (a circle rug is not the size of an oval one).
  const size = getFurnitureSize(definition, placement.variant)

  // Position, scale, and variant all move/resize the piece's interaction slots along with it — evict whoever's
  // approaching/seated on it before any of these apply, so nobody ends up walking toward (or seated at) a stale
  // position (see furnitureUsageTrigger.ts). Colorway/style edits never touch geometry, so they don't evict.
  function handlePositionChange(axis: 'x' | 'y', value: number) {
    if (!definition) return
    const effectiveWidth = size.width * placement!.scale
    const effectiveHeight = size.height * placement!.scale
    const nextX = axis === 'x' ? value : placement!.x
    const nextY = axis === 'y' ? value : placement!.y
    const clamped = clampFurniturePlacement(definition, nextX, nextY, effectiveWidth, effectiveHeight)
    evictPlacementUsage(placement!.id)
    moveFurniture(placement!.id, clamped.x, clamped.y)
  }

  function handleScaleChange(scale: number) {
    if (!definition) return
    evictPlacementUsage(placement!.id)
    updateFurniture(placement!.id, { scale })
    const clamped = clampFurniturePlacement(definition, placement!.x, placement!.y, size.width * scale, size.height * scale)
    if (clamped.x !== placement!.x || clamped.y !== placement!.y) {
      moveFurniture(placement!.id, clamped.x, clamped.y)
    }
  }

  function handleVariantChange(variantId: string) {
    if (!definition) return
    evictPlacementUsage(placement!.id)
    updateFurniture(placement!.id, { variant: variantId })
    // A different shape has a different footprint — keep it fully inside the room (and, for a solid floor piece, keep its bottom edge on the floor's own surface).
    const next = getFurnitureSize(definition, variantId)
    const clamped = clampFurniturePlacement(definition, placement!.x, placement!.y, next.width * placement!.scale, next.height * placement!.scale)
    if (clamped.x !== placement!.x || clamped.y !== placement!.y) {
      moveFurniture(placement!.id, clamped.x, clamped.y)
    }
  }

  return (
    <aside className="furniture-properties">
      <div className="furniture-properties-header">
        <div className="furniture-properties-preview">
          <FurnitureIcon
            furnitureId={placement.furnitureId}
            width={size.width}
            height={size.height}
            colorway={placement.colorway}
            variant={placement.variant}
            colors={placement.colors}
            patterns={placement.patterns}
          />
        </div>
        <div>
          <h3>{definition?.name ?? placement.furnitureId}</h3>
          <span className="furniture-properties-hint">선택됨</span>
        </div>
      </div>

      <label className="furniture-properties-field">
        <span>X 좌표</span>
        <input
          type="number"
          value={Math.round(placement.x)}
          onChange={(event) => handlePositionChange('x', Number(event.target.value))}
        />
      </label>

      <label className="furniture-properties-field">
        <span>Y 좌표</span>
        <input
          type="number"
          value={Math.round(placement.y)}
          onChange={(event) => handlePositionChange('y', Number(event.target.value))}
        />
      </label>

      {definition && (
        <label className="furniture-properties-field">
          <span>크기 ({Math.round(placement.scale * 100)}%)</span>
          <input
            type="range"
            min={definition.minScale}
            max={definition.maxScale}
            step={0.05}
            value={placement.scale}
            onChange={(event) => handleScaleChange(Number(event.target.value))}
          />
        </label>
      )}

      <div className="furniture-properties-field">
        <span>방향</span>
        <button
          type="button"
          className="furniture-properties-toggle"
          onClick={() => {
            evictPlacementUsage(placement!.id)
            updateFurniture(placement!.id, { rotation: placement!.rotation === 180 ? 0 : 180 })
          }}
        >
          {placement.rotation === 180 ? '좌우 반전됨' : '기본 방향'}
        </button>
      </div>

      {definition?.variants && definition.variants.length > 1 && (
        <div className="furniture-properties-field">
          <span>모양</span>
          <div className="furniture-style-tabs" role="group" aria-label={`${definition.name} 모양`}>
            {definition.variants.map((variant) => {
              const active = (placement.variant ?? definition.variants![0].id) === variant.id
              return (
                <button
                  key={variant.id}
                  type="button"
                  className={active ? 'furniture-style-tab furniture-style-tab-active' : 'furniture-style-tab'}
                  aria-pressed={active}
                  onClick={() => handleVariantChange(variant.id)}
                >
                  {variant.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {colorwayOptions.length > 0 && (
        <div className="furniture-properties-field">
          <span>색상</span>
          <div className="furniture-properties-swatches">
            {colorwayOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-label={option.label}
                aria-pressed={option.id === placement.colorway}
                className={option.id === placement.colorway ? 'swatch swatch-selected' : 'swatch'}
                style={{ backgroundColor: option.swatch }}
                onClick={() => updateFurniture(placement!.id, { colorway: option.id })}
              />
            ))}
          </div>
        </div>
      )}

      {definition && (
        <FurnitureStyleEditor
          key={placement.id}
          placement={placement}
          definition={definition}
          onChange={(patch) => updateFurniture(placement!.id, patch)}
        />
      )}

      <div className="furniture-properties-field">
        <span>레이어 순서</span>
        <div className="furniture-properties-layer-buttons">
          <button type="button" onClick={() => sendToBack(placement!.id)}>
            뒤로
          </button>
          <button type="button" onClick={() => bringToFront(placement!.id)}>
            앞으로
          </button>
        </div>
      </div>

      <button
        type="button"
        className="furniture-properties-delete"
        onClick={() => {
          evictPlacementUsage(placement!.id)
          removeFurniture(placement!.id)
        }}
      >
        삭제
      </button>
    </aside>
  )
}
