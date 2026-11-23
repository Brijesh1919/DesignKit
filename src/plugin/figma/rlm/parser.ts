// ============================================================
// src/plugin/figma/rlm/parser.ts
// Read-Only SceneNode Graph Parser into RLMNode Hierarchy
// 100% Offline & Deterministic — Zero External Dependencies
// ============================================================

import type {
  RLMCornerRadii,
  RLMGeometry,
  RLMNode,
  RLMStyle,
  RLMTypography,
} from './types'

function extractCornerRadii(node: SceneNode): RLMCornerRadii {
  if ('cornerRadius' in node && typeof (node as any).cornerRadius === 'number' && (node as any).cornerRadius > 0) {
    const r = (node as any).cornerRadius || 0
    return { tl: r, tr: r, bl: r, br: r }
  }
  if ('topLeftRadius' in node && typeof (node as any).topLeftRadius === 'number') {
    return {
      tl: (node as any).topLeftRadius || 0,
      tr: (node as any).topRightRadius || 0,
      bl: (node as any).bottomLeftRadius || 0,
      br: (node as any).bottomRightRadius || 0,
    }
  }
  if ('cornerRadius' in node && typeof (node as any).cornerRadius === 'number') {
    const r = (node as any).cornerRadius || 0
    return { tl: r, tr: r, bl: r, br: r }
  }
  return { tl: 0, tr: 0, bl: 0, br: 0 }
}

function extractStyle(node: SceneNode): RLMStyle {
  const fills: Paint[] = 'fills' in node && Array.isArray((node as any).fills)
    ? [...(node as any).fills]
    : []
  const strokes: Paint[] = 'strokes' in node && Array.isArray((node as any).strokes)
    ? [...(node as any).strokes]
    : []
  const effects: Effect[] = 'effects' in node && Array.isArray((node as any).effects)
    ? [...(node as any).effects]
    : []
  const clipsContent = 'clipsContent' in node ? !!(node as any).clipsContent : false
  const opacity = 'opacity' in node && typeof (node as any).opacity === 'number'
    ? (node as any).opacity
    : 1
  const strokeWeight = 'strokeWeight' in node && typeof (node as any).strokeWeight === 'number'
    ? (node as any).strokeWeight
    : 0
  const layoutPositioning = 'layoutPositioning' in node ? (node as any).layoutPositioning : 'AUTO'

  return {
    fills,
    strokes,
    strokeWeight,
    effects,
    opacity,
    cornerRadii: extractCornerRadii(node),
    clipsContent,
    layoutPositioning,
  }
}

function extractTypography(node: SceneNode): RLMTypography | undefined {
  if (node.type !== 'TEXT') return undefined
  const t = node as TextNode
  const chars = t.characters || ''
  const fontSize = typeof t.fontSize === 'number' ? t.fontSize : 16
  const isSingleLine = !chars.includes('\n')

  return {
    characters: chars,
    fontSize,
    fontName: t.fontName,
    lineHeight: t.lineHeight,
    textAlignHorizontal: t.textAlignHorizontal || 'LEFT',
    textAlignVertical: t.textAlignVertical,
    textCase: t.textCase,
    isSingleLine,
    naturalWidth: t.width,
  }
}

function extractGeometry(node: SceneNode): RLMGeometry {
  const x = 'x' in node ? Math.round((node as any).x || 0) : 0
  const y = 'y' in node ? Math.round((node as any).y || 0) : 0
  const width = Math.max(1, Math.round(node.width || 0))
  const height = Math.max(1, Math.round(node.height || 0))
  const rotation = 'rotation' in node && typeof (node as any).rotation === 'number'
    ? (node as any).rotation
    : 0

  return { x, y, width, height, rotation }
}

/**
 * Recursively parses a Figma SceneNode into a pure in-memory RLMNode.
 * Completely READ-ONLY: never mutates, resizes, or detaches any nodes.
 */
export function parseSceneNodeToRLM(
  node: SceneNode,
  parent?: RLMNode,
  maxDepth = 10
): RLMNode {
  const geometry = extractGeometry(node)
  const style = extractStyle(node)
  const typography = extractTypography(node)
  const isInstance = node.type === 'INSTANCE'
  const isComponent = node.type === 'COMPONENT'
  const isImage = style.fills.some(f => f.type === 'IMAGE' && f.visible !== false)
  const isVectorIcon = (node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION') && geometry.width <= 56 && geometry.height <= 56

  const rlmNode: RLMNode = {
    id: node.id,
    name: node.name || '',
    originalType: node.type,
    figmaNodeRef: node,
    role: 'UNKNOWN',
    confidence: 0,
    geometry,
    style,
    typography,
    isInstance,
    isComponent,
    isImage,
    isVectorIcon,
    children: [],
    parent,
    intent: {
      layoutMode: 'NONE',
      horizontalSizing: 'FILL',
      verticalSizing: 'HUG',
      itemSpacing: 12,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      alignItems: 'MIN',
      justifyContent: 'MIN',
      preserveInstance: isInstance,
      isAbsoluteInAutoLayout: style.layoutPositioning === 'ABSOLUTE',
    },
  }

  // Parse children if available and within max depth
  if ('children' in node && maxDepth > 0) {
    const rawKids = (node as any).children
    if (Array.isArray(rawKids)) {
      for (let i = 0; i < rawKids.length; i++) {
        const kid = rawKids[i]
        if (!kid) continue
        // Ignore invisible layers to keep model clean
        if ('visible' in kid && kid.visible === false) continue
        const childRLM = parseSceneNodeToRLM(kid as SceneNode, rlmNode, maxDepth - 1)
        rlmNode.children.push(childRLM)
      }
    }
  }

  return rlmNode
}
