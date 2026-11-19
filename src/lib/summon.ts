import {
  CATALOG_TOTAL,
  CATEGORY_SPIRITS,
  SPIRIT_BY_ID,
  type Spirit,
} from '../data/catalog'
import type {
  CategoryId,
  IslandState,
  SpiritRecord,
  SummonOutcome,
  Transaction,
} from '../types'
import { toDateKey } from './budget'
import { matchSpecialSpirit } from './monsters'
import { readJSON, writeJSON } from './storage'

const STORAGE_KEY = 'summon'

export const DAILY_SUMMON_LIMIT = 5

export interface SpiritCollectionSummary {
  owned: Record<string, { count: number }>
  evolved: Record<string, true>
  progress: number
  total: number
}

interface SpiritCollectionState extends SpiritCollectionSummary {
  raw: Record<string, unknown>
}

export interface SummonSource {
  id: string
  amountCents: number
  category: CategoryId
  note: string
  time: string
}

export interface SummonPrior extends SummonSource {
  summonedSpiritId?: string | null
  summonOutcome?: SummonOutcome | null
}

export interface SummonDecision {
  outcome: SummonOutcome
  spirit: Spirit | null
  isNew: boolean
  remaining: number
  reason: 'summoned' | 'evolved' | 'daily-limit'
  evolvedFrom?: string | null
}

export interface SpiritEncounter {
  spiritId: string
  isNew: boolean
  count: number
}

function loadState(): SpiritCollectionState {
  const raw = readJSON<Record<string, unknown>>(STORAGE_KEY, {})
  const owned: Record<string, { count: number }> = {}
  const evolved: Record<string, true> = {}

  if (raw.owned && typeof raw.owned === 'object') {
    for (const [id, value] of Object.entries(raw.owned as Record<string, unknown>)) {
      if (!SPIRIT_BY_ID[id] || !value || typeof value !== 'object') continue
      const count = Number((value as { count?: unknown }).count)
      owned[id] = { count: Number.isFinite(count) && count > 0 ? Math.floor(count) : 1 }
    }
  }

  if (raw.evolved && typeof raw.evolved === 'object') {
    for (const id of Object.keys(raw.evolved as Record<string, unknown>)) {
      if (SPIRIT_BY_ID[id]) evolved[id] = true
    }
  }

  return {
    owned,
    evolved,
    progress: Object.keys(owned).length,
    total: CATALOG_TOTAL,
    raw,
  }
}

export function getSpiritCollectionSummary(): SpiritCollectionSummary {
  const state = loadState()
  return {
    owned: state.owned,
    evolved: state.evolved,
    progress: state.progress,
    total: state.total,
  }
}

export function summarizeSpiritRecords(
  spirits: Record<string, SpiritRecord>,
): SpiritCollectionSummary {
  const owned: Record<string, { count: number }> = {}
  const evolved: Record<string, true> = {}
  for (const [id, record] of Object.entries(spirits)) {
    if (!SPIRIT_BY_ID[id] || !record || typeof record.count !== 'number') continue
    if (record.count <= 0) continue
    owned[id] = { count: Math.floor(record.count) }
    if (record.evolved) evolved[id] = true
  }
  return {
    owned,
    evolved,
    progress: Object.keys(owned).length,
    total: CATALOG_TOTAL,
  }
}

export function getStateSpiritCollectionSummary(
  state: IslandState,
): SpiritCollectionSummary {
  return summarizeSpiritRecords(state.spirits)
}

export function getOwnedSpiritIds(): Set<string> {
  return new Set(Object.keys(loadState().owned))
}

export function getSpiritCount(spiritId: string): number {
  return loadState().owned[spiritId]?.count ?? 0
}

export function recordSpiritEncounter(spiritId: string): SpiritEncounter | null {
  const spirit = SPIRIT_BY_ID[spiritId]
  if (!spirit) return null

  const state = loadState()
  const previous = state.owned[spiritId]
  const count = (previous?.count ?? 0) + 1
  const owned = { ...state.owned, [spiritId]: { count } }
  writeJSON(STORAGE_KEY, { ...state.raw, owned })
  return { spiritId, isNew: !previous, count }
}

export function addSpiritToCollection(spiritId: string): boolean {
  if (!SPIRIT_BY_ID[spiritId] || loadState().owned[spiritId]) return false
  return recordSpiritEncounter(spiritId)?.isNew ?? false
}

export function seedSpiritCollection(spiritIds: string[]): boolean {
  const state = loadState()
  if (state.progress > 0) return false

  const owned: Record<string, { count: number }> = {}
  for (const id of spiritIds) {
    if (SPIRIT_BY_ID[id]) owned[id] = { count: 1 }
  }
  if (Object.keys(owned).length === 0) return false

  writeJSON(STORAGE_KEY, { ...state.raw, owned })
  return true
}

export function getGuardian(excludeId?: string): Spirit | null {
  const state = loadState()
  const spirits: Spirit[] = []
  for (const id of Object.keys(state.owned)) {
    if (id === excludeId) continue
    const spirit = SPIRIT_BY_ID[id]
    if (spirit) spirits.push(spirit)
  }
  const rarityRank: Record<Spirit['rarity'], number> = { hidden: 0, rare: 1, normal: 2 }
  spirits.sort((a, b) => rarityRank[a.rarity] - rarityRank[b.rarity])
  return spirits[0] ?? null
}

function hashString(input: string): number {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function countSummonsForDate(
  bills: Array<{
    time: string
    summonOutcome?: SummonOutcome | null
  }>,
  date: string,
): number {
  return bills.filter(
    (bill) => bill.summonOutcome === 'spirit' && toDateKey(bill.time) === date,
  ).length
}

function chooseFromPool(
  pool: Spirit[],
  bill: SummonSource,
  priorBills: SummonPrior[],
  ownedIds: Set<string>,
): Spirit {
  const unowned = pool.filter((spirit) => !ownedIds.has(spirit.id))
  let candidates = unowned.length > 0 ? unowned : pool

  const day = toDateKey(bill.time)
  const usedToday = new Set(
    priorBills
      .filter(
        (prior) =>
          prior.id !== bill.id &&
          prior.category === bill.category &&
          toDateKey(prior.time) === day &&
          prior.summonOutcome === 'spirit' &&
          prior.summonedSpiritId,
      )
      .map((prior) => prior.summonedSpiritId as string),
  )
  const freshPool = candidates.filter((spirit) => !usedToday.has(spirit.id))
  if (freshPool.length > 0) candidates = freshPool

  const index = hashString(`${bill.id}:${bill.category}:summon`) % candidates.length
  return candidates[index]
}

function evolutionFor(
  spirit: Spirit,
  counts: Record<string, number>,
  ownedIds: Set<string>,
): Spirit | null {
  if (!spirit.evolvesTo || (counts[spirit.id] ?? 0) < 2) return null
  if (ownedIds.has(spirit.evolvesTo)) return null
  return SPIRIT_BY_ID[spirit.evolvesTo] ?? null
}

export function decideSummon(
  bill: SummonSource,
  priorBills: SummonPrior[] = [],
  ownedIds: Set<string> = getOwnedSpiritIds(),
  limit = DAILY_SUMMON_LIMIT,
  counts: Record<string, number> = {},
): SummonDecision {
  const usedToday = countSummonsForDate(priorBills, toDateKey(bill.time))
  if (usedToday >= limit) {
    return {
      outcome: 'energy',
      spirit: null,
      isNew: false,
      remaining: 0,
      reason: 'daily-limit',
    }
  }

  const family = CATEGORY_SPIRITS[bill.category]
  let spirit = matchSpecialSpirit(bill)

  if (!spirit) {
    const priorInCategory = priorBills.filter(
      (prior) => prior.id !== bill.id && prior.category === bill.category,
    )

    if (priorInCategory.length === 0) {
      const primary =
        family.find((item) => item.primary && item.rarity === 'normal') ??
        family.find((item) => item.rarity === 'normal')
      const normalPool = family.filter((item) => item.rarity === 'normal')
      const pool = primary && !ownedIds.has(primary.id) ? [primary] : normalPool
      spirit = chooseFromPool(pool, bill, priorBills, ownedIds)
    } else {
      const roll = (hashString(`${bill.id}:${bill.category}:roll`) % 1000) / 1000
      const wantRare =
        bill.amountCents >= 3000 ? roll < 0.35 : bill.amountCents >= 1000 ? roll < 0.15 : false
      const rarityPool = family.filter((item) =>
        wantRare ? item.rarity === 'rare' : item.rarity === 'normal',
      )
      const pool =
        rarityPool.length > 0 ? rarityPool : family.filter((item) => item.rarity === 'normal')
      spirit = chooseFromPool(pool, bill, priorBills, ownedIds)
    }
  }

  const evolved = evolutionFor(spirit, counts, ownedIds)
  return {
    outcome: 'spirit',
    spirit: evolved ?? spirit,
    isNew: evolved ? true : !ownedIds.has(spirit.id),
    remaining: Math.max(0, limit - usedToday - 1),
    reason: evolved ? 'evolved' : 'summoned',
    evolvedFrom: evolved ? spirit.id : null,
  }
}

export function applySummonDecision(
  spirits: Record<string, SpiritRecord>,
  decision: SummonDecision,
  now = new Date(),
): Record<string, SpiritRecord> {
  if (!decision.spirit) return spirits
  const next = { ...spirits }
  if (decision.evolvedFrom) {
    const base = next[decision.evolvedFrom]
    if (base) next[decision.evolvedFrom] = { ...base, evolved: true }
  }
  const previous = next[decision.spirit.id]
  return {
    ...next,
    [decision.spirit.id]: {
      count: (previous?.count ?? 0) + 1,
      evolved: previous?.evolved ?? false,
      firstSeenAt: previous?.firstSeenAt ?? now.toISOString(),
    },
  }
}

export function pickSummon(
  state: IslandState,
  transaction: Transaction,
): { spiritId: string | null; isNew: boolean; spirits: Record<string, SpiritRecord> } {
  const prior: SummonPrior[] = state.transactions
    .filter((item) => item.id !== transaction.id)
    .map((item) => ({
      id: item.id,
      amountCents: item.amountCents,
      category: item.category,
      note: item.note,
      time: item.time,
      summonedSpiritId: item.spiritId,
      summonOutcome: item.summonOutcome,
    }))
  const decision = decideSummon(
    {
      id: transaction.id,
      amountCents: transaction.amountCents,
      category: transaction.category,
      note: transaction.note,
      time: transaction.time,
    },
    prior,
    new Set(Object.keys(state.spirits)),
    DAILY_SUMMON_LIMIT,
    Object.fromEntries(
      Object.entries(state.spirits).map(([id, record]) => [id, record.count]),
    ),
  )
  return {
    spiritId: decision.spirit?.id ?? null,
    isNew: decision.isNew,
    spirits: applySummonDecision(state.spirits, decision),
  }
}