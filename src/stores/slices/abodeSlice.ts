import {
  canExpandFarmCols,
  canExpandFarmRows,
  expandColCost,
  expandRowCost,
  JULING_MAX_LEVEL,
  julingUpgradeCost,
  RECIPES,
  SEEDS,
} from '../../data/abode'
import {
  artifactDisplayName,
  decomposeYield,
  describeAffix,
  describeArtifact,
  forgeLevelDef,
  rollAffixIds,
  refineCost,
  type ArtifactQuality,
} from '../../data/artifacts'
import { ITEMS } from '../../data/items'
import { buildingCraftRateBonus } from '../../data/sectBuildings'
import { canForge, consumeForgeMaterials, performCraft } from '../../game/artifactCraft'
import { advanceTime, dayNumber } from '../../game/day'
import { canCraft, craftRate, harvestYield, plotProgress, remapFarmPlots } from '../../game/farm'
import { addItem, removeItem } from '../../game/inventory'
import { isAscended } from '../../game/reincarnate'
import {
  afterProgressSnapshot,
  artifactCraftDays,
  bumpDaily,
  log,
  recomputeVitals,
  unlockCodex,
} from '../helpers'
import type { GameState, MetaGet, MetaSet } from '../gameState'

/** abode 域：灵田（种植/收获/开拓）、炼丹、器阁（打造/洗练/认主/分解）、聚灵阵 */
export function createAbodeSlice(
  set: MetaSet,
  get: MetaGet,
): Pick<
  GameState,
  | 'buySeed'
  | 'plantSeed'
  | 'plantAll'
  | 'harvestPlot'
  | 'harvestAll'
  | 'expandFarmCol'
  | 'expandFarmRow'
  | 'craftItem'
  | 'upgradeForge'
  | 'upgradeJuling'
  | 'forgeArtifact'
  | 'refineArtifact'
  | 'equipArtifact'
  | 'decomposeArtifact'
> {
  return {
    buySeed: (seedId) => {
      const { stones, inventory, player } = get()
      const seed = SEEDS[seedId]
      if (!seed || !player || stones < seed.seedPrice) return
      const inv = { ...inventory }
      addItem(inv, seedId)
      log(`购入「${seed.name}」×1，花费灵石 ${seed.seedPrice}`, 'dim')
      set({ inventory: inv, stones: stones - seed.seedPrice })
    },

    plantSeed: (plotIndex, seedId) => {
      const { abode, inventory, player, time } = get()
      if (!player || !player.alive || isAscended(player)) return
      const plot = abode.plots[plotIndex]
      if (!plot || plot.seedId) return
      const seed = SEEDS[seedId]
      if (!seed || (inventory[seedId] ?? 0) <= 0) {
        log('没有种子。', 'bad')
        return
      }
      const inv = { ...inventory }
      removeItem(inv, seedId)
      const plots = abode.plots.map((p, i) =>
        i === plotIndex ? { seedId, plantedDay: dayNumber(time) } : p,
      )
      log(`在灵田种下「${seed.name}」，约 ${seed.growDays} 日可熟。`, 'good')
      set({ inventory: inv, abode: { ...abode, plots } })
    },

    harvestPlot: (plotIndex) => {
      const { abode, inventory, player, time } = get()
      if (!player || !player.alive) return
      const plot = abode.plots[plotIndex]
      if (!plot?.seedId) return
      const prog = plotProgress(plot, time)
      if (!prog.ready) {
        log('尚未成熟。', 'dim')
        return
      }
      const seed = SEEDS[plot.seedId]
      const amount = harvestYield(plot.seedId)
      const inv = { ...inventory }
      addItem(inv, seed.yieldItemId, amount)
      const plots = abode.plots.map((p, i) => (i === plotIndex ? { seedId: null, plantedDay: 0 } : p))
      log(`收获「${ITEMS[seed.yieldItemId]?.name ?? seed.yieldItemId}」×${amount}。`, 'gold')
      set({ inventory: inv, abode: { ...abode, plots } })
      bumpDaily(get, set, 'harvest')
    },

    plantAll: (seedId) => {
      const { abode, inventory, player, time } = get()
      if (!player || !player.alive || isAscended(player)) return
      const seed = SEEDS[seedId]
      if (!seed) return
      if ((inventory[seedId] ?? 0) <= 0) {
        log('没有这种种子。', 'bad')
        return
      }
      const emptyIdx = abode.plots.map((p, i) => (!p.seedId ? i : -1)).filter((i) => i >= 0)
      if (emptyIdx.length === 0) {
        log('没有闲置的灵田。', 'dim')
        return
      }
      const n = Math.min(inventory[seedId] ?? 0, emptyIdx.length)
      const inv = { ...inventory }
      removeItem(inv, seedId, n)
      const plantedDay = dayNumber(time)
      // 只种前 n 块空田（受库存数量限制）
      const targetSet = new Set(emptyIdx.slice(0, n))
      const plots = abode.plots.map((p, i) => (targetSet.has(i) ? { seedId, plantedDay } : p))
      log(`一键播种「${seed.name}」×${n}，约 ${seed.growDays} 日可熟。`, 'good')
      set({ inventory: inv, abode: { ...abode, plots } })
    },

    harvestAll: () => {
      const { abode, inventory, player, time } = get()
      if (!player || !player.alive) return
      const totals: Record<string, number> = {}
      let count = 0
      const inv = { ...inventory }
      const plots = abode.plots.map((plot) => {
        if (!plot.seedId) return plot
        const prog = plotProgress(plot, time)
        if (!prog.ready) return plot
        const seed = SEEDS[plot.seedId]
        const amount = harvestYield(plot.seedId)
        addItem(inv, seed.yieldItemId, amount)
        addItem(totals, seed.yieldItemId, amount)
        count += 1
        return { seedId: null, plantedDay: 0 }
      })
      if (count === 0) {
        log('没有可收获的灵植。', 'dim')
        return
      }
      const detail =
        Object.entries(totals)
          .map(([id, n]) => `${ITEMS[id]?.name ?? id}×${n}`)
          .join('、') || '无'
      log(`一键收获 ${count} 块灵田：${detail}。`, 'gold')
      set({ inventory: inv, abode: { ...abode, plots } })
      bumpDaily(get, set, 'harvest', count)
    },

    expandFarmCol: () => {
      const { abode, stones, player } = get()
      if (!player || !player.alive) return
      if (!canExpandFarmCols(abode.farmCols)) {
        log('灵田横向已开拓至极限。', 'dim')
        return
      }
      const cost = expandColCost(abode.farmCols)
      if (stones < cost) {
        log(`开拓一列灵田需灵石 ${cost}。`, 'bad')
        return
      }
      const newCols = abode.farmCols + 1
      const plots = remapFarmPlots(
        abode.plots,
        abode.farmCols,
        abode.farmRows,
        newCols,
        abode.farmRows,
      )
      log(
        `向右开拓荒地，灵田扩为 ${newCols}×${abode.farmRows}（${plots.length} 格），花费灵石 ${cost}。`,
        'gold',
      )
      set({
        stones: stones - cost,
        abode: { ...abode, farmCols: newCols, plots },
      })
    },

    expandFarmRow: () => {
      const { abode, stones, player } = get()
      if (!player || !player.alive) return
      if (!canExpandFarmRows(abode.farmRows)) {
        log('灵田纵向已开拓至极限。', 'dim')
        return
      }
      const cost = expandRowCost(abode.farmRows)
      if (stones < cost) {
        log(`开拓一行灵田需灵石 ${cost}。`, 'bad')
        return
      }
      const newRows = abode.farmRows + 1
      const plots = remapFarmPlots(
        abode.plots,
        abode.farmCols,
        abode.farmRows,
        abode.farmCols,
        newRows,
      )
      log(
        `向前开拓荒地，灵田扩为 ${abode.farmCols}×${newRows}（${plots.length} 格），花费灵石 ${cost}。`,
        'gold',
      )
      set({
        stones: stones - cost,
        abode: { ...abode, farmRows: newRows, plots },
      })
    },

    craftItem: (recipeId) => {
      const { player, inventory, time } = get()
      if (!player || !player.alive || isAscended(player)) return
      const recipe = RECIPES[recipeId]
      if (!recipe) return
      if (!canCraft(recipe, inventory)) {
        log('药材不足。', 'bad')
        return
      }
      const rate = Math.min(98, craftRate(recipe, player.classId, get().legacy.daoMarks) + buildingCraftRateBonus(get().sect.buildings))
      const inv = { ...inventory }
      for (const input of recipe.inputs) {
        removeItem(inv, input.itemId, input.count)
      }
      const advanced = advanceTime(time, recipe.craftDays)
      const aged = player.age + advanced.agedYears
      const life = player.lifespanLeft - advanced.agedYears
      if (life <= 0) {
        set({
          time: advanced.time,
          inventory: inv,
          player: { ...player, age: aged, lifespanLeft: 0, alive: false },
        })
        log('炼丹耗神，寿元耗尽……', 'bad')
        return
      }
      const success = Math.random() * 100 < rate
      if (success) {
        addItem(inv, recipe.outputItemId, recipe.outputCount)
        log(
          `丹成！「${ITEMS[recipe.outputItemId]?.name ?? recipe.outputItemId}」×${recipe.outputCount}`,
          'gold',
        )
        const metaCraft = get().meta
        set({
          time: advanced.time,
          inventory: inv,
          player: { ...player, age: aged, lifespanLeft: life },
          meta: {
            ...metaCraft,
            stats: { ...metaCraft.stats, pillsCrafted: metaCraft.stats.pillsCrafted + 1 },
          },
        })
        unlockCodex(get, set, 'item', recipe.outputItemId)
        afterProgressSnapshot(get, set)
        bumpDaily(get, set, 'craft')
        return
      } else {
        log('炉火失控，药材尽废……', 'bad')
      }
      set({
        time: advanced.time,
        inventory: inv,
        player: { ...player, age: aged, lifespanLeft: life },
      })
    },

    upgradeForge: () => {
      const { player, abode, stones, time } = get()
      if (!player || !player.alive || isAscended(player)) return
      const lv = abode.forgeLevel ?? 0
      const def = forgeLevelDef(lv)
      const next = forgeLevelDef(lv + 1)
      if (lv >= 3) {
        log('器阁已是天工，无可复加。', 'dim')
        return
      }
      if (stones < def.upgradeCost) {
        log(`升级器阁需灵石 ${def.upgradeCost}。`, 'bad')
        return
      }
      const days = lv === 0 ? 2 : def.upgradeDays || 2
      const advanced = advanceTime(time, days)
      const aged = player.age + advanced.agedYears
      const life = player.lifespanLeft - advanced.agedYears
      if (life <= 0) {
        set({
          time: advanced.time,
          stones: stones - def.upgradeCost,
          player: { ...player, age: aged, lifespanLeft: 0, alive: false },
        })
        log('督造器阁操劳过度，寿元耗尽……', 'bad')
        return
      }
      const level = Math.min(3, lv + 1)
      set({
        time: advanced.time,
        stones: stones - def.upgradeCost,
        abode: { ...abode, forgeLevel: level },
        player: { ...player, age: aged, lifespanLeft: life },
      })
      log(`器阁升至 ${forgeLevelDef(level).name}（${next.name}）。可出品质上限：${forgeLevelDef(level).qualityCap}。`, 'gold')
    },

    upgradeJuling: () => {
      const { player, abode, stones, time } = get()
      if (!player || !player.alive || isAscended(player)) return
      const lv = abode.julingLevel ?? 0
      if (lv >= JULING_MAX_LEVEL) {
        log('聚灵阵已达最大规模。', 'dim')
        return
      }
      const cost = julingUpgradeCost(lv)
      if (stones < cost) {
        log(`布设聚灵阵需灵石 ${cost}。`, 'bad')
        return
      }
      const advanced = advanceTime(time, 1)
      const life = player.lifespanLeft - advanced.agedYears
      if (life <= 0) {
        set({
          time: advanced.time,
          stones: stones - cost,
          player: { ...player, age: player.age + advanced.agedYears, lifespanLeft: 0, alive: false },
        })
        log('布阵操劳过度，寿元耗尽……', 'bad')
        return
      }
      set({
        time: advanced.time,
        stones: stones - cost,
        abode: { ...abode, julingLevel: lv + 1 },
        player: { ...player, age: player.age + advanced.agedYears, lifespanLeft: life },
      })
      log(`聚灵阵扩至 ${lv + 1} 重：修炼与离线收益 +${(lv + 1) * 5}%。`, 'gold')
    },

    forgeArtifact: (recipeId) => {
      const { player, inventory, stones, abode, time, treasures, artifacts } = get()
      if (!player || !player.alive || isAscended(player)) return
      const forgeLevel = abode.forgeLevel ?? 0
      const chk = canForge({
        recipeId,
        inventory,
        stones,
        forgeLevel,
      })
      if (!chk.ok) {
        log(chk.reason ?? '无法打造。', 'bad')
        return
      }
      const outcome = performCraft({
        recipeId,
        classId: player.classId,
        daoMarks: get().legacy.daoMarks,
        forgeLevel,
      })
      const paid = consumeForgeMaterials(inventory, recipeId, stones)
      const craftDays = artifactCraftDays(recipeId)
      const advanced = advanceTime(time, craftDays)
      const aged = player.age + advanced.agedYears
      const life = player.lifespanLeft - advanced.agedYears
      if (life <= 0) {
        set({
          time: advanced.time,
          inventory: paid.inventory,
          stones: paid.stones,
          player: { ...player, age: aged, lifespanLeft: 0, alive: false },
        })
        log('炼器耗神，寿元耗尽……', 'bad')
        return
      }
      if (!outcome.ok || !outcome.instance) {
        set({
          time: advanced.time,
          inventory: paid.inventory,
          stones: paid.stones,
          player: { ...player, age: aged, lifespanLeft: life },
        })
        log(outcome.message, 'bad')
        return
      }
      let inst = outcome.instance
      // 无同类出战则自动认主
      const hasActive = treasures.includes(inst.itemId)
      if (!hasActive) {
        inst = { ...inst, equipped: true }
      }
      const nextArts = [...artifacts, inst]
      const nextTreasures = inst.equipped ? [...treasures, inst.itemId] : treasures
      set({
        time: advanced.time,
        inventory: paid.inventory,
        stones: paid.stones,
        artifacts: nextArts,
        treasures: nextTreasures,
        player: {
          ...recomputeVitals(
            get,
            { ...player, age: aged, lifespanLeft: life },
            nextTreasures,
            get().gongfa.learned,
            get().legacy.daoMarks,
            player.realm,
          ),
        },
      })
      log(outcome.message, 'gold')
      if (inst.affixes.length > 0) {
        log(`词条：${inst.affixes.map((a) => describeAffix(a)).join('、')}`, 'gold')
      }
      unlockCodex(get, set, 'item', inst.itemId)
      afterProgressSnapshot(get, set)
    },

    refineArtifact: (uid) => {
      const { player, artifacts, inventory, stones } = get()
      if (!player || !player.alive || isAscended(player)) return
      const art = artifacts.find((a) => a.uid === uid)
      if (!art) return
      const cost = refineCost(art.quality)
      if (stones < cost.stones) {
        log(`洗练需灵石 ${cost.stones}。`, 'bad')
        return
      }
      if (cost.mat && cost.matCount) {
        if ((inventory[cost.mat] ?? 0) < cost.matCount) {
          log(`洗练还需「${ITEMS[cost.mat]?.name ?? cost.mat}」×${cost.matCount}。`, 'bad')
          return
        }
      }
      const inv = { ...inventory }
      if (cost.mat && cost.matCount) {
        removeItem(inv, cost.mat, cost.matCount ?? 0)
      }
      const forgeLevel = get().abode.forgeLevel ?? 0
      const qualityCap = forgeLevelDef(forgeLevel).qualityCap
      let nextQuality: ArtifactQuality = art.quality
      if (art.quality === 'mortal') {
        nextQuality = qualityCap === 'mortal' ? 'spirit' : qualityCap
      }
      const nextArts = artifacts.map((a) =>
        a.uid === uid
          ? {
              ...a,
              quality: nextQuality,
              name: a.name || ITEMS[a.itemId]?.name || a.itemId,
              affixes:
                nextQuality === 'mortal' ? [] : rollAffixIds(nextQuality, qualityCap).map((id) => ({ id })),
            }
          : a,
      )
      set({
        inventory: inv,
        stones: stones - cost.stones,
        artifacts: nextArts,
      })
      log(`洗练「${artifactDisplayName(art.itemId, art.name)}」：${describeArtifact(nextArts.find((x) => x.uid === uid)!)}`, 'gold')
    },

    equipArtifact: (uid) => {
      const { artifacts, treasures, player } = get()
      if (!player) return
      const art = artifacts.find((a) => a.uid === uid)
      if (!art) return
      const nextArts = artifacts.map((a) => {
        if (a.uid === uid) return { ...a, equipped: true }
        if (a.itemId === art.itemId) return { ...a, equipped: false }
        return a
      })
      const nextTreasures = Array.from(
        new Set(nextArts.filter((a) => a.equipped).map((a) => a.itemId)),
      )
      // 保留旧认主列表中不在 artifacts 的 id（坊市直购等）
      for (const id of treasures) {
        if (!nextArts.some((a) => a.itemId === id) && !nextTreasures.includes(id)) {
          nextTreasures.push(id)
        }
      }
      set({
        artifacts: nextArts,
        treasures: nextTreasures,
        player: recomputeVitals(get, player, nextTreasures, get().gongfa.learned, get().legacy.daoMarks, player.realm),
      })
      log(`「${artifactDisplayName(art.itemId, art.name)}」已认主出战（同类仅一件生效）。`, 'dim')
    },

    decomposeArtifact: (uid) => {
      const { artifacts, inventory, player, treasures } = get()
      const art = artifacts.find((a) => a.uid === uid)
      if (!art) return
      const inv = { ...inventory }
      for (const y of decomposeYield(art.quality)) {
        addItem(inv, y.itemId, y.count)
      }
      const nextArts = artifacts.filter((a) => a.uid !== uid)
      const nextTreasures = art.equipped
        ? Array.from(
            new Set([
              ...nextArts.filter((a) => a.equipped).map((a) => a.itemId),
              ...treasures.filter((id) => id !== art.itemId || nextArts.some((a) => a.equipped && a.itemId === id)),
            ]),
          )
        : treasures
      set({
        artifacts: nextArts,
        inventory: inv,
        treasures: nextTreasures,
        player: player
          ? recomputeVitals(get, player, nextTreasures, get().gongfa.learned, get().legacy.daoMarks, player.realm)
          : player,
      })
      const yieldText = decomposeYield(art.quality)
        .map((y) => `${ITEMS[y.itemId]?.name ?? y.itemId}×${y.count}`)
        .join('、')
      log(`分解「${artifactDisplayName(art.itemId, art.name)}」，获得 ${yieldText}。`, 'dim')
    },
  }
}
