import { realmIndex } from './realms'
import type { RealmId } from '../types'

export type WorldEventType =
  | 'secret_realm'
  | 'treasure'
  | 'boss'
  | 'fortune'
  | 'misfortune'

export interface WorldEvent {
  id: string
  type: WorldEventType
  title: string
  text: string
  actions: {
    id: string
    label: string
  }[]
  payload?: {
    itemId?: string
    stone?: number
    exp?: number
    bossId?: string
    minRealm?: RealmId
  }
}

/** 打坐/闭关/历练后可能刷出的奇遇池 */
export const WORLD_EVENTS: WorldEvent[] = [
  {
    id: 'secret_qingyun',
    type: 'secret_realm',
    title: '青云秘境开启',
    text: '天象异变，青云深处裂开一道古阵光门，内有机缘亦有凶险。',
    actions: [
      { id: 'enter', label: '踏入秘境' },
      { id: 'ignore', label: '按兵不动' },
    ],
    payload: { minRealm: 'qi' },
  },
  {
    id: 'secret_ice',
    type: 'secret_realm',
    title: '玄冰地窟现世',
    text: '极北寒雾中露出冰晶洞口，隐约有金丹期妖气。',
    actions: [
      { id: 'enter', label: '深入地窟' },
      { id: 'ignore', label: '暂避锋芒' },
    ],
    payload: { minRealm: 'foundation' },
  },
  {
    id: 'treasure_sword',
    type: 'treasure',
    title: '青冥剑胚出世',
    text: '一道青光自山腹冲天而起，有剑胚悬于崖顶，四方修士蠢蠢欲动。',
    actions: [
      { id: 'claim', label: '夺取剑胚' },
      { id: 'ignore', label: '不趟浑水' },
    ],
    payload: { itemId: 'treasure_sword' },
  },
  {
    id: 'treasure_mirror',
    type: 'treasure',
    title: '护心宝镜现踪',
    text: '古修遗府开启，铜镜悬于阵眼，镜面隐现护体符文。',
    actions: [
      { id: 'claim', label: '取镜而走' },
      { id: 'ignore', label: '放弃' },
    ],
    payload: { itemId: 'treasure_mirror' },
  },
  {
    id: 'treasure_pagoda',
    type: 'treasure',
    title: '镇魂塔残层',
    text: '荒冢深处浮起七层残塔，塔身符文明灭，似能镇压心魔、强健体魄。',
    actions: [
      { id: 'claim', label: '收塔认主' },
      { id: 'ignore', label: '恐有诈，退' },
    ],
    payload: { itemId: 'treasure_pagoda', minRealm: 'foundation' },
  },
  {
    id: 'boss_tiger',
    type: 'boss',
    title: '裂地虎王拦路',
    text: '山道震动，裂地虎王自林中扑出，杀意凛然！',
    actions: [
      { id: 'fight', label: '迎战' },
      { id: 'flee', label: '避让' },
    ],
    payload: { bossId: 'boss_tiger' },
  },
  {
    id: 'boss_ape',
    type: 'boss',
    title: '玄冰魔猿现身',
    text: '冰窟深处传来咆哮，玄冰魔猿踏碎冰棱而来。',
    actions: [
      { id: 'fight', label: '决战' },
      { id: 'flee', label: '撤离' },
    ],
    payload: { bossId: 'boss_ape', minRealm: 'foundation' },
  },
  {
    id: 'boss_demon',
    type: 'boss',
    title: '血魔坛主拦杀',
    text: '魔气滔天，血魔坛主狞笑着挡在道中：「留下性命！」',
    actions: [
      { id: 'fight', label: '诛魔' },
      { id: 'flee', label: '暂退' },
    ],
    payload: { bossId: 'boss_demon_lord', minRealm: 'golden_core' },
  },
  {
    id: 'fortune_herbs',
    type: 'fortune',
    title: '灵药园残址',
    text: '你偶入荒废药园，残存几株尚可入药的灵草。',
    actions: [{ id: 'take', label: '采集' }],
    payload: { stone: 80, exp: 60 },
  },
  {
    id: 'fortune_stones',
    type: 'fortune',
    title: '散修遗囊',
    text: '道旁遗落乾坤袋，内有灵石若干，失主已陨。',
    actions: [{ id: 'take', label: '收取' }],
    payload: { stone: 150 },
  },
  {
    id: 'misfortune_ambush',
    type: 'misfortune',
    title: '魔修伏击',
    text: '黑雾骤起，数名魔修自两侧杀出！',
    actions: [
      { id: 'fight', label: '反杀' },
      { id: 'flee', label: '突围' },
    ],
    payload: { bossId: 'demon_guard' },
  },
]

export function pickWorldEvent(realm: RealmId): WorldEvent | null {
  const pool = WORLD_EVENTS.filter((e) => {
    const min = e.payload?.minRealm
    if (!min) return true
    return realmIndex(realm) >= realmIndex(min)
  })
  if (pool.length === 0) return null
  if (Math.random() > 0.22) return null
  return pool[Math.floor(Math.random() * pool.length)]
}