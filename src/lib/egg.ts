import { CATALOG, SPIRIT_BY_ID, type Rarity, type Spirit } from '../data/catalog'
import {
  EGG_BASE_RARE_RATE,
  EGG_HATCH_DAYS,
  RARE_BONUS_CAP,
  RARE_BONUS_RATE,
  RARE_TOTAL_CAP,
} from '../data/constants'
import type { EggTier } from '../types'
import {
  loadBills,
  loadSettings,
  summarizeMonth,
  type Bill,
  type IslandSettings,
  type MonthSummary,
} from './island'
import { readJSON, writeJSON } from './storage'

const EGGS_KEY = 'eggs'
const SETTLEMENTS_KEY = 'settlements'
const SUMMON_KEY = 'summon'

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
  saved: number
  goal: number
  extraSaved: number
  baseRate: number
  bonusRate: number
  rareChance: number
  bonusCapped: boolean
  totalCapped: boolean
}

export interface EggPreview {
  monthKey: string
  monthLabel: string
  budget: number
  spent: number
  saved: number
  goal: number
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
  saved: number
  goal: number
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
}

export interface SettlementRecord {
  id: string
  monthKey: string
  monthLabel: string
  budget: number
  spent: number
  saved: number
  goal: number
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

function round2(value: number): number {
  return Math.round(value * 100) / 100
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

export function getEggTier(saved: number): EggTier {
  if (saved > 300) return 'gold'
  if (saved >= 100) return 'silver'
  return 'normal'
}

export function calculateEgg(saved: number, goal: number): EggCalculation {
  const safeGoal = goal > 0 ? goal : 1
  const tier = getEggTier(saved)
  const extraSaved = Math.max(0, round2(saved - safeGoal))
  const rawBonus = (extraSaved / safeGoal) * RARE_BONUS_RATE
  const bonusRate = Math.min(RARE_BONUS_CAP, round4(rawBonus))
  const baseRate = EGG_BASE_RARE_RATE[tier]
  const rawTotal = baseRate + bonusRate
  const rareChance = Math.min(RARE_TOTAL_CAP, round4(rawTotal))

  return {
    tier,
    saved: round2(saved),
    goal: round2(safeGoal),
    extraSaved,
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
  const saved = round2(summary.remaining)

  return {
    monthKey: getMonthKey(now),
    monthLabel: summary.monthLabel,
    budget: settings.monthlyBudget,
    spent: summary.spent,
    saved,
    goal: settings.savingsGoal,
    hp: summary.hp,
    isOverspent: summary.isOverspent,
    hasBills,
    hasEgg,
    noEggReason,
    calculation: hasEgg ? calculateEgg(saved, settings.savingsGoal) : null,
  }
}

function isCalculation(value: unknown): value is EggCalculation {
  if (!isRecord(value)) return false
  return (
    isEggTier(value.tier) &&
    typeof value.saved === 'number' &&
    Number.isFinite(value.saved) &&
    typeof value.goal === 'number' &&
    Number.isFinite(value.goal) &&
    typeof value.extraSaved === 'number' &&
    Number.isFinite(value.extraSaved) &&
    typeof value.baseRate === 'number' &&
    Number.isFinite(value.baseRate) &&
    typeof value.bonusRate === 'number' &&
    Number.isFinite(value.bonusRate) &&
    typeof value.rareChance === 'number' &&
    Number.isFinite(value.rareChance) &&
    typeof value.bonusCapped === 'boolean' &&
    typeof value.totalCapped === 'boolean'
  )
}

function normalizeEgg(value: unknown): EggRecord | null {
  if (!isRecord(value) || !isEggTier(value.tier)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.settlementId !== 'string' ||
    typeof value.monthKey !== 'string' ||
    typeof value.monthLabel !== 'string' ||
    typeof value.awardedAt !== 'string' ||
    Number.isNaN(new Date(value.awardedAt).getTime()) ||
    typeof value.saved !== 'number' ||
    !Number.isFinite(value.saved) ||
    typeof value.goal !== 'number' ||
    !Number.isFinite(value.goal) ||
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
    saved: value.saved,
    goal: value.goal,
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
  }
}

function normalizeSettlement(value: unknown): SettlementRecord | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.monthKey !== 'string' ||
    typeof value.monthLabel !== 'string' ||
    typeof value.budget !== 'number' ||
    !Number.isFinite(value.budget) ||
    typeof value.spent !== 'number' ||
    !Number.isFinite(value.spent) ||
    typeof value.saved !== 'number' ||
    !Number.isFinite(value.saved) ||
    typeof value.goal !== 'number' ||
    !Number.isFinite(value.goal) ||
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
    budget: value.budget,
    spent: value.spent,
    saved: value.saved,
    goal: value.goal,
    hp: value.hp,
    isOverspent: value.isOverspent,
    hasEgg: value.hasEgg,
    noEggReason,
    calculation: isCalculation(value.calculation) ? value.calculation : null,
    eggId: typeof value.eggId === 'string' ? value.eggId : null,
    settledAt: value.settledAt,
    demo: value.demo === true,
  }
}

export function loadEggs(): EggRecord[] {
  const stored = readJSON<unknown>(EGGS_KEY, [])
  if (!Array.isArray(stored)) return []
  return stored
    .map(normalizeEgg)
    .filter((egg): egg is EggRecord => egg !== null)
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
    .filter((record): record is SettlementRecord => record !== null)
    .sort((a, b) => {
      const byMonth = a.monthKey.localeCompare(b.monthKey)
      return byMonth !== 0 ? byMonth : a.settledAt.localeCompare(b.settledAt)
    })
}

function saveSettlements(records: SettlementRecord[]): void {
  writeJSON(SETTLEMENTS_KEY, records)
}

function createEgg(
  settlementId: string,
  monthKey: string,
  monthLabel: string,
  calculation: EggCalculation,
  awardedAt: Date,
): EggRecord {
  return {
    id: crypto.randomUUID(),
    settlementId,
    monthKey,
    monthLabel,
    tier: calculation.tier,
    saved: calculation.saved,
    goal: calculation.goal,
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
  }
}

interface SettleOptions {
  demo?: boolean
  now?: Date
  bills?: Bill[]
  settings?: IslandSettings
}

export function settleMonth(monthDate = new Date(), options: SettleOptions = {}): SettlementRecord | null {
  const monthKey = getMonthKey(monthDate)
  const settlements = loadSettlements()
  const existing = settlements.find((record) => record.monthKey === monthKey)
  if (existing) return existing

  const bills = options.bills ?? loadBills()
  const settings = options.settings ?? loadSettings()
  const summary = summarizeMonth(bills, settings, monthDate)
  if (summary.bills.length === 0) return null

  const now = options.now ?? new Date()
  const preview = previewSettlement(summary, settings, monthDate)
  const record: SettlementRecord = {
    id: crypto.randomUUID(),
    monthKey,
    monthLabel: summary.monthLabel,
    budget: settings.monthlyBudget,
    spent: summary.spent,
    saved: preview.saved,
    goal: settings.savingsGoal,
    hp: summary.hp,
    isOverspent: summary.isOverspent,
    hasEgg: preview.hasEgg,
    noEggReason: preview.noEggReason,
    calculation: preview.calculation,
    eggId: null,
    settledAt: now.toISOString(),
    demo: options.demo === true,
  }

  if (preview.calculation) {
    const egg = createEgg(
      record.id,
      monthKey,
      summary.monthLabel,
      preview.calculation,
      now,
    )
    record.eggId = egg.id
    saveEggs([egg, ...loadEggs()])
  }

  saveSettlements([...loadSettlements(), record])
  return record
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

function loadOwnedSpiritIds(): Set<string> {
  const raw = readJSON<unknown>(SUMMON_KEY, {})
  if (!isRecord(raw) || !isRecord(raw.owned)) return new Set()
  return new Set(Object.keys(raw.owned))
}

function addOwnedSpirit(spiritId: string): void {
  const raw = readJSON<unknown>(SUMMON_KEY, {})
  const state = isRecord(raw) ? { ...raw } : {}
  const owned = isRecord(state.owned) ? { ...state.owned } : {}
  if (owned[spiritId]) return
  owned[spiritId] = { count: 1 }
  state.owned = owned
  writeJSON(SUMMON_KEY, state)
}

function hatchSpirit(egg: EggRecord): { spirit: Spirit; isNew: boolean } {
  const wantRare = Math.random() < egg.rareChance
  const wantedRarity: Rarity = wantRare ? 'rare' : 'normal'
  const rarityPool = CATALOG.filter((spirit) => spirit.rarity === wantedRarity)
  const pool =
    rarityPool.length > 0 ? rarityPool : CATALOG.filter((spirit) => spirit.rarity === 'normal')
  const owned = loadOwnedSpiritIds()
  const fresh = pool.filter((spirit) => !owned.has(spirit.id))
  const candidates = fresh.length > 0 ? fresh : pool
  const spirit = candidates[Math.floor(Math.random() * candidates.length)] ?? CATALOG[0]
  const isNew = !owned.has(spirit.id)
  if (isNew) addOwnedSpirit(spirit.id)
  return { spirit, isNew }
}

function performHatch(egg: EggRecord, now: Date): HatchResult {
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
      updated = performHatch(updated, now).egg
      changed = true
    }
    return updated
  })

  if (changed) saveEggs(next)
  return next
}

export function demoHatch(eggId: string, now = new Date()): HatchResult | null {
  const eggs = loadEggs()
  const index = eggs.findIndex((egg) => egg.id === eggId)
  if (index < 0 || eggs[index].hatched) return null

  const result = performHatch(eggs[index], now)
  eggs[index] = result.egg
  saveEggs(eggs)
  return result
}

export function getCurrentPreview(summary: MonthSummary, settings: IslandSettings): EggPreview {
  return previewSettlement(summary, settings)
}
