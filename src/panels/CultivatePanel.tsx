import { CLASSES, isPathDefined } from '../data/classes'
import { SECTS } from '../data/sects'
import {
  GONGFA_GRADE_CLASS,
  GONGFA_GRADE_ORDER,
  GONGFA_STAGE_LABELS,
  GONGFAS,
  canLearnGongfaFull as canLearnGongfa,
  gongfaScopeText,
  gongfaAdvanceCost,
  gongfaByScrollId,
  gongfaEffectText,
  gongfaRealmText,
} from '../data/gongfa'
import { activeSynergies, describeSynergyEffects } from '../data/gongfaSynergy'
import { REALMS, expNeeded } from '../data/realms'
import { ITEMS, bestBreakthroughPill, requiredMaterial, treasureBreakthroughBonus } from '../data/items'
import { canBreakthrough } from '../game/breakthrough'
import { MAJOR_BREAKTHROUGH_RATE_MAX, breakthroughSuccessRate } from '../game/rules/breakthrough'
import { seclusionYearOptions, GAME_DAYS_PER_YEAR } from '../game/day'
import { formatNum } from '../game/format'
import { daoBonuses, isAscended, reincarnateGain } from '../game/reincarnate'
import { heartDemonOf } from '../game/heartDemon'
import { sealDaoCost, sealSlots, describeSealed, type SealedItem } from '../game/seal'
import { TRIBULATION_PLANS, isTribulationMoment, type TribulationPlanId } from '../data/tribulation'
import { TRIB_TOKEN_BREAKTHROUGH_BONUS } from '../data/tribulation'
import { DailyCard } from '../components/DailyCard'
import { PagedList } from '../components/PagedList'
import { useGameStore } from '../stores/useGameStore'
import { currentRules, bondedDefs } from '../stores/helpers/shared'
import { DEBUG_ENABLED } from '../game/settings'
import { useState } from 'react'

/** 功法区每页条数（与背包/坊市共用同一分页组件，页数口径一致） */
const GONGFA_PAGE_SIZE = 10

function SealPicker({
  candidates,
  pick,
  onPick,
  canSealMore,
  slots,
  sealedCount,
}: {
  candidates: SealedItem[]
  pick: SealedItem | null
  onPick: (s: SealedItem | null) => void
  canSealMore: boolean
  slots: number
  sealedCount: number
}) {
  return (
    <div className="mt-3 border-t border-border/60 pt-2">
      <div className="text-xs text-gold mb-1">
        转生封印（{sealedCount}/{slots} 槽）
      </div>
      <p className="text-[11px] text-text-dim mb-2">
        可选封印 1 件传承物带入下一世：功法成残卷（进阶更省）；法宝凡品/灵器直带，宝器以上额外扣道痕。
      </p>
      {!canSealMore ? (
        <div className="text-xs text-vermilion">封印槽已满，本世无法再封。</div>
      ) : (
        <div className="flex flex-wrap gap-1">
          <button
            className={`text-[10px] border px-1.5 py-0.5 ${!pick ? 'border-gold text-gold' : 'border-border text-text-dim'}`}
            onClick={() => onPick(null)}
          >
            不封印
          </button>
          {candidates.map((s) => {
            const key = `${s.kind}:${s.id}`
            const active = pick && `${pick.kind}:${pick.id}` === key
            return (
              <button
                key={key}
                className={`text-[10px] border px-1.5 py-0.5 ${active ? 'border-gold text-gold' : 'border-border text-text-dim'}`}
                title={describeSealed(s)}
                onClick={() => onPick(active ? null : s)}
              >
                {s.kind === 'gongfa' ? '残卷' : '法宝'}·{s.name}
                {s.daoCost ? `（道痕-${s.daoCost}）` : ''}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function CultivatePanel() {
  const player = useGameStore((s) => s.player)
  const sect = useGameStore((s) => s.sect)
  const inventory = useGameStore((s) => s.inventory)
  const treasures = useGameStore((s) => s.treasures)
  const artifacts = useGameStore((s) => s.artifacts)
  const gongfa = useGameStore((s) => s.gongfa)
  const legacy = useGameStore((s) => s.legacy)
  const favor = useGameStore((s) => s.favor)
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
  const [planId, setPlanId] = useState<TribulationPlanId>('normal')
  const [sealPick, setSealPick] = useState<SealedItem | null>(null)

  if (!player) return null
  const need = expNeeded(player.realm, player.layer)
  const sdef = sect.sectId ? SECTS.find((x) => x.id === sect.sectId) : null
  const dao = daoBonuses(legacy.daoMarks)
  const bondedList = bondedDefs(companion)
  const spouseBonus =
    bondedList.length > 0 ? Math.max(...bondedList.map((c) => c.breakthroughBonus ?? 0)) : 0
  const treasureBt = treasureBreakthroughBonus(treasures)
  const breakPill = bestBreakthroughPill(inventory, player.realm)
  const pillBt = breakPill?.rate ?? 0
  const tribTokenBt = (inventory.mat_tribulation ?? 0) > 0 ? TRIB_TOKEN_BREAKTHROUGH_BONUS : 0
  const ready = canBreakthrough(player.realm, player.layer, player.exp)
  const c = CLASSES[player.classId]
  const hasPrimary = isPathDefined(player.classId)
  // 飞升与道消互斥：已飞升则不再显示道消
  const ascended = isAscended(player)
  const dead = !player.alive && !ascended
  const def = REALMS[player.realm]
  const isMajor = player.layer >= def.layers
  const matId = requiredMaterial(player.realm, player.layer)
  const matCount = matId ? inventory[matId] ?? 0 : 0
  const matOk = !matId || matCount > 0
  const options = seclusionYearOptions(player.realm)
  // 转生收益预估（唯一口径）：须带 favor，否则仙缘折算漏算、显示低于真实结算值
  const gainEstimate = reincarnateGain(player, companion.spouseIds.length > 0, favor)
  const nextGain = dead || ascended ? gainEstimate : null
  const synList = activeSynergies(Object.keys(gongfa.learned))
  const synBt = synList.reduce((n, s) => n + (s.rule.effects.breakthrough ?? 0), 0)
  // 与结算同源：成功率一律走 game/rules/breakthrough（大境界另有 70% 上限）
  const rateCtx = {
    classId: player.classId,
    paths: player.paths,
    aptitude: player.aptitude,
    realm: player.realm,
    layer: player.layer,
    sectBonus: sdef?.bonus.breakthroughBonus ?? 0,
    spouseBonus,
    daoBonus: dao.breakthroughBonus,
    treasureBonus: treasureBt,
    pillBonus: pillBt,
    tribTokenBonus: tribTokenBt,
    synergyBonus: synBt,
    rulesRateDelta: currentRules().breakthroughRateDelta,
    heartDemon: heartDemonOf(player),
  }
  const baseRate = breakthroughSuccessRate(rateCtx)
  const planOpen = isTribulationMoment(player.realm)
  const planDef = TRIBULATION_PLANS.find((p) => p.id === planId) ?? TRIBULATION_PLANS[0]
  const rateWithPlan = breakthroughSuccessRate({
    ...rateCtx,
    planRateDelta: planOpen ? planDef.rateDelta : 0,
  })
  const spouseHurt = (companion.spouseHurtUntilDay ?? 0) > 0
  const slots = sealSlots(legacy.daoMarks + (nextGain?.daoMarks ?? 0))
  const sealedCount = (legacy.sealed ?? []).length
  const canSealMore = sealedCount < slots
  const sealCandidates: SealedItem[] = [
    ...Object.entries(gongfa.learned).map(([id, st]) => ({
      kind: 'gongfa' as const,
      id,
      name: GONGFAS[id]?.name ?? id,
      stage: st.stage,
      daoCost: 0,
    })),
    ...artifacts.map((a) => ({
      kind: 'artifact' as const,
      id: a.itemId,
      name: a.name,
      quality: a.quality,
      affixes: a.affixes,
      daoCost: sealDaoCost(a.quality),
    })),
  ]
  const sealCost = sealPick ? (sealPick.daoCost ?? 0) : 0
  const netDao = Math.max(0, (nextGain?.daoMarks ?? 0) - sealCost)
  const learnedList = Object.entries(gongfa.learned).sort((a, b) => {
    const ga = GONGFAS[a[0]]
    const gb2 = GONGFAS[b[0]]
    if (!ga || !gb2) return 0
    return GONGFA_GRADE_ORDER.indexOf(gb2.grade) - GONGFA_GRADE_ORDER.indexOf(ga.grade)
  })
  const scrollIds = Object.keys(inventory).filter(
    (id) => gongfaByScrollId(id) && (inventory[id] ?? 0) > 0,
  )
  // 功法区排序：待参悟秘籍 → 未圆满 → 已圆满（组内沿用品阶倒序）
  const maxStage = GONGFA_STAGE_LABELS.length - 1
  const gongfaRows: { kind: 'scroll' | 'learned'; id: string }[] = [
    ...scrollIds.map((id) => ({ kind: 'scroll' as const, id })),
    ...learnedList
      .filter(([, st]) => st.stage < maxStage)
      .map(([id]) => ({ kind: 'learned' as const, id })),
    ...learnedList
      .filter(([, st]) => st.stage >= maxStage)
      .map(([id]) => ({ kind: 'learned' as const, id })),
  ]

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <DailyCard />
      <div className="panel-box p-4">
        <div className="font-display text-gold mb-2">洞府静修</div>
        <p className="text-xs text-text-dim mb-3">
          {hasPrimary
            ? `${c.name} · ${c.desc}`
            : '未定道途：以散修之身吐纳本命灵气，属性全凭灵根。修行途中自会遇上该走的路。'}
        </p>
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
          <button className="pixel-btn primary" disabled={dead || ascended} onClick={meditate}>
            打坐一日
          </button>
          {options.map((d) => (
            <button key={d} className="pixel-btn" disabled={dead || ascended} onClick={() => seclude(d)}>
              {d >= GAME_DAYS_PER_YEAR
                ? `闭关 ${d / GAME_DAYS_PER_YEAR} 年`
                : `闭关 ${d} 日`}
            </button>
          ))}
          <button className="pixel-btn" disabled={dead || ascended} onClick={() => advanceDays(1)}>
            渡过一日
          </button>
          <button
            className="pixel-btn"
            onClick={recoverFull}
            disabled={ascended}
            hidden={!DEBUG_ENABLED}
          >
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
        {synList.length > 0 && (
          <div className="mt-3 border-t border-border/60 pt-2 text-xs">
            <div className="text-gold font-display mb-1">功法羁绊</div>
            <div className="space-y-1">
              {synList.map(({ rule, note }) => (
                <div key={rule.id} className="text-jade">
                  【{rule.name}】{describeSynergyEffects(rule.effects)}
                  <span className="text-text-dim ml-2">（{note}）</span>
                  {rule.flavor && <div className="text-text-dim">{rule.flavor}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="panel-box p-4">
        <div className="font-display text-gold mb-2">冲击壁垒</div>
        <p className="text-xs text-text-dim mb-2">
          成功率约 <span className="text-gold">{Math.round(rateWithPlan)}%</span>
          {planOpen && planDef.id !== 'normal' && (
            <span className="text-text-dim ml-1">（常规方案 {Math.round(baseRate)}%）</span>
          )}
          {isMajor && (
            <span className="text-vermilion ml-1">
              （大境界冲关逢天劫，成功率上限 {MAJOR_BREAKTHROUGH_RATE_MAX}
              %：丹药护持可增胜算，不可力保）
            </span>
          )}
          （含道途、灵根、宗门、道侣、道痕、法宝、丹药与羁绊加成）。失败将按混合规则惩罚：轻则损气血修为，大境界失败可能掉层。
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
          {synBt !== 0 && (
            <div className="text-bamboo">
              功法羁绊：突破 {synBt > 0 ? '+' : ''}
              {synBt}%
            </div>
          )}
          {bondedList.length > 0 && spouseHurt && (
            <div className="text-vermilion">道侣重伤未愈，护法加成暂失效</div>
          )}
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
          持有「渡劫令」可使冲击壁垒成功率 +{TRIB_TOKEN_BREAKTHROUGH_BONUS}
          %（不消耗）；渡劫圆满→飞升则必须消耗一枚。
        </p>
        {planOpen ? (
          <div className="mb-3">
            <div className="text-xs text-gold mb-1">天劫选择（大境界/渡劫）</div>
            <div className="space-y-1">
              {TRIBULATION_PLANS.map((p) => {
                const can =
                  (!p.costItemId || (inventory[p.costItemId] ?? 0) >= (p.costCount ?? 1)) &&
                  (!p.spouseRisk || (companion.spouseIds.length > 0 && !spouseHurt))
                return (
                  <label
                    key={p.id}
                    className={`flex items-start gap-2 border px-2 py-1.5 text-xs cursor-pointer ${
                      planId === p.id ? 'border-gold text-gold' : 'border-border text-text-dim'
                    } ${can ? '' : 'opacity-50'}`}
                  >
                    <input
                      type="radio"
                      name="trib-plan"
                      className="mt-0.5"
                      checked={planId === p.id}
                      disabled={!can}
                      onChange={() => setPlanId(p.id)}
                    />
                    <span>
                      <span className="text-text">{p.name}</span>
                      {p.rateDelta !== 0 && (
                        <span className="ml-2">
                          成功 {p.rateDelta > 0 ? '+' : ''}
                          {p.rateDelta}%
                        </span>
                      )}
                      {p.costItemId && (
                        <span className="ml-2">
                          耗「{ITEMS[p.costItemId]?.name}」×{p.costCount ?? 1}
                        </span>
                      )}
                      {p.extraDao ? <span className="ml-2">成则道痕+{p.extraDao}</span> : null}
                      <div className="mt-0.5">{p.desc}</div>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        ) : null}
        <button
          className="pixel-btn primary"
          disabled={!ready || !matOk || dead || ascended}
          onClick={() => breakthrough(planOpen ? planId : 'normal')}
        >
          {!ready
            ? '修为不足'
            : !matOk
              ? '缺少突破材料'
              : planOpen
                ? `按「${planDef.name}」冲关`
                : '立即突破'}
        </button>
        {ready && matOk && (
          <span className="text-xs text-bamboo ml-3">灵气充盈，可冲击下一层</span>
        )}
      </div>

      {ascended && (
        <div className="panel-box p-4 border-gold">
          <div className="font-display text-gold text-lg mb-1">霞举飞升</div>
          <p className="text-sm text-text-dim">你已超脱此界。可转世重修，将此生修为化作道痕。</p>
          {nextGain && (
            <p className="text-xs text-text-dim mt-2">
              转生可得道痕 <span className="text-gold">+{netDao}</span>（{nextGain.desc}
              {sealCost ? ` · 封印代价 -${sealCost}` : ''}）
            </p>
          )}
          <SealPicker
            candidates={sealCandidates}
            pick={sealPick}
            onPick={setSealPick}
            canSealMore={canSealMore}
            slots={slots}
            sealedCount={sealedCount}
          />
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              className="pixel-btn primary"
              onClick={() =>
                reincarnate(
                  {
                    name: player.name,
                    gender: player.gender,
                    aptitude: player.aptitude ?? 'mixed',
                    origin: player.origin ?? 'wild',
                  },
                  sealPick,
                )
              }
            >
              立即转生（沿用此身名号与灵根）
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
              转生可得道痕 <span className="text-gold">+{netDao}</span>（{nextGain.desc}
              {sealCost ? ` · 封印代价 -${sealCost}` : ''}）
            </p>
          )}
          <SealPicker
            candidates={sealCandidates}
            pick={sealPick}
            onPick={setSealPick}
            canSealMore={canSealMore}
            slots={slots}
            sealedCount={sealedCount}
          />
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              className="pixel-btn primary"
              onClick={() =>
                reincarnate(
                  {
                    name: player.name,
                    gender: player.gender,
                    aptitude: player.aptitude ?? 'mixed',
                    origin: player.origin ?? 'wild',
                  },
                  sealPick,
                )
              }
            >
              立即转生（沿用此身名号与灵根）
            </button>
            <button className="pixel-btn" onClick={startCreate}>
              另择新身转生
            </button>
          </div>
        </div>
      )}
      {!dead && !ascended && (
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
              转生收益以道痕结算（境界、寿龄、道侣、飞升等），下一世用于修炼加速、突破与起始资源；图鉴与成就跨周目保留。可封印 1 件传承物（功法残卷/法宝）。
            </div>
            <div>
              当前若此刻转生，预估道痕{' '}
              <span className="text-gold">+{gainEstimate.daoMarks}</span>
              （{gainEstimate.desc}）
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
        <PagedList
          items={gongfaRows}
          pageSize={GONGFA_PAGE_SIZE}
          bodyClassName="h-[520px]"
          empty={
            <p className="text-xs text-text-dim">
              尚未修习任何功法。可前往坊市购入秘籍，或在宗门藏经阁以贡献参悟。
            </p>
          }
          renderItem={(row) => {
            if (row.kind === 'scroll') {
              const id = row.id
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
                      <span className="text-text-dim text-xs ml-2">
                        秘籍 ×{inventory[id]} · 待参悟
                      </span>
                      <span
                        className={`text-xs ml-2 ${realmOk ? 'text-text-dim' : 'text-vermilion'}`}
                      >
                        {gongfaRealmText(g)}
                      </span>
                    </div>
                    <div className="text-xs text-text-dim mt-0.5">{item.desc}</div>
                    {g && <div className="text-[11px] text-jade mt-0.5">{gongfaScopeText(g)}</div>}
                  </div>
                  <button
                    className="pixel-btn text-xs primary shrink-0"
                    disabled={dead || ascended || !realmOk}
                    onClick={() => comprehendGongfa(id)}
                  >
                    {realmOk ? '参悟' : '境界不足'}
                  </button>
                </div>
              )
            }
            const id = row.id
            const g = GONGFAS[id]
            if (!g) return null
            const st = gongfa.learned[id]
            if (!st) return null
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
                      disabled={dead || ascended || player.exp < cost}
                      onClick={() => advanceGongfaStage(id)}
                    >
                      进阶 · {nextStage}
                    </button>
                  )}
                </div>
              </div>
            )
          }}
        />
      </div>
    </div>
  )
}