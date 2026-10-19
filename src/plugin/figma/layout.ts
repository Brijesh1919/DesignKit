import type {
  SpacingInfo,
  ApplySpacingPayload,
  AutoLayoutAnalysis,
  ApplyAutoLayoutPayload,
  GridCheckerAnalysis,
  GridCheckerItem,
  GridOffProperty,
  ApplyGridFixPayload,
  ApplyPaddingPayload,
  AlignmentType,
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

// -------------------------------------------------------
// 8pt / 4pt Grid Checker Analysis & Fixes
// -------------------------------------------------------
export function getGridCheckerAnalysis(
  grid = 8,
  scope: 'selection' | 'page' = 'selection',
  selection: readonly SceneNode[] = figma.currentPage.selection
): GridCheckerAnalysis {
  const rootNodes = (scope === 'selection' && selection && selection.length > 0)
    ? selection
    : figma.currentPage.children

  const items: GridCheckerItem[] = []
  let totalScanned = 0

  function checkNode(node: SceneNode) {
    if ('visible' in node && node.visible === false) return
    totalScanned++

    const offProps: GridOffProperty[] = []

    const testProp = (name: string, val: number | undefined) => {
      if (typeof val !== 'number' || isNaN(val)) return
      const rounded = Math.round(val)
      const remainder = rounded % grid
      if (remainder !== 0) {
        const target = Math.round(rounded / grid) * grid
        offProps.push({
          property: name,
          value: rounded,
          diff: target - rounded,
          rounded: target,
        })
      }
    }

    if ('width' in node) testProp('width', (node as any).width)
    if ('height' in node) testProp('height', (node as any).height)
    if ('x' in node && node.parent?.type !== 'PAGE') testProp('x', (node as any).x)
    if ('y' in node && node.parent?.type !== 'PAGE') testProp('y', (node as any).y)

    if ('layoutMode' in node && (node as FrameNode).layoutMode !== 'NONE') {
      const f = node as FrameNode
      testProp('itemSpacing', f.itemSpacing)
      testProp('paddingTop', f.paddingTop)
      testProp('paddingRight', f.paddingRight)
      testProp('paddingBottom', f.paddingBottom)
      testProp('paddingLeft', f.paddingLeft)
    }

    if (offProps.length > 0) {
      items.push({
        nodeId: node.id,
        nodeName: node.name || 'Layer',
        offProperties: offProps,
      })
    }

    if ('children' in node) {
      for (const child of (node as ChildrenMixin).children) {
        checkNode(child)
      }
    }
  }

  for (const n of rootNodes) {
    checkNode(n)
  }

  return {
    items,
    totalScanned,
    grid,
  }
}

export function applyGridFixes(fixes: ApplyGridFixPayload['fixes']): number {
  let count = 0
  for (const fix of fixes) {
    const node = figma.getNodeById(fix.nodeId)
    if (!node || !('x' in node)) continue

    let modified = false
    const sceneNode = node as SceneNode

    if ('width' in fix.properties || 'height' in fix.properties) {
      const newW = fix.properties.width ?? ('width' in sceneNode ? sceneNode.width : 0)
      const newH = fix.properties.height ?? ('height' in sceneNode ? sceneNode.height : 0)
      if ('resize' in sceneNode && typeof sceneNode.resize === 'function') {
        sceneNode.resize(Math.max(1, newW), Math.max(1, newH))
        modified = true
      }
    }

    if ('x' in fix.properties && 'x' in sceneNode) {
      ;(sceneNode as any).x = fix.properties.x
      modified = true
    }
    if ('y' in fix.properties && 'y' in sceneNode) {
      ;(sceneNode as any).y = fix.properties.y
      modified = true
    }

    if ('layoutMode' in sceneNode && (sceneNode as FrameNode).layoutMode !== 'NONE') {
      const f = sceneNode as FrameNode
      if ('itemSpacing' in fix.properties) f.itemSpacing = Math.max(0, fix.properties.itemSpacing)
      if ('paddingTop' in fix.properties) f.paddingTop = Math.max(0, fix.properties.paddingTop)
      if ('paddingRight' in fix.properties) f.paddingRight = Math.max(0, fix.properties.paddingRight)
      if ('paddingBottom' in fix.properties) f.paddingBottom = Math.max(0, fix.properties.paddingBottom)
      if ('paddingLeft' in fix.properties) f.paddingLeft = Math.max(0, fix.properties.paddingLeft)
      modified = true
    }

    if (modified) count++
  }
  return count
}

// -------------------------------------------------------
// Padding Tool
// -------------------------------------------------------
export function applyPaddingToSelection(payload: ApplyPaddingPayload): number {
  const selection = figma.currentPage.selection
  const targetNodes: FrameNode[] = []

  if (payload.nodeId) {
    const n = figma.getNodeById(payload.nodeId)
    if (n && n.type === 'FRAME') targetNodes.push(n as FrameNode)
  }

  if (targetNodes.length === 0) {
    for (const node of selection) {
      if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
        targetNodes.push(node as FrameNode)
      }
    }
  }

  if (targetNodes.length === 0) {
    throw new Error('Please select at least one Frame or Component to adjust padding.')
  }

  let count = 0
  for (const frame of targetNodes) {
    if (frame.layoutMode === 'NONE') {
      frame.layoutMode = 'VERTICAL'
      frame.primaryAxisSizingMode = 'AUTO'
      frame.counterAxisSizingMode = 'AUTO'
    }
    frame.paddingTop = Math.max(0, payload.paddingTop)
    frame.paddingRight = Math.max(0, payload.paddingRight)
    frame.paddingBottom = Math.max(0, payload.paddingBottom)
    frame.paddingLeft = Math.max(0, payload.paddingLeft)
    count++
  }
  return count
}

// -------------------------------------------------------
// Alignment Tool
// -------------------------------------------------------
export function applyAlignmentToSelection(alignType: AlignmentType): number {
  const selection = figma.currentPage.selection
  if (selection.length === 0) {
    throw new Error('Please select at least one layer to align.')
  }

  // Single layer: align relative to parent frame bounds
  if (selection.length === 1) {
    const node = selection[0]
    if (!('x' in node && 'y' in node && 'width' in node && 'height' in node)) return
    const parent = node.parent
    if (!parent || !('width' in parent && 'height' in parent)) return

    const pw = (parent as any).width
    const ph = (parent as any).height
    const nw = node.width
    const nh = node.height

    switch (alignType) {
      case 'LEFT': node.x = 0; break
      case 'CENTER': node.x = Math.round((pw - nw) / 2); break
      case 'RIGHT': node.x = Math.round(pw - nw); break
      case 'TOP': node.y = 0; break
      case 'MIDDLE': node.y = Math.round((ph - nh) / 2); break
      case 'BOTTOM': node.y = Math.round(ph - nh); break
    }
    return
  }

  // Multiple layers
  const positioned = [...selection].filter(isPositioned)
  if (positioned.length < 2) return

  const minX = Math.min(...positioned.map(n => n.x))
  const maxX = Math.max(...positioned.map(n => n.x + n.width))
  const minY = Math.min(...positioned.map(n => n.y))
  const maxY = Math.max(...positioned.map(n => n.y + n.height))
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  switch (alignType) {
    case 'LEFT':
      for (const n of positioned) n.x = minX
      break
    case 'CENTER':
      for (const n of positioned) n.x = Math.round(centerX - n.width / 2)
      break
    case 'RIGHT':
      for (const n of positioned) n.x = Math.round(maxX - n.width)
      break
    case 'TOP':
      for (const n of positioned) n.y = minY
      break
    case 'MIDDLE':
      for (const n of positioned) n.y = Math.round(centerY - n.height / 2)
      break
    case 'BOTTOM':
      for (const n of positioned) n.y = Math.round(maxY - n.height)
      break

    case 'DISTRIBUTE_HORIZONTALLY': {
      const sorted = [...positioned].sort((a, b) => a.x - b.x)
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const step = (last.x - first.x) / (sorted.length - 1)
      for (let i = 1; i < sorted.length - 1; i++) {
        sorted[i].x = Math.round(first.x + i * step)
      }
      break
    }

    case 'DISTRIBUTE_VERTICALLY': {
      const sorted = [...positioned].sort((a, b) => a.y - b.y)
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const step = (last.y - first.y) / (sorted.length - 1)
      for (let i = 1; i < sorted.length - 1; i++) {
        sorted[i].y = Math.round(first.y + i * step)
      }
      break
    }

    case 'SPACE_EVENLY_HORIZONTAL': {
      const sorted = [...positioned].sort((a, b) => a.x - b.x)
      const totalWidth = sorted.reduce((sum, n) => sum + n.width, 0)
      const availableSpace = (maxX - minX) - totalWidth
      const gap = Math.round(availableSpace / (sorted.length - 1))
      let currentX = minX
      for (let i = 0; i < sorted.length; i++) {
        sorted[i].x = currentX
        currentX += sorted[i].width + gap
      }
      break
    }

    case 'SPACE_EVENLY_VERTICAL': {
      const sorted = [...positioned].sort((a, b) => a.y - b.y)
      const totalHeight = sorted.reduce((sum, n) => sum + n.height, 0)
      const availableSpace = (maxY - minY) - totalHeight
      const gap = Math.round(availableSpace / (sorted.length - 1))
      let currentY = minY
      for (let i = 0; i < sorted.length; i++) {
        sorted[i].y = currentY
        currentY += sorted[i].height + gap
      }
      break
    }
  }

  return selection.length
}

