import type { SelectionInfo } from '../../shared/types'

// -------------------------------------------------------
// Utility: build a SelectionInfo from the current Figma
// selection. Inspects node types and fill paints.
// -------------------------------------------------------
export function getSelectionInfo(selection: readonly SceneNode[]): SelectionInfo {
  const types = [...new Set(selection.map(n => n.type))]

  let hasImage = false
  let hasFrame = false
  let hasText = false

  for (const node of selection) {
    if (
      node.type === 'FRAME' ||
      node.type === 'GROUP' ||
      node.type === 'COMPONENT' ||
      node.type === 'COMPONENT_SET' ||
      node.type === 'INSTANCE'
    ) {
      hasFrame = true
    }
    if (node.type === 'TEXT') {
      hasText = true
    }
    if ('fills' in node) {
      const fills = node.fills as ReadonlyArray<Paint>
      for (const fill of fills) {
        if (fill.type === 'IMAGE') {
          hasImage = true
        }
      }
    }
  }

  return {
    count: selection.length,
    types,
    hasImage,
    hasFrame,
    hasText,
    nodeId: selection.length === 1 ? selection[0].id : undefined,
    nodeName: selection.length === 1 ? selection[0].name : undefined,
  }
}

// -------------------------------------------------------
// Utility: convert Figma [0–1] RGB → CSS hex string #RRGGBB.
// -------------------------------------------------------
export function figmaRgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.round(Math.max(0, Math.min(255, v * 255)))
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

// -------------------------------------------------------
// Utility: convert a CSS hex string → Figma [0–1] RGB.
// Returns null for invalid input.
// -------------------------------------------------------
export function hexToFigmaRgb(
  hex: string
): { r: number; g: number; b: number } | null {
  const clean = hex.replace(/^#/, '')
  if (!/^[0-9a-f]{6}$/i.test(clean)) return null
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
  }
}

