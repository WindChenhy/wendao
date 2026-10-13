import { useState } from 'react'
import { CATEGORY_LABELS, ITEMS, itemCategory, itemScopeText, itemTierText, marketClueText, treasureEffectText, visibleStock, type MarketTab } from '../data/items'
import {
  GONGFA_GRADE_CLASS,
  GONGFA_STAGE_LABELS,
  GONGFAS,
  canLearnGongfaFull as canLearnGongfa,
  gongfaScopeText,
  gongfaRealmText,
} from '../data/gongfa'
import { REALMS } from '../data/realms'
import { formatNum } from '../game/format'
import { marketPriceOf } from '../game/bounty'
import { useGameStore } from '../stores/useGameStore'

const TABS: MarketTab[] = ['all', 'pill', 'herb', 'material', 'gongfa', 'treasure']
const TAB_HINT: Record<MarketTab, string> = {
  all: '琳琅满目，皆是修真界常见的流通之物。',
  pill: '丹药一份，对症服用。',
  herb: '灵药妖材，炼丹不可或缺。',
  material: '各境冲关灵材，名虽作丹莲晶玉，用的是那一点先天灵韵。',
  gongfa: '功法秘籍，购入后在背包中参悟，打坐闭关可增进修习进度。',
  treasure: '出世法宝，重金求购，购入即认主生效。',
}

export function MarketPanel() {
  const [tab, setTab] = useState<MarketTab>('all')
  const [pendingBuyId, setPendingBuyId] = useState<string | null>(null)
  const stones = useGameStore((s) => s.stones)
  const inventory = useGameStore((s) => s.inventory)
  const learned = useGameStore((s) => s.gongfa.learned)
  const player = useGameStore((s) => s.player)
  const wanted = useGameStore((s) => s.wanted)
  const buyItem = useGameStore((s) => s.buyItem)

  /** v1.4 成交价：与 buyItem 同一公式（通缉溢价 / 正道名宿九折；正魔称号互斥） */
  const priceOf = (id: string) => {
    const base = ITEMS[id]?.price ?? 0
    return marketPriceOf(base, {
      wanted,
      repRight: player?.repRight ?? 0,
      repDemonic: player?.repDemonic ?? 0,
    })
  }

  // R-14：货架可见性抽成纯函数（visibleStock）；超前 1–2 境的货物只显示线索
  const entries = player ? visibleStock(player.realm, tab) : []

  const requestBuy = (id: string) => {
    const item = ITEMS[id]
    if (!item || stones < priceOf(id)) return
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
          {entries.map(({ id, status }) => {
            const item = ITEMS[id]
            if (!item) return null
            const locked = !status.ok
            const g = itemCategory(id) === 'gongfa' ? GONGFAS[id.slice('scroll_'.length)] : null
            const owned = inventory[id] ?? 0
            const st = g ? learned[g.id] : null
            return (
              <div
                key={id}
                className={`border px-3 py-2 flex justify-between items-center gap-2 ${
                  locked ? 'border-border/50 opacity-60' : 'border-border'
                }`}
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
                  {locked ? (
                    <div className="text-[11px] text-vermilion mt-0.5">
                      {marketClueText(status.minRealm)}
                      {g ? `（${REALMS[status.minRealm]?.name ?? status.minRealm}后方可参悟）` : ''}
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
                <button
                  className="pixel-btn text-xs shrink-0"
                  disabled={locked || stones < priceOf(id)}
                  onClick={() => requestBuy(id)}
                >
                  {locked ? (
                    `需${REALMS[status.minRealm]?.name ?? status.minRealm}修为`
                  ) : (
                    <>
                      {formatNum(priceOf(id))} 灵石
                      {priceOf(id) !== item.price && (
                        <span className="ml-1 text-[10px]">
                          （原价 {formatNum(item.price)}）
                        </span>
                      )}
                    </>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {pendingBuyId && pendingItem && pendingG && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="panel-box w-full max-w-md p-5 border-gold max-h-[85dvh] overflow-y-auto scroll-thin">
            <div className="text-[11px] text-gold mb-1 font-display tracking-widest">坊市 · 购买确认</div>
            <h3 className="font-display text-xl text-gold mb-2">《{pendingG.name}》秘籍</h3>
            <p className="text-sm text-text mb-4 leading-relaxed">
              已学习/参悟该功法
              {pendingStage ? `（当前「${GONGFA_STAGE_LABELS[pendingStage.stage]}」）` : ''}
              ，再次购买无法参悟，是否继续购买？
            </p>
            <div className="text-xs text-text-dim mb-4">
              花费灵石 {formatNum(priceOf(pendingBuyId))} · 秘籍可转售（约五成半价）
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
