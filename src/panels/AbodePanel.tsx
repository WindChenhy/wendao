import { memo, useMemo, useState } from 'react'
import {
  SEEDS,
  SEED_LIST,
  RECIPE_LIST,
  FARM_MAX_COUNT,
  expandColCost,
  expandRowCost,
  canExpandFarmCols,
  canExpandFarmRows,
  julingUpgradeCost,
  JULING_MAX_LEVEL,
  type SeedDef,
} from '../data/abode'
import { ITEMS } from '../data/items'
import { hasPath, pathIdsOf } from '../data/classes'
import { canCraft, craftRate, plotProgress } from '../game/farm'
import { ArtifactForgePanel } from './ArtifactForgePanel'
import { formatNum } from '../game/format'
import { useGameStore } from '../stores/useGameStore'
import {
  PETS,
  PET_MAP,
  PET_MAX_LEVEL,
  PET_BREAK_LEVEL,
  PET_FEED_EXP,
  PET_FOOD_IDS,
  petExpNeed,
  petStatBonus,
  petAssistChance,
  describePet,
  type PetState,
} from '../data/pets'
import { isAscended } from '../game/reincarnate'

/** 单格灵田：只订阅自己那一格（abode.plots[index]），播种/收获不会牵动其余 127 格重渲染 */
const PlotTile = memo(function PlotTile({
  index,
  plantSeedId,
}: {
  index: number
  plantSeedId: string | null
}) {
  const time = useGameStore((s) => s.time)
  const plot = useGameStore((s) => s.abode.plots[index])
  const plantSeed = useGameStore((s) => s.plantSeed)
  const harvestPlot = useGameStore((s) => s.harvestPlot)
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
})

export function AbodePanel() {
  const player = useGameStore((s) => s.player)
  const time = useGameStore((s) => s.time)
  const inventory = useGameStore((s) => s.inventory)
  const stones = useGameStore((s) => s.stones)
  const abode = useGameStore((s) => s.abode)
  const plantAll = useGameStore((s) => s.plantAll)
  const harvestAll = useGameStore((s) => s.harvestAll)
  const expandFarmCol = useGameStore((s) => s.expandFarmCol)
  const expandFarmRow = useGameStore((s) => s.expandFarmRow)
  const craftItem = useGameStore((s) => s.craftItem)
  const pet = useGameStore((s) => s.pet)
  const breakthroughPet = useGameStore((s) => s.breakthroughPet)
  const setPetJob = useGameStore((s) => s.setPetJob)
  const releasePet = useGameStore((s) => s.releasePet)
  const petFarmAssist = useGameStore((s) => s.petFarmAssist)
  const renamePet = useGameStore((s) => s.renamePet)
  const togglePetFight = useGameStore((s) => s.togglePetFight)
  const legacy = useGameStore((s) => s.legacy)
  const [plantSeedId, setPlantSeedId] = useState<string | null>(null)
  const [petNameDraft, setPetNameDraft] = useState('')
  const [shopSeedId, setShopSeedId] = useState<string | null>(null)
  const [feedOpen, setFeedOpen] = useState(false)
  const upgradeJuling = useGameStore((s) => s.upgradeJuling)
  const seedOptions = useMemo(
    () => SEED_LIST.filter((s) => (inventory[s.id] ?? 0) > 0),
    [inventory],
  )
  // 一次遍历同时统计「可收」与「空地」，避免对最多 128 格做两轮 filter + plotProgress（P2-8）
  const { readyCount, emptyCount } = useMemo(() => {
    let ready = 0
    let empty = 0
    for (const p of abode.plots) {
      if (!p.seedId) empty += 1
      else if (plotProgress(p, time).ready) ready += 1
    }
    return { readyCount: ready, emptyCount: empty }
  }, [abode.plots, time])

  if (!player) return null
  const paths = pathIdsOf(player)
  const dead = !player.alive || isAscended(player)
  const cols = abode.farmCols
  const rows = abode.farmRows
  const total = abode.plots.length
  const colCost = expandColCost(cols)
  const rowCost = expandRowCost(rows)
  const canCol = canExpandFarmCols(cols) && stones >= colCost
  const canRow = canExpandFarmRows(rows) && stones >= rowCost
  const planted = total - emptyCount

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
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
          className="grid gap-[3px] mb-3 w-fit max-w-full overflow-x-auto scroll-thin"
          style={{ gridTemplateColumns: `repeat(${cols}, 2.25rem)` }}
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
              className={`pixel-btn text-xs ${stones < s.seedPrice ? 'opacity-50' : ''}`}
              disabled={dead}
              title={s.desc}
              onClick={() => setShopSeedId(s.id)}
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
                {pet.broken ? ' · 已突破' : ''}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button className="pixel-btn text-xs" disabled={dead} onClick={() => setFeedOpen(true)}>喂食</button>
              <button
                className="pixel-btn text-xs"
                disabled={dead || pet.level < 10 || pet.broken}
                onClick={breakthroughPet}
                title={pet.broken ? '已完成突破' : 'Lv.10 后可突破：属性系数 ×1.15'}
              >
                {pet.broken ? '已突破' : '突破'}
              </button>
              <button className="pixel-btn text-xs" disabled={dead} onClick={() => setPetJob('farm')}>灵田协助</button>
              <button className="pixel-btn text-xs" disabled={dead} onClick={() => setPetJob('guard')}>看家</button>
              <button className="pixel-btn text-xs" disabled={dead || pet.job !== 'farm'} onClick={petFarmAssist}>今日协助收获</button>
              <button
                className={`pixel-btn text-xs ${pet.fight ? '' : 'danger'}`}
                disabled={dead}
                onClick={togglePetFight}
                title="出战时提供属性加成与协战辅助技"
              >
                {pet.fight ? '出战中' : '歇战'}
              </button>
              <button className="pixel-btn text-xs danger" disabled={dead} onClick={releasePet}>放生</button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <input
                className="bg-black/30 border border-border px-2 py-1 w-32 text-xs"
                value={petNameDraft}
                maxLength={8}
                placeholder="新名字"
                onChange={(e) => setPetNameDraft(e.target.value)}
              />
              <button
                className="pixel-btn text-xs"
                disabled={dead || !petNameDraft.trim()}
                onClick={() => {
                  renamePet(petNameDraft)
                  setPetNameDraft('')
                }}
              >
                改名
              </button>
              <span className="text-text-dim">
                {pet.fight ? '协战辅助技与属性加成已生效。' : '歇战中：不提供属性加成与协战。'}
                {pet.job === 'farm' ? ' 灵田协助于跨日自动收获。' : ''}
              </span>
            </div>
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
        <div className="font-display text-gold mb-2">聚灵阵</div>
        <p className="text-xs text-text-dim mb-2">
          洞府阵法，聚拢灵气：修炼与离线收益每级 +5%。布阵需一日。
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>
            当前 <span className="text-gold">{abode.julingLevel ?? 0}</span> / {JULING_MAX_LEVEL} 重
            （收益 +{((abode.julingLevel ?? 0) * 5)}%）
          </span>
          <button
            className="pixel-btn text-xs"
            disabled={dead || (abode.julingLevel ?? 0) >= JULING_MAX_LEVEL || stones < julingUpgradeCost(abode.julingLevel ?? 0)}
            onClick={upgradeJuling}
          >
            {(abode.julingLevel ?? 0) >= JULING_MAX_LEVEL
              ? '已臻圆满'
              : `扩建至 ${(abode.julingLevel ?? 0) + 1} 重（${julingUpgradeCost(abode.julingLevel ?? 0)} 灵石）`}
          </button>
        </div>
      </div>

      <div className="panel-box p-4">
        <div className="font-display text-gold mb-2">丹房</div>
        {hasPath(player, 'alchemy') && (
          <p className="text-xs text-bamboo mb-2">
            丹道天赋：炼丹成功率 +12%{paths.length > 1 && player.classId !== 'alchemy' ? '（兼修）' : ''}
          </p>
        )}
        <div className="space-y-2">
          {RECIPE_LIST.map((r) => {
            const rate = craftRate(r, player, legacy.daoMarks)
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

      {shopSeedId && (
        <SeedShopModal seedId={shopSeedId} onClose={() => setShopSeedId(null)} />
      )}
      {feedOpen && pet && <PetFeedModal pet={pet} onClose={() => setFeedOpen(false)} />}
    </div>
  )
}

/** 灵植坊市购买弹窗：数量 × 单价，实时按灵石计算上限，单次最多 99 份 */
function SeedShopModal({ seedId, onClose }: { seedId: string; onClose: () => void }) {
  const stones = useGameStore((s) => s.stones)
  const buySeed = useGameStore((s) => s.buySeed)
  const [count, setCount] = useState(1)
  const seed = SEEDS[seedId]
  if (!seed) return null

  const maxBuy = Math.min(99, Math.floor(stones / seed.seedPrice))
  const qty = maxBuy > 0 ? Math.min(maxBuy, Math.max(1, count)) : 0
  const total = seed.seedPrice * qty

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="panel-box w-full max-w-md p-5 border-gold max-h-[85dvh] overflow-y-auto scroll-thin">
        <div className="text-[11px] text-gold mb-1 font-display tracking-widest">灵植坊市 · 购买</div>
        <h3 className="font-display text-xl text-gold mb-2">{seed.name}</h3>
        <p className="text-sm text-text mb-3 leading-relaxed">{seed.desc}</p>

        <div className="text-xs text-text-dim space-y-1 mb-4">
          <div>
            单价 <span className="text-gold">{formatNum(seed.seedPrice)}</span> 灵石 · 成熟约 {seed.growDays} 日
            {' '}· 单次上限 99 份
          </div>
          <div>
            当前灵石 <span className="text-gold">{formatNum(stones)}</span>
            {' '}· 最多可购 <span className="text-jade">{maxBuy}</span> 份
          </div>
          {maxBuy === 0 && (
            <div className="text-vermilion">
              灵石不足，尚差 {formatNum(seed.seedPrice - stones)} 灵石。
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
          <span className="text-text-dim">购买数量</span>
          <button
            type="button"
            className="pixel-btn text-xs"
            disabled={qty <= 1}
            onClick={() => setCount((c) => Math.max(1, c - 1))}
          >
            −
          </button>
          <input
            type="number"
            min={1}
            max={Math.max(1, maxBuy)}
            value={qty}
            disabled={maxBuy === 0}
            onChange={(e) => {
              const n = Math.floor(Number(e.target.value))
              setCount(Number.isFinite(n) ? Math.max(1, Math.min(maxBuy, n)) : 1)
            }}
            className="bg-black/30 border border-border px-2 py-1 w-20 text-xs"
          />
          <button
            type="button"
            className="pixel-btn text-xs"
            disabled={maxBuy === 0 || qty >= maxBuy}
            onClick={() => setCount((c) => Math.min(maxBuy, Math.max(1, c + 1)))}
          >
            ＋
          </button>
          <button
            type="button"
            className="pixel-btn text-xs"
            disabled={maxBuy === 0}
            onClick={() => setCount(maxBuy)}
          >
            最大
          </button>
        </div>

        <div className="text-sm mb-4">
          合计 <span className="text-gold">{formatNum(total)}</span> 灵石
          {qty > 0 && (
            <span className="text-xs text-text-dim ml-2">（{seed.seedPrice} × {qty}）</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="pixel-btn text-xs" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="pixel-btn primary text-xs"
            disabled={qty <= 0 || total > stones}
            onClick={() => {
              buySeed(seed.id, qty)
              onClose()
            }}
          >
            购买 {qty} 份
          </button>
        </div>
      </div>
    </div>
  )
}

/** 灵兽喂食弹窗：面板属性 + 背包中的可喂灵药，可指定数量或一键全喂 */
function PetFeedModal({ pet, onClose }: { pet: PetState; onClose: () => void }) {
  const inventory = useGameStore((s) => s.inventory)
  const feedPet = useGameStore((s) => s.feedPet)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const def = PET_MAP[pet.petId]
  const stat = petStatBonus(pet)
  const chance = petAssistChance(pet)
  const ownedFoods = PET_FOOD_IDS.filter((id) => (inventory[id] ?? 0) > 0)
  const foodNames = PET_FOOD_IDS.map((id) => ITEMS[id]?.name ?? id).join('、')

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="panel-box w-full max-w-md p-5 border-gold max-h-[85dvh] overflow-y-auto scroll-thin">
        <div className="text-[11px] text-gold mb-1 font-display tracking-widest">灵兽栏 · 喂食</div>
        <h3 className="font-display text-xl text-gold mb-1">
          {pet.name}
          <span className="text-sm text-text-dim ml-2">{def?.name ?? pet.petId}</span>
        </h3>
        {def?.desc && <p className="text-xs text-text-dim mb-3 leading-relaxed">{def.desc}</p>}

        <div className="border border-border px-3 py-2 mb-3 text-xs space-y-1">
          <div>
            等级 <span className="text-gold">Lv.{pet.level}</span> / {PET_MAX_LEVEL}
            <span className="text-text-dim ml-2">经验 {pet.exp}/{petExpNeed(pet.level)}</span>
          </div>
          <div>
            亲密 <span className="text-jade">{pet.bond}</span>/100
            <span className="text-text-dim ml-2">
              岗位 {pet.job === 'farm' ? '灵田协助' : pet.job === 'guard' ? '看家' : '闲居'}
            </span>
          </div>
          <div>
            协战加成{' '}
            {pet.fight ? (
              <>
                <span className="text-jade">攻击 +{(stat.atk * 100).toFixed(1)}%</span>
                {' · '}
                <span className="text-jade">气血 +{(stat.hp * 100).toFixed(1)}%</span>
              </>
            ) : (
              <span className="text-text-dim">歇战中，未生效</span>
            )}
          </div>
          <div>
            辅助技 <span className="text-gold">{def?.skillName ?? '—'}</span>
            {def?.skillDesc ? `：${def.skillDesc}` : ''}
            <span className="text-text-dim">（触发率 {(chance * 100).toFixed(0)}%）</span>
          </div>
          <div className="text-text-dim">
            {pet.fight ? '出战中' : '歇战'}
            {pet.broken
              ? ' · 已突破（属性 ×1.15）'
              : pet.level >= PET_BREAK_LEVEL
                ? ' · 可突破'
                : ` · 未突破（Lv.${PET_BREAK_LEVEL} 可突破）`}
            {pet.restUntilDay > 0 ? ' · 休养中' : ''}
          </div>
        </div>

        <div className="text-xs text-gold mb-1">可喂食灵药</div>
        <p className="text-[11px] text-text-dim mb-2 leading-relaxed">
          灵兽可食灵草与丹药：{foodNames}。每份 +{PET_FEED_EXP} 经验、亲密 +2；御兽之道会提高经验。
        </p>
        {pet.level >= PET_MAX_LEVEL && (
          <p className="text-[11px] text-gold-dim mb-2">已至 Lv.{PET_MAX_LEVEL}，继续喂食只增加亲密度。</p>
        )}

        {ownedFoods.length === 0 ? (
          <p className="text-xs text-vermilion mb-3">背包里暂无可喂食的灵药。</p>
        ) : (
          <div className="space-y-2 mb-3">
            {ownedFoods.map((id) => {
              const item = ITEMS[id]
              const owned = inventory[id] ?? 0
              const count = Math.min(owned, Math.max(1, counts[id] ?? 1))
              return (
                <div key={id} className="border border-border px-3 py-2">
                  <div className="flex flex-wrap justify-between items-baseline gap-x-2 text-xs">
                    <span className="text-text">{item?.name ?? id}</span>
                    <span className="text-text-dim">
                      拥有 ×{owned} · 每份 +{PET_FEED_EXP} 经验
                    </span>
                  </div>
                  {item?.desc && <div className="text-[11px] text-text-dim mt-0.5">{item.desc}</div>}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <input
                      type="number"
                      min={1}
                      max={owned}
                      value={count}
                      onChange={(e) => {
                        const n = Math.floor(Number(e.target.value))
                        setCounts((prev) => ({
                          ...prev,
                          [id]: Number.isFinite(n) ? Math.max(1, Math.min(owned, n)) : 1,
                        }))
                      }}
                      className="bg-black/30 border border-border px-2 py-1 w-16 text-xs"
                    />
                    <button
                      type="button"
                      className="pixel-btn primary text-xs"
                      onClick={() => feedPet(id, count)}
                    >
                      喂食 {count}
                    </button>
                    <button
                      type="button"
                      className="pixel-btn text-xs"
                      onClick={() => feedPet(id, owned)}
                    >
                      全部喂食（{owned}）
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="button" className="pixel-btn text-xs" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
