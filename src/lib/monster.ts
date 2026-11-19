import type { CategoryId, Transaction } from '../types'

export interface Monster {
  id: string
  name: string
  category: CategoryId
  hp: number
  maxHp: number
  speed: number
  amountCents: number
  merged?: boolean
}

export const MONSTER_HP_PER_YUAN = 15
export const MONSTER_WAVE_LABELS = ['周一至周三', '周四至周五', '周六至周日'] as const

const CATEGORY_MONSTER_NAME: Record<CategoryId, string> = {
  takeout: '外卖怪',
  'milk-tea': '奶茶怪',
  'night-snack': '夜宵怪',
  delivery: '快递怪',
  transport: '交通怪',
  study: '学习怪',
  daily: '日用怪',
  fun: '娱乐怪',
}

export const MONSTER_SPEED: Record<CategoryId, number> = {
  takeout: 0.55,
  'milk-tea': 0.9,
  'night-snack': 0.82,
  delivery: 0.6,
  transport: 1,
  study: 0.5,
  daily: 0.68,
  fun: 0.72,
}

export function monsterHpForCents(amountCents: number): number {
  return Math.max(1, Math.round(amountCents / (MONSTER_HP_PER_YUAN * 100)))
}

function toMonster(transaction: Transaction): Monster {
  const hp = monsterHpForCents(transaction.amountCents)
  return {
    id: transaction.id,
    name: CATEGORY_MONSTER_NAME[transaction.category],
    category: transaction.category,
    hp,
    maxHp: hp,
    speed: MONSTER_SPEED[transaction.category],
    amountCents: transaction.amountCents,
  }
}

function dateOf(transaction: Transaction): Date {
  const fromDate = new Date(`${transaction.date}T00:00:00`)
  return Number.isNaN(fromDate.getTime()) ? new Date(transaction.time) : fromDate
}

function waveIndexFor(transaction: Transaction): 0 | 1 | 2 {
  const weekday = (dateOf(transaction).getDay() + 6) % 7
  if (weekday <= 2) return 0
  if (weekday <= 4) return 1
  return 2
}

function mergeWave(monsters: Monster[]): Monster[] {
  if (monsters.length <= 10) return monsters

  const kept = monsters.slice(0, 9)
  const merged = monsters.slice(9)
  const amountCents = merged.reduce((sum, monster) => sum + monster.amountCents, 0)
  const hp = merged.reduce((sum, monster) => sum + monster.hp, 0)
  return [
    ...kept,
    {
      id: merged.map((monster) => monster.id).join('+'),
      name: '本周大怪',
      category: merged[0]?.category ?? 'daily',
      hp,
      maxHp: hp,
      speed: Math.min(...merged.map((monster) => monster.speed)),
      amountCents,
      merged: true,
    },
  ]
}

export function buildMonsters(transactions: Transaction[]): Monster[][] {
  const waves: Monster[][] = [[], [], []]
  const ordered = [...transactions].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
  )
  for (const transaction of ordered) {
    waves[waveIndexFor(transaction)].push(toMonster(transaction))
  }
  return waves.map(mergeWave)
}