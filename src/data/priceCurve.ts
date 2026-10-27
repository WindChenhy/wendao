import type { ItemDef, RealmId } from '../types'
import { REALM_ORDER } from './realms'

/**
 * v1.7 数值平衡 · 坊市价格曲线（**唯一口径**）
 *
 * 背景：旧版物品售价是手填的绝对值，顶价只到五百万（渡劫「劫雷洗髓丹·五纹」），
 * 而后期灵石收入是「历练单次百万、秘境单次亿级」——买任何东西都毫无压力，
 * 灵石在后期彻底溢出。
 *
 * 方案：**按「品阶档位」分档抬价**。档位 = 物品品阶序号 - 1，恰等于其对应境界序号
 * （一品丹/一阶灵物/一阶法宝 ↔ 练气，九品丹 ↔ 渡劫），故档位表与境界表共用一套系数。
 *
 * 关键点——**为什么按品阶而不是按 minRealm 分档**：
 * 五纹丹与其无纹母本往往差一个大境界（如「金丹玉露丸」筑基可用、五纹版要金丹），
 * 若按 minRealm 分档，五纹版会被抬得更多，直接击穿
 * 「五纹丹每点药效成本 ≤ 无纹 3 倍」的口径（见 content.test.ts R-02）。
 * 按品阶分档则同系列同系数，所有既有相对价差（丹纹倍率、同档强弱、丹方经济性）原样保留。
 *
 * 系数自元婴档起约 ×1.9/档抬升，使各境顶价与同期秘境单次收益维持在同一比例（约 0.1~0.4）。
 */
export const MARKET_PRICE_TIER_MUL = [1, 1.2, 1.5, 2.6, 5, 12, 28, 70, 190] as const

/** 档位序号 → 售价系数（越界夹取，防脏数据取到 undefined） */
export function priceTierMul(tierIndex: number): number {
  const i = Math.max(0, Math.min(MARKET_PRICE_TIER_MUL.length - 1, Math.floor(tierIndex)))
  return MARKET_PRICE_TIER_MUL[i]
}

/** 大境界 → 售价系数（功法秘籍等只带境界的货品用此口径；与品阶档位同轴） */
export function priceRealmMul(realm: RealmId): number {
  const i = REALM_ORDER.indexOf(realm)
  return priceTierMul(i < 0 ? 0 : i)
}

/** 物品品阶（丹药品阶 / 灵物品阶 / 法宝品阶）；无品阶者按一阶（不抬价） */
export function itemPriceTier(item: Pick<ItemDef, 'pillGrade' | 'herbTier' | 'treasureTier'>): number {
  return item.pillGrade ?? item.herbTier ?? item.treasureTier ?? 1
}

/** 按品阶档位缩放售价；无品阶或价 ≤0 时原样返回（如不可交易的剧情物） */
export function scaledPrice(
  price: number,
  item: Pick<ItemDef, 'pillGrade' | 'herbTier' | 'treasureTier'>,
): number {
  if (!price || price <= 0) return price
  return Math.max(1, Math.round(price * priceTierMul(itemPriceTier(item) - 1)))
}
