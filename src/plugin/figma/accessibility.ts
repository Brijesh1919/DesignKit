// ============================================================
// Accessibility feature module for Figma plugin sandbox.
// Covers: Touch Target Checker, Text Size Checker.
// ============================================================

import type {
  TouchTargetAnalysis,
  TouchTargetItem,
  TextSizeAnalysis,
  TextSizeItem,
} from '../../shared/types'

// -------------------------------------------------------
// Helper: Check if a node is likely an interactive element
// -------------------------------------------------------
const INTERACTIVE_KEYWORDS = [
  'button',
  'btn',
  'icon',
  'input',
  'chip',
  'tab',
  'checkbox',
  'radio',
  'switch',
  'toggle',
  'badge',
  'link',
  'action',
  'dropdown',
  'item',
  'card',
  'cta',
  'nav',
  'select',
  'avatar',
  'clickable',
]

function isLikelyInteractiveNode(node: SceneNode): boolean {
  const name = node.name.toLowerCase()

  // Keyword match
  if (INTERACTIVE_KEYWORDS.some(k => name.includes(k))) {
    return true
  }

  // Small frames/components with vector/image/text that fit button-like sizes
  if (node.type === 'FRAME' || node.type === 'INSTANCE' || node.type === 'COMPONENT') {
    const { width, height } = node
    if (width <= 140 && height <= 80 && width >= 12 && height >= 12) {
      return true
    }
  }

  // Small standalone vectors/shapes that could be clickable icons
  if (node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION') {
    if (node.width <= 48 && node.height <= 48) {
      return true
    }
  }

  return false
}

// -------------------------------------------------------
// 1. TOUCH TARGET CHECKER
// -------------------------------------------------------
export function getTouchTargetAnalysis(
  selection: readonly SceneNode[],
  threshold = 44,
  scope: 'selection' | 'page' = 'selection'
): TouchTargetAnalysis {
  const items: TouchTargetItem[] = []
  const visitedNodeIds = new Set<string>()

  function scanNode(node: SceneNode) {
    if (visitedNodeIds.has(node.id)) return
    visitedNodeIds.add(node.id)

    // Skip hidden layers
    if (node.visible === false) return

    const isInteractive = isLikelyInteractiveNode(node)

    // If node is an interactive target
    if (isInteractive) {
      const width = Math.round(node.width)
      const height = Math.round(node.height)
      const status: 'PASS' | 'FAIL' = width >= threshold && height >= threshold ? 'PASS' : 'FAIL'

      items.push({
        nodeId: node.id,
        nodeName: node.name,
        width,
        height,
        status,
        isInteractive: true,
      })
    }

    // Recurse into children
    if ('children' in node) {
      for (const child of (node as ChildrenMixin).children) {
        scanNode(child)
      }
    }
  }

  if (scope === 'selection' && selection && selection.length > 0) {
    for (const root of selection) {
      scanNode(root)
    }
  } else {
    for (const root of figma.currentPage.children) {
      scanNode(root)
    }
  }

  const passCount = items.filter(i => i.status === 'PASS').length
  const failCount = items.filter(i => i.status === 'FAIL').length

  // Sort failures first, then smallest dimensions
  items.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'FAIL' ? -1 : 1
    }
    return Math.min(a.width, a.height) - Math.min(b.width, b.height)
  })

  return {
    threshold,
    items,
    passCount,
    failCount,
  }
}

// -------------------------------------------------------
// 2. TEXT SIZE CHECKER
// -------------------------------------------------------
export function getTextSizeAnalysis(
  selection: readonly SceneNode[],
  minSize = 12,
  scope: 'selection' | 'page' = 'selection'
): TextSizeAnalysis {
  const items: TextSizeItem[] = []
  const visitedNodeIds = new Set<string>()

  function scanNode(node: SceneNode) {
    if (visitedNodeIds.has(node.id)) return
    visitedNodeIds.add(node.id)

    if (node.visible === false) return

    if (node.type === 'TEXT') {
      const textNode = node as TextNode
      let fontSize = 16
      if (typeof textNode.fontSize === 'number') {
        fontSize = Math.round(textNode.fontSize * 10) / 10
      }

      let fontWeight: number | string = 'Regular'
      if (typeof textNode.fontWeight === 'number') {
        fontWeight = textNode.fontWeight
      } else if (typeof textNode.fontName !== 'symbol' && textNode.fontName) {
        fontWeight = (textNode.fontName as FontName).style
      }

      const snippet = textNode.characters.trim()
        ? textNode.characters.trim().slice(0, 32)
        : textNode.name

      const status: 'PASS' | 'WARNING' = fontSize >= minSize ? 'PASS' : 'WARNING'

      items.push({
        nodeId: textNode.id,
        nodeName: textNode.name,
        textSnippet: snippet,
        fontSize,
        fontWeight,
        status,
      })
    }

    if ('children' in node) {
      for (const child of (node as ChildrenMixin).children) {
        scanNode(child)
      }
    }
  }

  if (scope === 'selection' && selection && selection.length > 0) {
    for (const root of selection) {
      scanNode(root)
    }
  } else {
    for (const root of figma.currentPage.children) {
      scanNode(root)
    }
  }

  const passCount = items.filter(i => i.status === 'PASS').length
  const warningCount = items.filter(i => i.status === 'WARNING').length

  // Sort warnings first, then smallest font size
  items.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'WARNING' ? -1 : 1
    }
    return a.fontSize - b.fontSize
  })

  return {
    minSize,
    items,
    passCount,
    warningCount,
  }
}
