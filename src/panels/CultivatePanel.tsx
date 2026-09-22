import { CLASSES } from '../data/classes'
import { companionById } from '../data/companions'
import { SECTS } from '../data/sects'
import {
  GONGFA_GRADE_CLASS,
  GONGFA_GRADE_ORDER,
  GONGFA_STAGE_LABELS,
  GONGFAS,
  canLearnGongfa,
  gongfaAdvanceCost,
  gongfaByScrollId,
  gongfaEffectText,
  gongfaRealmText,
} from '../data/gongfa'
import { REALMS, expNeeded } from '../data/realms'
import { ITEMS, bestBreakthroughPill, requiredMaterial, treasureBreakthroughBonus } from '../data/items'
import { canBreakthrough, breakthroughRate } from '../game/breakthrough'
import { seclusionYearOptions, GAME_DAYS_PER_YEAR } from '../game/day'
import { formatNum } from '../game/format'
import { daoBonuses, isAscended, reincarnateGain } from '../game/reincarnate'
import { useGameStore } from '../stores/useGameStore'

export function CultivatePanel() {
  const player = useGameStore((s) => s.player)
  const sect = useGameStore((s) => s.sect)
  const inventory = useGameStore((s) => s.inventory)
  const treasures = useGameStore((s) => s.treasures)
  const gongfa = useGameStore((s) => s.gongfa)
  const legacy = useGameStore((s) => s.legacy)
  const companion = useGameStore((s) => s.companion)
  const meditate = useGameStore((s) => s.meditate)
  const seclude = useGameStore((s) => s.seclude)
  const breakthrough = useGameStore((s) => s.breakthrough)
  const advanceDays = useGameStore((s) => s.advanceDays)
  const recoverFull = useGameStore((s) => s.recoverFull)
  const reincarnate = useGameStore((s) => s.reincarnate)
  const startCreate = useGameStore((s) => s.startCreate)
  const comprehendGongfa = useGameStore((s) => s.comprehendGongfa)
  const advanceGongfaStage = useGameStore((s) => s.advanceGongfaStage)

  if (!player) return null
  const need = expNeeded(player.realm, player.layer)
  const sdef = sect.sectId ? SECTS.find((x) => x.id === sect.sectId) : null
  const dao = daoBonuses(legacy.daoMarks)
  const spouse = companion.spouseId ? companionById(companion.spouseId) : null
  const spouseBonus = spouse?.breakthroughBonus ?? 0
  const treasureBt = treasureBreakthroughBonus(treasures)
  const breakPill = bestBreakthroughPill(inventory)
  const pillBt = breakPill?.rate ?? 0
  const tribTokenBt = (inventory.mat_tribulation ?? 0) > 0 ? 5 : 0
  const rate = Math.min(
    95,
    breakthroughRate(player.classId, player.realm) +
      (sdef?.bonus.breakthroughBonus ?? 0) +
      spouseBonus +
      dao.breakthroughBonus +
      treasureBt +
      pillBt +
      tribTokenBt,
  )
  const ready = canBreakthrough(player.realm, player.layer, player.exp)
  const c = CLASSES[player.classId]
  // 飞升与道消互斥：已飞升则不再显示道消
  const win = isAscended(player)
  const dead = !player.alive && !win
  const def = REALMS[player.realm]
  const isMajor = player.layer >= def.layers
  const matId = requiredMaterial(player.realm, player.layer)
  const matCount = matId ? inventory[matId] ?? 0 : 0
  const matOk = !matId || matCount > 0
  const options = seclusionYearOptions(player.realm)
  const nextGain = dead || win ? reincarnateGain(player, Boolean(companion.spouseId)) : null
  const learnedList = Object.entries(gongfa.learned).sort((a, b) => {
    const ga = GONGFAS[a[0]]
    const gb2 = GONGFAS[b[0]]
    if (!ga || !gb2) return 0
    return GONGFA_GRADE_ORDER.indexOf(gb2.grade) - GONGFA_GRADE_ORDER.indexOf(ga.grade)
  })
  const scrollIds = Object.keys(inventory).filter(
    (id) => gongfaByScrollId(id) && (inventory[id] ?? 0) > 0,
  )

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
              {d >= GAME_DAYS_PER_YEAR
                ? `闭关 ${d / GAME_DAYS_PER_YEAR} 年`
                : `闭关 ${d} 日`}
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
        <div className="mt-3 border-t border-border/60 pt-2 text-xs text-text-dim leading-relaxed">
          <span className="text-gold">离线修炼</span>
          ：没有单独按钮。关闭页面或切走标签（≥5 分钟）后，再读档或回到本页前台，会弹出
          「闭关归来」自动结算修为（不自动突破）。时长上限随境界（练气 8 小时 → 大乘 48 小时）。
          下线前建议先在设置里存档。
        </div>
      </div>

      <div className="panel-box p-4">
        <div className="font-display text-gold mb-2">冲击壁垒</div>
        <p className="text-xs text-text-dim mb-2">
          成功率约 <span className="text-gold">{Math.round(rate)}%</span>
          （含职业、宗门、道侣、道痕、法宝与丹药加成）。失败将按混合规则惩罚：轻则损气血修为，大境界失败可能掉层。
        </p>
        <div className="text-xs text-text-dim mb-2 space-y-0.5">
          {treasureBt > 0 && <div className="text-bamboo">认主法宝：突破 +{treasureBt}%（同类不叠加）</div>}
          {breakPill ? (
            <div className="text-bamboo">
              突破丹药：将消耗「{breakPill.name}」+{pillBt}%
              <span className="text-text-dim ml-1">（背包 {inventory[breakPill.id] ?? 0} 枚，自动选用最佳）</span>
            </div>
          ) : (
            <div>暂无突破丹药。坊市可购破境丹系列，冲击时自动消耗。</div>
          )}
          {tribTokenBt > 0 && <div className="text-bamboo">持有渡劫令：+{tribTokenBt}%</div>}
        </div>
        {isMajor && matId && (
          <div className={`text-sm mb-3 ${matOk ? 'text-bamboo' : 'text-vermilion'}`}>
            大境界突破需：「{ITEMS[matId]?.name}」
            <span className="text-text-dim">
              （持有 {matCount} ·{' '}
              {matId === 'mat_tribulation'
                ? '天劫绝域镇守 / 大乘后宗门兑换与坊市 / 大乘·渡劫历练头目'
                : '历练/秘境/宗门兑换获取'}
              ）
            </span>
          </div>
        )}
        <p className="text-xs text-text-dim mb-2">
          持有「渡劫令」可使冲击壁垒成功率 +5%（不消耗）；渡劫圆满→飞升则必须消耗一枚。
        </p>
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
      {!dead && !win && (
        <div className="panel-box p-4">
          <div className="font-display text-gold mb-2">转生（周目）</div>
          <p className="text-xs text-text-dim leading-relaxed mb-2">
            本作转生为<strong className="text-text">一世终局</strong>后的再入轮回，不能在修行中途主动转生。
            「飞升」与「道消」是<strong className="text-text">同一世的两种结局，互斥</strong>
            ：成功飞升就不会再走道消；道消表示此世未能飞升。成就里的「转生 N 次」统计跨周目次数。
          </p>
          <ul className="text-xs text-text-dim space-y-1 mb-3 list-disc pl-4">
            <li>
              <span className="text-gold">结局一 · 霞举飞升（成功）</span>
              ：渡劫圆满后突破至「飞升」（需「渡劫令」）。此后锁定为飞升态，可转生，不会再老化死亡。
            </li>
            <li>
              <span className="text-vermilion">结局二 · 道消身陨（失败）</span>
              ：寿元耗尽，或突破等导致死亡且<strong>尚未</strong>飞升。
            </li>
          </ul>
          <div className="text-xs text-text-dim space-y-0.5 mb-2">
            <div>
              满足条件后可选：
              <span className="text-text">立即转生</span>（沿用名号职业）或
              <span className="text-text">另择新身</span>。
            </div>
            <div>
              转生收益以道痕结算（境界、寿龄、道侣、飞升等），下一世用于修炼加速、突破与起始资源；图鉴与成就跨周目保留。
            </div>
            <div>
              当前若此刻转生，预估道痕{' '}
              <span className="text-gold">
                +{reincarnateGain(player, Boolean(companion.spouseId)).daoMarks}
              </span>
              （{reincarnateGain(player, Boolean(companion.spouseId)).desc}）
              <span className="text-text-dim"> · 实际以终局时数值为准</span>
            </div>
            <div>
              累计道痕 {legacy.daoMarks} · 已转生 {legacy.reincarnations} 次
            </div>
            <div>
              年号规则：转生后本世从第 1 年重新起算，不沿用上一世；历代累计寿龄约{' '}
              {(legacy.totalYears ?? 0) + player.age}
              {legacy.lastLifeEndYear > 0 && `（上一世止于第${legacy.lastLifeEndYear}年）`}。
              导出存档文件名会标注「转生N次」与「本世第X年」。
            </div>
          </div>
          <div className="text-[11px] text-text-dim border-t border-border/60 pt-2">
            提示：设置页可查看道痕与转生次数；成就「再入轮回」「三世修行」需真实完成转生后解锁。
          </div>
        </div>
      )}

      <div className="panel-box p-4">
        <div className="flex justify-between items-center mb-2">
          <div className="font-display text-gold">功法</div>
          <div className="text-xs text-text-dim">可动用修为 {formatNum(player.exp)}</div>
        </div>
        {learnedList.length === 0 && scrollIds.length === 0 && (
          <p className="text-xs text-text-dim mb-1">
            尚未修习任何功法。可前往坊市购入秘籍，或在宗门藏经阁以贡献参悟。
          </p>
        )}
        <div className="space-y-2">
          {learnedList.map(([id, st]) => {
            const g = GONGFAS[id]
            if (!g) return null
            const maxed = st.stage >= GONGFA_STAGE_LABELS.length - 1
            const nextStage = maxed ? '' : GONGFA_STAGE_LABELS[st.stage + 1]
            const cost = gongfaAdvanceCost(g, st.stage)
            return (
              <div key={id} className="border border-border px-3 py-2">
                <div className="flex justify-between items-center gap-2">
                  <div className="text-sm">
                    <span className={GONGFA_GRADE_CLASS[g.grade]}>{g.grade}</span>
                    <span className="text-text-dim mx-1.5 text-xs">{g.kind}</span>
                    <span className="text-gold">{g.name}</span>
                    <span className="text-xs text-text-dim ml-2">{gongfaRealmText(g)}</span>
                  </div>
                  <span className={`text-xs shrink-0 ${maxed ? 'text-gold' : 'text-jade'}`}>
                    {GONGFA_STAGE_LABELS[st.stage]}
                  </span>
                </div>
                <div className="text-xs text-text-dim mt-0.5">
                  当前加成：{gongfaEffectText(g, st.stage)}
                  {!maxed && (
                    <span className="ml-2">
                      （圆满：{gongfaEffectText(g, GONGFA_STAGE_LABELS.length - 1)}）
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center gap-2 mt-2">
                  {maxed ? (
                    <div className="text-xs text-gold">已臻圆满，进境无可复加。</div>
                  ) : (
                    <div className="text-xs text-text-dim">
                      以修为温养冲关，可进阶「{nextStage}」（需修为 {formatNum(cost)}）
                    </div>
                  )}
                  {!maxed && (
                    <button
                      className="pixel-btn text-xs primary shrink-0"
                      disabled={dead || win || player.exp < cost}
                      onClick={() => advanceGongfaStage(id)}
                    >
                      进阶 · {nextStage}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          {scrollIds.map((id) => {
            const g = gongfaByScrollId(id)
            const item = ITEMS[id]
            if (!g || !item) return null
            const realmOk = canLearnGongfa(g, player.realm)
            return (
              <div
                key={id}
                className="border border-border px-3 py-2 flex justify-between items-center gap-2"
              >
                <div className="min-w-0">
                  <div className="text-sm">
                    <span className={GONGFA_GRADE_CLASS[g.grade]}>{g.grade}</span>
                    <span className="text-text-dim mx-1.5 text-xs">{g.kind}</span>
                    <span className="text-gold">{g.name}</span>
                    <span className="text-text-dim text-xs ml-2">秘籍 ×{inventory[id]} · 待参悟</span>
                    <span className={`text-xs ml-2 ${realmOk ? 'text-text-dim' : 'text-vermilion'}`}>
                      {gongfaRealmText(g)}
                    </span>
                  </div>
                  <div className="text-xs text-text-dim mt-0.5">{item.desc}</div>
                </div>
                <button
                  className="pixel-btn text-xs primary shrink-0"
                  disabled={dead || win || !realmOk}
                  onClick={() => comprehendGongfa(id)}
                >
                  {realmOk ? '参悟' : '境界不足'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}