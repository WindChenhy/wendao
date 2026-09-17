import { ITEMS, SHOP_STOCK } from '../data/items'
import { formatNum } from '../game/format'
import { useGameStore } from '../stores/useGameStore'

export function InventoryPanel() {
  const inventory = useGameStore((s) => s.inventory)
  const stones = useGameStore((s) => s.stones)
  const useItem = useGameStore((s) => s.useItem)
  const sellItem = useGameStore((s) => s.sellItem)
  const buyItem = useGameStore((s) => s.buyItem)

  const entries = Object.entries(inventory).filter(([, n]) => n > 0)

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      <div className="panel-box p-4">
        <div className="flex justify-between items-center mb-3">
          <div className="font-display text-gold">乾坤袋</div>
          <div className="text-sm text-gold">灵石 {formatNum(stones)}</div>
        </div>
        {entries.length === 0 && <div className="text-xs text-text-dim">空空如也。</div>}
        <div className="space-y-2">
          {entries.map(([id, n]) => {
            const item = ITEMS[id]
            if (!item) return null
            return (
              <div key={id} className="border border-border px-3 py-2 flex justify-between gap-2 items-start">
                <div className="min-w-0">
                  <div className="text-sm">
                    {item.name} <span className="text-gold">×{n}</span>
                  </div>
                  <div className="text-xs text-text-dim mt-0.5">{item.desc}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {item.effect && (
                    <button className="pixel-btn text-xs" onClick={() => useItem(id)}>
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
      </div>

      <div className="panel-box p-4">
        <div className="font-display text-gold mb-3">坊市（买入）</div>
        <div className="space-y-2">
          {SHOP_STOCK.map((id) => {
            const item = ITEMS[id]
            return (
              <div key={id} className="border border-border px-3 py-2 flex justify-between items-center">
                <div>
                  <div className="text-sm">{item.name}</div>
                  <div className="text-xs text-text-dim">{item.desc}</div>
                </div>
                <button
                  className="pixel-btn text-xs"
                  disabled={stones < item.price}
                  onClick={() => buyItem(id)}
                >
                  {item.price} 灵石
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
