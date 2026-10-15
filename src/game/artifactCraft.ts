import {
  ARTIFACT_RECIPE_MAP,
  createArtifactInstance,
  forgeLevelDef,
  rollQuality,
  type ArtifactInstance,
  type ArtifactQuality,
} from '../data/artifacts'
import { hasPath, pathIdsOf, type PathInput } from '../data/classes'
import { removeItem } from './inventory'

interface CraftOutcome {
  ok: boolean
  rate: number
  instance?: ArtifactInstance
  message: string
}

/** 炼器成功率：配方基础 + 器阁 + 器道 + 道痕 */
function artifactCraftRate(opts: {
  recipeId: string
  paths: PathInput
  daoMarks: number
  forgeLevel: number
}): number {
  const recipe = ARTIFACT_RECIPE_MAP[opts.recipeId]
  if (!recipe) return 0
  let rate = recipe.baseRate
  rate += forgeLevelDef(opts.forgeLevel).rateBonus
  if (hasPath(opts.paths, 'artifact')) rate += 15
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
    removeItem(inv, input.itemId, input.count)
  }
  nextStones = Math.max(0, nextStones - recipe.stoneCost)
  return { inventory: inv, stones: nextStones }
}

function rollCraftQuality(opts: {
  recipeId: string
  paths: PathInput
  forgeLevel: number
  rng?: () => number
}): ArtifactQuality {
  const recipe = ARTIFACT_RECIPE_MAP[opts.recipeId]
  const cap = forgeLevelDef(opts.forgeLevel).qualityCap
  return rollQuality(cap, recipe?.qualityFloor, opts.paths, opts.rng)
}

export function performCraft(opts: {
  recipeId: string
  paths: PathInput
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
    paths: opts.paths,
    forgeLevel: opts.forgeLevel,
    rng,
  })
  const qualityCap = forgeLevelDef(opts.forgeLevel).qualityCap
  const instance = createArtifactInstance({
    itemId: recipe.itemId,
    quality,
    recipeId: recipe.id,
    classId: pathIdsOf(opts.paths)[0],
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

