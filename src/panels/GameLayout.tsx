import { useEffect } from 'react'
import { CombatPanel } from '../components/CombatPanel'
import { EventModal, StoryModal } from '../components/EventModal'
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
  const inCombat = Boolean(activeCombat && !activeCombat.finished)

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

  // 战斗中锁滚动，避免透过遮罩操作页面
  useEffect(() => {
    if (!inCombat) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [inCombat])

  return (
    <div className="h-full flex flex-col">
      <StatusBar />
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        <SideNav />
        <main
          className={`flex-1 min-w-0 overflow-y-auto scroll-thin bg-ink p-0 ${
            inCombat ? 'pointer-events-none select-none opacity-40' : ''
          }`}
          aria-hidden={inCombat}
        >
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
      <StoryModal />
      <OfflineReturnModal />

      {/* 战斗全屏接管：进行中不可做委托/历练/切页等其他操作 */}
      {inCombat && (
        <div className="fixed inset-0 z-40 bg-ink/95 flex flex-col">
          <div className="border-b border-border bg-ink-2 px-3 py-2 text-xs text-gold font-display">
            战斗进行中 · 本场结束前无法进行其他行动
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto scroll-thin p-4">
            <div className="max-w-3xl mx-auto">
              <CombatPanel />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
