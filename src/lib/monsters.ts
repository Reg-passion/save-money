import { CATEGORY_SPIRITS, SPIRIT_BY_ID, type Spirit } from '../data/catalog'
import { WISH_THRESHOLD_CENTS } from '../data/constants'
import type { CategoryId } from '../types'

export interface MonsterSource {
  id: string
  amountCents: number
  category: CategoryId
  note: string
  time: string
  monsterId?: string
}

function localDayKey(iso: string): string {
  const date = new Date(iso)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

function hashString(input: string): number {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function matchSpecialSpirit(bill: MonsterSource): Spirit | null {
  const note = bill.note.trim()
  const hour = new Date(bill.time).getHours()

  if (
    bill.category === 'milk-tea' &&
    bill.amountCents >= 1500 &&
    bill.amountCents <= 2500 &&
    note.includes('三分糖')
  ) {
    return SPIRIT_BY_ID['milk-pearl'] ?? null
  }
  if (bill.category === 'night-snack' && hour >= 23 && note.includes('螺蛳粉')) {
    return SPIRIT_BY_ID['night-king'] ?? null
  }
  if (
    bill.category === 'takeout' &&
    hour >= 21 &&
    bill.amountCents >= 2000 &&
    note.includes('黄焖鸡')
  ) {
    return SPIRIT_BY_ID['takeout-boss'] ?? null
  }
  if (bill.category === 'delivery' && bill.amountCents >= 1500 && note.includes('退货')) {
    return SPIRIT_BY_ID['delivery-king'] ?? null
  }
  return null
}

function withoutSameDayRepeat(
  pool: Spirit[],
  bill: MonsterSource,
  priorBills: MonsterSource[],
): Spirit[] {
  if (pool.length <= 1) return pool
  const day = localDayKey(bill.time)
  const usedToday = new Set(
    priorBills
      .filter(
        (prior) =>
          prior.category === bill.category &&
          localDayKey(prior.time) === day &&
          prior.monsterId,
      )
      .map((prior) => prior.monsterId),
  )
  const fresh = pool.filter((spirit) => !usedToday.has(spirit.id))
  return fresh.length > 0 ? fresh : pool
}

function pickDeterministic(pool: Spirit[], bill: MonsterSource): Spirit {
  const index = hashString(`${bill.id}:${bill.category}:monster`) % pool.length
  return pool[index]
}

function pickBoss(category: CategoryId, bill: MonsterSource): Spirit {
  const family = CATEGORY_SPIRITS[category]
  const highestStage = Math.max(...family.map((spirit) => spirit.stage))
  return pickDeterministic(
    family.filter((spirit) => spirit.stage === highestStage),
    bill,
  )
}

export function pickMonsterForBill(
  bill: MonsterSource,
  priorBills: MonsterSource[] = [],
  options: { forceBoss?: boolean } = {},
): Spirit {
  const special = matchSpecialSpirit(bill)
  if (special) return special

  const family = CATEGORY_SPIRITS[bill.category]
  if (options.forceBoss || bill.amountCents >= WISH_THRESHOLD_CENTS) {
    return pickBoss(bill.category, bill)
  }

  const priorInCategory = priorBills.filter(
    (prior) => prior.category === bill.category && prior.id !== bill.id,
  )
  if (priorInCategory.length === 0) {
    const primary =
      family.find((spirit) => spirit.primary && spirit.rarity === 'normal') ??
      family.find((spirit) => spirit.rarity === 'normal')
    if (primary) return primary
  }

  const roll = (hashString(`${bill.id}:${bill.category}:roll`) % 1000) / 1000
  const wantRare =
    bill.amountCents >= 3000 ? roll < 0.35 : bill.amountCents >= 1000 ? roll < 0.15 : false
  const desiredPool = family.filter((spirit) =>
    wantRare ? spirit.rarity === 'rare' : spirit.rarity === 'normal',
  )
  const pool = withoutSameDayRepeat(
    desiredPool.length > 0 ? desiredPool : family.filter((spirit) => spirit.rarity === 'normal'),
    bill,
    priorBills,
  )
  return pickDeterministic(pool, bill)
}
