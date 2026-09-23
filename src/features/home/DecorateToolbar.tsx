import { getActiveDecorateRoom, useHomeStore } from './homeStore'

export function DecorateToolbar() {
  const selectedId = useHomeStore((state) => state.selectedFurnitureId)
  const furnitureCount = useHomeStore((state) => getActiveDecorateRoom(state).furniture.length)
  const selectFurniture = useHomeStore((state) => state.selectFurniture)
  const resetLayout = useHomeStore((state) => state.resetLayout)

  function handleReset() {
    if (furnitureCount === 0) return
    const confirmed = window.confirm('배치한 가구를 모두 초기화할까요? 이 작업은 되돌릴 수 없어요.')
    if (confirmed) resetLayout()
  }

  return (
    <div className="decorate-toolbar">
      <button type="button" onClick={() => selectFurniture(null)} disabled={!selectedId}>
        선택 해제
      </button>
      <button type="button" onClick={handleReset} disabled={furnitureCount === 0} className="decorate-toolbar-danger">
        배치 초기화
      </button>
      <span className="decorate-status-saved">변경 사항은 자동으로 저장돼요.</span>
    </div>
  )
}
