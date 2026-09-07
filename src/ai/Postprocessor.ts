// ============================================================
// Postprocessor for scaling and normalizing U²-NetP alpha mask
// ============================================================

/**
 * Normalizes raw U²-NetP ONNX output mask and scales it back to original
 * image dimensions (origWidth x origHeight) using bilinear interpolation.
 */
export function postprocessMask(
  rawMask: Float32Array,
  modelWidth = 320,
  modelHeight = 320,
  origWidth: number,
  origHeight: number
): Float32Array {
  const totalModelPixels = modelWidth * modelHeight
  const normalizedModelMask = new Float32Array(totalModelPixels)

  let minVal = Infinity
  let maxVal = -Infinity
  for (let i = 0; i < totalModelPixels; i++) {
    const v = rawMask[i]
    if (v < minVal) minVal = v
    if (v > maxVal) maxVal = v
  }

  // Official reference normPRED: (mask - min) / (max - min)
  const range = maxVal - minVal
  for (let i = 0; i < totalModelPixels; i++) {
    normalizedModelMask[i] = range > 1e-6 ? (rawMask[i] - minVal) / range : 0
  }

  console.log('[AI] U2NetP mask generated')

  if (modelWidth === origWidth && modelHeight === origHeight) {
    console.log(`[AI] U2NetP result generated: ${origWidth}x${origHeight}`)
    return normalizedModelMask
  }

  // Bilinear scaling to original image dimensions
  const outputMask = new Float32Array(origWidth * origHeight)
  const scaleX = (modelWidth - 1) / Math.max(1, origWidth - 1)
  const scaleY = (modelHeight - 1) / Math.max(1, origHeight - 1)

  for (let y = 0; y < origHeight; y++) {
    const srcY = y * scaleY
    const y0 = Math.floor(srcY)
    const y1 = Math.min(y0 + 1, modelHeight - 1)
    const dy = srcY - y0
    const rowOffset = y * origWidth

    for (let x = 0; x < origWidth; x++) {
      const srcX = x * scaleX
      const x0 = Math.floor(srcX)
      const x1 = Math.min(x0 + 1, modelWidth - 1)
      const dx = srcX - x0

      const v00 = normalizedModelMask[y0 * modelWidth + x0]
      const v01 = normalizedModelMask[y0 * modelWidth + x1]
      const v10 = normalizedModelMask[y1 * modelWidth + x0]
      const v11 = normalizedModelMask[y1 * modelWidth + x1]

      const top = v00 * (1 - dx) + v01 * dx
      const bottom = v10 * (1 - dx) + v11 * dx
      const val = top * (1 - dy) + bottom * dy

      outputMask[rowOffset + x] = Math.max(0, Math.min(1, val))
    }
  }

  console.log(`[AI] U2NetP result generated: ${origWidth}x${origHeight}`)
  return outputMask
}
