// ============================================================
// src/plugin/figma/rlm/overflowAnalyzer.ts
// Dedicated Multi-Factor Overflow & Clipping Analysis Module
// 100% Offline & Deterministic — Zero External Dependencies
// ============================================================

import type { RLMNode, RLMViewport } from './types'
import { toBoundingBox, computeIntersectionArea } from './relationships'

export type OverflowClassification =
  | 'NONE'
  | 'ACCIDENTAL_OVERFLOW'
  | 'INTENTIONAL_DECORATIVE'
  | 'INTENTIONAL_OVERLAP'
  | 'SCROLLABLE_CONTAINER'
  | 'INCORRECT_BACKGROUND_SIZE'
  | 'CLIPPED_ESSENTIAL_CONTENT'

export interface OverflowIssue {
  nodeId: string
  nodeName: string
  role: string
  classification: OverflowClassification
  overflowLeft: number
  overflowRight: number
  overflowBottom: number
  isClipped: boolean
  hasEssentialContent: boolean
  correctionNeeded: boolean
  suggestedAction: string
}

export interface SectionOverflowReport {
  sectionId: string
  sectionName: string
  hasAccidentalOverflow: boolean
  hasClippedContent: boolean
  issues: OverflowIssue[]
  recommendedClipping: boolean
}

/**
 * Checks if a node contains essential content that must NEVER be clipped
 * (such as readable text, CTA buttons, prices, or product titles).
 */
export function hasEssentialContent(node: RLMNode): boolean {
  if (node.typography && node.typography.characters.trim().length > 0) {
    return true
  }
  if (node.role === 'BUTTON_PRIMARY' || node.role === 'BUTTON_SECONDARY' || node.role === 'BADGE_OR_PILL') {
    return true
  }
  for (const child of node.children) {
    if (hasEssentialContent(child)) return true
  }
  return false
}

/**
 * Checks if a node is an intentional decorative element or background.
 */
export function isIntentionalDecorative(node: RLMNode): boolean {
  if (node.role === 'DECORATIVE' || node.style.layoutPositioning === 'ABSOLUTE') {
    return true
  }
  const name = node.name.toLowerCase()
  if (/(glow|blob|blur|particle|ambient|sparkle|shadow|decor|accent)/i.test(name)) {
    return true
  }
  if ((node.originalType === 'VECTOR' || node.originalType === 'ELLIPSE' || node.originalType === 'STAR') &&
      node.geometry.width <= 72 && node.geometry.height <= 72 && node.children.length === 0) {
    return true
  }
  return false
}

/**
 * Analyzes a section and all its descendants for overflow and clipping issues.
 * Distinguishes accidental overflow from intentional overlaps and decorative layers.
 */
export function analyzeSectionOverflow(
  section: RLMNode,
  vp: RLMViewport,
  availableWidth: number
): SectionOverflowReport {
  const issues: OverflowIssue[] = []
  let hasAccidental = false
  let hasClipped = false

  const sectionBox = toBoundingBox(section.geometry)
  const maxAllowedW = Math.min(section.geometry.width || availableWidth, vp.width)

  function inspectNode(node: RLMNode, parentWidth: number, parentHeight: number) {
    // Background layers check
    if (node.role === 'BACKGROUND') {
      const isTooWide = node.geometry.width > parentWidth + 12
      const isTooTall = node.geometry.height > parentHeight + 20
      if (isTooWide || isTooTall) {
        issues.push({
          nodeId: node.id,
          nodeName: node.name,
          role: node.role,
          classification: 'INCORRECT_BACKGROUND_SIZE',
          overflowLeft: 0,
          overflowRight: Math.max(0, node.geometry.width - parentWidth),
          overflowBottom: Math.max(0, node.geometry.height - parentHeight),
          isClipped: section.style.clipsContent,
          hasEssentialContent: false,
          correctionNeeded: true,
          suggestedAction: 'Sync background dimensions to parent mobile bounds (FILL x FILL)',
        })
        hasAccidental = true
      }
      return
    }

    // Intentional decorative elements check
    if (isIntentionalDecorative(node)) {
      issues.push({
        nodeId: node.id,
        nodeName: node.name,
        role: node.role,
        classification: 'INTENTIONAL_DECORATIVE',
        overflowLeft: Math.max(0, -node.geometry.x),
        overflowRight: Math.max(0, (node.geometry.x + node.geometry.width) - parentWidth),
        overflowBottom: Math.max(0, (node.geometry.y + node.geometry.height) - parentHeight),
        isClipped: false,
        hasEssentialContent: false,
        correctionNeeded: false,
        suggestedAction: 'Preserve absolute positioning in Auto Layout (layoutPositioning = ABSOLUTE)',
      })
      return
    }

    // Scrollable rows check (e.g. horizontal categories or tables)
    if (node.role === 'TAG_CLOUD' || node.role === 'DATA_TABLE') {
      issues.push({
        nodeId: node.id,
        nodeName: node.name,
        role: node.role,
        classification: 'SCROLLABLE_CONTAINER',
        overflowLeft: 0,
        overflowRight: 0,
        overflowBottom: 0,
        isClipped: false,
        hasEssentialContent: true,
        correctionNeeded: false,
        suggestedAction: 'Wrap items in Auto Layout (layoutWrap = WRAP) or allow scroll',
      })
    }

    // Standard content nodes check
    const rightEdge = node.geometry.x + node.geometry.width
    const bottomEdge = node.geometry.y + node.geometry.height
    const overRight = rightEdge - parentWidth
    const overBottom = bottomEdge - parentHeight
    const essential = hasEssentialContent(node)

    // Check accidental horizontal overflow (e.g. desktop node with width 800 inside 350px mobile parent)
    if (overRight > 8 && node.role !== 'ROOT') {
      const isIntentionalOverlap = node.role === 'BADGE_OR_PILL' && node.geometry.x < 30
      const classification: OverflowClassification = isIntentionalOverlap
        ? 'INTENTIONAL_OVERLAP'
        : 'ACCIDENTAL_OVERFLOW'

      if (classification === 'ACCIDENTAL_OVERFLOW') {
        hasAccidental = true
      }

      issues.push({
        nodeId: node.id,
        nodeName: node.name,
        role: node.role,
        classification,
        overflowLeft: Math.max(0, -node.geometry.x),
        overflowRight: Math.max(0, overRight),
        overflowBottom: Math.max(0, overBottom),
        isClipped: section.style.clipsContent,
        hasEssentialContent: essential,
        correctionNeeded: classification === 'ACCIDENTAL_OVERFLOW',
        suggestedAction: classification === 'ACCIDENTAL_OVERFLOW'
          ? 'Recalculate child width to FILL available mobile width or HUG content'
          : 'Preserve badge overlay on card corner',
      })
    }

    // Check if essential content is being clipped by a short parent frame
    if (section.style.clipsContent && essential && overBottom > 10) {
      hasClipped = true
      issues.push({
        nodeId: node.id,
        nodeName: node.name,
        role: node.role,
        classification: 'CLIPPED_ESSENTIAL_CONTENT',
        overflowLeft: 0,
        overflowRight: Math.max(0, overRight),
        overflowBottom: overBottom,
        isClipped: true,
        hasEssentialContent: true,
        correctionNeeded: true,
        suggestedAction: 'Expand parent height (layoutSizingVertical = HUG) to prevent hiding text/actions',
      })
    }

    // Recurse into children
    for (const child of node.children) {
      inspectNode(child, Math.min(node.geometry.width, parentWidth), Math.max(node.geometry.height, 40))
    }
  }

  for (const child of section.children) {
    inspectNode(child, maxAllowedW, section.geometry.height)
  }

  // Recommended clipping determination for this section
  // - True if section has rounded corners and contains full-bleed media/background
  // - False if root screen, or simple section with text/buttons
  const hasRoundedBorder = section.style.cornerRadii.tl > 0 || section.style.cornerRadii.tr > 0
  const hasMediaChild = section.children.some(c => c.isImage || c.role === 'CARD_MEDIA' || c.role === 'BACKGROUND')
  const recommendedClipping = (hasRoundedBorder && hasMediaChild) || section.role === 'CARD'

  return {
    sectionId: section.id,
    sectionName: section.name,
    hasAccidentalOverflow: hasAccidental,
    hasClippedContent: hasClipped,
    issues,
    recommendedClipping,
  }
}
