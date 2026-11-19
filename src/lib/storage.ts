import { DEFAULT_BUDGETS } from './budget'
import type { EggState, IslandState } from '../types'

export const STORAGE_PREFIX = 'money-island:'
export const STORAGE_ERROR_EVENT = 'money-island:storage-error'
export const STATE_KEY = 'money-island:v1'
export const WISHES_KEY = 'wishes-v2'

export class StorageWriteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageWriteError'
  }
}

function getStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function notifyWriteFailure(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(STORAGE_ERROR_EVENT, {
      detail: {
        message: '本地存储写入失败，可能是容量已满或浏览器禁用了存储。请清理浏览器空间后重试。',
      },
    }),
  )
}

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = getStorage()?.getItem(STORAGE_PREFIX + key)
    return raw == null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function readArray<T>(key: string): T[] {
  const value = readJSON<unknown>(key, [])
  return Array.isArray(value) ? (value as T[]) : []
}

export function writeJSON<T>(key: string, value: T): void {
  const storage = getStorage()
  if (!storage) {
    notifyWriteFailure()
    throw new StorageWriteError('本地存储不可用')
  }

  try {
    storage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
  } catch {
    notifyWriteFailure()
    throw new StorageWriteError('本地存储写入失败')
  }
}

function emptyEggState(): EggState {
  return {
    cycleStart: '',
    score: 0,
    dailyScores: {},
    tier: null,
    hatched: false,
    hatchedSpiritId: null,
    skippedTower: false,
  }
}

export function createEmptyState(): IslandState {
  return {
    version: 2,
    seededAt: null,
    transactions: [],
    spirits: {},
    egg: emptyEggState(),
    budgets: { ...DEFAULT_BUDGETS },
    tower: { played: false, won: null, islandHp: 100, skipped: false },
    farm: { plots: [{ seed: null, days: 0 }, { seed: null, days: 0 }, { seed: null, days: 0 }] },
    settings: { wishPoolEnabled: true },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeState(value: unknown): IslandState {
  const base = createEmptyState()
  if (!isRecord(value)) return base

  const budgets = isRecord(value.budgets) ? value.budgets : {}
  const tower = isRecord(value.tower) ? value.tower : {}
  const settings = isRecord(value.settings) ? value.settings : {}
  const egg = isRecord(value.egg) ? value.egg : {}
  const farm = isRecord(value.farm) ? value.farm : {}

  return {
    version: 2,
    seededAt: typeof value.seededAt === 'string' ? value.seededAt : null,
    transactions: Array.isArray(value.transactions) ? (value.transactions as IslandState['transactions']) : [],
    spirits: isRecord(value.spirits) ? (value.spirits as IslandState['spirits']) : {},
    egg: {
      ...base.egg,
      ...(egg as Partial<EggState>),
      dailyScores: isRecord(egg.dailyScores)
        ? (egg.dailyScores as Record<string, number>)
        : base.egg.dailyScores,
    },
    budgets: {
      daily:
        typeof budgets.daily === 'number' && budgets.daily > 0 ? budgets.daily : base.budgets.daily,
      weekly:
        typeof budgets.weekly === 'number' && budgets.weekly > 0
          ? budgets.weekly
          : base.budgets.weekly,
    },
    tower: {
      played: tower.played === true,
      won: typeof tower.won === 'boolean' ? tower.won : null,
      islandHp:
        typeof tower.islandHp === 'number' && tower.islandHp >= 0 ? tower.islandHp : 100,
      skipped: tower.skipped === true,
    },
    farm: {
      plots: Array.isArray(farm.plots)
        ? (farm.plots as IslandState['farm']['plots']).slice(0, 3)
        : base.farm.plots,
    },
    settings: {
      wishPoolEnabled:
        typeof settings.wishPoolEnabled === 'boolean' ? settings.wishPoolEnabled : true,
    },
  }
}

export function loadState(): IslandState {
  const storage = getStorage()
  if (!storage) return createEmptyState()
  try {
    const raw = storage.getItem(STATE_KEY)
    return raw == null ? createEmptyState() : normalizeState(JSON.parse(raw))
  } catch {
    return createEmptyState()
  }
}

export function hasState(): boolean {
  return getStorage()?.getItem(STATE_KEY) != null
}

export function saveState(state: IslandState): void {
  const storage = getStorage()
  if (!storage) {
    notifyWriteFailure()
    throw new StorageWriteError('本地存储不可用')
  }
  try {
    storage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {
    notifyWriteFailure()
    throw new StorageWriteError('本地存储写入失败')
  }
}
