// ============================================================
// U²-NetP Background Segmentation Model Implementation
// ============================================================

import type { BackgroundSegmentationModel, AIMaskResult, AIRuntimeBackend, AIProgressCallback } from './types'
import { ModelLoader } from './ModelLoader'
import { preprocessImage } from './Preprocessor'
import { postprocessMask } from './Postprocessor'

export class U2NetPModel implements BackgroundSegmentationModel {
  private loader: ModelLoader = new ModelLoader()

  /**
   * Initializes the bundled U²-NetP model.
   */
  public async load(onProgress?: AIProgressCallback): Promise<void> {
    await this.loader.loadModel(onProgress)
  }

  /**
   * Initializes U²-NetP from a provided ArrayBuffer or Uint8Array.
   */
  public async loadFromBuffer(buffer: ArrayBuffer | Uint8Array, onProgress?: AIProgressCallback): Promise<void> {
    await this.loader.loadModelFromBuffer(buffer, onProgress)
  }

  public isReady(): boolean {
    return this.loader.getSession() !== null
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
      throw new Error('U2NetP model is not initialized.')
    }
    const { session, inputName, outputName } = cached

    console.log(`[AI] Image: ${input.width}x${input.height}`)

    onProgress?.('Preparing image...')
    // 320x320 fixed input for U²-NetP
    const preprocessed = preprocessImage(input, 320, 320)

    onProgress?.('Running AI segmentation...')
    const feeds: Record<string, any> = {}
    feeds[inputName] = preprocessed.tensor

    console.log('[AI] U2NetP inference started')
    let results: Record<string, any>
    try {
      results = await session.run(feeds)
      console.log('[AI] U2NetP inference completed')
    } catch (runErr: any) {
      const errMsg = runErr?.message || String(runErr)
      console.error(`[AI] U2NetP inference failed: ${errMsg}`)
      const err = new Error(`U2NetP inference failed: ${errMsg}`)
      ;(err as any).isInferenceError = true
      throw err
    }

    // Inspect all outputs from ONNX session
    const outputNames = session.outputNames || Object.keys(results)
    console.log(`[AI] U2NetP output count: ${outputNames.length}`)
    outputNames.forEach((name, idx) => {
      const tensor = results[name]
      const dims = tensor?.dims ? `[${tensor.dims.join(',')}]` : '[1,1,320,320]'
      console.log(`[AI] Output ${idx} shape: ${dims}`)
    })

    // Selected fused saliency output: Output 0 ('1959' / d0)
    const fusedOutputName = outputNames[0] || outputName
    const outputTensor = results[fusedOutputName] || Object.values(results)[0]
    if (!outputTensor) {
      const err = new Error('U2NetP inference failed: Model execution produced no output tensor')
      ;(err as any).isInferenceError = true
      throw err
    }

    const rawData = outputTensor.data as Float32Array

    let minVal = Infinity
    let maxVal = -Infinity
    let sumVal = 0
    for (let i = 0; i < rawData.length; i++) {
      const v = rawData[i]
      if (v < minVal) minVal = v
      if (v > maxVal) maxVal = v
      sumVal += v
    }
    const meanVal = sumVal / rawData.length

    console.log(`[AI] U2NetP raw output min: ${minVal.toFixed(6)}`)
    console.log(`[AI] U2NetP raw output max: ${maxVal.toFixed(6)}`)
    console.log(`[AI] U2NetP raw output mean: ${meanVal.toFixed(6)}`)

    onProgress?.('Refining edges...')

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
