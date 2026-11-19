import { describe, expect, it } from 'vitest'
import type { IslandSettings, MonthSummary } from './island'
import {
  BUILDING_THRESHOLDS,
  getAutoDayNight,
  getBuildingVisibility,
  getProgressPercent,
  getSavingsProgress,
  getSkyGradient,
  getUnlockedBuildings,
} from './island3d'

const SETTINGS: IslandSettings = {
  islandName: '测试岛',
  monthlyBudgetCents: 150000,
  savingsGoalCents: 30000,
}

function summaryWithRemaining(remainingCents: number): MonthSummary {
  return {
    monthLabel: '2026 年 11 月',
    daysInMonth: 30,
    dailyBudgetCents: 5000,
    budgetCents: 150000,
    spentCents: 150000 - remainingCents,
    damage: 0,
    hp: 100,
    remainingCents,
    isOverspent: remainingCents < 0,
    bills: [],
    billDamages: {},
  }
}

describe('3D 岛屿进度与建筑阈值', () => {
  it('省钱进度 = 剩余预算 / 存钱目标，封顶 100%', () => {
    expect(getSavingsProgress(summaryWithRemaining(0), SETTINGS)).toBe(0)
    expect(getSavingsProgress(summaryWithRemaining(15000), SETTINGS)).toBe(0.5)
    expect(getSavingsProgress(summaryWithRemaining(30000), SETTINGS)).toBe(1)
    expect(getSavingsProgress(summaryWithRemaining(90000), SETTINGS)).toBe(1)
    expect(getSavingsProgress(summaryWithRemaining(-2000), SETTINGS)).toBe(0)
  })

  it('建筑在 0 / 10 / 30 / 60 / 90 百分比依次解锁', () => {
    expect(BUILDING_THRESHOLDS).toEqual({
      camp: 0,
      dock: 0.1,
      cabin: 0.3,
      lighthouse: 0.6,
      castle: 0.9,
    })

    expect(getUnlockedBuildings(0)).toEqual(['camp'])
    expect(getUnlockedBuildings(0.099)).toEqual(['camp'])
    expect(getUnlockedBuildings(0.1)).toEqual(['camp', 'dock'])
    expect(getUnlockedBuildings(0.3)).toEqual(['camp', 'dock', 'cabin'])
    expect(getUnlockedBuildings(0.6)).toEqual(['camp', 'dock', 'cabin', 'lighthouse'])
    expect(getUnlockedBuildings(0.9)).toEqual([
      'camp',
      'dock',
      'cabin',
      'lighthouse',
      'castle',
    ])
  })

  it('建筑显隐在阈值边界上稳定，越界值被夹取', () => {
    expect(getBuildingVisibility(0.3)).toMatchObject({ cabin: true, lighthouse: false })
    expect(getBuildingVisibility(0.299)).toMatchObject({ cabin: false })
    expect(getBuildingVisibility(-1).castle).toBe(false)
    expect(getBuildingVisibility(2).castle).toBe(true)
    expect(getProgressPercent(0.456)).toBe(46)
    expect(getProgressPercent(1.4)).toBe(100)
  })
})

describe('昼夜插值', () => {
  it('按本地时间自动切换白天与深夜', () => {
    expect(getAutoDayNight(new Date(2026, 10, 19, 3, 0))).toBe(0)
    expect(getAutoDayNight(new Date(2026, 10, 19, 12, 0))).toBe(1)
    expect(getAutoDayNight(new Date(2026, 10, 19, 22, 0))).toBe(0)
  })

  it('清晨和傍晚是连续中间值，不会瞬间跳变', () => {
    const dawn = getAutoDayNight(new Date(2026, 10, 19, 7, 30))
    const dusk = getAutoDayNight(new Date(2026, 10, 19, 18, 0))
    expect(dawn).toBeGreaterThan(0)
    expect(dawn).toBeLessThan(1)
    expect(dusk).toBeGreaterThan(0)
    expect(dusk).toBeLessThan(1)
  })

  it('天空渐变在白天和夜晚返回不同色阶', () => {
    expect(getSkyGradient(0)).toContain('rgb(7 26 42)')
    expect(getSkyGradient(1)).toContain('rgb(132 212 235)')
  })
})
