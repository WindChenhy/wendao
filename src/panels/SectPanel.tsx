import { SECTS, SECT_RANKS, SECT_RANK_ORDER, nextSectRank, sectRankIndex, sectsFor, withinMentorWindow } from '../data/sects'
import { GONGFA_GRADE_CLASS, GONGFAS, canLearnGongfaFull as canLearnGongfa, gongfaRealmText, gongfaScopeText } from '../data/gongfa'
import { isDemonic, pathIdsOf } from '../data/classes'
import { ITEMS } from '../data/items'
import { REALMS, realmIndex, realmLabel } from '../data/realms'
import {
  availableQuestChains,
  describeQuestReward,
  questChainById,
  questDeliverCandidates,
  questStepMatchesDeliver,
} from '../data/sectQuests'
import { formatNum } from '../game/format'
import { useGameStore } from '../stores/useGameStore'
import { useState } from 'react'
import {
  SECT_BUILDINGS,
  SECT_UPGRADE_MAX_LV,
  buildingLevel,
  buildingUpgradeCost,
  describeBuildingEffect,
  libraryDiscount,
  marketDiscount as marketDiscountOf,
  sectUpgradeCost,
  type SectBuildingId,
} from '../data/sectBuildings'
import { CountUpValue } from '../components/CountUpValue'
import { DONATE_STONES_PER_POOL } from '../data/sectBuildings'
import { TUNING } from '../game/tuning'

export function SectPanel() {
  const [customDonation, setCustomDonation] = useState('')
  const player = useGameStore((s) => s.player)
  const sect = useGameStore((s) => s.sect)
  const gongfa = useGameStore((s) => s.gongfa)
  const inventory = useGameStore((s) => s.inventory)
  const stones = useGameStore((s) => s.stones)
  const joinSect = useGameStore((s) => s.joinSect)
  const leaveSect = useGameStore((s) => s.leaveSect)
  const sectTask = useGameStore((s) => s.sectTask)
  const acceptQuestChain = useGameStore((s) => s.acceptQuestChain)
  const advanceQuestStep = useGameStore((s) => s.advanceQuestStep)
  const abandonQuestChain = useGameStore((s) => s.abandonQuestChain)
  const upgradeSectBuilding = useGameStore((s) => s.upgradeSectBuilding)
  const donateToPool = useGameStore((s) => s.donateToPool)
  const allocateToPool = useGameStore((s) => s.allocateToPool)
  const upgradeSectBuildingYard = useGameStore((s) => s.upgradeSectBuildingYard)
  const proposeSectBuilding = useGameStore((s) => s.proposeSectBuilding)
  const redeemSectFragment = useGameStore((s) => s.redeemSectFragment)
  const sectExchange = useGameStore((s) => s.sectExchange)
  const sectLearn = useGameStore((s) => s.sectLearn)
  const sectGrandCompetition = useGameStore((s) => s.sectGrandCompetition)
  const promoteRank = useGameStore((s) => s.promoteRank)
  const activeCombat = useGameStore((s) => s.activeCombat)
  const inCombat = Boolean(activeCombat && !activeCombat.finished)

  if (!player) return null
  const dead = !player.alive
  const current = sect.sectId ? SECTS.find((s) => s.id === sect.sectId) : null
  const demonicPref = isDemonic(player) || player.repDemonic > player.repRight
  const alignment = demonicPref ? 'demonic' : 'righteous'
  const candidates = sectsFor(
    alignment,
    player.realm,
    player.layer,
    player.repRight,
    player.repDemonic,
  )
  const allOfAlign = SECTS.filter((s) => s.alignment === alignment)

  const rankDef = SECT_RANKS[sect.rank]
  const curIdx = sectRankIndex(sect.rank)
  const nextId = nextSectRank(sect.rank)
  const nextDef = nextId ? SECT_RANKS[nextId] : null
  const freePromote = nextDef?.entry === 'optional' || nextDef?.entry === 'none'
  const contribOk = nextDef ? freePromote || sect.contribution >= nextDef.entryCost : true
  const examNeeded = nextDef?.entry === 'exam'
  const examOk = examNeeded ? sect.examPassed : true
  const shopRows = (current?.shop ?? []).filter((row) => {
    if (row.minRank && curIdx < sectRankIndex(row.minRank)) return false
    if (row.minRealm && realmIndex(player.realm) < realmIndex(row.minRealm)) return false
    return true
  })
  const shopLockedHint = (current?.shop ?? []).some(
    (row) =>
      (row.minRank && curIdx < sectRankIndex(row.minRank)) ||
      (row.minRealm && realmIndex(player.realm) < realmIndex(row.minRealm)),
  )
  const realmOk = (() => {
    const req = nextDef?.realmReq
    if (!req || freePromote) return true
    if (realmIndex(player.realm) < realmIndex(req.realm)) return false
    if (player.realm === req.realm && player.layer < req.layer) return false
    return true
  })()
  const canPromote = Boolean(nextDef) && contribOk && examOk && realmOk
  const canExchange = curIdx >= 1
  const canEnterLibrary = curIdx >= 2
  const quest = sect.quest
  const questChain = quest ? questChainById(quest.chainId) : null
  const questStep = questChain && quest ? questChain.steps[quest.stepIndex] : null
  const openChains = availableQuestChains(sect.rank, player.realm, current?.alignment ?? 'righteous')
  const isMaster = sect.rank === 'master' || sect.rank === 'supreme'
  const fragCount = inventory.sect_fragment ?? 0
  const libDiscount = libraryDiscount(sect.libraryLv)
  const marketDiscount = marketDiscountOf(sect.marketLv)
  // 藏经阁已参悟清单只算一次（原为两次相同 filter，P2-8）
  const learnedInLibrary = current ? current.library.filter((l) => gongfa.learned[l.id]) : []
  const candidateIds = new Set(candidates.map((s) => s.id))

  const reqMark = (ok: boolean) => (ok ? <span className="text-jade">✔</span> : <span className="text-vermilion">✘</span>)

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      {current ? (
        <>
          <div className="panel-box p-4">
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="font-display text-gold text-lg">{current.name}</div>
                <div className="text-xs text-text-dim mt-1">
                  当前身份 <span className="text-gold">{rankDef.name}</span> · 贡献{' '}
                  <span className="text-gold">{formatNum(sect.contribution)}</span>
                  {sect.examPassed && <span className="text-jade"> · 大比已过</span>}
                </div>
              </div>
              <button className="pixel-btn text-xs danger" onClick={leaveSect}>
                退出宗门
              </button>
            </div>
            <p className="text-xs text-text-dim mt-3 leading-relaxed">{current.desc}</p>
            <p className="text-xs text-jade mt-2">
              宗门加成：修炼 ×{current.bonus.cultivateMul}，突破{' '}
              {current.bonus.breakthroughBonus >= 0 ? '+' : ''}
              {current.bonus.breakthroughBonus}%
            </p>
            <p className="text-xs text-text-dim mt-1">
              职位加成：修炼 ×{rankDef.cultivateMul}，委托贡献 ×{rankDef.taskMul} —— {rankDef.desc}
            </p>
          </div>

          <div className="panel-box p-4">
            <div className="font-display text-gold mb-3">职位阶梯</div>
            <div className="flex flex-wrap gap-1.5">
              {SECT_RANK_ORDER.map((r) => {
                const ri = sectRankIndex(r)
                const cls =
                  ri < curIdx
                    ? 'border-jade/50 text-jade/80'
                    : ri === curIdx
                      ? 'border-gold text-gold bg-[#2a2618]'
                      : 'border-border text-text-dim'
                return (
                  <span key={r} className={`border px-2 py-0.5 text-xs ${cls}`}>
                    {SECT_RANKS[r].name}
                  </span>
                )
              })}
            </div>
            <p className="text-xs text-text-dim mt-3 leading-relaxed">
              晋升规则：杂役→外门只需贡献；外门→真传需贡献并通过宗门大比；执事及以上需贡献足够且修为达标；宗主→太上长老可自由选择，无需贡献与境界。
            </p>
          </div>

          <div className="panel-box p-4">
            <div className="font-display text-gold mb-3">晋升</div>
            {!nextDef ? (
              <div className="text-sm text-gold">你已是太上长老，宗门之中再无高位。</div>
            ) : (
              <>
                <div className="text-sm text-text mb-1">
                  下一职位：<span className="text-gold">{nextDef.name}</span>
                  <span className="text-xs text-text-dim ml-2">{nextDef.desc}</span>
                </div>
                <div className="space-y-1 text-xs mt-2">
                  {freePromote ? (
                    <div className="flex items-center gap-2">
                      {reqMark(true)}
                      <span className="text-bamboo">
                        可自由选择是否晋升，无需贡献与境界要求
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        {reqMark(contribOk)}
                        <span>
                          贡献 ≥ {nextDef.entryCost}（当前 {formatNum(sect.contribution)}）
                        </span>
                      </div>
                      {examNeeded && (
                        <div className="flex items-center gap-2">
                          {reqMark(examOk)}
                          <span>宗门大比考核（{examOk ? '已通过' : '未通过'}）</span>
                        </div>
                      )}
                      {nextDef.realmReq && (
                        <div className="flex items-center gap-2">
                          {reqMark(realmOk)}
                          <span>
                            修为 ≥ {realmLabel(nextDef.realmReq.realm, nextDef.realmReq.layer)}（你现为{' '}
                            {realmLabel(player.realm, player.layer)}）
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {examNeeded && !examOk && (
                    <button className="pixel-btn primary" disabled={inCombat} onClick={sectGrandCompetition}>
                      参与宗门大比
                    </button>
                  )}
                  <button className="pixel-btn" disabled={!canPromote || inCombat} onClick={promoteRank}>
                    晋升{nextDef.name}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="pixel-btn primary" disabled={dead || inCombat} onClick={sectTask}>
              完成今日委托
            </button>
          </div>

          <div className="panel-box p-4">
            <div className="font-display text-gold mb-3">宗门任务链</div>
            <p className="text-xs text-text-dim mb-3 leading-relaxed">
              委托已升级为 3～5 环任务链：交付材料、历练获胜、拨付灵石、回山交令。进度可中断续做；完成有概率获「藏经残页」。
            </p>
            {quest && questChain ? (
              <div className="border border-border px-3 py-2 space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="text-sm text-gold">{questChain.name}</div>
                    <div className="text-xs text-text-dim mt-0.5">{questChain.brief}</div>
                  </div>
                  <button className="pixel-btn text-xs danger" onClick={abandonQuestChain}>
                    放弃
                  </button>
                </div>
                <div className="text-xs text-jade">
                  进度：{Math.min(quest.completedSteps, questChain.steps.length)}/{questChain.steps.length} 环
                  {questStep ? ` · 当前：${questStep.desc}` : ' · 可交令结算'}
                  {questStep?.type === 'explore_win'
                    ? `（${quest.progress}/${questStep.count ?? 1}）`
                    : ''}
                </div>
                <ol className="text-[11px] text-text-dim space-y-0.5 list-decimal list-inside">
                  {questChain.steps.map((st, i) => (
                    <li
                      key={st.desc + i}
                      className={
                        i < quest.stepIndex
                          ? 'text-jade/80'
                          : i === quest.stepIndex
                            ? 'text-gold'
                            : ''
                      }
                    >
                      {st.desc}
                      {i === quest.stepIndex && st.type === 'explore_win'
                        ? `（${quest.progress}/${st.count ?? 1}）`
                        : ''}
                    </li>
                  ))}
                </ol>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="pixel-btn primary text-xs"
                    disabled={inCombat || !questStep}
                    onClick={advanceQuestStep}
                  >
                    {questStep
                      ? questStep.type === 'deliver'
                        ? '交付材料'
                        : questStep.type === 'stones'
                          ? '拨付灵石'
                          : questStep.type === 'report'
                            ? '交令结算（耗 1 日）'
                            : '外出历练计次'
                      : '领取任务链奖励'}
                  </button>
                  {questStep?.type === 'deliver' && (
                    <span className="text-[11px] text-text-dim self-center">
                      需{questDeliverCandidates(questStep)
                        .map((id) => ITEMS[id]?.name ?? id)
                        .join('/')}
                      ×{questStep.count ?? 1}
                      （当前
                      {questStepMatchesDeliver(questStep, inventory).ok ? '已备齐' : '未备齐'}）
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-text-dim">完成奖励：{describeQuestReward(questChain.reward)}</div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-text-dim">
                  可接任务链（{openChains.length}）· 已完成 {sect.questsDone} 条
                </div>
                {openChains.length === 0 && (
                  <div className="text-xs text-vermilion">暂无符合职位/境界的任务链。</div>
                )}
                {openChains.map((c) => (
                  <div
                    key={c.id}
                    className="border border-border px-3 py-2 flex justify-between items-start gap-2"
                  >
                    <div>
                      <div className="text-sm text-gold">{c.name}</div>
                      <div className="text-xs text-text-dim mt-0.5">{c.brief}</div>
                      <div className="text-[11px] text-jade mt-1">{describeQuestReward(c.reward)}</div>
                      <div className="text-[11px] text-text-dim mt-0.5">
                        共 {c.steps.length} 环：
                        {c.steps.map((s) => s.desc).join(' → ')}
                      </div>
                    </div>
                    <button
                      className="pixel-btn text-xs primary"
                      disabled={inCombat}
                      onClick={() => acceptQuestChain(c.id)}
                    >
                      接取
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel-box p-4">
            <div className="font-display text-gold mb-3">藏经残页</div>
            <div className="flex justify-between items-center gap-2">
              <div className="text-xs text-text-dim">
                持有 <span className="text-gold">{fragCount}</span> 张 · 集齐{' '}
                {TUNING.sectFragmentCost} 张可参悟一部未习宗门秘法。
                {sect.fragmentsUsed > 0 && (
                  <span className="ml-2">已参悟 {sect.fragmentsUsed} 次</span>
                )}
              </div>
              <button
                className="pixel-btn text-xs"
                disabled={fragCount < TUNING.sectFragmentCost || inCombat}
                onClick={redeemSectFragment}
              >
                残页参悟
              </button>
            </div>
          </div>

          <div className="panel-box p-4">
            <div className="font-display text-gold mb-3">贡献池 · 宗门建筑</div>
            <div className="flex flex-wrap items-center gap-2 text-sm mb-3">
              <span>
                公共账房 <span className="text-gold"><CountUpValue value={sect.pool} /></span> 池
              </span>
              <span className="text-xs text-text-dim">（委托抽成 10% · {DONATE_STONES_PER_POOL} 灵石=1 池）</span>
              <button className="pixel-btn text-xs" disabled={dead || stones < 100 || inCombat} onClick={() => donateToPool(100)}>
                捐 100 灵石
              </button>
              <button className="pixel-btn text-xs" disabled={dead || stones < 500 || inCombat} onClick={() => donateToPool(500)}>
                捐 500 灵石
              </button>
              <input
                type="number"
                min={10}
                className="bg-black/30 border border-border px-2 py-1 w-20 text-xs"
                value={customDonation}
                placeholder="自定义"
                onChange={(e) => setCustomDonation(e.target.value)}
              />
              <button
                className="pixel-btn text-xs"
                disabled={
                  dead ||
                  inCombat ||
                  !customDonation ||
                  Math.floor(Number(customDonation)) < 10 ||
                  stones < Math.floor(Number(customDonation))
                }
                onClick={() => {
                  donateToPool(Math.floor(Number(customDonation)))
                  setCustomDonation('')
                }}
              >
                捐入池
              </button>
              {isMaster && (
                <button
                  className="pixel-btn text-xs"
                  disabled={dead || sect.contribution < 100 || inCombat}
                  onClick={() => allocateToPool(100)}
                >
                  拨款 100 贡献→池
                </button>
              )}
            </div>
            <div className="space-y-2 text-sm">
              {SECT_BUILDINGS.map((b) => {
                const lv = buildingLevel(sect.buildings, b.id)
                const cost = buildingUpgradeCost(b, lv)
                const maxed = lv >= b.maxLevel
                return (
                  <div key={b.id} className="border border-border px-3 py-2 flex justify-between items-center gap-2">
                    <div className="min-w-0">
                      <div>
                        {b.name} <span className="text-gold">Lv.{lv}/{b.maxLevel}</span>
                        <span className="text-xs text-jade ml-2">{describeBuildingEffect(b, lv)}</span>
                      </div>
                      <div className="text-xs text-text-dim">{b.desc}</div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {!isMaster && sectRankIndex(sect.rank) >= sectRankIndex('elder') && (
                        <button className="pixel-btn text-xs" disabled={dead || inCombat} onClick={() => proposeSectBuilding(b.id as SectBuildingId)}>
                          提议
                        </button>
                      )}
                      <button
                        className="pixel-btn text-xs primary"
                        disabled={dead || !isMaster || maxed || sect.pool < cost || inCombat}
                        onClick={() => upgradeSectBuildingYard(b.id as SectBuildingId)}
                      >
                        {maxed ? '已满级' : `升级（池 ${cost}）`}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="panel-box p-4">
            <div className="font-display text-gold mb-3">宗门建设</div>
            {!isMaster && (
              <p className="text-xs text-vermilion mb-2">
                宗主（或太上长老）方可推行建设，自贡献池支取。
              </p>
            )}
            <div className="space-y-2 text-sm">
              <div className="border border-border px-3 py-2 flex justify-between items-center">
                <div>
                  <div>
                    藏经阁扩容 <span className="text-gold">Lv.{sect.libraryLv}</span>
                    <span className="text-xs text-text-dim ml-2">参悟消耗 ×{libDiscount.toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-text-dim">宗主建设后，藏经阁参悟更省贡献。</div>
                </div>
                <button
                  className="pixel-btn text-xs"
                  disabled={!isMaster || sect.libraryLv >= SECT_UPGRADE_MAX_LV || inCombat}
                  onClick={() => upgradeSectBuilding('library')}
                >
                  {sect.libraryLv >= SECT_UPGRADE_MAX_LV
                    ? '已满级'
                    : `升级（${sectUpgradeCost(sect.libraryLv)} 贡献）`}
                </button>
              </div>
              <div className="border border-border px-3 py-2 flex justify-between items-center">
                <div>
                  <div>
                    坊市让利 <span className="text-gold">Lv.{sect.marketLv}</span>
                    <span className="text-xs text-text-dim ml-2">兑换消耗 ×{marketDiscount.toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-text-dim">宗主让利后，贡献兑换更便宜。</div>
                </div>
                <button
                  className="pixel-btn text-xs"
                  disabled={!isMaster || sect.marketLv >= SECT_UPGRADE_MAX_LV || inCombat}
                  onClick={() => upgradeSectBuilding('market')}
                >
                  {sect.marketLv >= SECT_UPGRADE_MAX_LV
                    ? '已满级'
                    : `升级（${sectUpgradeCost(sect.marketLv)} 贡献）`}
                </button>
              </div>
            </div>
          </div>

          <div className="panel-box p-4">
            <div className="font-display text-gold mb-3">贡献兑换</div>
            {!canExchange && (
              <p className="text-xs text-vermilion mb-2">
                杂役弟子不可兑换宗门物资，晋升外门弟子后开放。
              </p>
            )}
            {shopLockedHint && (
              <p className="text-xs text-text-dim mb-2">
                部分高阶物资需更高职位或境界（如渡劫令：真传及以上 · 大乘）。
              </p>
            )}
            <div className="space-y-2">
              {shopRows.map((row) => (
                <div
                  key={row.itemId}
                  className="border border-border px-3 py-2 flex justify-between items-center text-sm"
                >
                  <div>
                    <div>
                      {ITEMS[row.itemId]?.name ?? row.itemId}
                      {row.minRealm && (
                        <span className="text-xs text-text-dim ml-2">
                          需{realmLabel(row.minRealm, 1)}
                          {row.minRank ? ` · ${SECT_RANKS[row.minRank].name}` : ''}
                        </span>
                      )}
                      {row.minRank && !row.minRealm && (
                        <span className="text-xs text-text-dim ml-2">
                          需{SECT_RANKS[row.minRank].name}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-text-dim">{ITEMS[row.itemId]?.desc}</div>
                  </div>
                  <button
                    className="pixel-btn text-xs"
                    disabled={!canExchange || sect.contribution < Math.max(1, Math.floor(row.cost * marketDiscount))}
                    onClick={() => sectExchange(row.itemId, row.cost)}
                  >
                    {marketDiscount < 1
                      ? `${Math.max(1, Math.floor(row.cost * marketDiscount))} 贡献`
                      : `${row.cost} 贡献`}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="panel-box p-4">
            <div className="font-display text-gold mb-3">藏经阁</div>
            {current.library.some((l) => l.kind === 'path') && (
              <div className="mb-4">
                <div className="text-xs text-text-dim mb-2">
                  道途传承 · 拜师立道（免去自悟历练，仍付道途自身代价）
                  {!withinMentorWindow(player.realm) && (
                    <span className="text-vermilion ml-1">——你已可自立门户，不再有拜师之缘</span>
                  )}
                </div>
                <div className="space-y-2">
                  {current.library
                    .filter((l) => l.kind === 'path')
                    .map((lib) => {
                      const owned = lib.pathId ? pathIdsOf(player).includes(lib.pathId) : false
                      const rankOk = !lib.minRank || sectRankIndex(sect.rank) >= sectRankIndex(lib.minRank)
                      const realmGateOk =
                        !lib.minRealm || realmIndex(player.realm) >= realmIndex(lib.minRealm)
                      const windowOk = withinMentorWindow(player.realm)
                      const enabled =
                        !owned && rankOk && realmGateOk && windowOk && sect.contribution >= lib.cost
                      return (
                        <div key={lib.id} className="border border-border px-3 py-2">
                          <div className="flex justify-between items-center gap-2">
                            <div>
                              <div className="text-sm">
                                <span className="text-jade text-xs mr-1">师承</span>
                                <span className="text-gold">{lib.name}</span>
                                {lib.minRank && (
                                  <span
                                    className={`text-xs ml-2 ${rankOk ? 'text-text-dim' : 'text-vermilion'}`}
                                  >
                                    需{SECT_RANKS[lib.minRank].name}
                                  </span>
                                )}
                                {lib.minRealm && (
                                  <span
                                    className={`text-xs ml-2 ${realmGateOk ? 'text-text-dim' : 'text-vermilion'}`}
                                  >
                                    需{REALMS[lib.minRealm]?.name ?? lib.minRealm}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-text-dim mt-0.5">{lib.desc}</div>
                            </div>
                            {owned ? (
                              <span className="text-xs text-bamboo">已立此道</span>
                            ) : (
                              <button
                                className="pixel-btn text-xs"
                                disabled={!enabled}
                                onClick={() => sectLearn(lib.id, lib.cost)}
                              >
                                {lib.cost} 贡献拜师
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}
            <div className="text-xs text-text-dim mb-2">功法传承</div>
            {!canEnterLibrary && (
              <p className="text-xs text-vermilion mb-2">功法秘藏仅对内门及以上职位开放。</p>
            )}
            <div className="space-y-2">
              {current.library
                .filter((l) => l.kind !== 'path')
                .map((lib) => {
                  const g = GONGFAS[lib.id]
                  const known = Boolean(gongfa.learned[lib.id])
                  const realmOk = g ? canLearnGongfa(g, player.realm) : true
                  return (
                    <div key={lib.id} className="border border-border px-3 py-2">
                      <div className="flex justify-between items-center gap-2">
                        <div>
                          <div className="text-sm">
                            {g && (
                              <>
                                <span className={GONGFA_GRADE_CLASS[g.grade]}>{g.grade}</span>
                                <span className="text-text-dim mx-1.5 text-xs">{g.kind}</span>
                              </>
                            )}
                            <span className="text-gold">{lib.name}</span>
                            {g && (
                              <span
                                className={`text-xs ml-2 ${
                                  realmOk ? 'text-text-dim' : 'text-vermilion'
                                }`}
                              >
                                {gongfaRealmText(g)}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-text-dim mt-0.5">{lib.desc}</div>
                          {g && <div className="text-[11px] text-jade mt-0.5">{gongfaScopeText(g)}</div>}
                        </div>
                        {known ? (
                          <span className="text-xs text-bamboo">已参悟</span>
                        ) : (
                          <button
                            className="pixel-btn text-xs"
                            disabled={
                              !canEnterLibrary ||
                              sect.contribution < Math.max(1, Math.floor(lib.cost * libDiscount)) ||
                              !realmOk
                            }
                            onClick={() => sectLearn(lib.id, lib.cost)}
                          >
                            {!realmOk
                              ? '境界不足'
                              : libDiscount < 1
                                ? `${Math.max(1, Math.floor(lib.cost * libDiscount))} 贡献`
                                : `${lib.cost} 贡献`}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>

          <div className="panel-box p-4 text-xs text-text-dim">
            <div className="text-xs text-text-dim">
              已参悟功法：
              {learnedInLibrary.length === 0
                ? '无'
                : learnedInLibrary.map((l) => l.name).join('、')}
            </div>
            <div className="mt-2">
              持有材料：
              {Object.entries(inventory)
                .filter(([id]) => id.startsWith('mat_'))
                .map(([id, n]) => `${ITEMS[id]?.name ?? id}×${n}`)
                .join('，') || '无'}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="panel-box p-4">
            <div className="font-display text-gold mb-2">拜入山门</div>
            <p className="text-xs text-text-dim mb-3 leading-relaxed">
              当前倾向：
              {demonicPref ? '魔道更近，可拜魔门。' : '正道路线，可投名山。'}
              你现为 {realmLabel(player.realm, player.layer)}，正道声望 {player.repRight}，魔道声望{' '}
              {player.repDemonic}。入门皆自杂役弟子做起，凭贡献与大比晋升；晋至宗主后，可自由抉择是否退居太上长老。
            </p>
          </div>

          {candidates.length > 0 ? (
            <div className="space-y-2">
              {candidates.map((s) => (
                <div key={s.id} className="panel-box p-4">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div
                        className={`font-display ${s.alignment === 'demonic' ? 'text-vermilion' : 'text-gold'}`}
                      >
                        {s.name}
                      </div>
                      <div className="text-xs text-text-dim mt-1">
                        {s.alignment === 'demonic' ? '魔道' : '正道'} ·{' '}
                        {s.bonus.breakthroughBonus >= 0 ? '突破+' : '突破'}
                        {s.bonus.breakthroughBonus}% · 修炼×{s.bonus.cultivateMul}
                      </div>
                    </div>
                    <button className="pixel-btn primary text-xs" onClick={() => joinSect(s.id)}>
                      拜入
                    </button>
                  </div>
                  <p className="text-xs text-text-dim mt-2 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="panel-box p-4 text-sm text-text-dim">
              暂无符合境界/声望的宗门。请先提升修为，或通过历练调整正魔声望。
            </div>
          )}

          {allOfAlign.length > candidates.length && (
            <div className="panel-box p-4">
              <div className="text-xs text-text-dim mb-2">尚未达标的宗门</div>
              {allOfAlign
                .filter((s) => !candidateIds.has(s.id))
                .map((s) => (
                  <div key={s.id} className="text-xs text-text-dim py-1 border-b border-border/40">
                    {s.name} — 需 {realmLabel(s.minRealm, s.minRealmLayer)}
                    {s.minRep > 0 && s.alignment === 'righteous' ? `，正道声望≥${s.minRep}` : ''}
                    {s.alignment === 'demonic' ? '，魔道声望更高' : ''}
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
