export const STORAGE_PREFIX = 'money-island:'
export const STORAGE_ERROR_EVENT = 'money-island:storage-error'

export class StorageWriteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageWriteError'
  }
}

function getStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function notifyWriteFailure(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(STORAGE_ERROR_EVENT, {
      detail: {
        message: '本地存储写入失败，可能是容量已满或浏览器禁用了存储。请清理浏览器空间后重试。',
      },
    }),
  )
}

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = getStorage()?.getItem(STORAGE_PREFIX + key)
    return raw == null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeJSON<T>(key: string, value: T): void {
  const storage = getStorage()
  if (!storage) {
    notifyWriteFailure()
    throw new StorageWriteError('本地存储不可用')
  }

  try {
    storage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
  } catch {
    notifyWriteFailure()
    throw new StorageWriteError('本地存储写入失败')
  }
}
