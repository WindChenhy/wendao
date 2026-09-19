import { SEEDS, SEED_LIST, RECIPE_LIST, expandPlotCost, MAX_PLOTS, type SeedDef } from '../data/abode'
import { ITEMS } from '../data/items'
import { canCraft, craftRate, plotProgress } from '../game/farm'
import { formatNum } from '../game/format'
import { useGameStore } from '../stores/useGameStore'

function PlotCard({ index }: { index: number }) {
  const time = useGameStore((s) => s.time)
  const abode = useGameStore((s) => s.abode)
  const inventory = useGameStore((s) => s.inventory)
  const plantSeed = useGameStore((s) => s.plantSeed)
  const harvestPlot = useGameStore((s) => s.harvestPlot)
  const plot = abode.plots[index]
  if (!plot) return null

  const prog = plotProgress(plot, time)
  const seed = plot.seedId ? SEEDS[plot.seedId] : null

  return (
    <div className="border border-border px-3 py-2">
      <div className="flex justify-between items-center gap-2">
        <div className="text-sm">
          灵田 {index + 1}
          {seed && (
            <span className="ml-2 text-jade">
              {seed.name}
              {prog.ready ? '（可收获）' : `（余 ${prog.remain} 日）`}
            </span>
          )}
          {!seed && <span className="ml-2 text-text-dim">闲置</span>}
        </div>
        <div className="flex gap-1 shrink-0">
          {seed && prog.ready && (
            <button className="pixel-btn text-xs primary" onClick={() => harvestPlot(index)}>
              收获
            </button>
          )}
          {!seed && (
            <div className="flex flex-wrap gap-1 justify-end">
              {SEED_LIST.map((s) => (
                <button
                  key={s.id}
                  className="pixel-btn text-xs"
                  disabled={(inventory[s.id] ?? 0) <= 0}
                  title={s.desc}
                  onClick={() => plantSeed(index, s.id)}
                >
                  种{s.name.replace('种', '')}×{inventory[s.id] ?? 0}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {seed && !prog.ready && (
        <div className="h-1.5 bg-ink border border-border mt-2">
          <div
            className="h-full bg-bamboo"
            style={{ width: `${Math.min(100, (prog.elapsed / prog.growDays) * 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}

export function AbodePanel() {
  const player = useGameStore((s) => s.player)
  const time = useGameStore((s) => s.time)
  const inventory = useGameStore((s) => s.inventory)
  const stones = useGameStore((s) => s.stones)
  const abode = useGameStore((s) => s.abode)
  const buySeed = useGameStore((s) => s.buySeed)
  const plantAll = useGameStore((s) => s.plantAll)
  const harvestAll = useGameStore((s) => s.harvestAll)
  const expandPlot = useGameStore((s) => s.expandPlot)
  const craftItem = useGameStore((s) => s.craftItem)
  const legacy = useGameStore((s) => s.legacy)

  if (!player) return null
  const dead = !player.alive || player.ascended
  const cost = expandPlotCost(abode.plots.length)
  const canExpand = abode.plots.length < MAX_PLOTS && stones >= cost
  const readyCount = abode.plots.filter((p) => p.seedId && plotProgress(p, time).ready).length
  const emptyCount = abode.plots.filter((p) => !p.seedId).length

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      <div className="panel-box p-4">
        <div className="flex justify-between items-center mb-2">
          <div className="font-display text-gold">洞府灵田</div>
          <div className="text-xs text-text-dim">
            {abode.plots.length}/{MAX_PLOTS} 块 · 道痕 {legacy.daoMarks}
          </div>
        </div>
        <p className="text-xs text-text-dim mb-3">
          种下灵植，待其成熟后收获药材，再入丹炉炼制。种植与收获会推进时间。
        </p>
        <div className="space-y-2">
          {abode.plots.map((_, i) => (
            <PlotCard key={i} index={i} />
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <button
              className="pixel-btn primary text-xs"
              disabled={dead || readyCount === 0}
              onClick={harvestAll}
            >
              一键收获{readyCount > 0 ? `（${readyCount} 块可收）` : ''}
            </button>
          </div>
          <div className="flex flex-wrap gap-1 items-center">
            <span className="text-xs text-text-dim mr-1">一键播种（闲置灵田 {emptyCount} 块）：</span>
            {SEED_LIST.map((s: SeedDef) => (
              <button
                key={s.id}
                className="pixel-btn text-xs"
                disabled={dead || (inventory[s.id] ?? 0) <= 0 || emptyCount === 0}
                title={s.desc}
                onClick={() => plantAll(s.id)}
              >
                种{s.name.replace('种', '')}×{inventory[s.id] ?? 0}
              </button>
            ))}
          </div>
        </div>
        {abode.plots.length < MAX_PLOTS && (
          <button
            className="pixel-btn mt-3 text-xs"
            disabled={!canExpand || dead}
            onClick={expandPlot}
          >
            扩建灵田（{formatNum(cost)} 灵石）
          </button>
        )}
      </div>

      <div className="panel-box p-4">
        <div className="font-display text-gold mb-2">灵植坊市</div>
        <div className="flex flex-wrap gap-2">
          {SEED_LIST.map((s: SeedDef) => (
            <button
              key={s.id}
              className="pixel-btn text-xs"
              disabled={dead || stones < s.seedPrice}
              onClick={() => buySeed(s.id)}
            >
              {s.name} {s.seedPrice}灵石
            </button>
          ))}
        </div>
      </div>

      <div className="panel-box p-4">
        <div className="font-display text-gold mb-2">丹房</div>
        {player.classId === 'alchemy' && (
          <p className="text-xs text-bamboo mb-2">丹修天赋：炼丹成功率 +12%</p>
        )}
        <div className="space-y-2">
          {RECIPE_LIST.map((r) => {
            const rate = craftRate(r, player.classId, legacy.daoMarks)
            const ok = canCraft(r, inventory)
            return (
              <div
                key={r.id}
                className="border border-border px-3 py-2 flex justify-between gap-2 items-start"
              >
                <div className="min-w-0">
                  <div className="text-sm">
                    {r.name}
                    <span className="text-xs text-text-dim ml-2">成功率约 {rate}%</span>
                  </div>
                  <div className="text-xs text-text-dim mt-0.5">{r.desc}</div>
                  <div className="text-xs text-text-dim mt-0.5">
                    需：
                    {r.inputs
                      .map((i) => `${ITEMS[i.itemId]?.name ?? i.itemId}×${i.count}（有 ${inventory[i.itemId] ?? 0}）`)
                      .join('，')}
                    {' → '}
                    <span className="text-gold">
                      {ITEMS[r.outputItemId]?.name ?? r.outputItemId}×{r.outputCount}
                    </span>
                  </div>
                </div>
                <button
                  className="pixel-btn text-xs shrink-0"
                  disabled={dead || !ok}
                  onClick={() => craftItem(r.id)}
                >
                  炼制
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}