import { CATEGORIES } from '../data/categories'
import {
  DEFAULT_MONTHLY_BUDGET,
  DEFAULT_SAVINGS_GOAL,
  ISLAND_HP_MAX,
  YUAN_PER_HP,
} from '../data/constants'
import type { CategoryId } from '../types'
import { readJSON, writeJSON } from './storage'

export interface IslandSettings {
  islandName: string
  monthlyBudget: number
  savingsGoal: number
}

export interface Bill {
  id: string
  amount: number
  category: CategoryId
  note: string
  time: string
  hpCost: number
}

export interface NewBillInput {
  amount: number
  category: CategoryId
  note: string
  time: string
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
  dailyBudget: number
  spent: number
  damage: number
  hp: number
  remaining: number
  isOverspent: boolean
  bills: Bill[]
}

const SETTINGS_KEY = 'settings'
const BILLS_KEY = 'bills'

export const DEFAULT_SETTINGS: IslandSettings = {
  islandName: '钱钱岛',
  monthlyBudget: DEFAULT_MONTHLY_BUDGET,
  savingsGoal: DEFAULT_SAVINGS_GOAL,
}

const CATEGORY_IDS = new Set<string>(CATEGORIES.map((category) => category.id))

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function toPositive(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? round2(value)
    : fallback
}

function normalizeSettings(input: Partial<IslandSettings>): IslandSettings {
  return {
    islandName:
      typeof input.islandName === 'string' && input.islandName.trim()
        ? input.islandName.trim().slice(0, 12)
        : DEFAULT_SETTINGS.islandName,
    monthlyBudget: toPositive(input.monthlyBudget, DEFAULT_SETTINGS.monthlyBudget),
    savingsGoal: toPositive(input.savingsGoal, DEFAULT_SETTINGS.savingsGoal),
  }
}

export function loadSettings(): IslandSettings {
  return normalizeSettings(readJSON<Partial<IslandSettings>>(SETTINGS_KEY, {}))
}

export function saveSettings(input: IslandSettings): IslandSettings {
  const settings = normalizeSettings(input)
  writeJSON(SETTINGS_KEY, settings)
  return settings
}

function isBill(value: unknown): value is Bill {
  if (typeof value !== 'object' || value === null) return false
  const bill = value as Partial<Bill>
  return (
    typeof bill.id === 'string' &&
    typeof bill.amount === 'number' &&
    Number.isFinite(bill.amount) &&
    bill.amount > 0 &&
    typeof bill.category === 'string' &&
    CATEGORY_IDS.has(bill.category) &&
    typeof bill.note === 'string' &&
    typeof bill.time === 'string' &&
    !Number.isNaN(new Date(bill.time).getTime()) &&
    typeof bill.hpCost === 'number' &&
    Number.isFinite(bill.hpCost)
  )
}

export function loadBills(): Bill[] {
  const stored = readJSON<unknown>(BILLS_KEY, [])
  if (!Array.isArray(stored)) return []
  return stored
    .filter(isBill)
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
}

export function calcHpCost(amount: number): number {
  return Math.round(amount / YUAN_PER_HP)
}

export function createBill(input: NewBillInput): Bill {
  const amount = round2(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('金额需要大于 0')
  }
  const time = new Date(input.time)
  if (Number.isNaN(time.getTime())) {
    throw new Error('时间格式不对')
  }

  const bill: Bill = {
    id: crypto.randomUUID(),
    amount,
    category: input.category,
    note: input.note.trim(),
    time: time.toISOString(),
    hpCost: calcHpCost(amount),
  }
  writeJSON(BILLS_KEY, [bill, ...loadBills()])
  return bill
}

export function getWeather(hp: number): Weather {
  if (hp <= 0) return 'repair'
  if (hp > 50) return 'sunny'
  if (hp >= 30) return 'cloudy'
  if (hp >= 10) return 'overcast'
  return 'critical'
}

export function summarizeMonth(
  bills: Bill[],
  settings: IslandSettings,
  now = new Date(),
): MonthSummary {
  const year = now.getFullYear()
  const month = now.getMonth()
  const monthBills = bills
    .filter((bill) => {
      const time = new Date(bill.time)
      return time.getFullYear() === year && time.getMonth() === month
    })
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  const spent = round2(monthBills.reduce((sum, bill) => sum + bill.amount, 0))
  const damage = monthBills.reduce((sum, bill) => sum + bill.hpCost, 0)
  const isOverspent = spent > settings.monthlyBudget
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  return {
    monthLabel: `${year} 年 ${month + 1} 月`,
    daysInMonth,
    dailyBudget: round2(settings.monthlyBudget / daysInMonth),
    spent,
    damage,
    hp: isOverspent ? 0 : Math.max(0, ISLAND_HP_MAX - damage),
    remaining: round2(settings.monthlyBudget - spent),
    isOverspent,
    bills: monthBills,
  }
}

export function formatYuan(value: number): string {
  const rounded = round2(value)
  if (Number.isInteger(rounded)) return String(rounded)
  return rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
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
