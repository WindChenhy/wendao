import type { Gender, RealmId } from '../types'
import { realmIndex } from './realms'
import { sectRankIndex, type SectRank } from './sects'
import storiesDb from './db/companion_stories.json'

export interface StoryChoice {
  id: string
  label: string
  text: string
  ending?: 'he' | 'be'
  affinity?: number
  stones?: number
  exp?: number
  hpPct?: number
  repRight?: number
  repDemonic?: number
  daoMarksCost?: number
  itemId?: string
  flag?: string
}

/**
 * 剧情段门槛（v1.5 R-01）。
 * 此前道侣长线完全没有身份/时序判定，导致「青云剑宗宗主去剑压青云质疑者」这类身份矛盾。
 */
export interface StoryGates {
  /** 境界门槛 */
  minRealm?: RealmId
  /** 需要具备的剧情 flag */
  flags?: string[]
  /** 带有任一 flag 时不适用 */
  notFlags?: string[]
  /** 玩家已在该宗门、且职位不低于 skipIfMinRank 时，本段不适用 */
  skipIfSectId?: string
  skipIfMinRank?: SectRank
  /**
   * 本段不适用时改用的替代段落（保留剧情与结局，避免"无声消失"）。
   * 缺省则略过本段，并输出 skipText 作交代。
   */
  alt?: StoryBeat
  /** 被略过时的一句交代 */
  skipText?: string
}

export interface StoryBeat {
  id: string
  title: string
  text: string
  choices?: StoryChoice[]
  /** 无选项时的单结文案（点「继续」推进） */
  postText?: string
  ending?: 'he' | 'be'
  /** 身份/时序门槛（v1.5） */
  gates?: StoryGates
}

/** 判定剧情段门槛所需的玩家状态 */
export interface StoryGateContext {
  realm: RealmId
  sectId: string | null
  sectRank: SectRank
  flags: string[]
}

export interface CompanionDef {
  id: string
  name: string
  gender: Gender
  /** 阵营倾向：正道/魔道/中立（影响是否可攻略） */
  align: 'righteous' | 'demonic' | 'neutral'
  /** 身份文案 */
  title: string
  desc: string
  /** 喜好礼物 itemId → 好感加成 */
  giftPrefs: Record<string, number>
  /** 默认礼物好感 */
  giftDefault: number
  /** 结缘最低好感 */
  marryAt: number
  /** 心事件阈值 */
  heartAt: number[]
  /** 心事件文案 */
  heartTexts: string[]
  /** 双修加成（修为倍率） */
  dualMul: number
  /** 结缘后突破加成 */
  breakthroughBonus: number
  /** 可攻略条件：境界 */
  minRealm: RealmId
  /** 隐藏道侣：需特殊事件解锁 */
  hidden?: boolean
  unlockHint?: string
  /** 结缘后长线剧情（v0.9） */
  postStory?: StoryBeat[]
}

interface HiddenCompanionJson extends Omit<CompanionDef, 'postStory'> {
  postStory?: StoryBeat[]
}

interface StoriesDb {
  stories: { companionId: string; beats: StoryBeat[] }[]
  hidden: HiddenCompanionJson
}

const stories = storiesDb as StoriesDb

const BASE_COMPANIONS: CompanionDef[] = [
  {
    id: 'lin_wan',
    name: '林婉',
    gender: 'female',
    align: 'righteous',
    title: '青云外门师妹',
    desc: '剑穗轻扬，笑起来像山间新雪。',
    giftPrefs: { pill_qi: 8, fox_core: 12, pill_heal: 5 },
    giftDefault: 3,
    marryAt: 100,
    heartAt: [30, 60],
    heartTexts: [
      '她在剑冢外替你挡了一缕剑风，回头时耳尖微红。',
      '月下对练后，她把一枚平安符塞进你手心：「别死在秘境里。」',
    ],
    dualMul: 1.15,
    breakthroughBonus: 3,
    minRealm: 'qi',
    postStory: stories.stories.find((s) => s.companionId === 'lin_wan')?.beats ?? [],
  },
  {
    id: 'su_qing',
    name: '苏青',
    gender: 'female',
    align: 'righteous',
    title: '太一丹宗丹师',
    desc: '药香缠身，性子清冷，却总多备一份回春散。',
    giftPrefs: { snake_gall: 10, fox_core: 8, pill_heal: 6 },
    giftDefault: 3,
    marryAt: 110,
    heartAt: [35, 70],
    heartTexts: [
      '她把新炼的丹药推给你试味，指尖相触时迅速收回。',
      '你重伤归来，她守了整夜，案上丹炉未熄。',
    ],
    dualMul: 1.18,
    breakthroughBonus: 4,
    minRealm: 'qi',
    postStory: stories.stories.find((s) => s.companionId === 'su_qing')?.beats ?? [],
  },
  {
    id: 'yan_luo',
    name: '燕洛',
    gender: 'male',
    align: 'righteous',
    title: '浩天体宗师兄',
    desc: '肩宽背厚，话少，挡在人前像一堵山。',
    giftPrefs: { tiger_bone: 15, pill_heal: 8 },
    giftDefault: 3,
    marryAt: 100,
    heartAt: [30, 65],
    heartTexts: [
      '他默默把淬体药浴让给你，自己去冲冷水。',
      '「若有一日你渡劫，我替你护法。」他说完便转身继续打拳。',
    ],
    dualMul: 1.12,
    breakthroughBonus: 5,
    minRealm: 'qi',
  },
  {
    id: 'xue_mei',
    name: '血梅',
    gender: 'female',
    align: 'demonic',
    title: '血煞魔宫圣女',
    desc: '眉间一点朱砂，笑时像淬了毒的花。',
    giftPrefs: { demon_shard: 14, fox_core: 6 },
    giftDefault: 2,
    marryAt: 120,
    heartAt: [40, 80],
    heartTexts: [
      '她将一缕煞气渡入你经脉：「疼就叫出来，我不会笑你。」',
      '血池边，她靠在你肩上：「正道容不下我们，那就一起坠下去。」',
    ],
    dualMul: 1.25,
    breakthroughBonus: -2,
    minRealm: 'qi',
    postStory: stories.stories.find((s) => s.companionId === 'xue_mei')?.beats ?? [],
  },
  {
    id: 'gu_chen',
    name: '顾沉',
    gender: 'male',
    align: 'demonic',
    title: '幽冥鬼宗执事',
    desc: '常年披着旧氅，眼底像藏着未散的魂灯。',
    giftPrefs: { demon_shard: 12, tiger_bone: 8 },
    giftDefault: 2,
    marryAt: 130,
    heartAt: [45, 85],
    heartTexts: [
      '他为你点了一盏引魂灯：「若你死了，至少魂能找到回来的路。」',
      '「做我的道侣，黄泉碧落，都算同路。」',
    ],
    dualMul: 1.28,
    breakthroughBonus: -3,
    minRealm: 'foundation',
  },
  {
    id: 'yun_yao',
    name: '云瑶',
    gender: 'female',
    align: 'neutral',
    title: '游方散修',
    desc: '来历成谜，笑吟吟地卖你「天机」，真假参半。',
    giftPrefs: { fox_core: 10, demon_shard: 6, pill_qi: 6 },
    giftDefault: 4,
    marryAt: 90,
    heartAt: [25, 55],
    heartTexts: [
      '她摊开掌心一枚铜钱：「今日你我有缘，卦金免了。」',
      '「我算到自己会动心，却没算到是你。」她别过脸去。',
    ],
    dualMul: 1.1,
    breakthroughBonus: 6,
    minRealm: 'qi',
  },
]

/** 隐藏道侣：高境界 + 特殊事件解锁 */
const HIDDEN_COMPANION: CompanionDef = {
  ...(stories.hidden as HiddenCompanionJson),
  postStory: stories.hidden.postStory ?? [],
}

export const COMPANIONS: CompanionDef[] = [...BASE_COMPANIONS, HIDDEN_COMPANION]

/** 非隐藏（默认展示） */

export function companionById(id: string): CompanionDef | undefined {
  return COMPANIONS.find((c) => c.id === id)
}

export function giftAffinity(c: CompanionDef, itemId: string): number {
  return c.giftPrefs[itemId] ?? c.giftDefault
}

/** 本段是否适用于当前玩家状态 */
export function storyBeatApplies(beat: StoryBeat, ctx: StoryGateContext | undefined): boolean {
  const g = beat.gates
  if (!g) return true
  if (!ctx) return true
  if (g.minRealm && realmIndex(ctx.realm) < realmIndex(g.minRealm)) return false
  if (g.flags?.length && !g.flags.every((f) => ctx.flags.includes(f))) return false
  if (g.notFlags?.length && g.notFlags.some((f) => ctx.flags.includes(f))) return false
  // 已是本宗高位（如青云宗主）：本段所写的"外人视角"不再成立
  if (g.skipIfSectId && ctx.sectId === g.skipIfSectId) {
    const floor = g.skipIfMinRank
    if (!floor || sectRankIndex(ctx.sectRank) >= sectRankIndex(floor)) return false
  }
  return true
}

/** 下一段剧情的选取结果 */
export interface NextStoryBeat {
  /** 待播放段落；null = 该道侣长线已完结 */
  beat: StoryBeat | null
  /** 该段在 postStory 中的下标（beat 为 null 时为 postStory.length） */
  index: number
  /** 被门槛略过的段落交代（调用方负责输出一次） */
  skipped: string[]
}

/**
 * 取下一段剧情：从 postStage 起向后扫描，跳过不满足门槛的段落。
 * 返回的 index 必须由调用方写回 postStage（并在结算时推进到 index + 1），
 * 否则会每回合重复扫描。
 */
export function nextStoryBeat(
  c: CompanionDef,
  postStage: number,
  ctx?: StoryGateContext,
): NextStoryBeat {
  const beats = c.postStory ?? []
  const start = Math.max(0, Math.floor(postStage))
  const skipped: string[] = []
  for (let i = start; i < beats.length; i += 1) {
    const beat = beats[i]
    if (storyBeatApplies(beat, ctx)) return { beat, index: i, skipped }
    const alt = beat.gates?.alt
    if (alt) return { beat: alt, index: i, skipped }
    if (beat.gates?.skipText) skipped.push(beat.gates.skipText)
  }
  return { beat: null, index: beats.length, skipped }
}

export function storyEndingKey(companionId: string, ending: 'he' | 'be'): string {
  return `${companionId}_${ending}`
}

export function storyEndingLabel(ending: 'he' | 'be'): string {
  return ending === 'he' ? '良缘' : '遗恨'
}
