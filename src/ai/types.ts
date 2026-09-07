// ============================================================
// Types for isolated AI Background Removal module
// ============================================================

export type AIRuntimeBackend = 'webgpu' | 'wasm'

export interface AIMaskResult {
  /** Grayscale alpha mask where 0.0 = background / transparent, 1.0 = foreground / opaque */
  alphaMask: Float32Array
  width: number
  height: number
}

export interface AIRefineOptions {
  /** Feather radius in pixels (0 - 5) */
  feather: number
  /** Whether to apply edge smoothing / anti-aliasing */
  smoothEdges: boolean
}

export type AIProgressCallback = (status: string) => void

export interface BackgroundSegmentationModel {
  load(onProgress?: AIProgressCallback): Promise<void>
  segment(input: ImageData, onProgress?: AIProgressCallback): Promise<AIMaskResult>
  getRuntime(): AIRuntimeBackend | null
  isReady(): boolean
  dispose(): Promise<void>
}
