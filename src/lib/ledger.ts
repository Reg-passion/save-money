import type {
  BillSource,
  CategoryId,
  IslandState,
  SummonOutcome,
  Transaction,
} from '../types'
import { WISH_THRESHOLD_CENTS, WISHLIST_COOLDOWN_HOURS } from '../data/constants'
import type { Bill } from './island'
import { addDays, startOfLocalDay, toDateKey } from './budget'
import { pickSummon } from './summon'
import { WISHES_KEY, readArray, writeJSON } from './storage'

export interface TransactionInput {
  id?: string
  amountCents: number
  category: CategoryId
  note?: string
  time?: string | Date
  source?: BillSource
  monsterId?: string
  sourceWishId?: string
}

export function monsterHpForAmount(amountCents: number): number {
  return Math.max(1, Math.round(amountCents / 1500))
}

export interface QuickTemplate {
  id: string
  label: string
  amountCents: number
  category: CategoryId
  note: string
}

export const QUICK_TEMPLATES: QuickTemplate[] = [
  { id: 'mixue', label: '蜜雪', amountCents: 1800, category: 'milk-tea', note: '蜜雪' },
  { id: 'luckin', label: '瑞幸', amountCents: 1500, category: 'milk-tea', note: '瑞幸' },
  { id: 'takeout', label: '外卖', amountCents: 2300, category: 'takeout', note: '外卖' },
  { id: 'bus', label: '公交', amountCents: 200, category: 'transport', note: '公交' },
]

export type AmountFilter = 'all' | 'under20' | '20to50' | '50to100' | 'over100'
export type TimeFilter = 'all' | 'today' | 'last7' | 'last30'

export interface TransactionFilters {
  category: CategoryId | 'all'
  amount: AmountFilter
  time: TimeFilter
}

function matchesAmount(amountCents: number, filter: AmountFilter): boolean {
  if (filter === 'under20') return amountCents < 2000
  if (filter === '20to50') return amountCents >= 2000 && amountCents < 5000
  if (filter === '50to100') return amountCents >= 5000 && amountCents < 10000
  if (filter === 'over100') return amountCents >= 10000
  return true
}

function matchesTime(transaction: Transaction, filter: TimeFilter, now: Date): boolean {
  if (filter === 'all') return true
  const date = transaction.date || toDateKey(transaction.time)
  if (filter === 'today') return date === toDateKey(now)
  const days = filter === 'last7' ? 7 : 30
  const from = toDateKey(addDays(startOfLocalDay(now), -(days - 1)))
  return date >= from && date <= toDateKey(now)
}

export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilters,
  now: Date = new Date(),
): Transaction[] {
  return transactions
    .filter(
      (transaction) =>
        (filters.category === 'all' || transaction.category === filters.category) &&
        matchesAmount(transaction.amountCents, filters.amount) &&
        matchesTime(transaction, filters.time, now),
    )
    .sort((a, b) => {
      const byTime = new Date(b.time).getTime() - new Date(a.time).getTime()
      return byTime !== 0 ? byTime : a.id.localeCompare(b.id)
    })
}

export function makeTransaction(
  input: TransactionInput,
  now: Date = new Date(),
): Transaction {
  const time = input.time ? new Date(input.time) : now
  if (Number.isNaN(time.getTime())) throw new Error('时间格式不对')
  const id = input.id ?? crypto.randomUUID()

  return {
    id,
    amountCents: input.amountCents,
    category: input.category,
    note: input.note?.trim() ?? '',
    time: time.toISOString(),
    date: toDateKey(time),
    monsterHp: monsterHpForAmount(input.amountCents),
    monsterId: input.monsterId ?? '',
    spiritId: null,
    summonOutcome: null,
    source: input.source ?? 'manual',
    sourceWishId: input.sourceWishId,
  }
}

export function addTransaction(
  state: IslandState,
  input: TransactionInput,
  now: Date = new Date(),
): { state: IslandState; transaction: Transaction } {
  const draft = makeTransaction(input, now)
  const summoned = pickSummon(state, draft)
  const transaction: Transaction = {
    ...draft,
    spiritId: summoned.spiritId,
    summonOutcome: summoned.spiritId ? 'spirit' : 'energy',
    monsterId: summoned.spiritId ?? draft.monsterId,
  }
  return {
    state: {
      ...state,
      transactions: [transaction, ...state.transactions],
      spirits: summoned.spirits,
    },
    transaction,
  }
}

export interface TransactionPatch {
  amountCents?: number
  category?: CategoryId
  note?: string
  time?: string | Date
}

export function updateTransaction(
  state: IslandState,
  transactionId: string,
  patch: TransactionPatch,
): IslandState {
  const existing = state.transactions.find((transaction) => transaction.id === transactionId)
  if (!existing) throw new Error('账单不存在')

  const amountCents = patch.amountCents ?? existing.amountCents
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new Error('金额需要大于 0')
  }

  const time = patch.time === undefined ? new Date(existing.time) : new Date(patch.time)
  if (Number.isNaN(time.getTime())) throw new Error('时间格式不对')

  return {
    ...state,
    transactions: state.transactions.map((transaction) =>
      transaction.id === transactionId
        ? {
            ...transaction,
            amountCents,
            category: patch.category ?? transaction.category,
            note: patch.note === undefined ? transaction.note : patch.note.trim(),
            time: time.toISOString(),
            date: toDateKey(time),
            monsterHp: monsterHpForAmount(amountCents),
          }
        : transaction,
    ),
  }
}

export function deleteTransaction(state: IslandState, transactionId: string): IslandState {
  if (!state.transactions.some((transaction) => transaction.id === transactionId)) {
    throw new Error('账单不存在')
  }
  return {
    ...state,
    transactions: state.transactions.filter((transaction) => transaction.id !== transactionId),
  }
}

export type WishStatus = 'pending' | 'confirmed' | 'cancelled'

export interface WishRecordV2 {
  id: string
  amountCents: number
  category: CategoryId
  note: string
  createdAt: string
  readyAt: string
  status: WishStatus
  confirmedAt?: string
  cancelledAt?: string
  transactionId?: string
}

export interface WishDraft {
  amountCents: number
  category: CategoryId
  note?: string
}

export const WISH_COOLDOWN_MS = WISHLIST_COOLDOWN_HOURS * 60 * 60 * 1000

function normalizeWishRecord(value: unknown): WishRecordV2 | null {
  if (typeof value !== 'object' || value === null) return null
  const wish = value as Record<string, unknown>
  if (
    typeof wish.id !== 'string' ||
    !Number.isSafeInteger(wish.amountCents) ||
    (wish.amountCents as number) < WISH_THRESHOLD_CENTS ||
    typeof wish.category !== 'string' ||
    typeof wish.createdAt !== 'string' ||
    Number.isNaN(new Date(wish.createdAt).getTime()) ||
    typeof wish.readyAt !== 'string' ||
    Number.isNaN(new Date(wish.readyAt).getTime()) ||
    (wish.status !== 'pending' && wish.status !== 'confirmed' && wish.status !== 'cancelled')
  ) {
    return null
  }

  return {
    id: wish.id,
    amountCents: wish.amountCents as number,
    category: wish.category as CategoryId,
    note: typeof wish.note === 'string' ? wish.note : '',
    createdAt: new Date(wish.createdAt).toISOString(),
    readyAt: new Date(wish.readyAt).toISOString(),
    status: wish.status,
    confirmedAt: typeof wish.confirmedAt === 'string' ? wish.confirmedAt : undefined,
    cancelledAt: typeof wish.cancelledAt === 'string' ? wish.cancelledAt : undefined,
    transactionId: typeof wish.transactionId === 'string' ? wish.transactionId : undefined,
  }
}

export function loadWishRecords(): WishRecordV2[] {
  return readArray<unknown>(WISHES_KEY)
    .map(normalizeWishRecord)
    .filter((wish): wish is WishRecordV2 => wish !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function saveWishRecords(wishes: WishRecordV2[]): void {
  writeJSON(WISHES_KEY, wishes)
}

export function createWishRecord(input: WishDraft, now: Date = new Date()): WishRecordV2 {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents < WISH_THRESHOLD_CENTS) {
    throw new Error(`满 ${WISH_THRESHOLD_CENTS / 100} 元才进许愿池`)
  }
  return {
    id: crypto.randomUUID(),
    amountCents: input.amountCents,
    category: input.category,
    note: input.note?.trim() ?? '',
    createdAt: now.toISOString(),
    readyAt: new Date(now.getTime() + WISH_COOLDOWN_MS).toISOString(),
    status: 'pending',
  }
}

export function wishRemainingMs(wish: WishRecordV2, now: Date = new Date()): number {
  return Math.max(0, new Date(wish.readyAt).getTime() - now.getTime())
}

export function isWishReady(wish: WishRecordV2, now: Date = new Date()): boolean {
  return wish.status === 'pending' && wishRemainingMs(wish, now) === 0
}

export interface ConfirmWishResult {
  state: IslandState
  wishes: WishRecordV2[]
  transaction: Transaction
}

export function confirmWishRecord(
  state: IslandState,
  wishes: WishRecordV2[],
  wishId: string,
  now: Date = new Date(),
): ConfirmWishResult {
  const wish = wishes.find((item) => item.id === wishId && item.status === 'pending')
  if (!wish) throw new Error('许愿不存在或已处理')
  if (!isWishReady(wish, now)) throw new Error('还在冷静期，先别急着记')

  const result = addTransaction(
    state,
    {
      amountCents: wish.amountCents,
      category: wish.category,
      note: wish.note,
      time: now,
      source: 'wish',
      sourceWishId: wish.id,
    },
    now,
  )

  return {
    state: result.state,
    wishes: wishes.map((item) =>
      item.id === wish.id
        ? {
            ...item,
            status: 'confirmed',
            confirmedAt: now.toISOString(),
            transactionId: result.transaction.id,
          }
        : item,
    ),
    transaction: result.transaction,
  }
}

export function cancelWishRecord(
  wishes: WishRecordV2[],
  wishId: string,
  now: Date = new Date(),
): WishRecordV2[] {
  const wish = wishes.find((item) => item.id === wishId && item.status === 'pending')
  if (!wish) throw new Error('许愿不存在或已处理')
  return wishes.map((item) =>
    item.id === wish.id
      ? { ...item, status: 'cancelled', cancelledAt: now.toISOString() }
      : item,
  )
}

export function billToTransaction(bill: Bill): Transaction {
  const outcome: SummonOutcome | null =
    bill.summonOutcome === 'spirit' || bill.summonOutcome === 'energy'
      ? bill.summonOutcome
      : null
  return {
    id: bill.id,
    amountCents: bill.amountCents,
    category: bill.category,
    note: bill.note,
    time: bill.time,
    date: toDateKey(bill.time),
    monsterHp: monsterHpForAmount(bill.amountCents),
    monsterId: bill.monsterId,
    spiritId: bill.summonedSpiritId ?? null,
    summonOutcome: outcome,
    source: bill.source,
    sourceWishId: bill.sourceWishId,
  }
}

export function transactionToBill(transaction: Transaction): Bill {
  return {
    id: transaction.id,
    amountCents: transaction.amountCents,
    category: transaction.category,
    note: transaction.note,
    time: transaction.time,
    monsterId: transaction.monsterId,
    source: transaction.source,
    sourceWishId: transaction.sourceWishId,
    summonedSpiritId: transaction.spiritId,
    summonOutcome: transaction.summonOutcome,
  }
}