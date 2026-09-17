import { CLASSES } from '../data/classes'
import { REALM_ORDER, realmLabel } from '../data/realms'
import { formatNum } from '../game/format'
import { weatherOf } from '../game/day'
import { useGameStore } from '../stores/useGameStore'
import type { PanelId } from '../types'

const NAV: { id: PanelId; label: string }[] = [
  { id: 'cultivate', label: '修炼' },
  { id: 'character', label: '人物' },
  { id: 'explore', label: '历练' },
  { id: 'secret_realm', label: '秘境' },
  { id: 'inventory', label: '背包' },
  { id: 'sect', label: '宗门' },
  { id: 'companion', label: '道侣' },
  { id: 'settings', label: '设置' },
]

export function StatusBar() {
  const player = useGameStore((s) => s.player)
  const time = useGameStore((s) => s.time)
  const stones = useGameStore((s) => s.stones)
  if (!player) return null
  const c = CLASSES[player.classId]
  const ri = REALM_ORDER.indexOf(player.realm)

  return (
    <header className="border-b border-border bg-ink-2 px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <span className="font-display text-gold text-sm">{player.name}</span>
      <span className="text-text-dim">{c.name}</span>
      <span className="text-gold">
        {realmLabel(player.realm, player.layer)}
        {player.ascended && ' · 已飞升'}
      </span>
      <span>
        修为 <span className="text-jade">{formatNum(player.exp)}</span>
      </span>
      <span>
        气血{' '}
        <span className={player.hp < player.maxHp * 0.3 ? 'text-vermilion' : ''}>
          {player.hp}/{player.maxHp}
        </span>
      </span>
      <span>
        {player.classId === 'demon' ? '魔元' : '灵力'} {player.energy}/{player.maxEnergy}
      </span>
      {player.classId === 'demon' && <span className="text-vermilion">煞气 {player.shaqi}</span>}
      <span className="text-gold">灵石 {formatNum(stones)}</span>
      <span className="text-text-dim">
        第{time.year}年{time.month}月{time.day}日 · {weatherOf(time)}
      </span>
      <span className="text-text-dim">
        寿元 {player.lifespanLeft} 年 · 寿龄 {player.age}
      </span>
      <span className="text-text-dim">正道 {player.repRight} · 魔道 {player.repDemonic}</span>
      <span className="text-text-dim hidden sm:inline">境阶 {ri + 1}/10</span>
      {!player.alive && <span className="text-vermilion font-display">道消</span>}
    </header>
  )
}

export function SideNav() {
  const activePanel = useGameStore((s) => s.activePanel)
  const setPanel = useGameStore((s) => s.setPanel)
  const player = useGameStore((s) => s.player)

  return (
    <nav className="w-full md:w-36 shrink-0 border-b md:border-b-0 md:border-r border-border bg-ink-2 flex md:flex-col overflow-x-auto">
      {NAV.map((n) => {
        const locked =
          (n.id === 'sect' || n.id === 'companion' || n.id === 'secret_realm') &&
          (!player || !player.alive)
        return (
          <button
            key={n.id}
            disabled={locked}
            onClick={() => setPanel(n.id)}
            className={`px-4 py-3 text-sm whitespace-nowrap border-b border-border/40 ${
              activePanel === n.id
                ? 'text-gold bg-[#2a2618] border-l-2 border-l-gold'
                : 'text-text-dim hover:text-text'
            } ${locked ? 'opacity-40' : ''}`}
          >
            {n.label}
            {locked && <span className="block text-[10px]">未开放</span>}
          </button>
        )
      })}
    </nav>
  )
}
