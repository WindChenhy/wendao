import {
  ARTIFACT_QUALITY_CLASS,
  ARTIFACT_QUALITY_LABEL,
  ARTIFACT_RECIPES,
  artifactDisplayName,
  decomposeYield,
  describeAffix,
  describeArtifact,
  forgeLevelDef,
  refineCost,
  type ArtifactInstance,
} from '../data/artifacts'
import { canForge } from '../game/artifactCraft'
import { ITEMS } from '../data/items'
import { formatNum } from '../game/format'
import { useGameStore } from '../stores/useGameStore'

export function ArtifactForgePanel() {
  const player = useGameStore((s) => s.player)
  const abode = useGameStore((s) => s.abode)
  const inventory = useGameStore((s) => s.inventory)
  const stones = useGameStore((s) => s.stones)
  const artifacts = useGameStore((s) => s.artifacts)
  const upgradeForge = useGameStore((s) => s.upgradeForge)
  const forgeArtifact = useGameStore((s) => s.forgeArtifact)
  const refineArtifact = useGameStore((s) => s.refineArtifact)
  const equipArtifact = useGameStore((s) => s.equipArtifact)
  const decomposeArtifact = useGameStore((s) => s.decomposeArtifact)

  if (!player) return null
  const forgeLevel = abode.forgeLevel ?? 0
  const lvDef = forgeLevelDef(forgeLevel)
  const nextLv = forgeLevel < 3 ? forgeLevelDef(forgeLevel + 1) : null
  const dead = !player.alive

  return (
    <div className="panel-box p-4">
      <div className="flex justify-between items-start gap-2 mb-2">
        <div>
          <div className="font-display text-gold">器阁 · 炼器</div>
          <div className="text-xs text-text-dim mt-1">{lvDef.desc}</div>
          <div className="text-xs text-text-dim mt-1">
            当前 <span className="text-gold">{lvDef.name}</span>
            {' · '}品质上限{' '}
            <span className={ARTIFACT_QUALITY_CLASS[lvDef.qualityCap]}>
              {ARTIFACT_QUALITY_LABEL[lvDef.qualityCap]}
            </span>
            {' · '}打造成功率 +{lvDef.rateBonus}%
          </div>
        </div>
        {nextLv && (
          <button
            className="pixel-btn text-xs shrink-0"
            disabled={dead || stones < lvDef.upgradeCost}
            onClick={upgradeForge}
            title={`升级为 ${nextLv.name}`}
          >
            升级器阁 · {formatNum(lvDef.upgradeCost)} 灵石
          </button>
        )}
      </div>
      {forgeLevel === 0 && (
        <p className="text-xs text-vermilion mb-2">尚未建造器阁，无法打造法宝。请先升级。</p>
      )}

      <div className="text-xs text-text-dim mb-2">
        材料 → 器阁开炉 → 法宝（凡/灵/宝/仙）→ 认主出战 / 洗练词条 / 分解。器修成功率更高；同类法宝仅一件生效。
      </div>

      <div className="space-y-2 mb-4">
        {ARTIFACT_RECIPES.map((r) => {
          const chk = canForge({
            recipeId: r.id,
            inventory,
            stones,
            forgeLevel,
          })
          const ready = chk.ok
          const lock = forgeLevel < r.minForgeLevel
          return (
            <div key={r.id} className="border border-border px-3 py-2 text-sm">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <div>
                    {r.name}
                    <span className="text-xs text-text-dim ml-2">{r.desc}</span>
                  </div>
                  <div className="text-xs text-text-dim mt-1">
                    需器阁 {r.minForgeLevel} 级 · 耗时 {r.craftDays} 日 ·{' '}
                    {r.inputs
                      .map((i) => `${ITEMS[i.itemId]?.name ?? i.itemId}×${i.count}（有 ${inventory[i.itemId] ?? 0}）`)
                      .join('、')}
                  </div>
                </div>
                <button
                  className="pixel-btn text-xs shrink-0"
                  disabled={dead || lock || !ready}
                  onClick={() => forgeArtifact(r.id)}
                >
                  {lock ? `需器阁${r.minForgeLevel}` : ready ? '开炉' : chk.reason ?? '不可打造'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="font-display text-gold text-sm mb-2">法宝库（{artifacts.length}）</div>
      {artifacts.length === 0 ? (
        <p className="text-xs text-text-dim">尚无法宝。可打造，或坊市购入。</p>
      ) : (
        <div className="space-y-2">
          {artifacts.map((a) => (
            <ArtifactRow
              key={a.uid}
              art={a}
              stones={stones}
              inventory={inventory}
              onRefine={() => refineArtifact(a.uid)}
              onEquip={() => equipArtifact(a.uid)}
              onDecompose={() => decomposeArtifact(a.uid)}
              disabled={dead}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ArtifactRow({
  art,
  stones,
  inventory,
  onRefine,
  onEquip,
  onDecompose,
  disabled,
}: {
  art: ArtifactInstance
  stones: number
  inventory: Record<string, number>
  onRefine: () => void
  onEquip: () => void
  onDecompose: () => void
  disabled: boolean
}) {
  const cost = refineCost(art.quality)
  const salvage = decomposeYield(art.quality)
  const canRefine =
    stones >= cost.stones &&
    (!cost.mat || !cost.matCount || (inventory[cost.mat] ?? 0) >= cost.matCount)
  return (
    <div className={`border px-3 py-2 text-xs ${art.equipped ? 'border-gold/70' : 'border-border'}`}>
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <div className="text-sm">
            {artifactDisplayName(art.itemId, art.name)}
            <span className={`ml-2 ${ARTIFACT_QUALITY_CLASS[art.quality]}`}>
              {ARTIFACT_QUALITY_LABEL[art.quality]}
            </span>
            {art.equipped && <span className="text-gold ml-2">出战</span>}
          </div>
          <div className="text-text-dim mt-1">{describeArtifact(art)}</div>
          {art.affixes.length > 0 && (
            <ul className="text-text-dim mt-1 list-disc pl-4">
              {art.affixes.map((af) => (
                <li key={af.id}>{describeAffix(af)}</li>
              ))}
            </ul>
          )}
          <div className="text-[11px] text-text-dim mt-1">
            分解返还：
            {salvage.map((y) => `${ITEMS[y.itemId]?.name ?? y.itemId}×${y.count}`).join('、')}
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {!art.equipped && (
            <button className="pixel-btn text-[11px]" disabled={disabled} onClick={onEquip}>
              认主出战
            </button>
          )}
          <button className="pixel-btn text-[11px]" disabled={disabled || !canRefine} onClick={onRefine}>
            洗练 ·{cost.stones}
            {cost.mat && cost.matCount ? `+${ITEMS[cost.mat]?.name ?? cost.mat}×${cost.matCount}` : ''}
          </button>
          <button className="pixel-btn text-[11px]" disabled={disabled} onClick={onDecompose}>
            分解
          </button>
        </div>
      </div>
    </div>
  )
}
