import type { EnemyDef } from '../types'
import { REALMS } from './realms'

/** MVP+ 敌人表 */
export const ENEMIES: EnemyDef[] = [
  {
    id: 'wolf',
    name: '山魈',
    faction: 'beast',
    realm: 'qi',
    layer: 1,
    atk: 8,
    def: 3,
    hp: 40,
    loot: { stone: 8, exp: 20 },
    flavor: '青云山脚的低阶妖兽，成群出没。',
  },
  {
    id: 'snake',
    name: '碧鳞蛇',
    faction: 'beast',
    realm: 'qi',
    layer: 3,
    atk: 12,
    def: 5,
    hp: 55,
    loot: { stone: 15, exp: 35, itemId: 'snake_gall' },
    flavor: '蛇胆可入药，毒性不弱。',
  },
  {
    id: 'boar',
    name: '铁背野猪',
    faction: 'beast',
    realm: 'qi',
    layer: 5,
    atk: 16,
    def: 10,
    hp: 90,
    loot: { stone: 25, exp: 50, itemId: 'mat_foundation', dropRate: 0.25 },
    flavor: '皮糙肉厚；腹中或藏筑基灵物。',
  },
  {
    id: 'fox',
    name: '赤目狐',
    faction: 'beast',
    realm: 'qi',
    layer: 7,
    atk: 20,
    def: 8,
    hp: 75,
    loot: { stone: 40, exp: 70, itemId: 'fox_core' },
    flavor: '略通幻术，狡诈异常。',
  },
  {
    id: 'demon_acolyte',
    name: '血煞魔徒',
    faction: 'demonic',
    realm: 'qi',
    layer: 4,
    atk: 18,
    def: 6,
    hp: 70,
    loot: { stone: 30, exp: 45, itemId: 'demon_shard' },
    flavor: '魔道外门，专修血煞之气。',
  },
  {
    id: 'demon_guard',
    name: '魔门护法',
    faction: 'demonic',
    realm: 'qi',
    layer: 8,
    atk: 28,
    def: 12,
    hp: 120,
    loot: { stone: 60, exp: 90, itemId: 'demon_shard', dropRate: 0.7 },
    flavor: '奉命巡山，见正道修士便杀。',
  },
  {
    id: 'demon_elite',
    name: '噬魂魔修',
    faction: 'demonic',
    realm: 'foundation',
    layer: 2,
    atk: 40,
    def: 18,
    hp: 200,
    loot: { stone: 150, exp: 200, itemId: 'mat_core', dropRate: 0.2 },
    flavor: '以魂魄为食，魔功诡异。',
  },
  {
    id: 'boss_tiger',
    name: '裂地虎王',
    faction: 'beast',
    realm: 'qi',
    layer: 9,
    atk: 35,
    def: 16,
    hp: 220,
    loot: { stone: 100, exp: 150, itemId: 'mat_foundation', dropRate: 0.55 },
    flavor: '青云小境之主，啸声震林。',
  },
  {
    id: 'boss_ape',
    name: '玄冰魔猿',
    faction: 'beast',
    realm: 'foundation',
    layer: 6,
    atk: 55,
    def: 24,
    hp: 350,
    loot: { stone: 400, exp: 450, itemId: 'mat_core', dropRate: 0.5 },
    flavor: '盘踞玄冰地窟的凶兽。',
  },
  {
    id: 'boss_demon_lord',
    name: '血魔坛主',
    faction: 'demonic',
    realm: 'golden_core',
    layer: 3,
    atk: 90,
    def: 40,
    hp: 800,
    loot: { stone: 2000, exp: 2000, itemId: 'mat_soul', dropRate: 0.4 },
    flavor: '魔道坛主，血祭苍生。',
  },
]

export function pickEnemy(playerRealmIndex: number, playerLayer: number): EnemyDef {
  const realmOfIdx = ['qi', 'foundation', 'golden_core'] as const
  const pool = ENEMIES.filter((e) => {
    const ei = realmOfIdx.indexOf(e.realm as (typeof realmOfIdx)[number])
    if (ei < 0) return false
    return ei <= playerRealmIndex && ei >= Math.max(0, playerRealmIndex - 1)
  })
  if (pool.length === 0) return ENEMIES[0]
  const weighted = pool.filter((e) => {
    const ei = realmOfIdx.indexOf(e.realm as (typeof realmOfIdx)[number])
    return ei === playerRealmIndex ? e.layer <= playerLayer + 2 : true
  })
  const list = weighted.length > 0 ? weighted : pool
  return list[Math.floor(Math.random() * list.length)]
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
