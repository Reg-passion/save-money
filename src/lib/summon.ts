import { CATALOG_TOTAL, CATEGORY_SPIRITS, SPIRIT_BY_ID, type Spirit } from '../data/catalog'
import { loadBills, type Bill } from './island'
import { readJSON, writeJSON } from './storage'

export const DAILY_SUMMON_LIMIT = 5

const STORAGE_KEY = 'summon'
// spec 只给了金额档位，没给具体概率；两个常量集中在这里，方便后续调整。
const RARE_CHANCE_MID = 0.15
const RARE_CHANCE_HIGH = 0.35
const EVOLVE_AT = 3

export type SummonKind = 'new' | 'duplicate' | 'evolve' | 'energy' | 'wish'

export interface SummonResult {
  kind: SummonKind
  spirit: Spirit | null
  evolvedTo?: Spirit
  count?: number
  energy: number
  energyGained: number
  progress: number
  todayCount: number
  dailyLimit: number
}

export interface SummonSummary {
  owned: Record<string, { count: number }>
  evolved: Record<string, true>
  progress: number
  total: number
  energy: number
  todayCount: number
  dailyLimit: number
}

interface SummonState extends SummonSummary {
  daily: Record<string, number>
  lastPick: Record<string, string>
}

function emptyState(): SummonState {
  return {
    owned: {},
    evolved: {},
    progress: 0,
    total: CATALOG_TOTAL,
    energy: 0,
    todayCount: 0,
    dailyLimit: DAILY_SUMMON_LIMIT,
    daily: {},
    lastPick: {},
  }
}

function loadState(): SummonState {
  const raw = readJSON<Record<string, unknown>>(STORAGE_KEY, {})
  const state = emptyState()

  if (raw.owned && typeof raw.owned === 'object') {
    for (const [id, value] of Object.entries(raw.owned as Record<string, unknown>)) {
      if (!SPIRIT_BY_ID[id] || !value || typeof value !== 'object') continue
      const count = Number((value as { count?: unknown }).count)
      state.owned[id] = { count: Number.isFinite(count) && count > 0 ? Math.floor(count) : 1 }
    }
  }

  if (raw.evolved && typeof raw.evolved === 'object') {
    for (const id of Object.keys(raw.evolved as Record<string, unknown>)) {
      if (SPIRIT_BY_ID[id]) state.evolved[id] = true
    }
  }

  if (raw.daily && typeof raw.daily === 'object') {
    for (const [day, value] of Object.entries(raw.daily as Record<string, unknown>)) {
      const count = Number(value)
      if (Number.isFinite(count) && count >= 0) state.daily[day] = Math.floor(count)
    }
  }

  if (raw.lastPick && typeof raw.lastPick === 'object') {
    for (const [key, value] of Object.entries(raw.lastPick as Record<string, unknown>)) {
      if (typeof value === 'string' && SPIRIT_BY_ID[value]) state.lastPick[key] = value
    }
  }

  const energy = Number(raw.energy)
  state.energy = Number.isFinite(energy) && energy > 0 ? Math.floor(energy) : 0
  state.progress = Object.keys(state.owned).length
  state.todayCount = state.daily[localDayKey(new Date())] ?? 0
  return state
}

function saveState(state: SummonState) {
  writeJSON<SummonState>(STORAGE_KEY, state)
}

function localDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function hashString(input: string): number {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function pickSpirit(pool: Spirit[], bill: Bill, state: SummonState, today: string): Spirit {
  const key = `${today}:${bill.category}`
  const last = state.lastPick[key]
  const withoutLast = pool.length > 1 ? pool.filter((spirit) => spirit.id !== last) : pool
  const list = withoutLast.length > 0 ? withoutLast : pool
  const index = hashString(`${bill.id}:${bill.category}:${today}`) % list.length
  return list[index]
}

function matchSpecial(bill: Bill): Spirit | null {
  const note = bill.note.trim()
  const hour = new Date(bill.time).getHours()

  if (
    bill.category === 'milk-tea' &&
    bill.amount >= 15 &&
    bill.amount <= 25 &&
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
    bill.amount >= 20 &&
    note.includes('黄焖鸡')
  ) {
    return SPIRIT_BY_ID['takeout-boss'] ?? null
  }
  if (bill.category === 'delivery' && bill.amount >= 15 && note.includes('退货')) {
    return SPIRIT_BY_ID['delivery-king'] ?? null
  }
  return null
}

function resolveSpirit(
  bill: Bill,
  priorInCategory: Bill[],
  state: SummonState,
  today: string,
): Spirit {
  const special = matchSpecial(bill)
  if (special) return special

  if (priorInCategory.length === 0) {
    const normals = CATEGORY_SPIRITS[bill.category].filter(
      (spirit) => spirit.rarity === 'normal',
    )
    const fresh =
      normals.find((spirit) => spirit.primary && !state.owned[spirit.id]) ??
      normals.find((spirit) => !state.owned[spirit.id])
    if (fresh) return fresh
  }

  if (priorInCategory.length + 1 >= 2) {
    const currentCount = priorInCategory.length + 1
    const billsLeft = Math.max(0, 5 - currentCount)
    const missing = CATEGORY_SPIRITS[bill.category].filter(
      (spirit) => spirit.rarity === 'normal' && !state.owned[spirit.id],
    )
    if (missing.length > 0 && billsLeft <= missing.length) {
      return pickSpirit(missing, bill, state, today)
    }
  }

  const roll = (hashString(`${bill.id}:roll:${today}`) % 1000) / 1000
  const wantRare =
    bill.amount >= 30
      ? roll < RARE_CHANCE_HIGH
      : bill.amount >= 10
        ? roll < RARE_CHANCE_MID
        : false
  const pool = CATEGORY_SPIRITS[bill.category].filter((spirit) =>
    wantRare ? spirit.rarity === 'rare' : spirit.rarity === 'normal',
  )
  if (pool.length > 0) return pickSpirit(pool, bill, state, today)

  return pickSpirit(
    CATEGORY_SPIRITS[bill.category].filter((spirit) => spirit.rarity === 'normal'),
    bill,
    state,
    today,
  )
}

function grantSpirit(
  state: SummonState,
  spirit: Spirit,
): { kind: 'new' | 'duplicate' | 'evolve'; count: number; evolvedTo?: Spirit } {
  const existing = state.owned[spirit.id]
  if (!existing) {
    state.owned[spirit.id] = { count: 1 }
    return { kind: 'new', count: 1 }
  }

  existing.count += 1
  if (existing.count >= EVOLVE_AT && spirit.evolvesTo && !state.evolved[spirit.id]) {
    const target = SPIRIT_BY_ID[spirit.evolvesTo]
    if (target) {
      const targetEntry = state.owned[target.id]
      if (targetEntry) targetEntry.count += 1
      else state.owned[target.id] = { count: 1 }
      state.evolved[spirit.id] = true
      return { kind: 'evolve', count: existing.count, evolvedTo: target }
    }
  }

  return { kind: 'duplicate', count: existing.count }
}

export function summonForBill(bill: Bill): SummonResult {
  const state = loadState()
  const today = localDayKey(new Date())
  const usedToday = state.daily[today] ?? 0

  if (usedToday >= DAILY_SUMMON_LIMIT) {
    state.energy += 1
    saveState(state)
    return {
      kind: 'energy',
      spirit: null,
      energy: state.energy,
      energyGained: 1,
      progress: Object.keys(state.owned).length,
      todayCount: usedToday,
      dailyLimit: DAILY_SUMMON_LIMIT,
    }
  }

  if (bill.amount >= 100) {
    return {
      kind: 'wish',
      spirit: null,
      energy: state.energy,
      energyGained: 0,
      progress: Object.keys(state.owned).length,
      todayCount: usedToday,
      dailyLimit: DAILY_SUMMON_LIMIT,
    }
  }

  const prior = loadBills().filter((item) => item.id !== bill.id)
  const priorInCategory = prior.filter((item) => item.category === bill.category)
  const spirit = resolveSpirit(bill, priorInCategory, state, today)
  const outcome = grantSpirit(state, spirit)

  state.daily[today] = usedToday + 1
  state.lastPick[`${today}:${bill.category}`] = spirit.id
  saveState(state)

  return {
    kind: outcome.kind,
    spirit,
    evolvedTo: outcome.evolvedTo,
    count: outcome.count,
    energy: state.energy,
    energyGained: 0,
    progress: Object.keys(state.owned).length,
    todayCount: usedToday + 1,
    dailyLimit: DAILY_SUMMON_LIMIT,
  }
}

export function getSummonSummary(): SummonSummary {
  const state = loadState()
  return {
    owned: state.owned,
    evolved: state.evolved,
    progress: Object.keys(state.owned).length,
    total: CATALOG_TOTAL,
    energy: state.energy,
    todayCount: state.daily[localDayKey(new Date())] ?? 0,
    dailyLimit: DAILY_SUMMON_LIMIT,
  }
}

const RARITY_RANK: Record<Spirit['rarity'], number> = { hidden: 0, rare: 1, normal: 2 }

export function getGuardian(excludeId?: string): Spirit | null {
  const state = loadState()
  const spirits: Spirit[] = []
  for (const id of Object.keys(state.owned)) {
    if (id === excludeId) continue
    const spirit = SPIRIT_BY_ID[id]
    if (spirit) spirits.push(spirit)
  }
  spirits.sort((a, b) => RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity])
  return spirits[0] ?? null
}
