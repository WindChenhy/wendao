import { CLASSES } from '../data/classes'
import { materialName, requiredMaterial } from '../data/items'
import { REALMS, expNeeded, nextRealm } from '../data/realms'
import type { ClassId, RealmId } from '../types'

export interface BreakthroughResult {
  success: boolean
  severity: 'none' | 'minor' | 'major' | 'critical'
  rate: number
  message: string
}

export function breakthroughRate(classId: ClassId, realm: RealmId): number {
  const base = REALMS[realm].breakthroughBaseRate
  const bonus = CLASSES[classId].breakthroughBonus
  return Math.max(5, Math.min(92, base + bonus))
}

/**
 * 冲击壁垒判定。rateOverride 为含宗门/道侣/法宝/丹药/天劫方案后的最终成功率，
 * 必须与结算使用同一 rate，避免「成功升级却打出失败文案」。
 */
export function attemptBreakthrough(
  classId: ClassId,
  realm: RealmId,
  layer: number,
  roll?: number,
  rateOverride?: number,
): BreakthroughResult {
  const def = REALMS[realm]
  const rate = rateOverride ?? breakthroughRate(classId, realm)
  const r = roll ?? Math.random() * 100
  const isMajorCross = layer >= def.layers
  const isTribulation = realm === 'tribulation' || realm === 'mahayana'
  const mat = isMajorCross ? requiredMaterial(realm, layer) : null

  if (r < rate) {
    return {
      success: true,
      severity: 'none',
      rate,
      message: isMajorCross
        ? `${mat ? materialName(mat) + '化开，' : ''}雷云散尽，你踏入「${REALMS[nextRealm(realm) ?? realm].name}」！`
        : `灵力贯通，境界稳固于${def.name}${Math.min(def.layers, layer + 1)}层。`,
    }
  }

  if (isTribulation && r > rate + 35) {
    return {
      success: false,
      severity: 'critical',
      rate,
      message: '天劫反噬，道基崩裂！重伤并损失大量修为。',
    }
  }
  if (isMajorCross) {
    return {
      success: false,
      severity: 'major',
      rate,
      message: `突破${def.name}圆满失败${mat ? `（${materialName(mat)}可保灵力不失）` : ''}，气血逆冲，境界跌落一层。`,
    }
  }
  return {
    success: false,
    severity: 'minor',
    rate,
    message: '冲击壁垒失败，经脉受损，损失部分修为与气血。',
  }
}

export function canBreakthrough(realm: RealmId, layer: number, exp: number): boolean {
  return exp >= expNeeded(realm, layer)
}

export function applyLayerUp(realm: RealmId, layer: number): { realm: RealmId; layer: number } {
  if (layer < REALMS[realm].layers) {
    return { realm, layer: layer + 1 }
  }
  const nr = nextRealm(realm)
  if (!nr) return { realm, layer }
  return { realm: nr, layer: 1 }
}

export function applyLayerDown(realm: RealmId, layer: number): { realm: RealmId; layer: number } {
  if (layer > 1) return { realm, layer: layer - 1 }
  return { realm, layer }
}