// ============================================================
// Model Loader for ONNX Runtime Web (BRIA RMBG-1.4 Quantized 44.4 MB)
//
// Uses IndexedDB persistence to cache model bytes permanently.
// Downloads streamingly with percentage progress when first requested,
// eliminating 134MB bundle crashes on Figma startup.
// ============================================================

import * as ort from 'onnxruntime-web'
import type { AIRuntimeBackend, AIProgressCallback } from './types'
import { detectRuntimeBackend } from './RuntimeSelector'
import { ModelCache } from './ModelCache'

export interface LoadedModelSession {
  session: ort.InferenceSession
  backend: AIRuntimeBackend
  inputName: string
  outputName: string
}

const RMBG14_CACHE_KEY = 'rmbg14_quantized_v1'
const PRIMARY_MODEL_URL = 'https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model_quantized.onnx'

// Configure WASM for single-threaded execution inside sandboxed iframe
if (typeof window !== 'undefined') {
  if (ort.env && ort.env.wasm) {
    ort.env.wasm.numThreads = 1
    ort.env.wasm.simd = true
  }
}

export class ModelLoader {
  private session: ort.InferenceSession | null = null
  private activeBackend: AIRuntimeBackend | null = null

  /**
   * Returns whether the RMBG-1.4 model is already cached locally.
   */
  public async isModelCached(): Promise<boolean> {
    return await ModelCache.hasModel(RMBG14_CACHE_KEY)
  }

  /**
   * Returns the cached session if one already exists in memory.
   */
  public getCachedSession(): LoadedModelSession | null {
    if (this.session && this.activeBackend) {
      return {
        session: this.session,
        backend: this.activeBackend,
        inputName: this.session.inputNames[0] || 'input',
        outputName: this.session.outputNames[0] || 'output',
      }
    }
    return null
  }

  /**
   * Initialize ONNX InferenceSession from cached IndexedDB model or CDN.
   */
  public async loadModel(onProgress?: AIProgressCallback): Promise<LoadedModelSession> {
    if (this.session && this.activeBackend) {
      console.log('[AI] Reusing in-memory model session')
      return this.getCachedSession()!
    }

    // 1. Check local IndexedDB cache
    onProgress?.('Checking local AI cache...')
    let modelBuffer = await ModelCache.getModel(RMBG14_CACHE_KEY)

    // 2. If not cached, download once from Hugging Face with progress
    if (!modelBuffer) {
      console.log('[AI] Model not in cache. Downloading RMBG-1.4...')
      modelBuffer = await this.downloadModelWithProgress(PRIMARY_MODEL_URL, onProgress)
      // Save to IndexedDB so subsequent runs are instant & offline
      await ModelCache.saveModel(RMBG14_CACHE_KEY, modelBuffer)
      console.log('[AI] Saved RMBG-1.4 model to IndexedDB cache')
    } else {
      console.log(`[AI] Loaded RMBG-1.4 model from IndexedDB cache (${modelBuffer.byteLength} bytes)`)
      onProgress?.('Loading cached AI model...')
    }

    return await this.createSessionFromBuffer(modelBuffer, onProgress)
  }

  /**
   * Creates an ONNX InferenceSession from a provided ArrayBuffer or Uint8Array.
   */
  public async loadModelFromBuffer(
    bufferInput: ArrayBuffer | Uint8Array,
    onProgress?: AIProgressCallback
  ): Promise<LoadedModelSession> {
    if (this.session && this.activeBackend) {
      console.log('[AI] Reusing in-memory model session')
      return this.getCachedSession()!
    }

    let buffer: ArrayBuffer
    if (bufferInput instanceof Uint8Array) {
      const copy = new Uint8Array(bufferInput.byteLength)
      copy.set(bufferInput)
      buffer = copy.buffer as ArrayBuffer
    } else {
      buffer = bufferInput
    }

    // Save user-provided buffer to IndexedDB cache
    await ModelCache.saveModel(RMBG14_CACHE_KEY, buffer)
    return await this.createSessionFromBuffer(buffer, onProgress)
  }

  /**
   * Streams model from remote URL with byte-level progress reporting.
   */
  private async downloadModelWithProgress(
    url: string,
    onProgress?: AIProgressCallback
  ): Promise<ArrayBuffer> {
    onProgress?.('Connecting to AI model repository...')
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download RMBG-1.4 AI model: HTTP ${response.status} ${response.statusText}`)
    }

    const contentLength = response.headers.get('content-length')
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 44403226
    const totalMB = (totalBytes / (1024 * 1024)).toFixed(1)

    if (!response.body) {
      const buffer = await response.arrayBuffer()
      return buffer
    }

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let receivedBytes = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        chunks.push(value)
        receivedBytes += value.length
        const receivedMB = (receivedBytes / (1024 * 1024)).toFixed(1)
        const pct = Math.min(100, Math.round((receivedBytes / totalBytes) * 100))
        onProgress?.(`Downloading high-accuracy AI model... ${pct}% (${receivedMB} MB / ${totalMB} MB)`)
      }
    }

    onProgress?.('Finalizing AI model...')
    const allBytes = new Uint8Array(receivedBytes)
    let position = 0
    for (const chunk of chunks) {
      allBytes.set(chunk, position)
      position += chunk.length
    }

    return allBytes.buffer
  }

  private async createSessionFromBuffer(
    bufferInput: Uint8Array | ArrayBuffer,
    onProgress?: AIProgressCallback
  ): Promise<LoadedModelSession> {
    const targetBackend = await detectRuntimeBackend()
    onProgress?.('Initializing ONNX Runtime engine...')

    const uint8Data = bufferInput instanceof Uint8Array
      ? bufferInput
      : new Uint8Array(bufferInput)

    let session: ort.InferenceSession | null = null
    let backendUsed: AIRuntimeBackend = targetBackend

    // Priority 1: WebGPU
    if (targetBackend === 'webgpu') {
      try {
        console.log('[AI] Attempting WebGPU')
        session = await ort.InferenceSession.create(uint8Data, {
          executionProviders: ['webgpu'],
        })
        backendUsed = 'webgpu'
        console.log('[AI] WebGPU initialized successfully')
      } catch (gpuErr) {
        console.log('[AI] WebGPU unavailable, falling back to WASM:', gpuErr)
        backendUsed = 'wasm'
      }
    }

    // Priority 2: WASM
    if (!session) {
      try {
        if (ort.env && ort.env.wasm) {
          ort.env.wasm.numThreads = 1
          ort.env.wasm.simd = true
        }

        const sessionOptions: ort.InferenceSession.SessionOptions = {
          executionProviders: ['wasm'],
          enableCpuMemArena: true,
          enableMemPattern: true,
          graphOptimizationLevel: 'all',
          executionMode: 'sequential',
          extra: {
            session: {
              'memory.arena_extend_strategy': 'kSameAsRequested',
            },
          },
        }

        console.log('[AI] Initializing WASM runtime')
        session = await ort.InferenceSession.create(uint8Data, sessionOptions)
        backendUsed = 'wasm'
        console.log('[AI] WASM runtime initialized successfully')
      } catch (wasmErr) {
        console.error('[AI] WASM initialization failed:', wasmErr)
        throw new Error('Local AI inference engine is unavailable on this system.')
      }
    }

    this.session = session
    this.activeBackend = backendUsed

    const inputName = session.inputNames[0] || 'input'
    const outputName = session.outputNames[0] || 'output'

    console.log('[AI] RMBG-1.4 model ready')
    onProgress?.('✓ AI model ready')

    return {
      session,
      backend: backendUsed,
      inputName,
      outputName,
    }
  }

  public getSession(): ort.InferenceSession | null {
    return this.session
  }

  public getBackend(): AIRuntimeBackend | null {
    return this.activeBackend
  }

  public async dispose(): Promise<void> {
    if (this.session) {
      try {
        await this.session.release()
      } catch (e) {
        console.warn('[AI] Error releasing model session:', e)
      }
      this.session = null
      this.activeBackend = null
      console.log('[AI] Model session disposed')
    }
  }
}
