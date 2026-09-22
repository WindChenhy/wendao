import { useEffect } from 'react'
import { CombatPanel } from '../components/CombatPanel'
import { EventModal } from '../components/EventModal'
import { LogPanel } from '../components/LogPanel'
import { OfflineReturnModal } from '../components/OfflineReturnModal'
import { SideNav, StatusBar } from '../components/Chrome'
import { useGameStore } from '../stores/useGameStore'
import { AbodePanel } from './AbodePanel'
import { CharacterPanel } from './CharacterPanel'
import { CompanionPanel } from './CompanionPanel'
import { SettingsPanel } from './MetaPanels'
import { CultivatePanel } from './CultivatePanel'
import { ExplorePanel } from './ExplorePanel'
import { InventoryPanel } from './InventoryPanel'
import { MarketPanel } from './MarketPanel'
import { SecretRealmPanel } from './SecretRealmPanel'
import { SectPanel } from './SectPanel'

export function GameLayout() {
  const activePanel = useGameStore((s) => s.activePanel)
  const activeCombat = useGameStore((s) => s.activeCombat)
  const phase = useGameStore((s) => s.phase)

  // 回到前台时结算离线闭关；隐藏时不刷新锚点，让切出时长计入离线
  useEffect(() => {
    if (phase !== 'play') return
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        useGameStore.getState().recheckOffline()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [phase])

  return (
    <div className="h-full flex flex-col">
      <StatusBar />
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        <SideNav />
        <main className="flex-1 min-w-0 overflow-y-auto scroll-thin bg-ink p-0">
          {activeCombat && !activeCombat.finished && activePanel !== 'explore' && activePanel !== 'secret_realm' && activePanel !== 'sect' && (
            <div className="p-4 max-w-2xl">
              <CombatPanel />
            </div>
          )}
          {activePanel === 'cultivate' && <CultivatePanel />}
          {activePanel === 'character' && <CharacterPanel />}
          {activePanel === 'explore' && <ExplorePanel />}
          {activePanel === 'secret_realm' && <SecretRealmPanel />}
          {activePanel === 'inventory' && <InventoryPanel />}
          {activePanel === 'market' && <MarketPanel />}
          {activePanel === 'abode' && <AbodePanel />}
          {activePanel === 'sect' && <SectPanel />}
          {activePanel === 'companion' && <CompanionPanel />}
          {activePanel === 'settings' && <SettingsPanel />}
        </main>
      </div>
      <LogPanel />
      <EventModal />
      <OfflineReturnModal />
    </div>
  )
}
