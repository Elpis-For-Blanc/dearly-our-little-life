import type { Application } from 'pixi.js'

/** Renders the current stage to a PNG and triggers a browser download. */
export function captureScenePng(app: Application, filename = 'dearly-our-little-home.png') {
  const canvas = app.renderer.extract.canvas(app.stage) as HTMLCanvasElement
  const dataUrl = canvas.toDataURL('image/png')

  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  link.click()
}
