// ============================================================
// Model Loader for ONNX Runtime Web (U²-NetP Model 4.57 MB)
//
// Reassembles the bundled U²-NetP binary from safe chunks and
// initializes a single cached ONNX InferenceSession (WebGPU / WASM).
// No IndexedDB or filesystem/fetch dependency.
// ============================================================

import * as ort from 'onnxruntime-web'
import type { AIRuntimeBackend, AIProgressCallback } from './types'
import { detectRuntimeBackend } from './RuntimeSelector'
import { U2NETP_MODEL_CHUNKS } from './u2netp_chunks'

export interface LoadedModelSession {
  session: ort.InferenceSession
  backend: AIRuntimeBackend
  inputName: string
  outputName: string
}

/**
 * Reassembles the binary U²-NetP ONNX model from bundled binary chunks.
 */
export function getBundledU2NetPBinary(): Uint8Array {
  console.log('[AI] Loading U2NetP binary model')
  let totalLength = 0
  const decodedChunks: Uint8Array[] = []

  for (let i = 0; i < U2NETP_MODEL_CHUNKS.length; i++) {
    const chunk = U2NETP_MODEL_CHUNKS[i]
    const binStr = atob(chunk)
    const len = binStr.length
    totalLength += len
    const bytes = new Uint8Array(len)
    for (let j = 0; j < len; j++) {
      bytes[j] = binStr.charCodeAt(j)
    }
    decodedChunks.push(bytes)
  }

  const combined = new Uint8Array(totalLength)
  let offset = 0
  for (const arr of decodedChunks) {
    combined.set(arr, offset)
    offset += arr.length
  }

  console.log(`[AI] U2NetP model bytes: ${combined.byteLength}`)
  return combined
}

export class ModelLoader {
  private session: ort.InferenceSession | null = null
  private activeBackend: AIRuntimeBackend | null = null

  /**
   * Returns the cached session if one already exists.
   */
  public getCachedSession(): LoadedModelSession | null {
    if (this.session && this.activeBackend) {
      return {
        session: this.session,
        backend: this.activeBackend,
        inputName: this.session.inputNames[0] || 'input.1',
        outputName: this.session.outputNames[0] || '1959',
      }
    }
    return null
  }

  /**
   * Initialize ONNX InferenceSession from the bundled U²-NetP model.
   * Reuses the valid session once created to prevent duplicate initializations.
   */
  public async loadModel(onProgress?: AIProgressCallback): Promise<LoadedModelSession> {
    if (this.session && this.activeBackend) {
      console.log('[AI] Reusing cached model session')
      return this.getCachedSession()!
    }

    console.log('[AI] U2NetP initialization started')
    onProgress?.('Initializing AI...')

    const modelBytes = getBundledU2NetPBinary()
    return await this.createSessionFromBuffer(modelBytes, onProgress)
  }

  /**
   * Creates an ONNX InferenceSession from a provided ArrayBuffer or Uint8Array.
   */
  public async loadModelFromBuffer(
    bufferInput: ArrayBuffer | Uint8Array,
    onProgress?: AIProgressCallback
  ): Promise<LoadedModelSession> {
    if (this.session && this.activeBackend) {
      console.log('[AI] Reusing cached model session')
      return this.getCachedSession()!
    }

    console.log('[AI] U2NetP initialization started')
    const byteCount = bufferInput.byteLength
    console.log(`[AI] U2NetP model bytes: ${byteCount}`)

    return await this.createSessionFromBuffer(bufferInput, onProgress)
  }

  private async createSessionFromBuffer(
    bufferInput: Uint8Array | ArrayBuffer,
    onProgress?: AIProgressCallback
  ): Promise<LoadedModelSession> {
    const targetBackend = await detectRuntimeBackend()
    onProgress?.('Initializing ONNX Runtime session...')
    console.log('[AI] U2NetP session creating')

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
        console.log('[AI] WebGPU initialized')
      } catch (gpuErr) {
        console.log('[AI] WebGPU unavailable:', gpuErr)
        console.log('[AI] Falling back to WASM')
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

        console.log('[AI] Initializing runtime')
        console.log('[AI] Falling back to WASM')
        session = await ort.InferenceSession.create(uint8Data, sessionOptions)
        backendUsed = 'wasm'
        console.log('[AI] WASM initialized')
      } catch (wasmErr) {
        console.error('[AI] WASM initialization failed:', wasmErr)
        throw new Error('Local AI inference is unavailable on this system.')
      }
    }

    this.session = session
    this.activeBackend = backendUsed

    const inputName = session.inputNames[0] || 'input.1'
    const outputName = session.outputNames[0] || '1959'

    console.log('[AI] U2NetP model ready')
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
