export const STORAGE_PREFIX = 'money-island:'

function getStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
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
  try {
    getStorage()?.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
  } catch {
    // 配额满或被禁用时放弃本次写入，下次记账再试
  }
}
