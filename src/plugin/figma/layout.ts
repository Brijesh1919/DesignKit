import type {
  SpacingInfo,
  ApplySpacingPayload,
  AutoLayoutAnalysis,
  ApplyAutoLayoutPayload,
} from '../../shared/types'

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function roundToGrid(value: number, grid = 8): number {
  return Math.round(value / grid) * grid
}

type PositionedNode = SceneNode & { x: number; y: number; width: number; height: number }

function isPositioned(node: SceneNode): node is PositionedNode {
  return 'x' in node && 'y' in node && 'width' in node && 'height' in node
}

// -------------------------------------------------------
// Analyze spacing between selected layers
// -------------------------------------------------------
export function getSpacingInfo(selection: readonly SceneNode[]): SpacingInfo {
  const nodes = [...selection].filter(isPositioned)

  if (nodes.length < 2) {
    return { nodeIds: nodes.map(n => n.id), horizontalGaps: [], verticalGaps: [], hasHorizontal: false, hasVertical: false }
  }

  // Sort by Y first, then X (top-to-bottom, left-to-right)
  const sorted = [...nodes].sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x))

  // Detect dominant axis: compare total X spread vs Y spread
  const xSpread = Math.max(...sorted.map(n => n.x)) - Math.min(...sorted.map(n => n.x))
  const ySpread = Math.max(...sorted.map(n => n.y)) - Math.min(...sorted.map(n => n.y))
  const isHorizontal = xSpread > ySpread

  const horizontalGaps: number[] = []
  const verticalGaps: number[] = []

  if (isHorizontal) {
    // Sort by x, measure gaps between right edge of n and left edge of n+1
    const byx = [...sorted].sort((a, b) => a.x - b.x)
    for (let i = 0; i < byx.length - 1; i++) {
      const gap = byx[i + 1].x - (byx[i].x + byx[i].width)
      horizontalGaps.push(Math.round(gap))
    }
  } else {
    // Sort by y, measure gaps between bottom edge of n and top edge of n+1
    const byy = [...sorted].sort((a, b) => a.y - b.y)
    for (let i = 0; i < byy.length - 1; i++) {
      const gap = byy[i + 1].y - (byy[i].y + byy[i].height)
      verticalGaps.push(Math.round(gap))
    }
  }

  return {
    nodeIds: sorted.map(n => n.id),
    horizontalGaps,
    verticalGaps,
    hasHorizontal: horizontalGaps.length > 0,
    hasVertical: verticalGaps.length > 0,
  }
}

// -------------------------------------------------------
// Apply normalized spacing to selected layers
// -------------------------------------------------------
export async function applySpacing(payload: ApplySpacingPayload): Promise<void> {
  const { nodeIds, targetSpacing, direction } = payload

  const nodes = nodeIds
    .map(id => figma.getNodeById(id))
    .filter((n): n is SceneNode => n !== null && isPositioned(n))
    .map(n => n as PositionedNode)

  if (nodes.length < 2) return

  if (direction === 'horizontal' || direction === 'both') {
    const sorted = [...nodes].sort((a, b) => a.x - b.x)
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      sorted[i].x = prev.x + prev.width + targetSpacing
    }
  }

  if (direction === 'vertical' || direction === 'both') {
    const sorted = [...nodes].sort((a, b) => a.y - b.y)
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      sorted[i].y = prev.y + prev.height + targetSpacing
    }
  }
}

// -------------------------------------------------------
// Analyze a frame's children and suggest auto layout params
// -------------------------------------------------------
export function getAutoLayoutAnalysis(selection: readonly SceneNode[]): AutoLayoutAnalysis | null {
  if (selection.length !== 1) return null

  const node = selection[0]
  if (!('children' in node) || node.type === 'GROUP') return null

  const frame = node as FrameNode
  const children = [...frame.children].filter(isPositioned) as PositionedNode[]

  if (children.length < 2) return null

  // Determine direction by comparing X spread vs Y spread
  const xMin = Math.min(...children.map(c => c.x))
  const xMax = Math.max(...children.map(c => c.x + c.width))
  const yMin = Math.min(...children.map(c => c.y))
  const yMax = Math.max(...children.map(c => c.y + c.height))

  const xSpread = Math.max(...children.map(c => c.x)) - Math.min(...children.map(c => c.x))
  const ySpread = Math.max(...children.map(c => c.y)) - Math.min(...children.map(c => c.y))
  const suggestedDirection: 'HORIZONTAL' | 'VERTICAL' = xSpread > ySpread ? 'HORIZONTAL' : 'VERTICAL'

  // Compute gaps along the main axis
  const sortedByAxis = [...children].sort((a, b) =>
    suggestedDirection === 'HORIZONTAL' ? a.x - b.x : a.y - b.y
  )

  const gaps: number[] = []
  for (let i = 0; i < sortedByAxis.length - 1; i++) {
    const cur = sortedByAxis[i]
    const nxt = sortedByAxis[i + 1]
    const gap =
      suggestedDirection === 'HORIZONTAL'
        ? nxt.x - (cur.x + cur.width)
        : nxt.y - (cur.y + cur.height)
    if (gap >= 0) gaps.push(gap)
  }

  const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0
  const suggestedGap = Math.max(0, roundToGrid(avgGap))

  // Infer padding from children bounds relative to frame
  const paddingLeft   = roundToGrid(Math.max(0, xMin))
  const paddingTop    = roundToGrid(Math.max(0, yMin))
  const paddingRight  = roundToGrid(Math.max(0, frame.width  - xMax))
  const paddingBottom = roundToGrid(Math.max(0, frame.height - yMax))

  // Infer counter-axis alignment
  let counterAxisAlignItems: 'MIN' | 'CENTER' | 'MAX' = 'MIN'
  if (suggestedDirection === 'HORIZONTAL') {
    const frameCenter = frame.height / 2
    const avgCenter = children.reduce((s, c) => s + c.y + c.height / 2, 0) / children.length
    if (Math.abs(avgCenter - frameCenter) < 8) counterAxisAlignItems = 'CENTER'
  } else {
    const frameCenter = frame.width / 2
    const avgCenter = children.reduce((s, c) => s + c.x + c.width / 2, 0) / children.length
    if (Math.abs(avgCenter - frameCenter) < 8) counterAxisAlignItems = 'CENTER'
  }

  return {
    nodeId: frame.id,
    nodeName: frame.name,
    childCount: children.length,
    suggestedDirection,
    suggestedGap,
    suggestedPaddingTop: paddingTop,
    suggestedPaddingRight: paddingRight,
    suggestedPaddingBottom: paddingBottom,
    suggestedPaddingLeft: paddingLeft,
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems,
    currentHasAutoLayout: frame.layoutMode !== 'NONE',
  }
}

// -------------------------------------------------------
// Apply auto layout to a frame
// -------------------------------------------------------
export async function applyAutoLayout(payload: ApplyAutoLayoutPayload): Promise<void> {
  const node = figma.getNodeById(payload.nodeId)
  if (!node || node.type !== 'FRAME') {
    throw new Error('Target node is not a Frame. Please select a valid frame.')
  }

  const frame = node as FrameNode
  frame.layoutMode           = payload.direction
  frame.primaryAxisSizingMode  = 'AUTO'
  frame.counterAxisSizingMode  = 'AUTO'
  frame.itemSpacing            = payload.gap
  frame.paddingTop             = payload.paddingTop
  frame.paddingRight           = payload.paddingRight
  frame.paddingBottom          = payload.paddingBottom
  frame.paddingLeft            = payload.paddingLeft
  frame.primaryAxisAlignItems  = payload.primaryAxisAlignItems
  frame.counterAxisAlignItems  = payload.counterAxisAlignItems
}
