import { CATEGORIES } from '../data/categories'
import type { BillSource, CategoryId, EggTier, IslandState, Transaction } from '../types'
import {
  EGG_SCORE_MAX,
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
import { loadWishRecords, type WishRecordV2 } from './ledger'
import { formatCents } from './money'
import {
  STATE_KEY,
  STORAGE_PREFIX,
  StorageWriteError,
  WISHES_KEY,
  loadState,
  normalizeState,
  readJSON,
  writeJSON,
} from './storage'

const CATEGORY_NAMES = new Map(CATEGORIES.map((category) => [category.id, category.name]))
const CATEGORY_IDS = new Set<string>(CATEGORIES.map((category) => category.id))
const TIER_LABELS: Record<EggTier, string> = {
  normal: '普通蛋',
  silver: '银蛋',
  gold: '金蛋',
}
const SOURCE_LABELS: Record<BillSource, string> = {
  manual: '日常记账',
  wish: '许愿确认',
  import: '历史导入',
}

export const REPORTS_KEY = 'reports-v1'

export interface DailyReport {
  date: string
  spentCents: number
  budgetCents: number
  remainingCents: number
  savedCents: number
  topCategories: CategoryTotal[]
  biggest: Transaction | null
  eggAdded: number
  eggTotal: number
  eggTier: EggTier
  nextTier: EggTier | null
  pointsToNextTier: number
  tip: string
}

export interface DailyBar {
  date: string
  spentCents: number
  pctOfBudget: number
  overBudget: boolean
}

export interface WeeklyReport {
  weekStart: string
  weekEnd: string
  spentCents: number
  budgetCents: number
  remainingCents: number
  savedCents: number
  goodDays: number
  dailyBars: DailyBar[]
  topCategories: CategoryTotal[]
  biggest: Transaction | null
  score: number
  bonus: number
  tier: EggTier
  rareChance: number
  tip: string
}

export interface SavedReport<T> {
  generatedAt: string
  report: T
}

export interface StoredReports {
  daily: SavedReport<DailyReport> | null
  weekly: SavedReport<WeeklyReport> | null
}

function transactionDate(transaction: Transaction): string {
  return transaction.date || toDateKey(transaction.time)
}

function biggestOf(transactions: Transaction[]): Transaction | null {
  return transactions.reduce<Transaction | null>(
    (biggest, transaction) =>
      !biggest || transaction.amountCents > biggest.amountCents ? transaction : biggest,
    null,
  )
}

function categoryName(category: CategoryId): string {
  return CATEGORY_NAMES.get(category) ?? '其他'
}

function nextTierFor(score: number): { tier: EggTier | null; points: number } {
  if (score < 30) return { tier: 'silver', points: 30 - score }
  if (score < 70) return { tier: 'gold', points: 70 - score }
  return { tier: null, points: 0 }
}

function scoreForDates(state: IslandState, dates: string[]): { score: number; bonus: number } {
  const rawScore = dates.reduce(
    (sum, date) =>
      sum +
      (state.egg.dailyScores[date] ??
        dailyScore(sumByDate(state.transactions, date), state.budgets.daily)),
    0,
  )
  const spentCents = dates.reduce(
    (sum, date) => sum + sumByDate(state.transactions, date),
    0,
  )
  const bonus = weeklyBudgetBonus(spentCents, state.budgets.weekly)
  return { score: Math.min(EGG_SCORE_MAX, rawScore + bonus), bonus }
}

function dailyTip(
  spentCents: number,
  budgetCents: number,
  top: CategoryTotal | undefined,
): string {
  if (spentCents <= 0) return '今天还没有记账，先记下第一笔。'
  if (spentCents > budgetCents) {
    return `今天超了 ${formatCents(spentCents - budgetCents)} 元，明天先守住日预算。`
  }
  if (top && top.pct >= 40) {
    return `${categoryName(top.category)}占了今天 ${top.pct}%，明天少一笔就能守住预算。`
  }
  return `今天在预算内，已经省下 ${formatCents(budgetCents - spentCents)} 元。`
}

function weeklyTip(
  spentCents: number,
  budgetCents: number,
  top: CategoryTotal | undefined,
): string {
  if (spentCents <= 0) return '本周还没有记账，下周从第一笔开始。'
  if (spentCents > budgetCents) {
    return `本周超了 ${formatCents(spentCents - budgetCents)} 元，下周先把大额消费放进许愿池。`
  }
  if (top && top.pct >= 35) {
    return `下周${categoryName(top.category)}占比最高，先从这里减一笔。`
  }
  return '下周保持现在的节奏，先守住周预算。'
}

export function buildDailyReport(state: IslandState, date: string): DailyReport {
  const transactions = state.transactions.filter(
    (transaction) => transactionDate(transaction) === date,
  )
  const spentCents = sumTransactions(transactions)
  const topCategories = sumByCategory(transactions).slice(0, 3)
  const datesThisWeek = weekDates(startOfWeek(new Date(`${date}T00:00:00`))).filter(
    (day) => day <= date,
  )
  const eggProgress = scoreForDates(state, datesThisWeek)
  const eggAdded =
    state.egg.dailyScores[date] ?? dailyScore(spentCents, state.budgets.daily)
  const next = nextTierFor(eggProgress.score)

  return {
    date,
    spentCents,
    budgetCents: state.budgets.daily,
    remainingCents: state.budgets.daily - spentCents,
    savedCents: Math.max(0, state.budgets.daily - spentCents),
    topCategories,
    biggest: biggestOf(transactions),
    eggAdded,
    eggTotal: eggProgress.score,
    eggTier: eggTierForScore(eggProgress.score),
    nextTier: next.tier,
    pointsToNextTier: next.points,
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
  const transactions = state.transactions.filter((transaction) =>
    dateSet.has(transactionDate(transaction)),
  )
  const spentCents = sumTransactions(transactions)
  const dailyBars = dates.map((date) => {
    const daySpentCents = sumByDate(state.transactions, date)
    return {
      date,
      spentCents: daySpentCents,
      pctOfBudget: Math.min(
        100,
        Math.round((daySpentCents / Math.max(1, state.budgets.daily)) * 100),
      ),
      overBudget: daySpentCents > state.budgets.daily,
    }
  })
  const eggProgress = scoreForDates(state, dates)
  const topCategories = sumByCategory(transactions)
  const tier = eggTierForScore(eggProgress.score)

  return {
    weekStart: dates[0] ?? toDateKey(monday),
    weekEnd: dates[6] ?? toDateKey(monday),
    spentCents,
    budgetCents: state.budgets.weekly,
    remainingCents: state.budgets.weekly - spentCents,
    savedCents: Math.max(0, state.budgets.weekly - spentCents),
    goodDays: dailyBars.filter(
      (day) => day.spentCents > 0 && day.spentCents <= state.budgets.daily,
    ).length,
    dailyBars,
    topCategories,
    biggest: biggestOf(transactions),
    score: eggProgress.score,
    bonus: eggProgress.bonus,
    tier,
    rareChance: rareChanceForTier(tier),
    tip: weeklyTip(spentCents, state.budgets.weekly, topCategories[0]),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && CATEGORY_IDS.has(value)
}

function isEggTier(value: unknown): value is EggTier {
  return value === 'normal' || value === 'silver' || value === 'gold'
}

function isCategoryTotal(value: unknown): value is CategoryTotal {
  return (
    isRecord(value) &&
    isCategoryId(value.category) &&
    Number.isSafeInteger(value.amountCents) &&
    (value.amountCents as number) >= 0 &&
    isFiniteNumber(value.pct)
  )
}

function isTransactionLike(value: unknown): value is Transaction {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    Number.isSafeInteger(value.amountCents) &&
    (value.amountCents as number) >= 0 &&
    isCategoryId(value.category) &&
    typeof value.note === 'string' &&
    typeof value.time === 'string' &&
    !Number.isNaN(new Date(value.time).getTime()) &&
    typeof value.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.date) &&
    Number.isSafeInteger(value.monsterHp) &&
    typeof value.monsterId === 'string' &&
    (value.spiritId === null || typeof value.spiritId === 'string') &&
    (value.summonOutcome === null ||
      value.summonOutcome === 'spirit' ||
      value.summonOutcome === 'energy') &&
    (value.source === 'manual' || value.source === 'wish' || value.source === 'import')
  )
}

function isWishRecord(value: unknown): value is WishRecordV2 {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    Number.isSafeInteger(value.amountCents) &&
    (value.amountCents as number) >= 0 &&
    isCategoryId(value.category) &&
    typeof value.createdAt === 'string' &&
    !Number.isNaN(new Date(value.createdAt).getTime()) &&
    typeof value.readyAt === 'string' &&
    !Number.isNaN(new Date(value.readyAt).getTime()) &&
    (value.status === 'pending' ||
      value.status === 'confirmed' ||
      value.status === 'cancelled')
  )
}

function isBiggest(value: unknown): value is Transaction | null {
  return value === null || isTransactionLike(value)
}

function isDailyBar(value: unknown): value is DailyBar {
  return (
    isRecord(value) &&
    typeof value.date === 'string' &&
    isFiniteNumber(value.spentCents) &&
    isFiniteNumber(value.pctOfBudget) &&
    typeof value.overBudget === 'boolean'
  )
}

function isDailyReport(value: unknown): value is DailyReport {
  return (
    isRecord(value) &&
    typeof value.date === 'string' &&
    isFiniteNumber(value.spentCents) &&
    isFiniteNumber(value.budgetCents) &&
    isFiniteNumber(value.remainingCents) &&
    isFiniteNumber(value.savedCents) &&
    Array.isArray(value.topCategories) &&
    value.topCategories.every(isCategoryTotal) &&
    isBiggest(value.biggest) &&
    isFiniteNumber(value.eggAdded) &&
    isFiniteNumber(value.eggTotal) &&
    isEggTier(value.eggTier) &&
    (value.nextTier === null || isEggTier(value.nextTier)) &&
    isFiniteNumber(value.pointsToNextTier) &&
    typeof value.tip === 'string'
  )
}

function isWeeklyReport(value: unknown): value is WeeklyReport {
  return (
    isRecord(value) &&
    typeof value.weekStart === 'string' &&
    typeof value.weekEnd === 'string' &&
    isFiniteNumber(value.spentCents) &&
    isFiniteNumber(value.budgetCents) &&
    isFiniteNumber(value.remainingCents) &&
    isFiniteNumber(value.savedCents) &&
    isFiniteNumber(value.goodDays) &&
    Array.isArray(value.dailyBars) &&
    value.dailyBars.length === 7 &&
    value.dailyBars.every(isDailyBar) &&
    Array.isArray(value.topCategories) &&
    value.topCategories.every(isCategoryTotal) &&
    isBiggest(value.biggest) &&
    isFiniteNumber(value.score) &&
    isFiniteNumber(value.bonus) &&
    isEggTier(value.tier) &&
    isFiniteNumber(value.rareChance) &&
    typeof value.tip === 'string'
  )
}

function parseSavedReport<T>(
  value: unknown,
  guard: (candidate: unknown) => candidate is T,
): SavedReport<T> | null {
  if (
    !isRecord(value) ||
    typeof value.generatedAt !== 'string' ||
    Number.isNaN(new Date(value.generatedAt).getTime()) ||
    !guard(value.report)
  ) {
    return null
  }
  return { generatedAt: value.generatedAt, report: value.report }
}

function emptyStoredReports(): StoredReports {
  return { daily: null, weekly: null }
}

export function loadStoredReports(): StoredReports {
  const raw = readJSON<unknown>(REPORTS_KEY, null)
  if (!isRecord(raw)) return emptyStoredReports()
  return {
    daily: parseSavedReport(raw.daily, isDailyReport),
    weekly: parseSavedReport(raw.weekly, isWeeklyReport),
  }
}

export function saveDailyReport(
  report: DailyReport,
  now: Date = new Date(),
): SavedReport<DailyReport> {
  const current = loadStoredReports()
  const saved = { generatedAt: now.toISOString(), report }
  writeJSON<StoredReports>(REPORTS_KEY, { ...current, daily: saved })
  return saved
}

export function saveWeeklyReport(
  report: WeeklyReport,
  now: Date = new Date(),
): SavedReport<WeeklyReport> {
  const current = loadStoredReports()
  const saved = { generatedAt: now.toISOString(), report }
  writeJSON<StoredReports>(REPORTS_KEY, { ...current, weekly: saved })
  return saved
}

function csvCell(value: string | number): string {
  let text = String(value)
  // 防止 Excel 把笔记里的 = / + / - / @ 开头内容当成公式执行。
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function fixedYuan(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const absolute = Math.abs(cents)
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`
}

function localTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function buildTransactionsCsv(state: IslandState): string {
  const rows = [...state.transactions].sort(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
  )
  const lines = [
    ['日期', '时间', '金额（元）', '分类', '备注', '来源', '怪物血量'],
    ...rows.map((transaction) => [
      transaction.date,
      localTime(transaction.time),
      fixedYuan(transaction.amountCents),
      categoryName(transaction.category),
      transaction.note,
      SOURCE_LABELS[transaction.source] ?? transaction.source,
      transaction.monsterHp,
    ]),
  ]
  return `\ufeff${lines.map((line) => line.map(csvCell).join(',')).join('\r\n')}\r\n`
}

export function transactionsCsvFilename(now: Date = new Date()): string {
  return `money-island-bills-${toDateKey(now)}.csv`
}

export function reportBackupFilename(now: Date = new Date()): string {
  return `money-island-v2-backup-${toDateKey(now)}.json`
}

export interface ReportBackupPreview {
  exportedAt: string
  transactionCount: number
  wishCount: number
  hasDailyReport: boolean
  hasWeeklyReport: boolean
  dailyBudgetCents: number
  weeklyBudgetCents: number
}

export interface ParsedReportBackup {
  state: IslandState
  wishes: WishRecordV2[]
  reports: StoredReports
  preview: ReportBackupPreview
}

export function createReportBackup(now: Date = new Date()): string {
  const payload = {
    app: 'money-island',
    kind: 'v2-data',
    version: 2,
    exportedAt: now.toISOString(),
    data: {
      state: loadState(),
      wishes: loadWishRecords(),
      reports: loadStoredReports(),
    },
  }
  return `${JSON.stringify(payload, null, 2)}\n`
}

function parseBackupReports(value: unknown): StoredReports {
  if (value == null) return emptyStoredReports()
  if (!isRecord(value)) throw new Error('备份里的报告数据格式不正确。')

  const daily = value.daily == null ? null : parseSavedReport(value.daily, isDailyReport)
  if (value.daily != null && !daily) throw new Error('备份里的日报格式不正确。')

  const weekly = value.weekly == null ? null : parseSavedReport(value.weekly, isWeeklyReport)
  if (value.weekly != null && !weekly) throw new Error('备份里的周报格式不正确。')

  return { daily, weekly }
}

export function parseReportBackup(text: string): ParsedReportBackup {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('这个文件不是有效的 JSON。')
  }

  if (!isRecord(parsed) || parsed.app !== 'money-island' || parsed.kind !== 'v2-data') {
    throw new Error('不是钱钱岛的 v2 数据备份文件。')
  }
  if (parsed.version !== 2) {
    throw new Error('备份版本不支持，请使用当前版本导出的文件。')
  }

  const data = parsed.data
  if (!isRecord(data)) throw new Error('备份文件缺少数据内容。')

  const rawState = data.state
  if (!isRecord(rawState) || !Array.isArray(rawState.transactions)) {
    throw new Error('备份里缺少 v2 账本。')
  }
  if (!rawState.transactions.every(isTransactionLike)) {
    throw new Error('备份里有格式不正确的账单。')
  }

  if (!Array.isArray(data.wishes) || !data.wishes.every(isWishRecord)) {
    throw new Error('备份里的许愿池数据格式不正确。')
  }

  const state = normalizeState(rawState)
  const wishes = data.wishes as WishRecordV2[]
  const reports = parseBackupReports(data.reports)

  return {
    state,
    wishes,
    reports,
    preview: {
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '',
      transactionCount: state.transactions.length,
      wishCount: wishes.length,
      hasDailyReport: reports.daily !== null,
      hasWeeklyReport: reports.weekly !== null,
      dailyBudgetCents: state.budgets.daily,
      weeklyBudgetCents: state.budgets.weekly,
    },
  }
}

export function restoreReportBackup(backup: ParsedReportBackup): void {
  let storage: Storage
  try {
    storage = window.localStorage
  } catch {
    throw new Error('浏览器存储不可用，无法恢复备份。')
  }

  const entries: Array<[string, string]> = [
    [STATE_KEY, JSON.stringify(backup.state)],
    [STORAGE_PREFIX + WISHES_KEY, JSON.stringify(backup.wishes)],
    [STORAGE_PREFIX + REPORTS_KEY, JSON.stringify(backup.reports)],
  ]
  const previous = new Map<string, string | null>()

  try {
    for (const [key] of entries) previous.set(key, storage.getItem(key))
    for (const [key, value] of entries) storage.setItem(key, value)
  } catch {
    for (const [key, value] of previous) {
      try {
        if (value == null) storage.removeItem(key)
        else storage.setItem(key, value)
      } catch {
        // 回滚失败时保留原始错误，提示用户刷新后再检查数据。
      }
    }
    throw new StorageWriteError('恢复失败，原有数据已尽量保留。请检查浏览器存储空间。')
  }
}

export function buildWeeklyShareText(report: WeeklyReport): string {
  const spentLine = `本周花了 ${formatCents(report.spentCents)} / ${formatCents(report.budgetCents)} 元`
  const balanceLine =
    report.remainingCents >= 0
      ? `还剩 ${formatCents(report.remainingCents)} 元`
      : `超了 ${formatCents(-report.remainingCents)} 元`
  const biggestLine = report.biggest
    ? `${categoryName(report.biggest.category)} ${formatCents(report.biggest.amountCents)} 元`
    : '暂无支出'
  const categoryLine =
    report.topCategories
      .map((category) => `${categoryName(category.category)} ${category.pct}%`)
      .join('、') || '暂无'

  return [
    `钱钱岛周报 · ${report.weekStart} 至 ${report.weekEnd}`,
    `${spentLine}，${balanceLine}`,
    `守住预算 ${report.goodDays}/7 天`,
    `每天：${report.dailyBars
      .map((day) => `${day.date.slice(5).replace('-', '/')} ${formatCents(day.spentCents)} 元`)
      .join(' · ')}`,
    `分类占比：${categoryLine}`,
    `最贵一笔：${biggestLine}`,
    `本周省了 ${formatCents(report.savedCents)} 元`,
    `蛋总分 ${report.score} 分 · ${TIER_LABELS[report.tier]}`,
    `下周建议：${report.tip}`,
  ].join('\n')
}