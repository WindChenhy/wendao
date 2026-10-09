import { realmIndex, realmCombatBase } from './realms'
import type { RealmId } from '../types'
import secretRealmsDb from './db/secret_realms.json'

interface SecretRealmDef {
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

/** 秘境表：src/data/db/secret_realms.json */
export const SECRET_REALMS: SecretRealmDef[] = secretRealmsDb as SecretRealmDef[]

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
