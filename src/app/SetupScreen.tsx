import { CharacterForm } from '../features/character/CharacterForm'
import { CharacterList } from '../features/character/CharacterList'
import { SaveLoadControls } from '../features/save/SaveLoadControls'
import './SetupScreen.css'

export function SetupScreen() {
  return (
    <section className="setup-screen">
      <div className="setup-screen-column">
        <h2>캐릭터 등록</h2>
        <CharacterForm />
      </div>
      <div className="setup-screen-column">
        <h2>등록된 캐릭터</h2>
        <CharacterList />
      </div>
      {/* Save/load is a whole-app snapshot (every room and every registered character), not a per-character
          setting, so it lives here — directly in the real screen the "캐릭터 설정" nav button opens — rather than
          nested inside a specific character's expandable editor (which may not even render with zero characters
          registered). All save/load logic stays in `features/save/` untouched; this section only places the
          existing `SaveLoadControls`. */}
      <div className="setup-screen-data">
        <h2>데이터</h2>
        <div className="setup-screen-data-actions">
          <SaveLoadControls />
        </div>
      </div>
    </section>
  )
}
