/**
 * 灵气类型（灵力 / 魔元）唯一口径。
 *
 * 背景：历史上「灵气叫什么」由 isDemonic 决定（道途优先、其次立场、再次声望推导），
 * 而「称号」由 reputationTitles 只看双声望决定 —— 两套口径各自为政，
 * 于是会出现「正道名宿 + 魔元」这类自相矛盾的显示。
 * 现在：类型与原因同出一个函数，UI 一律调用这里，并把原因显示给玩家。
 */
import { hasPath, isDemonic, pathIdsOf } from '../data/classes'
import type { PlayerState } from '../types'
import { resolveAlignment } from './reputation'

export type QiType = 'qi' | 'demonic'

export interface QiInfo {
  type: QiType
  /** 灵力 / 魔元 */
  label: string
  /** 判定原因（显示给玩家，避免"称号与灵气打架"的困惑） */
  reason: string
  /** 悬浮提示全文 */
  help: string
}

/** 判定灵气类型与成因（顺序与 isDemonic 保持一致：道途 → 立场 → 声望推导） */
export function resolveQiType(p: PlayerState | null | undefined): QiInfo {
  const demonic = isDemonic(p ?? null)
  if (!demonic) {
    return {
      type: 'qi',
      label: '灵力',
      reason: '清修正法',
      help: '灵气类型：灵力。判定依据依次为道途（是否修魔功）、当前立场、双声望推导；三者皆非魔道即为灵力。',
    }
  }
  const paths = p ? pathIdsOf(p) : []
  const hasDemonPath = hasPath(p ?? null, 'demon')
  const alignment = resolveAlignment(p)
  const reason = hasDemonPath
    ? paths[0] === 'demon'
      ? '主修魔道'
      : '兼修魔道'
    : alignment === 'demonic'
      ? '立场为魔'
      : '魔道声望压过正道'
  return {
    type: 'demonic',
    label: '魔元',
    reason,
    help:
      `灵气类型：魔元（${reason}）。判定依据依次为道途（是否修魔功）、当前立场、双声望推导；` +
      '因此「正道声望高」并不必然是灵力 —— 修魔功或已堕魔立场者仍是魔元。称号只看江湖声望，两者本就不同源。',
  }
}

/** 只取标签的便捷入口（状态栏/战斗面板等窄处使用） */
export function qiLabel(p: PlayerState | null | undefined): string {
  return resolveQiType(p).label
}
