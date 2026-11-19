import { useState } from 'react'
import AddBill from '../components/AddBill'
import Island from '../components/Island'
import MonsterAnimation from '../components/MonsterAnimation'
import Settlement from '../components/Settlement'
import WishPool from '../components/WishPool'
import { CATEGORIES } from '../data/categories'
import { SPIRIT_BY_ID, type Spirit } from '../data/catalog'
import { recordExpense, type ExpenseOutcome } from '../lib/expense'
import {
  formatBillTime,
  getWeather,
  loadBills,
  loadSettings,
  saveSettings,
  summarizeMonth,
  type Bill,
  type IslandSettings,
  type NewBillInput,
} from '../lib/island'
import { formatCents } from '../lib/money'
import { cancelWish, confirmWish, loadWishes, type WishRecord } from '../lib/wish'

const CATEGORY_NAMES = new Map(CATEGORIES.map((category) => [category.id, category.name]))

interface Encounter {
  monster: Spirit
  bill: Bill
  hpBefore: number
  hpAfter: number
}

export default function IslandPage() {
  const [settings, setSettings] = useState<IslandSettings>(() => loadSettings())
  const [bills, setBills] = useState<Bill[]>(() => loadBills())
  const [wishes, setWishes] = useState<WishRecord[]>(() => loadWishes())
  const [encounter, setEncounter] = useState<Encounter | null>(null)

  const summary = summarizeMonth(bills, settings)
  const weather = getWeather(summary.hp)

  function showMonster(bill: Bill, hpBefore: number) {
    const nextBills = loadBills()
    setBills(nextBills)
    const monster = SPIRIT_BY_ID[bill.monsterId]
    if (!monster) return
    setEncounter({
      monster,
      bill,
      hpBefore,
      hpAfter: summarizeMonth(nextBills, settings).hp,
    })
  }

  function handleAdd(input: NewBillInput, planned: boolean): ExpenseOutcome {
    const hpBefore = summary.hp
    const outcome = recordExpense(input, { planned })
    if (outcome.kind === 'wish') {
      setWishes(loadWishes())
      return outcome
    }
    showMonster(outcome.bill, hpBefore)
    return outcome
  }

  function handleConfirmWish(wishId: string) {
    const hpBefore = summary.hp
    const { bill } = confirmWish(wishId)
    setWishes(loadWishes())
    showMonster(bill, hpBefore)
  }

  function handleCancelWish(wishId: string) {
    cancelWish(wishId)
    setWishes(loadWishes())
  }

  function handleSaveSettings(next: IslandSettings) {
    setSettings(saveSettings(next))
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <Island
        settings={settings}
        summary={summary}
        weather={weather}
        onSaveSettings={handleSaveSettings}
      />

      <AddBill onAdd={handleAdd} />

      <WishPool wishes={wishes} onConfirm={handleConfirmWish} onCancel={handleCancelWish} />

      <Settlement summary={summary} settings={settings} />

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-ink">本月账单</h2>
          <span className="text-xs text-ink/40">{summary.bills.length} 笔</span>
        </div>
        {summary.bills.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-dashed border-ink/15 bg-white/50 px-4 py-6 text-center text-xs text-ink/45">
            还没有账单，记下今天的第一笔。
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-ink/5 overflow-hidden rounded-2xl border border-ink/10 bg-white/65">
            {summary.bills.map((bill) => (
              <li key={bill.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-soft text-xs font-semibold text-ink/55">
                  {(CATEGORY_NAMES.get(bill.category) ?? '账').slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {CATEGORY_NAMES.get(bill.category) ?? '杂项'}
                    {bill.note ? ` · ${bill.note}` : ''}
                  </p>
                  <p className="text-[11px] text-ink/40">
                    {formatBillTime(bill.time)}
                    {bill.source === 'wish' && ' · 许愿确认'}
                    {bill.source === 'import' && ' · 历史导入'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-ink">
                    -{formatCents(bill.amountCents)} 元
                  </p>
                  <p className="text-[11px] text-ink/40">
                    -{summary.billDamages[bill.id] ?? 0} 点血
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {encounter && (
        <MonsterAnimation
          key={encounter.bill.id}
          monster={encounter.monster}
          bill={encounter.bill}
          hpBefore={encounter.hpBefore}
          hpAfter={encounter.hpAfter}
          onDone={() => setEncounter(null)}
        />
      )}
    </div>
  )
}
