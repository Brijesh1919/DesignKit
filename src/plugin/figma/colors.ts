import type { ColorStyleDef } from '../../shared/types'
import { hexToFigmaRgb } from './utilities'

// -------------------------------------------------------
// Create (or update) local Figma paint styles from an
// array of { name, hex, groupName } definitions.
// Returns the number of styles successfully created.
// -------------------------------------------------------
export async function createColorStyles(colors: ColorStyleDef[]): Promise<number> {
  let created = 0
  const existing = figma.getLocalPaintStyles()

  for (const def of colors) {
    const rgb = hexToFigmaRgb(def.hex)
    if (!rgb) continue

    const fullName = def.groupName ? `${def.groupName}/${def.name}` : def.name

    try {
      let style = existing.find(s => s.name === fullName)
      if (!style) {
        style = figma.createPaintStyle()
        style.name = fullName
      }

      style.paints = [
        {
          type: 'SOLID',
          color: { r: rgb.r, g: rgb.g, b: rgb.b },
          opacity: 1,
        },
      ]

      created++
    } catch (err) {
      console.error(`[DesignKit] Failed to create color style "${fullName}":`, err)
    }
  }

  return created
}

// -------------------------------------------------------
// Apply a solid fill color to every node in the current
// selection that supports fills.
// -------------------------------------------------------
export async function applyColorToSelection(hex: string): Promise<void> {
  const selection = figma.currentPage.selection
  if (selection.length === 0) {
    throw new Error('No layers selected. Please select at least one layer first.')
  }

  const rgb = hexToFigmaRgb(hex)
  if (!rgb) throw new Error(`Invalid hex color: ${hex}`)

  const paint: SolidPaint = {
    type: 'SOLID',
    color: { r: rgb.r, g: rgb.g, b: rgb.b },
    opacity: 1,
  }

  for (const node of selection) {
    if ('fills' in node) {
      ;(node as GeometryMixin).fills = [paint]
    }
  }
}

// -------------------------------------------------------
// Analyze contrast for all text layers within current selection.
// Detects text color, font size/weight (large vs normal), and
// effective background color by inspecting parent node fills.
// -------------------------------------------------------
import type { FrameContrastAnalysis, FrameContrastItem } from '../../shared/types'
import { figmaRgbToHex } from './utilities'

export function getFrameContrastAnalysis(selection: readonly SceneNode[]): FrameContrastAnalysis | null {
  if (!selection || selection.length === 0) return null

  const textNodes: TextNode[] = []

  function findTextNodes(node: SceneNode) {
    if (node.type === 'TEXT') {
      textNodes.push(node)
    } else if ('children' in node) {
      for (const child of (node as ChildrenMixin).children) {
        findTextNodes(child)
      }
    }
  }

  for (const node of selection) {
    findTextNodes(node)
  }

  if (textNodes.length === 0) {
    return {
      frameId: selection[0].id,
      frameName: selection[0].name,
      items: [],
    }
  }

  const items: FrameContrastItem[] = []

  for (const textNode of textNodes) {
    // 1. Text color
    let textColor: string | null = null
    if ('fills' in textNode && Array.isArray(textNode.fills)) {
      for (const fill of textNode.fills as Paint[]) {
        if (fill.visible !== false && fill.type === 'SOLID') {
          textColor = figmaRgbToHex(fill.color.r, fill.color.g, fill.color.b)
          break
        }
      }
    }
    if (!textColor) textColor = '#000000'

    // 2. Background color from parent chain
    let backgroundColor: string | null = null
    let parent: BaseNode | null = textNode.parent
    while (parent && parent.type !== 'PAGE' && parent.type !== 'DOCUMENT') {
      if ('fills' in parent && Array.isArray((parent as GeometryMixin).fills)) {
        const fills = (parent as GeometryMixin).fills as Paint[]
        for (const fill of fills) {
          if (fill.visible !== false && fill.type === 'SOLID' && (fill.opacity === undefined || fill.opacity > 0)) {
            backgroundColor = figmaRgbToHex(fill.color.r, fill.color.g, fill.color.b)
            break
          }
        }
      }
      if (backgroundColor) break
      parent = parent.parent
    }

    // 3. Size and weight determination
    let fontSize = 16
    if (typeof textNode.fontSize === 'number') {
      fontSize = textNode.fontSize
    }

    let isBold = false
    if (typeof textNode.fontWeight === 'number') {
      isBold = textNode.fontWeight >= 600
    } else if (typeof textNode.fontName !== 'symbol' && textNode.fontName) {
      const styleName = (textNode.fontName as FontName).style.toLowerCase()
      if (styleName.includes('bold') || styleName.includes('semibold') || styleName.includes('medium')) {
        isBold = true
      }
    }

    // WCAG Large text: >= 24px (18pt) OR (>= 18.66px (14pt) AND bold)
    const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && isBold)

    const textSnippet = textNode.characters.trim() ? textNode.characters.trim().slice(0, 30) : textNode.name

    items.push({
      nodeId: textNode.id,
      nodeName: textNode.name,
      textSnippet,
      fontSize,
      isLargeText,
      textColor,
      backgroundColor,
    })
  }

  const rootName = selection.length === 1 ? selection[0].name : `${selection.length} layers`

  return {
    frameId: selection[0].id,
    frameName: rootName,
    items,
  }
}

