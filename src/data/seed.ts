import type { CategoryId, IslandState, SpiritRecord } from '../types'
import { addDays, startOfLocalDay, startOfWeek, toDateKey } from '../lib/budget'
import type { Bill } from '../lib/island'
import { billToTransaction } from '../lib/ledger'
import { pickMonsterForBill } from '../lib/monsters'
import { seedSpiritCollection } from '../lib/summon'
import {
  StorageWriteError,
  createEmptyState,
  hasState,
  readJSON,
  saveState,
  writeJSON,
} from '../lib/storage'

export const SEED_VERSION = 1
export const SEED_KEY = 'seed-version'
const SEED_BILL_TARGET = 120

export const SEED_SPIRIT_IDS = [
  'takeout-small',
  'milk-small',
  'night-small',
  'delivery-box',
  'delivery-tape',
  'traffic-bike',
  'traffic-card',
  'traffic-guard',
  'study-book',
  'study-note',
  'study-cram',
  'daily-tissue',
  'daily-soap',
  'fun-game',
  'takeout-fighter',
  'night-beast',
  'delivery-opener',
  'daily-hoard',
] as const

const CATEGORY_COUNTS: Record<CategoryId, number> = {
  takeout: 32,
  'milk-tea': 24,
  daily: 18,
  transport: 14,
  'night-snack': 10,
  study: 9,
  delivery: 7,
  fun: 6,
}

const AMOUNT_BANDS: Record<CategoryId, [number, number, number]> = {
  takeout: [1500, 3800, 2300],
  'milk-tea': [1200, 2500, 1800],
  'night-snack': [1500, 4000, 2800],
  delivery: [800, 3000, 1500],
  transport: [200, 2000, 600],
  study: [1000, 10000, 3200],
  daily: [500, 6000, 2200],
  fun: [1000, 12800, 4500],
}

const TIME_PRESETS: Record<CategoryId, Array<[number, number]>> = {
  takeout: [
    [11, 40],
    [18, 10],
  ],
  'milk-tea': [
    [14, 20],
    [16, 30],
  ],
  'night-snack': [
    [22, 20],
    [23, 5],
  ],
  delivery: [
    [16, 10],
    [12, 30],
  ],
  transport: [
    [7, 50],
    [18, 20],
  ],
  study: [
    [19, 30],
    [15, 0],
  ],
  daily: [
    [20, 10],
    [12, 40],
  ],
  fun: [
    [20, 40],
    [21, 10],
  ],
}

const NOTES: Record<CategoryId, string[]> = {
  takeout: ['黄焖鸡', '麻辣烫', '轻食沙拉', '干饭', '食堂打包'],
  'milk-tea': ['三分糖', '去冰', '芋泥波波', '加珍珠', '蜜雪冰城'],
  'night-snack': ['螺蛳粉', '烧烤', '泡面加蛋'],
  delivery: ['拼单', '退货运费', '取件'],
  transport: ['地铁', '公交', '共享单车'],
  study: ['打印资料', '网课', '文具', '教材'],
  daily: ['纸巾', '洗衣液', '水果', '洗护'],
  fun: ['开黑', '电影', '聚会'],
}

const DEMO_WEEK_TOTALS_CENTS = [4200, 3800, 5500, 4700, 3000, 5000, 4400]

function makeRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

function dayBillCount(index: number): number {
  return 3 + ((index * 5 + 2) % 3)
}

function randomAmount(category: CategoryId, random: () => number): number {
  const [min, max, anchor] = AMOUNT_BANDS[category]
  const spread = (max - min) * 0.28
  const raw = anchor + (random() * 2 - 1) * spread
  return Math.max(min, Math.min(max, Math.round(raw / 100) * 100))
}

function noteFor(category: CategoryId, random: () => number): string {
  if (random() >= 0.34) return ''
  const options = NOTES[category]
  return options[Math.floor(random() * options.length)] ?? ''
}

function splitDayTotal(
  totalCents: number,
  categories: CategoryId[],
  random: () => number,
): number[] {
  const count = categories.length
  const totalYuan = totalCents / 100
  const minimumYuan = 6
  let remaining = totalYuan - minimumYuan * count
  if (remaining < 0) return categories.map(() => Math.round(totalYuan / count) * 100)

  const weights = categories.map((category) => AMOUNT_BANDS[category][2] + random() * 1500)
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0)
  const amounts: number[] = []
  let assigned = 0
  for (let index = 0; index < count - 1; index += 1) {
    const extra = Math.floor((remaining * weights[index]) / weightSum)
    amounts.push((minimumYuan + extra) * 100)
    assigned += extra
  }
  amounts.push((minimumYuan + remaining - assigned) * 100)
  return amounts
}

function allocateCategories(random: () => number): CategoryId[] {
  const pool: CategoryId[] = []
  for (const [category, count] of Object.entries(CATEGORY_COUNTS) as Array<
    [CategoryId, number]
  >) {
    for (let index = 0; index < count; index += 1) pool.push(category)
  }

  pool.splice(pool.indexOf('transport'), 1)
  pool.splice(pool.indexOf('takeout'), 1)
  pool.splice(pool.indexOf('milk-tea'), 1)
  return shuffle(pool, random)
}

function buildDayPlans(random: () => number, anchor: Date) {
  const start = addDays(startOfLocalDay(anchor), -(30 - 1))
  const categories = allocateCategories(random)
  let cursor = 0

  return Array.from({ length: 30 }, (_, index) => {
    const date = addDays(start, index)
    const isToday = index === 29
    const count = dayBillCount(index)
    let dayCategories: CategoryId[]
    if (isToday) {
      dayCategories = ['transport', 'takeout', 'milk-tea']
    } else {
      dayCategories = categories.slice(cursor, cursor + count)
      cursor += count
    }

    const usedTimes = new Set<string>()
    const entries = dayCategories.map((category, slot) => {
      const presets = TIME_PRESETS[category]
      const [hour, baseMinute] = presets[slot % presets.length]
      let minute = (baseMinute + Math.floor(random() * 6)) % 60
      while (usedTimes.has(`${hour}:${minute}`)) minute = (minute + 1) % 60
      usedTimes.add(`${hour}:${minute}`)

      return {
        category,
        note: isToday
          ? category === 'takeout'
            ? '黄焖鸡'
            : category === 'milk-tea'
              ? '蜜雪冰城'
              : ''
          : noteFor(category, random),
        amountCents:
          isToday && category === 'transport'
            ? 400
            : isToday && category === 'takeout'
              ? 2300
              : isToday && category === 'milk-tea'
                ? 1800
                : randomAmount(category, random),
        time: new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          hour,
          minute,
        ).toISOString(),
      }
    })

    entries.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
    return { date, entries }
  })
}

function applyDemoWeek(plans: ReturnType<typeof buildDayPlans>, anchor: Date, random: () => number) {
  const previousWeek = addDays(startOfWeek(anchor), -7)
  const targetKeys = new Set(
    Array.from({ length: 7 }, (_, index) => toDateKey(addDays(previousWeek, index))),
  )
  let demoIndex = 0
  for (const plan of plans) {
    const key = toDateKey(plan.date)
    if (!targetKeys.has(key)) continue
    const amounts = splitDayTotal(
      DEMO_WEEK_TOTALS_CENTS[demoIndex] ?? 0,
      plan.entries.map((entry) => entry.category),
      random,
    )
    plan.entries.forEach((entry, index) => {
      entry.amountCents = amounts[index]
    })
    demoIndex += 1
  }
}

function applyLargeBills(plans: ReturnType<typeof buildDayPlans>, anchor: Date) {
  const previousWeekKeys = new Set(
    Array.from({ length: 7 }, (_, index) =>
      toDateKey(addDays(startOfWeek(anchor), -7 + index)),
    ),
  )
  const candidates: Array<{ planIndex: number; entryIndex: number }> = []
  plans.forEach((plan, planIndex) => {
    if (planIndex === plans.length - 1 || previousWeekKeys.has(toDateKey(plan.date))) return
    plan.entries.forEach((entry, entryIndex) => {
      if (entry.category === 'fun' || entry.category === 'daily' || entry.category === 'study') {
        candidates.push({ planIndex, entryIndex })
      }
    })
  })

  const largeAmounts = [12800, 30000, 12800]
  candidates.slice(0, largeAmounts.length).forEach((candidate, index) => {
    plans[candidate.planIndex].entries[candidate.entryIndex].amountCents = largeAmounts[index]
  })
}

function toBills(plans: ReturnType<typeof buildDayPlans>): Bill[] {
  const chronological: Bill[] = []
  for (const plan of plans) {
    plan.entries.forEach((entry, index) => {
      const id = `seed-${toDateKey(plan.date)}-${String(index + 1).padStart(2, '0')}`
      const monster = pickMonsterForBill(
        {
          id,
          amountCents: entry.amountCents,
          category: entry.category,
          note: entry.note,
          time: entry.time,
        },
        chronological,
      )
      chronological.push({
        id,
        amountCents: entry.amountCents,
        category: entry.category,
        note: entry.note,
        time: entry.time,
        monsterId: monster.id,
        source: 'manual',
        summonedSpiritId: null,
        summonOutcome: null,
      })
    })
  }
  return chronological.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
}

function buildSpiritRecords(now: Date): Record<string, SpiritRecord> {
  const firstSeenAt = now.toISOString()
  return Object.fromEntries(
    SEED_SPIRIT_IDS.map((id) => [
      id,
      { count: 1, evolved: false, firstSeenAt } satisfies SpiritRecord,
    ]),
  )
}

export interface SeedData {
  bills: Bill[]
  spiritIds: string[]
  state: IslandState
}

export function buildSeedData(now: Date = new Date()): SeedData {
  const random = makeRandom(20261119)
  const plans = buildDayPlans(random, now)
  applyDemoWeek(plans, now, random)
  applyLargeBills(plans, now)

  const bills = toBills(plans)
  if (bills.length !== SEED_BILL_TARGET) {
    throw new Error(`种子账单数量异常：${bills.length}`)
  }

  const state: IslandState = {
    ...createEmptyState(),
    seededAt: now.toISOString(),
    transactions: bills.map(billToTransaction),
    spirits: buildSpiritRecords(now),
    egg: {
      ...createEmptyState().egg,
      cycleStart: toDateKey(startOfWeek(now)),
    },
  }

  return { bills, spiritIds: [...SEED_SPIRIT_IDS], state }
}

function hasExistingLedger(): boolean {
  const bills = readJSON<unknown>('bills', [])
  if (Array.isArray(bills) && bills.length > 0) return true
  const summon = readJSON<Record<string, unknown>>('summon', {})
  if (
    summon.owned &&
    typeof summon.owned === 'object' &&
    Object.keys(summon.owned as Record<string, unknown>).length > 0
  ) {
    return true
  }
  const settings = readJSON<Record<string, unknown>>('settings', {})
  return Object.keys(settings).length > 0
}

export function hasSeeded(): boolean {
  return readJSON<unknown>(SEED_KEY, null) !== null
}

export function ensureSeedData(now: Date = new Date()): boolean {
  if (hasSeeded()) return false

  if (hasExistingLedger() || hasState()) {
    writeJSON(SEED_KEY, { version: SEED_VERSION, skippedAt: now.toISOString() })
    return false
  }

  try {
    const seed = buildSeedData(now)
    writeJSON('bills', seed.bills)
    seedSpiritCollection(seed.spiritIds)
    saveState(seed.state)
    writeJSON(SEED_KEY, { version: SEED_VERSION, seededAt: now.toISOString() })
    return true
  } catch (error) {
    if (error instanceof StorageWriteError) return false
    throw error
  }
}