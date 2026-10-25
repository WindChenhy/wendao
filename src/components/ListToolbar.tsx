import {
  REALM_FILTER_OPTIONS,
  type RealmFilterMode,
} from '../data/itemFilter'

/**
 * 背包/坊市共用的「搜索 + 境界筛选」工具条（与分页组件 PagedList 配套）。
 * 文案与样式两页一致，筛选结果计数由调用方传入。
 */
export function ListToolbar({
  query,
  onQuery,
  filter,
  onFilter,
  count,
  total,
  placeholder = '搜索名称',
}: {
  query: string
  onQuery: (v: string) => void
  filter: RealmFilterMode
  onFilter: (v: RealmFilterMode) => void
  count: number
  total: number
  placeholder?: string
}) {
  const dirty = query.trim() !== '' || filter !== 'all'
  return (
    <div className="flex flex-wrap items-center gap-2 mb-2">
      <input
        className="bg-ink border border-border text-text text-xs px-2 py-1 min-w-[140px] flex-1 sm:flex-none"
        value={query}
        placeholder={placeholder}
        onChange={(e) => onQuery(e.target.value)}
      />
      <select
        className="bg-ink border border-border text-text text-xs px-2 py-1"
        value={filter}
        onChange={(e) => onFilter(e.target.value as RealmFilterMode)}
      >
        {REALM_FILTER_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {dirty && (
        <button
          className="pixel-btn text-[10px]"
          onClick={() => {
            onQuery('')
            onFilter('all')
          }}
        >
          清空
        </button>
      )}
      <span className="text-[11px] text-text-dim">
        {dirty ? `筛出 ${count}/${total} 条` : `共 ${total} 条`}
      </span>
    </div>
  )
}
