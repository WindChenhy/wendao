import type { EnemyDef, RealmId } from '../types'
import { REALMS, REALM_ORDER, realmCombatBase } from './realms'
import enemiesDb from './db/enemies.json'

type EnemyTier = 'minion' | 'normal' | 'elite' | 'boss'

interface EnemyTemplate {
  id: string
  name: string
  faction: EnemyDef['faction']
  tier: EnemyTier
  /** 仅作风味；实战数值按玩家大境界动态缩放 */
  flavor: string
  /** 相对同境界玩家的强度系数（锚定无职业/功法加成的基准） */
  power: number
  /** 掉落：突破材料相对玩家大境界的偏移（0=当前，1=下一境） */
  matOffset: number
  dropRate?: number
  /**
   * 最低可遭遇大境界（缺省 = 练气即可）。
   * 防止「域外天魔」「黑水蛟王」这类设定上的后期/上古存在在练气期当路边怪。
   */
  minRealm?: RealmId
}

/** 历练模板：只决定形象/阵营/强度档，数值在玩家遭遇时按其大境界重算；数据见 src/data/db/enemies.json */
export const ENEMY_TEMPLATES: EnemyTemplate[] = enemiesDb as EnemyTemplate[]

/** 供图鉴展示（基表；实战数值随玩家境界浮动） */
export const ENEMIES: EnemyDef[] = ENEMY_TEMPLATES.map((t) => ({
  id: t.id,
  name: t.name,
  faction: t.faction,
  realm: 'qi' as RealmId,
  layer: 1,
  atk: 0,
  def: 0,
  hp: 0,
  loot: {
    stone: 0,
    exp: 0,
  },
  flavor: t.flavor,
}))

/** 玩家大境界对应可掉落的突破材料（取「下一境」材料更贴合历练价值） */
function matForRealmOffset(realmIdx: number, offset: number): string | undefined {
  const idx = Math.max(0, Math.min(REALM_ORDER.length - 2, realmIdx + offset))
  const realm = REALM_ORDER[idx]
  const map: Partial<Record<RealmId, string>> = {
    qi: 'mat_foundation',
    foundation: 'mat_core',
    golden_core: 'mat_soul',
    nascent_soul: 'mat_spirit',
    spirit_sea: 'mat_void',
    void: 'mat_integration',
    integration: 'mat_mahayana',
    // 大乘圆满冲渡劫必修「渡劫令」；杂兵线（matOffset 0）与头目线（matOffset 1）皆可用
    mahayana: 'mat_tribulation',
    tribulation: 'mat_tribulation',
  }
  return map[realm]
}

/**
 * 按玩家大境界/层数生成同档敌人。
 * 强度锚定「同境界无职业/功法加成的玩家基准」，power 决定档位。
 */
function scaleEnemyToPlayer(t: EnemyTemplate, realmIdx: number, playerLayer: number): EnemyDef {
  // 渡劫期保留可映射到 mat_tribulation；飞升不再刷材料
  const ri = Math.max(0, Math.min(REALM_ORDER.indexOf('tribulation'), realmIdx))
  const realm = REALM_ORDER[ri]
  const layerBias = t.tier === 'boss' ? 2 : t.tier === 'elite' ? 1 : t.tier === 'minion' ? -2 : 0
  // 层数上限取该大境界实际层数（勿写死 9：终局 ascended 仅 1 层）
  const layer = Math.max(1, Math.min(REALMS[realm]?.layers ?? 9, playerLayer + layerBias))
  const base = realmCombatBase(realm, layer)
  const p = t.power

  // 与玩家同境界基准对齐；power 决定档位（杂兵/寻常/精英/头目）
  const atk = Math.max(1, Math.floor(base.atk * 0.92 * p))
  const def = Math.max(0, Math.floor(base.def * 0.75 * p))
  const hp = Math.max(1, Math.floor(base.hp * 0.48 * p))

  const tierLootMul = t.tier === 'boss' ? 3.2 : t.tier === 'elite' ? 1.5 : t.tier === 'minion' ? 0.7 : 1
  const realmLootMul = Math.pow(2.15, ri)
  const stone = Math.floor((12 + layer * 3) * realmLootMul * tierLootMul * p)
  const expGain = Math.floor((20 + layer * 6) * realmLootMul * tierLootMul * p)
  const itemId = matForRealmOffset(ri, t.matOffset)

  return {
    id: `${t.id}_${realm}_${layer}`,
    name: t.tier === 'boss' ? `${t.name}` : `${t.name}·${REALMS[realm]?.name}${layer}`,
    faction: t.faction,
    realm,
    layer,
    atk,
    def,
    hp,
    loot: {
      stone,
      exp: expGain,
      itemId,
      dropRate: t.dropRate ?? (t.tier === 'minion' ? 0.05 : 0.2),
    },
    flavor: t.flavor,
  }
}

export function pickEnemy(playerRealmIndex: number, playerLayer: number): EnemyDef {
  const ri = Math.max(0, playerRealmIndex)
  const layer = Math.max(1, playerLayer)

  // 高境界更常遭遇精英/头目；练气期以杂兵、普通为主
  const bossChance = Math.min(0.28, 0.06 + ri * 0.03)
  const eliteChance = Math.min(0.4, 0.15 + ri * 0.04)
  const roll = Math.random()
  const wantTier: EnemyTier =
    roll < bossChance ? 'boss' : roll < bossChance + eliteChance ? 'elite' : roll < 0.75 ? 'normal' : 'minion'

  // 境界门槛：后期/上古存在不在低境界刷出（如域外天魔 ≥化神）
  const inRealm = (t: EnemyTemplate) =>
    !t.minRealm || ri >= REALM_ORDER.indexOf(t.minRealm)
  let pool = ENEMY_TEMPLATES.filter((t) => t.tier === wantTier && inRealm(t))
  if (pool.length === 0) pool = ENEMY_TEMPLATES.filter((t) => inRealm(t) && t.tier === 'normal')
  if (pool.length === 0) pool = ENEMY_TEMPLATES.filter((t) => t.tier === 'normal')
  if (pool.length === 0) pool = ENEMY_TEMPLATES
  const template = pool[Math.floor(Math.random() * pool.length)]
  return scaleEnemyToPlayer(template, ri, layer)
}

/**
 * 奇遇/事件战斗的敌人：按 bossId 取模板并随玩家大境界缩放。
 * 此前事件战斗直接取图鉴基表（atk/def/hp 全 0），导致一切奇遇战斗必胜、失败分支成死内容。
 * bossId 未命中模板时回退为同境界寻常敌人，绝不返回空壳。
 */
export function eventEnemy(
  bossId: string | undefined,
  playerRealmIndex: number,
  playerLayer: number,
): EnemyDef {
  const t = bossId ? ENEMY_TEMPLATES.find((x) => x.id === bossId) : undefined
  if (!t) return pickEnemy(playerRealmIndex, playerLayer)
  return scaleEnemyToPlayer(t, Math.max(0, playerRealmIndex), Math.max(1, playerLayer))
}

/** 事件数据里出现的 bossId 是否都能命中模板（数据完备性测试用） */
export function hasEnemyTemplate(id: string): boolean {
  return ENEMY_TEMPLATES.some((t) => t.id === id)
}

/** 图鉴/预览：按玩家当前境界生成该模板的参考数值 */
export function previewEnemy(t: EnemyTemplate, playerRealmIndex: number, playerLayer: number): EnemyDef {
  return scaleEnemyToPlayer(t, playerRealmIndex, playerLayer)
}



/** 历练敌人 id 形如 `{template}_{realm}_{layer}`，图鉴按模板 id 记录 */
export function enemyTemplateId(enemyId: string): string {
  const hit = ENEMY_TEMPLATES.find((t) => enemyId === t.id || enemyId.startsWith(`${t.id}_`))
  return hit?.id ?? enemyId
}

export function enemyFactionLabel(e: EnemyDef): string {
  if (e.faction === 'demonic') return '魔修'
  if (e.faction === 'beast') return '妖兽'
  if (e.faction === 'abomination') return '异类'
  if (e.faction === 'rogue') return '邪修'
  return '修士'
}

export const ENEMY_TIER_LABEL: Record<EnemyTier, string> = {
  minion: '杂兵',
  normal: '寻常',
  elite: '精英',
  boss: '头目',
}
