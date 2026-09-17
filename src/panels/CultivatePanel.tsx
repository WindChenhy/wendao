import { CLASSES } from '../data/classes'
import { SECTS } from '../data/sects'
import { REALMS, expNeeded } from '../data/realms'
import { ITEMS, requiredMaterial } from '../data/items'
import { canBreakthrough, breakthroughRate } from '../game/breakthrough'
import { seclusionYearOptions } from '../game/day'
import { formatNum } from '../game/format'
import { daoBonuses, reincarnateGain } from '../game/reincarnate'
import { useGameStore } from '../stores/useGameStore'

export function CultivatePanel() {
  const player = useGameStore((s) => s.player)
  const sect = useGameStore((s) => s.sect)
  const inventory = useGameStore((s) => s.inventory)
  const legacy = useGameStore((s) => s.legacy)
  const companion = useGameStore((s) => s.companion)
  const meditate = useGameStore((s) => s.meditate)
  const seclude = useGameStore((s) => s.seclude)
  const breakthrough = useGameStore((s) => s.breakthrough)
  const advanceDays = useGameStore((s) => s.advanceDays)
  const recoverFull = useGameStore((s) => s.recoverFull)
  const reincarnate = useGameStore((s) => s.reincarnate)
  const startCreate = useGameStore((s) => s.startCreate)

  if (!player) return null
  const need = expNeeded(player.realm, player.layer)
  const sdef = sect.sectId ? SECTS.find((x) => x.id === sect.sectId) : null
  const dao = daoBonuses(legacy.daoMarks)
  const rate = Math.min(
    95,
    breakthroughRate(player.classId, player.realm) +
      (sdef?.bonus.breakthroughBonus ?? 0) +
      dao.breakthroughBonus,
  )
  const ready = canBreakthrough(player.realm, player.layer, player.exp)
  const c = CLASSES[player.classId]
  const dead = !player.alive
  const win = player.ascended
  const def = REALMS[player.realm]
  const isMajor = player.layer >= def.layers
  const matId = requiredMaterial(player.realm, player.layer)
  const matCount = matId ? inventory[matId] ?? 0 : 0
  const matOk = !matId || matCount > 0
  const options = seclusionYearOptions(player.realm)
  const nextGain = dead || win ? reincarnateGain(player, Boolean(companion.spouseId)) : null

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      <div className="panel-box p-4">
        <div className="font-display text-gold mb-2">洞府静修</div>
        <p className="text-xs text-text-dim mb-3">{c.desc}</p>
        <div className="text-sm mb-1">
          当前修为{' '}
          <span className="text-jade">
            {formatNum(player.exp)} / {formatNum(need)}
          </span>
          <span className="text-text-dim text-xs ml-2">
            （{def.name} · 跨境界所需修为逐级抬升）
          </span>
        </div>
        <div className="h-2 bg-ink border border-border mb-4">
          <div
            className="h-full bg-jade"
            style={{ width: `${Math.min(100, (player.exp / Math.max(1, need)) * 100)}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="pixel-btn primary" disabled={dead || win} onClick={meditate}>
            打坐一日
          </button>
          {options.map((d) => (
            <button key={d} className="pixel-btn" disabled={dead || win} onClick={() => seclude(d)}>
              {d >= 365 ? `闭关 ${d / 365} 年` : `闭关 ${d} 日`}
            </button>
          ))}
          <button className="pixel-btn" disabled={dead || win} onClick={() => advanceDays(1)}>
            渡过一日
          </button>
          <button className="pixel-btn" onClick={recoverFull} disabled={win}>
            调息回满（调试）
          </button>
        </div>
        {sect.sectId && (
          <p className="text-xs text-text-dim mt-2">
            {sdef?.name} 加成：修炼 ×{sdef?.bonus.cultivateMul}，突破{' '}
            {(sdef?.bonus.breakthroughBonus ?? 0) >= 0 ? '+' : ''}
            {sdef?.bonus.breakthroughBonus}%
          </p>
        )}
        {legacy.daoMarks > 0 && (
          <p className="text-xs text-text-dim mt-1">
            道痕 {legacy.daoMarks}：修炼 ×{dao.cultivateMul.toFixed(2)}，突破 +
            {dao.breakthroughBonus}% · 已转生 {legacy.reincarnations} 次
          </p>
        )}
      </div>

      <div className="panel-box p-4">
        <div className="font-display text-gold mb-2">冲击壁垒</div>
        <p className="text-xs text-text-dim mb-2">
          成功率约 <span className="text-gold">{Math.round(rate)}%</span>
          （含职业、宗门与道痕加成）。失败将按混合规则惩罚：轻则损气血修为，大境界失败可能掉层。
        </p>
        {isMajor && matId && (
          <div className={`text-sm mb-3 ${matOk ? 'text-bamboo' : 'text-vermilion'}`}>
            大境界突破需：「{ITEMS[matId]?.name}」
            <span className="text-text-dim">
              （持有 {matCount} · 历练/秘境/宗门兑换获取）
            </span>
          </div>
        )}
        <button
          className="pixel-btn primary"
          disabled={!ready || !matOk || dead || win}
          onClick={breakthrough}
        >
          {!ready ? '修为不足' : !matOk ? '缺少突破材料' : '立即突破'}
        </button>
        {ready && matOk && (
          <span className="text-xs text-bamboo ml-3">灵气充盈，可冲击下一层</span>
        )}
      </div>

      {win && (
        <div className="panel-box p-4 border-gold">
          <div className="font-display text-gold text-lg mb-1">霞举飞升</div>
          <p className="text-sm text-text-dim">你已超脱此界。可转世重修，将此生修为化作道痕。</p>
          {nextGain && (
            <p className="text-xs text-text-dim mt-2">
              转生可得道痕 <span className="text-gold">+{nextGain.daoMarks}</span>（{nextGain.desc}）
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              className="pixel-btn primary"
              onClick={() =>
                reincarnate({
                  name: player.name,
                  gender: player.gender,
                  classId: player.classId,
                })
              }
            >
              立即转生（沿用此身名号职业）
            </button>
            <button className="pixel-btn" onClick={startCreate}>
              另择新身转生
            </button>
          </div>
        </div>
      )}
      {dead && (
        <div className="panel-box p-4 border-vermilion">
          <div className="font-display text-vermilion text-lg mb-1">道消身陨</div>
          <p className="text-sm text-text-dim">此世修行已终。可带着道痕转世重修。</p>
          {nextGain && (
            <p className="text-xs text-text-dim mt-2">
              转生可得道痕 <span className="text-gold">+{nextGain.daoMarks}</span>（{nextGain.desc}）
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              className="pixel-btn primary"
              onClick={() =>
                reincarnate({
                  name: player.name,
                  gender: player.gender,
                  classId: player.classId,
                })
              }
            >
              立即转生（沿用此身名号职业）
            </button>
            <button className="pixel-btn" onClick={startCreate}>
              另择新身转生
            </button>
          </div>
        </div>
      )}
    </div>
  )
}