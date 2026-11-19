import { CATALOG, SPIRIT_BY_ID, type Rarity, type Spirit } from '../data/catalog'
import {
  EGG_BASE_RARE_RATE,
  EGG_HATCH_DAYS,
  RARE_BONUS_CAP,
  RARE_BONUS_RATE,
  RARE_TOTAL_CAP,
} from '../data/constants'
import type { EggState, EggTier, IslandState } from '../types'
import {
  EGG_SCORE_MAX,
  addDays,
  dailyScore,
  eggTierForScore,
  rareChanceForTier,
  startOfLocalDay,
  startOfWeek,
  sumByDate,
  toDateKey,
  weekDates,
  weeklyBudgetBonus,
} from './budget'
import {
  loadBills,
  loadSettings,
  summarizeMonth,
  type Bill,
  type IslandSettings,
  type MonthSummary,
} from './island'
import { getEggBonusForWeek } from './tower'
import { yuanToCents } from './money'
import { loadState, readJSON, saveState, writeJSON } from './storage'
import { addSpiritToCollection, getOwnedSpiritIds } from './summon'

const EGGS_KEY = 'eggs'
const SETTLEMENTS_KEY = 'settlements'
const DEMO_EGGS_KEY = 'demo-eggs'
const DEMO_SETTLEMENTS_KEY = 'demo-settlements'

export const EGG_TIER_LABEL: Record<EggTier, string> = {
  normal: '普通蛋',
  silver: '银蛋',
  gold: '金蛋',
}

export const EGG_TIER_RULE: Record<EggTier, string> = {
  normal: '省 0–100 元',
  silver: '省 100–300 元',
  gold: '省 >300 元',
}

export type NoEggReason = 'no-bills' | 'overspent' | 'zero-hp'

export const NO_EGG_REASON_LABEL: Record<NoEggReason, string> = {
  'no-bills': '本月还没有账单',
  overspent: '本月超预算',
  'zero-hp': '岛血量为 0',
}

export interface EggCalculation {
  tier: EggTier
  savedCents: number
  goalCents: number
  extraSavedCents: number
  baseRate: number
  bonusRate: number
  rareChance: number
  bonusCapped: boolean
  totalCapped: boolean
}

export interface EggPreview {
  monthKey: string
  monthLabel: string
  budgetCents: number
  spentCents: number
  savedCents: number
  goalCents: number
  hp: number
  isOverspent: boolean
  hasBills: boolean
  hasEgg: boolean
  noEggReason: NoEggReason | null
  calculation: EggCalculation | null
}

export interface EggRecord {
  id: string
  settlementId: string
  monthKey: string
  monthLabel: string
  tier: EggTier
  savedCents: number
  goalCents: number
  baseRate: number
  bonusRate: number
  rareChance: number
  awardedAt: string
  hatchDays: string[]
  hatched: boolean
  hatchedAt: string | null
  spiritId: string | null
  spiritRarity: Rarity | null
  isNewSpirit: boolean | null
  demo: boolean
}

export interface SettlementRecord {
  id: string
  monthKey: string
  monthLabel: string
  budgetCents: number
  spentCents: number
  savedCents: number
  goalCents: number
  hp: number
  isOverspent: boolean
  hasEgg: boolean
  noEggReason: NoEggReason | null
  calculation: EggCalculation | null
  eggId: string | null
  settledAt: string
  demo: boolean
}

export interface HatchResult {
  egg: EggRecord
  spirit: Spirit
  isNew: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isEggTier(value: unknown): value is EggTier {
  return value === 'normal' || value === 'silver' || value === 'gold'
}

function isNoEggReason(value: unknown): value is NoEggReason {
  return value === 'no-bills' || value === 'overspent' || value === 'zero-hp'
}

function isRarity(value: unknown): value is Rarity {
  return value === 'normal' || value === 'rare' || value === 'hidden'
}

function isSignedCents(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

function positiveCents(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback
}

function legacyCents(centsValue: unknown, yuanValue: unknown, fallback: number): number {
  if (isSignedCents(centsValue)) return centsValue
  if (typeof yuanValue === 'number' && Number.isFinite(yuanValue)) {
    return yuanToCents(yuanValue)
  }
  return fallback
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

export function getMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

export function getEggTier(savedCents: number): EggTier {
  if (savedCents > 30000) return 'gold'
  if (savedCents >= 10000) return 'silver'
  return 'normal'
}

export function calculateEgg(savedCents: number, goalCents: number): EggCalculation {
  const safeGoal = goalCents > 0 ? goalCents : 1
  const tier = getEggTier(savedCents)
  const extraSavedCents = Math.max(0, savedCents - safeGoal)
  const rawBonus = (extraSavedCents / safeGoal) * RARE_BONUS_RATE
  const bonusRate = Math.min(RARE_BONUS_CAP, round4(rawBonus))
  const baseRate = EGG_BASE_RARE_RATE[tier]
  const rawTotal = baseRate + bonusRate
  const rareChance = Math.min(RARE_TOTAL_CAP, round4(rawTotal))

  return {
    tier,
    savedCents,
    goalCents: safeGoal,
    extraSavedCents,
    baseRate,
    bonusRate,
    rareChance,
    bonusCapped: rawBonus >= RARE_BONUS_CAP,
    totalCapped: rawTotal >= RARE_TOTAL_CAP,
  }
}

export function formatPercent(rate: number): string {
  const percent = Math.round(rate * 10000) / 100
  if (Number.isInteger(percent)) return `${percent}%`
  return `${percent.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}%`
}

export function previewSettlement(
  summary: MonthSummary,
  settings: IslandSettings,
  now = new Date(),
): EggPreview {
  const hasBills = summary.bills.length > 0
  const noEggReason: NoEggReason | null = !hasBills
    ? 'no-bills'
    : summary.isOverspent
      ? 'overspent'
      : summary.hp <= 0
        ? 'zero-hp'
        : null
  const hasEgg = noEggReason === null

  return {
    monthKey: getMonthKey(now),
    monthLabel: summary.monthLabel,
    budgetCents: settings.monthlyBudgetCents,
    spentCents: summary.spentCents,
    savedCents: summary.remainingCents,
    goalCents: settings.savingsGoalCents,
    hp: summary.hp,
    isOverspent: summary.isOverspent,
    hasBills,
    hasEgg,
    noEggReason,
    calculation: hasEgg
      ? calculateEgg(summary.remainingCents, settings.savingsGoalCents)
      : null,
  }
}

function normalizeCalculation(value: unknown): EggCalculation | null {
  if (!isRecord(value) || !isEggTier(value.tier)) return null
  const savedCents = legacyCents(value.savedCents, value.saved, 0)
  const goalCents = positiveCents(value.goalCents, 0) || legacyCents(undefined, value.goal, 0)
  if (!goalCents) return null

  return {
    tier: value.tier,
    savedCents,
    goalCents,
    extraSavedCents: legacyCents(value.extraSavedCents, undefined, Math.max(0, savedCents - goalCents)),
    baseRate: Number(value.baseRate),
    bonusRate: Number(value.bonusRate),
    rareChance: Number(value.rareChance),
    bonusCapped: value.bonusCapped === true,
    totalCapped: value.totalCapped === true,
  }
}

function normalizeEgg(value: unknown): EggRecord | null {
  if (!isRecord(value) || !isEggTier(value.tier)) return null
  const savedCents = legacyCents(value.savedCents, value.saved, 0)
  const goalCents = positiveCents(value.goalCents, 0) || legacyCents(undefined, value.goal, 0)
  if (
    typeof value.id !== 'string' ||
    typeof value.settlementId !== 'string' ||
    typeof value.monthKey !== 'string' ||
    typeof value.monthLabel !== 'string' ||
    typeof value.awardedAt !== 'string' ||
    Number.isNaN(new Date(value.awardedAt).getTime()) ||
    goalCents <= 0 ||
    typeof value.baseRate !== 'number' ||
    !Number.isFinite(value.baseRate) ||
    typeof value.bonusRate !== 'number' ||
    !Number.isFinite(value.bonusRate) ||
    typeof value.rareChance !== 'number' ||
    !Number.isFinite(value.rareChance) ||
    typeof value.hatched !== 'boolean'
  ) {
    return null
  }

  const spiritId =
    typeof value.spiritId === 'string' && SPIRIT_BY_ID[value.spiritId] ? value.spiritId : null
  const hatchDays = Array.isArray(value.hatchDays)
    ? [...new Set(value.hatchDays.filter((day): day is string => typeof day === 'string'))].slice(
        0,
        EGG_HATCH_DAYS,
      )
    : []

  return {
    id: value.id,
    settlementId: value.settlementId,
    monthKey: value.monthKey,
    monthLabel: value.monthLabel,
    tier: value.tier,
    savedCents,
    goalCents,
    baseRate: value.baseRate,
    bonusRate: value.bonusRate,
    rareChance: value.rareChance,
    awardedAt: value.awardedAt,
    hatchDays,
    hatched: value.hatched,
    hatchedAt: typeof value.hatchedAt === 'string' ? value.hatchedAt : null,
    spiritId,
    spiritRarity: isRarity(value.spiritRarity) ? value.spiritRarity : null,
    isNewSpirit: typeof value.isNewSpirit === 'boolean' ? value.isNewSpirit : null,
    demo: value.demo === true,
  }
}

function normalizeSettlement(value: unknown): SettlementRecord | null {
  if (!isRecord(value)) return null
  const budgetCents =
    positiveCents(value.budgetCents, 0) || legacyCents(undefined, value.budget, 0)
  const spentCents = legacyCents(value.spentCents, value.spent, -1)
  const savedCents = legacyCents(value.savedCents, value.saved, 0)
  const goalCents = positiveCents(value.goalCents, 0) || legacyCents(undefined, value.goal, 0)

  if (
    typeof value.id !== 'string' ||
    typeof value.monthKey !== 'string' ||
    typeof value.monthLabel !== 'string' ||
    budgetCents <= 0 ||
    spentCents < 0 ||
    goalCents <= 0 ||
    typeof value.hp !== 'number' ||
    !Number.isFinite(value.hp) ||
    typeof value.isOverspent !== 'boolean' ||
    typeof value.hasEgg !== 'boolean' ||
    typeof value.settledAt !== 'string' ||
    Number.isNaN(new Date(value.settledAt).getTime())
  ) {
    return null
  }

  const noEggReason =
    value.noEggReason === null
      ? null
      : isNoEggReason(value.noEggReason)
        ? value.noEggReason
        : null
  if (noEggReason === null && !value.hasEgg) return null

  return {
    id: value.id,
    monthKey: value.monthKey,
    monthLabel: value.monthLabel,
    budgetCents,
    spentCents,
    savedCents,
    goalCents,
    hp: value.hp,
    isOverspent: value.isOverspent,
    hasEgg: value.hasEgg,
    noEggReason,
    calculation: normalizeCalculation(value.calculation),
    eggId: typeof value.eggId === 'string' ? value.eggId : null,
    settledAt: value.settledAt,
    demo: value.demo === true,
  }
}

function loadDemoSettlementIds(): Set<string> {
  const stored = readJSON<unknown>(SETTLEMENTS_KEY, [])
  if (!Array.isArray(stored)) return new Set()
  return new Set(
    stored
      .filter(
        (value): value is Record<string, unknown> =>
          isRecord(value) && value.demo === true && typeof value.id === 'string',
      )
      .map((value) => value.id as string),
  )
}

export function loadEggs(): EggRecord[] {
  const stored = readJSON<unknown>(EGGS_KEY, [])
  if (!Array.isArray(stored)) return []
  const legacyDemoSettlements = loadDemoSettlementIds()
  return stored
    .map(normalizeEgg)
    .filter(
      (egg): egg is EggRecord =>
        egg !== null && !egg.demo && !legacyDemoSettlements.has(egg.settlementId),
    )
    .sort((a, b) => new Date(b.awardedAt).getTime() - new Date(a.awardedAt).getTime())
}

function saveEggs(eggs: EggRecord[]): void {
  writeJSON(EGGS_KEY, eggs)
}

export function loadSettlements(): SettlementRecord[] {
  const stored = readJSON<unknown>(SETTLEMENTS_KEY, [])
  if (!Array.isArray(stored)) return []
  return stored
    .map(normalizeSettlement)
    .filter((record): record is SettlementRecord => record !== null && !record.demo)
    .sort((a, b) => {
      const byMonth = a.monthKey.localeCompare(b.monthKey)
      return byMonth !== 0 ? byMonth : a.settledAt.localeCompare(b.settledAt)
    })
}

function saveSettlements(records: SettlementRecord[]): void {
  writeJSON(SETTLEMENTS_KEY, records)
}

export function loadDemoEggs(): EggRecord[] {
  const stored = readJSON<unknown>(DEMO_EGGS_KEY, [])
  if (!Array.isArray(stored)) return []
  return stored
    .map(normalizeEgg)
    .filter((egg): egg is EggRecord => egg !== null)
    .map((egg) => ({ ...egg, demo: true }))
    .sort((a, b) => new Date(b.awardedAt).getTime() - new Date(a.awardedAt).getTime())
}

function saveDemoEggs(eggs: EggRecord[]): void {
  writeJSON(DEMO_EGGS_KEY, eggs)
}

export function loadDemoSettlements(): SettlementRecord[] {
  const stored = readJSON<unknown>(DEMO_SETTLEMENTS_KEY, [])
  if (!Array.isArray(stored)) return []
  return stored
    .map(normalizeSettlement)
    .filter((record): record is SettlementRecord => record !== null)
    .map((record) => ({ ...record, demo: true }))
    .sort((a, b) => {
      const byMonth = a.monthKey.localeCompare(b.monthKey)
      return byMonth !== 0 ? byMonth : a.settledAt.localeCompare(b.settledAt)
    })
}

function saveDemoSettlements(records: SettlementRecord[]): void {
  writeJSON(DEMO_SETTLEMENTS_KEY, records)
}

function createEgg(
  settlementId: string,
  monthKey: string,
  monthLabel: string,
  calculation: EggCalculation,
  awardedAt: Date,
  demo: boolean,
): EggRecord {
  const suffix = demo ? 'demo' : 'formal'
  return {
    id: `egg:${monthKey}:${suffix}`,
    settlementId,
    monthKey,
    monthLabel,
    tier: calculation.tier,
    savedCents: calculation.savedCents,
    goalCents: calculation.goalCents,
    baseRate: calculation.baseRate,
    bonusRate: calculation.bonusRate,
    rareChance: calculation.rareChance,
    awardedAt: awardedAt.toISOString(),
    hatchDays: [],
    hatched: false,
    hatchedAt: null,
    spiritId: null,
    spiritRarity: null,
    isNewSpirit: null,
    demo,
  }
}

interface SettleOptions {
  now?: Date
  bills?: Bill[]
  settings?: IslandSettings
}

function buildSettlement(
  monthDate: Date,
  options: SettleOptions,
  demo: boolean,
): { record: SettlementRecord; egg: EggRecord | null } | null {
  const monthKey = getMonthKey(monthDate)
  const bills = options.bills ?? loadBills()
  const settings = options.settings ?? loadSettings()
  const summary = summarizeMonth(bills, settings, monthDate)
  if (summary.bills.length === 0) return null

  const now = options.now ?? new Date()
  const preview = previewSettlement(summary, settings, monthDate)
  const suffix = demo ? 'demo' : 'formal'
  const id = `settlement:${monthKey}:${suffix}`
  const record: SettlementRecord = {
    id,
    monthKey,
    monthLabel: summary.monthLabel,
    budgetCents: settings.monthlyBudgetCents,
    spentCents: summary.spentCents,
    savedCents: preview.savedCents,
    goalCents: settings.savingsGoalCents,
    hp: summary.hp,
    isOverspent: summary.isOverspent,
    hasEgg: preview.hasEgg,
    noEggReason: preview.noEggReason,
    calculation: preview.calculation,
    eggId: null,
    settledAt: now.toISOString(),
    demo,
  }

  const egg = preview.calculation
    ? createEgg(
        record.id,
        monthKey,
        summary.monthLabel,
        preview.calculation,
        now,
        demo,
      )
    : null
  if (egg) record.eggId = egg.id
  return { record, egg }
}

export function settleMonth(
  monthDate = new Date(),
  options: SettleOptions = {},
): SettlementRecord | null {
  const monthKey = getMonthKey(monthDate)
  const settlements = loadSettlements()
  const existing = settlements.find((record) => record.monthKey === monthKey)
  if (existing) return existing

  const built = buildSettlement(monthDate, options, false)
  if (!built) return null

  if (built.egg) {
    const eggs = loadEggs()
    const existingEgg = eggs.find((egg) => egg.id === built.egg?.id)
    saveEggs(existingEgg ? eggs : [built.egg, ...eggs])
  }
  saveSettlements([...settlements, built.record])
  return built.record
}

export function settleDemoMonth(
  monthDate = new Date(),
  options: SettleOptions = {},
): SettlementRecord | null {
  const monthKey = getMonthKey(monthDate)
  const settlements = loadDemoSettlements()
  const existing = settlements.find((record) => record.monthKey === monthKey)
  if (existing) return existing

  const built = buildSettlement(monthDate, options, true)
  if (!built) return null

  if (built.egg) {
    const eggs = loadDemoEggs()
    const existingEgg = eggs.find((egg) => egg.id === built.egg?.id)
    saveDemoEggs(existingEgg ? eggs : [built.egg, ...eggs])
  }
  saveDemoSettlements([...settlements, built.record])
  return built.record
}

export function resetDemoMonth(monthKey: string): boolean {
  const settlements = loadDemoSettlements()
  const record = settlements.find((item) => item.monthKey === monthKey)
  if (!record) return false
  const eggs = loadDemoEggs().filter(
    (egg) => egg.settlementId !== record.id && egg.id !== record.eggId,
  )
  saveDemoEggs(eggs)
  saveDemoSettlements(settlements.filter((item) => item.monthKey !== monthKey))
  return true
}

export function settlePendingMonths(now = new Date()): SettlementRecord[] {
  const bills = loadBills()
  const settings = loadSettings()
  const settlements = loadSettlements()
  const settledKeys = new Set(settlements.map((record) => record.monthKey))
  const currentKey = getMonthKey(now)
  const pastMonths = new Map<string, Date>()

  for (const bill of bills) {
    const billDate = new Date(bill.time)
    const key = getMonthKey(billDate)
    if (key >= currentKey || settledKeys.has(key) || pastMonths.has(key)) continue
    pastMonths.set(key, new Date(billDate.getFullYear(), billDate.getMonth(), 1))
  }

  const created: SettlementRecord[] = []
  for (const [, monthDate] of [...pastMonths].sort(([a], [b]) => a.localeCompare(b))) {
    const record = settleMonth(monthDate, { bills, settings, now })
    if (record && !settledKeys.has(record.monthKey)) {
      created.push(record)
      settledKeys.add(record.monthKey)
    }
  }
  return created
}

function hashString(input: string): number {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function hatchSpirit(egg: EggRecord): { spirit: Spirit; isNew: boolean } {
  const rareRoll = (hashString(`${egg.id}:rare-roll`) % 10000) / 10000
  const wantedRarity: Rarity = rareRoll < egg.rareChance ? 'rare' : 'normal'
  const pool = CATALOG.filter((spirit) => spirit.rarity === wantedRarity)
  const candidates = pool.length > 0 ? pool : CATALOG.filter((spirit) => spirit.rarity === 'normal')
  const spirit =
    candidates[hashString(`${egg.id}:spirit`) % candidates.length] ??
    CATALOG[0]
  return { spirit, isNew: !getOwnedSpiritIds().has(spirit.id) }
}

function performFormalHatch(egg: EggRecord, now: Date): HatchResult {
  const { spirit } = hatchSpirit(egg)
  const added = addSpiritToCollection(spirit.id)
  return {
    egg: {
      ...egg,
      hatched: true,
      hatchedAt: now.toISOString(),
      spiritId: spirit.id,
      spiritRarity: spirit.rarity,
      isNewSpirit: added,
    },
    spirit,
    isNew: added,
  }
}

function performDemoHatch(egg: EggRecord, now: Date): HatchResult {
  const { spirit, isNew } = hatchSpirit(egg)
  return {
    egg: {
      ...egg,
      hatched: true,
      hatchedAt: now.toISOString(),
      spiritId: spirit.id,
      spiritRarity: spirit.rarity,
      isNewSpirit: isNew,
    },
    spirit,
    isNew,
  }
}

function collectHatchDays(egg: EggRecord, bills: Bill[], now: Date): string[] {
  const days = new Set(egg.hatchDays)
  const awardedAt = new Date(egg.awardedAt).getTime()
  const endAt = now.getTime()

  for (const bill of bills) {
    const billAt = new Date(bill.time).getTime()
    if (billAt < awardedAt || billAt > endAt) continue
    days.add(localDayKey(new Date(billAt)))
  }

  return [...days].sort().slice(0, EGG_HATCH_DAYS)
}

export function syncEggHatch(now = new Date()): EggRecord[] {
  const eggs = loadEggs()
  if (!eggs.some((egg) => !egg.hatched)) return eggs

  const bills = loadBills()
  let changed = false
  const next = eggs.map((egg) => {
    if (egg.hatched) return egg

    const hatchDays = collectHatchDays(egg, bills, now)
    let updated = egg
    if (hatchDays.length !== egg.hatchDays.length) {
      updated = { ...updated, hatchDays }
      changed = true
    }

    if (hatchDays.length >= EGG_HATCH_DAYS) {
      updated = performFormalHatch(updated, now).egg
      changed = true
    }
    return updated
  })

  if (changed) saveEggs(next)
  return next
}

export function hatchDemoEgg(eggId: string, now = new Date()): HatchResult | null {
  const eggs = loadDemoEggs()
  const index = eggs.findIndex((egg) => egg.id === eggId)
  if (index < 0 || eggs[index].hatched) return null

  const result = performDemoHatch(eggs[index], now)
  eggs[index] = result.egg
  saveDemoEggs(eggs)
  return result
}

export const WEEKLY_HATCH_EVENT = 'money-island:weekly-hatch'
const DEMO_WEEKLY_EGG_KEY = 'demo-weekly-egg-v1'

export interface EggDayProgress {
  date: string
  spentCents: number
  score: number
  settled: boolean
  future: boolean
}

export interface EggWeekSummary {
  weekStart: string
  weekEnd: string
  days: EggDayProgress[]
  spentCents: number
  rawScore: number
  bonus: number
  towerBonus: number
  score: number
  tier: EggTier
  startingTier: EggTier
  rareChance: number
  settledDays: number
  nextTier: EggTier | null
  pointsToNextTier: number
  hatched: boolean
  hatchedSpiritId: string | null
}

export interface WeeklyHatchOutcome {
  state: IslandState
  weekStart: string
  summary: EggWeekSummary
  fromScore: number
  fromTier: EggTier
  score: number
  tier: EggTier
  rareChance: number
  spirit: Spirit
  isNew: boolean
  alreadyHatched: boolean
}

export interface DemoEggRecord {
  spiritId: string
  tier: EggTier
  rareChance: number
  score: number
  isNew: boolean
  at: string
}

export interface DemoEggState {
  runs: number
  last: DemoEggRecord | null
}

export interface DemoHatchOutcome {
  demo: DemoEggState
  spirit: Spirit
  isNew: boolean
  score: number
  tier: EggTier
  rareChance: number
}

export function nextEggTierForScore(score: number): { tier: EggTier | null; points: number } {
  if (score < 30) return { tier: 'silver', points: 30 - score }
  if (score < 70) return { tier: 'gold', points: 70 - score }
  return { tier: null, points: 0 }
}

export function createEggState(cycleStart: string): EggState {
  return {
    cycleStart,
    score: 0,
    dailyScores: {},
    tier: null,
    hatched: false,
    hatchedSpiritId: null,
    skippedTower: false,
  }
}

export function getEggWeekSummary(
  state: IslandState,
  anchor: Date | string = new Date(),
  now: Date = new Date(),
): EggWeekSummary {
  const monday = startOfWeek(anchor instanceof Date ? anchor : new Date(anchor))
  const weekStart = toDateKey(monday)
  const dates = weekDates(monday)
  const todayKey = toDateKey(now)
  const days = dates.map((date) => {
    const spentCents = sumByDate(state.transactions, date)
    const settledScore = state.egg.dailyScores[date]
    return {
      date,
      spentCents,
      score: settledScore ?? dailyScore(spentCents, state.budgets.daily),
      settled: settledScore !== undefined,
      future: date > todayKey,
    }
  })
  const spentCents = days.reduce((sum, day) => sum + day.spentCents, 0)
  const rawScore = days.reduce((sum, day) => sum + day.score, 0)
  const bonus = weeklyBudgetBonus(spentCents, state.budgets.weekly)
  const towerBonus = getEggBonusForWeek(weekStart)
  const score = Math.min(EGG_SCORE_MAX, rawScore + bonus + towerBonus)
  const tier = eggTierForScore(score)
  const cycleMatches = state.egg.cycleStart === weekStart
  const next = nextEggTierForScore(score)

  return {
    weekStart,
    weekEnd: dates[6] ?? weekStart,
    days,
    spentCents,
    rawScore,
    bonus,
    towerBonus,
    score,
    tier,
    startingTier: eggTierForScore(cycleMatches ? state.egg.score : 0),
    rareChance: rareChanceForTier(tier),
    settledDays: days.filter((day) => day.settled).length,
    nextTier: next.tier,
    pointsToNextTier: next.points,
    hatched: cycleMatches && state.egg.hatched,
    hatchedSpiritId: cycleMatches ? state.egg.hatchedSpiritId : null,
  }
}

export function syncEggCycle(state: IslandState, now: Date = new Date()): IslandState {
  const monday = toDateKey(startOfWeek(now))
  if (state.egg.cycleStart === monday) return state
  return { ...state, egg: createEggState(monday) }
}

export function settleDay(state: IslandState, date: string): IslandState {
  if (state.egg.hatched || state.egg.dailyScores[date] !== undefined) return state
  const spentCents = sumByDate(state.transactions, date)
  const score = dailyScore(spentCents, state.budgets.daily)
  return {
    ...state,
    egg: {
      ...state.egg,
      score: state.egg.score + score,
      dailyScores: { ...state.egg.dailyScores, [date]: score },
    },
  }
}

export function settleDueDays(state: IslandState, now: Date = new Date()): IslandState {
  let next = syncEggCycle(state, now)
  if (next.egg.hatched) return next

  const todayKey = toDateKey(startOfLocalDay(now))
  const cycleStart = new Date(`${next.egg.cycleStart}T00:00:00`)
  if (Number.isNaN(cycleStart.getTime())) return next

  for (let index = 0; index < 7; index += 1) {
    const date = toDateKey(addDays(cycleStart, index))
    if (date >= todayKey) break
    next = settleDay(next, date)
  }
  return next
}

export function syncEggState(now: Date = new Date()): IslandState {
  const state = loadState()
  const next = settleDueDays(state, now)
  if (next !== state) saveState(next)
  return next
}

function pickWeeklyEggSpirit(
  weekStart: string,
  tier: EggTier,
  spirits: IslandState['spirits'],
): Spirit {
  const rareRoll = (hashString(`${weekStart}:egg-rare`) % 10000) / 10000
  const wanted: Rarity = rareRoll < rareChanceForTier(tier) ? 'rare' : 'normal'
  const pool = CATALOG.filter((spirit) => spirit.rarity === wanted)
  const unowned = pool.filter((spirit) => !spirits[spirit.id])
  const candidates = unowned.length > 0 ? unowned : pool
  const fallback = candidates.length > 0 ? candidates : CATALOG
  return fallback[hashString(`${weekStart}:egg-spirit:${wanted}`) % fallback.length] ?? CATALOG[0]
}

function emptyDemoEggState(): DemoEggState {
  return { runs: 0, last: null }
}

export function loadDemoWeeklyEgg(): DemoEggState {
  const raw = readJSON<unknown>(DEMO_WEEKLY_EGG_KEY, null)
  if (!isRecord(raw)) return emptyDemoEggState()
  const runs = Number(raw.runs)
  const lastRaw = isRecord(raw.last) ? raw.last : null
  const spirit =
    lastRaw && typeof lastRaw.spiritId === 'string' ? SPIRIT_BY_ID[lastRaw.spiritId] : null
  const tier = lastRaw && isEggTier(lastRaw.tier) ? lastRaw.tier : null
  const last =
    lastRaw && spirit && tier
      ? {
          spiritId: spirit.id,
          tier,
          rareChance:
            typeof lastRaw.rareChance === 'number' && Number.isFinite(lastRaw.rareChance)
              ? lastRaw.rareChance
              : rareChanceForTier(tier),
          score: typeof lastRaw.score === 'number' && Number.isFinite(lastRaw.score) ? lastRaw.score : 0,
          isNew: lastRaw.isNew === true,
          at: typeof lastRaw.at === 'string' ? lastRaw.at : '',
        }
      : null
  return {
    runs: Number.isSafeInteger(runs) && runs >= 0 ? runs : 0,
    last,
  }
}

function pickDemoSpirit(
  seed: string,
  tier: EggTier,
  spirits: IslandState['spirits'],
): Spirit {
  const rareRoll = (hashString(`${seed}:demo-rare`) % 10000) / 10000
  const wanted: Rarity = rareRoll < rareChanceForTier(tier) ? 'rare' : 'normal'
  const pool = CATALOG.filter((spirit) => spirit.rarity === wanted)
  const unowned = pool.filter((spirit) => !spirits[spirit.id])
  const candidates = unowned.length > 0 ? unowned : pool
  const fallback = candidates.length > 0 ? candidates : CATALOG
  return fallback[hashString(`${seed}:demo-spirit`) % fallback.length] ?? CATALOG[0]
}

export function runDemoWeeklyHatch(
  state: IslandState,
  now: Date = new Date(),
): DemoHatchOutcome {
  const previous = loadDemoWeeklyEgg()
  const runs = previous.runs + 1
  const summary = getEggWeekSummary(state, now, now)
  const spirit = pickDemoSpirit(`${toDateKey(now)}:${runs}`, summary.tier, state.spirits)
  const isNew = !state.spirits[spirit.id]
  const demo: DemoEggState = {
    runs,
    last: {
      spiritId: spirit.id,
      tier: summary.tier,
      rareChance: summary.rareChance,
      score: summary.score,
      isNew,
      at: now.toISOString(),
    },
  }
  writeJSON(DEMO_WEEKLY_EGG_KEY, demo)
  return {
    demo,
    spirit,
    isNew,
    score: summary.score,
    tier: summary.tier,
    rareChance: summary.rareChance,
  }
}

export function hatchWeeklyEgg(
  state: IslandState,
  anchor: Date | string = state.egg.cycleStart || new Date(),
  now: Date = new Date(),
): WeeklyHatchOutcome {
  const monday = startOfWeek(anchor instanceof Date ? anchor : new Date(anchor))
  const weekStart = toDateKey(monday)
  const summary = getEggWeekSummary(state, monday, now)
  const fromScore = state.egg.cycleStart === weekStart ? state.egg.score : 0
  const fromTier = eggTierForScore(fromScore)

  if (state.egg.hatched && state.egg.cycleStart === weekStart) {
    const existing = state.egg.hatchedSpiritId
      ? SPIRIT_BY_ID[state.egg.hatchedSpiritId]
      : undefined
    if (existing) {
      return {
        state,
        weekStart,
        summary,
        fromScore,
        fromTier,
        score: state.egg.score,
        tier: state.egg.tier ?? eggTierForScore(state.egg.score),
        rareChance: rareChanceForTier(state.egg.tier ?? eggTierForScore(state.egg.score)),
        spirit: existing,
        isNew: false,
        alreadyHatched: true,
      }
    }
  }

  const spirit = pickWeeklyEggSpirit(weekStart, summary.tier, state.spirits)
  const previous = state.spirits[spirit.id]
  const todayKey = toDateKey(now)
  const dailyScores = { ...state.egg.dailyScores }
  for (const day of summary.days) {
    if (day.date <= todayKey) dailyScores[day.date] = day.score
  }

  const next: IslandState = {
    ...state,
    egg: {
      ...state.egg,
      cycleStart: weekStart,
      score: summary.score,
      dailyScores,
      tier: summary.tier,
      hatched: true,
      hatchedSpiritId: spirit.id,
    },
    spirits: {
      ...state.spirits,
      [spirit.id]: {
        count: (previous?.count ?? 0) + 1,
        evolved: previous?.evolved ?? false,
        firstSeenAt: previous?.firstSeenAt ?? now.toISOString(),
      },
    },
  }

  return {
    state: next,
    weekStart,
    summary,
    fromScore,
    fromTier,
    score: summary.score,
    tier: summary.tier,
    rareChance: summary.rareChance,
    spirit,
    isNew: !previous,
    alreadyHatched: false,
  }
}

export function finalizeWeeklyEgg(
  state: IslandState,
  anchor: Date | string = state.egg.cycleStart || new Date(),
  now: Date = new Date(),
): IslandState {
  return hatchWeeklyEgg(state, anchor, now).state
}

export function notifyWeeklyReportGenerated(weekStart: string): void {
  if (typeof window === 'undefined') return
  window.setTimeout(() => {
    window.dispatchEvent(
      new CustomEvent(WEEKLY_HATCH_EVENT, { detail: { weekStart } }),
    )
  }, 800)
}

export { dailyScore, eggTierForScore, rareChanceForTier }
