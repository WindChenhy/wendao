import {
  ARTIFACT_RECIPE_MAP,
  createArtifactInstance,
  forgeLevelDef,
  qualityIndex,
  rollQuality,
  type ArtifactInstance,
  type ArtifactQuality,
} from '../data/artifacts'
import type { ClassId } from '../types'

export interface CraftOutcome {
  ok: boolean
  rate: number
  instance?: ArtifactInstance
  message: string
}

/** 炼器成功率：配方基础 + 器阁 + 器修 + 道痕 */
export function artifactCraftRate(opts: {
  recipeId: string
  classId: ClassId
  daoMarks: number
  forgeLevel: number
}): number {
  const recipe = ARTIFACT_RECIPE_MAP[opts.recipeId]
  if (!recipe) return 0
  let rate = recipe.baseRate
  rate += forgeLevelDef(opts.forgeLevel).rateBonus
  if (opts.classId === 'artifact') rate += 15
  rate += Math.min(10, Math.floor(opts.daoMarks / 25))
  return Math.max(15, Math.min(95, rate))
}

export function canForge(opts: {
  recipeId: string
  inventory: Record<string, number>
  stones: number
  forgeLevel: number
}): { ok: boolean; reason?: string } {
  const recipe = ARTIFACT_RECIPE_MAP[opts.recipeId]
  if (!recipe) return { ok: false, reason: '无此配方' }
  if (opts.forgeLevel < recipe.minForgeLevel) {
    return { ok: false, reason: `需器阁 ${recipe.minForgeLevel} 级` }
  }
  if (opts.stones < recipe.stoneCost) return { ok: false, reason: '灵石不足' }
  for (const input of recipe.inputs) {
    if ((opts.inventory[input.itemId] ?? 0) < input.count) {
      return { ok: false, reason: '材料不足' }
    }
  }
  return { ok: true }
}

export function consumeForgeMaterials(
  inventory: Record<string, number>,
  recipeId: string,
  stones: number,
): { inventory: Record<string, number>; stones: number } {
  const recipe = ARTIFACT_RECIPE_MAP[recipeId]
  const inv = { ...inventory }
  let nextStones = stones
  if (!recipe) return { inventory: inv, stones: nextStones }
  for (const input of recipe.inputs) {
    inv[input.itemId] = (inv[input.itemId] ?? 0) - input.count
    if ((inv[input.itemId] ?? 0) <= 0) delete inv[input.itemId]
  }
  nextStones = Math.max(0, nextStones - recipe.stoneCost)
  return { inventory: inv, stones: nextStones }
}

export function rollCraftQuality(opts: {
  recipeId: string
  classId: ClassId
  forgeLevel: number
  rng?: () => number
}): ArtifactQuality {
  const recipe = ARTIFACT_RECIPE_MAP[opts.recipeId]
  const cap = forgeLevelDef(opts.forgeLevel).qualityCap
  return rollQuality(cap, recipe?.qualityFloor, opts.classId, opts.rng)
}

export function performCraft(opts: {
  recipeId: string
  classId: ClassId
  daoMarks: number
  forgeLevel: number
  rng?: () => number
}): CraftOutcome {
  const recipe = ARTIFACT_RECIPE_MAP[opts.recipeId]
  if (!recipe) return { ok: false, rate: 0, message: '无此配方。' }
  const rate = artifactCraftRate(opts)
  const rng = opts.rng ?? Math.random
  const roll = rng() * 100
  if (roll >= rate) {
    return {
      ok: false,
      rate,
      message: `器炉炸裂，「${recipe.name}」未成。（成功率约 ${Math.round(rate)}%）`,
    }
  }
  const quality = rollCraftQuality({
    recipeId: opts.recipeId,
    classId: opts.classId,
    forgeLevel: opts.forgeLevel,
    rng,
  })
  const qualityCap = forgeLevelDef(opts.forgeLevel).qualityCap
  const instance = createArtifactInstance({
    itemId: recipe.itemId,
    quality,
    recipeId: recipe.id,
    classId: opts.classId,
    qualityCap,
    rng,
  })
  return {
    ok: true,
    rate,
    instance,
    message: `器成！「${recipe.name}」出炉。（成功率约 ${Math.round(rate)}%）`,
  }
}

export function maxCraftableQualityText(level: number): string {
  return forgeLevelDef(level).qualityCap
}

export function isBetterQuality(a: ArtifactQuality, b: ArtifactQuality): boolean {
  return qualityIndex(a) > qualityIndex(b)
}
