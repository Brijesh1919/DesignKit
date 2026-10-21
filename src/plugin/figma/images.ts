import type { ImageBytesPayload, ApplyImagePayload } from '../../shared/types'

// -------------------------------------------------------
// Export a selected node's visible pixels as PNG bytes.
// The UI will process these bytes on a Canvas element.
// -------------------------------------------------------
export async function getImageBytes(
  selection: readonly SceneNode[]
): Promise<ImageBytesPayload | null> {
  // Prefer nodes that have an IMAGE fill; otherwise fall back to any selected node
  let target: SceneNode | null = null

  for (const node of selection) {
    if ('fills' in node && Array.isArray((node as GeometryMixin).fills)) {
      const fills = (node as GeometryMixin).fills as ReadonlyArray<Paint>
      if (fills.some(f => f && f.type === 'IMAGE')) {
        target = node
        break
      }
    }
  }

  if (!target && selection.length > 0) {
    target = selection[0]
  }

  if (!target) return null

  try {
    const pngBytes = await target.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: 1 },
    })

    const width  = 'width'  in target ? (target as any).width  : 0
    const height = 'height' in target ? (target as any).height : 0

    // Convert Uint8Array to plain number[] for postMessage serialization
    return {
      nodeId: target.id,
      bytes: Array.from(pngBytes),
      width,
      height,
    }
  } catch (err) {
    throw new Error(
      'Could not export the selected layer as an image. ' +
      'Make sure the layer is visible and not hidden behind a mask.'
    )
  }
}

// -------------------------------------------------------
// Apply processed image bytes back to the source node
// as an IMAGE fill.
// -------------------------------------------------------
export async function applyImage(payload: ApplyImagePayload): Promise<void> {
  const node = figma.getNodeById(payload.nodeId)
  if (!node) throw new Error('The original node was not found. It may have been deleted.')
  if (!('fills' in node)) throw new Error('This layer type does not support image fills.')

  const bytes = new Uint8Array(payload.bytes)
  const image = figma.createImage(bytes)

  const fill: ImagePaint = {
    type: 'IMAGE',
    scaleMode: 'FILL',
    imageHash: image.hash,
    opacity: 1,
    visible: true,
  }

  ;(node as GeometryMixin).fills = [fill]
}

// -------------------------------------------------------
// Resize selected layers with optional aspect ratio lock
// -------------------------------------------------------
export function applyImageResize(
  payload: import('../../shared/types').ApplyImageResizePayload
): number {
  const selection = figma.currentPage.selection
  if (selection.length === 0) {
    throw new Error('Please select at least one layer to resize')
  }

  let resizedCount = 0
  for (const node of selection) {
    if ('resize' in node) {
      let targetW = payload.width
      let targetH = payload.height

      if (payload.lockAspect && 'width' in node && 'height' in node) {
        const curW = (node as any).width || 1
        const curH = (node as any).height || 1
        const ratio = curW / curH
        if (targetW > 0 && targetH <= 0) {
          targetH = Math.round(targetW / ratio)
        } else if (targetH > 0 && targetW <= 0) {
          targetW = Math.round(targetH * ratio)
        }
      }

      if (targetW > 0 && targetH > 0) {
        (node as LayoutMixin).resize(targetW, targetH)
        resizedCount++
      }
    }
  }

  return resizedCount
}

// -------------------------------------------------------
// Crop/Aspect ratio adjustment for selected image layers
// -------------------------------------------------------
export function applyImageCrop(
  payload: import('../../shared/types').ApplyImageCropPayload
): number {
  const selection = figma.currentPage.selection
  if (selection.length === 0) {
    throw new Error('Please select at least one layer to adjust aspect/crop')
  }

  let count = 0
  for (const node of selection) {
    // 1. If croppedBytes provided, apply the cropped image directly to fills
    if (payload.croppedBytes && payload.croppedBytes.length > 0 && 'fills' in node) {
      const image = figma.createImage(new Uint8Array(payload.croppedBytes))
      const fill: ImagePaint = {
        type: 'IMAGE',
        scaleMode: 'FILL',
        imageHash: image.hash,
        opacity: 1,
        visible: true,
      }
      ;(node as GeometryMixin).fills = [fill]
    } else if ('fills' in node && Array.isArray((node as GeometryMixin).fills)) {
      const fills = (node as GeometryMixin).fills as ReadonlyArray<Paint>
      const newFills = fills.map(f => {
        if (f.type === 'IMAGE') {
          return {
            ...f,
            scaleMode: payload.mode === 'FIT' ? 'FIT' : 'FILL',
          }
        }
        return f
      })
      ;(node as GeometryMixin).fills = newFills
    }

    // 2. Adjust dimensions to the target ratio
    if ('resize' in node && 'width' in node && 'height' in node) {
      const curW = (node as any).width
      const targetRatio = payload.ratioWidth / payload.ratioHeight
      const newH = Math.round(curW / targetRatio)
      if (newH > 0 && curW > 0) {
        (node as LayoutMixin).resize(curW, newH)
        count++
      }
    }
  }

  return count
}

