import type { ItemDef } from '../types'

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

export const SEEDS: Record<string, SeedDef> = {
  seed_qi: {
    id: 'seed_qi',
    name: '聚气草种',
    desc: '三日一熟，可炼聚气丹。',
    growDays: 3,
    yieldItemId: 'herb_qi',
    yieldMin: 2,
    yieldMax: 4,
    seedPrice: 20,
  },
  seed_moon: {
    id: 'seed_moon',
    name: '月华花种',
    desc: '七日开花，药性温润。',
    growDays: 7,
    yieldItemId: 'herb_moon',
    yieldMin: 1,
    yieldMax: 3,
    seedPrice: 45,
  },
  seed_blood: {
    id: 'seed_blood',
    name: '血参种',
    desc: '半月方成，气血大补。',
    growDays: 15,
    yieldItemId: 'herb_blood',
    yieldMin: 1,
    yieldMax: 2,
    seedPrice: 120,
  },
}

export const SEED_LIST = Object.values(SEEDS)

/** 灵植产物（材料） */
export const HERB_ITEMS: Record<string, ItemDef> = {
  herb_qi: {
    id: 'herb_qi',
    name: '聚气草',
    type: 'material',
    desc: '灵田所出灵植，可入药。',
    price: 18,
    effect: { exp: 25 },
  },
  herb_moon: {
    id: 'herb_moon',
    name: '月华花',
    type: 'material',
    desc: '月下凝露的灵花。',
    price: 50,
    effect: { hp: 40 },
  },
  herb_blood: {
    id: 'herb_blood',
    name: '血参',
    type: 'material',
    desc: '药力雄浑的血色参根。',
    price: 150,
    effect: { hp: 120, exp: 60 },
  },
}

export const RECIPES: Record<string, RecipeDef> = {
  craft_pill_qi: {
    id: 'craft_pill_qi',
    name: '炼聚气丹',
    desc: '草药入炉，凝作聚气丹。',
    inputs: [{ itemId: 'herb_qi', count: 2 }],
    outputItemId: 'pill_qi',
    outputCount: 1,
    craftDays: 1,
    baseRate: 85,
  },
  craft_pill_heal: {
    id: 'craft_pill_heal',
    name: '炼回春散',
    desc: '月华入引，可续气血。',
    inputs: [
      { itemId: 'herb_qi', count: 1 },
      { itemId: 'herb_moon', count: 1 },
    ],
    outputItemId: 'pill_heal',
    outputCount: 2,
    craftDays: 1,
    baseRate: 78,
  },
  craft_pill_great: {
    id: 'craft_pill_great',
    name: '炼凝元丹',
    desc: '血参为君，药力远胜聚气。',
    inputs: [
      { itemId: 'herb_blood', count: 1 },
      { itemId: 'herb_moon', count: 2 },
      { itemId: 'herb_qi', count: 3 },
    ],
    outputItemId: 'pill_great',
    outputCount: 1,
    craftDays: 2,
    baseRate: 62,
  },
}

export const RECIPE_LIST = Object.values(RECIPES)

/** 灵田初始地块数 */
export const BASE_PLOTS = 2
export const MAX_PLOTS = 6

/** 扩建灵田花费（按当前地块数递增） */
export function expandPlotCost(currentPlots: number): number {
  return 80 * Math.pow(2, currentPlots - BASE_PLOTS)
}
