export interface GameSettings {
  /** 历练 / 秘境：点击后直接自动结算，不进入交互战斗面板 */
  skipExploreCombat: boolean
}

const SETTINGS_KEY = 'wendao-settings'

export const defaultGameSettings: GameSettings = {
  skipExploreCombat: false,
}

export function loadGameSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...defaultGameSettings }
    const parsed = JSON.parse(raw) as Partial<GameSettings>
    return {
      skipExploreCombat: Boolean(parsed.skipExploreCombat),
    }
  } catch (e) {
      console.warn(e)
    return { ...defaultGameSettings }
  }
}

export function saveGameSettings(next: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  } catch (e) {
      console.warn(e)
    // 本地存储不可用时忽略，仅内存生效
  }
}
