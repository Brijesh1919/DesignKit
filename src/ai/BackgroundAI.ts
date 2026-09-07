// ============================================================
// High-Level Facade / Service for Local AI Background Removal
// Powered exclusively by U²-NetP ONNX Runtime
// ============================================================

import type {
  BackgroundSegmentationModel,
  AIMaskResult,
  AIRefineOptions,
  AIRuntimeBackend,
  AIProgressCallback,
} from './types'
import { U2NetPModel } from './Inference'
import { refineAlphaMask } from './MaskRefiner'

class BackgroundAIService {
  private activeModel: BackgroundSegmentationModel

  constructor(model?: BackgroundSegmentationModel) {
    this.activeModel = model || new U2NetPModel()
  }

  /**
   * Set or replace the active segmentation model.
   */
  public setModel(model: BackgroundSegmentationModel): void {
    if (this.activeModel) {
      this.activeModel.dispose().catch(() => {})
    }
    this.activeModel = model
  }

  /**
   * Initialize the U²-NetP AI model runtime from the bundled binary chunks.
   * Creates exactly one session and reuses it across calls.
   */
  public async initialize(onProgress?: AIProgressCallback): Promise<void> {
    if (this.activeModel.isReady()) {
      return // Already loaded
    }
    await this.activeModel.load(onProgress)
  }

  /**
   * Optional manual buffer initialization (e.g. diagnostic / custom model).
   */
  public async initializeWithBuffer(
    buffer: ArrayBuffer | Uint8Array,
    onProgress?: AIProgressCallback
  ): Promise<void> {
    if ('loadFromBuffer' in this.activeModel && typeof (this.activeModel as any).loadFromBuffer === 'function') {
      await (this.activeModel as any).loadFromBuffer(buffer, onProgress)
    } else {
      await this.activeModel.load(onProgress)
    }
  }

  /**
   * Returns true if the model is loaded and ready for inference.
   */
  public isReady(): boolean {
    return this.activeModel.isReady()
  }

  /**
   * Returns active execution backend ('webgpu' or 'wasm').
   */
  public getRuntime(): AIRuntimeBackend | null {
    return this.activeModel.getRuntime()
  }

  /**
   * Run background segmentation on the provided ImageData.
   */
  public async removeBackground(
    imageData: ImageData,
    onProgress?: AIProgressCallback
  ): Promise<AIMaskResult> {
    return await this.activeModel.segment(imageData, onProgress)
  }

  /**
   * Refines an alpha mask (edge smoothing / feathering) locally.
   */
  public refineMask(
    baseMask: Float32Array,
    width: number,
    height: number,
    options: AIRefineOptions
  ): Float32Array {
    return refineAlphaMask(baseMask, width, height, options)
  }

  /**
   * Dispose cached session and release GPU / WASM memory.
   */
  public async dispose(): Promise<void> {
    await this.activeModel.dispose()
  }
}

// Export singleton instance
export const BackgroundAI = new BackgroundAIService()
export default BackgroundAI
