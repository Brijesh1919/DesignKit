// ============================================================
// Image Preprocessing Pipeline for BRIA RMBG-1.4 ONNX
// Fixed 1024x1024 NCHW Normalized Float32 Tensor
// ============================================================

import * as ort from 'onnxruntime-web'

export interface PreprocessedData {
  tensor: ort.Tensor
  modelWidth: number
  modelHeight: number
  originalWidth: number
  originalHeight: number
}

/**
 * BRIA RMBG-1.4 normalization:
 * mean = [0.5, 0.5, 0.5], std = [1.0, 1.0, 1.0]
 * Formula: (pixel / 255.0) - 0.5
 */
const MEAN = 0.5
const STD = 1.0

/**
 * Resizes ImageData to targetWidth x targetHeight and prepares an NCHW normalized Float32 Tensor.
 * Supports RMBG-1.4 normalization (mean 0.5, std 1.0) and ImageNet normalization (for U²-Net, Silueta, etc.).
 */
export function preprocessImage(
  imageData: ImageData,
  targetWidth = 1024,
  targetHeight = 1024,
  normType: 'rmbg' | 'imagenet' = 'rmbg'
): PreprocessedData {
  const origWidth = imageData.width
  const origHeight = imageData.height

  console.log(`[AI] Preprocessing image ${origWidth}x${origHeight} → model input ${targetWidth}x${targetHeight} (${normType})`)

  // 1. Create temporary canvas to resize image copy to target dimensions
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get 2D context for image preprocessing canvas')

  // Use temporary source canvas to draw original imageData
  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = origWidth
  sourceCanvas.height = origHeight
  const sourceCtx = sourceCanvas.getContext('2d')
  if (!sourceCtx) throw new Error('Could not get 2D context for source canvas')
  sourceCtx.putImageData(imageData, 0, 0)

  ctx.drawImage(sourceCanvas, 0, 0, origWidth, origHeight, 0, 0, targetWidth, targetHeight)

  // Immediately release source canvas backing buffer
  sourceCanvas.width = 0
  sourceCanvas.height = 0

  const resizedImageData = ctx.getImageData(0, 0, targetWidth, targetHeight)
  const pixels = resizedImageData.data

  // Immediately release target canvas backing buffer
  canvas.width = 0
  canvas.height = 0

  // 2. Prepare NCHW Float32Array: shape [1, 3, targetHeight, targetWidth]
  const imageSize = targetWidth * targetHeight
  const floatData = new Float32Array(3 * imageSize)

  const rOffset = 0
  const gOffset = imageSize
  const bOffset = 2 * imageSize

  if (normType === 'imagenet') {
    // Standard ImageNet normalization for U²-Net, U²-NetP, Silueta
    const rMean = 0.485, gMean = 0.456, bMean = 0.406
    const rStd = 0.229, gStd = 0.224, bStd = 0.225
    for (let i = 0; i < imageSize; i++) {
      const px = i * 4
      floatData[rOffset + i] = (pixels[px] / 255.0 - rMean) / rStd
      floatData[gOffset + i] = (pixels[px + 1] / 255.0 - gMean) / gStd
      floatData[bOffset + i] = (pixels[px + 2] / 255.0 - bMean) / bStd
    }
  } else {
    // RMBG-1.4 / BiRefNet normalization: (pixel / 255.0 - 0.5) / 1.0
    for (let i = 0; i < imageSize; i++) {
      const px = i * 4
      floatData[rOffset + i] = (pixels[px] / 255.0 - MEAN) / STD
      floatData[gOffset + i] = (pixels[px + 1] / 255.0 - MEAN) / STD
      floatData[bOffset + i] = (pixels[px + 2] / 255.0 - MEAN) / STD
    }
  }

  // 3. Create ONNX Tensor with shape [1, 3, targetHeight, targetWidth]
  const tensor = new ort.Tensor('float32', floatData, [1, 3, targetHeight, targetWidth])

  console.log(`[AI] Input tensor ready: [1, 3, ${targetHeight}, ${targetWidth}]`)

  return {
    tensor,
    modelWidth: targetWidth,
    modelHeight: targetHeight,
    originalWidth: origWidth,
    originalHeight: origHeight,
  }
}
