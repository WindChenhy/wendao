import { ASCENSION_REALM, REALMS } from '../data/realms'
import type { RealmId } from '../types'

/**
 * 突破延寿规则（R-20，决策 D-4 拍板 A：寿元是消耗品）。
 *
 * 旧规则：突破成功即把寿元补到新境上限（max(剩余, 新境满寿元)），等于"突破续命回满"，
 * 与读档兜底规则不一致，也让"有限寿元"失去压力。
 *
 * 新规则：突破只延寿、不回补 ——
 *   新剩余寿元 = 旧剩余 +（新境满寿元 − 旧境满寿元）× 规则倍率
 * - 小境界突破（仍在同一大境）：差值为 0，不延寿；
 * - 大境界突破：补上两境寿元上限之差，此前耗去的寿元不返还；
 * - 飞升为终局仙寿，数量级特殊，直接给足（由调用方在 toRealm='ascended' 时得到仙寿满值）。
 */
export function breakthroughLifespan(
  left: number,
  fromRealm: RealmId,
  toRealm: RealmId,
  lifespanMul = 1,
): number {
  const safeLeft = Math.max(0, Math.floor(left))
  if (toRealm === ASCENSION_REALM) {
    return Math.floor(REALMS[ASCENSION_REALM].lifespan * lifespanMul)
  }
  const delta = (REALMS[toRealm]?.lifespan ?? 0) - (REALMS[fromRealm]?.lifespan ?? 0)
  if (delta <= 0) return safeLeft
  return safeLeft + Math.floor(delta * lifespanMul)
}
