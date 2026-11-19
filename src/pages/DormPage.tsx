export default function DormPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header>
        <h1 className="text-xl font-bold text-ink">宿舍岛</h1>
        <p className="mt-1 text-sm text-ink/55">
          和室友合住一座岛：AA、投票、年度报告。
        </p>
      </header>

      <div className="mt-5 flex flex-1 items-center justify-center rounded-3xl border border-dashed border-ink/15 bg-white/40 px-6 py-14 text-center">
        <div>
          <p className="text-sm font-medium text-ink/60">Phase 2 开放</p>
          <p className="mt-1 text-xs leading-relaxed text-ink/40">
            先把眼前这座岛养好。
          </p>
        </div>
      </div>
    </div>
  )
}
