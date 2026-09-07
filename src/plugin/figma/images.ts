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
    if ('fills' in node) {
      const fills = (node as GeometryMixin).fills as ReadonlyArray<Paint>
      if (fills.some(f => f.type === 'IMAGE')) {
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
