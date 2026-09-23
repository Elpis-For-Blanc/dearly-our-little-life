import { Application, Container } from 'pixi.js'

/**
 * Owns the PixiJS Application and the root scene graph. This is the
 * imperative rendering layer — it is deliberately framework-agnostic and
 * never re-created on React re-renders. React only tells it what changed
 * via store subscriptions (see useSceneEngine.ts).
 */
export class SceneEngine {
  readonly app: Application
  readonly homeLayer: Container
  readonly characterLayer: Container
  private mounted = false

  constructor() {
    this.app = new Application()
    this.homeLayer = new Container()
    this.characterLayer = new Container()
  }

  async mount(container: HTMLElement) {
    if (this.mounted) return

    await this.app.init({
      resizeTo: container,
      background: '#dfe9ff',
      antialias: true,
    })

    this.app.stage.addChild(this.homeLayer, this.characterLayer)
    container.appendChild(this.app.canvas)
    this.mounted = true
  }

  destroy() {
    if (!this.mounted) return
    this.app.destroy(true, { children: true, texture: true })
    this.mounted = false
  }
}
