interface GameSettings {
  /** 历练 / 秘境：点击后直接自动结算，不进入交互战斗面板 */
  skipExploreCombat: boolean
  /** v1.3 进入战斗时默认托管自动出招（战斗中可随时切回手动） */
  autoCombatDefault: boolean
}

const SETTINGS_KEY = 'wendao-settings'

const defaultGameSettings: GameSettings = {
  skipExploreCombat: false,
  autoCombatDefault: false,
}

export function loadGameSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...defaultGameSettings }
    const parsed = JSON.parse(raw) as Partial<GameSettings>
    return {
      skipExploreCombat: Boolean(parsed.skipExploreCombat),
      autoCombatDefault: Boolean(parsed.autoCombatDefault),
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
