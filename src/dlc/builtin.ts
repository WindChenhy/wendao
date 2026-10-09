import type { DlcPack } from './types'

/** 内置 DLC：仅 manifest + 数值补丁；事件全部在 db/events.json 中带 dlcId 字段（v1.4 数据化） */
export const BUILTIN_DLC: DlcPack[] = [
  {
    manifest: {
      id: 'hardcore',
      name: '硬核修真',
      version: '0.2.0',
      desc: '更严苛的修炼法则：突破更难、寿命更紧，天道压制与苦修感悟并存。',
      features: ['突破率 -8%', '寿命消耗更重', '修炼略快（5%）', '追加 4 条「硬核」事件'],
    },
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
      version: '0.2.0',
      desc: '域外低语渗入此界，机缘与堕落一线之间。',
      features: ['追加 4 条「黑暗」事件', '历练灵石收益 +25%', '修炼速度 -8%', '突破率 -2%'],
    },
    balance: {
      exploreStoneMul: 1.25,
      cultivateMul: 0.92,
      breakthroughRateDelta: -2,
    },
  },
  {
    manifest: {
      id: 'demonic_war',
      name: '魔修杀伐',
      version: '0.1.0',
      desc: '以杀证道：追杀更密、杀伐更快，血池机缘与缉魔令同行。',
      features: ['历练灵石收益 +20%', '突破率 -3%', '追加 6 条「魔修杀伐」事件（含通缉联动）'],
    },
    balance: {
      exploreStoneMul: 1.2,
      breakthroughRateDelta: -3,
    },
  },
  {
    manifest: {
      id: 'beast_taming',
      name: '御兽之道',
      version: '0.1.0',
      desc: '灵兽与你共修：喂养事半功倍，日课灵石亦有灵兽一份功劳。',
      features: ['灵兽喂养经验 +50%', '日课灵石奖励 +10%', '追加 5 条「御兽」事件'],
    },
    balance: {
      petExpMul: 1.5,
      dailyRewardMul: 1.1,
    },
  },
  {
    manifest: {
      id: 'immortal_relic',
      name: '仙界遗珍',
      version: '0.1.0',
      desc: '飞升并非终点：仙缘凝聚更快，仙界遗珍散落人间。',
      features: ['仙缘获取 +30%', '追加 5 条「仙界遗珍」事件（飞升后触发）'],
    },
    balance: {
      favorMul: 1.3,
    },
  },
]
