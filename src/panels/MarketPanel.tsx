import { useMemo, useState } from 'react'
import {
  CATEGORY_LABELS,
  ITEMS,
  itemCategory,
  itemScopeText,
  itemTierText,
  itemUsageHint,
  itemUsableAt,
  marketStockFor,
  treasureEffectText,
  type MarketTab,
} from '../data/items'
import {
  GONGFA_GRADE_CLASS,
  GONGFA_STAGE_LABELS,
  canLearnGongfaFull as canLearnGongfa,
  gongfaByScrollId,
  gongfaScopeText,
  gongfaRealmText,
} from '../data/gongfa'
import { formatNum } from '../game/format'
import { marketPriceOf } from '../game/bounty'
import { PagedList } from '../components/PagedList'
import { ListToolbar } from '../components/ListToolbar'
import {
  matchesName,
  matchesRealm,
  type RealmFilterMode,
} from '../data/itemFilter'
import { useGameStore } from '../stores/useGameStore'

/** 坊市每页条数（与修炼页功法区、背包同口径） */
const MARKET_PAGE_SIZE = 10

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
  const [query, setQuery] = useState('')
  const [realmFilter, setRealmFilter] = useState<RealmFilterMode>('all')
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

  // 买卖不受境界限制：集合与境界无关，全部在售货物一并列出（境界只影响「使用」，见各行提示）。
  // 境界只决定排序 —— 把当前境界正用得上的法宝/功法排到前面；
  // 依赖里显式带上 realm，大境界一突破即在同一帧按新境界重排，无需退出坊市重进。
  // player 为 null（未创角/已回主菜单）时不出货，与原行为一致。
  const realm = player?.realm ?? null
  const hasPlayer = Boolean(player)
  const entries = useMemo(
    () => (hasPlayer ? marketStockFor(realm, tab) : []),
    [hasPlayer, realm, tab],
  )
  // 本分区「能真正买下」的货物数：用于在整区都买不了时给出明确解释（否则看着像功能坏了）
  const buyableCount = entries.filter((e) => stones >= priceOf(e.id)).length

  /** v1.7 搜索 + 境界筛选（唯一口径见 data/itemFilter.ts） */
  const filteredEntries = useMemo(
    () =>
      entries.filter((e) => matchesName(e.id, query) && matchesRealm(e.id, realmFilter, realm)),
    [entries, query, realmFilter, realm],
  )
  const filtering = query.trim() !== '' || realmFilter !== 'all'

  /**
   * v1.7 排序：未拥有优先（未持有 > 已持有秘籍 > 已参悟功法），
   * 组内沿用 marketStockFor 的境界贴合度排序（Array.prototype.sort 稳定，不额外打乱）。
   */
  const sortedEntries = useMemo(() => {
    const rank = (id: string) => {
      const g = gongfaByScrollId(id)
      if (g && learned[g.id]) return 2 // 已参悟：买了也无处可用，排最后
      return (inventory[id] ?? 0) > 0 ? 1 : 0 // 已持有但未参悟
    }
    return [...filteredEntries].sort((a, b) => rank(a.id) - rank(b.id))
  }, [filteredEntries, inventory, learned])

  const requestBuy = (id: string) => {
    const item = ITEMS[id]
    if (!item || stones < priceOf(id)) return
    const g = gongfaByScrollId(id)
    if (g && learned[g.id]) {
      setPendingBuyId(id)
      return
    }
    buyItem(id)
  }

  const pendingItem = pendingBuyId ? ITEMS[pendingBuyId] : null
  const pendingG = pendingBuyId ? gongfaByScrollId(pendingBuyId) : null
  const pendingStage = pendingG ? learned[pendingG.id] : null

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
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
        <p className="text-xs text-text-dim mb-2">{TAB_HINT[tab]}</p>
        <ListToolbar
          query={query}
          onQuery={setQuery}
          filter={realmFilter}
          onFilter={setRealmFilter}
          count={sortedEntries.length}
          total={entries.length}
          placeholder="搜索货物/功法名"
        />
        {sortedEntries.length > 0 && buyableCount === 0 && (
          <p className="text-xs text-vermilion mb-2 leading-relaxed">
            本分区暂无可成交的货物：灵石不足（现持 {' '}{formatNum(stones)}
            {' '}灵石，见各行标价）——境界不影响买卖，只影响买入后能不能用。
          </p>
        )}
        {/* 兜底：任何情况下都不留一块无声的空白（真无货也要说清楚，别让人以为界面坏了） */}
        {sortedEntries.length === 0 && (
          <p className="text-xs text-text-dim">
            {filtering
              ? '没有符合条件的货物（试试清空搜索或改为「境界：不限」）。'
              : '本区暂无在售货物。'}
          </p>
        )}
        <PagedList
          items={sortedEntries}
          pageSize={MARKET_PAGE_SIZE}
          resetKey={`${tab}|${query}|${realmFilter}`}
          bodyClassName="h-[520px]"
          renderItem={({ id }) => {
            const item = ITEMS[id]
            if (!item) return null
            const g = gongfaByScrollId(id)
            const owned = inventory[id] ?? 0
            const st = g ? learned[g.id] : null
            // 售价只算一次（原同一行内 3 次调用 priceOf，P2-8）
            const price = priceOf(id)
            // 买不起时禁用必须说明原因，否则「按钮点不动」会被当成缺陷
            const poor = stones < price
            // 境界只约束使用：仅非功法行补充使用门槛提示
            // （功法行的境界要求已由 gongfaRealmText「需元婴」与适用范围文案给出，勿重复）
            const usageHint =
              player && !g && !itemUsableAt(id, player.realm) ? itemUsageHint(id) : ''
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
                  {usageHint && (
                    <div className="text-[11px] text-gold-dim mt-0.5">{usageHint}</div>
                  )}
                  {poor && (
                    <div className="text-[11px] text-vermilion mt-0.5">
                      灵石不足，尚缺 {formatNum(price - stones)}
                    </div>
                  )}
                </div>
                <button
                  className="pixel-btn text-xs shrink-0"
                  disabled={poor}
                  onClick={() => requestBuy(id)}
                >
                  {poor ? (
                    `灵石不足 · ${formatNum(price)}`
                  ) : (
                    <>
                      {formatNum(price)} 灵石
                      {price !== item.price && (
                        <span className="ml-1 text-[10px]">
                          （原价 {formatNum(item.price)}）
                        </span>
                      )}
                    </>
                  )}
                </button>
              </div>
            )
          }}
        />
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
