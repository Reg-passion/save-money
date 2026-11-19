import { CATEGORIES } from '../data/categories'
import { SPIRIT_BY_ID } from '../data/catalog'
import {
  CENTS_PER_HP,
  DEFAULT_MONTHLY_BUDGET_CENTS,
  DEFAULT_SAVINGS_GOAL_CENTS,
  ISLAND_HP_MAX,
} from '../data/constants'
import type { CategoryId } from '../types'
import { isCents, yuanToCents } from './money'
import { pickMonsterForBill } from './monsters'
import { readJSON, writeJSON } from './storage'

export interface IslandSettings {
  islandName: string
  monthlyBudgetCents: number
  savingsGoalCents: number
}

export type BillSource = 'manual' | 'wish' | 'import'

export interface Bill {
  id: string
  amountCents: number
  category: CategoryId
  note: string
  time: string
  monsterId: string
  source: BillSource
  sourceWishId?: string
}

export interface NewBillInput {
  amountCents: number
  category: CategoryId
  note: string
  time: string
}

export interface CreateBillOptions {
  id?: string
  source?: BillSource
  sourceWishId?: string
  forceBoss?: boolean
}

export type Weather = 'sunny' | 'cloudy' | 'overcast' | 'critical' | 'repair'

export const WEATHER_LABEL: Record<Weather, string> = {
  sunny: '晴',
  cloudy: '多云',
  overcast: '阴',
  critical: '危急',
  repair: '修补模式',
}

export interface MonthSummary {
  monthLabel: string
  daysInMonth: number
  dailyBudgetCents: number
  budgetCents: number
  spentCents: number
  damage: number
  hp: number
  remainingCents: number
  isOverspent: boolean
  bills: Bill[]
  billDamages: Record<string, number>
}

const SETTINGS_KEY = 'settings'
const BILLS_KEY = 'bills'

export const DEFAULT_SETTINGS: IslandSettings = {
  islandName: '钱钱岛',
  monthlyBudgetCents: DEFAULT_MONTHLY_BUDGET_CENTS,
  savingsGoalCents: DEFAULT_SAVINGS_GOAL_CENTS,
}

const CATEGORY_IDS = new Set<string>(CATEGORIES.map((category) => category.id))
const BILL_SOURCES = new Set<BillSource>(['manual', 'wish', 'import'])

function positiveCents(value: unknown, fallback: number): number {
  return isCents(value) && value > 0 ? value : fallback
}

function legacyOrCents(centsValue: unknown, yuanValue: unknown, fallback: number): number {
  if (isCents(centsValue) && centsValue > 0) return centsValue
  if (typeof yuanValue === 'number' && Number.isFinite(yuanValue) && yuanValue > 0) {
    const cents = yuanToCents(yuanValue)
    if (cents > 0) return cents
  }
  return fallback
}

function normalizeSettings(input: Record<string, unknown>): IslandSettings {
  return {
    islandName:
      typeof input.islandName === 'string' && input.islandName.trim()
        ? input.islandName.trim().slice(0, 12)
        : DEFAULT_SETTINGS.islandName,
    monthlyBudgetCents: legacyOrCents(
      input.monthlyBudgetCents,
      input.monthlyBudget,
      DEFAULT_SETTINGS.monthlyBudgetCents,
    ),
    savingsGoalCents: legacyOrCents(
      input.savingsGoalCents,
      input.savingsGoal,
      DEFAULT_SETTINGS.savingsGoalCents,
    ),
  }
}

export function loadSettings(): IslandSettings {
  return normalizeSettings(readJSON<Record<string, unknown>>(SETTINGS_KEY, {}))
}

export function saveSettings(input: IslandSettings): IslandSettings {
  const settings: IslandSettings = {
    islandName: input.islandName.trim().slice(0, 12) || DEFAULT_SETTINGS.islandName,
    monthlyBudgetCents: positiveCents(
      input.monthlyBudgetCents,
      DEFAULT_SETTINGS.monthlyBudgetCents,
    ),
    savingsGoalCents: positiveCents(input.savingsGoalCents, DEFAULT_SETTINGS.savingsGoalCents),
  }
  writeJSON(SETTINGS_KEY, settings)
  return settings
}

interface NormalizedBillBase extends Omit<Bill, 'monsterId'> {
  monsterId?: string
}

function normalizeStoredBill(value: unknown): NormalizedBillBase | null {
  if (typeof value !== 'object' || value === null) return null
  const bill = value as Record<string, unknown>
  const amountCents = legacyOrCents(bill.amountCents, bill.amount, 0)
  if (
    typeof bill.id !== 'string' ||
    amountCents <= 0 ||
    typeof bill.category !== 'string' ||
    !CATEGORY_IDS.has(bill.category) ||
    typeof bill.note !== 'string' ||
    typeof bill.time !== 'string' ||
    Number.isNaN(new Date(bill.time).getTime())
  ) {
    return null
  }

  const source =
    typeof bill.source === 'string' && BILL_SOURCES.has(bill.source as BillSource)
      ? (bill.source as BillSource)
      : 'manual'

  return {
    id: bill.id,
    amountCents,
    category: bill.category as CategoryId,
    note: bill.note,
    time: new Date(bill.time).toISOString(),
    monsterId:
      typeof bill.monsterId === 'string' && SPIRIT_BY_ID[bill.monsterId]
        ? bill.monsterId
        : undefined,
    source,
    sourceWishId: typeof bill.sourceWishId === 'string' ? bill.sourceWishId : undefined,
  }
}

export function loadBills(): Bill[] {
  const stored = readJSON<unknown>(BILLS_KEY, [])
  if (!Array.isArray(stored)) return []

  const chronological = stored
    .map(normalizeStoredBill)
    .filter((bill): bill is NormalizedBillBase => bill !== null)
    .sort((a, b) => {
      const byTime = new Date(a.time).getTime() - new Date(b.time).getTime()
      return byTime !== 0 ? byTime : a.id.localeCompare(b.id)
    })

  const resolved: Bill[] = []
  for (const bill of chronological) {
    const monsterId =
      bill.monsterId ??
      pickMonsterForBill(
        {
          id: bill.id,
          amountCents: bill.amountCents,
          category: bill.category,
          note: bill.note,
          time: bill.time,
        },
        resolved,
      ).id
    resolved.push({ ...bill, monsterId })
  }

  return resolved.sort(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
  )
}

export function createBill(input: NewBillInput, options: CreateBillOptions = {}): Bill {
  const amountCents = input.amountCents
  if (!isCents(amountCents) || amountCents <= 0) {
    throw new Error('金额需要大于 0')
  }
  const time = new Date(input.time)
  if (Number.isNaN(time.getTime())) {
    throw new Error('时间格式不对')
  }

  const priorBills = loadBills()
  const id = options.id ?? crypto.randomUUID()
  const existing = priorBills.find((bill) => bill.id === id)
  if (existing) return existing

  const seed = {
    id,
    amountCents,
    category: input.category,
    note: input.note.trim(),
    time: time.toISOString(),
  }
  const monsterId = pickMonsterForBill(seed, priorBills, {
    forceBoss: options.forceBoss,
  }).id

  const bill: Bill = {
    ...seed,
    monsterId,
    source: options.source ?? 'manual',
  }
  if (options.sourceWishId) bill.sourceWishId = options.sourceWishId

  writeJSON(BILLS_KEY, [bill, ...priorBills])
  return bill
}

export function combineSpentCents(bills: Bill[]): number {
  return bills.reduce((sum, bill) => sum + bill.amountCents, 0)
}

export function damageForSpentCents(spentCents: number): number {
  return Math.max(0, Math.round(spentCents / CENTS_PER_HP))
}

export function damageDeltaForTotals(previousSpentCents: number, nextSpentCents: number): number {
  return damageForSpentCents(nextSpentCents) - damageForSpentCents(previousSpentCents)
}

export function getWeather(hp: number): Weather {
  if (hp <= 0) return 'repair'
  if (hp > 50) return 'sunny'
  if (hp >= 30) return 'cloudy'
  if (hp >= 10) return 'overcast'
  return 'critical'
}

function damageByBill(billsAscending: Bill[]): Record<string, number> {
  let cumulativeSpent = 0
  let previousDamage = 0
  const result: Record<string, number> = {}

  for (const bill of billsAscending) {
    cumulativeSpent += bill.amountCents
    const damage = damageForSpentCents(cumulativeSpent)
    result[bill.id] = damage - previousDamage
    previousDamage = damage
  }
  return result
}

export function summarizeMonth(
  bills: Bill[],
  settings: IslandSettings,
  now = new Date(),
): MonthSummary {
  const year = now.getFullYear()
  const month = now.getMonth()
  const monthBills = bills.filter((bill) => {
    const time = new Date(bill.time)
    return time.getFullYear() === year && time.getMonth() === month
  })
  const ascending = [...monthBills].sort((a, b) => {
    const byTime = new Date(a.time).getTime() - new Date(b.time).getTime()
    return byTime !== 0 ? byTime : a.id.localeCompare(b.id)
  })

  const spentCents = combineSpentCents(monthBills)
  const damage = damageForSpentCents(spentCents)
  const isOverspent = spentCents > settings.monthlyBudgetCents
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  return {
    monthLabel: `${year} 年 ${month + 1} 月`,
    daysInMonth,
    dailyBudgetCents: Math.round(settings.monthlyBudgetCents / daysInMonth),
    budgetCents: settings.monthlyBudgetCents,
    spentCents,
    damage,
    hp: isOverspent ? 0 : Math.max(0, ISLAND_HP_MAX - damage),
    remainingCents: settings.monthlyBudgetCents - spentCents,
    isOverspent,
    bills: [...monthBills].sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
    ),
    billDamages: damageByBill(ascending),
  }
}

export function formatBillTime(iso: string): string {
  const time = new Date(iso)
  const month = time.getMonth() + 1
  const day = time.getDate()
  const hours = String(time.getHours()).padStart(2, '0')
  const minutes = String(time.getMinutes()).padStart(2, '0')
  return `${month}月${day}日 ${hours}:${minutes}`
}

export function toDateTimeLocalValue(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
