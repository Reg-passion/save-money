import { createWish, type WishRecord } from './wish'
import { createBill, type Bill, type NewBillInput } from './island'

export type ExpenseOutcome =
  | { kind: 'bill'; bill: Bill }
  | { kind: 'wish'; wish: WishRecord }

export interface RecordExpenseOptions {
  now?: Date
  imported?: boolean
  planned?: boolean
}

export function recordExpense(
  input: NewBillInput,
  options: RecordExpenseOptions = {},
): ExpenseOutcome {
  const now = options.now ?? new Date()

  if (!options.imported && options.planned) {
    return {
      kind: 'wish',
      wish: createWish(
        {
          amountCents: input.amountCents,
          category: input.category,
          note: input.note,
        },
        now,
      ),
    }
  }

  return {
    kind: 'bill',
    bill: createBill(input, { source: options.imported ? 'import' : 'manual' }),
  }
}
