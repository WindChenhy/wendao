import { useState } from 'react'
import { CATEGORY_LABELS, ITEMS, itemCategory, itemScopeText, itemTierText, MARKET_STOCK, treasureEffectText } from '../data/items'
import {
  GONGFA_GRADE_CLASS,
  GONGFA_STAGE_LABELS,
  GONGFAS,
  canLearnGongfaFull as canLearnGongfa,
  gongfaScopeText,
  gongfaRealmText,
} from '../data/gongfa'
import { realmIndex } from '../data/realms'
import { formatNum } from '../game/format'
import { useGameStore } from '../stores/useGameStore'

type Tab = 'all' | 'herb' | 'gongfa' | 'treasure' | 'pill'
const TABS: Tab[] = ['all', 'herb', 'gongfa', 'treasure', 'pill']
const TAB_HINT: Record<Tab, string> = {
  all: '琳琅满目，皆是修真界常见的流通之物。',
  herb: '灵药丹材，炼丹与突破不可或缺。',
  gongfa: '功法秘籍，购入后在背包中参悟，打坐闭关可增进修习进度。',
  treasure: '出世法宝，重金求购，购入即认主生效。',
  pill: '丹药一份，对症服用。',
}

/** 大乘后坊市才上架渡劫令 */
const REALM_GATED_ITEMS: { id: string; minRealm: Parameters<typeof realmIndex>[0] }[] = [
  { id: 'mat_tribulation', minRealm: 'mahayana' },
]

export function MarketPanel() {
  const [tab, setTab] = useState<Tab>('all')
  const [pendingBuyId, setPendingBuyId] = useState<string | null>(null)
  const stones = useGameStore((s) => s.stones)
  const inventory = useGameStore((s) => s.inventory)
  const learned = useGameStore((s) => s.gongfa.learned)
  const player = useGameStore((s) => s.player)
  const buyItem = useGameStore((s) => s.buyItem)

  const ids = TABS.filter((t) => t !== 'all')
    .flatMap((t) => MARKET_STOCK[t])
    .filter((id) => tab === 'all' || itemCategory(id) === tab)
    .filter((id) => {
      const gate = REALM_GATED_ITEMS.find((g) => g.id === id)
      if (!gate) return true
      if (!player) return false
      return realmIndex(player.realm) >= realmIndex(gate.minRealm)
    })

  const requestBuy = (id: string) => {
    const item = ITEMS[id]
    if (!item || stones < item.price) return
    const g = itemCategory(id) === 'gongfa' ? GONGFAS[id.slice('scroll_'.length)] : null
    if (g && learned[g.id]) {
      setPendingBuyId(id)
      return
    }
    buyItem(id)
  }

  const pendingItem = pendingBuyId ? ITEMS[pendingBuyId] : null
  const pendingG =
    pendingBuyId && itemCategory(pendingBuyId) === 'gongfa'
      ? GONGFAS[pendingBuyId.slice('scroll_'.length)]
      : null
  const pendingStage = pendingG ? learned[pendingG.id] : null

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      <div className="panel-box p-4">
        <div className="flex justify-between items-center mb-3">
          <div className="font-display text-gold">坊市</div>
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
        <p className="text-xs text-text-dim mb-3">{TAB_HINT[tab]}</p>
        <div className="space-y-2">
          {ids.map((id) => {
            const item = ITEMS[id]
            if (!item) return null
            const g = itemCategory(id) === 'gongfa' ? GONGFAS[id.slice('scroll_'.length)] : null
            const owned = inventory[id] ?? 0
            const st = g ? learned[g.id] : null
            return (
              <div
                key={id}
                className="border border-border px-3 py-2 flex justify-between items-center gap-2"
              >
                <div className="min-w-0">
                  <div className="text-sm">
                    {g ? (
                      <>
                        <span className={GONGFA_GRADE_CLASS[g.grade]}>{g.grade}</span>
                        <span className="text-text-dim mx-1.5 text-xs">{g.kind}</span>
                        <span className="text-gold">{g.name}</span>
                        <span className="text-xs text-text-dim ml-2">秘籍</span>
                        <span
                          className={`text-xs ml-2 ${
                            player && canLearnGongfa(g, player.realm)
                              ? 'text-text-dim'
                              : 'text-vermilion'
                          }`}
                        >
                          {gongfaRealmText(g)}
                        </span>
                        {st && (
                          <span className="text-xs text-bamboo ml-2">
                            已学习/已参悟
                            <span className="text-text-dim ml-1">· {GONGFA_STAGE_LABELS[st.stage]}</span>
                          </span>
                        )}
                      </>
                    ) : (
                      item.name
                    )}
                    {owned > 0 && <span className="text-xs text-jade ml-2">已有 ×{owned}</span>}
                  </div>
                  <div className="text-xs text-text-dim mt-0.5">{item.desc}</div>
                  {(item.pillGrade || item.herbTier || item.treasureTier) && (
                    <div className="text-[11px] text-jade mt-0.5">
                      {itemTierText(item)}
                      {itemScopeText(item) ? ` · ${itemScopeText(item)}` : ''}
                    </div>
                  )}
                  {g && <div className="text-[11px] text-jade mt-0.5">{gongfaScopeText(g)}</div>}
                  {st && g && (
                    <div className="text-xs text-bamboo mt-0.5">
                      此功法已参悟，再次购买秘籍无法重复参悟。
                    </div>
                  )}
                  {itemCategory(id) === 'treasure' && (
                    <div className="text-xs text-jade mt-0.5">加成：{treasureEffectText(id)}</div>
                  )}
                </div>
                <button
                  className="pixel-btn text-xs shrink-0"
                  disabled={stones < item.price}
                  onClick={() => requestBuy(id)}
                >
                  {formatNum(item.price)} 灵石
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {pendingBuyId && pendingItem && pendingG && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="panel-box w-full max-w-md p-5 border-gold">
            <div className="text-[11px] text-gold mb-1 font-display tracking-widest">坊市 · 购买确认</div>
            <h3 className="font-display text-xl text-gold mb-2">《{pendingG.name}》秘籍</h3>
            <p className="text-sm text-text mb-4 leading-relaxed">
              已学习/参悟该功法
              {pendingStage ? `（当前「${GONGFA_STAGE_LABELS[pendingStage.stage]}」）` : ''}
              ，再次购买无法参悟，是否继续购买？
            </p>
            <div className="text-xs text-text-dim mb-4">
              花费灵石 {formatNum(pendingItem.price)} · 秘籍可转售（约五成半价）
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="pixel-btn primary" onClick={() => setPendingBuyId(null)}>
                取消
              </button>
              <button
                className="pixel-btn danger"
                onClick={() => {
                  buyItem(pendingBuyId)
                  setPendingBuyId(null)
                }}
              >
                继续购买
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
