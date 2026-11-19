import { beforeEach, describe, expect, it } from 'vitest'
import {
  backupFilename,
  createBackup,
  parseBackup,
  restoreBackup,
  serializeBackup,
} from './backup'
import { STORAGE_PREFIX, StorageWriteError } from './storage'

const FIXED_TIME = new Date('2026-11-19T10:20:30.000Z')

function seed() {
  window.localStorage.setItem(
    `${STORAGE_PREFIX}settings`,
    JSON.stringify({ islandName: '小满岛', monthlyBudgetCents: 150000, savingsGoalCents: 30000 }),
  )
  window.localStorage.setItem(
    `${STORAGE_PREFIX}bills`,
    JSON.stringify([
      { id: 'bill-1', amountCents: 1800 },
      { id: 'bill-2', amountCents: 2800 },
    ]),
  )
  window.localStorage.setItem(
    `${STORAGE_PREFIX}wishes`,
    JSON.stringify([{ id: 'wish-1', status: 'pending' }]),
  )
  window.localStorage.setItem(
    `${STORAGE_PREFIX}eggs`,
    JSON.stringify([{ id: 'egg-1' }]),
  )
  window.localStorage.setItem(
    `${STORAGE_PREFIX}settlements`,
    JSON.stringify([{ monthKey: '2026-10' }]),
  )
  window.localStorage.setItem(
    `${STORAGE_PREFIX}demo-eggs`,
    JSON.stringify([{ id: 'demo-egg-1' }]),
  )
  window.localStorage.setItem(
    `${STORAGE_PREFIX}demo-settlements`,
    JSON.stringify([{ monthKey: '2026-10', demo: true }]),
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('JSON 备份导出与解析', () => {
  it('只导出八个账本键，并生成可读预览', () => {
    seed()
    window.localStorage.setItem(`${STORAGE_PREFIX}unrelated`, '{"x":1}')

    const payload = createBackup(FIXED_TIME)
    expect(payload.app).toBe('money-island')
    expect(payload.version).toBe(1)
    expect(Object.keys(payload.data).sort()).toEqual(
      [
        'settings',
        'bills',
        'wishes',
        'eggs',
        'settlements',
        'demo-eggs',
        'demo-settlements',
      ].sort(),
    )

    const { preview } = parseBackup(serializeBackup(payload))
    expect(preview.islandName).toBe('小满岛')
    expect(preview.billCount).toBe(2)
    expect(preview.wishCount).toBe(1)
    expect(preview.eggCount).toBe(1)
    expect(preview.settlementCount).toBe(1)
    expect(preview.demoEggCount).toBe(1)
    expect(preview.demoSettlementCount).toBe(1)
    expect(preview.keyCount).toBe(7)
  })

  it('单条损坏的本地数据会被跳过，不影响其他键导出', () => {
    seed()
    window.localStorage.setItem(`${STORAGE_PREFIX}wishes`, '{broken')

    const payload = createBackup(FIXED_TIME)
    expect(payload.data.wishes).toBeUndefined()
    expect(payload.data.bills).toHaveLength(2)
  })

  it('首次使用尚未写入设定时，备份仍包含默认设定', () => {
    const payload = createBackup(FIXED_TIME)
    expect(payload.data.settings).toMatchObject({
      islandName: '钱钱岛',
      monthlyBudgetCents: 150000,
      savingsGoalCents: 30000,
    })
    expect(parseBackup(serializeBackup(payload)).preview.islandName).toBe('钱钱岛')
  })

  it('备份文件名和导出时间稳定', () => {
    expect(backupFilename(FIXED_TIME)).toBe('money-island-backup-2026-11-19.json')
    expect(createBackup(FIXED_TIME).exportedAt).toBe(FIXED_TIME.toISOString())
  })

  it('拒绝无效 JSON、错误应用版本和空数据', () => {
    expect(() => parseBackup('{oops')).toThrow('这个文件不是有效的 JSON。')
    expect(() => parseBackup(JSON.stringify({ app: 'other', version: 1, data: {} }))).toThrow(
      '不是钱钱岛的 v1 备份文件。',
    )
    expect(() => parseBackup(JSON.stringify({ app: 'money-island', version: 2, data: {} }))).toThrow(
      '不是钱钱岛的 v1 备份文件。',
    )
    expect(() =>
      parseBackup(JSON.stringify({ app: 'money-island', version: 1, data: { unknown: [] } })),
    ).toThrow('备份里没有可恢复的账本数据。')
  })

  it('忽略备份中的未知键', () => {
    const text = JSON.stringify({
      app: 'money-island',
      version: 1,
      exportedAt: FIXED_TIME.toISOString(),
      data: { bills: [], unknown: { secret: true } },
    })
    const { payload } = parseBackup(text)
    expect(payload.data).toEqual({ bills: [] })
  })
})

describe('JSON 备份恢复', () => {
  it('恢复时替换当前账本，包括清掉备份里没有的键', () => {
    seed()
    const backup = createBackup(FIXED_TIME)

    window.localStorage.setItem(`${STORAGE_PREFIX}settings`, JSON.stringify({ islandName: '改坏了' }))
    window.localStorage.setItem(`${STORAGE_PREFIX}bills`, JSON.stringify([]))
    window.localStorage.setItem(`${STORAGE_PREFIX}eggs`, JSON.stringify([]))
    window.localStorage.setItem(`${STORAGE_PREFIX}summon`, JSON.stringify([{ id: 'stale' }]))

    restoreBackup(backup)

    const settings = JSON.parse(window.localStorage.getItem(`${STORAGE_PREFIX}settings`) ?? '{}')
    expect(settings.islandName).toBe('小满岛')
    expect(JSON.parse(window.localStorage.getItem(`${STORAGE_PREFIX}bills`) ?? '[]')).toHaveLength(2)
    expect(JSON.parse(window.localStorage.getItem(`${STORAGE_PREFIX}eggs`) ?? '[]')).toHaveLength(1)
    expect(window.localStorage.getItem(`${STORAGE_PREFIX}summon`)).toBeNull()
  })

  it('覆盖中途写入失败时回滚原有数据并抛出存储错误', () => {
    seed()
    const previousSettings = window.localStorage.getItem(`${STORAGE_PREFIX}settings`)
    const previousBills = window.localStorage.getItem(`${STORAGE_PREFIX}bills`)
    const backup = createBackup(FIXED_TIME)

    const storage = window.localStorage
    const originalSetItem = storage.setItem.bind(storage)
    let writes = 0
    storage.setItem = (key: string, value: string) => {
      writes += 1
      if (writes === 2) throw new Error('Quota exceeded')
      originalSetItem(key, value)
    }

    try {
      expect(() => restoreBackup(backup)).toThrow(StorageWriteError)
    } finally {
      storage.setItem = originalSetItem
    }

    expect(window.localStorage.getItem(`${STORAGE_PREFIX}settings`)).toBe(previousSettings)
    expect(window.localStorage.getItem(`${STORAGE_PREFIX}bills`)).toBe(previousBills)
  })
})
