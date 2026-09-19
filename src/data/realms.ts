import type { RealmDef, RealmId } from '../types'

/** 经验曲线参考值：仅作境界节奏展示；实际所需修为见 expNeeded（全程连续递增） */
export const REALMS: Record<RealmId, RealmDef> = {
  qi: {
    id: 'qi',
    name: '练气',
    layers: 9,
    expPerLayer: 80,
    breakthroughBaseRate: 75,
    lifespan: 200,
  },
  foundation: {
    id: 'foundation',
    name: '筑基',
    layers: 9,
    expPerLayer: 320,
    breakthroughBaseRate: 60,
    lifespan: 400,
  },
  golden_core: {
    id: 'golden_core',
    name: '金丹',
    layers: 9,
    expPerLayer: 1200,
    breakthroughBaseRate: 48,
    lifespan: 800,
  },
  nascent_soul: {
    id: 'nascent_soul',
    name: '元婴',
    layers: 9,
    expPerLayer: 4500,
    breakthroughBaseRate: 36,
    lifespan: 1500,
  },
  spirit_sea: {
    id: 'spirit_sea',
    name: '化神',
    layers: 9,
    expPerLayer: 16000,
    breakthroughBaseRate: 28,
    lifespan: 3000,
  },
  void: {
    id: 'void',
    name: '炼虚',
    layers: 9,
    expPerLayer: 60000,
    breakthroughBaseRate: 20,
    lifespan: 5000,
  },
  integration: {
    id: 'integration',
    name: '合体',
    layers: 9,
    expPerLayer: 220000,
    breakthroughBaseRate: 14,
    lifespan: 8000,
  },
  mahayana: {
    id: 'mahayana',
    name: '大乘',
    layers: 9,
    expPerLayer: 800000,
    breakthroughBaseRate: 10,
    lifespan: 15000,
  },
  tribulation: {
    id: 'tribulation',
    name: '渡劫',
    layers: 3,
    expPerLayer: 3000000,
    breakthroughBaseRate: 6,
    lifespan: 20000,
  },
  ascended: {
    id: 'ascended',
    name: '飞升',
    layers: 1,
    expPerLayer: 0,
    breakthroughBaseRate: 0,
    lifespan: 999999,
  },
}

export const REALM_ORDER: RealmId[] = [
  'qi',
  'foundation',
  'golden_core',
  'nascent_soul',
  'spirit_sea',
  'void',
  'integration',
  'mahayana',
  'tribulation',
  'ascended',
]

export function realmIndex(realm: RealmId): number {
  return REALM_ORDER.indexOf(realm)
}

export function realmLabel(realm: RealmId, layer: number): string {
  const def = REALMS[realm]
  if (realm === 'ascended') return '飞升'
  return `${def.name}${layer}层`
}

export function nextRealm(realm: RealmId): RealmId | null {
  const i = REALM_ORDER.indexOf(realm)
  if (i < 0 || i >= REALM_ORDER.length - 1) return null
  return REALM_ORDER[i + 1]
}

/** 连续曲线基准：练气一层 */
const EXP_BASE = 80
/**
 * 连续层步增长率。
 * 用全局层序号（跨大境界不重置）计算，保证「化神九层 → 炼虚一层」所需修为严格上升，
 * 而不会像旧公式那样在跨境界时因层号回到 1 而回落。
 * 取值使化神九层约 40 万量级，与原先后期体感接近。
 */
const EXP_GROWTH = 1.215

/** 战斗属性：随大境界指数抬升；大乘纯数值需达到百万量级 */
const HP_BASE = 200
const HP_GROWTH = 3.4
const EN_BASE = 180
const EN_GROWTH = 3.4
const ATK_BASE = 48
const ATK_GROWTH = 3.85
const DEF_BASE = 20
const DEF_GROWTH = 3.25

/** 该大境界之前累计层数（用于全局连续层序号） */
export function layersBeforeRealm(realm: RealmId): number {
  const ri = realmIndex(realm)
  if (ri <= 0) return 0
  let sum = 0
  for (let i = 0; i < ri; i++) {
    sum += REALMS[REALM_ORDER[i]]?.layers ?? 9
  }
  return sum
}

/**
 * 冲击下一层/下一大境界所需修为。
 * 按「练气一层起的全局连续层步」指数增长：境界越高、层越高，所需修为只增不减。
 */
export function expNeeded(realm: RealmId, layer: number): number {
  const def = REALMS[realm]
  if (realm === 'ascended' || !def) return 0
  const before = layersBeforeRealm(realm)
  const safeLayer = Math.max(1, Math.min(def.layers, layer))
  // 全局步号：0 = 练气一层
  const step = before + safeLayer - 1
  return Math.floor(EXP_BASE * Math.pow(EXP_GROWTH, step))
}

/** 层数对属性的小幅放大（每层 +4%） */
function layerMul(layer: number): number {
  return 1 + (Math.max(1, layer) - 1) * 0.04
}

/** 某大境界/层的战斗基准属性（未计职业、功法、法宝） */
export function realmCombatBase(realm: RealmId, layer = 1): {
  hp: number
  energy: number
  atk: number
  def: number
  ri: number
} {
  const ri = Math.max(0, realmIndex(realm))
  const lm = layerMul(layer)
  return {
    ri,
    hp: Math.floor(HP_BASE * Math.pow(HP_GROWTH, ri) * lm),
    energy: Math.floor(EN_BASE * Math.pow(EN_GROWTH, ri) * lm),
    atk: Math.floor((ATK_BASE + Math.max(1, layer) * 3) * Math.pow(ATK_GROWTH, ri) * lm),
    def: Math.floor((DEF_BASE + Math.max(1, layer) * 2) * Math.pow(DEF_GROWTH, ri) * lm),
  }
}

/** 境界带来的基础气血：随大境界指数抬升，小层每层 +4% */
export function realmMaxHp(realm: RealmId, hpMul: number, layer = 1): number {
  return Math.floor(realmCombatBase(realm, layer).hp * hpMul)
}

/** 境界带来的基础灵力/魔元：随大境界指数抬升 */
export function realmMaxEnergy(realm: RealmId, isDemon: boolean, layer = 1): number {
  const e = realmCombatBase(realm, layer).energy
  return Math.floor(isDemon ? e * 1.1 : e)
}

/** 战斗力粗略估值（与新属性曲线同阶） */
export function combatPower(realm: RealmId, layer: number, atk: number, def: number, hp: number): number {
  const ri = Math.max(0, realmIndex(realm))
  return Math.floor((ri + 1) * 2000 + layer * 120 + atk * 4 + def * 6 + hp * 0.15)
}