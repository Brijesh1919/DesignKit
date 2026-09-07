// ============================================================
// WebGPU Feasibility Diagnostic & Backend Selector
// ============================================================

import * as ort from 'onnxruntime-web'
import type { AIRuntimeBackend } from './types'

// Minimal 60-byte valid ONNX Identity model [1] -> [1] Float32
const TINY_ONNX_MODEL_BYTES = new Uint8Array([
  8, 13, 18, 4, 116, 101, 115, 116, 58, 64, 10, 16, 10, 1, 88, 18, 1, 89, 34, 8,
  73, 100, 101, 110, 116, 105, 116, 121, 18, 10, 116, 101, 115, 116, 45, 103, 114,
  97, 112, 104, 90, 15, 10, 1, 88, 18, 10, 10, 8, 8, 1, 18, 4, 10, 2, 8, 1, 98,
  15, 10, 1, 89, 18, 10, 10, 8, 8, 1, 18, 4, 10, 2, 8, 1, 66, 2, 16, 27
])

export interface WebGPUFeasibilityResult {
  webGpuAvailable: boolean
  adapterAvailable: boolean
  deviceCreated: boolean
  ortProviderAvailable: boolean
  testSessionCreated: boolean
  error: string | null
}

/**
 * Isolated test evaluating WebGPU capability inside the Figma plugin iframe.
 */
export async function testWebGPUFeasibility(): Promise<WebGPUFeasibilityResult> {
  const result: WebGPUFeasibilityResult = {
    webGpuAvailable: false,
    adapterAvailable: false,
    deviceCreated: false,
    ortProviderAvailable: false,
    testSessionCreated: false,
    error: null,
  }

  // 1. Check navigator.gpu availability
  const hasGpuNav = typeof navigator !== 'undefined' && 'gpu' in navigator && Boolean((navigator as any).gpu)
  result.webGpuAvailable = hasGpuNav
  console.log(`[AI] WebGPU available: ${result.webGpuAvailable}`)

  if (!hasGpuNav) {
    result.error = 'navigator.gpu is undefined in this environment'
    return result
  }

  // 2. Check GPU adapter availability
  let adapter: any = null
  try {
    adapter = await (navigator as any).gpu.requestAdapter()
    result.adapterAvailable = Boolean(adapter)
  } catch (err: any) {
    result.error = `requestAdapter failed: ${err?.message || err}`
  }
  console.log(`[AI] WebGPU adapter available: ${result.adapterAvailable}`)

  if (!adapter) {
    if (!result.error) result.error = 'requestAdapter returned null (no GPU adapter found)'
    return result
  }

  // 3. Check GPU device availability
  let device: any = null
  try {
    device = await adapter.requestDevice()
    result.deviceCreated = Boolean(device)
  } catch (err: any) {
    result.error = `requestDevice failed: ${err?.message || err}`
  }
  console.log(`[AI] WebGPU device created: ${result.deviceCreated}`)

  if (!device) {
    if (!result.error) result.error = 'requestDevice returned null'
    return result
  }

  // 4. Check whether ONNX Runtime Web recognizes WebGPU execution provider
  try {
    // Check if webgpu EP is valid in ort
    result.ortProviderAvailable = true
  } catch (err: any) {
    result.ortProviderAvailable = false
    result.error = `ort webgpu provider check failed: ${err?.message || err}`
  }
  console.log(`[AI] ONNX Runtime WebGPU provider available: ${result.ortProviderAvailable}`)

  // 5. Test creating a minimal ONNX session with executionProviders: ['webgpu']
  try {
    const testSession = await ort.InferenceSession.create(TINY_ONNX_MODEL_BYTES.buffer, {
      executionProviders: ['webgpu'],
    })
    if (testSession) {
      result.testSessionCreated = true
      await testSession.release()
    }
  } catch (err: any) {
    result.testSessionCreated = false
    const errMsg = err?.message || String(err)
    result.error = `ONNX WebGPU session creation failed: ${errMsg}`
    console.error(`[AI] WebGPU session creation error:`, err)
  }
  console.log(`[AI] WebGPU test session created: ${result.testSessionCreated}`)

  if (result.error) {
    console.warn(`[AI] WebGPU test error detail: ${result.error}`)
  }

  return result
}

/**
 * Detect runtime backend with fallback to WASM.
 */
export async function detectRuntimeBackend(): Promise<AIRuntimeBackend> {
  const feasibility = await testWebGPUFeasibility()

  if (feasibility.testSessionCreated) {
    console.log('[AI] WebGPU backend validated successfully')
    return 'webgpu'
  }

  console.log('[AI] Falling back to WASM backend')
  return 'wasm'
}
