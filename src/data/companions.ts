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
  /** 男性专属：结拜时的场景文案 */
  swornText?: string
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
  {
    id: 'bai_lu',
    name: '白露',
    gender: 'female',
    align: 'righteous',
    title: '青云剑宗·执剑师姐',
    desc: '剑意清冽如霜，总在你练剑时远远看着，装作只是路过。',
    giftPrefs: { pill_heal: 8, tiger_bone: 6, fox_core: 5 },
    giftDefault: 3,
    marryAt: 105,
    heartAt: [32, 68],
    heartTexts: [
      '她拾起你落在地上的剑，用袖子擦净：「剑钝了，人也钝了？」',
      '雪夜剑庐外多了一盏灯。她说：「反正我也睡不着。」',
    ],
    dualMul: 1.16,
    breakthroughBonus: 4,
    minRealm: 'qi',
    postStory: stories.stories.find((s) => s.companionId === 'bai_lu')?.beats ?? [],
  },
  {
    id: 'luo_qingyi',
    name: '洛清漪',
    gender: 'female',
    align: 'righteous',
    title: '太一丹宗·药庐医女',
    desc: '手边总有一只温着的药炉，说话很轻，心却比谁都硬。',
    giftPrefs: { snake_gall: 12, pill_heal: 7, fox_core: 5 },
    giftDefault: 3,
    marryAt: 120,
    heartAt: [38, 75],
    heartTexts: [
      '她替你换药，指尖避开伤处，却避不开耳根的红。',
      '药庐漏雨那夜，她把唯一的干处让给你，自己守了一夜炉火。',
    ],
    dualMul: 1.19,
    breakthroughBonus: 5,
    minRealm: 'qi',
  },
  {
    id: 'chi_lian',
    name: '赤练',
    gender: 'female',
    align: 'demonic',
    title: '血煞魔宫·赤炎火使',
    desc: '一身红衣，笑起来像个不肯讲道理的劫数。',
    giftPrefs: { demon_shard: 14, tiger_bone: 7, fox_core: 5 },
    giftDefault: 2,
    marryAt: 125,
    heartAt: [42, 82],
    heartTexts: [
      '她烧了半座山头替你把追兵挡回去，回头只问你：「怕不怕？」',
      '火池边，她把额头抵在你肩上：「我这火，只烧外人。」',
    ],
    dualMul: 1.24,
    breakthroughBonus: -2,
    minRealm: 'qi',
  },
  {
    id: 'hu_jiu',
    name: '胡九',
    gender: 'female',
    align: 'neutral',
    title: '青丘·九尾狐女',
    desc: '尾巴藏得极好，眼睛却藏不住。',
    giftPrefs: { fox_core: 16, pill_qi: 7, demon_shard: 6 },
    giftDefault: 4,
    marryAt: 130,
    heartAt: [35, 78],
    heartTexts: [
      '她数着你袖口的线头，忽然说：「你可别学那些负心人。」',
      '月圆之夜她现了本相，九条尾巴只往你身侧拢。',
    ],
    dualMul: 1.27,
    breakthroughBonus: 3,
    minRealm: 'foundation',
    postStory: stories.stories.find((s) => s.companionId === 'hu_jiu')?.beats ?? [],
  },
  {
    id: 'qin_wujiu',
    name: '秦无咎',
    gender: 'male',
    align: 'righteous',
    title: '青云剑宗·剑庐大师兄',
    desc: '剑匣不离身，规矩比剑还直，却肯为你破一次例。',
    giftPrefs: { tiger_bone: 12, pill_heal: 7, pill_qi: 6 },
    giftDefault: 3,
    marryAt: 100,
    heartAt: [30, 65],
    heartTexts: [
      '他把你的剑按回鞘里：「剑走偏锋可以，人不行。」',
      '「若有一日你被逐出师门，我陪你走。」他说得平静，像在说明日的天气。',
    ],
    dualMul: 1.13,
    breakthroughBonus: 6,
    minRealm: 'qi',
    swornText:
      '剑庐前，秦无咎把剑匣横在两人之间，取酒三碗：「一拜天地，二拜师门，三拜……你我。」他先干为敬，末了补一句：「日后你若犯门规，我第一个拿你，也第一个替你挡。」',
  },
  {
    id: 'shi_gandang',
    name: '石敢当',
    gender: 'male',
    align: 'neutral',
    title: '散修·游侠力士',
    desc: '九尺高的莽汉，认死理，也认兄弟。',
    giftPrefs: { tiger_bone: 14, pill_heal: 9, pill_qi: 5 },
    giftDefault: 3,
    marryAt: 90,
    heartAt: [28, 60],
    heartTexts: [
      '他把最后一坛酒砸开分你一半：「喝完这坛，命就绑一处了。」',
      '你醒来时他正守在洞口，肩上落了厚厚一层雪。',
    ],
    dualMul: 1.11,
    breakthroughBonus: 7,
    minRealm: 'qi',
    swornText:
      '石敢当把最后一坛酒砸开分你一半，酒气冲得人眼眶发热。他抹了把嘴：「我石敢当没读过几本书，只认得两个字——兄弟。往后你的事，就是我的事；我的命，你随便使。」',
  },
  {
    id: 'mo_chen',
    name: '墨尘',
    gender: 'male',
    align: 'demonic',
    title: '幽冥鬼宗·引魂书生',
    desc: '笔下一纸鬼门，谈笑间替你补了三处命缺。',
    giftPrefs: { demon_shard: 13, fox_core: 6, pill_qi: 5 },
    giftDefault: 2,
    marryAt: 120,
    heartAt: [40, 80],
    heartTexts: [
      '他蘸墨在你掌心画了一道符：「阴司若来勾你，我替你把名划了。」',
      '「我这一生只写过一封信。」他把信递给你，收信人是你。',
    ],
    dualMul: 1.2,
    breakthroughBonus: 3,
    minRealm: 'foundation',
    swornText:
      '墨尘铺开一张黄纸，写下两人生辰，又在你我名字之间勾了一道连魂的符：「鬼宗的义，不拜天地，只立契。」他吹干墨迹，笑意很深：「从今往后，我笔下的命数，你占一半。」',
  },
  {
    id: 'shen_guzhou',
    name: '沈孤舟',
    gender: 'male',
    align: 'neutral',
    title: '剑冢·守冢人',
    desc: '守着一冢无名剑，寡言，酒量与剑意俱深。',
    giftPrefs: { tiger_bone: 10, pill_qi: 8, fox_core: 5 },
    giftDefault: 3,
    marryAt: 135,
    heartAt: [45, 88],
    heartTexts: [
      '他把祖传的剑穗剪下一半给你：「留个念想，别死。」',
      '剑冢深处，他指着两柄并排的剑：「一柄是我的，一柄……留给你。」',
    ],
    dualMul: 1.18,
    breakthroughBonus: 8,
    minRealm: 'golden_core',
    swornText:
      '剑冢深处，沈孤舟取了两柄无名剑，并插于冢前。他斟酒，只说了一句：「剑在，人在。」酒尽时满冢剑鸣自起，像是有无数亡剑替你们作了见证。',
  },
]

/** 隐藏道侣：高境界 + 特殊事件解锁 */
const HIDDEN_COMPANION: CompanionDef = {
  ...(stories.hidden as HiddenCompanionJson),
  postStory: stories.hidden.postStory ?? [],
}

export const COMPANIONS: CompanionDef[] = [...BASE_COMPANIONS, HIDDEN_COMPANION]

/** 双修最低好感（唯一口径：面板按钮与 store 判定共用，勿各写一个 40） */
export const DUAL_CULTIVATE_AFFINITY_MIN = 40
/** 正魔之恋额外好感门槛（在 marryAt / 双修门槛之上再加） */
export const CROSS_ALIGNMENT_AFFINITY_EXTRA = 40
/** 每日闲谈可增好感的次数上限（超出不再加好感） */
export const CHAT_AFFINITY_DAILY_LIMIT = 3
/** 每日收礼次数上限（超出婉拒收礼） */
export const GIFT_DAILY_LIMIT = 2
/** 结缘（道侣）灵石花费 */
export const MARRY_STONES_COST = 200
/** 结拜（义兄弟）灵石花费 */
export const SWORN_STONES_COST = 100

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
