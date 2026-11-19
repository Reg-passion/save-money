import { useEffect, useState } from 'react'
import { STORAGE_ERROR_EVENT } from '../../lib/storage'

export default function StorageNotice() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    function handleError(event: Event) {
      const detail = (event as CustomEvent<{ message?: string }>).detail
      setMessage(detail?.message ?? '本地存储写入失败，改动可能没有被保存。')
    }
    window.addEventListener(STORAGE_ERROR_EVENT, handleError)
    return () => window.removeEventListener(STORAGE_ERROR_EVENT, handleError)
  }, [])

  if (!message) return null

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))]"
    >
      <div className="flex w-full max-w-md items-start gap-3 rounded-2xl border border-[#E8B4A8] bg-[#FBE3DD] px-3 py-2.5 text-[11px] leading-relaxed text-[#8F3F2E] shadow-lg">
        <p className="min-w-0 flex-1">{message}</p>
        <button
          type="button"
          onClick={() => setMessage(null)}
          aria-label="关闭存储提示"
          className="shrink-0 rounded-full px-1 text-sm leading-none text-[#8F3F2E]/60 transition-colors hover:text-[#8F3F2E]"
        >
          ×
        </button>
      </div>
    </div>
  )
}
