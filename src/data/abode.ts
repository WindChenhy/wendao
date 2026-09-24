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

/** v1.0 网格灵田：初始 6×6=36，最大 16×8=128（桃源乡式开拓） */
export const FARM_BASE_COLS = 6
export const FARM_BASE_ROWS = 6
export const FARM_MAX_COLS = 16
export const FARM_MAX_ROWS = 8
export const FARM_MAX_COUNT = FARM_MAX_COLS * FARM_MAX_ROWS // 128

/** 开拓一列（右侧荒地）费用 */
export function expandColCost(cols: number): number {
  const n = Math.max(1, cols - FARM_BASE_COLS + 1)
  return Math.floor(600 * Math.pow(1.4, n - 1) + 200 * n)
}

/** 开拓一行（下方荒地）费用 */
export function expandRowCost(rows: number): number {
  const n = Math.max(1, rows - FARM_BASE_ROWS + 1)
  return Math.floor(800 * Math.pow(1.4, n - 1) + 250 * n)
}

export function canExpandFarmCols(cols: number): boolean {
  return cols < FARM_MAX_COLS
}

export function canExpandFarmRows(rows: number): boolean {
  return rows < FARM_MAX_ROWS
}
