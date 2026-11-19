import { beforeEach, describe, expect, it } from 'vitest'
import { SPIRIT_BY_ID } from './catalog'
import { buildSeedData, ensureSeedData } from './seed'
import { addDays, startOfWeek, toDateKey } from '../lib/budget'
import { createBill, loadBills } from '../lib/island'
import { buildWeeklyReport } from '../lib/report'
import { DAILY_SUMMON_LIMIT, getSpiritCollectionSummary } from '../lib/summon'

const NOW = new Date(2026, 10, 19, 23, 0, 0)

beforeEach(() => {
  window.localStorage.clear()
})

describe('种子数据', () => {
  it('生成 120 笔近 30 天账单和 18/32 初始图鉴', () => {
    const seed = buildSeedData(NOW)
    expect(seed.bills).toHaveLength(120)
    expect(seed.spiritIds).toHaveLength(18)

    const rarityCounts = seed.spiritIds.reduce(
      (counts, id) => {
        const spirit = SPIRIT_BY_ID[id]
        if (spirit) counts[spirit.rarity] += 1
        return counts
      },
      { normal: 0, rare: 0, hidden: 0 },
    )
    expect(rarityCounts).toEqual({ normal: 14, rare: 4, hidden: 0 })
    expect(seed.spiritIds).not.toContain('milk-bobo')
    expect(seed.spiritIds).not.toContain('milk-pearl')
    expect(seed.spiritIds).not.toContain('takeout-rice')

    const todayKey = toDateKey(NOW)
    const todayBills = seed.bills.filter((bill) => toDateKey(bill.time) === todayKey)
    expect(todayBills).toHaveLength(3)
    expect(todayBills.reduce((sum, bill) => sum + bill.amountCents, 0)).toBe(4500)
  })

  it('演示周 11-09 至 11-15 得 80 分，金蛋', () => {
    const seed = buildSeedData(NOW)
    const previousMonday = addDays(startOfWeek(NOW), -7)
    const report = buildWeeklyReport(seed.state, previousMonday)
    expect(report.spentCents).toBe(30600)
    expect(report.score).toBe(80)
    expect(report.tier).toBe('gold')
    expect(report.rareChance).toBe(0.4)
  })

  it('首次打开写入种子，第二次打开不覆盖，新账单保留', () => {
    expect(ensureSeedData(NOW)).toBe(true)
    expect(loadBills()).toHaveLength(120)
    expect(getSpiritCollectionSummary().progress).toBe(18)

    const bill = createBill({
      amountCents: 1800,
      category: 'milk-tea',
      note: '',
      time: NOW.toISOString(),
    })
    expect(bill.spiritIsNew).toBe(true)
    expect(getSpiritCollectionSummary().progress).toBe(19)
    expect(loadBills()).toHaveLength(121)

    expect(ensureSeedData(NOW)).toBe(false)
    expect(loadBills()).toHaveLength(121)
    expect(getSpiritCollectionSummary().progress).toBe(19)
  })

  it('已有本地账本时不覆盖，只写入已初始化标记', () => {
    window.localStorage.setItem('money-island:bills', JSON.stringify([{ id: 'old' }]))
    expect(ensureSeedData(NOW)).toBe(false)
    expect(loadBills()).toHaveLength(0)
    expect(getSpiritCollectionSummary().progress).toBe(0)
  })

  it('种子日再记 6 笔，仍然只召唤 5 只', () => {
    ensureSeedData(NOW)
    for (let index = 0; index < 6; index += 1) {
      createBill({
        amountCents: 1800,
        category: 'milk-tea',
        note: '',
        time: NOW.toISOString(),
      })
    }
    const fresh = loadBills().filter((bill) => toDateKey(bill.time) === toDateKey(NOW))
    const summoned = fresh.filter((bill) => bill.summonOutcome === 'spirit')
    const energy = fresh.filter((bill) => bill.summonOutcome === 'energy')
    expect(summoned).toHaveLength(DAILY_SUMMON_LIMIT)
    expect(energy).toHaveLength(1)
  })
})