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
// -------------------------------------------------------
// Alignment Tool
// -------------------------------------------------------
export function applyAlignmentToSelection(
  payload: ApplyAlignmentPayload | AlignmentType
): number {
  const alignType: AlignmentType = typeof payload === 'string' ? payload : payload.alignType
  const targetMode = typeof payload === 'object' && payload.targetMode ? payload.targetMode : 'auto'

  const selection = figma.currentPage.selection
  if (selection.length === 0) {
    throw new Error('Please select at least one layer to align.')
  }

  // 1. Single selection case
  if (selection.length === 1) {
    const singleNode = selection[0]

    // If targetMode is 'children' OR (container with 2+ children and either targetMode !== 'parent' or parent is Page)
    const hasChildren = 'children' in singleNode && (singleNode as ChildrenMixin).children.length >= 1
    const isRootOrRequested = targetMode === 'children' || (targetMode === 'auto' && singleNode.parent?.type === 'PAGE' && hasChildren)

    if (hasChildren && isRootOrRequested) {
      const container = singleNode as FrameNode

      // If container is Auto-Layout, adjust its alignment settings
      if ('layoutMode' in container && container.layoutMode !== 'NONE') {
        if (container.layoutMode === 'VERTICAL') {
          switch (alignType) {
            case 'LEFT': container.counterAxisAlignItems = 'MIN'; break
            case 'CENTER': container.counterAxisAlignItems = 'CENTER'; break
            case 'RIGHT': container.counterAxisAlignItems = 'MAX'; break
            case 'TOP': container.primaryAxisAlignItems = 'MIN'; break
            case 'MIDDLE': container.primaryAxisAlignItems = 'CENTER'; break
            case 'BOTTOM': container.primaryAxisAlignItems = 'MAX'; break
            case 'SPACE_EVENLY_VERTICAL':
            case 'DISTRIBUTE_VERTICALLY':
              container.primaryAxisAlignItems = 'SPACE_BETWEEN'
              break
          }
        } else if (container.layoutMode === 'HORIZONTAL') {
          switch (alignType) {
            case 'LEFT': container.primaryAxisAlignItems = 'MIN'; break
            case 'CENTER': container.primaryAxisAlignItems = 'CENTER'; break
            case 'RIGHT': container.primaryAxisAlignItems = 'MAX'; break
            case 'TOP': container.counterAxisAlignItems = 'MIN'; break
            case 'MIDDLE': container.counterAxisAlignItems = 'CENTER'; break
            case 'BOTTOM': container.counterAxisAlignItems = 'MAX'; break
            case 'SPACE_EVENLY_HORIZONTAL':
            case 'DISTRIBUTE_HORIZONTALLY':
              container.primaryAxisAlignItems = 'SPACE_BETWEEN'
              break
          }
        }
        return container.children.length
      }

      // Freeform container: align children inside this container
      const children = [...container.children].filter(isPositioned)
      if (children.length === 0) return 0
      alignPositionedNodes(children, alignType, container)
      return children.length
    }

    // Otherwise align this single node inside its parent
    const parent = singleNode.parent
    if (parent && 'layoutMode' in parent && (parent as FrameNode).layoutMode !== 'NONE') {
      const pFrame = parent as FrameNode
      if (pFrame.layoutMode === 'VERTICAL') {
        switch (alignType) {
          case 'LEFT': pFrame.counterAxisAlignItems = 'MIN'; break
          case 'CENTER': pFrame.counterAxisAlignItems = 'CENTER'; break
          case 'RIGHT': pFrame.counterAxisAlignItems = 'MAX'; break
        }
      } else {
        switch (alignType) {
          case 'TOP': pFrame.counterAxisAlignItems = 'MIN'; break
          case 'MIDDLE': pFrame.counterAxisAlignItems = 'CENTER'; break
          case 'BOTTOM': pFrame.counterAxisAlignItems = 'MAX'; break
        }
      }
      return 1
    }

    if (parent && 'width' in parent && 'height' in parent && isPositioned(singleNode)) {
      const pw = (parent as any).width
      const ph = (parent as any).height
      const nw = singleNode.width
      const nh = singleNode.height

      switch (alignType) {
        case 'LEFT': singleNode.x = 0; break
        case 'CENTER': singleNode.x = Math.round((pw - nw) / 2); break
        case 'RIGHT': singleNode.x = Math.round(pw - nw); break
        case 'TOP': singleNode.y = 0; break
        case 'MIDDLE': singleNode.y = Math.round((ph - nh) / 2); break
        case 'BOTTOM': singleNode.y = Math.round(ph - nh); break
      }
      return 1
    }

    return 0
  }

  // 2. Multiple selection case
  const positioned = [...selection].filter(isPositioned)
  if (positioned.length === 0) return 0

  // Check if they share an auto-layout parent
  const firstParent = positioned[0].parent
  const sameParent = positioned.every(n => n.parent === firstParent)
  if (sameParent && firstParent && 'layoutMode' in firstParent && (firstParent as FrameNode).layoutMode !== 'NONE') {
    const pFrame = firstParent as FrameNode
    if (pFrame.layoutMode === 'VERTICAL') {
      switch (alignType) {
        case 'LEFT': pFrame.counterAxisAlignItems = 'MIN'; break
        case 'CENTER': pFrame.counterAxisAlignItems = 'CENTER'; break
        case 'RIGHT': pFrame.counterAxisAlignItems = 'MAX'; break
        case 'TOP': pFrame.primaryAxisAlignItems = 'MIN'; break
        case 'MIDDLE': pFrame.primaryAxisAlignItems = 'CENTER'; break
        case 'BOTTOM': pFrame.primaryAxisAlignItems = 'MAX'; break
        case 'SPACE_EVENLY_VERTICAL':
        case 'DISTRIBUTE_VERTICALLY':
          pFrame.primaryAxisAlignItems = 'SPACE_BETWEEN'
          break
      }
    } else {
      switch (alignType) {
        case 'LEFT': pFrame.primaryAxisAlignItems = 'MIN'; break
        case 'CENTER': pFrame.primaryAxisAlignItems = 'CENTER'; break
        case 'RIGHT': pFrame.primaryAxisAlignItems = 'MAX'; break
        case 'TOP': pFrame.counterAxisAlignItems = 'MIN'; break
        case 'MIDDLE': pFrame.counterAxisAlignItems = 'CENTER'; break
        case 'BOTTOM': pFrame.counterAxisAlignItems = 'MAX'; break
        case 'SPACE_EVENLY_HORIZONTAL':
        case 'DISTRIBUTE_HORIZONTALLY':
          pFrame.primaryAxisAlignItems = 'SPACE_BETWEEN'
          break
      }
    }
    return positioned.length
  }

  // If aligning to parent frame
  if (targetMode === 'parent' && firstParent && 'width' in firstParent && 'height' in firstParent) {
    const pw = (firstParent as any).width
    const ph = (firstParent as any).height
    for (const node of positioned) {
      switch (alignType) {
        case 'LEFT': node.x = 0; break
        case 'CENTER': node.x = Math.round((pw - node.width) / 2); break
        case 'RIGHT': node.x = Math.round(pw - node.width); break
        case 'TOP': node.y = 0; break
        case 'MIDDLE': node.y = Math.round((ph - node.height) / 2); break
        case 'BOTTOM': node.y = Math.round(ph - node.height); break
      }
    }
    return positioned.length
  }

  // Standard multi-item alignment relative to selection bounding box
  alignPositionedNodes(positioned, alignType)
  return positioned.length
}

function alignPositionedNodes(
  nodes: PositionedNode[],
  alignType: AlignmentType,
  boundsContainer?: SceneNode
) {
  if (nodes.length === 0) return

  let minX: number
  let maxX: number
  let minY: number
  let maxY: number

  if (boundsContainer && 'width' in boundsContainer && 'height' in boundsContainer) {
    minX = 0
    maxX = (boundsContainer as any).width
    minY = 0
    maxY = (boundsContainer as any).height
  } else {
    minX = Math.min(...nodes.map(n => n.x))
    maxX = Math.max(...nodes.map(n => n.x + n.width))
    minY = Math.min(...nodes.map(n => n.y))
    maxY = Math.max(...nodes.map(n => n.y + n.height))
  }

  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  switch (alignType) {
    case 'LEFT':
      for (const n of nodes) n.x = minX
      break
    case 'CENTER':
      for (const n of nodes) n.x = Math.round(centerX - n.width / 2)
      break
    case 'RIGHT':
      for (const n of nodes) n.x = Math.round(maxX - n.width)
      break
    case 'TOP':
      for (const n of nodes) n.y = minY
      break
    case 'MIDDLE':
      for (const n of nodes) n.y = Math.round(centerY - n.height / 2)
      break
    case 'BOTTOM':
      for (const n of nodes) n.y = Math.round(maxY - n.height)
      break

    case 'DISTRIBUTE_HORIZONTALLY': {
      if (nodes.length < 3) return
      const sorted = [...nodes].sort((a, b) => (a.x + a.width / 2) - (b.x + b.width / 2))
      const firstCenter = sorted[0].x + sorted[0].width / 2
      const lastCenter = sorted[sorted.length - 1].x + sorted[sorted.length - 1].width / 2
      const step = (lastCenter - firstCenter) / (sorted.length - 1)
      for (let i = 1; i < sorted.length - 1; i++) {
        sorted[i].x = Math.round(firstCenter + i * step - sorted[i].width / 2)
      }
      break
    }

    case 'DISTRIBUTE_VERTICALLY': {
      if (nodes.length < 3) return
      const sorted = [...nodes].sort((a, b) => (a.y + a.height / 2) - (b.y + b.height / 2))
      const firstCenter = sorted[0].y + sorted[0].height / 2
      const lastCenter = sorted[sorted.length - 1].y + sorted[sorted.length - 1].height / 2
      const step = (lastCenter - firstCenter) / (sorted.length - 1)
      for (let i = 1; i < sorted.length - 1; i++) {
        sorted[i].y = Math.round(firstCenter + i * step - sorted[i].height / 2)
      }
      break
    }

    case 'SPACE_EVENLY_HORIZONTAL': {
      if (nodes.length < 2) return
      const sorted = [...nodes].sort((a, b) => a.x - b.x)
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
      if (nodes.length < 2) return
      const sorted = [...nodes].sort((a, b) => a.y - b.y)
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
}

