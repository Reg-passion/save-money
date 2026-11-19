import type {
  BillSource,
  CategoryId,
  IslandState,
  SummonOutcome,
  Transaction,
} from '../types'
import type { Bill } from './island'
import { toDateKey } from './budget'
import { pickSummon } from './summon'

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