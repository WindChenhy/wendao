import { useMemo, useState } from 'react'
import {
  SEEDS,
  SEED_LIST,
  RECIPE_LIST,
  FARM_MAX_COUNT,
  expandColCost,
  expandRowCost,
  canExpandFarmCols,
  canExpandFarmRows,
  type SeedDef,
} from '../data/abode'
import { ITEMS } from '../data/items'
import { canCraft, craftRate, plotProgress } from '../game/farm'
import { ArtifactForgePanel } from './ArtifactForgePanel'
import { formatNum } from '../game/format'
import { useGameStore } from '../stores/useGameStore'
import { PETS, petExpNeed, describePet } from '../data/pets'

function PlotTile({
  index,
  plantSeedId,
}: {
  index: number
  plantSeedId: string | null
}) {
  const time = useGameStore((s) => s.time)
  const abode = useGameStore((s) => s.abode)
  const plantSeed = useGameStore((s) => s.plantSeed)
  const harvestPlot = useGameStore((s) => s.harvestPlot)
  const plot = abode.plots[index]
  if (!plot) return <div className="aspect-square border border-border/40 bg-ink-2/40" />

  const prog = plotProgress(plot, time)
  const seed = plot.seedId ? SEEDS[plot.seedId] : null
  const ripe = Boolean(seed && prog.ready)
  const growing = Boolean(seed && !prog.ready)

  const onClick = () => {
    if (ripe) harvestPlot(index)
    else if (!seed && plantSeedId) plantSeed(index, plantSeedId)
  }

  const title = seed
    ? `${seed.name}${ripe ? ' · 可收获' : ` · 余 ${prog.remain} 日`}`
    : plantSeedId
      ? `空地 · 点击种植${SEEDS[plantSeedId]?.name ?? ''}`
      : '空地 · 先选种子'

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={Boolean(seed) && !ripe}
      className={`w-8 h-8 sm:w-9 sm:h-9 border text-[8px] leading-none p-0 overflow-hidden transition-colors shrink-0 ${
        ripe
          ? 'border-gold bg-[#2a2618] text-gold hover:bg-[#3a3420]'
          : growing
            ? 'border-jade/50 bg-ink-2 text-jade'
            : 'border-border bg-ink-2/60 text-text-dim hover:border-gold-dim hover:text-gold'
      }`}
    >
      {seed ? (
        <div className="h-full w-full flex flex-col items-center justify-center gap-px">
          <div className="truncate w-full px-0.5">{seed.name.replace('种', '').slice(0, 2)}</div>
          <div className="text-[8px] opacity-80">{ripe ? '收' : prog.remain}</div>
          {growing && (
            <div className="w-full h-0.5 bg-ink">
              <div
                className="h-full bg-bamboo"
                style={{ width: `${Math.min(100, (prog.elapsed / Math.max(1, prog.growDays)) * 100)}%` }}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="h-full w-full flex items-center justify-center opacity-60 text-[9px]">田</div>
      )}
    </button>
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
  const expandFarmCol = useGameStore((s) => s.expandFarmCol)
  const expandFarmRow = useGameStore((s) => s.expandFarmRow)
  const craftItem = useGameStore((s) => s.craftItem)
  const pet = useGameStore((s) => s.pet)
  const feedPet = useGameStore((s) => s.feedPet)
  const breakthroughPet = useGameStore((s) => s.breakthroughPet)
  const setPetJob = useGameStore((s) => s.setPetJob)
  const releasePet = useGameStore((s) => s.releasePet)
  const petFarmAssist = useGameStore((s) => s.petFarmAssist)
  const legacy = useGameStore((s) => s.legacy)
  const [plantSeedId, setPlantSeedId] = useState<string | null>(null)
  const seedOptions = useMemo(
    () => SEED_LIST.filter((s) => (inventory[s.id] ?? 0) > 0),
    [inventory],
  )

  if (!player) return null
  const dead = !player.alive || player.realm === 'ascended' || player.ascended
  const cols = abode.farmCols
  const rows = abode.farmRows
  const total = abode.plots.length
  const colCost = expandColCost(cols)
  const rowCost = expandRowCost(rows)
  const canCol = canExpandFarmCols(cols) && stones >= colCost
  const canRow = canExpandFarmRows(rows) && stones >= rowCost
  const readyCount = abode.plots.filter((p) => p.seedId && plotProgress(p, time).ready).length
  const emptyCount = abode.plots.filter((p) => !p.seedId).length
  const planted = total - emptyCount

  return (
    <div className="p-4 space-y-4 max-w-3xl">
      <div className="panel-box p-4">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
          <div className="font-display text-gold">洞府灵田</div>
          <div className="text-xs text-text-dim">
            {cols}×{rows} = {total}/{FARM_MAX_COUNT} 格 · 已种 {planted} · 可收 {readyCount}
          </div>
        </div>
        <p className="text-xs text-text-dim mb-3">
          桃源式方格灵田：点击空地按当前种子播种，点击成熟灵植收获。可向右/向下开拓荒地，直至
          16×8=128 格。种植与收获会推进时间。
        </p>

        {/* 选种 */}
        <div className="flex flex-wrap gap-1 items-center mb-3">
          <span className="text-xs text-text-dim mr-1">选种：</span>
          <button
            type="button"
            className={`text-[10px] border px-1.5 py-0.5 ${!plantSeedId ? 'border-gold text-gold' : 'border-border text-text-dim'}`}
            onClick={() => setPlantSeedId(null)}
          >
            不种
          </button>
          {seedOptions.map((s: SeedDef) => (
            <button
              key={s.id}
              type="button"
              className={`text-[10px] border px-1.5 py-0.5 ${plantSeedId === s.id ? 'border-gold text-gold' : 'border-border text-text-dim'}`}
              title={s.desc}
              onClick={() => setPlantSeedId(s.id)}
            >
              {s.name.replace('种', '')}×{inventory[s.id] ?? 0}
            </button>
          ))}
          {seedOptions.length === 0 && (
            <span className="text-[10px] text-vermilion">没有种子，请先购买</span>
          )}
        </div>

        {/* 网格 */}
        <div
          className="grid gap-[3px] mb-3 w-fit max-w-full"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 2.25rem))` }}
        >
          {abode.plots.map((_, i) => (
            <PlotTile key={i} index={i} plantSeedId={plantSeedId} />
          ))}
        </div>

        <div className="mt-1 pt-3 border-t border-border/60 space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <button
              className="pixel-btn primary text-xs"
              disabled={dead || readyCount === 0}
              onClick={harvestAll}
            >
              一键收获{readyCount > 0 ? `（${readyCount}）` : ''}
            </button>
            {seedOptions.map((s: SeedDef) => (
              <button
                key={s.id}
                className="pixel-btn text-xs"
                disabled={dead || emptyCount === 0}
                title={s.desc}
                onClick={() => plantAll(s.id)}
              >
                一键种{s.name.replace('种', '')}×{inventory[s.id] ?? 0}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center text-xs">
            <span className="text-text-dim">改造开拓：</span>
            <button
              className="pixel-btn text-xs"
              disabled={dead || !canCol}
              onClick={expandFarmCol}
            >
              {canExpandFarmCols(cols) ? `向右开拓一列（${formatNum(colCost)} 灵石）` : '横向已满'}
            </button>
            <button
              className="pixel-btn text-xs"
              disabled={dead || !canRow}
              onClick={expandFarmRow}
            >
              {canExpandFarmRows(rows) ? `向下开拓一行（${formatNum(rowCost)} 灵石）` : '纵向已满'}
            </button>
            <span className="text-text-dim">
              目标 16×8=128 格（当前 {total}）
            </span>
          </div>
        </div>
      </div>

      <div className="panel-box p-4">
        <div className="font-display text-gold mb-2">灵植坊市</div>
        <div className="flex flex-wrap gap-2">
          {SEED_LIST.map((s: SeedDef) => (
            <button
              key={s.id}
              className="pixel-btn text-xs"
              disabled={dead || stones < s.seedPrice}
              title={s.desc}
              onClick={() => buySeed(s.id)}
            >
              {s.name} {s.seedPrice}灵石
            </button>
          ))}
        </div>
      </div>


      <div className="panel-box p-4">
        <div className="font-display text-gold mb-2">灵兽栏</div>
        {pet ? (
          <div className="space-y-2 text-sm">
            <div>
              {describePet(pet)}
              <span className="text-xs text-text-dim ml-2">
                经验 {pet.exp}/{petExpNeed(pet.level)}
                {pet.restUntilDay > 0 ? ' · 休养中' : ''}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="pixel-btn text-xs" disabled={dead} onClick={feedPet}>喂食</button>
              <button className="pixel-btn text-xs" disabled={dead || pet.level < 10} onClick={breakthroughPet}>突破</button>
              <button className="pixel-btn text-xs" disabled={dead} onClick={() => setPetJob('farm')}>灵田协助</button>
              <button className="pixel-btn text-xs" disabled={dead} onClick={() => setPetJob('guard')}>看家</button>
              <button className="pixel-btn text-xs" disabled={dead || pet.job !== 'farm'} onClick={petFarmAssist}>今日协助收获</button>
              <button className="pixel-btn text-xs danger" disabled={dead} onClick={releasePet}>放生</button>
            </div>
            <div className="text-xs text-text-dim">协战辅助技随战斗触发；属性加成已计入出战。</div>
          </div>
        ) : (
          <div className="text-xs text-text-dim">
            灵兽栏空着。筑基后历练或天象中，或有灵兽认主之缘。
            <div className="mt-2 flex flex-wrap gap-1">
              {PETS.map((p) => (
                <span key={p.id} className="border border-border px-1.5 py-0.5 text-[10px] text-text-dim">{p.name}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <ArtifactForgePanel />

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
