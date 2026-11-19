import { beforeEach, describe, expect, it } from 'vitest'
import { SPIRIT_BY_ID } from '../data/catalog'
import {
  calculateEgg,
  getEggTier,
  getMonthKey,
  hatchDemoEgg,
  loadDemoEggs,
  loadDemoSettlements,
  loadEggs,
  loadSettlements,
  previewSettlement,
  resetDemoMonth,
  settleDemoMonth,
  settleMonth,
  syncEggHatch,
} from './egg'
import { recordExpense } from './expense'
import {
  createBill,
  damageForSpentCents,
  loadBills,
  summarizeMonth,
  type Bill,
  type IslandSettings,
} from './island'
import { parseYuanToCents } from './money'
import { pickMonsterForBill } from './monsters'
import { getSpiritCollectionSummary } from './summon'
import { cancelWish, confirmWish, loadWishes } from './wish'

const SETTINGS: IslandSettings = {
  islandName: '测试岛',
  monthlyBudgetCents: 150000,
  savingsGoalCents: 30000,
}

const DAY_MS = 24 * 60 * 60 * 1000

function testBill(id: string, amountCents: number, day = 5, hour = 12): Bill {
  const now = new Date()
  return {
    id,
    amountCents,
    category: 'takeout',
    note: '',
    time: new Date(now.getFullYear(), now.getMonth(), day, hour).toISOString(),
    monsterId: 'takeout-small',
    source: 'manual',
  }
}

function at(day: number, hour = 12): Date {
  return new Date(2026, 0, day, hour, 0, 0)
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('金额与岛血', () => {
  it('整数分解析，最多两位小数', () => {
    expect(parseYuanToCents('18')).toBe(1800)
    expect(parseYuanToCents('128.5')).toBe(12850)
    expect(parseYuanToCents('0.01')).toBe(1)
    expect(parseYuanToCents('1.234')).toBeNull()
    expect(parseYuanToCents('0')).toBeNull()
  })

  it('本月花 1180 元、预算 1500 元 → 伤害 79、岛血 21', () => {
    const bills = [
      testBill('a', 30000, 2),
      testBill('b', 30000, 3),
      testBill('c', 30000, 4),
      testBill('d', 28000, 5),
    ]
    const summary = summarizeMonth(bills, SETTINGS)
    expect(summary.spentCents).toBe(118000)
    expect(summary.damage).toBe(79)
    expect(summary.hp).toBe(21)
    expect(summary.budgetCents).toBe(150000)
    expect(summary.remainingCents).toBe(32000)
  })

  it('同样的总支出拆成不同笔数，最终岛血一致', () => {
    const single = summarizeMonth([testBill('one', 118000)], SETTINGS)
    const many = summarizeMonth(
      Array.from({ length: 7 }, (_, index) =>
        testBill(`split-${index}`, index === 6 ? 16858 : 16857, 2 + index),
      ),
      SETTINGS,
    )
    expect(single.spentCents).toBe(118000)
    expect(many.spentCents).toBe(118000)
    expect(many.damage).toBe(single.damage)
    expect(many.hp).toBe(single.hp)
  })

  it('删改历史账单后按累计重算，不读旧的 hpCost', () => {
    const bills = [testBill('a', 6000, 2), testBill('b', 6000, 3), testBill('c', 6000, 4)]
    const before = summarizeMonth(bills, SETTINGS)
    expect(before.damage).toBe(12)
    expect(Object.values(before.billDamages).reduce((sum, value) => sum + value, 0)).toBe(12)

    const after = summarizeMonth(
      bills.filter((bill) => bill.id !== 'b'),
      SETTINGS,
    )
    expect(after.damage).toBe(8)
    expect(after.hp).toBe(92)
    expect(after.billDamages.a + after.billDamages.c).toBe(8)
  })

  it('旧账单里的 hpCost 字段被忽略，只按金额重算', () => {
    const legacyTime = new Date().toISOString()
    window.localStorage.setItem(
      'money-island:bills',
      JSON.stringify([
        {
          id: 'legacy',
          amount: 60,
          hpCost: 99,
          category: 'takeout',
          note: '',
          time: legacyTime,
        },
      ]),
    )
    const bills = loadBills()
    expect(bills).toHaveLength(1)
    expect(bills[0].amountCents).toBe(6000)
    expect('hpCost' in bills[0]).toBe(false)

    const summary = summarizeMonth(bills, SETTINGS)
    expect(summary.damage).toBe(4)
    expect(summary.hp).toBe(96)
  })

  it('超预算时岛血归零', () => {
    const summary = summarizeMonth([testBill('over', 160000)], SETTINGS)
    expect(summary.isOverspent).toBe(true)
    expect(summary.hp).toBe(0)
    expect(summary.damage).toBe(107)
    expect(damageForSpentCents(0)).toBe(0)
  })
})

describe('记账召唤与每日上限', () => {
  it('账单按分类召唤精灵，第一笔立刻写入图鉴', () => {
    const bill = createBill({
      amountCents: 1800,
      category: 'milk-tea',
      note: '',
      time: new Date().toISOString(),
    })
    expect(SPIRIT_BY_ID[bill.monsterId]).toBeTruthy()
    expect(bill.source).toBe('manual')
    expect(bill.summonOutcome).toBe('spirit')
    expect(bill.spiritIsNew).toBe(true)
    expect(bill.summonedSpiritId).toBe(bill.monsterId)
    expect(getSpiritCollectionSummary().progress).toBe(1)
    expect(loadBills()).toHaveLength(1)
  })

  it('第一次记外卖必出新精灵', () => {
    const bill = createBill({
      amountCents: 2300,
      category: 'takeout',
      note: '',
      time: new Date().toISOString(),
    })
    const spirit = bill.summonedSpiritId ? SPIRIT_BY_ID[bill.summonedSpiritId] : null
    expect(spirit?.category).toBe('takeout')
    expect(bill.spiritIsNew).toBe(true)
    expect(getSpiritCollectionSummary().progress).toBe(1)
  })

  it('同分类第一笔是主怪，大额账单直接引 Boss，选择结果可复现', () => {
    const time = new Date().toISOString()
    const first = pickMonsterForBill({
      id: 'first',
      amountCents: 1800,
      category: 'takeout',
      note: '',
      time,
    })
    expect(first.primary).toBe(true)

    const large = {
      id: 'large',
      amountCents: 12800,
      category: 'takeout' as const,
      note: '',
      time,
    }
    const boss = pickMonsterForBill(large, [])
    expect(boss.stage).toBe(3)
    expect(pickMonsterForBill(large, []).id).toBe(boss.id)
  })

  it('一天记 6 笔，第 6 笔只加岛屿能量，不出新精灵', () => {
    const time = new Date().toISOString()
    for (let index = 0; index < 6; index += 1) {
      createBill({
        amountCents: 1800,
        category: 'milk-tea',
        note: `第 ${index + 1} 杯`,
        time,
      })
    }
    const bills = loadBills()
    expect(bills).toHaveLength(6)
    expect(summarizeMonth(bills, SETTINGS).spentCents).toBe(10800)
    expect(bills.filter((bill) => bill.summonOutcome === 'spirit')).toHaveLength(5)
    expect(bills.filter((bill) => bill.summonOutcome === 'energy')).toHaveLength(1)
    const progress = getSpiritCollectionSummary().progress
    expect(progress).toBeGreaterThan(0)
    expect(progress).toBeLessThanOrEqual(5)
  })
})

describe('许愿池', () => {
  it('计划购买 128 元先入许愿池，24 小时后确认才成为正式账单', () => {
    const now = at(10)
    const outcome = recordExpense(
      { amountCents: 12800, category: 'fun', note: '想买耳机', time: now.toISOString() },
      { planned: true, now },
    )
    expect(outcome.kind).toBe('wish')
    expect(loadBills()).toHaveLength(0)
    expect(loadWishes()[0].status).toBe('pending')
    expect(loadWishes()[0].readyAt).toBe(new Date(now.getTime() + DAY_MS).toISOString())

    const wishId = outcome.kind === 'wish' ? outcome.wish.id : ''
    expect(() => confirmWish(wishId, { now })).toThrow('冷静期')

    const confirmed = confirmWish(wishId, { now: new Date(now.getTime() + DAY_MS + 1) })
    expect(confirmed.bill.amountCents).toBe(12800)
    expect(confirmed.bill.source).toBe('wish')
    expect(confirmed.bill.sourceWishId).toBe(wishId)
    expect(confirmed.bill.summonedSpiritId).toBe(confirmed.bill.monsterId)
    expect(SPIRIT_BY_ID[confirmed.bill.monsterId]).toBeTruthy()
    expect(getSpiritCollectionSummary().progress).toBe(1)
    expect(loadWishes()[0].status).toBe('confirmed')
    expect(loadWishes()[0].billId).toBe(confirmed.bill.id)
    expect(
      summarizeMonth(loadBills(), SETTINGS, new Date(now.getTime() + DAY_MS + 1)).spentCents,
    ).toBe(12800)
  })

  it('计划购买不足 100 元也先入许愿池，确认后生成普通怪物', () => {
    const now = at(10)
    const outcome = recordExpense(
      { amountCents: 3500, category: 'fun', note: '想买游戏', time: now.toISOString() },
      { planned: true, now },
    )
    expect(outcome.kind).toBe('wish')
    expect(loadBills()).toHaveLength(0)

    const wishId = outcome.kind === 'wish' ? outcome.wish.id : ''
    const confirmed = confirmWish(wishId, { now: new Date(now.getTime() + DAY_MS + 1) })
    expect(confirmed.bill.amountCents).toBe(3500)
    expect(confirmed.bill.source).toBe('wish')
    expect(SPIRIT_BY_ID[confirmed.bill.monsterId].stage).toBeLessThan(3)
  })

  it('已发生的大额消费立即记账，不进许愿池', () => {
    const now = at(10)
    const outcome = recordExpense(
      { amountCents: 12800, category: 'takeout', note: '火锅', time: now.toISOString() },
      { now },
    )
    expect(outcome.kind).toBe('bill')
    expect(loadWishes()).toHaveLength(0)
    expect(loadBills()).toHaveLength(1)
  })

  it('导入的历史消费绕过冷静期', () => {
    const now = at(10)
    const outcome = recordExpense(
      { amountCents: 12800, category: 'daily', note: '补录', time: now.toISOString() },
      { imported: true, planned: true, now },
    )
    expect(outcome.kind).toBe('bill')
    expect(outcome.kind === 'bill' && outcome.bill.source).toBe('import')
    expect(loadWishes()).toHaveLength(0)
  })

  it('冷静期内的愿望可以取消，取消后不能确认', () => {
    const now = at(10)
    const outcome = recordExpense(
      { amountCents: 12800, category: 'study', note: '', time: now.toISOString() },
      { planned: true, now },
    )
    const wishId = outcome.kind === 'wish' ? outcome.wish.id : ''
    cancelWish(wishId, now)
    expect(loadWishes()[0].status).toBe('cancelled')
    expect(() => confirmWish(wishId, { now: new Date(now.getTime() + DAY_MS + 1) })).toThrow(
      '取消',
    )
    expect(loadBills()).toHaveLength(0)
  })
})

describe('结算与孵化', () => {
  it('目标 300、实省 320 → 金蛋 40% + 2% = 42%', () => {
    const calculation = calculateEgg(32000, 30000)
    expect(calculation.tier).toBe('gold')
    expect(calculation.extraSavedCents).toBe(2000)
    expect(calculation.baseRate).toBe(0.4)
    expect(calculation.bonusRate).toBe(0.02)
    expect(calculation.rareChance).toBe(0.42)
    expect(getEggTier(30000)).toBe('silver')
    expect(getEggTier(30001)).toBe('gold')
    expect(getEggTier(10000)).toBe('silver')
    expect(getEggTier(9999)).toBe('normal')
  })

  it('超支没有蛋', () => {
    const summary = summarizeMonth([testBill('over', 160000)], SETTINGS)
    const preview = previewSettlement(summary, SETTINGS)
    expect(preview.hasEgg).toBe(false)
    expect(preview.noEggReason).toBe('overspent')
  })

  it('演示结算独立存储，不锁定正式结算，可重置', () => {
    const now = at(10)
    createBill({ amountCents: 50000, category: 'takeout', note: '', time: now.toISOString() })
    const bills = loadBills()

    const demo = settleDemoMonth(now, { bills, settings: SETTINGS, now })
    expect(demo?.demo).toBe(true)
    expect(loadSettlements()).toHaveLength(0)
    expect(loadDemoSettlements()).toHaveLength(1)
    expect(loadDemoEggs()).toHaveLength(1)

    const formal = settleMonth(now, { bills, settings: SETTINGS, now })
    expect(formal?.demo).toBe(false)
    expect(loadSettlements()).toHaveLength(1)
    expect(loadEggs()).toHaveLength(1)

    expect(resetDemoMonth(getMonthKey(now))).toBe(true)
    expect(loadDemoSettlements()).toHaveLength(0)
    expect(loadDemoEggs()).toHaveLength(0)
    expect(loadSettlements()).toHaveLength(1)
    expect(loadEggs()).toHaveLength(1)
  })

  it('正式蛋记满 3 个自然日孵化，重复刷新不重掷、不重复入图鉴', () => {
    const now = at(10)
    createBill({ amountCents: 50000, category: 'takeout', note: '', time: now.toISOString() })
    const record = settleMonth(now, { bills: loadBills(), settings: SETTINGS, now })
    const eggId = record?.eggId ?? ''
    expect(eggId).not.toBe('')

    for (let day = 1; day <= 3; day += 1) {
      createBill({
        amountCents: 100,
        category: 'daily',
        note: '',
        time: new Date(now.getTime() + day * DAY_MS).toISOString(),
      })
    }

    const first = syncEggHatch(new Date(now.getTime() + 4 * DAY_MS)).find(
      (egg) => egg.id === eggId,
    )
    expect(first?.hatched).toBe(true)
    const progressAfterHatch = getSpiritCollectionSummary().progress
    expect(progressAfterHatch).toBeGreaterThanOrEqual(1)

    const spiritId = first?.spiritId
    const second = syncEggHatch(new Date(now.getTime() + 5 * DAY_MS)).find(
      (egg) => egg.id === eggId,
    )
    expect(second?.spiritId).toBe(spiritId)
    expect(getSpiritCollectionSummary().progress).toBe(progressAfterHatch)
  })

  it('演示孵化不写入正式图鉴', () => {
    const now = at(10)
    createBill({ amountCents: 50000, category: 'fun', note: '', time: now.toISOString() })
    settleDemoMonth(now, { bills: loadBills(), settings: SETTINGS, now })
    const demoEgg = loadDemoEggs()[0]
    expect(demoEgg).toBeTruthy()
    const progressBefore = getSpiritCollectionSummary().progress

    const result = hatchDemoEgg(demoEgg.id, new Date(now.getTime() + DAY_MS))
    expect(result).not.toBeNull()
    expect(getSpiritCollectionSummary().progress).toBe(progressBefore)
    expect(loadEggs()).toHaveLength(0)
  })
})
