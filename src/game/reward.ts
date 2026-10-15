/**
 * 奖励文案的唯一实现（成就与图鉴共用）。
 * 此前 achievements.describeReward 与 codex.describeCodexReward 逐字重复，
 * 仅「无内容时的回退文案」不同 —— 由 fallback 参数区分。
 */

export interface RewardDescParts {
  stones?: number
  daoMarks?: number
  title?: string
}

/** 灵石 / 道痕 / 称号三段拼接；无内容时返回 fallback */
export function describeRewardParts(r: RewardDescParts, fallback = ''): string {
  const parts: string[] = []
  if (r.stones) parts.push(`灵石 +${r.stones}`)
  if (r.daoMarks) parts.push(`道痕 +${r.daoMarks}`)
  if (r.title) parts.push(`称号「${r.title}」`)
  return parts.join(' · ') || fallback
}
