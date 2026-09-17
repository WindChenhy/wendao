import type { DlcPack } from './types'
import type { WorldEvent } from '../data/events'

const hardcoreEvents: WorldEvent[] = [
  {
    id: 'hc_pressure',
    type: 'misfortune',
    title: '天道压制',
    text: '灵气紊乱，魔念丛生。硬核法则下，稍有不慎便会道基动摇。',
    actions: [
      { id: 'fight', label: '强行冲关镇压' },
      { id: 'ignore', label: '闭锁识海忍耐' },
    ],
    payload: { bossId: 'boss_demon_lord', stone: -0 },
  },
  {
    id: 'hc_trial',
    type: 'fortune',
    title: '苦修有得',
    text: '在严苛法则下打磨根基，虽慢却稳。',
    actions: [{ id: 'claim', label: '收取感悟' }],
    payload: { exp: 120 },
  },
]

const darkEvents: WorldEvent[] = [
  {
    id: 'dark_whisper',
    type: 'misfortune',
    title: '域外低语',
    text: '黑暗中似有存在呢喃：献上一点什么，便可换来力量……',
    actions: [
      { id: 'claim', label: '聆听并回应' },
      { id: 'ignore', label: '当作幻听' },
    ],
    payload: { exp: 80, stone: 50 },
  },
]

/** 内置 DLC：首期仅数据包，可在设置中预览/启停 */
export const BUILTIN_DLC: DlcPack[] = [
  {
    manifest: {
      id: 'hardcore',
      name: '硬核修真',
      version: '0.1.0',
      desc: '更严苛的修炼法则：突破更难、寿命更紧，适合追求压力的修士。',
      features: ['突破率 -8%', '寿命消耗更重', '追加「天道压制」事件'],
    },
    extraEvents: hardcoreEvents,
    balance: {
      breakthroughRateDelta: -8,
      lifespanMul: 0.75,
      cultivateMul: 1.05,
    },
  },
  {
    manifest: {
      id: 'dark',
      name: '黑暗魔改',
      version: '0.1.0',
      desc: '域外低语渗入此界，机缘与堕落一线之间。',
      features: ['追加黑暗事件', '历练灵石收益微增', '修炼速度略降'],
    },
    extraEvents: darkEvents,
    balance: {
      exploreStoneMul: 1.25,
      cultivateMul: 0.92,
      breakthroughRateDelta: -2,
    },
  },
]
