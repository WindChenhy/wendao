import { useEffect } from 'react'
import { CLASSES } from '../data/classes'
import { ITEMS } from '../data/items'
import { COMBAT_CONFIG } from '../data/skills'
import { defaultAutoAction, getUnlockedPlayerSkills, formatStatuses } from '../game/combatEngine'
import { formatNum } from '../game/format'
import { useGameStore } from '../stores/useGameStore'

function hpBar(cur: number, max: number) {
  const pct = Math.max(0, Math.min(100, (cur / Math.max(1, max)) * 100))
  return (
    <div className="h-2 bg-ink border border-border">
      <div className="h-full bg-vermilion/80" style={{ width: `${pct}%` }} />
    </div>
  )
}

function energyBar(cur: number, max: number) {
  const pct = Math.max(0, Math.min(100, (cur / Math.max(1, max)) * 100))
  return (
    <div className="h-2 bg-ink border border-border">
      <div className="h-full bg-jade/80" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function CombatPanel() {
  const activeCombat = useGameStore((s) => s.activeCombat)
  const autoCombat = useGameStore((s) => s.autoCombat)
  const player = useGameStore((s) => s.player)
  const inventory = useGameStore((s) => s.inventory)
  const combatAct = useGameStore((s) => s.combatAct)
  const toggleCombatAuto = useGameStore((s) => s.toggleCombatAuto)

  // 自动战斗：逐回合推进，保证面板始终可见
  useEffect(() => {
    if (!autoCombat || !activeCombat || activeCombat.finished || !player) return
    const timer = window.setTimeout(() => {
      const action = defaultAutoAction(activeCombat, inventory, player.realm, player.layer)
      combatAct(action)
    }, 280)
    return () => window.clearTimeout(timer)
  }, [autoCombat, activeCombat, player, inventory, combatAct])

  if (!activeCombat || !player || activeCombat.finished) return null
  const st = activeCombat
  const p = st.player
  const e = st.enemy
  const skills = getUnlockedPlayerSkills(player.classId, player.realm, player.layer)
  const combatPotions = Object.entries(inventory).filter(([id, n]) => {
    if (n <= 0) return false
    const item = ITEMS[id]
    if (!item?.effect) return false
    if (item.effect.breakthroughRate && !item.effect.hp && !item.effect.energy) return false
    return Boolean(item.effect.hp || item.effect.energy)
  })
  const potionLimit = st.potionLimit
  const potionsLeft = Math.max(0, potionLimit - p.potionsUsed)
  const energyLabel = player.classId === 'demon' ? '魔元' : '灵力'
  const className = CLASSES[player.classId]?.name ?? ''

  return (
    <div className="panel-box p-4 border-gold-dim">
      <div className="flex justify-between items-center mb-3 gap-2">
        <div className="font-display text-gold">战斗 · {st.context.title}</div>
        <label className="text-xs text-text-dim flex items-center gap-1 cursor-pointer select-none">
          <input type="checkbox" checked={autoCombat} onChange={toggleCombatAuto} />
          自动
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div className="border border-border px-3 py-2">
          <div className="text-sm text-gold mb-1">
            你（{className}）
            <span className="text-xs text-text-dim ml-2">
              回合 {st.round}/{COMBAT_CONFIG.maxRounds}
            </span>
          </div>
          {hpBar(p.hp, p.maxHp)}
          <div className="text-xs text-text-dim mt-0.5">
            气血 {formatNum(p.hp)}/{formatNum(p.maxHp)}
          </div>
          {energyBar(p.energy, p.maxEnergy)}
          <div className="text-xs text-text-dim mt-0.5">
            {energyLabel} {formatNum(p.energy)}/{formatNum(p.maxEnergy)}
            <span className="text-text-dim/80 ml-2">与顶栏同步</span>
          </div>
          <div className="text-xs mt-1 text-jade">状态：{formatStatuses(p)}</div>
        </div>
        <div className="border border-border px-3 py-2">
          <div className="text-sm text-vermilion mb-1">
            {e.name}
            {e.isBoss && <span className="text-xs ml-2">镇守</span>}
          </div>
          {hpBar(e.hp, e.maxHp)}
          <div className="text-xs text-text-dim mt-0.5">
            气血 {formatNum(e.hp)}/{formatNum(e.maxHp)}
          </div>
          <div className="text-xs mt-2 text-text-dim">状态：{formatStatuses(e)}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        <button
          className="pixel-btn text-xs"
          disabled={autoCombat}
          onClick={() => combatAct({ type: 'attack' })}
        >
          普攻
        </button>
        <button
          className="pixel-btn text-xs"
          disabled={autoCombat}
          onClick={() => combatAct({ type: 'defend' })}
        >
          防御 +{COMBAT_CONFIG.defendEnergyRegen}灵
        </button>
        {skills.map((sk) => {
          const cd = p.skillCd[sk.id] ?? 0
          const cost = sk.cost?.energy ?? 0
          const alt = sk.cost?.talismanChargeAlt
          const charge = p.statuses.find((s) => s.id === 'talisman_charge')?.stacks ?? 0
          const canEnergy = p.energy >= cost
          const canAlt = !!alt && charge >= alt.charge && p.energy >= alt.energy
          const usable = cd <= 0 && (canEnergy || canAlt)
          return (
            <button
              key={sk.id}
              className="pixel-btn text-xs primary"
              disabled={autoCombat || !usable}
              title={sk.desc}
              onClick={() => combatAct({ type: 'skill', skillId: sk.id })}
            >
              {sk.name}
              {cd > 0 ? ` CD${cd}` : ` ${cost}灵`}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <span className="text-xs text-text-dim self-center">
          用药 {potionsLeft}/{potionLimit}
        </span>
        {combatPotions.map(([id, n]) => (
          <button
            key={id}
            className="pixel-btn text-xs"
            disabled={autoCombat || potionsLeft <= 0}
            onClick={() => combatAct({ type: 'potion', itemId: id })}
          >
            {ITEMS[id]?.name}×{n}
          </button>
        ))}
        {combatPotions.length === 0 && (
          <span className="text-xs text-text-dim">无可入战丹药（回春散等）</span>
        )}
      </div>

      <div className="text-xs text-text-dim mb-1">
        战报
        <span className="ml-2 text-text-dim/80">
          手动点技能；勾选「自动」可托管连打
        </span>
      </div>
      <div className="max-h-48 overflow-y-auto scroll-thin text-xs space-y-0.5 border border-border p-2 bg-ink">
        {st.log.map((l, i) => (
          <div
            key={i}
            className={`log-line ${
              l.kind === 'crit' || l.kind === 'player'
                ? 'text-gold'
                : l.kind === 'enemy'
                  ? 'text-vermilion'
                  : l.kind === 'heal'
                    ? 'text-bamboo'
                    : 't-dim'
            }`}
          >
            {l.text}
          </div>
        ))}
      </div>
    </div>
  )
}
