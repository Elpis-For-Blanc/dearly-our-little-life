import { useUiStore, type AppPhase } from './uiStore'
import { BgmPlayer } from '../features/bgm/BgmPlayer'
import { useBgmController } from '../features/bgm/useBgmController'
import { SetupScreen } from './SetupScreen'
import { DecorateScreen } from './DecorateScreen'
import { LiveScreen } from './LiveScreen'
import './App.css'

const PHASES: AppPhase[] = ['setup', 'decorate', 'live']

const PHASE_LABEL: Record<AppPhase, string> = {
  setup: '캐릭터 설정',
  decorate: '집 꾸미기',
  live: '함께 생활하기',
}

function App() {
  const phase = useUiStore((state) => state.phase)
  const setPhase = useUiStore((state) => state.setPhase)

  // Mounted here, in the one layout component every phase/room switch leaves
  // untouched, so the BGM system's hour-check timer and its single shared
  // <audio> element (module-scoped — see bgmAudioElement.ts) live for the
  // whole app session, never per-screen. Never starts playback itself.
  useBgmController()

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-title">
          <h1>디어리 — 우리의 작은 집</h1>
          <p className="app-header-subtitle">저마다의 하루가 모여 완성되는 작은 집.</p>
        </div>
        <nav className="phase-nav">
          {PHASES.map((p) => (
            <button
              key={p}
              type="button"
              className={p === phase ? 'active' : ''}
              onClick={() => setPhase(p)}
            >
              {PHASE_LABEL[p]}
            </button>
          ))}
        </nav>
      </header>
      <main className="app-main">
        {phase === 'setup' && <SetupScreen />}
        {phase === 'decorate' && <DecorateScreen />}
        {phase === 'live' && <LiveScreen />}
      </main>
      <BgmPlayer />
    </div>
  )
}

export default App
