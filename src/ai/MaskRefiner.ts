// ============================================================
// Local Mask Refinement: Feathering & Edge Smoothing
// ============================================================

import type { AIRefineOptions } from './types'

/**
 * Applies edge smoothing and morphological feathering to an alpha mask.
 * This runs locally on the mask tensor without repeating AI inference.
 */
export function refineAlphaMask(
  baseMask: Float32Array,
  width: number,
  height: number,
  options: AIRefineOptions
): Float32Array {
  const { feather, smoothEdges } = options

  if (feather <= 0 && !smoothEdges) {
    return new Float32Array(baseMask)
  }

  const resultMask = new Float32Array(baseMask)
  const radius = Math.min(5, Math.max(0, Math.round(feather)))

  // 1. Edge Smoothing (3x3 box blur on mask boundary transitions)
  if (smoothEdges && radius === 0) {
    const temp = new Float32Array(resultMask)
    for (let y = 1; y < height - 1; y++) {
      const rowOffset = y * width
      for (let x = 1; x < width - 1; x++) {
        const idx = rowOffset + x
        const val = temp[idx]
        // Target transition/boundary pixels
        if (val > 0.05 && val < 0.95) {
          let sum = 0
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              sum += temp[(y + dy) * width + (x + dx)]
            }
          }
          resultMask[idx] = sum / 9
        }
      }
    }
  } else if (radius > 0) {
    // 2. Feathering radius blur on boundary transition pixels
    const temp = new Float32Array(resultMask)
    const kSize = radius * 2 + 1
    const kernelWeight = 1 / (kSize * kSize)

    for (let y = radius; y < height - radius; y++) {
      const rowOffset = y * width
      for (let x = radius; x < width - radius; x++) {
        const idx = rowOffset + x
        const val = temp[idx]
        if (val > 0.01 && val < 0.99) {
          let sum = 0
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              sum += temp[(y + dy) * width + (x + dx)]
            }
          }
          resultMask[idx] = sum * kernelWeight
        }
      }
    }
  }

  return resultMask
}
