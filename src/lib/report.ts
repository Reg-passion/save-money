import type { EggTier, IslandState, Transaction } from '../types'
import {
  dailyScore,
  eggTierForScore,
  rareChanceForTier,
  startOfWeek,
  sumByCategory,
  sumByDate,
  sumTransactions,
  toDateKey,
  weekDates,
  weeklyBudgetBonus,
  type CategoryTotal,
} from './budget'

export interface DailyReport {
  date: string
  spentCents: number
  budgetCents: number
  savedCents: number
  topCategories: CategoryTotal[]
  biggest: Transaction | null
  eggAdded: number
  eggTotal: number
  tip: string
}

export interface WeeklyReport {
  weekStart: string
  spentCents: number
  budgetCents: number
  goodDays: number
  dailyBars: Array<{ date: string; spentCents: number }>
  topCategories: CategoryTotal[]
  biggest: Transaction | null
  savedCents: number
  score: number
  bonus: number
  tier: EggTier
  rareChance: number
  tip: string
}

function biggestOf(transactions: Transaction[]): Transaction | null {
  return transactions.reduce<Transaction | null>(
    (biggest, transaction) =>
      !biggest || transaction.amountCents > biggest.amountCents ? transaction : biggest,
    null,
  )
}

function dailyTip(spentCents: number, budgetCents: number, top: CategoryTotal | undefined): string {
  if (spentCents <= 0) return '今天还没有记账，先记下第一笔。'
  if (spentCents > budgetCents) {
    return `今天超出日预算 ${((spentCents - budgetCents) / 100).toFixed(2)} 元，明天先守住 50 元。`
  }
  if (top && top.pct >= 40) {
    return `${categoryName(top.category)}占了今天 ${top.pct}%，明天少一笔就能守住预算。`
  }
  return `今天在预算内，已省下 ${((budgetCents - spentCents) / 100).toFixed(2)} 元。`
}

function categoryName(category: CategoryTotal['category']): string {
  const names: Record<CategoryTotal['category'], string> = {
    takeout: '外卖',
    'milk-tea': '奶茶',
    'night-snack': '夜宵',
    delivery: '快递',
    transport: '交通',
    study: '学习',
    daily: '日用',
    fun: '娱乐',
  }
  return names[category]
}

export function buildDailyReport(state: IslandState, date: string): DailyReport {
  const transactions = state.transactions.filter((transaction) => transaction.date === date)
  const spentCents = sumTransactions(transactions)
  const topCategories = sumByCategory(transactions).slice(0, 3)
  const settled = state.egg.dailyScores[date]
  return {
    date,
    spentCents,
    budgetCents: state.budgets.daily,
    savedCents: Math.max(0, state.budgets.daily - spentCents),
    topCategories,
    biggest: biggestOf(transactions),
    eggAdded: settled ?? dailyScore(spentCents, state.budgets.daily),
    eggTotal: state.egg.score,
    tip: dailyTip(spentCents, state.budgets.daily, topCategories[0]),
  }
}

export function buildWeeklyReport(
  state: IslandState,
  anchor: Date | string = new Date(),
): WeeklyReport {
  const monday = startOfWeek(anchor instanceof Date ? anchor : new Date(anchor))
  const dates = weekDates(monday)
  const dateSet = new Set(dates)
  const transactions = state.transactions.filter((transaction) => dateSet.has(transaction.date))
  const spentCents = sumTransactions(transactions)
  const dailyBars = dates.map((date) => ({ date, spentCents: sumByDate(state.transactions, date) }))
  const dailyScores = dailyBars.map((day) =>
    state.egg.dailyScores[day.date] ?? dailyScore(day.spentCents, state.budgets.daily),
  )
  const rawScore = dailyScores.reduce((sum, score) => sum + score, 0)
  const bonus = weeklyBudgetBonus(spentCents, state.budgets.weekly)
  const score = Math.min(115, rawScore + bonus)
  const tier = eggTierForScore(score)
  const topCategories = sumByCategory(transactions).slice(0, 3)

  return {
    weekStart: dates[0] ?? toDateKey(monday),
    spentCents,
    budgetCents: state.budgets.weekly,
    goodDays: dailyBars.filter(
      (day) => day.spentCents > 0 && day.spentCents <= state.budgets.daily,
    ).length,
    dailyBars,
    topCategories,
    biggest: biggestOf(transactions),
    savedCents: Math.max(0, state.budgets.weekly - spentCents),
    score,
    bonus,
    tier,
    rareChance: rareChanceForTier(tier),
    tip:
      spentCents > state.budgets.weekly
        ? '本周超了周预算，下周把大额消费先放进许愿池。'
        : `本周守住预算，${tier === 'gold' ? '金蛋' : tier === 'silver' ? '银蛋' : '普通蛋'}已经可以结算。`,
  }
}