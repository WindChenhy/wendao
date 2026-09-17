import { SECTS, sectsFor } from '../data/sects'
import { ITEMS } from '../data/items'
import { realmLabel } from '../data/realms'
import { formatNum } from '../game/format'
import { useGameStore } from '../stores/useGameStore'

const RANK_LABEL: Record<string, string> = {
  disciple: '外门弟子',
  inner: '内门弟子',
  true: '真传弟子',
  elder: '长老',
}

export function SectPanel() {
  const player = useGameStore((s) => s.player)
  const sect = useGameStore((s) => s.sect)
  const inventory = useGameStore((s) => s.inventory)
  const joinSect = useGameStore((s) => s.joinSect)
  const leaveSect = useGameStore((s) => s.leaveSect)
  const sectTask = useGameStore((s) => s.sectTask)
  const sectExchange = useGameStore((s) => s.sectExchange)
  const sectLearn = useGameStore((s) => s.sectLearn)
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

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      {current ? (
        <>
          <div className="panel-box p-4">
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="font-display text-gold text-lg">{current.name}</div>
                <div className="text-xs text-text-dim mt-1">
                  {RANK_LABEL[sect.rank]} · 贡献{' '}
                  <span className="text-gold">{formatNum(sect.contribution)}</span>
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
            <div className="flex flex-wrap gap-2 mt-3">
              <button className="pixel-btn primary" onClick={sectTask}>
                完成今日委托
              </button>
              <button className="pixel-btn" onClick={promoteRank}>
                晋升身份
              </button>
            </div>
          </div>

          <div className="panel-box p-4">
            <div className="font-display text-gold mb-3">贡献兑换</div>
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
                    disabled={sect.contribution < row.cost}
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
            <div className="space-y-2">
              {current.library.map((lib) => {
                const known = sect.learned.includes(lib.id)
                return (
                  <div key={lib.id} className="border border-border px-3 py-2">
                    <div className="flex justify-between items-center gap-2">
                      <div>
                        <div className="text-sm text-gold">{lib.name}</div>
                        <div className="text-xs text-text-dim mt-0.5">{lib.desc}</div>
                      </div>
                      {known ? (
                        <span className="text-xs text-bamboo">已参悟</span>
                      ) : (
                        <button
                          className="pixel-btn text-xs"
                          disabled={sect.contribution < lib.cost}
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
              已学秘法：
              {sect.learned.length === 0
                ? '无'
                : sect.learned
                    .map((id) => current.library.find((l) => l.id === id)?.name ?? id)
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
              {player.repDemonic}。
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
