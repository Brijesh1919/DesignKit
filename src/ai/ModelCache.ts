// ============================================================
// Model In-Memory & IndexedDB Storage
// ============================================================

const DB_NAME = 'DesignKitAI'
const DB_VERSION = 1
const STORE_NAME = 'models'

let inMemoryCache: Record<string, ArrayBuffer> = {}
let idbAvailable: boolean | null = null

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (idbAvailable === false || typeof window === 'undefined') {
      return reject(new Error('IndexedDB not supported or blocked by sandbox'))
    }

    try {
      if (!window.indexedDB) {
        idbAvailable = false
        return reject(new Error('IndexedDB not available'))
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }

      request.onsuccess = () => {
        idbAvailable = true
        resolve(request.result)
      }
      request.onerror = () => {
        idbAvailable = false
        reject(request.error)
      }
    } catch {
      idbAvailable = false
      reject(new Error('IndexedDB access denied'))
    }
  })
}

export class ModelCache {
  /**
   * Check if a model exists in cache.
   */
  public static async hasModel(key: string): Promise<boolean> {
    if (inMemoryCache[key]) return true
    try {
      const db = await openDB()
      return new Promise<boolean>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const req = store.count(key)
        req.onsuccess = () => resolve(req.result > 0)
        req.onerror = () => resolve(false)
      })
    } catch {
      return false
    }
  }

  /**
   * Retrieve cached model binary.
   */
  public static async getModel(key: string): Promise<ArrayBuffer | null> {
    if (inMemoryCache[key]) {
      return inMemoryCache[key]
    }

    try {
      const db = await openDB()
      return new Promise<ArrayBuffer | null>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const req = store.get(key)
        req.onsuccess = () => {
          const val = req.result
          if (val instanceof ArrayBuffer) {
            inMemoryCache[key] = val
            resolve(val)
          } else if (val instanceof Uint8Array) {
            const copy = new Uint8Array(val.byteLength)
            copy.set(val)
            const buf = copy.buffer as ArrayBuffer
            inMemoryCache[key] = buf
            resolve(buf)
          } else {
            resolve(null)
          }
        }
        req.onerror = () => resolve(null)
      })
    } catch {
      return null
    }
  }

  /**
   * Save model binary to memory and IndexedDB if available.
   */
  public static async saveModel(key: string, data: ArrayBuffer | Uint8Array): Promise<void> {
    let buffer: ArrayBuffer
    if (data instanceof Uint8Array) {
      const copy = new Uint8Array(data.byteLength)
      copy.set(data)
      buffer = copy.buffer as ArrayBuffer
    } else {
      buffer = data
    }

    inMemoryCache[key] = buffer

    try {
      const db = await openDB()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const req = store.put(buffer, key)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      })
    } catch {
      // Sandboxed iframes block IndexedDB; memory cache handles persistence during session
    }
  }

  /**
   * Clear a cached model.
   */
  public static async deleteModel(key: string): Promise<void> {
    delete inMemoryCache[key]
    try {
      const db = await openDB()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const req = store.delete(key)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      })
    } catch {
      // ignore
    }
  }
}
