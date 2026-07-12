import { db } from './db'

export async function getSettings() {
  let s = await db.settings.findFirst()
  if (!s) s = await db.settings.create({ data: {} })
  return s
}
