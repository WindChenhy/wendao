import { canEnterRealm, isBossFloor, SECRET_REALMS } from '../data/secretRealms'
import { ITEMS } from '../data/items'
import { realmLabel } from '../data/realms'
import { CombatPanel } from '../components/CombatPanel'
import { useGameStore } from '../stores/useGameStore'

export function SecretRealmPanel() {
  const player = useGameStore((s) => s.player)
  const tower = useGameStore((s) => s.tower)
  const towerBest = useGameStore((s) => s.towerBest)
  const lastCombat = useGameStore((s) => s.lastCombat)
  const activeCombat = useGameStore((s) => s.activeCombat)
  const enterTower = useGameStore((s) => s.enterTower)
  const towerFight = useGameStore((s) => s.towerFight)
  const towerRest = useGameStore((s) => s.towerRest)
  const towerLeave = useGameStore((s) => s.towerLeave)
  const clearCombat = useGameStore((s) => s.clearCombat)

  if (!player) return null
  const dead = !player.alive
  const inCombat = Boolean(activeCombat && !activeCombat.finished)
  const active = tower ? SECRET_REALMS.find((r) => r.id === tower.realmId) : null

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      {inCombat && <CombatPanel />}
      {tower && active ? (
        <>
          <div className="panel-box p-4 border-gold-dim">
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="font-display text-gold text-lg">{active.name}</div>
                <div className="text-sm text-text mt-1">
                  第 <span className="text-jade">{tower.floor}</span> / {active.floors} 层
                  {isBossFloor(active, tower.floor) && (
                    <span className="text-vermilion ml-2">镇守层</span>
                  )}
                </div>
                <div className="text-xs text-text-dim mt-1">{active.flavor}</div>
              </div>
              <button className="pixel-btn text-xs" onClick={towerLeave}>
                撤离
              </button>
            </div>
            <div className="h-2 bg-ink border border-border mt-3">
              <div
                className="h-full bg-gold-dim"
                style={{ width: `${(tower.floor / active.floors) * 100}%` }}
              />
            </div>
            <p className="text-xs text-text-dim mt-2">
              每 {active.bossEvery} 层一镇守，掉落突破材料概率更高。调息消耗一日。
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button className="pixel-btn primary" disabled={dead || inCombat} onClick={towerFight}>
                迎战本层
              </button>
              <button className="pixel-btn" disabled={dead || inCombat} onClick={towerRest}>
                石台调息
              </button>
            </div>
          </div>

          {lastCombat && (
            <div className="panel-box p-4">
              <div className="flex justify-between mb-2">
                <div className="font-display text-gold">战报</div>
                <span className={`text-xs ${lastCombat.win ? 'text-bamboo' : 'text-vermilion'}`}>
                  {lastCombat.win ? '胜利' : '败退'}
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto scroll-thin text-xs space-y-0.5 border border-border p-2 bg-ink">
                {lastCombat.log.map((l, i) => (
                  <div key={i} className="log-line t-dim">
                    {l}
                  </div>
                ))}
              </div>
              <button className="pixel-btn mt-3 text-xs" onClick={clearCombat}>
                收起
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="panel-box p-4">
            <div className="font-display text-gold mb-2">秘境</div>
            <p className="text-xs text-text-dim leading-relaxed">
              古阵残境散落各地。逐层挑战守卫，镇守层多藏突破灵物。失败会被迫退出，已通关层数保留，下次可从下一层续探。
            </p>
          </div>

          <div className="space-y-2">
            {SECRET_REALMS.map((r) => {
              const ok = canEnterRealm(r, player.realm, player.layer)
              const best = towerBest[r.id] ?? 0
              return (
                <div key={r.id} className="panel-box p-4">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="font-display text-gold">{r.name}</div>
                      <div className="text-xs text-text-dim mt-1 leading-relaxed">{r.desc}</div>
                      <div className="text-xs text-text-dim mt-2">
                        需 {realmLabel(r.minRealm, r.minLayer)} · 共 {r.floors} 层 · 奖励倍率 ×
                        {r.env.rewardMul}
                        {r.env.playerHpMul && r.env.playerHpMul < 1
                          ? ` · 环境压气血 ×${r.env.playerHpMul}`
                          : ''}
                      </div>
                      <div className="text-xs text-jade mt-1">
                        历史最深：{best > 0 ? `${best} 层` : '未探索'}
                        {best >= r.floors && ' · 已贯通'}
                      </div>
                      {r.loot.bossItemId && (
                        <div className="text-[11px] text-gold-dim mt-1">
                          镇守可能掉落：{ITEMS[r.loot.bossItemId]?.name}
                        </div>
                      )}
                    </div>
                    <button
                      className="pixel-btn primary text-xs shrink-0"
                      disabled={!ok || dead}
                      onClick={() => enterTower(r.id)}
                    >
                      {ok ? (best > 0 && best < r.floors ? `续探 ${best + 1} 层` : '进入') : '境界不足'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
