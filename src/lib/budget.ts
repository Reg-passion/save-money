import type { Budgets, CategoryId, EggTier, Transaction } from '../types'

export const DEFAULT_BUDGETS: Budgets = {
  daily: 5000,
  weekly: 35000,
}

export const EGG_SCORE_MAX = 115

function validBudgetCents(value: number, fallback: number): number {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback
}

export function applyDailyBudget(budgets: Budgets, dailyCents: number): Budgets {
  const daily = validBudgetCents(Math.round(dailyCents), budgets.daily)
  return { daily, weekly: daily * 7 }
}

export function applyWeeklyBudget(budgets: Budgets, weeklyCents: number): Budgets {
  return { ...budgets, weekly: validBudgetCents(Math.round(weeklyCents), budgets.weekly) }
}

export function toDateKey(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

export function startOfLocalDay(value: Date | string = new Date()): Date {
  const date = value instanceof Date ? new Date(value) : new Date(value)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(value: Date, days: number): Date {
  const date = new Date(value)
  date.setDate(date.getDate() + days)
  return date
}

export function startOfWeek(value: Date = new Date()): Date {
  const day = startOfLocalDay(value)
  const mondayOffset = (day.getDay() + 6) % 7
  return addDays(day, -mondayOffset)
}

export function weekDates(anchor: Date = new Date()): string[] {
  const monday = startOfWeek(anchor)
  return Array.from({ length: 7 }, (_, index) => toDateKey(addDays(monday, index)))
}

export function sumTransactions(transactions: Transaction[]): number {
  return transactions.reduce((sum, transaction) => sum + transaction.amountCents, 0)
}

export function sumByDate(transactions: Transaction[], date: string): number {
  return sumTransactions(transactions.filter((transaction) => transaction.date === date))
}

export interface CategoryTotal {
  category: CategoryId
  amountCents: number
  pct: number
}

export function sumByCategory(transactions: Transaction[]): CategoryTotal[] {
  const totals = new Map<CategoryId, number>()
  for (const transaction of transactions) {
    totals.set(
      transaction.category,
      (totals.get(transaction.category) ?? 0) + transaction.amountCents,
    )
  }
  const spent = sumTransactions(transactions)
  return [...totals.entries()]
    .map(([category, amountCents]) => ({
      category,
      amountCents,
      pct: spent > 0 ? Math.round((amountCents / spent) * 100) : 0,
    }))
    .sort((a, b) => b.amountCents - a.amountCents)
}

export function dailyScore(spentCents: number, dailyBudgetCents: number): number {
  if (spentCents <= 0) return 0
  if (spentCents <= dailyBudgetCents * 0.8) return 15
  if (spentCents <= dailyBudgetCents) return 10
  return 0
}

export function weeklyBudgetBonus(weeklySpentCents: number, weeklyBudgetCents: number): number {
  return weeklySpentCents > 0 && weeklySpentCents <= weeklyBudgetCents ? 10 : 0
}

export function eggTierForScore(score: number): EggTier {
  if (score >= 70) return 'gold'
  if (score >= 30) return 'silver'
  return 'normal'
}

export function rareChanceForTier(tier: EggTier): number {
  if (tier === 'gold') return 0.4
  if (tier === 'silver') return 0.25
  return 0.1
}