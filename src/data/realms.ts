import type { RealmDef, RealmId } from '../types'

/** 经验曲线：跨境界指数抬升；层内 1.5^(layer-1) */
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

/** 每层所需修为：跨境界大幅抬升，层内按 1.5 的幂增长 */
export function expNeeded(realm: RealmId, layer: number): number {
  const def = REALMS[realm]
  if (realm === 'ascended') return 0
  return Math.floor(def.expPerLayer * Math.pow(1.5, Math.max(0, layer - 1)))
}

/** 境界带来的基础气血：大境界基数逐级抬升，小层每层 +3%（第 9 层约 +24%） */
export function realmMaxHp(realm: RealmId, hpMul: number, layer = 1): number {
  const ri = Math.max(0, realmIndex(realm))
  const base = 200 + ri * 120 + Math.pow(ri, 2.2) * 30
  const layerMul = 1 + (Math.max(1, layer) - 1) * 0.03
  return Math.floor(base * layerMul * hpMul)
}

/** 境界带来的基础灵力/魔元：大境界基数逐级抬升，小层每层 +3% */
export function realmMaxEnergy(realm: RealmId, isDemon: boolean, layer = 1): number {
  const ri = Math.max(0, realmIndex(realm))
  const base = 160 + ri * 90 + Math.pow(ri, 2.2) * 20
  const layerMul = 1 + (Math.max(1, layer) - 1) * 0.03
  return Math.floor((isDemon ? base * 1.1 : base) * layerMul)
}

/** 战斗力粗略估值 */
export function combatPower(realm: RealmId, layer: number, atk: number, def: number, hp: number): number {
  const ri = realmIndex(realm) + 1
  return Math.floor((ri + 1) * 1000 + layer * 80 + atk * 3 + def * 2 + hp * 0.5)
}
