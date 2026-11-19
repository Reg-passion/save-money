import { CATALOG_TOTAL, SPIRIT_BY_ID, type Spirit } from '../data/catalog'
import { readJSON, writeJSON } from './storage'

const STORAGE_KEY = 'summon'

export interface SpiritCollectionSummary {
  owned: Record<string, { count: number }>
  evolved: Record<string, true>
  progress: number
  total: number
}

interface SpiritCollectionState extends SpiritCollectionSummary {
  raw: Record<string, unknown>
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

export function getOwnedSpiritIds(): Set<string> {
  return new Set(Object.keys(loadState().owned))
}

export function addSpiritToCollection(spiritId: string): boolean {
  const state = loadState()
  if (!SPIRIT_BY_ID[spiritId] || state.owned[spiritId]) return false

  const owned = { ...state.owned, [spiritId]: { count: 1 } }
  writeJSON(STORAGE_KEY, { ...state.raw, owned })
  return true
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
