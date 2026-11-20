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

  public getModelLabel(): string {
    return this.loader.getCachedSession()?.modelLabel || 'BRIA RMBG-1.4 (1024×1024 HD)'
  }

  public async segment(input: ImageData, onProgress?: AIProgressCallback): Promise<AIMaskResult> {
    // Ensure session is loaded
    if (!this.loader.getCachedSession()) {
      await this.loader.loadModel(onProgress)
    }

    const cached = this.loader.getCachedSession()
    if (!cached) {
      throw new Error('AI Model is not initialized.')
    }
    const {
      session,
      inputName,
      outputName,
      inputWidth = 1024,
      inputHeight = 1024,
      normType = 'rmbg',
      modelLabel = 'AI Model',
    } = cached

    console.log(`[AI] Image: ${input.width}x${input.height}, Model Input: ${inputWidth}x${inputHeight} (${normType})`)

    onProgress?.(`Preparing image for inference (${inputWidth}×${inputHeight})...`)
    const preprocessed = preprocessImage(input, inputWidth, inputHeight, normType)

    onProgress?.(`Running background removal AI (${inputWidth}×${inputHeight})...`)
    const feeds: Record<string, any> = {}
    feeds[inputName] = preprocessed.tensor

    console.log(`[AI] ${modelLabel} inference started`)
    let results: Record<string, any>
    try {
      results = await session.run(feeds)
      console.log(`[AI] ${modelLabel} inference completed`)
    } catch (runErr: any) {
      const errMsg = runErr?.message || String(runErr)
      console.error(`[AI] ${modelLabel} inference failed: ${errMsg}`)
      let userFriendlyMsg = `${modelLabel} inference failed: ${errMsg}`
      if (errMsg.includes('bad_alloc') || errMsg.includes('out of memory')) {
        userFriendlyMsg = `Memory limit exceeded (${modelLabel}). This model (200MB+ Transformer) exceeds the browser WebAssembly memory limit. Please use U²-Net, Silueta, or RMBG-1.4.`
      }
      const err = new Error(userFriendlyMsg)
      ;(err as any).isInferenceError = true
      throw err
    }

    // Inspect outputs from ONNX session
    const outputNames = session.outputNames || Object.keys(results)
    const fusedOutputName = outputNames[0] || outputName
    const outputTensor = results[fusedOutputName] || Object.values(results)[0]
    if (!outputTensor) {
      const err = new Error(`${modelLabel} inference failed: Model execution produced no output tensor`)
      ;(err as any).isInferenceError = true
      throw err
    }

    const rawData = outputTensor.data as Float32Array

    onProgress?.('Refining alpha mask edges...')

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
