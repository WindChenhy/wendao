import { realmIndex, realmCombatBase } from './realms'
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
  {
    id: 'lingxu_palace',
    name: '灵虚仙府',
    desc: '上古仙府遗落云海，禁制森严。虚空晶藏于府库深处。',
    minRealm: 'spirit_sea',
    minLayer: 1,
    floors: 70,
    bossEvery: 14,
    env: { playerHpMul: 0.75, rewardMul: 2.8 },
    loot: {
      stonePerFloor: 600,
      expPerFloor: 1100,
      bossItemId: 'mat_void',
    },
    flavor: '白玉阶前云海翻涌，禁制如活物呼吸。',
  },
  {
    id: 'taixu_battlefield',
    name: '太虚古战场',
    desc: '两位大能陨落之地，法则残痕犹存。合体石嵌于将陨者的眉心。',
    minRealm: 'void',
    minLayer: 1,
    floors: 80,
    bossEvery: 16,
    env: { playerHpMul: 0.7, rewardMul: 3.4 },
    loot: {
      stonePerFloor: 1600,
      expPerFloor: 3000,
      bossItemId: 'mat_integration',
    },
    flavor: '断剑插地成林，虚空里仍回荡着那一战的金铁声。',
  },
  {
    id: 'guixu_land',
    name: '归墟之地',
    desc: '万物归墟之所，道则崩坏。大乘道种于归墟中心沉浮。',
    minRealm: 'integration',
    minLayer: 1,
    floors: 90,
    bossEvery: 18,
    env: { playerHpMul: 0.65, rewardMul: 4.2 },
    loot: {
      stonePerFloor: 4200,
      expPerFloor: 8000,
      bossItemId: 'mat_mahayana',
    },
    flavor: '天光在此折断，唯有道种自放光明。',
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

/**
 * 按秘境与层数生成临时敌人。
 * 数值锚定秘境所属大境界：以「恰好处于该秘境最低大境界入门层的玩家」为基准，
 * 层数爬升约 2.2 倍，镇守再乘额外系数——高境界玩家闯低阶秘境应当碾压般轻松。
 */
export function towerEnemy(realmId: string, floor: number, boss: boolean) {
  const realm = SECRET_REALMS.find((r) => r.id === realmId)
  const minRealm: RealmId = realm?.minRealm ?? 'qi'
  const ri = realmIndex(minRealm)
  const floors = realm?.floors ?? 30
  // 玩家基准：最低大境界入门层、未计职业/功法系数
  const ref = realmCombatBase(minRealm, 1)
  const refAtk = ref.atk
  const refDef = ref.def
  const refHp = ref.hp
  // 层内爬升：首层 1.0 → 顶层约 2.2
  const ramp = 1 + ((floor - 1) / Math.max(1, floors - 1)) * 1.2
  const bm = boss ? { atk: 1.15, def: 1.15, hp: 1.5 } : { atk: 1, def: 1, hp: 1 }
  // 奖励随秘境品阶抬升，层内同步爬升
  const tierMul = Math.pow(2.2, ri)
  const rewardRamp = 0.8 + 0.4 * (ramp - 1)
  return {
    id: `${realmId}_${floor}`,
    name: boss
      ? `${realm?.name ?? '秘境'}镇守`
      : `${realm?.name ?? '秘境'}守卫·${floor}`,
    faction: 'beast' as const,
    realm: minRealm,
    layer: Math.max(1, Math.min(9, floor)),
    atk: Math.floor(refAtk * (0.75 + 0.35 * (ramp - 1)) * bm.atk),
    def: Math.floor(refDef * (0.9 + 0.3 * (ramp - 1)) * bm.def),
    hp: Math.floor(refHp * (0.55 + 0.45 * (ramp - 1)) * bm.hp),
    loot: {
      stone: Math.floor(
        (realm?.loot.stonePerFloor ?? 10) *
          tierMul *
          (realm?.env.rewardMul ?? 1) *
          rewardRamp *
          (boss ? 4 : 1),
      ),
      exp: Math.floor(
        (realm?.loot.expPerFloor ?? 20) *
          tierMul *
          (realm?.env.rewardMul ?? 1) *
          rewardRamp *
          (boss ? 3 : 1),
      ),
      itemId: boss ? realm?.loot.bossItemId : undefined,
      dropRate: boss ? 0.75 : 0,
    },
    flavor: boss ? '秘境镇守，杀意冲天。' : '秘境中的守卫生灵。',
  }
}
