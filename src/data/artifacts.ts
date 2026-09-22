import artifactDb from './db/artifact_recipes.json'
import { ITEMS } from './items'
import type { ClassId } from '../types'

export type ArtifactQuality = 'mortal' | 'spirit' | 'treasure' | 'immortal'

export type AffixKind = 'combat' | 'cultivate' | 'battle'

export interface AffixDef {
  id: string
  name: string
  desc: string
  kind: AffixKind
  weight: number
  minQuality?: ArtifactQuality
  atk?: number
  def?: number
  hp?: number
  breakthrough?: number
  dmgReduce?: number
  swordIntent?: number
  counter?: number
  offline?: number
  skillMul?: number
}

export interface Affix {
  id: string
}

export interface ArtifactInstance {
  uid: string
  /** 对应 items 中的法宝 id，如 treasure_sword */
  itemId: string
  /** 展示名 */
  name: string
  quality: ArtifactQuality
  affixes: Affix[]
  /** 出战/认主生效（同类仅一件） */
  equipped: boolean
  /** 打造来源配方（追溯） */
  recipeId?: string
}

export interface ArtifactRecipeDef {
  id: string
  name: string
  itemId: string
  desc: string
  baseRate: number
  craftDays: number
  minForgeLevel: number
  qualityFloor?: ArtifactQuality
  inputs: { itemId: string; count: number }[]
  stoneCost: number
}

export interface QualityDef {
  id: ArtifactQuality
  name: string
  affixCount: number
  weight: number
}

export interface ForgeLevelDef {
  level: number
  name: string
  desc?: string
  rateBonus: number
  qualityCap: ArtifactQuality
  upgradeCost: number
  upgradeDays?: number
}

const QUALITY_ORDER: ArtifactQuality[] = ['mortal', 'spirit', 'treasure', 'immortal']

export const QUALITIES: Record<ArtifactQuality, QualityDef> = artifactDb.qualities as Record<
  ArtifactQuality,
  QualityDef
>
export const AFFIXES: AffixDef[] = artifactDb.affixes as AffixDef[]
export const AFFIX_MAP: Record<string, AffixDef> = Object.fromEntries(AFFIXES.map((a) => [a.id, a]))
export const FORGE_LEVELS: ForgeLevelDef[] = artifactDb.forgeLevels as ForgeLevelDef[]
export const ARTIFACT_RECIPES: ArtifactRecipeDef[] = artifactDb.recipes as ArtifactRecipeDef[]
export const ARTIFACT_RECIPE_MAP: Record<string, ArtifactRecipeDef> = Object.fromEntries(
  ARTIFACT_RECIPES.map((r) => [r.id, r]),
)

export function qualityIndex(q: ArtifactQuality): number {
  return QUALITY_ORDER.indexOf(q)
}

export function qualityLabel(q: ArtifactQuality): string {
  return QUALITIES[q]?.name ?? q
}

export function qualityClass(q: ArtifactQuality): string {
  if (q === 'immortal') return 'text-gold'
  if (q === 'treasure') return 'text-vermilion'
  if (q === 'spirit') return 'text-jade'
  return 'text-text-dim'
}

export function forgeLevelDef(level: number): ForgeLevelDef {
  const lv = Math.max(0, Math.min(FORGE_LEVELS.length - 1, Math.floor(level)))
  return FORGE_LEVELS[lv]
}

export function affixLabel(affix: Affix): string {
  return AFFIX_MAP[affix.id]?.desc ?? affix.id
}

export function describeAffix(affix: Affix | string): string {
  const id = typeof affix === 'string' ? affix : affix.id
  const a = AFFIX_MAP[id]
  return a ? `${a.name}：${a.desc}` : id
}

export const ARTIFACT_QUALITY_LABEL = {
  mortal: '凡品',
  spirit: '灵器',
  treasure: '宝器',
  immortal: '仙器',
} as const

export const ARTIFACT_QUALITY_CLASS = {
  mortal: 'text-text-dim',
  spirit: 'text-jade',
  treasure: 'text-gold',
  immortal: 'text-vermilion',
} as const

/** 洗练/随机词条：受品质与器阁上限约束 */
export function rollAffixIds(
  quality: ArtifactQuality,
  qualityCap: ArtifactQuality,
  rng: () => number = Math.random,
): string[] {
  const q = QUALITIES[quality]
  if (!q || q.affixCount <= 0) return []
  const maxQ = Math.min(qualityIndex(quality), qualityIndex(qualityCap))
  const pool = AFFIXES.filter((a) => {
    const minQ = a.minQuality ? qualityIndex(a.minQuality) : 0
    return minQ <= maxQ
  })
  const picked: string[] = []
  const bag = [...pool]
  while (picked.length < q.affixCount && bag.length > 0) {
    const total = bag.reduce((n, a) => n + a.weight, 0)
    let roll = rng() * total
    let idx = 0
    for (let i = 0; i < bag.length; i++) {
      roll -= bag[i].weight
      if (roll <= 0) {
        idx = i
        break
      }
    }
    picked.push(bag[idx].id)
    bag.splice(idx, 1)
  }
  return picked
}

/** 品质 roll：受器阁上限与配方保底影响 */
export function rollQuality(
  qualityCap: ArtifactQuality,
  qualityFloor?: ArtifactQuality,
  classId?: ClassId,
  rng: () => number = Math.random,
): ArtifactQuality {
  const capIdx = qualityIndex(qualityCap)
  const floorIdx = qualityFloor ? qualityIndex(qualityFloor) : 0
  const options = QUALITY_ORDER.slice(floorIdx, capIdx + 1)
  if (options.length <= 0) return 'mortal'
  let total = 0
  const weights = options.map((q) => {
    let w = QUALITIES[q].weight
    // 器修更容易出高品质
    if (classId === 'artifact' && q !== 'mortal') w *= 1.35
    total += w
    return w
  })
  let roll = rng() * total
  for (let i = 0; i < options.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return options[i]
  }
  return options[options.length - 1]
}

export function makeArtifactUid(): string {
  return `art_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`
}

export function artifactDisplayName(itemId: string, fallback?: string): string {
  const item = ITEMS[itemId]?.name
  if (item) return item
  // 兜底：历史脏数据里 name 存了 id 时也不展示 treasure_xxx
  if (fallback && fallback !== itemId && !fallback.startsWith('treasure_') && !fallback.startsWith('art_')) {
    return fallback
  }
  return fallback && fallback !== itemId ? fallback : itemId
}

export function createArtifactInstance(opts: {
  itemId: string
  quality: ArtifactQuality
  name?: string
  recipeId?: string
  classId?: ClassId
  qualityCap: ArtifactQuality
  rng?: () => number
}): ArtifactInstance {
  const rng = opts.rng ?? Math.random
  return {
    uid: makeArtifactUid(),
    itemId: opts.itemId,
    name: artifactDisplayName(opts.itemId, opts.name),
    quality: opts.quality,
    affixes: rollAffixIds(opts.quality, opts.qualityCap, rng).map((id) => ({ id })),
    equipped: false,
    recipeId: opts.recipeId,
  }
}

/** 洗练费用 */
export function refineCost(quality: ArtifactQuality): { stones: number; mat?: string; matCount?: number } {
  switch (quality) {
    case 'spirit':
      return { stones: 300 }
    case 'treasure':
      return { stones: 1200, mat: 'tiger_bone', matCount: 1 }
    case 'immortal':
      return { stones: 5000, mat: 'mat_core', matCount: 1 }
    default:
      return { stones: 100 }
  }
}

/** 分解返还 */
export function decomposeYield(quality: ArtifactQuality): { itemId: string; count: number }[] {
  switch (quality) {
    case 'immortal':
      return [
        { itemId: 'tiger_bone', count: 3 },
        { itemId: 'mat_core', count: 2 },
      ]
    case 'treasure':
      return [
        { itemId: 'tiger_bone', count: 2 },
        { itemId: 'mat_foundation', count: 1 },
      ]
    case 'spirit':
      return [{ itemId: 'tiger_bone', count: 1 }]
    default:
      return [{ itemId: 'tiger_bone', count: 1 }]
  }
}

export function artifactCombatBonus(list: ArtifactInstance[]): {
  atk: number
  def: number
  hp: number
  dmgReduce: number
  skillMul: number
  swordIntent: number
  counter: number
} {
  let atk = 1
  let def = 1
  let hp = 1
  let dmgReduce = 0
  let skillMul = 1
  let swordIntent = 0
  let counter = 0
  const seen = new Set<string>()
  for (const art of list) {
    if (!art.equipped || seen.has(art.itemId)) continue
    seen.add(art.itemId)
    for (const a of art.affixes) {
      const d = AFFIX_MAP[a.id]
      if (!d) continue
      if (d.atk) atk *= 1 + d.atk
      if (d.def) def *= 1 + d.def
      if (d.hp) hp *= 1 + d.hp
      if (d.dmgReduce) dmgReduce += d.dmgReduce
      if (d.skillMul) skillMul *= 1 + d.skillMul
      if (d.swordIntent) swordIntent += d.swordIntent
      if (d.counter) counter += d.counter
    }
  }
  return { atk, def, hp, dmgReduce, skillMul, swordIntent, counter }
}

export function artifactBreakthroughBonus(list: ArtifactInstance[]): number {
  let bonus = 0
  const seen = new Set<string>()
  for (const art of list) {
    if (!art.equipped || seen.has(art.itemId)) continue
    seen.add(art.itemId)
    for (const a of art.affixes) {
      const d = AFFIX_MAP[a.id]
      if (d?.breakthrough) bonus += d.breakthrough
    }
  }
  return bonus
}

export function artifactOfflineMul(list: ArtifactInstance[]): number {
  let mul = 1
  const seen = new Set<string>()
  for (const art of list) {
    if (!art.equipped || seen.has(art.itemId)) continue
    seen.add(art.itemId)
    for (const a of art.affixes) {
      const d = AFFIX_MAP[a.id]
      if (d?.offline) mul *= 1 + d.offline
    }
  }
  return mul
}

export function describeArtifact(art: ArtifactInstance): string {
  const q = qualityLabel(art.quality)
  const aff = art.affixes.map((a) => affixLabel(a)).join('、')
  return aff ? `${q} · ${aff}` : `${q}（无词条）`
}
