// ============================================================
// Cleanup feature module for Figma plugin sandbox.
// Covers: Design Audit, Layer Cleanup, Style Cleanup.
// ============================================================

import type {
  DesignAuditReport,
  DesignAuditIssue,
  LayerCleanupAnalysis,
  LayerCleanupCandidate,
  ApplyLayerCleanupPayload,
  StyleCleanupAnalysis,
  UnusedStyleItem,
  DuplicateStyleItem,
  ApplyDeleteStylesPayload,
} from '../../shared/types'
import { isGenericName } from './components'
import { figmaRgbToHex } from './utilities'

// -------------------------------------------------------
// 1. DESIGN AUDIT
// -------------------------------------------------------
export function getDesignAudit(
  selection: readonly SceneNode[],
  scope: 'selection' | 'page' = 'selection'
): DesignAuditReport {
  const issues: DesignAuditIssue[] = []
  let issueIdCounter = 1

  function addIssue(
    node: SceneNode,
    category: 'Naming' | 'Structure' | 'Visibility' | 'Styles',
    severity: 'Critical' | 'Warning' | 'Suggestion',
    message: string,
    details?: string
  ) {
    issues.push({
      id: String(issueIdCounter++),
      nodeId: node.id,
      nodeName: node.name,
      category,
      severity,
      message,
      details,
    })
  }

  function auditNode(node: SceneNode, depth: number, siblingNames: Set<string>) {
    // 1. Naming Checks
    if (isGenericName(node.name)) {
      if (node.type === 'COMPONENT') {
        addIssue(node, 'Naming', 'Warning', `Component has generic name "${node.name}"`, 'Consider giving components clear, semantic names (e.g. Button/Primary).')
      } else {
        addIssue(node, 'Naming', 'Suggestion', `Generic layer name "${node.name}"`, 'Standardizing layer names improves project organization.')
      }
    }

    if (siblingNames.has(node.name) && !isGenericName(node.name)) {
      addIssue(node, 'Naming', 'Suggestion', `Duplicate sibling layer name "${node.name}"`, 'Multiple sibling layers have the exact same custom name.')
    } else {
      siblingNames.add(node.name)
    }

    // 2. Visibility / State
    if (node.visible === false) {
      addIssue(node, 'Visibility', 'Warning', `Hidden layer "${node.name}"`, 'Hidden layers increase file complexity and can cause unexpected layout issues.')
    }

    if (node.locked) {
      addIssue(node, 'Visibility', 'Suggestion', `Locked layer "${node.name}"`, 'Layer is locked, which prevents direct editing.')
    }

    // 3. Structure Checks
    if (depth > 6) {
      addIssue(node, 'Structure', 'Warning', `Excessive nesting depth (level ${depth})`, 'Deeply nested hierarchies can hurt editing performance and layout readability.')
    }

    if (node.type === 'FRAME') {
      const frame = node as FrameNode
      const hasChildren = frame.children.length > 0
      const hasFills = Array.isArray(frame.fills) && (frame.fills as Paint[]).length > 0
      const hasStrokes = Array.isArray(frame.strokes) && (frame.strokes as Paint[]).length > 0
      const hasEffects = Array.isArray(frame.effects) && (frame.effects as Effect[]).length > 0

      if (!hasChildren && !hasFills && !hasStrokes && !hasEffects) {
        addIssue(node, 'Structure', 'Warning', `Empty frame "${node.name}" with no content or styling`, 'Empty frame can be removed with Layer Cleanup.')
      }
    }

    if (node.type === 'GROUP') {
      const group = node as GroupNode
      if (group.children.length === 0) {
        addIssue(node, 'Structure', 'Warning', `Empty group "${node.name}"`, 'Empty group contains no layers.')
      } else if (group.children.length === 1) {
        addIssue(node, 'Structure', 'Suggestion', `Redundant single-child group "${node.name}"`, 'Group wraps only 1 layer and can be unwrapped.')
      }
    }

    // 4. Styles Checks
    if (node.type === 'TEXT') {
      const textNode = node as TextNode
      if (!textNode.textStyleId) {
        addIssue(node, 'Styles', 'Suggestion', `Unlinked typography style on "${node.name}"`, 'Text does not use a local text style token.')
      }
    }

    if ('fills' in node && Array.isArray(node.fills) && (node.fills as Paint[]).length > 0) {
      const fill = (node.fills as Paint[])[0]
      if (fill.type === 'SOLID' && !('fillStyleId' in node && (node as GeometryMixin).fillStyleId)) {
        addIssue(node, 'Styles', 'Suggestion', `Unlinked color fill on "${node.name}"`, 'Solid color is not linked to a local color style.')
      }
    }

    // Recurse children
    if ('children' in node) {
      const childSiblings = new Set<string>()
      for (const child of (node as ChildrenMixin).children) {
        auditNode(child, depth + 1, childSiblings)
      }
    }
  }

  if (scope === 'selection' && selection && selection.length > 0) {
    const rootSiblings = new Set<string>()
    for (const root of selection) {
      auditNode(root, 1, rootSiblings)
    }
  } else {
    const rootSiblings = new Set<string>()
    for (const root of figma.currentPage.children) {
      auditNode(root, 1, rootSiblings)
    }
  }

  const counts = {
    Naming: issues.filter(i => i.category === 'Naming').length,
    Structure: issues.filter(i => i.category === 'Structure').length,
    Visibility: issues.filter(i => i.category === 'Visibility').length,
    Styles: issues.filter(i => i.category === 'Styles').length,
  }

  // Sort: Critical -> Warning -> Suggestion
  const severityRank = { Critical: 0, Warning: 1, Suggestion: 2 }
  issues.sort((a, b) => severityRank[a.severity] - severityRank[b.severity])

  return {
    totalIssues: issues.length,
    counts,
    issues,
  }
}

// -------------------------------------------------------
// 2. LAYER CLEANUP
// -------------------------------------------------------
export function getLayerCleanupCandidates(
  selection: readonly SceneNode[],
  scope: 'selection' | 'page' = 'selection'
): LayerCleanupAnalysis {
  const candidates: LayerCleanupCandidate[] = []
  const visited = new Set<string>()

  function scan(node: SceneNode) {
    if (visited.has(node.id)) return
    visited.add(node.id)

    // 1. Empty Frame
    if (node.type === 'FRAME') {
      const frame = node as FrameNode
      const hasChildren = frame.children.length > 0
      const hasFills = Array.isArray(frame.fills) && (frame.fills as Paint[]).length > 0
      const hasStrokes = Array.isArray(frame.strokes) && (frame.strokes as Paint[]).length > 0
      const hasEffects = Array.isArray(frame.effects) && (frame.effects as Effect[]).length > 0

      if (!hasChildren && !hasFills && !hasStrokes && !hasEffects) {
        candidates.push({
          nodeId: node.id,
          nodeName: node.name,
          nodeType: 'FRAME',
          reason: 'Empty frame with 0 children and no styling',
          action: 'delete',
          checked: true,
        })
      }
    }

    // 2. Empty Group
    if (node.type === 'GROUP') {
      const group = node as GroupNode
      if (group.children.length === 0) {
        candidates.push({
          nodeId: node.id,
          nodeName: node.name,
          nodeType: 'GROUP',
          reason: 'Empty group container with 0 children',
          action: 'delete',
          checked: true,
        })
      } else if (group.children.length === 1) {
        // Redundant single-child group
        candidates.push({
          nodeId: node.id,
          nodeName: node.name,
          nodeType: 'GROUP',
          reason: 'Redundant group wrapping exactly 1 child layer',
          action: 'unwrap',
          checked: true,
        })
      }
    }

    // 3. Invisible empty layers
    if (node.visible === false && 'children' in node && (node as ChildrenMixin).children.length === 0) {
      candidates.push({
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        reason: 'Hidden empty container',
        action: 'delete',
        checked: true,
      })
    }

    if ('children' in node) {
      for (const child of (node as ChildrenMixin).children) {
        scan(child)
      }
    }
  }

  if (scope === 'selection' && selection && selection.length > 0) {
    for (const root of selection) scan(root)
  } else {
    for (const root of figma.currentPage.children) scan(root)
  }

  return { candidates }
}

export async function applyLayerCleanup(
  payload: ApplyLayerCleanupPayload
): Promise<number> {
  let cleanedCount = 0
  const candidateIdSet = new Set(payload.candidateIds)

  for (const id of payload.candidateIds) {
    const node = figma.getNodeById(id)
    if (!node || node.type === 'PAGE' || node.type === 'DOCUMENT') continue

    try {
      if (node.type === 'GROUP' && (node as GroupNode).children.length === 1) {
        // Safe unwrap: move child to group's parent at group's index
        const group = node as GroupNode
        const parent = group.parent || figma.currentPage
        const child = group.children[0]
        const origX = child.x
        const origY = child.y
        const index = parent.children.indexOf(group)

        if (index >= 0) {
          parent.insertChild(index, child)
        } else {
          parent.appendChild(child)
        }
        child.x = origX
        child.y = origY
        group.remove()
        cleanedCount++
      } else {
        // Safe delete
        node.remove()
        cleanedCount++
      }
    } catch (err) {
      console.warn(`[DesignKit] Could not clean node ${id}:`, err)
    }
  }

  return cleanedCount
}

// -------------------------------------------------------
// 3. STYLE CLEANUP
// -------------------------------------------------------
export function getStyleCleanupAnalysis(): StyleCleanupAnalysis {
  const paintStyles = figma.getLocalPaintStyles()
  const textStyles = figma.getLocalTextStyles()
  const effectStyles = figma.getLocalEffectStyles()
  const gridStyles = figma.getLocalGridStyles()

  // Track usage counts
  const usageMap = new Map<string, number>()

  function recordUsage(id: string | null | undefined | symbol) {
    if (typeof id === 'string' && id) {
      usageMap.set(id, (usageMap.get(id) || 0) + 1)
    }
  }

  function scanNode(node: BaseNode) {
    if ('fillStyleId' in node) recordUsage((node as GeometryMixin).fillStyleId)
    if ('strokeStyleId' in node) recordUsage((node as GeometryMixin).strokeStyleId)
    if ('textStyleId' in node) recordUsage((node as TextNode).textStyleId)
    if ('effectStyleId' in node) recordUsage((node as BlendMixin).effectStyleId)
    if ('gridStyleId' in node) recordUsage((node as FrameNode).gridStyleId)

    if ('children' in node) {
      for (const child of (node as ChildrenMixin).children) {
        scanNode(child)
      }
    }
  }

  for (const page of figma.root.children) {
    scanNode(page)
  }

  const unusedStyles: UnusedStyleItem[] = []

  for (const s of paintStyles) {
    if (!usageMap.has(s.id) || usageMap.get(s.id) === 0) {
      let details = ''
      if (s.paints.length > 0 && s.paints[0].type === 'SOLID') {
        const c = s.paints[0].color
        details = figmaRgbToHex(c.r, c.g, c.b)
      }
      unusedStyles.push({ id: s.id, name: s.name, type: 'PAINT', details })
    }
  }

  for (const s of textStyles) {
    if (!usageMap.has(s.id) || usageMap.get(s.id) === 0) {
      unusedStyles.push({ id: s.id, name: s.name, type: 'TEXT', details: `${s.fontSize}px` })
    }
  }

  for (const s of effectStyles) {
    if (!usageMap.has(s.id) || usageMap.get(s.id) === 0) {
      unusedStyles.push({ id: s.id, name: s.name, type: 'EFFECT' })
    }
  }

  for (const s of gridStyles) {
    if (!usageMap.has(s.id) || usageMap.get(s.id) === 0) {
      unusedStyles.push({ id: s.id, name: s.name, type: 'GRID' })
    }
  }

  // Detect duplicate paint styles
  const duplicateStyles: DuplicateStyleItem[] = []
  const paintValueMap = new Map<string, PaintStyle>()

  for (const s of paintStyles) {
    if (s.paints.length > 0 && s.paints[0].type === 'SOLID') {
      const c = s.paints[0].color
      const hex = figmaRgbToHex(c.r, c.g, c.b)
      if (paintValueMap.has(hex)) {
        const existing = paintValueMap.get(hex)!
        duplicateStyles.push({
          styleId: s.id,
          styleName: s.name,
          duplicateOfId: existing.id,
          duplicateOfName: existing.name,
          type: 'PAINT',
        })
      } else {
        paintValueMap.set(hex, s)
      }
    }
  }

  return {
    unusedStyles,
    duplicateStyles,
    counts: {
      unusedPaint: unusedStyles.filter(s => s.type === 'PAINT').length,
      unusedText: unusedStyles.filter(s => s.type === 'TEXT').length,
      unusedEffect: unusedStyles.filter(s => s.type === 'EFFECT').length,
      unusedGrid: unusedStyles.filter(s => s.type === 'GRID').length,
      duplicates: duplicateStyles.length,
    },
  }
}

export async function applyDeleteStyles(
  payload: ApplyDeleteStylesPayload
): Promise<number> {
  let count = 0
  for (const id of payload.styleIds) {
    const style = figma.getStyleById(id)
    if (style) {
      style.remove()
      count++
    }
  }
  return count
}
