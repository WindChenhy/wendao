import { SECTS, SECT_RANKS, SECT_RANK_ORDER, nextSectRank, sectRankIndex, sectsFor } from '../data/sects'
import { GONGFA_GRADE_CLASS, GONGFAS } from '../data/gongfa'
import { ITEMS } from '../data/items'
import { realmIndex, realmLabel } from '../data/realms'
import { formatNum } from '../game/format'
import { useGameStore } from '../stores/useGameStore'

export function SectPanel() {
  const player = useGameStore((s) => s.player)
  const sect = useGameStore((s) => s.sect)
  const gongfa = useGameStore((s) => s.gongfa)
  const inventory = useGameStore((s) => s.inventory)
  const joinSect = useGameStore((s) => s.joinSect)
  const leaveSect = useGameStore((s) => s.leaveSect)
  const sectTask = useGameStore((s) => s.sectTask)
  const sectExchange = useGameStore((s) => s.sectExchange)
  const sectLearn = useGameStore((s) => s.sectLearn)
  const sectGrandCompetition = useGameStore((s) => s.sectGrandCompetition)
  const promoteRank = useGameStore((s) => s.promoteRank)

  if (!player) return null
  const current = sect.sectId ? SECTS.find((s) => s.id === sect.sectId) : null
  const demonicPref = player.classId === 'demon' || player.repDemonic > player.repRight
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

  const reqMark = (ok: boolean) => (ok ? <span className="text-jade">✔</span> : <span className="text-vermilion">✘</span>)

  return (
    <div className="p-4 space-y-4 max-w-2xl">
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
                    <button className="pixel-btn primary" onClick={sectGrandCompetition}>
                      参与宗门大比
                    </button>
                  )}
                  <button className="pixel-btn" disabled={!canPromote} onClick={promoteRank}>
                    晋升{nextDef.name}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="pixel-btn primary" onClick={sectTask}>
              完成今日委托
            </button>
          </div>

          <div className="panel-box p-4">
            <div className="font-display text-gold mb-3">贡献兑换</div>
            {!canExchange && (
              <p className="text-xs text-vermilion mb-2">
                杂役弟子不可兑换宗门物资，晋升外门弟子后开放。
              </p>
            )}
            <div className="space-y-2">
              {current.shop.map((row) => (
                <div
                  key={row.itemId}
                  className="border border-border px-3 py-2 flex justify-between items-center text-sm"
                >
                  <div>
                    <div>{ITEMS[row.itemId]?.name ?? row.itemId}</div>
                    <div className="text-xs text-text-dim">{ITEMS[row.itemId]?.desc}</div>
                  </div>
                  <button
                    className="pixel-btn text-xs"
                    disabled={!canExchange || sect.contribution < row.cost}
                    onClick={() => sectExchange(row.itemId, row.cost)}
                  >
                    {row.cost} 贡献
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="panel-box p-4">
            <div className="font-display text-gold mb-3">藏经阁</div>
            {!canEnterLibrary && (
              <p className="text-xs text-vermilion mb-2">藏经阁仅对内门及以上职位开放。</p>
            )}
            <div className="space-y-2">
              {current.library.map((lib) => {
                const g = GONGFAS[lib.id]
                const known = Boolean(gongfa.learned[lib.id])
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
                        </div>
                        <div className="text-xs text-text-dim mt-0.5">{lib.desc}</div>
                      </div>
                      {known ? (
                        <span className="text-xs text-bamboo">已参悟</span>
                      ) : (
                        <button
                          className="pixel-btn text-xs"
                          disabled={!canEnterLibrary || sect.contribution < lib.cost}
                          onClick={() => sectLearn(lib.id, lib.cost)}
                        >
                          {lib.cost} 贡献
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
              {current.library.filter((l) => gongfa.learned[l.id]).length === 0
                ? '无'
                : current.library
                    .filter((l) => gongfa.learned[l.id])
                    .map((l) => l.name)
                    .join('、')}
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
                .filter((s) => !candidates.includes(s))
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
