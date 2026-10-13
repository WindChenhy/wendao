import { isDemonic, playerMults, type PathInput } from '../data/classes'
import { materialName, requiredMaterial } from '../data/items'
import { REALMS, expNeeded, nextRealm } from '../data/realms'
import type { RealmId } from '../types'

interface BreakthroughResult {
  success: boolean
  severity: 'none' | 'minor' | 'major' | 'critical'
  rate: number
  message: string
}

/** 各目标大境界的破境异象（突破成功文案，按「冲入的境界」取） */
const BREAKTHROUGH_OMEN: Record<string, string> = {
  foundation: '灵气归窍，丹田初成',
  golden_core: '金液凝丹，丹成九转',
  nascent_soul: '元婴出窍，神游太虚',
  spirit_sea: '神念化虚，识海自成天地',
  void: '虚空炼形，身与太虚相合',
  integration: '法体合一，形神相融',
  mahayana: '大乘气象，万法归元',
  tribulation: '天劫加身，雷云压顶',
  ascended: '霞举飞升，超脱此界',
}

export function breakthroughRate(paths: PathInput, realm: RealmId): number {
  const base = REALMS[realm].breakthroughBaseRate
  const bonus = playerMults(paths).breakthroughBonus
  return Math.max(5, Math.min(92, base + bonus))
}

/**
 * 冲击壁垒判定。rateOverride 为含宗门/道侣/法宝/丹药/天劫方案后的最终成功率，
 * 必须与结算使用同一 rate，避免「成功升级却打出失败文案」。
 */
export function attemptBreakthrough(
  paths: PathInput,
  realm: RealmId,
  layer: number,
  roll?: number,
  rateOverride?: number,
): BreakthroughResult {
  const def = REALMS[realm]
  const rate = rateOverride ?? breakthroughRate(paths, realm)
  const r = roll ?? Math.random() * 100
  const isMajorCross = layer >= def.layers
  const isTribulation = realm === 'tribulation' || realm === 'mahayana'
  const mat = isMajorCross ? requiredMaterial(realm, layer) : null
  // 方案 §2.3-A：魔道突破天劫换皮为心魔劫/煞火焚身
  const isDemon = isDemonic(paths)
  const target = nextRealm(realm)
  const targetName = REALMS[target ?? realm].name
  const omen = BREAKTHROUGH_OMEN[target ?? ''] ?? '气机贯通，境界跃迁'

  if (r < rate) {
    return {
      success: true,
      severity: 'none',
      rate,
      message: isMajorCross
        ? isDemon
          ? `${mat ? materialName(mat) + '化开，' : ''}心魔退散，煞火焚身而不侵；${omen}，你踏入「${targetName}」！`
          : `${mat ? materialName(mat) + '化开，' : ''}${omen}，你踏入「${targetName}」！`
        : `灵力贯通，境界稳固于${def.name}${Math.min(def.layers, layer + 1)}层。`,
    }
  }

  if (isTribulation && r > rate + 35) {
    return {
      success: false,
      severity: 'critical',
      rate,
      message: isDemon
        ? '心魔劫反噬，煞气逆乱，道基崩裂！重伤并损失大量修为。'
        : '天劫反噬，道基崩裂！重伤并损失大量修为。',
    }
  }
  if (isMajorCross) {
    return {
      success: false,
      severity: 'major',
      rate,
      message: isDemon
        ? `突破${def.name}圆满失败${mat ? `（${materialName(mat)}可镇煞护脉）` : ''}，煞气逆冲，境界跌落一层。`
        : `突破${def.name}圆满失败${mat ? `（${materialName(mat)}可保灵力不失）` : ''}，气血逆冲，境界跌落一层。`,
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