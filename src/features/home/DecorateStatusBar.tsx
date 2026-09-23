import { getActiveDecorateRoom, useHomeStore } from './homeStore'

export function DecorateStatusBar() {
  const roomName = useHomeStore((state) => getActiveDecorateRoom(state).name)
  const furnitureCount = useHomeStore((state) => getActiveDecorateRoom(state).furniture.length)

  return (
    <div className="decorate-status-bar">
      <div className="decorate-status-room">
        <span className="decorate-status-room-name">{roomName}</span>
      </div>
      <div className="decorate-status-meta">
        <span>가구 {furnitureCount}개</span>
        <span className="decorate-status-saved">자동 저장됨</span>
      </div>
    </div>
  )
}
