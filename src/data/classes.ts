import type { ClassDef, ClassId } from '../types'
import classesDb from './db/classes.json'

/** 职业表：src/data/db/classes.json */
export const CLASSES: Record<ClassId, ClassDef> = classesDb as Record<ClassId, ClassDef>

export const CLASS_LIST = Object.values(CLASSES)
