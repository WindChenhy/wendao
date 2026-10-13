import type { AptitudeDef, AptitudeId } from '../types'
import aptitudesDb from './db/aptitudes.json'

/** 灵根资质表：src/data/db/aptitudes.json */
const DB = aptitudesDb as Record<AptitudeId, AptitudeDef>

export const APTITUDES: Record<AptitudeId, AptitudeDef> = DB

export const APTITUDE_LIST: AptitudeDef[] = Object.values(DB)

export const APTITUDE_IDS = Object.keys(DB) as AptitudeId[]

/** 旧档/损坏档默认资质：杂灵根（各项中性，不影响既有数值） */
export const DEFAULT_APTITUDE: AptitudeId = 'mixed'

export function isAptitudeId(v: unknown): v is AptitudeId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(DB, v)
}

/** 角色灵根（缺省 = 杂灵根，保证旧档行为不变） */
export function aptitudeOf(p: { aptitude?: AptitudeId } | null | undefined): AptitudeDef {
  const id = p?.aptitude
  return (id && DB[id]) || DB[DEFAULT_APTITUDE]
}
