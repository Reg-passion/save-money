import { loadSettings } from './island'
import { StorageWriteError, STORAGE_PREFIX } from './storage'

export const BACKUP_KEYS = [
  'settings',
  'bills',
  'summon',
  'eggs',
  'settlements',
  'wishes',
  'demo-eggs',
  'demo-settlements',
] as const

export interface BackupPayload {
  app: 'money-island'
  version: 1
  exportedAt: string
  data: Partial<Record<(typeof BACKUP_KEYS)[number], unknown>>
}

export interface BackupPreview {
  exportedAt: string
  islandName: string
  keyCount: number
  billCount: number
  wishCount: number
  eggCount: number
  settlementCount: number
  demoEggCount: number
  demoSettlementCount: number
}

export interface ParsedBackup {
  payload: BackupPayload
  preview: BackupPreview
}

function getStorage(): Storage {
  try {
    const storage = window.localStorage
    if (!storage) throw new Error('missing')
    return storage
  } catch {
    throw new Error('浏览器存储不可用，无法读取或恢复备份。')
  }
}

function countArray(value: unknown): number {
  return Array.isArray(value) ? value.length : 0
}

function previewOf(payload: BackupPayload): BackupPreview {
  const settings = payload.data.settings
  const islandName =
    settings && typeof settings === 'object'
      ? String((settings as { islandName?: unknown }).islandName ?? '未命名小岛')
      : '未命名小岛'

  return {
    exportedAt: payload.exportedAt,
    islandName,
    keyCount: Object.keys(payload.data).length,
    billCount: countArray(payload.data.bills),
    wishCount: countArray(payload.data.wishes),
    eggCount: countArray(payload.data.eggs),
    settlementCount: countArray(payload.data.settlements),
    demoEggCount: countArray(payload.data['demo-eggs']),
    demoSettlementCount: countArray(payload.data['demo-settlements']),
  }
}

export function createBackup(now = new Date()): BackupPayload {
  const storage = getStorage()
  const data: BackupPayload['data'] = {}

  for (const key of BACKUP_KEYS) {
    const raw = storage.getItem(STORAGE_PREFIX + key)
    if (raw == null) continue
    try {
      data[key] = JSON.parse(raw) as unknown
    } catch {
      // 单条本地数据损坏时跳过它，其他数据仍然可以导出。
    }
  }

  // 默认设定从未写入过 localStorage 时也要进备份，否则恢复会把岛名和目标一起抹掉。
  if (data.settings == null) data.settings = loadSettings()

  return {
    app: 'money-island',
    version: 1,
    exportedAt: now.toISOString(),
    data,
  }
}

export function serializeBackup(payload: BackupPayload): string {
  return `${JSON.stringify(payload, null, 2)}\n`
}

export function backupFilename(now = new Date()): string {
  const stamp = now.toISOString().slice(0, 10)
  return `money-island-backup-${stamp}.json`
}

export function parseBackup(text: string): ParsedBackup {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('这个文件不是有效的 JSON。')
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('备份文件格式不正确。')
  }

  const record = parsed as Record<string, unknown>
  if (record.app !== 'money-island' || record.version !== 1) {
    throw new Error('不是钱钱岛的 v1 备份文件。')
  }
  if (!record.data || typeof record.data !== 'object' || Array.isArray(record.data)) {
    throw new Error('备份文件缺少数据内容。')
  }

  const rawData = record.data as Record<string, unknown>
  const data: BackupPayload['data'] = {}
  for (const key of BACKUP_KEYS) {
    if (Object.hasOwn(rawData, key)) {
      data[key] = rawData[key]
    }
  }
  if (Object.keys(data).length === 0) {
    throw new Error('备份里没有可恢复的账本数据。')
  }

  const payload: BackupPayload = {
    app: 'money-island',
    version: 1,
    exportedAt:
      typeof record.exportedAt === 'string' ? record.exportedAt : new Date(0).toISOString(),
    data,
  }

  return { payload, preview: previewOf(payload) }
}

/** 导入前先保存旧值；任一步失败都尽量回滚，避免只覆盖一半。 */
export function restoreBackup(payload: BackupPayload): void {
  const storage = getStorage()
  const previous = new Map<string, string | null>()

  for (const key of BACKUP_KEYS) {
    previous.set(key, storage.getItem(STORAGE_PREFIX + key))
  }

  try {
    for (const key of BACKUP_KEYS) {
      storage.removeItem(STORAGE_PREFIX + key)
    }
    for (const key of BACKUP_KEYS) {
      if (!Object.hasOwn(payload.data, key)) continue
      storage.setItem(STORAGE_PREFIX + key, JSON.stringify(payload.data[key]))
    }
  } catch {
    for (const [key, value] of previous) {
      try {
        if (value == null) {
          storage.removeItem(STORAGE_PREFIX + key)
        } else {
          storage.setItem(STORAGE_PREFIX + key, value)
        }
      } catch {
        // 回滚也失败时保留原始错误，提示用户刷新后再检查数据。
      }
    }
    throw new StorageWriteError('恢复备份失败，原有数据已尽量保留。请检查浏览器存储空间。')
  }
}
