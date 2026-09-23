import { useEffect, useState } from 'react'
import { DecorateStatusBar } from '../features/home/DecorateStatusBar'
import { DecorateToolbar } from '../features/home/DecorateToolbar'
import { DecorPresetPanel } from '../features/home/DecorPresetPanel'
import { FloorEditor } from '../features/home/FloorEditor'
import { FurnitureCatalog } from '../features/home/FurnitureCatalogPanel'
import { FurniturePropertiesPanel } from '../features/home/FurniturePropertiesPanel'
import { useHomeStore } from '../features/home/homeStore'
import { Room } from '../features/home/Room'
import { RoomTabs } from '../features/home/RoomTabs'
import { WallpaperEditor } from '../features/home/WallpaperEditor'
import { evictPlacementUsage } from '../features/simulation/furnitureUsageTrigger'
import './DecorateScreen.css'

type LeftTab = 'furniture' | 'wallpaper' | 'floor' | 'theme'

function isTextInputFocused() {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.getAttribute('contenteditable') === 'true'
}

export function DecorateScreen() {
  const selectedFurnitureId = useHomeStore((state) => state.selectedFurnitureId)
  const removeFurniture = useHomeStore((state) => state.removeFurniture)
  const activeDecorateRoomId = useHomeStore((state) => state.activeDecorateRoomId)
  const setActiveDecorateRoom = useHomeStore((state) => state.setActiveDecorateRoom)
  const [leftTab, setLeftTab] = useState<LeftTab>('furniture')

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Delete') return
      if (isTextInputFocused()) return
      if (!selectedFurnitureId) return
      evictPlacementUsage(selectedFurnitureId)
      removeFurniture(selectedFurnitureId)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedFurnitureId, removeFurniture])

  return (
    <section className="decorate-screen">
      <RoomTabs activeRoomId={activeDecorateRoomId} onSelectRoom={setActiveDecorateRoom} />
      <DecorateStatusBar />
      <div className="decorate-workspace">
        <div className="decorate-panel decorate-panel-catalog">
          <div className="decorate-left-tabs">
            <button type="button" className={leftTab === 'furniture' ? 'active' : ''} onClick={() => setLeftTab('furniture')}>
              가구
            </button>
            <button type="button" className={leftTab === 'wallpaper' ? 'active' : ''} onClick={() => setLeftTab('wallpaper')}>
              벽지
            </button>
            <button type="button" className={leftTab === 'floor' ? 'active' : ''} onClick={() => setLeftTab('floor')}>
              바닥
            </button>
            <button type="button" className={leftTab === 'theme' ? 'active' : ''} onClick={() => setLeftTab('theme')}>
              테마
            </button>
          </div>
          {leftTab === 'furniture' && <FurnitureCatalog />}
          {leftTab === 'wallpaper' && <WallpaperEditor />}
          {leftTab === 'floor' && <FloorEditor />}
          {leftTab === 'theme' && <DecorPresetPanel />}
        </div>
        <Room />
        <div className="decorate-panel decorate-panel-properties">
          <FurniturePropertiesPanel />
        </div>
      </div>
      <DecorateToolbar />
    </section>
  )
}
