import { useId, useRef, useState, type ChangeEvent } from 'react'
import {
  backupFilename,
  createBackup,
  parseBackup,
  restoreBackup,
  serializeBackup,
  type ParsedBackup,
} from '../lib/backup'

const DIALOG_STYLES = `
.backup-dialog::backdrop {
  background-color: rgb(8 28 36 / 0.55);
  backdrop-filter: blur(6px);
  overflow: hidden;
  overscroll-behavior: contain;
}
.backup-dialog:modal {
  overscroll-behavior: contain;
}
`

function BackupIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 4.5h10l4 4v11H5z" />
      <path d="M8.5 4.5v5h7v-5M8.5 19.5v-5h7v5" />
    </svg>
  )
}

function formatBackupTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

export default function DataBackup() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<ParsedBackup | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const titleId = useId()
  const descriptionId = useId()

  function resetDialog() {
    setParsed(null)
    setFileName(null)
    setMessage(null)
    setError(null)
    setRestoring(false)
  }

  function handleExport() {
    setError(null)
    setMessage(null)
    try {
      const now = new Date()
      const payload = createBackup(now)
      const blob = new Blob([serializeBackup(payload)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = backupFilename(now)
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage(`已导出 ${backupFilename(now)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出备份失败')
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError(null)
    setMessage(null)
    setParsed(null)
    setFileName(file.name)

    if (file.size > 2 * 1024 * 1024) {
      setError('备份文件超过 2 MB，不像是钱钱岛导出的账本。')
      return
    }

    try {
      const text = await file.text()
      setParsed(parseBackup(text))
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取备份失败')
    }
  }

  function handleRestore() {
    if (!parsed) return
    setError(null)
    setRestoring(true)
    try {
      restoreBackup(parsed.payload)
      setMessage('恢复成功，正在重新载入账本…')
      window.setTimeout(() => window.location.reload(), 260)
    } catch (err) {
      setRestoring(false)
      setError(err instanceof Error ? err.message : '恢复备份失败')
    }
  }

  return (
    <>
      <style>{DIALOG_STYLES}</style>
      <button
        type="button"
        onClick={() => {
          resetDialog()
          dialogRef.current?.showModal()
        }}
        aria-label="数据备份"
        title="数据备份"
        className="glass-icon-button"
      >
        <BackupIcon />
      </button>

      <dialog
        ref={dialogRef}
        className="backup-dialog m-auto w-[min(32rem,calc(100vw-2rem))] rounded-[28px] border border-white/60 bg-[#FFFDF7] p-0 text-ink shadow-[0_30px_80px_-20px_rgba(8,28,36,0.55)] backdrop:bg-[#081c24]/55"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClose={resetDialog}
      >
        <div className="max-h-[min(80dvh,44rem)] overflow-y-auto p-5">
          <header className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.28em] text-ink/35">DATA BACKUP</p>
              <h2 id={titleId} className="mt-1 text-lg font-bold text-ink">
                账本备份
              </h2>
              <p id={descriptionId} className="mt-1 text-[11px] leading-relaxed text-ink/45">
                JSON 备份包含岛屿设定、账单、许愿池、图鉴、蛋与结算记录，不含 CSV 导入文件。
              </p>
            </div>
            <form method="dialog">
              <button
                type="submit"
                aria-label="关闭备份窗口"
                className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink/70"
              >
                ×
              </button>
            </form>
          </header>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={handleExport} className="glass-action-button">
              导出 JSON 备份
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="glass-action-button"
            >
              选择 JSON 恢复
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileChange}
              className="sr-only"
              aria-label="选择钱钱岛 JSON 备份文件"
            />
          </div>

          {message && (
            <p role="status" className="mt-3 rounded-2xl bg-[#EDF6E5] px-3 py-2 text-[11px] leading-relaxed text-[#4F7B39]">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 rounded-2xl bg-[#FBE3DD] px-3 py-2 text-[11px] leading-relaxed text-[#8F3F2E]">
              {error}
            </p>
          )}

          {parsed && (
            <section
              aria-label="备份预览"
              className="mt-4 rounded-2xl border border-[#D9CBA9] bg-[#FBF6E8] p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-xs font-bold text-ink">恢复前预览</h3>
                <span className="text-[10px] text-ink/40">{fileName}</span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] leading-relaxed">
                <div className="flex justify-between gap-2">
                  <dt className="text-ink/45">岛屿</dt>
                  <dd className="min-w-0 truncate font-medium text-ink">{parsed.preview.islandName}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-ink/45">导出时间</dt>
                  <dd className="min-w-0 text-right font-medium text-ink">
                    {formatBackupTime(parsed.preview.exportedAt)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-ink/45">账单</dt>
                  <dd className="font-medium text-ink">{parsed.preview.billCount} 笔</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-ink/45">许愿池</dt>
                  <dd className="font-medium text-ink">{parsed.preview.wishCount} 个</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-ink/45">正式蛋 / 结算</dt>
                  <dd className="font-medium text-ink">
                    {parsed.preview.eggCount} / {parsed.preview.settlementCount}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-ink/45">演示蛋 / 结算</dt>
                  <dd className="font-medium text-ink">
                    {parsed.preview.demoEggCount} / {parsed.preview.demoSettlementCount}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 rounded-xl bg-[#FBE3DD]/55 px-2.5 py-2 text-[10px] leading-relaxed text-[#8F3F2E]">
                确认后会替换当前浏览器里的账本数据。建议先导出一份当前备份。
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={restoring}
                  onClick={handleRestore}
                  className="min-h-11 rounded-xl bg-[#B14E3D] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#9B4334] disabled:cursor-wait disabled:opacity-60"
                >
                  {restoring ? '正在恢复…' : '确认恢复并替换当前数据'}
                </button>
                <button
                  type="button"
                  disabled={restoring}
                  onClick={() => setParsed(null)}
                  className="min-h-11 rounded-xl border border-ink/15 bg-white/70 px-3 text-xs font-medium text-ink/60 transition-colors hover:bg-white disabled:opacity-60"
                >
                  取消本次恢复
                </button>
              </div>
            </section>
          )}

          <p className="mt-4 border-t border-ink/10 pt-3 text-[10px] leading-relaxed text-ink/35">
            所有数据只保存在当前浏览器 localStorage；换设备或清理浏览器数据前，请先导出备份。
          </p>
        </div>
      </dialog>
    </>
  )
}
