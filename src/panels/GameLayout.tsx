import { Suspense, lazy, useEffect } from 'react'
import { CombatPanel } from '../components/CombatPanel'
import { EventModal, StoryModal } from '../components/EventModal'
import { LogPanel } from '../components/LogPanel'
import { OfflineReturnModal } from '../components/OfflineReturnModal'
import { SideNav, StatusBar } from '../components/Chrome'
import { isNativeApp } from '../platform/native'
import { useGameStore } from '../stores/useGameStore'

const CultivatePanel = lazy(() => import('./CultivatePanel').then((m) => ({ default: m.CultivatePanel })))
const CharacterPanel = lazy(() => import('./CharacterPanel').then((m) => ({ default: m.CharacterPanel })))
const ExplorePanel = lazy(() => import('./ExplorePanel').then((m) => ({ default: m.ExplorePanel })))
const SecretRealmPanel = lazy(() => import('./SecretRealmPanel').then((m) => ({ default: m.SecretRealmPanel })))
const InventoryPanel = lazy(() => import('./InventoryPanel').then((m) => ({ default: m.InventoryPanel })))
const MarketPanel = lazy(() => import('./MarketPanel').then((m) => ({ default: m.MarketPanel })))
const AbodePanel = lazy(() => import('./AbodePanel').then((m) => ({ default: m.AbodePanel })))
const SectPanel = lazy(() => import('./SectPanel').then((m) => ({ default: m.SectPanel })))
const CompanionPanel = lazy(() => import('./CompanionPanel').then((m) => ({ default: m.CompanionPanel })))
const SettingsPanel = lazy(() => import('./MetaPanels').then((m) => ({ default: m.SettingsPanel })))

/** 在线心跳间隔：定时刷新 meta.lastOnlineAt，避免长时间只做历练/炼丹时在线时段被误算为离线收益 */
const ONLINE_HEARTBEAT_MS = 60_000

export function GameLayout() {
  const activePanel = useGameStore((s) => s.activePanel)
  const activeCombat = useGameStore((s) => s.activeCombat)
  const phase = useGameStore((s) => s.phase)
  const inCombat = Boolean(activeCombat && !activeCombat.finished)

  // 回到前台时先结算离线闭关再刷新在线锚点；隐藏时不刷新锚点，让切出时长计入离线
  useEffect(() => {
    if (phase !== 'play') return
    // 离线结算用的是隐藏前的旧锚点，故必须先 settle 再 touch，顺序不可颠倒
    const recheck = () => {
      useGameStore.getState().recheckOffline()
      useGameStore.getState().touchOnline()
    }
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible') useGameStore.getState().touchOnline()
    }, ONLINE_HEARTBEAT_MS)

    // 原生壳内 visibilitychange 不可靠（系统挂起不派发事件），改订阅 App resume
    if (isNativeApp()) {
      let disposed = false
      let sub: { remove: () => Promise<void> } | null = null
      void import('@capacitor/app')
        .then(({ App }) => {
          if (disposed) return
          return App.addListener('resume', recheck).then((handle) => {
            if (disposed) void handle.remove()
            else sub = handle
          })
        })
        .catch((e) => console.warn('监听原生前台事件失败：', e))
      return () => {
        disposed = true
        window.clearInterval(heartbeat)
        void sub?.remove()
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') recheck()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', onVisibility)
    }
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
          <Suspense fallback={<div className="p-4 text-xs text-text-dim">载入中…</div>}>
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
          </Suspense>
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
