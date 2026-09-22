import { BASE_PLOTS, RECIPES, SEEDS, type RecipeDef } from '../data/abode'
import type { AbodeState, ClassId, GameTime, PlotState } from '../types'
import { dayNumber } from './day'

export function freshAbode(): AbodeState {
  return {
    plots: Array.from({ length: BASE_PLOTS }, () => ({ seedId: null, plantedDay: 0 })),
    forgeLevel: 0,
  }
}

/** 旧档迁移：补器阁等级 */
export function migrateAbode(raw: unknown): AbodeState {
  const base = freshAbode()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<AbodeState> & { plots?: PlotState[] }
  const plots =
    Array.isArray(r.plots) && r.plots.length > 0
      ? r.plots.map((p) => ({ seedId: p?.seedId ?? null, plantedDay: Number(p?.plantedDay) || 0 }))
      : base.plots
  return {
    plots,
    forgeLevel: Math.max(0, Math.min(3, Number(r.forgeLevel) || 0)),
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

export function recipeById(id: string): RecipeDef | null {
  return RECIPES[id] ?? null
}
