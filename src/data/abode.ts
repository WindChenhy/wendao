import type { ItemDef } from '../types'
import seedsJson from './db/seeds.json'
import herbsJson from './db/herbs.json'
import recipesJson from './db/recipes.json'

export interface SeedDef {
  id: string
  name: string
  desc: string
  /** 成熟所需游戏日 */
  growDays: number
  /** 收获产物 */
  yieldItemId: string
  yieldMin: number
  yieldMax: number
  /** 种子售价（坊市） */
  seedPrice: number
}

export interface RecipeDef {
  id: string
  name: string
  desc: string
  inputs: { itemId: string; count: number }[]
  outputItemId: string
  outputCount: number
  /** 炼制耗时（日） */
  craftDays: number
  /** 基础成功率 %（丹修更高） */
  baseRate: number
}

/** 静态数据源：src/data/db/*.json（内容与逻辑分离，改数值不必动 TS） */
function toRecord<T extends { id: string }>(list: T[]): Record<string, T> {
  return Object.fromEntries(list.map((x) => [x.id, x]))
}

export const SEEDS: Record<string, SeedDef> = toRecord(seedsJson as SeedDef[])

export const SEED_LIST = Object.values(SEEDS)

/** 灵植产物（材料） */
export const HERB_ITEMS: Record<string, ItemDef> = toRecord(herbsJson as ItemDef[])

export const RECIPES: Record<string, RecipeDef> = toRecord(recipesJson as RecipeDef[])

export const RECIPE_LIST = Object.values(RECIPES)

/** 灵田初始地块数 */
export const BASE_PLOTS = 2
export const MAX_PLOTS = 6

/** 扩建灵田花费（按当前地块数递增） */
export function expandPlotCost(currentPlots: number): number {
  return 80 * Math.pow(2, currentPlots - BASE_PLOTS)
}
