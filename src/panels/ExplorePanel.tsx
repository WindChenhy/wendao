import { ENEMIES, enemyFactionLabel, enemyRealmLabel } from '../data/enemies'
import { ITEMS } from '../data/items'
import { useGameStore } from '../stores/useGameStore'

export function ExplorePanel() {
  const player = useGameStore((s) => s.player)
  const explore = useGameStore((s) => s.explore)
  const exploring = useGameStore((s) => s.exploring)
  const lastCombat = useGameStore((s) => s.lastCombat)
  const clearCombat = useGameStore((s) => s.clearCombat)

  if (!player) return null
  const dead = !player.alive

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      <div className="panel-box p-4">
        <div className="font-display text-gold mb-2">出门历练</div>
        <p className="text-xs text-text-dim mb-3">
          修仙界并不太平：山中妖兽、路遇魔修皆有可能。获胜得修为与灵石；突破材料多藏于高阶敌人与秘境。
        </p>
        <button className="pixel-btn primary" disabled={dead || exploring} onClick={explore}>
          {exploring ? '激斗中…' : '踏入山野（消耗一日）'}
        </button>
      </div>

      {lastCombat && (
        <div className="panel-box p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-display text-gold">遭遇 · {lastCombat.enemy.name}</div>
            <span className={`text-xs ${lastCombat.win ? 'text-bamboo' : 'text-vermilion'}`}>
              {lastCombat.win ? '胜利' : '败退'}
            </span>
          </div>
          <div className="text-xs text-text-dim mb-2">{lastCombat.enemy.flavor}</div>
          <div className="max-h-40 overflow-y-auto scroll-thin text-xs space-y-0.5 border border-border p-2 bg-ink">
            {lastCombat.log.map((l, i) => (
              <div key={i} className="log-line t-dim">
                {l}
              </div>
            ))}
          </div>
          <button className="pixel-btn mt-3 text-xs" onClick={clearCombat}>
            收起战报
          </button>
        </div>
      )}

      <div className="panel-box p-4">
        <div className="font-display text-gold mb-2">已知威胁（图鉴预览）</div>
        <div className="space-y-2">
          {ENEMIES.map((e) => (
            <div key={e.id} className="border border-border px-3 py-2 text-xs flex gap-3 justify-between">
              <div className="min-w-0">
                <div className={e.faction === 'demonic' ? 'text-vermilion' : 'text-text'}>
                  {e.name}
                </div>
                <div className="text-text-dim mt-1">{e.flavor}</div>
              </div>
              <div className="text-text-dim shrink-0 text-right leading-relaxed">
                <div>{enemyFactionLabel(e)}</div>
                <div>{enemyRealmLabel(e)}</div>
                {e.loot.itemId && ITEMS[e.loot.itemId] && (
                  <div className="text-gold-dim mt-0.5">
                    可能掉落 {ITEMS[e.loot.itemId].name}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
