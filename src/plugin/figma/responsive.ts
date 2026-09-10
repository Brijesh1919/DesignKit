// ============================================================
// Responsive feature module for Figma plugin sandbox.
// Covers: Responsive Checker (Audit), Breakpoint Preview,
// and Responsive CSS generation.
// 100% Local & Deterministic — No AI / No External Services.
// ============================================================

import type {
  ResponsiveAnalysis,
  ViewportAuditResult,
  ResponsiveIssue,
  ResponsiveCssData,
  ResponsiveSeverity,
} from '../../shared/types'
import { RESPONSIVE_PRESETS, ResponsivePreset, validateCustomViewport } from '../../shared/responsivePresets'

// -------------------------------------------------------
// 1. LIGHTWEIGHT INTERMEDIATE NODE REPRESENTATION
// -------------------------------------------------------

export interface ResponsiveNode {
  id: string
  name: string
  type: string
  x: number // Relative to root frame
  y: number // Relative to root frame
  width: number
  height: number
  layoutMode: 'NONE' | 'HORIZONTAL' | 'VERTICAL'
  primaryAxisSizingMode?: 'FIXED' | 'AUTO'
  counterAxisSizingMode?: 'FIXED' | 'AUTO'
  layoutGrow?: number
  layoutAlign?: string
  itemSpacing: number
  paddingLeft: number
  paddingRight: number
  paddingTop: number
  paddingBottom: number
  characters: string
  fontSize: number
  isText: boolean
  isImage: boolean
  isFixedHorizontal: boolean
  children: ResponsiveNode[]
}

export function buildResponsiveTree(
  node: SceneNode,
  rootX = 0,
  rootY = 0,
  depth = 0
): ResponsiveNode {
  const currentAbsX = 'x' in node ? node.x : 0
  const currentAbsY = 'y' in node ? node.y : 0

  // For root node, relative coordinates are 0, 0
  const relX = depth === 0 ? 0 : currentAbsX
  const relY = depth === 0 ? 0 : currentAbsY

  const width = Math.round(node.width || 0)
  const height = Math.round(node.height || 0)

  let layoutMode: 'NONE' | 'HORIZONTAL' | 'VERTICAL' = 'NONE'
  let itemSpacing = 0
  let paddingLeft = 0
  let paddingRight = 0
  let paddingTop = 0
  let paddingBottom = 0
  let primaryAxisSizingMode: 'FIXED' | 'AUTO' | undefined
  let counterAxisSizingMode: 'FIXED' | 'AUTO' | undefined
  let layoutGrow: number | undefined
  let layoutAlign: string | undefined

  if ('layoutMode' in node) {
    const f = node as FrameNode
    layoutMode = f.layoutMode
    itemSpacing = Math.round(f.itemSpacing || 0)
    paddingLeft = Math.round(f.paddingLeft || 0)
    paddingRight = Math.round(f.paddingRight || 0)
    paddingTop = Math.round(f.paddingTop || 0)
    paddingBottom = Math.round(f.paddingBottom || 0)
    primaryAxisSizingMode = f.primaryAxisSizingMode
    counterAxisSizingMode = f.counterAxisSizingMode
  }

  if ('layoutGrow' in node) {
    layoutGrow = (node as any).layoutGrow
  }
  if ('layoutAlign' in node) {
    layoutAlign = (node as any).layoutAlign
  }

  let characters = ''
  let fontSize = 16
  const isText = node.type === 'TEXT'
  if (isText) {
    const textNode = node as TextNode
    characters = textNode.characters || ''
    if (typeof textNode.fontSize === 'number') {
      fontSize = textNode.fontSize
    }
  }

  let isImage = false
  if ('fills' in node && Array.isArray(node.fills)) {
    for (const f of node.fills as Paint[]) {
      if (f.type === 'IMAGE' && f.visible !== false) {
        isImage = true
        break
      }
    }
  }

  const isFixedHorizontal =
    layoutMode !== 'NONE'
      ? (layoutMode === 'HORIZONTAL' ? primaryAxisSizingMode === 'FIXED' : counterAxisSizingMode === 'FIXED')
      : true

  const childNodes: ResponsiveNode[] = []
  if ('children' in node && (node as any).children) {
    try {
      for (const child of (node as ChildrenMixin).children) {
        try {
          if ('removed' in child && (child as any).removed) continue
          if ('visible' in child && child.visible === false) continue
          childNodes.push(buildResponsiveTree(child, rootX, rootY, depth + 1))
        } catch (_) {}
      }
    } catch (_) {}
  }

  return {
    id: node.id,
    name: node.name || 'Layer',
    type: node.type,
    x: relX,
    y: relY,
    width,
    height,
    layoutMode,
    primaryAxisSizingMode,
    counterAxisSizingMode,
    layoutGrow,
    layoutAlign,
    itemSpacing,
    paddingLeft,
    paddingRight,
    paddingTop,
    paddingBottom,
    characters,
    fontSize,
    isText,
    isImage,
    isFixedHorizontal,
    children: childNodes,
  }
}

// -------------------------------------------------------
// 2. VIEWPORT AUDIT ENGINE
// -------------------------------------------------------

export function auditTreeForViewport(
  root: ResponsiveNode,
  viewport: ResponsivePreset
): ViewportAuditResult {
  const issues: ResponsiveIssue[] = []
  const vWidth = viewport.width
  const vHeight = viewport.height

  function scanNode(node: ResponsiveNode, parent: ResponsiveNode | null, currentAbsoluteX: number) {
    const nodeRight = currentAbsoluteX + node.width

    // 1. Horizontal Overflow (FAIL)
    if (nodeRight > vWidth + 4) {
      const overflowPx = Math.round(nodeRight - vWidth)
      issues.push({
        id: `${viewport.id}-overflow-${node.id}`,
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        viewportId: viewport.id,
        viewportName: viewport.name,
        severity: 'FAIL',
        category: 'overflow',
        message: `Extends ${overflowPx}px beyond ${viewport.name} viewport width (${vWidth}px)`,
        details: `Element bounds: ${Math.round(node.width)}×${Math.round(node.height)}px at X:${Math.round(currentAbsoluteX)}px.`,
        width: node.width,
        height: node.height,
      })
    }

    // 2. Fixed Width Elements Exceeding Viewport (FAIL / WARNING)
    if (node.width > vWidth && node !== root) {
      const diff = Math.round(node.width - vWidth)
      issues.push({
        id: `${viewport.id}-fixed-${node.id}`,
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        viewportId: viewport.id,
        viewportName: viewport.name,
        severity: diff > 40 ? 'FAIL' : 'WARNING',
        category: 'fixed-width',
        message: `Fixed width (${node.width}px) is larger than ${viewport.name} width (${vWidth}px)`,
        details: `Container needs fluid sizing (e.g. max-width: 100%) on ${viewport.name}.`,
        width: node.width,
        height: node.height,
      })
    }

    // 3. Horizontal Row Stacking Necessity (WARNING)
    if (
      node.layoutMode === 'HORIZONTAL' &&
      node.children.length >= 2 &&
      vWidth <= 768 &&
      node.width > vWidth * 0.85
    ) {
      issues.push({
        id: `${viewport.id}-stack-${node.id}`,
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        viewportId: viewport.id,
        viewportName: viewport.name,
        severity: 'WARNING',
        category: 'stacking',
        message: `Horizontal layout with ${node.children.length} items (${node.width}px) should stack vertically on ${viewport.name}`,
        details: `Auto Layout flex-direction should switch to column on screens <= ${vWidth}px.`,
        width: node.width,
        height: node.height,
      })
    }

    // 4. Horizontal Auto Layout Row Overflow on Mobile (navigation / wide rows)
    if (
      node.layoutMode === 'HORIZONTAL' &&
      vWidth <= 768 &&
      node.width > vWidth * 0.85 &&
      node.height <= 120 // Likely a nav or toolbar row
    ) {
      issues.push({
        id: `${viewport.id}-nav-${node.id}`,
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        viewportId: viewport.id,
        viewportName: viewport.name,
        severity: vWidth <= 480 ? 'FAIL' : 'WARNING',
        category: 'navigation',
        message: `Horizontal row (${node.width}px) is too wide for ${viewport.name} (${vWidth}px)`,
        details: `Consider collapsing horizontal navigation / toolbar into a compact mobile layout on ${viewport.name}.`,
        width: node.width,
        height: node.height,
      })
    }

    // 5. Text Size & Wrapping Issues on Narrow Viewports (WARNING)
    if (node.isText) {
      if (vWidth <= 390 && node.fontSize >= 32 && node.characters.length > 20) {
        issues.push({
          id: `${viewport.id}-text-${node.id}`,
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          viewportId: viewport.id,
          viewportName: viewport.name,
          severity: 'WARNING',
          category: 'text-wrap',
          message: `Large heading (${Math.round(node.fontSize)}px) may cause awkward multi-line text wrapping on ${viewport.name}`,
          details: `Consider reducing font size to ~24–28px or using responsive clamp() on mobile.`,
          width: node.width,
          height: node.height,
        })
      }
    }

    // 6. Excessive Horizontal Spacing / Padding (WARNING)
    if (vWidth <= 390 && (node.paddingLeft + node.paddingRight) >= 48) {
      const totalPad = node.paddingLeft + node.paddingRight
      const pct = Math.round((totalPad / vWidth) * 100)
      issues.push({
        id: `${viewport.id}-spacing-${node.id}`,
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        viewportId: viewport.id,
        viewportName: viewport.name,
        severity: 'WARNING',
        category: 'spacing',
        message: `Horizontal padding (${totalPad}px) takes up ${pct}% of ${viewport.name} screen width`,
        details: `Reduce padding to 16–20px on mobile screens to preserve content area.`,
        width: node.width,
        height: node.height,
      })
    }

    // Recurse down children
    for (const child of node.children) {
      scanNode(child, node, currentAbsoluteX + child.x)
    }
  }

  // Scan hierarchy starting at root
  scanNode(root, null, 0)

  // Determine overall viewport status
  const hasFail = issues.some(i => i.severity === 'FAIL')
  const hasWarn = issues.some(i => i.severity === 'WARNING')
  const status: ResponsiveSeverity = hasFail ? 'FAIL' : hasWarn ? 'WARNING' : 'PASS'

  return {
    viewportId: viewport.id,
    viewportName: viewport.name,
    width: vWidth,
    height: vHeight,
    status,
    issues,
  }
}

// -------------------------------------------------------
// 3. MAIN ANALYSIS FUNCTION (AUDIT)
// -------------------------------------------------------

export function getResponsiveAnalysis(
  selection: readonly SceneNode[],
  customDimensions?: { customWidth?: number; customHeight?: number }
): ResponsiveAnalysis | null {
  if (!selection || selection.length === 0) {
    return null
  }

  // Find first suitable frame / container
  const targetNode = selection.find(
    n => n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'GROUP' || n.type === 'SECTION'
  ) || selection[0]

  if (!targetNode || !('width' in targetNode)) {
    return null
  }

  // Build tree representation once
  const tree = buildResponsiveTree(targetNode)

  // Construct active preset list
  const activePresets: ResponsivePreset[] = [...RESPONSIVE_PRESETS]

  if (
    customDimensions &&
    typeof customDimensions.customWidth === 'number' &&
    typeof customDimensions.customHeight === 'number'
  ) {
    const valid = validateCustomViewport(customDimensions.customWidth, customDimensions.customHeight)
    if (valid.valid) {
      activePresets.push({
        id: 'custom',
        name: `Custom (${customDimensions.customWidth}×${customDimensions.customHeight})`,
        width: Math.round(customDimensions.customWidth),
        height: Math.round(customDimensions.customHeight),
        description: 'User specified custom viewport',
      })
    }
  }

  // Run audit against each viewport preset
  const results: ViewportAuditResult[] = activePresets.map(preset =>
    auditTreeForViewport(tree, preset)
  )

  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0)
  const hasFailures = results.some(r => r.status === 'FAIL')

  return {
    frameId: targetNode.id,
    frameName: targetNode.name,
    frameWidth: Math.round(targetNode.width),
    frameHeight: Math.round(targetNode.height),
    results,
    totalIssues,
    hasFailures,
  }
}

// -------------------------------------------------------
// 4. RESPONSIVE CSS GENERATOR WITH MEDIA QUERIES
// -------------------------------------------------------

function sanitizeClassName(name: string): string {
  let clean = name
    .toLowerCase()
    .replace(/[/\\]+/g, '-')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!clean || /^\d+$/.test(clean)) {
    clean = `el-${clean || 'container'}`
  }
  return clean
}

export function getResponsiveCssForSelection(
  selection: readonly SceneNode[]
): ResponsiveCssData | null {
  if (!selection || selection.length === 0) return null

  const rootNode = selection.find(
    n => n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'GROUP' || n.type === 'SECTION'
  ) || selection[0]

  if (!rootNode || !('width' in rootNode)) return null

  const rootTree = buildResponsiveTree(rootNode)
  const baseRules: string[] = []
  const tabletRules: string[] = []
  const mobileRules: string[] = []
  const smallMobileRules: string[] = []

  let mediaQueriesCount = 0

  function generateRules(node: ResponsiveNode, isRoot: boolean) {
    const className = sanitizeClassName(node.name)

    // Base Desktop Rule
    const baseProps: string[] = []
    if (isRoot) {
      baseProps.push(`  width: 100%;`)
      baseProps.push(`  max-width: ${node.width}px;`)
      baseProps.push(`  margin: 0 auto;`)
    }

    if (node.layoutMode !== 'NONE') {
      baseProps.push(`  display: flex;`)
      baseProps.push(`  flex-direction: ${node.layoutMode === 'HORIZONTAL' ? 'row' : 'column'};`)
      if (node.itemSpacing > 0) baseProps.push(`  gap: ${node.itemSpacing}px;`)
      if (node.paddingTop > 0 || node.paddingLeft > 0) {
        if (node.paddingTop === node.paddingLeft && node.paddingLeft === node.paddingRight && node.paddingRight === node.paddingBottom) {
          baseProps.push(`  padding: ${node.paddingTop}px;`)
        } else {
          baseProps.push(`  padding: ${node.paddingTop}px ${node.paddingRight}px ${node.paddingBottom}px ${node.paddingLeft}px;`)
        }
      }
    }

    if (node.isText && node.fontSize) {
      baseProps.push(`  font-size: ${Math.round(node.fontSize)}px;`)
    }

    if (baseProps.length > 0) {
      baseRules.push(`.${className} {\n${baseProps.join('\n')}\n}`)
    }

    // Tablet Overrides (@media max-width: 768px)
    const tabProps: string[] = []
    if (node.layoutMode === 'HORIZONTAL' && node.children.length >= 2 && node.width > 700) {
      tabProps.push(`  flex-direction: column;`)
      tabProps.push(`  gap: ${Math.max(16, Math.round(node.itemSpacing * 0.75))}px;`)
    }
    if ((node.paddingLeft + node.paddingRight) > 64) {
      tabProps.push(`  padding: ${Math.round(node.paddingTop * 0.75)}px 24px;`)
    }

    if (tabProps.length > 0) {
      tabletRules.push(`  .${className} {\n  ${tabProps.join('\n  ')}\n  }`)
    }

    // Mobile Overrides (@media max-width: 390px)
    const mobProps: string[] = []
    if (node.layoutMode === 'HORIZONTAL' && node.height <= 120 && node.width > 350) {
      // Structural: wide horizontal row on mobile → likely a nav/toolbar → collapse
      mobProps.push(`  flex-direction: column;`)
      mobProps.push(`  width: 100%;`)
    }
    if (node.isText && node.fontSize >= 32) {
      mobProps.push(`  font-size: ${Math.max(22, Math.round(node.fontSize * 0.65))}px;`)
    }
    if ((node.paddingLeft + node.paddingRight) >= 32) {
      mobProps.push(`  padding: 16px;`)
    }
    if (node.width > 350 && !isRoot) {
      mobProps.push(`  width: 100%;`)
      mobProps.push(`  max-width: 100%;`)
    }

    if (mobProps.length > 0) {
      mobileRules.push(`  .${className} {\n  ${mobProps.join('\n  ')}\n  }`)
    }

    // Small Mobile Overrides (@media max-width: 320px)
    const smMobProps: string[] = []
    if (node.isText && node.fontSize >= 28) {
      smMobProps.push(`  font-size: 20px;`)
    }
    if (node.paddingLeft >= 20 || node.paddingRight >= 20) {
      smMobProps.push(`  padding: 12px;`)
    }

    if (smMobProps.length > 0) {
      smallMobileRules.push(`  .${className} {\n  ${smMobProps.join('\n  ')}\n  }`)
    }

    for (const child of node.children) {
      generateRules(child, false)
    }
  }

  generateRules(rootTree, true)

  const outputSections: string[] = []

  // 1. Base Styles
  if (baseRules.length > 0) {
    outputSections.push(`/* Base Desktop Layout (>= 1440px) */\n` + baseRules.join('\n\n'))
  }

  // 2. Tablet Query
  if (tabletRules.length > 0) {
    mediaQueriesCount++
    outputSections.push(
      `/* Tablet Viewport (<= 768px) */\n@media (max-width: 768px) {\n${tabletRules.join('\n\n')}\n}`
    )
  }

  // 3. Mobile Query
  if (mobileRules.length > 0) {
    mediaQueriesCount++
    outputSections.push(
      `/* Mobile Viewport (<= 390px) */\n@media (max-width: 390px) {\n${mobileRules.join('\n\n')}\n}`
    )
  }

  // 4. Small Mobile Query
  if (smallMobileRules.length > 0) {
    mediaQueriesCount++
    outputSections.push(
      `/* Small Mobile Viewport (<= 320px) */\n@media (max-width: 320px) {\n${smallMobileRules.join('\n\n')}\n}`
    )
  }

  return {
    frameId: rootNode.id,
    frameName: rootNode.name,
    css: outputSections.join('\n\n'),
    mediaQueriesCount,
  }
}

// -------------------------------------------------------
// 5. MAKE RESPONSIVE — PREVIEW SUMMARY (NON-DESTRUCTIVE)
// -------------------------------------------------------

import type {
  ResponsivePreviewSummary,
  ResponsiveTransformSummary,
  ResponsiveTargetPreset,
} from '../../shared/types'
import { VIEWPORTS, applyResponsiveEngine, detectScreenArchetype, safeChildren } from './responsiveEngine'

export function getResponsivePreview(
  selection: readonly SceneNode[],
  presetId: ResponsiveTargetPreset
): ResponsivePreviewSummary | null {
  const target = selection.find(
    n => n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'GROUP' || n.type === 'SECTION'
  ) || selection[0]
  if (!target || !('width' in target)) return null

  const vp = VIEWPORTS[presetId]
  const origW = Math.round(target.width)
  const origH = Math.round(target.height)
  const vw = vp.width

  const predicted: string[] = []
  let issueCount = 0

  if (target.type === 'FRAME') {
    const archetype = detectScreenArchetype(target as FrameNode, origW, origH)
    predicted.push(`Screen Archetype: ${archetype.replace(/_/g, ' ')}`)
  }

  if (origW !== vw) {
    predicted.push(`Frame width: ${origW}px → ${vw}px (${vp.name} viewport)`)
    issueCount++
  }

  predicted.push(`Strategy: Structure-aware responsive reflow — each container analysed independently`)

  if ('children' in target) {
    const children = safeChildren(target)

    // Detect navigation-like sections (horizontal, near top, short height)
    const navCandidates = children.filter(c => {
      const y = 'y' in c ? (c as any).y : 0
      const h = c.height
      return y < origH * 0.20 && h <= 120
    })
    if (navCandidates.length >= 1) {
      predicted.push(`Navigation: compact mobile nav — brand preserved, links collapsed`)
      issueCount++
    }

    // Detect repeated collections
    const containers = children.filter(
      c => c.type === 'FRAME' || c.type === 'GROUP' || c.type === 'COMPONENT' || c.type === 'INSTANCE'
    )
    if (containers.length >= 3) {
      predicted.push(`Repeated collections: structurally similar items may reflow to 2-column grid`)
      issueCount++
    }

    // Detect Auto Layout frames
    const alFrames = children.filter(c => 'layoutMode' in c && (c as any).layoutMode !== 'NONE')
    if (alFrames.length > 0) {
      predicted.push(`Auto Layout: ${alFrames.length} AL frame(s) detected — direction preserved or adapted`)
      issueCount++
    }

    if (children.length > 0) {
      predicted.push(`${children.length} top-level sections will each receive an independent layout strategy`)
      issueCount++
    }
  }

  predicted.push(`Typography: responsive font scale applied to all text nodes`)
  predicted.push(`Dynamic flow: text wraps to drive section heights — no clipping`)
  predicted.push(`Layout clamping: all elements constrained to ${vp.padding}px mobile margins`)
  issueCount += 3

  return {
    frameName: target.name,
    frameWidth: origW,
    frameHeight: origH,
    targetViewport: vp.name,
    targetWidth: vp.width,
    targetHeight: vp.height,
    predictedChanges: predicted,
    issuesResolved: issueCount,
  }
}

// -------------------------------------------------------
// 6. MAKE RESPONSIVE — APPLY TRANSFORMATION (CLONE-FIRST)
// -------------------------------------------------------

export async function applyResponsiveTransform(
  selection: readonly SceneNode[],
  presetId: ResponsiveTargetPreset,
  offsetX = 100,
  offsetY = 0
): Promise<ResponsiveTransformSummary | null> {
  const originalNode = selection.find(
    n => n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'GROUP' || n.type === 'SECTION'
  ) || selection[0]

  if (!originalNode || originalNode.type !== 'FRAME') return null

  const vp = VIEWPORTS[presetId]
  const changeLog: string[] = []
  const origWidth = Math.round(originalNode.width)

  // Clone — original frame is NEVER touched
  const clone = originalNode.clone() as FrameNode
  clone.name = `${originalNode.name} — ${vp.name}`
  clone.x = originalNode.x + origWidth + offsetX
  clone.y = originalNode.y + offsetY

  // Delegate to the true responsive layout engine
  await applyResponsiveEngine(clone, presetId, changeLog)

  figma.currentPage.selection = [clone]
  figma.viewport.scrollAndZoomIntoView([clone])

  return {
    newFrameId: clone.id,
    newFrameName: clone.name,
    originalFrameName: originalNode.name,
    targetViewport: vp.name,
    targetWidth: vp.width,
    mutationsApplied: changeLog.length,
    changeLog,
  }
}
