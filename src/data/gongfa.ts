/** 功法品阶：黄 < 玄 < 地 < 天 < 仙（仙阶为后续拓展预留） */
export type GongfaGrade = '黄阶' | '玄阶' | '地阶' | '天阶' | '仙阶'

/** 功法类型：心法主修行、攻击法诀主攻伐、防御法主护身、身法主遁走、锻体法炼体魄 */
export type GongfaKind = '心法' | '攻击法诀' | '防御法' | '身法' | '锻体法' | '功法'

/** 修习阶段：入门 → 小成 → 大成 → 圆满 */
export type GongfaStage = 0 | 1 | 2 | 3

export interface GongfaDef {
  id: string
  name: string
  grade: GongfaGrade
  kind: GongfaKind
  desc: string
  /** 坊市秘籍售价；宗门秘法为 0（以贡献参悟） */
  price: number
  /** 圆满时的加成（按阶段系数缩放）；dodge 为受到伤害降低比例 */
  effect: { atk?: number; def?: number; hp?: number; cultivate?: number; dodge?: number }
}

/** 品阶由低到高 */
export const GONGFA_GRADE_ORDER: GongfaGrade[] = ['黄阶', '玄阶', '地阶', '天阶', '仙阶']
/** 品阶配色（面板用） */
export const GONGFA_GRADE_CLASS: Record<GongfaGrade, string> = {
  黄阶: 'text-text-dim',
  玄阶: 'text-jade',
  地阶: 'text-gold',
  天阶: 'text-vermilion',
  仙阶: 'text-gold',
}
/** 各品阶进阶基础消耗（修为点） */
export const GONGFA_GRADE_ADVANCE_BASE: Record<GongfaGrade, number> = {
  黄阶: 200,
  玄阶: 800,
  地阶: 3000,
  天阶: 10000,
  仙阶: 40000,
}

/** 阶段标签与效果系数 */
export const GONGFA_STAGE_LABELS = ['入门', '小成', '大成', '圆满'] as const
export const GONGFA_STAGE_MUL = [0.5, 0.75, 1, 1.5] as const
/** 各级进阶消耗倍率：入门→小成、小成→大成、大成→圆满 */
export const GONGFA_STAGE_ADVANCE_MUL = [1, 3, 6] as const

/** 把功法从当前阶段推进到下一阶段所需修为 */
export function gongfaAdvanceCost(g: GongfaDef, stage: number): number {
  if (stage < 0 || stage >= GONGFA_STAGE_LABELS.length - 1) return 0
  return GONGFA_GRADE_ADVANCE_BASE[g.grade] * GONGFA_STAGE_ADVANCE_MUL[stage]
}

export const GONGFA_LIST: GongfaDef[] = [
  // —— 坊市流通 ——
  {
    id: 'gf_yangqi',
    name: '养气诀',
    grade: '黄阶',
    kind: '功法',
    desc: '吐纳养气的入门功法，绵长醇厚。',
    price: 180,
    effect: { hp: 0.08 },
  },
  {
    id: 'gf_tiegong',
    name: '铁骨功',
    grade: '黄阶',
    kind: '锻体法',
    desc: '淬炼筋骨皮膜，硬撼刀剑。',
    price: 180,
    effect: { def: 0.08 },
  },
  {
    id: 'gf_juling',
    name: '聚灵诀',
    grade: '黄阶',
    kind: '心法',
    desc: '引聚天地灵气入体，修行事半功倍。',
    price: 220,
    effect: { cultivate: 0.08 },
  },
  {
    id: 'gf_liufeng',
    name: '流风身法',
    grade: '黄阶',
    kind: '身法',
    desc: '身随风波流，避实就虚。',
    price: 260,
    effect: { dodge: 0.05 },
  },
  {
    id: 'gf_qingyuan',
    name: '青元剑气',
    grade: '玄阶',
    kind: '攻击法诀',
    desc: '剑气离体三尺，凌厉无俦。',
    price: 700,
    effect: { atk: 0.1 },
  },
  {
    id: 'gf_guiyuan',
    name: '龟息功',
    grade: '玄阶',
    kind: '防御法',
    desc: '气机内敛如龟息，护体不破。',
    price: 800,
    effect: { def: 0.1 },
  },
  {
    id: 'gf_taixu',
    name: '太虚引灵篇',
    grade: '地阶',
    kind: '心法',
    desc: '神游太虚，引灵入髓，悟性大开。',
    price: 2400,
    effect: { cultivate: 0.15 },
  },
  {
    id: 'gf_bengshan',
    name: '崩山劲',
    grade: '地阶',
    kind: '攻击法诀',
    desc: '一劲既出，崩山裂石。',
    price: 3000,
    effect: { atk: 0.18 },
  },
  {
    id: 'gf_lingxu',
    name: '凌虚步',
    grade: '地阶',
    kind: '身法',
    desc: '踏虚而行，敌手难触衣角。',
    price: 3200,
    effect: { dodge: 0.08 },
  },
  {
    id: 'gf_dayan',
    name: '大衍真解',
    grade: '天阶',
    kind: '心法',
    desc: '推演天机的无上真解，攻悟兼备。',
    price: 9000,
    effect: { atk: 0.1, cultivate: 0.18 },
  },

  // —— 宗门藏经阁秘法（以贡献参悟，坊市不售）——
  {
    id: 'js_jian',
    name: '青云剑诀',
    grade: '玄阶',
    kind: '攻击法诀',
    desc: '青云剑宗根本剑诀，剑气纵横。',
    price: 0,
    effect: { atk: 0.1 },
  },
  {
    id: 'js_xin',
    name: '澄心诀',
    grade: '黄阶',
    kind: '心法',
    desc: '澄澈心湖，灵台清明。',
    price: 0,
    effect: { cultivate: 0.08 },
  },
  {
    id: 'ty_dan',
    name: '太一丹解',
    grade: '玄阶',
    kind: '心法',
    desc: '以丹道印证心法，药力催化修行。',
    price: 0,
    effect: { cultivate: 0.12 },
  },
  {
    id: 'ty_ti',
    name: '药体诀',
    grade: '玄阶',
    kind: '锻体法',
    desc: '以药力淬体，气血雄浑。',
    price: 0,
    effect: { hp: 0.15 },
  },
  {
    id: 'ht_ti',
    name: '浩天淬体篇',
    grade: '玄阶',
    kind: '锻体法',
    desc: '浩天体宗根本锻体法，金刚不坏。',
    price: 0,
    effect: { def: 0.15 },
  },
  {
    id: 'ht_mai',
    name: '不灭经',
    grade: '地阶',
    kind: '锻体法',
    desc: '肉身成圣之经，气血生生不息。',
    price: 0,
    effect: { hp: 0.25 },
  },
  {
    id: 'xs_sha',
    name: '血煞魔功',
    grade: '地阶',
    kind: '攻击法诀',
    desc: '血煞入体，魔功霸道。',
    price: 0,
    effect: { atk: 0.18 },
  },
  {
    id: 'xs_sui',
    name: '噬魂秘录',
    grade: '地阶',
    kind: '心法',
    desc: '以魂魄淬炼心神，进境极快。',
    price: 0,
    effect: { cultivate: 0.15 },
  },
  {
    id: 'ym_gui',
    name: '幽冥引魂经',
    grade: '地阶',
    kind: '心法',
    desc: '引幽冥之气入体，修行一日千里。',
    price: 0,
    effect: { cultivate: 0.2 },
  },
]

export const GONGFAS: Record<string, GongfaDef> = Object.fromEntries(
  GONGFA_LIST.map((g) => [g.id, g]),
)

/** 功法秘籍的物品 id（坊市购买、背包参悟） */
export function gongfaScrollId(gongfaId: string): string {
  return `scroll_${gongfaId}`
}

export function gongfaByScrollId(scrollItemId: string): GongfaDef | null {
  if (!scrollItemId.startsWith('scroll_')) return null
  return GONGFAS[scrollItemId.slice('scroll_'.length)] ?? null
}

/** 坊市在售的功法（宗门秘法 price 为 0，仅藏经阁贡献参悟） */
export function isMarketGongfa(g: GongfaDef): boolean {
  return g.price > 0
}

/** 功法在当前阶段的加成倍率（0.5/0.75/1/1.5） */
export function gongfaStageMul(stage: number): number {
  return GONGFA_STAGE_MUL[Math.min(GONGFA_STAGE_MUL.length - 1, Math.max(0, stage))]
}

/** 某一阶段下的加成文案，如 "攻击 +10%、气血 +5%" */
export function gongfaEffectText(g: GongfaDef, stage: number): string {
  const mul = gongfaStageMul(stage)
  const parts: string[] = []
  if (g.effect.atk) parts.push(`攻击 +${Math.round(g.effect.atk * mul * 100)}%`)
  if (g.effect.def) parts.push(`防御 +${Math.round(g.effect.def * mul * 100)}%`)
  if (g.effect.hp) parts.push(`气血 +${Math.round(g.effect.hp * mul * 100)}%`)
  if (g.effect.cultivate) parts.push(`修炼 +${Math.round(g.effect.cultivate * mul * 100)}%`)
  if (g.effect.dodge) parts.push(`受伤降低 ${Math.round(g.effect.dodge * mul * 100)}%`)
  return parts.join('、') || '—'
}
