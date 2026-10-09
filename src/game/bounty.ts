import { isRighteousParagon, REP_MARKET_DISCOUNT } from './reputation'
import { realmIndex } from '../data/realms'
import type { RealmId } from '../types'

/** 通缉上限档位（0=无通缉） */
export const WANTED_MAX = 5
/** 通缉 ≥2 后每次历练触发「正道追杀」的概率 */
export const WANTED_HUNT_CHANCE = 0.15
/** 通缉 ≥4 起正道商会对钦犯溢价 */
export const WANTED_PREMIUM_THRESHOLD = 4
export const WANTED_MARKET_PREMIUM = 0.2

export function clampWanted(n: number): number {
  return Math.max(0, Math.min(WANTED_MAX, Math.floor(n)))
}

/** 通缉达阈值后每次历练被追杀概率；未达阈值为 0 */
export function wantedHuntChance(wanted: number): number {
  return wanted >= 2 ? WANTED_HUNT_CHANCE : 0
}

/** 坊市溢价倍率（通缉 ≥4 时 +20%） */
export function marketPremiumMul(wanted: number): number {
  return wanted >= WANTED_PREMIUM_THRESHOLD ? 1 + WANTED_MARKET_PREMIUM : 1
}

/** 坊市实际成交价：基础价 × 溢价 × 正道名宿折扣 */
export function marketPriceOf(basePrice: number, opts: { wanted: number; repRight: number }): number {
  let mul = marketPremiumMul(opts.wanted)
  if (isRighteousParagon(opts.repRight)) mul *= REP_MARKET_DISCOUNT
  return Math.max(1, Math.floor(basePrice * mul))
}

/** 赎罪花费：wanted × 200 × 境界系数（1 + 0.5/大境界） */
export function atonementCost(wanted: number, realm: RealmId): number {
  return Math.floor(wanted * 200 * (1 + realmIndex(realm) * 0.5))
}

const WANTED_NUMERALS = ['', 'Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ']

/** 通缉档位罗马数字（0 返回空串） */
export function wantedLabel(wanted: number): string {
  return WANTED_NUMERALS[clampWanted(wanted)] ?? ''
}
