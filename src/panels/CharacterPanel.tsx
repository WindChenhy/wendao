import { CLASSES } from '../data/classes'
import { ITEMS } from '../data/items'
import { REALMS, combatPower, realmLabel } from '../data/realms'
import { sectRankLabel } from '../data/sects'
import { playerCombatStats } from '../game/combat'
import { formatNum } from '../game/format'
import { useGameStore, gongfaBonuses, treasureBonus } from '../stores/useGameStore'

export function CharacterPanel() {
  const player = useGameStore((s) => s.player)
  const treasures = useGameStore((s) => s.treasures)
  const sect = useGameStore((s) => s.sect)
  const gongfa = useGameStore((s) => s.gongfa)
  if (!player) return null
  const c = CLASSES[player.classId]
  const gb = gongfaBonuses(gongfa.learned)
  const tb = treasureBonus(treasures)
  const stats = playerCombatStats(
    player.classId,
    player.realm,
    player.layer,
    player.hp,
    player.maxHp,
    gb.atk * tb.atk,
    gb.def * tb.def,
  )
  const power = combatPower(player.realm, player.layer, stats.atk, stats.def, player.maxHp)

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      <div className="panel-box p-4">
        <div className="font-display text-gold text-lg mb-1">{player.name}</div>
        <div className="text-sm text-text-dim mb-3">
          {player.gender === 'male' ? '男' : '女'} · {c.name} ·{' '}
          {c.faction === 'demonic' ? '魔道' : c.faction === 'neutral' ? '亦正亦邪' : '正道'}
          {sect.sectId ? ` · 在籍${sectRankLabel(sect.rank)}` : ''}
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>境界：{realmLabel(player.realm, player.layer)}</div>
          <div>寿元：{player.lifespanLeft} 年（寿龄 {player.age}）</div>
          <div>
            气血：{player.hp}/{player.maxHp}
          </div>
          <div>
            {player.classId === 'demon' ? '魔元' : '灵力'}：{player.energy}/{player.maxEnergy}
          </div>
          <div>攻击：{stats.atk}</div>
          <div>防御：{stats.def}</div>
          <div>战力：{formatNum(power)}</div>
          <div>煞气：{player.shaqi}</div>
          <div>正道声望：{player.repRight}</div>
          <div>魔道声望：{player.repDemonic}</div>
        </div>
        <div className="flex flex-wrap gap-1 mt-3">
          {c.tags.map((t) => (
            <span key={t} className="text-[11px] border border-gold-dim text-gold px-2 py-0.5">
              {t}
            </span>
          ))}
        </div>
      </div>

      {treasures.length > 0 && (
        <div className="panel-box p-4">
          <div className="font-display text-gold mb-2">所得法宝</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {[...new Set(treasures)].map((id) => (
              <span key={id} className="border border-gold-dim text-gold px-2 py-1">
                {ITEMS[id]?.name ?? id}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="panel-box p-4">
        <div className="font-display text-gold mb-2">境界图谱</div>
        <div className="flex flex-wrap gap-1 text-[11px]">
          {Object.values(REALMS).map((r) => (
            <span
              key={r.id}
              className={`px-2 py-1 border ${
                r.id === player.realm ? 'border-gold text-gold' : 'border-border text-text-dim'
              }`}
            >
              {r.name}
            </span>
          ))}
        </div>
        <p className="text-xs text-text-dim mt-3 leading-relaxed">
          {c.id === 'demon'
            ? '魔修之路：以战养战，煞气过高易遭反噬；正道声望为负，魔道坊市更待你。'
            : '正道路稳，藏经阁与宗门贡献皆可仰仗；斩妖除魔可扬名。'}
        </p>
      </div>
    </div>
  )
}
