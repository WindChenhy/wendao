import type { EnemyDef, RealmId } from '../types'
import { REALMS, REALM_ORDER, realmCombatBase } from './realms'

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
}

/** 历练模板：只决定形象/阵营/强度档，数值在玩家遭遇时按其大境界重算 */
export const ENEMY_TEMPLATES: EnemyTemplate[] = [
  // —— 妖兽 · 杂兵/普通 ——
  { id: 'wolf', name: '山魈', faction: 'beast', tier: 'minion', power: 0.62, matOffset: 0, flavor: '青云山脚的低阶妖兽，成群出没。' },
  { id: 'snake', name: '碧鳞蛇', faction: 'beast', tier: 'normal', power: 0.78, matOffset: 0, dropRate: 0.55, flavor: '蛇胆可入药，毒性不弱。' },
  { id: 'boar', name: '铁背野猪', faction: 'beast', tier: 'normal', power: 0.88, matOffset: 0, dropRate: 0.3, flavor: '皮糙肉厚；腹中或藏突破灵物。' },
  { id: 'fox', name: '赤目狐', faction: 'beast', tier: 'normal', power: 0.82, matOffset: 0, dropRate: 0.4, flavor: '略通幻术，狡诈异常。' },
  { id: 'horn', name: '裂角犀', faction: 'beast', tier: 'elite', power: 1.02, matOffset: 0, dropRate: 0.45, flavor: '角裂山岩，冲势惊人。' },
  { id: 'eagle', name: '九天玄鹰', faction: 'beast', tier: 'elite', power: 1.08, matOffset: 1, dropRate: 0.35, flavor: '搏击长空，爪可裂金。' },

  // —— 魔修 ——
  { id: 'demon_acolyte', name: '血煞魔徒', faction: 'demonic', tier: 'minion', power: 0.7, matOffset: 0, flavor: '魔道外门，专修血煞之气。' },
  { id: 'demon_guard', name: '魔门护法', faction: 'demonic', tier: 'normal', power: 0.9, matOffset: 0, dropRate: 0.7, flavor: '奉命巡山，见正道修士便杀。' },
  { id: 'demon_elite', name: '噬魂魔修', faction: 'demonic', tier: 'elite', power: 1.05, matOffset: 1, dropRate: 0.4, flavor: '以魂魄为食，魔功诡异。' },
  { id: 'demon_elder', name: '魔道长老', faction: 'demonic', tier: 'boss', power: 1.45, matOffset: 1, dropRate: 0.55, flavor: '魔道宿老，杀伐果断。' },

  // —— BOSS ——
  { id: 'boss_tiger', name: '裂地虎王', faction: 'beast', tier: 'boss', power: 1.4, matOffset: 1, dropRate: 0.55, flavor: '山林之主，啸声震林。' },
  { id: 'boss_ape', name: '玄冰魔猿', faction: 'beast', tier: 'boss', power: 1.5, matOffset: 1, dropRate: 0.5, flavor: '寒潭深处的远古凶兽。' },
  { id: 'boss_demon_lord', name: '血魔坛主', faction: 'demonic', tier: 'boss', power: 1.55, matOffset: 1, dropRate: 0.45, flavor: '魔道坛主，血祭苍生。' },
  { id: 'boss_devour', name: '吞天古蟒', faction: 'beast', tier: 'boss', power: 1.6, matOffset: 1, dropRate: 0.5, flavor: '上古异种残裔，腹中自成小天地。' },
]

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
    mahayana: 'mat_mahayana',
  }
  return map[realm]
}

/**
 * 按玩家大境界/层数生成同档敌人。
 * 强度锚定「同境界无职业/功法加成的玩家基准」，power 决定档位。
 */
function scaleEnemyToPlayer(t: EnemyTemplate, realmIdx: number, playerLayer: number): EnemyDef {
  const ri = Math.max(0, Math.min(REALM_ORDER.length - 2, realmIdx))
  const realm = REALM_ORDER[ri]
  const layerBias = t.tier === 'boss' ? 2 : t.tier === 'elite' ? 1 : t.tier === 'minion' ? -2 : 0
  const layer = Math.max(1, Math.min(9, playerLayer + layerBias))
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

  let pool = ENEMY_TEMPLATES.filter((t) => t.tier === wantTier)
  if (pool.length === 0) pool = ENEMY_TEMPLATES.filter((t) => t.tier === 'normal')
  if (pool.length === 0) pool = ENEMY_TEMPLATES
  const template = pool[Math.floor(Math.random() * pool.length)]
  return scaleEnemyToPlayer(template, ri, layer)
}

/** 图鉴/预览：按玩家当前境界生成该模板的参考数值 */
export function previewEnemy(t: EnemyTemplate, playerRealmIndex: number, playerLayer: number): EnemyDef {
  return scaleEnemyToPlayer(t, playerRealmIndex, playerLayer)
}

export function enemyRealmLabel(e: EnemyDef): string {
  return `${REALMS[e.realm]?.name ?? e.realm}${e.layer}层`
}

export function enemyFactionLabel(e: EnemyDef): string {
  if (e.faction === 'demonic') return '魔修'
  if (e.faction === 'beast') return '妖兽'
  if (e.faction === 'abomination') return '异类'
  return '修士'
}

export const ENEMY_TIER_LABEL: Record<EnemyTier, string> = {
  minion: '杂兵',
  normal: '寻常',
  elite: '精英',
  boss: '头目',
}
