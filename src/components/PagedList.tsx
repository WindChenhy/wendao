import { useEffect, useState, type ReactNode } from 'react'

/**
 * 通用分页列表：固定可视高度 + 内部滚动 + 每页 N 条。
 * 修炼页功法区、背包各栏、坊市各栏共用同一交互与样式（唯一口径，勿各写一份翻页）。
 */
export function PagedList<T>({
  items,
  pageSize = 10,
  renderItem,
  resetKey,
  bodyClassName = 'h-[520px]',
  empty,
}: {
  items: T[]
  pageSize?: number
  renderItem: (item: T, index: number) => ReactNode
  /** 切换分区/排序等导致列表整体变化时用于回到第一页 */
  resetKey?: string | number
  bodyClassName?: string
  empty?: ReactNode
}) {
  const [page, setPage] = useState(0)
  // 分区切换后旧页码可能越界：此处显式回到第一页（页码越界另有 cur 兜底）
  useEffect(() => {
    setPage(0)
  }, [resetKey])

  const total = items.length
  const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1)
  const cur = Math.min(page, maxPage)
  const start = cur * pageSize
  const slice = items.slice(start, start + pageSize)

  return (
    <div>
      <div className={`overflow-y-auto scroll-thin space-y-2 pr-1 ${bodyClassName}`}>
        {total === 0 ? (empty ?? null) : slice.map((it, i) => renderItem(it, start + i))}
      </div>
      {total > pageSize && (
        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border/60">
          <span className="text-[11px] text-text-dim">
            第 {cur + 1}/{maxPage + 1} 页 · 共 {total} 条
          </span>
          <div className="flex gap-1">
            <button
              className="pixel-btn text-[10px]"
              disabled={cur <= 0}
              onClick={() => setPage(cur - 1)}
            >
              上一页
            </button>
            <button
              className="pixel-btn text-[10px]"
              disabled={cur >= maxPage}
              onClick={() => setPage(cur + 1)}
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
