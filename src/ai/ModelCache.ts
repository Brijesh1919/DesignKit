// ============================================================
// Model In-Memory, CacheStorage & IndexedDB Multi-Tier Storage
// Guarantees permanent persistence across Figma sessions and reloads
// ============================================================

const DB_NAME = 'DesignKitAI'
const DB_VERSION = 1
const STORE_NAME = 'models'
const CACHE_STORAGE_NAME = 'designkit-ai-models-v1'

let inMemoryCache: Record<string, ArrayBuffer> = {}
let idbAvailable: boolean | null = null

function getCacheUrl(key: string): string {
  return `https://designkit.local/models/${encodeURIComponent(key)}`
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported or blocked by sandbox'))
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }

      request.onsuccess = () => {
        resolve(request.result)
      }
      request.onerror = () => {
        reject(request.error)
      }
    } catch (err) {
      reject(err)
    }
  })
}

export class ModelCache {
  /**
   * Check if a model exists in cache (Memory -> CacheStorage -> IndexedDB).
   */
  public static async hasModel(key: string): Promise<boolean> {
    if (inMemoryCache[key]) return true

    // 1. Check CacheStorage
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cache = await window.caches.open(CACHE_STORAGE_NAME)
        const match = await cache.match(getCacheUrl(key))
        if (match) return true
      } catch {
        // CacheStorage unavailable or restricted
      }
    }

    // 2. Check IndexedDB
    try {
      const db = await openDB()
      const exists = await new Promise<boolean>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const req = store.count(key)
        req.onsuccess = () => resolve(req.result > 0)
        req.onerror = () => resolve(false)
        tx.onerror = () => resolve(false)
      })
      db.close()
      return exists
    } catch {
      return false
    }
  }

  /**
   * Retrieve cached model binary from the fastest available tier.
   */
  public static async getModel(key: string): Promise<ArrayBuffer | null> {
    // Tier 1: In-Memory (0ms)
    if (inMemoryCache[key]) {
      return inMemoryCache[key]
    }

    // Tier 2: CacheStorage API (Disk-backed, fast, handles 40MB+ without clone limits)
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cache = await window.caches.open(CACHE_STORAGE_NAME)
        const match = await cache.match(getCacheUrl(key))
        if (match) {
          const buf = await match.arrayBuffer()
          if (buf && buf.byteLength > 1000) {
            inMemoryCache[key] = buf
            console.log(`[ModelCache] Retrieved ${key} from CacheStorage (${buf.byteLength} bytes)`)
            return buf
          }
        }
      } catch (err) {
        console.warn('[ModelCache] CacheStorage read error:', err)
      }
    }

    // Tier 3: IndexedDB (Native typed Uint8Array storage)
    try {
      const db = await openDB()
      const val = await new Promise<any>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const req = store.get(key)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => resolve(null)
        tx.onerror = () => resolve(null)
      })
      db.close()

      if (val) {
        let buf: ArrayBuffer | null = null
        if (val instanceof ArrayBuffer) {
          buf = val
        } else if (val instanceof Uint8Array) {
          const copy = new Uint8Array(val.byteLength)
          copy.set(val)
          buf = copy.buffer as ArrayBuffer
        } else if (typeof Blob !== 'undefined' && val instanceof Blob) {
          buf = await val.arrayBuffer()
        }

        if (buf && buf.byteLength > 1000) {
          inMemoryCache[key] = buf
          console.log(`[ModelCache] Retrieved ${key} from IndexedDB (${buf.byteLength} bytes)`)

          // Backfill into CacheStorage for faster future loads if supported
          if (typeof window !== 'undefined' && 'caches' in window) {
            try {
              const cache = await window.caches.open(CACHE_STORAGE_NAME)
              await cache.put(getCacheUrl(key), new Response(new Blob([buf])))
            } catch {
              // ignore backfill errors
            }
          }
          return buf
        }
      }
    } catch (err) {
      console.warn('[ModelCache] IndexedDB read error:', err)
    }

    return null
  }

  /**
   * Save model binary to memory, CacheStorage, and IndexedDB simultaneously.
   * Guarantees transaction commit prior to closing database.
   */
  public static async saveModel(key: string, data: ArrayBuffer | Uint8Array): Promise<void> {
    const uint8 = data instanceof Uint8Array ? data : new Uint8Array(data)
    const buffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength) as ArrayBuffer

    // Tier 1: In-Memory
    inMemoryCache[key] = buffer

    // Tier 2: CacheStorage
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cache = await window.caches.open(CACHE_STORAGE_NAME)
        const response = new Response(new Blob([buffer]), {
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(uint8.byteLength),
          },
        })
        await cache.put(getCacheUrl(key), response)
        console.log(`[ModelCache] Saved to CacheStorage: ${key} (${uint8.byteLength} bytes)`)
      } catch (err) {
        console.warn('[ModelCache] CacheStorage write error:', err)
      }
    }

    // Tier 3: IndexedDB (storing Uint8Array directly - standard structured clone)
    try {
      const db = await openDB()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        store.put(uint8, key)

        // Must ONLY resolve when tx.oncomplete fires; db.close() before oncomplete aborts the transaction!
        tx.oncomplete = () => {
          resolve()
        }
        tx.onerror = () => {
          reject(tx.error)
        }
        tx.onabort = () => {
          reject(new Error('IndexedDB transaction aborted'))
        }
      })
      db.close()
      console.log(`[ModelCache] Successfully committed to IndexedDB: ${key} (${uint8.byteLength} bytes)`)
    } catch (err) {
      console.warn('[ModelCache] IndexedDB write error:', err)
    }
  }

  /**
   * Clear a cached model from all tiers.
   */
  public static async deleteModel(key: string): Promise<void> {
    delete inMemoryCache[key]

    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cache = await window.caches.open(CACHE_STORAGE_NAME)
        await cache.delete(getCacheUrl(key))
      } catch {
        // ignore
      }
    }

    try {
      const db = await openDB()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const req = store.delete(key)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
      db.close()
    } catch {
      // ignore
    }
  }
}
