import { isInteractableFurniture } from '../simulation/furnitureInteractionEngine'
import { getDefaultColorway } from './colorways'
import { FURNITURE_CATALOG } from './furnitureCatalog'
import { getActiveDecorateRoom, useHomeStore } from './homeStore'
import { FurnitureIcon } from './illustrations'
import { defaultPlacementPosition } from './placementDefaults'
import type { FurnitureCategory, FurnitureDefinition } from './types'

const CATEGORY_LABEL: Record<FurnitureCategory, string> = {
  living: '거실',
  bedroom: '침실',
  kitchen: '주방',
  study: '서재',
  storage: '수납',
  lighting: '조명',
  decor: '장식',
  windowRug: '창문·러그',
}

const CATEGORY_ORDER: FurnitureCategory[] = ['living', 'bedroom', 'kitchen', 'study', 'storage', 'lighting', 'decor', 'windowRug']

export function FurnitureCatalog() {
  const furniture = useHomeStore((state) => getActiveDecorateRoom(state).furniture)
  const addFurniture = useHomeStore((state) => state.addFurniture)
  const selectFurniture = useHomeStore((state) => state.selectFurniture)

  function handleAdd(item: FurnitureDefinition) {
    const { x, y } = defaultPlacementPosition(item, furniture)
    const id = crypto.randomUUID()
    addFurniture({
      id,
      furnitureId: item.id,
      x,
      y,
      scale: 1,
      rotation: 0,
      colorway: getDefaultColorway(item.id),
      layer: furniture.length,
    })
    selectFurniture(id)
  }

  return (
    <div className="furniture-catalog">
      {CATEGORY_ORDER.map((category) => {
        const items = FURNITURE_CATALOG.filter((item) => item.category === category)
        if (items.length === 0) return null

        return (
          <section key={category} className="furniture-catalog-group">
            <h3>{CATEGORY_LABEL[category]}</h3>
            <div className="furniture-catalog-grid">
              {items.map((item) => (
                <article key={item.id} className="furniture-card">
                  <div className="furniture-card-preview">
                    <FurnitureIcon furnitureId={item.id} width={item.width} height={item.height} colorway={getDefaultColorway(item.id)} />
                    {isInteractableFurniture(item.id) && (
                      <span className="furniture-card-badge" title="캐릭터가 사용할 수 있는 가구예요">
                        사용 가능
                      </span>
                    )}
                  </div>
                  <div className="furniture-card-name">{item.name}</div>
                  <div className="furniture-card-type">{CATEGORY_LABEL[item.category]}</div>
                  <button type="button" onClick={() => handleAdd(item)}>
                    + 배치
                  </button>
                </article>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
