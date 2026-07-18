/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

import { db } from './db'

export async function getSettings() {
  let s = await db.settings.findFirst()
  if (!s) s = await db.settings.create({ data: {} })
  return s
}
