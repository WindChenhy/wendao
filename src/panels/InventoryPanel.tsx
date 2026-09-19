import { useState } from 'react'
import { CATEGORY_LABELS, ITEMS, itemCategory, treasureEffectText, type ItemCategory } from '../data/items'
import {
  GONGFA_GRADE_CLASS,
  GONGFA_STAGE_LABELS,
  GONGFAS,
  gongfaEffectText,
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
  // 法宝统一在下方"已认主"区块展示，不重复出现在物品列表
  const visible = entries.filter(([id]) => {
    if (itemCategory(id) === 'treasure') return false
    return tab === 'all' || itemCategory(id) === tab
  })
  const learnedList = Object.entries(gongfa.learned)
  const hasScrolls = entries.some(([id]) => itemCategory(id) === 'gongfa')

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

        {/* 功法：已参悟的功法（不占物品格，进阶在修炼页操作） */}
        {tab === 'all' || tab === 'gongfa' ? (
          <>
            {learnedList.length > 0 && (
              <div className="space-y-2 mb-3">
                {learnedList.map(([id, st]) => {
                  const g = GONGFAS[id]
                  if (!g) return null
                  const stageName = GONGFA_STAGE_LABELS[st.stage]
                  return (
                    <div key={id} className="border border-border px-3 py-2">
                      <div className="text-sm">
                        <span className={GONGFA_GRADE_CLASS[g.grade]}>{g.grade}</span>
                        <span className="text-text-dim mx-1.5 text-xs">{g.kind}</span>
                        <span className="text-gold">{g.name}</span>
                        <span className="text-jade ml-2">{stageName}</span>
                      </div>
                      <div className="text-xs text-text-dim mt-0.5">
                        当前加成：{gongfaEffectText(g, st.stage)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {!hasScrolls && learnedList.length === 0 && tab === 'gongfa' && (
              <div className="text-xs text-text-dim mb-2">
                尚无功法。可前往坊市购买秘籍，或在宗门藏经阁参悟。
              </div>
            )}
          </>
        ) : null}

        {/* 物品列表 */}
        {visible.length === 0 && tab !== 'gongfa' && (
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
                  <div className="text-xs text-text-dim mt-0.5">{item.desc}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {isGongfa && (
                    <button
                      className="pixel-btn text-xs primary"
                      onClick={() => comprehendGongfa(id)}
                    >
                      参悟
                    </button>
                  )}
                  {item.effect && (
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

        {/* 法宝/装备：奇遇所得出世法宝 */}
        {(tab === 'all' || tab === 'treasure') && treasures.length > 0 && (
          <div className="space-y-2 mt-3">
            {treasures.map((id) => {
              const item = ITEMS[id]
              if (!item) return null
              return (
                <div
                  key={id}
                  className="border border-gold/40 px-3 py-2 flex justify-between gap-2 items-start"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-gold">{item.name}</div>
                    <div className="text-xs text-text-dim mt-0.5">{item.desc}</div>
                    <div className="text-xs text-jade mt-0.5">加成：{treasureEffectText(id)}</div>
                  </div>
                  <button
                    className="pixel-btn text-xs shrink-0"
                    onClick={() => sellItem(id)}
                  >
                    售
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
