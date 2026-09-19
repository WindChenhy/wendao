import { useState } from 'react'
import { CATEGORY_LABELS, ITEMS, itemCategory, treasureEffectText, type ItemCategory } from '../data/items'
import {
  GONGFAS,
  canLearnGongfa,
  gongfaRealmText,
} from '../data/gongfa'
import { formatNum } from '../game/format'
import { useGameStore } from '../stores/useGameStore'

type Tab = 'all' | ItemCategory
const TABS: Tab[] = ['all', 'herb', 'gongfa', 'treasure', 'pill']

export function InventoryPanel() {
  const [tab, setTab] = useState<Tab>('all')
  const player = useGameStore((s) => s.player)
  const inventory = useGameStore((s) => s.inventory)
  const treasures = useGameStore((s) => s.treasures)
  const gongfa = useGameStore((s) => s.gongfa)
  const stones = useGameStore((s) => s.stones)
  const applyItem = useGameStore((s) => s.useItem)
  const sellItem = useGameStore((s) => s.sellItem)
  const comprehendGongfa = useGameStore((s) => s.comprehendGongfa)

  if (!player) return null
  const entries = Object.entries(inventory).filter(([, n]) => n > 0)
  // 法宝统一在下方"已认主"区块展示；已参悟功法不再占用背包列表（修炼页可查看/进阶）
  const visible = entries.filter(([id]) => {
    if (itemCategory(id) === 'treasure') return false
    if (itemCategory(id) === 'gongfa') {
      const gid = id.slice('scroll_'.length)
      // 已参悟的秘籍不再显示（无法再参悟）；仅保留未参悟的待学习秘籍
      if (gongfa.learned[gid]) return false
    }
    return tab === 'all' || itemCategory(id) === tab
  })
  const hasVisibleGongfaScrolls = visible.some(([id]) => itemCategory(id) === 'gongfa')

  // 同类法宝合并计数：以 treasures 列表为主，兼看 inventory（坊市购入可能只写 inventory）
  const treasureGroups: { id: string; count: number }[] = (() => {
    const map = new Map<string, number>()
    for (const id of treasures) map.set(id, (map.get(id) ?? 0) + 1)
    for (const [id, n] of Object.entries(inventory)) {
      if (!id.startsWith('treasure_') || n <= 0) continue
      map.set(id, Math.max(map.get(id) ?? 0, n))
    }
    return [...map.entries()]
      .filter(([, n]) => n > 0)
      .map(([id, count]) => ({ id, count }))
  })()
  const showTreasureList = (tab === 'all' || tab === 'treasure') && treasureGroups.length > 0
  // 主列表为空时，若法宝区仍有内容，不能误报「此类暂无物品」
  const showBagEmptyHint = visible.length === 0 && !showTreasureList && tab !== 'gongfa'

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      <div className="panel-box p-4">
        <div className="flex justify-between items-center mb-3">
          <div className="font-display text-gold">乾坤袋</div>
          <div className="text-sm text-gold">灵石 {formatNum(stones)}</div>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {TABS.map((t) => (
            <button
              key={t}
              className={`pixel-btn text-xs ${tab === t ? 'primary' : ''}`}
              onClick={() => setTab(t)}
            >
              {CATEGORY_LABELS[t]}
            </button>
          ))}
        </div>

        {/* 功法：已参悟条目不在此展示，进阶请至修炼页 */}
        {tab === 'gongfa' && !hasVisibleGongfaScrolls && (
          <div className="text-xs text-text-dim mb-2">
            暂无待参悟秘籍。已参悟功法请在修炼页查看与进阶；坊市或藏经阁可获取新秘籍。
          </div>
        )}

        {/* 物品列表 */}
        {showBagEmptyHint && (
          <div className="text-xs text-text-dim">
            {tab === 'all' ? '空空如也。' : '此类暂无物品。'}
          </div>
        )}
        <div className="space-y-2">
          {visible.map(([id, n]) => {
            const item = ITEMS[id]
            if (!item) return null
            const isGongfa = itemCategory(id) === 'gongfa'
            const g = isGongfa ? GONGFAS[id.slice('scroll_'.length)] : null
            return (
              <div
                key={id}
                className="border border-border px-3 py-2 flex justify-between gap-2 items-start"
              >
                <div className="min-w-0">
                  <div className="text-sm">
                    {isGongfa && g ? (
                      <>
                        <span className="text-gold">{g.grade}</span> {item.name}
                      </>
                    ) : (
                      item.name
                    )}{' '}
                    <span className="text-gold">×{n}</span>
                  </div>
                  <div className="text-xs text-text-dim mt-0.5">
                    {item.desc}
                    {g && (
                      <span
                        className={`ml-2 ${
                          canLearnGongfa(g, player.realm) ? 'text-text-dim' : 'text-vermilion'
                        }`}
                      >
                        {gongfaRealmText(g)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {isGongfa && g && (
                    <button
                      className="pixel-btn text-xs primary"
                      disabled={!canLearnGongfa(g, player.realm)}
                      onClick={() => comprehendGongfa(id)}
                    >
                      {canLearnGongfa(g, player.realm) ? '参悟' : '境界不足'}
                    </button>
                  )}
                  {(item.effect?.hp || item.effect?.exp || item.effect?.stone) && (
                    <button className="pixel-btn text-xs" onClick={() => applyItem(id)}>
                      使用
                    </button>
                  )}
                  <button className="pixel-btn text-xs" onClick={() => sellItem(id)}>
                    售
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* 法宝/装备：同类合并为 ×N，不再逐件罗列 */}
        {showTreasureList && (
          <div className="space-y-2 mt-3">
            {treasureGroups.map(({ id, count }) => {
              const item = ITEMS[id]
              if (!item) return null
              return (
                <div
                  key={id}
                  className="border border-gold/40 px-3 py-2 flex justify-between gap-2 items-start"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-gold">
                      {item.name}
                      <span className="text-xs text-gold-dim ml-2">×{count}</span>
                      {count > 1 && (
                        <span className="text-xs text-text-dim ml-2">同类法宝合并显示</span>
                      )}
                    </div>
                    <div className="text-xs text-text-dim mt-0.5">{item.desc}</div>
                    <div className="text-xs text-jade mt-0.5">加成：{treasureEffectText(id)}</div>
                  </div>
                  <button
                    className="pixel-btn text-xs shrink-0"
                    onClick={() => sellItem(id)}
                  >
                    售 ×1
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
