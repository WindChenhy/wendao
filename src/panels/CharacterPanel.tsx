import {
  CLASSES,
  isDemonic,
  isPathDefined,
  pathEffectText,
  pathIdsOf,
  playerMults,
  primaryPathId,
} from '../data/classes'
import { aptitudeOf } from '../data/aptitudes'
import { originOf } from '../data/origins'
import { ITEMS } from '../data/items'
import { REALMS, combatPower, realmIndex, realmLabel } from '../data/realms'
import { sectRankLabel } from '../data/sects'
import { isSkillUnlocked, skillsForPaths } from '../data/skills'
import { PathPanel } from '../components/PathPanel'
import { playerCombatStats } from '../game/combatStats'
import { formatNum } from '../game/format'
import { atonementCost, wantedLabel } from '../game/bounty'
import { reputationTitles, resolveAlignment } from '../game/reputation'
import { useGameStore, gongfaBonuses, treasureBonus } from '../stores/useGameStore'

export function CharacterPanel() {
  const player = useGameStore((s) => s.player)
  const treasures = useGameStore((s) => s.treasures)
  const sect = useGameStore((s) => s.sect)
  const gongfa = useGameStore((s) => s.gongfa)
  const wanted = useGameStore((s) => s.wanted)
  const favor = useGameStore((s) => s.favor)
  const stones = useGameStore((s) => s.stones)
  const atoneWanted = useGameStore((s) => s.atoneWanted)
  if (!player) return null
  const paths = pathIdsOf(player)
  const hasPrimary = isPathDefined(primaryPathId(player))
  const c = CLASSES[player.classId]
  const apt = aptitudeOf(player)
  const origin = originOf(player)
  const mults = playerMults(player)
  const gb = gongfaBonuses(gongfa.learned)
  const tb = treasureBonus(treasures)
  const stats = playerCombatStats(
    player,
    player.realm,
    player.layer,
    player.hp,
    player.maxHp,
    gb.atk * tb.atk,
    gb.def * tb.def,
  )
  const power = combatPower(player.realm, player.layer, stats.atk, stats.def, player.maxHp)
  const titles = reputationTitles(player.repRight, player.repDemonic)
  const atoneCost = atonementCost(wanted, player.realm)
  const demonic = isDemonic(player)
  // R-31：立场独立字段（缺省由声望推导）
  const alignment = resolveAlignment(player)
  const heartDemon = player.heartDemon ?? 0

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      <div className="panel-box p-4">
        <div className="font-display text-gold text-lg mb-1">{player.name}</div>
        <div className="text-sm text-text-dim mb-3">
          {player.gender === 'male' ? '男' : '女'} · {apt.name}（{apt.alias}） · 出身{origin.name} ·{' '}
          {hasPrimary ? `主修${c.name}` : '未定道途'}
          {alignment === 'demonic' ? ' · 魔道立场' : alignment === 'righteous' ? ' · 正道立场' : ' · 中立'}
          {sect.sectId ? ` · 在籍${sectRankLabel(sect.rank)}` : ''}
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>境界：{realmLabel(player.realm, player.layer)}</div>
          <div>寿元：{player.lifespanLeft} 年（寿龄 {player.age}）</div>
          <div>
            气血：{player.hp}/{player.maxHp}
          </div>
          <div>
            {demonic ? '魔元' : '灵力'}：{player.energy}/{player.maxEnergy}
          </div>
          <div>攻击：{stats.atk}</div>
          <div>防御：{stats.def}</div>
          <div>战力：{formatNum(power)}</div>
          <div>煞气：{player.shaqi}</div>
          <div>正道声望：{player.repRight}</div>
          <div>魔道声望：{player.repDemonic}</div>
          <div className={heartDemon >= 60 ? 'text-vermilion' : heartDemon > 0 ? 'text-gold' : ''}>
            心魔：{heartDemon}
            {heartDemon >= 60 ? '（恐引心魔劫）' : heartDemon > 0 ? '（清心丹/闭关可消）' : ''}
          </div>
          <div className={wanted >= 2 ? 'text-vermilion' : ''}>
            通缉：{wantedLabel(wanted) || '无'}
          </div>
          <div>
            称号：
            {titles.mixed
              ? '亦正亦邪'
              : titles.righteous ?? titles.demonic ?? '无'}
          </div>
          {favor > 0 && <div className="text-jade">仙缘：{favor}（转生 10:1 折道痕，上限 +30）</div>}
        </div>
        <div className="text-xs text-text-dim mt-2">
          灵根天赋：{apt.detail}
        </div>
        <div className="text-xs text-text-dim mt-1">
          当前结算：修炼 ×{mults.cultivateRate.toFixed(2)} · 突破{' '}
          {mults.breakthroughBonus > 0 ? '+' : ''}
          {Math.round(mults.breakthroughBonus)}% · 攻击 ×{mults.atkMul.toFixed(2)} · 防御 ×
          {mults.defMul.toFixed(2)} · 气血 ×{mults.hpMul.toFixed(2)}
        </div>
        <div className="flex flex-wrap gap-1 mt-3">
          {(hasPrimary ? c.tags : apt.tags).map((t) => (
            <span key={t} className="text-[11px] border border-gold-dim text-gold px-2 py-0.5">
              {t}
            </span>
          ))}
        </div>
        {wanted > 0 && (
          <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between gap-2 text-xs">
            <span className="text-text-dim">
              灵石销案（通缉 −1）：需 {formatNum(atoneCost)}（现有 {formatNum(stones)}）
            </span>
            <button
              className="pixel-btn text-[10px] shrink-0"
              disabled={!player.alive || stones < atoneCost}
              onClick={atoneWanted}
            >
              赎罪
            </button>
          </div>
        )}
      </div>

      <PathPanel />

      <div className="panel-box p-4">
        <div className="font-display text-gold mb-2">战斗传承</div>
        {paths.length === 0 ? (
          <p className="text-xs text-text-dim leading-relaxed">
            尚未立道，故无传承可言——唯有吐纳与拳脚。立下道途后，此道被动与主动技自会显现。
          </p>
        ) : (
          <div className="space-y-2 text-xs">
            {skillsForPaths(paths).map((sk) => {
              const isSecondary = sk.classId !== player.classId
              const unlocked = isSkillUnlocked(sk, player.realm, player.layer, {
                isSecondary,
                primaryRealm: player.realm,
              })
              // R-22：兼修技虽达自身领悟境界，仍可能被「主修境界−1」压住
              const secondarySuppressed =
                isSecondary &&
                sk.type === 'active' &&
                sk.unlock &&
                realmIndex(sk.unlock.realm) > realmIndex(player.realm) - 1
              return (
                <div key={sk.id} className="border border-border px-2 py-1.5">
                  <div className="text-sm">
                    <span className={unlocked ? 'text-gold' : 'text-text-dim'}>{sk.name}</span>
                    <span className="text-text-dim ml-2">
                      {CLASSES[sk.classId]?.name ?? sk.classId}
                      {isSecondary ? '（兼修）' : '（主修）'}
                      {sk.type === 'passive' ? ' · 被动' : ` · 主动 · ${sk.cost?.energy ?? 0}灵`}
                      {!unlocked && sk.unlock && !secondarySuppressed
                        ? ` · 需${REALMS[sk.unlock.realm]?.name}${sk.unlock.layer}层`
                        : ''}
                      {secondarySuppressed ? ' · 主修境界再进一境方可驾驭' : ''}
                    </span>
                  </div>
                  <div className="text-text-dim mt-0.5">{sk.desc}</div>
                </div>
              )
            })}
          </div>
        )}
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
          {demonic
            ? '魔道之路：以战养战，煞气过高易遭反噬；正道声望为负，正道宗门与坊市皆视你为敌。'
            : hasPrimary
              ? `${pathEffectText(c)}。正道路稳，藏经阁与宗门贡献皆可仰仗；斩妖除魔可扬名。`
              : '你尚未立道。练气三层后，历练获胜八次可悟剑道；久炼丹火可成丹道，余者同理。'}
        </p>
      </div>
    </div>
  )
}
