import type { CategoryId, Transaction } from '../types'

export interface Monster {
  id: string
  name: string
  category: CategoryId
  hp: number
  maxHp: number
  speed: number
  amountCents: number
}

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

const CATEGORY_MONSTER_SPEED: Record<CategoryId, number> = {
  takeout: 0.55,
  'milk-tea': 0.9,
  'night-snack': 0.82,
  delivery: 0.6,
  transport: 1,
  study: 0.5,
  daily: 0.68,
  fun: 0.72,
}

export const MONSTER_HP_PER_YUAN = 15

export function monsterHpForCents(amountCents: number): number {
  return Math.round(amountCents / (MONSTER_HP_PER_YUAN * 100))
}

function toMonster(transaction: Transaction): Monster {
  const hp = Math.max(1, monsterHpForCents(transaction.amountCents))
  return {
    id: transaction.id,
    name: CATEGORY_MONSTER_NAME[transaction.category],
    category: transaction.category,
    hp,
    maxHp: hp,
    speed: CATEGORY_MONSTER_SPEED[transaction.category],
    amountCents: transaction.amountCents,
  }
}

function mergeWave(monsters: Monster[]): Monster[] {
  if (monsters.length <= 10) return monsters
  const sorted = [...monsters].sort((a, b) => b.hp - a.hp)
  const kept = sorted.slice(0, 9)
  const merged = sorted.slice(9)
  const amountCents = merged.reduce((sum, monster) => sum + monster.amountCents, 0)
  const hp = merged.reduce((sum, monster) => sum + monster.hp, 0)
  return [
    ...kept,
    {
      id: merged.map((monster) => monster.id).join('+'),
      name: '本周大怪',
      category: merged[0].category,
      hp,
      maxHp: hp,
      speed: Math.min(...merged.map((monster) => monster.speed)),
      amountCents,
    },
  ]
}

export function buildMonsters(transactions: Transaction[]): Monster[][] {
  if (transactions.length === 0) return [[], [], []]

  const waves: Monster[][] = [[], [], []]
  for (const transaction of transactions) {
    const weekday = (new Date(transaction.time).getDay() + 6) % 7
    const waveIndex = weekday <= 2 ? 0 : weekday <= 4 ? 1 : 2
    waves[waveIndex].push(toMonster(transaction))
  }

  return waves.map((wave) =>
    mergeWave(
      wave.sort((a, b) => a.id.localeCompare(b.id)),
    ),
  )
}