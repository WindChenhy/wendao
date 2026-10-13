import type { CharacterRollConfig } from '../types'
import rollDb from './db/character_roll.json'

/** 创角天命掷卷的概率配置：src/data/db/character_roll.json */
export const ROLL_CONFIG: CharacterRollConfig = rollDb as unknown as CharacterRollConfig
