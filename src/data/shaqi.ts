import { COMBAT_CONFIG } from './skills'

/**
 * 煞气（shaqi）唯一口径：数值常量 + 玩家可见说明。
 * 战斗叠层/击杀增长/血誓初生/化煞削减一律引用此处常量，勿在各处另写数字。
 */

/** 煞气上限（角色属性 shaqi 的取值域 0–100） */
export const SHAQI_MAX = 100
/** 斩杀人/魔修增长 */
export const SHAQI_ON_KILL = 5
/** 斩杀妖兽增长（兽血煞气较弱） */
export const SHAQI_ON_KILL_BEAST = 2
/** 血誓入魔：煞气初生 */
export const SHAQI_BLOOD_OATH = 10
/** 化煞丹药（解煞丸等）一次削减 */
export const SHAQI_CLEANSE = 15

/** 悬浮提示用的一句话摘要 */
export const SHAQI_TITLE =
  '煞气：魔修专属煞息。战斗中叠层加攻、吸血续航，过盛则反噬；正道之身不生煞气。'

/** 属性栏/帮助区用的完整说明：作用 · 增长 · 影响 · 削减 */
export function shaqiHelpText(): string {
  const per = Math.round(COMBAT_CONFIG.shaQiPerStack * 100)
  const max = COMBAT_CONFIG.shaQiMax
  return [
    `【是什么】魔修独有的煞息，正道之身不生煞气（值域 0–${SHAQI_MAX}）。`,
    `【作用】每次命中叠 1 层煞气，每层攻击 +${per}%（上限 ${max} 层，且不像其它状态那样随回合消退）；命中时按吸血比例回血（煞气反哺）；「煞气爆发」可耗尽全部层数换取高额倍率。`,
    `【增长】魔道之人每斩杀一名人/魔修 +${SHAQI_ON_KILL}，斩杀妖兽 +${SHAQI_ON_KILL_BEAST}；血誓入魔时初生 ${SHAQI_BLOOD_OATH} 点。`,
    `【影响】层数 ≥6 后每回合约一成概率煞气反噬（气血逆冲，并散去 2 层）；煞气爆发消耗 ≥6 层时可能自陷眩晕；突破失败时会煞气逆冲、跌落境界；煞气缠身者被江湖视作魔修（缉魔令、通缉追杀），正道人物也拒收煞气之物。`,
    `【削减】服「解煞丸」等化煞丹药一次 −${SHAQI_CLEANSE}；洗魔散功、改旗易帜归正后不再增长。`,
  ].join('')
}
