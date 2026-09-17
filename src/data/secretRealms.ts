import { realmIndex } from './realms'
import type { RealmId } from '../types'

export interface SecretRealmDef {
  id: string
  name: string
  desc: string
  /** 最低境界 */
  minRealm: RealmId
  minLayer: number
  /** 总层数 */
  floors: number
  /** 每 N 层一个 BOSS */
  bossEvery: number
  /** 环境加成：玩家受到的伤害倍率等 */
  env: {
    playerHpMul?: number
    rewardMul: number
  }
  /** 层数奖励模板 */
  loot: {
    stonePerFloor: number
    expPerFloor: number
    /** BOSS 额外掉落 */
    bossItemId?: string
  }
  flavor: string
}

export const SECRET_REALMS: SecretRealmDef[] = [
  {
    id: 'qingyun',
    name: '青云小境',
    desc: '云雾缭绕的入门秘境，低阶妖兽盘踞，偶有筑基灵物。',
    minRealm: 'qi',
    minLayer: 1,
    floors: 30,
    bossEvery: 10,
    env: { rewardMul: 1 },
    loot: {
      stonePerFloor: 12,
      expPerFloor: 25,
      bossItemId: 'mat_foundation',
    },
    flavor: '青云山深处的古阵残境。',
  },
  {
    id: 'ice_cave',
    name: '玄冰地窟',
    desc: '极北寒窟，冰缓蚀骨。深处藏有金丹玉液。',
    minRealm: 'foundation',
    minLayer: 3,
    floors: 40,
    bossEvery: 10,
    env: { playerHpMul: 0.9, rewardMul: 1.35 },
    loot: {
      stonePerFloor: 35,
      expPerFloor: 70,
      bossItemId: 'mat_core',
    },
    flavor: '寒气凝成实质，一步一险。',
  },
  {
    id: 'lava_hell',
    name: '熔岩火狱',
    desc: '地火奔涌，火精肆虐。元婴果或藏于火眼。',
    minRealm: 'golden_core',
    minLayer: 1,
    floors: 50,
    bossEvery: 10,
    env: { playerHpMul: 0.85, rewardMul: 1.7 },
    loot: {
      stonePerFloor: 90,
      expPerFloor: 180,
      bossItemId: 'mat_soul',
    },
    flavor: '脚踏赤岩，热浪扑面。',
  },
  {
    id: 'void_rift',
    name: '虚空裂隙',
    desc: '空间乱流，机缘与湮灭并存。化神莲生于裂隙核心。',
    minRealm: 'nascent_soul',
    minLayer: 5,
    floors: 60,
    bossEvery: 15,
    env: { playerHpMul: 0.8, rewardMul: 2.2 },
    loot: {
      stonePerFloor: 250,
      expPerFloor: 480,
      bossItemId: 'mat_spirit',
    },
    flavor: '脚下星光碎裂，头顶虚空倒悬。',
  },
]

export function canEnterRealm(
  realm: SecretRealmDef,
  playerRealm: RealmId,
  playerLayer: number,
): boolean {
  if (realmIndex(playerRealm) < realmIndex(realm.minRealm)) return false
  if (playerRealm === realm.minRealm && playerLayer < realm.minLayer) return false
  return true
}

export function isBossFloor(realm: SecretRealmDef, floor: number): boolean {
  return floor > 0 && floor % realm.bossEvery === 0
}

/** 按秘境与层数生成临时敌人 */
export function towerEnemy(realmId: string, floor: number, boss: boolean) {
  const realm = SECRET_REALMS.find((r) => r.id === realmId)
  const mul = 1 + floor * 0.08
  const base = {
    id: `${realmId}_${floor}`,
    name: boss
      ? `${realm?.name ?? '秘境'}镇守`
      : `${realm?.name ?? '秘境'}守卫·${floor}`,
    faction: 'beast' as const,
    realm: 'qi' as const,
    layer: Math.max(1, floor),
    atk: Math.floor((10 + floor * 3.2) * (boss ? 1.5 : 1) * mul * 0.55),
    def: Math.floor((4 + floor * 1.6) * (boss ? 1.4 : 1)),
    hp: Math.floor((50 + floor * 18) * (boss ? 2.2 : 1) * mul * 0.5),
    loot: {
      stone: Math.floor((realm?.loot.stonePerFloor ?? 10) * (boss ? 4 : 1) * (realm?.env.rewardMul ?? 1)),
      exp: Math.floor((realm?.loot.expPerFloor ?? 20) * (boss ? 3 : 1) * (realm?.env.rewardMul ?? 1)),
      itemId: boss ? realm?.loot.bossItemId : undefined,
      dropRate: boss ? 0.75 : 0,
    },
    flavor: boss ? '秘境镇守，杀意冲天。' : '秘境中的守卫生灵。',
  }
  return base
}
