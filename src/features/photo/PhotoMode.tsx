import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { LiveRoomView } from '../simulation/LiveRoomView'
import { useSimulationStore } from '../simulation/simulationStore'
import { captureElementPng, makePhotoFilename } from './captureElementPng'
import './PhotoMode.css'

interface PhotoModeProps {
  onClose: () => void
}

export function PhotoMode({ onClose }: PhotoModeProps) {
  const isRunning = useSimulationStore((state) => state.isRunning)
  const pause = useSimulationStore((state) => state.pause)
  const start = useSimulationStore((state) => state.start)
  const wasRunningRef = useRef(isRunning)
  const stageRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; x: number; y: number; startX: number; startY: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    pause()
    return () => {
      if (wasRunningRef.current) start()
    }
  }, [pause, start])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function changeZoom(next: number) {
    setZoom(Math.min(2, Math.max(0.75, Number(next.toFixed(2)))))
  }

  function resetCamera() {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, startX: offset.x, startY: offset.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setOffset({ x: drag.startX + event.clientX - drag.x, y: drag.startY + event.clientY - drag.y })
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  async function handleCapture() {
    if (!stageRef.current || isSaving) return
    setMessage(null)
    setIsSaving(true)
    try {
      await captureElementPng(stageRef.current, makePhotoFilename())
      setMessage('PNG로 저장했어요.')
    } catch (error) {
      console.error('[DEARLY photo] PNG capture failed:', error)
      setMessage(error instanceof Error ? error.message : '이미지를 저장하지 못했어요. 다시 시도해 주세요.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className={`photo-mode${isSaving ? ' photo-mode--capturing' : ''}`} role="dialog" aria-modal="true" aria-label="스크린샷 모드">
      <div className="photo-mode-topbar">
        <strong>📷 스크린샷 모드</strong>
        <span>드래그와 확대/축소로 구도를 잡을 수 있어요. 저장할 때 현재 DEARLY 탭을 선택해 주세요.</span>
        <button type="button" onClick={onClose} aria-label="스크린샷 모드 나가기">나가기</button>
      </div>

      <div
        ref={stageRef}
        className="photo-mode-stage"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="photo-mode-camera"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
        >
          <LiveRoomView />
        </div>
      </div>

      <div className="photo-mode-controls" data-photo-ui="true">
        <button type="button" onClick={() => changeZoom(zoom - 0.1)} aria-label="축소">−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => changeZoom(zoom + 0.1)} aria-label="확대">＋</button>
        <button type="button" onClick={resetCamera}>구도 초기화</button>
        <button type="button" className="photo-mode-capture" onClick={() => void handleCapture()} disabled={isSaving}>
          {isSaving ? '저장 중…' : '📷 PNG 저장'}
        </button>
        {message && <span className="photo-mode-message" role="status">{message}</span>}
      </div>
    </div>
  )
}
