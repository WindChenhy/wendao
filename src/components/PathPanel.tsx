import { CLASSES, PATH_LIST, pathEffectText, pathIdsOf, secondarySlots, usedSecondarySlots } from '../data/classes'
import { formatNum } from '../game/format'
import {
  pathUnlockStatus,
  primarySwitchCost,
  totalTowerFloors,
  type UnlockCtx,
} from '../game/paths'
import { useGameStore } from '../stores/useGameStore'

/**
 * 道途面板：主修 / 兼修 / 问道（立道）。
 * 创角不选职业 —— 道途在游戏中依履历与机缘立下。
 */
export function PathPanel() {
  const player = useGameStore((s) => s.player)
  const stones = useGameStore((s) => s.stones)
  const towerBest = useGameStore((s) => s.towerBest)
  const stats = useGameStore((s) => s.meta.stats)
  const choosePath = useGameStore((s) => s.choosePath)
  const setPrimaryPath = useGameStore((s) => s.setPrimaryPath)
  if (!player) return null

  const owned = pathIdsOf(player)
  const ctx: UnlockCtx = {
    realm: player.realm,
    layer: player.layer,
    stats,
    towerFloors: totalTowerFloors(towerBest),
    repDemonic: player.repDemonic,
    stones,
    lifespanLeft: player.lifespanLeft,
    ownedPaths: owned,
  }
  const primary = CLASSES[player.classId]
  const secondaries = owned.slice(1)
  const slots = secondarySlots(player.realm)
  const usedSlots = usedSecondarySlots(player)
  const switchCost = primarySwitchCost(player.realm)

  return (
    <div className="panel-box p-4">
      <div className="font-display text-gold mb-1">道途</div>
      <p className="text-xs text-text-dim mb-3 leading-relaxed">
        修仙为本，道途为用。首立之道即为主修（全额加成），其后立道皆为兼修（半数加成，
        且分心拖慢修炼）；兼修位随境界扩张，当前{' '}
        {owned.length === 0 ? 0 : usedSlots}/{slots}.
      </p>

      {owned.length === 0 ? (
        <div className="border border-gold-dim/60 px-3 py-2 text-sm mb-3">
          <span className="text-gold">未定道途</span>
          <span className="text-text-dim text-xs ml-2">
            以散修之身吐纳灵气，属性全凭灵根；尚无一技傍身。
          </span>
        </div>
      ) : (
        <div className="border border-gold-dim px-3 py-2 mb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm">
              <span className="text-gold">主修 · {primary.name}</span>
              <span className="text-text-dim text-xs ml-2">{primary.title}</span>
            </div>
            <span className="text-[10px] text-text-dim">修炼 ×{primary.cultivateRate}</span>
          </div>
          <div className="text-xs text-text-dim mt-1">{primary.desc}</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {primary.tags.map((t) => (
              <span key={t} className="text-[10px] border border-border px-1 text-text-dim">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {secondaries.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {secondaries.map((id) => {
            const d = CLASSES[id]
            if (!d) return null
            return (
              <div key={id} className="border border-border px-2 py-1 text-xs">
                <span className="text-jade">兼修 · {d.name}</span>
                <button
                  className="ml-2 text-[10px] text-text-dim underline disabled:opacity-40"
                  disabled={stones < switchCost}
                  title={`洗炼道基改立主修：灵石 ${formatNum(switchCost)}`}
                  onClick={() => setPrimaryPath(id)}
                >
                  改立主修（{formatNum(switchCost)}）
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div className="text-xs text-text-dim mb-2">问道（条件具足即可立道）</div>
      <div className="space-y-2">
        {PATH_LIST.map((def) => {
          const st = pathUnlockStatus(def, ctx)
          return (
            <div key={def.id} className="border border-border px-2 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm">
                  <span className={st.owned ? 'text-gold' : 'text-text'}>{def.name}</span>
                  <span className="text-text-dim text-xs ml-2">{def.title}</span>
                  <span className="text-[10px] text-text-dim ml-2">
                    {def.kind === 'craft' ? '艺道' : def.kind === 'forbidden' ? '禁道' : '战道'}
                  </span>
                </div>
                <button
                  className="pixel-btn text-[10px] shrink-0"
                  disabled={!st.ok}
                  onClick={() => choosePath(def.id)}
                >
                  {st.owned ? '已立' : '立道'}
                </button>
              </div>
              <div className="text-xs text-text-dim mt-1 leading-snug">
                <span className="text-gold-dim">{pathEffectText(def)}</span>
                {def.unlock?.note ? ` · ${def.unlock.note}` : ''}
              </div>
              <ul className="mt-1 space-y-0.5">
                {st.reqs.map((r) => (
                  <li key={`${def.id}-${r.label}-${r.text}`} className="text-[11px]">
                    <span className={r.met ? 'text-jade' : 'text-vermilion'}>
                      {r.met ? '✓' : '✗'}
                    </span>{' '}
                    <span className="text-text-dim">{r.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
