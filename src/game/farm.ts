import { SEEDS, FARM_BASE_COLS, FARM_BASE_ROWS, FARM_MAX_COLS, FARM_MAX_ROWS, type RecipeDef } from '../data/abode'
import type { AbodeState, ClassId, GameTime, PlotState } from '../types'
import { dayNumber } from './day'

export function makeFarmGrid(cols: number, rows: number): PlotState[] {
  return Array.from({ length: Math.max(0, cols * rows) }, () => ({ seedId: null, plantedDay: 0 }))
}

/** 网格重塑：扩大时保留左上原有种植，右侧/下侧补空地 */
export function remapFarmPlots(
  old: PlotState[],
  oldCols: number,
  oldRows: number,
  newCols: number,
  newRows: number,
): PlotState[] {
  const out = makeFarmGrid(newCols, newRows)
  for (let r = 0; r < Math.min(oldRows, newRows); r++) {
    for (let c = 0; c < Math.min(oldCols, newCols); c++) {
      const src = old[r * oldCols + c]
      if (src) out[r * newCols + c] = { seedId: src.seedId ?? null, plantedDay: Number(src.plantedDay) || 0 }
    }
  }
  return out
}

export function freshAbode(): AbodeState {
  const cols = FARM_BASE_COLS
  const rows = FARM_BASE_ROWS
  return {
    plots: makeFarmGrid(cols, rows),
    forgeLevel: 0,
    farmCols: cols,
    farmRows: rows,
  }
}

/** 旧档迁移：补齐网格灵田（不足 36 格扩到 6×6；超过则尽量排入网格）+ 器阁等级 */
export function migrateAbode(raw: unknown): AbodeState {
  const base = freshAbode()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<AbodeState> & { plots?: PlotState[] }
  const oldPlots = Array.isArray(r.plots)
    ? r.plots.map((p) => ({ seedId: p?.seedId ?? null, plantedDay: Number(p?.plantedDay) || 0 }))
    : []
  let cols = Math.max(FARM_BASE_COLS, Math.min(FARM_MAX_COLS, Number(r.farmCols) || FARM_BASE_COLS))
  let rows = Math.max(FARM_BASE_ROWS, Math.min(FARM_MAX_ROWS, Number(r.farmRows) || FARM_BASE_ROWS))
  // 旧档只有扁平 plots：按 6 列排入，不够则升到 6×6
  if (oldPlots.length > cols * rows) {
    cols = Math.min(FARM_MAX_COLS, Math.ceil(oldPlots.length / rows))
    if (oldPlots.length > cols * rows) {
      rows = Math.min(FARM_MAX_ROWS, Math.ceil(oldPlots.length / cols))
    }
    if (oldPlots.length > cols * rows) {
      cols = FARM_MAX_COLS
      rows = FARM_MAX_ROWS
    }
  }
  const plots = makeFarmGrid(cols, rows)
  for (let i = 0; i < Math.min(oldPlots.length, plots.length); i++) {
    plots[i] = oldPlots[i]
  }
  return {
    plots,
    forgeLevel: Math.max(0, Math.min(3, Number(r.forgeLevel) || 0)),
    farmCols: cols,
    farmRows: rows,
  }
}

export function plotProgress(plot: PlotState, now: GameTime): {
  ready: boolean
  growDays: number
  elapsed: number
  remain: number
} {
  if (!plot.seedId) return { ready: false, growDays: 0, elapsed: 0, remain: 0 }
  const seed = SEEDS[plot.seedId]
  if (!seed) return { ready: false, growDays: 0, elapsed: 0, remain: 0 }
  const elapsed = Math.max(0, dayNumber(now) - plot.plantedDay)
  const remain = Math.max(0, seed.growDays - elapsed)
  return { ready: remain <= 0, growDays: seed.growDays, elapsed, remain }
}

export function harvestYield(seedId: string): number {
  const seed = SEEDS[seedId]
  if (!seed) return 0
  return seed.yieldMin + Math.floor(Math.random() * (seed.yieldMax - seed.yieldMin + 1))
}

/** 炼丹成功率：基础 + 丹修加成 + 道痕 */
export function craftRate(recipe: RecipeDef, classId: ClassId, daoMarks: number): number {
  let rate = recipe.baseRate
  if (classId === 'alchemy') rate += 12
  rate += Math.min(10, Math.floor(daoMarks / 20))
  return Math.max(20, Math.min(98, rate))
}

export function canCraft(recipe: RecipeDef, inventory: Record<string, number>): boolean {
  return recipe.inputs.every((i) => (inventory[i.itemId] ?? 0) >= i.count)
}
