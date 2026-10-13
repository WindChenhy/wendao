import type { OriginDef, OriginId } from '../types'
import originsDb from './db/origins.json'

/** 出身表：src/data/db/origins.json（只影响起始盘缠与行囊） */
const DB = originsDb as Record<OriginId, OriginDef>

export const ORIGINS: Record<OriginId, OriginDef> = DB

export const ORIGIN_LIST: OriginDef[] = Object.values(DB)

export const ORIGIN_IDS = Object.keys(DB) as OriginId[]

/** 旧档/损坏档默认出身 */
export const DEFAULT_ORIGIN: OriginId = 'wild'

export function isOriginId(v: unknown): v is OriginId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(DB, v)
}

export function originOf(p: { origin?: OriginId } | null | undefined): OriginDef {
  const id = p?.origin
  return (id && DB[id]) || DB[DEFAULT_ORIGIN]
}
