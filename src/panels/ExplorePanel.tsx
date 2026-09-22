import {
  ENEMY_TEMPLATES,
  ENEMY_TIER_LABEL,
  enemyFactionLabel,
  previewEnemy,
} from '../data/enemies'
import { ITEMS } from '../data/items'
import { realmIndex } from '../data/realms'
import { useGameStore } from '../stores/useGameStore'

export function ExplorePanel() {
  const player = useGameStore((s) => s.player)
  const explore = useGameStore((s) => s.explore)
  const exploring = useGameStore((s) => s.exploring)
  const activeCombat = useGameStore((s) => s.activeCombat)
  const lastCombat = useGameStore((s) => s.lastCombat)
  const clearCombat = useGameStore((s) => s.clearCombat)
  const skipExploreCombat = useGameStore((s) => s.skipExploreCombat)
  const setSkipExploreCombat = useGameStore((s) => s.setSkipExploreCombat)

  if (!player) return null
  const dead = !player.alive
  const ri = Math.max(0, realmIndex(player.realm))
  const inCombat = Boolean(activeCombat && !activeCombat.finished)

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      <div className="panel-box p-4">
        <div className="font-display text-gold mb-2">出门历练</div>
        <p className="text-xs text-text-dim mb-3">
          修仙界并不太平：山中妖兽、路遇魔修皆有可能。敌手境界随你的大境界抬升。
          {skipExploreCombat
            ? '当前已开启「跳过战斗」，点击后直接结算。'
            : '战斗中可手动放技能，或勾选「自动」托管；也可在设置中开启跳过战斗。'}
        </p>
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <button className="pixel-btn primary" disabled={dead || exploring || inCombat} onClick={explore}>
            {inCombat || exploring
              ? '激斗中…'
              : skipExploreCombat
                ? '踏入山野（跳过战斗）'
                : '踏入山野（消耗一日）'}
          </button>
          <label className="text-xs text-text-dim flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={skipExploreCombat}
              onChange={(e) => setSkipExploreCombat(e.target.checked)}
            />
            跳过战斗，直接结算
          </label>
        </div>
        {inCombat && !skipExploreCombat && (
          <p className="text-xs text-jade mt-2">战斗进行中，请在上方战斗面板出招。</p>
        )}
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
        <div className="flex items-center justify-between mb-2">
          <div className="font-display text-gold">已知威胁（图鉴预览）</div>
          <div className="text-xs text-text-dim">按你当前境界动态预估</div>
        </div>
        <div className="space-y-2">
          {ENEMY_TEMPLATES.map((t) => {
            const e = previewEnemy(t, ri, player.layer)
            return (
              <div key={t.id} className="border border-border px-3 py-2 text-xs flex gap-3 justify-between">
                <div className="min-w-0">
                  <div className={t.faction === 'demonic' ? 'text-vermilion' : 'text-text'}>
                    {t.name}
                    <span className="text-text-dim ml-2">{ENEMY_TIER_LABEL[t.tier]}</span>
                  </div>
                  <div className="text-text-dim mt-1">{t.flavor}</div>
                </div>
                <div className="text-text-dim shrink-0 text-right leading-relaxed">
                  <div>{enemyFactionLabel(e)}</div>
                  <div className="text-gold-dim">{`${e.layer}层 · 攻${e.atk} 防${e.def} 血${e.hp}`}</div>
                  {e.loot.itemId && ITEMS[e.loot.itemId] && (
                    <div className="text-gold-dim mt-0.5">
                      可能掉落 {ITEMS[e.loot.itemId].name}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
