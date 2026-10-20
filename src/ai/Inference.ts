// ============================================================
// BRIA RMBG-1.4 Background Segmentation Model Implementation
// High-Resolution 1024x1024 Dichotomous Image Matting
// ============================================================

import type { BackgroundSegmentationModel, AIMaskResult, AIRuntimeBackend, AIProgressCallback } from './types'
import { ModelLoader } from './ModelLoader'
import { preprocessImage } from './Preprocessor'
import { postprocessMask } from './Postprocessor'

export class RMBG14Model implements BackgroundSegmentationModel {
  private loader: ModelLoader = new ModelLoader()

  /**
   * Initializes the bundled BRIA RMBG-1.4 model.
   */
  public async load(onProgress?: AIProgressCallback): Promise<void> {
    await this.loader.loadModel(onProgress)
  }

  /**
   * Initializes model from a provided ArrayBuffer or Uint8Array.
   */
  public async loadFromBuffer(buffer: ArrayBuffer | Uint8Array, onProgress?: AIProgressCallback): Promise<void> {
    await this.loader.loadModelFromBuffer(buffer, onProgress)
  }

  public isReady(): boolean {
    return this.loader.getSession() !== null
  }

  public async isModelCached(): Promise<boolean> {
    return await this.loader.isModelCached()
  }

  public getRuntime(): AIRuntimeBackend | null {
    return this.loader.getBackend()
  }

  public async segment(input: ImageData, onProgress?: AIProgressCallback): Promise<AIMaskResult> {
    // Ensure session is loaded
    if (!this.loader.getCachedSession()) {
      await this.loader.loadModel(onProgress)
    }

    const cached = this.loader.getCachedSession()
    if (!cached) {
      throw new Error('RMBG-1.4 model is not initialized.')
    }
    const { session, inputName, outputName } = cached

    console.log(`[AI] Image: ${input.width}x${input.height}`)

    onProgress?.('Preparing high-res image...')
    // 1024x1024 fixed high-resolution input for RMBG-1.4
    const preprocessed = preprocessImage(input, 1024, 1024)

    onProgress?.('Running background removal AI (1024x1024)...')
    const feeds: Record<string, any> = {}
    feeds[inputName] = preprocessed.tensor

    console.log('[AI] RMBG-1.4 inference started')
    let results: Record<string, any>
    try {
      results = await session.run(feeds)
      console.log('[AI] RMBG-1.4 inference completed')
    } catch (runErr: any) {
      const errMsg = runErr?.message || String(runErr)
      console.error(`[AI] RMBG-1.4 inference failed: ${errMsg}`)
      const err = new Error(`RMBG-1.4 inference failed: ${errMsg}`)
      ;(err as any).isInferenceError = true
      throw err
    }

    // Inspect outputs from ONNX session
    const outputNames = session.outputNames || Object.keys(results)
    const fusedOutputName = outputNames[0] || outputName
    const outputTensor = results[fusedOutputName] || Object.values(results)[0]
    if (!outputTensor) {
      const err = new Error('RMBG-1.4 inference failed: Model execution produced no output tensor')
      ;(err as any).isInferenceError = true
      throw err
    }

    const rawData = outputTensor.data as Float32Array

    onProgress?.('Refining high-definition edges...')

    // Normalize mask and scale back to original image dimensions
    const scaledMask = postprocessMask(
      rawData,
      preprocessed.modelWidth,
      preprocessed.modelHeight,
      preprocessed.originalWidth,
      preprocessed.originalHeight
    )

    return {
      alphaMask: scaledMask,
      width: preprocessed.originalWidth,
      height: preprocessed.originalHeight,
    }
  }

  public async dispose(): Promise<void> {
    await this.loader.dispose()
  }
}

// Backward compatibility alias
export const U2NetPModel = RMBG14Model
