import { COMPANIONS, companionById } from '../data/companions'
import { ITEMS } from '../data/items'
import { useGameStore } from '../stores/useGameStore'

export function CompanionPanel() {
  const player = useGameStore((s) => s.player)
  const companion = useGameStore((s) => s.companion)
  const inventory = useGameStore((s) => s.inventory)
  const chatCompanion = useGameStore((s) => s.chatCompanion)
  const giftCompanion = useGameStore((s) => s.giftCompanion)
  const dualCultivate = useGameStore((s) => s.dualCultivate)
  const propose = useGameStore((s) => s.propose)

  if (!player) return null
  const dead = !player.alive
  const spouse = companion.spouseId ? companionById(companion.spouseId) : null
  const giftCandidates = Object.entries(inventory).filter(
    ([id, n]) => n > 0 && !id.startsWith('treasure_') && ITEMS[id],
  )

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      {spouse && (
        <div className="panel-box p-4 border-gold">
          <div className="font-display text-gold text-lg">道侣 · {spouse.name}</div>
          <p className="text-xs text-text-dim mt-1">{spouse.title}</p>
          <p className="text-sm text-jade mt-2">
            双修加成 ×{spouse.dualMul} · 突破护法{' '}
            {spouse.breakthroughBonus >= 0 ? '+' : ''}
            {spouse.breakthroughBonus}% · 日常修炼亦有增益
          </p>
        </div>
      )}

      <div className="panel-box p-4">
        <div className="font-display text-gold mb-2">红尘缘法</div>
        <p className="text-xs text-text-dim leading-relaxed">
          赠礼、闲谈可增好感；达阈值触发心事件。好感足够且备好灵石后可求结缘。正魔之恋阻力更大。
        </p>
      </div>

      <div className="space-y-2">
        {COMPANIONS.map((c) => {
          const aff = companion.affinity[c.id] ?? 0
          const seen = companion.heartsSeen[c.id] ?? 0
          const isSpouse = companion.spouseId === c.id
          const lockedOther = companion.spouseId && !isSpouse
          const cross =
            (player.classId === 'demon' && c.align === 'righteous') ||
            (player.classId !== 'demon' && c.align === 'demonic')
          return (
            <div key={c.id} className={`panel-box p-4 ${isSpouse ? 'border-gold' : ''}`}>
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <div className="font-display text-gold">
                    {c.name}
                    {isSpouse && <span className="text-xs ml-2 text-bamboo">道侣</span>}
                  </div>
                  <div className="text-xs text-text-dim mt-0.5">
                    {c.title} · {c.align === 'demonic' ? '魔道' : c.align === 'neutral' ? '散修' : '正道'}
                  </div>
                  <p className="text-xs text-text mt-2 leading-relaxed">{c.desc}</p>
                  <div className="text-xs text-jade mt-2">
                    好感 {aff} / {c.marryAt}
                    {cross && <span className="text-vermilion ml-2">正魔殊途</span>}
                  </div>
                  <div className="h-1.5 bg-ink border border-border mt-1 max-w-[220px]">
                    <div
                      className="h-full bg-bamboo"
                      style={{ width: `${Math.min(100, (aff / c.marryAt) * 100)}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-text-dim mt-1">
                    心事件 {seen}/{c.heartAt.length}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    className="pixel-btn text-xs"
                    disabled={dead || !!lockedOther}
                    onClick={() => chatCompanion(c.id)}
                  >
                    闲谈
                  </button>
                  <button
                    className="pixel-btn text-xs"
                    disabled={dead || !!lockedOther || giftCandidates.length === 0}
                    onClick={() => {
                      const pick = giftCandidates[0]
                      if (pick) giftCompanion(c.id, pick[0])
                    }}
                  >
                    赠礼（{ITEMS[giftCandidates[0]?.[0]]?.name ?? '无'}）
                  </button>
                  <button
                    className="pixel-btn text-xs"
                    disabled={dead || aff < 40 || (!!companion.spouseId && !isSpouse)}
                    onClick={() => dualCultivate(c.id)}
                  >
                    双修
                  </button>
                  <button
                    className="pixel-btn primary text-xs"
                    disabled={dead || !!companion.spouseId || aff < c.marryAt}
                    onClick={() => propose(c.id)}
                  >
                    结缘
                  </button>
                </div>
              </div>
              {giftCandidates.length > 1 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {giftCandidates.slice(0, 6).map(([id, n]) => (
                    <button
                      key={id}
                      className="text-[10px] border border-border px-1.5 py-0.5 text-text-dim hover:text-gold hover:border-gold-dim"
                      disabled={dead || !!lockedOther}
                      onClick={() => giftCompanion(c.id, id)}
                    >
                      {ITEMS[id]?.name}×{n}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
