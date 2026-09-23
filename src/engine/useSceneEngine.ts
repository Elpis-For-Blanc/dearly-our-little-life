import { useEffect, useRef, useState } from 'react'
import { SceneEngine } from './SceneEngine'

/**
 * Mounts a SceneEngine into a container div for the lifetime of the
 * component and tears it down on unmount. Returned refs let callers reach
 * into the engine imperatively (e.g. to export a PNG) without re-rendering.
 *
 * `ready` flips to true only after `SceneEngine.mount` resolves — the
 * underlying PIXI.Application isn't safe to use (e.g. `app.screen`) until
 * then, so callers that touch the engine should gate on it.
 */
export function useSceneEngine() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const engineRef = useRef<SceneEngine | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const engine = new SceneEngine()
    engineRef.current = engine
    let cancelled = false

    void engine.mount(container).then(() => {
      if (cancelled) {
        engine.destroy()
        return
      }
      setReady(true)
    })

    return () => {
      cancelled = true
      setReady(false)
      engine.destroy()
      engineRef.current = null
    }
  }, [])

  return { containerRef, engineRef, ready }
}
