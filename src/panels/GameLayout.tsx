import { EventModal } from '../components/EventModal'
import { LogPanel } from '../components/LogPanel'
import { SideNav, StatusBar } from '../components/Chrome'
import { useGameStore } from '../stores/useGameStore'
import { CharacterPanel } from './CharacterPanel'
import { CompanionPanel } from './CompanionPanel'
import { SettingsPanel } from './MetaPanels'
import { CultivatePanel } from './CultivatePanel'
import { ExplorePanel } from './ExplorePanel'
import { InventoryPanel } from './InventoryPanel'
import { SecretRealmPanel } from './SecretRealmPanel'
import { SectPanel } from './SectPanel'

export function GameLayout() {
  const activePanel = useGameStore((s) => s.activePanel)

  return (
    <div className="h-full flex flex-col">
      <StatusBar />
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        <SideNav />
        <main className="flex-1 min-w-0 overflow-y-auto scroll-thin bg-ink">
          {activePanel === 'cultivate' && <CultivatePanel />}
          {activePanel === 'character' && <CharacterPanel />}
          {activePanel === 'explore' && <ExplorePanel />}
          {activePanel === 'secret_realm' && <SecretRealmPanel />}
          {activePanel === 'inventory' && <InventoryPanel />}
          {activePanel === 'sect' && <SectPanel />}
          {activePanel === 'companion' && <CompanionPanel />}
          {activePanel === 'settings' && <SettingsPanel />}
        </main>
      </div>
      <LogPanel />
      <EventModal />
    </div>
  )
}
