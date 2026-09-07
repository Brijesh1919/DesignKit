// ============================================================
// Image Preprocessing Pipeline for U²-NetP ONNX
// Fixed 320x320 NCHW Normalized Float32 Tensor
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
 * ImageNet Mean and Standard Deviation for RGB normalization:
 * mean: [0.485, 0.456, 0.406]
 * std:  [0.229, 0.224, 0.225]
 * Formula: (pixel / 255 - mean) / std
 */
const MEAN = [0.485, 0.456, 0.406]
const STD = [0.229, 0.224, 0.225]

/**
 * Resizes ImageData to 320x320 and prepares an NCHW normalized Float32 Tensor [1, 3, 320, 320].
 */
export function preprocessImage(
  imageData: ImageData,
  targetWidth = 320,
  targetHeight = 320
): PreprocessedData {
  const origWidth = imageData.width
  const origHeight = imageData.height

  console.log('[AI] U2NetP preprocessing started')

  // 1. Create temporary canvas to resize image copy to 320x320
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

  // Reference U²-Net preprocessing: find max RGB pixel value in image
  let maxPixel = 0
  for (let i = 0; i < imageSize; i++) {
    const px = i * 4
    if (pixels[px] > maxPixel) maxPixel = pixels[px]
    if (pixels[px + 1] > maxPixel) maxPixel = pixels[px + 1]
    if (pixels[px + 2] > maxPixel) maxPixel = pixels[px + 2]
  }
  if (maxPixel <= 0) maxPixel = 1

  console.log(`[AI] U2NetP preprocessing maxPixel: ${maxPixel}`)
  console.log('[AI] U2NetP input shape: [1,3,320,320]')

  const rOffset = 0
  const gOffset = imageSize
  const bOffset = 2 * imageSize

  for (let i = 0; i < imageSize; i++) {
    const px = i * 4
    const r = pixels[px] / maxPixel
    const g = pixels[px + 1] / maxPixel
    const b = pixels[px + 2] / maxPixel

    floatData[rOffset + i] = (r - MEAN[0]) / STD[0]
    floatData[gOffset + i] = (g - MEAN[1]) / STD[1]
    floatData[bOffset + i] = (b - MEAN[2]) / STD[2]
  }

  // 3. Create ONNX Tensor with shape [1, 3, 320, 320]
  const tensor = new ort.Tensor('float32', floatData, [1, 3, targetHeight, targetWidth])

  console.log('[AI] U2NetP input tensor: [1,3,320,320]')

  return {
    tensor,
    modelWidth: targetWidth,
    modelHeight: targetHeight,
    originalWidth: origWidth,
    originalHeight: origHeight,
  }
}
