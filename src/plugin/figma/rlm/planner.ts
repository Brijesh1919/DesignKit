// ============================================================
// src/plugin/figma/rlm/planner.ts
// Responsive Layout Planner (Pure Decision Engine)
// 100% Offline & Deterministic — Zero External Dependencies
// ============================================================

import type { RLMNode, RLMViewport } from './types'

/**
 * Calculates responsive mobile font size.
 */
export function getMobileFontSize(desktopSize: number, vpWidth: number): number {
  if (vpWidth >= 768) {
    if (desktopSize >= 72) return 40
    if (desktopSize >= 56) return 34
    if (desktopSize >= 44) return 28
    if (desktopSize >= 36) return 24
    if (desktopSize >= 28) return 20
    return desktopSize
  }

  // Mobile (e.g. 390px)
  if (desktopSize >= 72) return 32
  if (desktopSize >= 56) return 28
  if (desktopSize >= 44) return 24
  if (desktopSize >= 36) return 20
  if (desktopSize >= 28) return 17
  if (desktopSize >= 22) return 15
  if (desktopSize >= 18) return 14
  if (desktopSize >= 14) return 13
  return Math.max(11, desktopSize)
}

/**
 * Clamps corner radius appropriately based on node role and dimensions.
 */
export function clampCornerRadius(
  radius: number,
  w: number,
  h: number,
  isPill: boolean
): number {
  if (radius <= 0) return 0
  const minDim = Math.min(w, h)
  if (isPill && minDim <= 56) {
    return Math.round(minDim / 2) // clean half-height capsule for small chips/buttons
  }
  // Large cards, containers, and sections must never exceed 24px (never giant pills!)
  return Math.min(radius, 24, Math.round(minDim * 0.15))
}

/**
 * Intelligent clipping policy.
 * Only enables clipping when strictly required (rounded border containment, scrollable data).
 * Never clips standard content frames to avoid hiding overflowing text or button descenders.
 */
export function determineIntelligentClipping(node: RLMNode): boolean {
  if (node.role === 'ROOT') return false
  const hasRoundedBorder = node.style.cornerRadii.tl > 0 || node.style.cornerRadii.tr > 0
  const hasMediaOrBg = node.children.some(c => c.isImage || c.role === 'CARD_MEDIA' || c.role === 'BACKGROUND')
  if (hasRoundedBorder && (hasMediaOrBg || node.role === 'CARD')) return true
  if (node.role === 'CARD_MEDIA' || (node.isImage && hasRoundedBorder)) return true
  if (node.role === 'DATA_TABLE') return true
  return false
}

/**
 * Assigns responsive layout intents across the entire RLM tree.
 */
export function planResponsiveLayout(
  root: RLMNode,
  vp: RLMViewport
): void {
  const contentWidth = vp.width - vp.padding * 2

  // 1. Root Frame Intent
  root.intent = {
    layoutMode: 'VERTICAL',
    horizontalSizing: 'FIXED',
    verticalSizing: 'HUG',
    targetWidth: vp.width,
    itemSpacing: vp.rowGap,
    padding: { top: 0, right: 0, bottom: vp.padding * 2, left: 0 },
    alignItems: 'MIN',
    justifyContent: 'MIN',
    preserveInstance: false,
    isAbsoluteInAutoLayout: false,
  }

  function planNode(node: RLMNode, availableWidth: number, isInsideCard = false) {
    const isPill = node.role === 'BADGE_OR_PILL' || (node.role === 'BUTTON_PRIMARY' && node.geometry.height <= 44)

    // Clamp corner radii in-model
    const r = node.style.cornerRadii
    node.style.cornerRadii = {
      tl: clampCornerRadius(r.tl, node.geometry.width, node.geometry.height, isPill),
      tr: clampCornerRadius(r.tr, node.geometry.width, node.geometry.height, isPill),
      bl: clampCornerRadius(r.bl, node.geometry.width, node.geometry.height, isPill),
      br: clampCornerRadius(r.br, node.geometry.width, node.geometry.height, isPill),
    }

    // 1. Proportional Image / Media Handling
    if (node.isImage || node.role === 'CARD_MEDIA') {
      const origW = Math.max(1, node.geometry.width)
      const origH = Math.max(1, node.geometry.height)
      const aspect = origH / origW
      node.intent.preserveMediaAspect = true
      node.intent.aspectRatio = aspect

      const targetImgW = isInsideCard ? availableWidth : Math.min(availableWidth, vp.width)
      const clampedAspect = isInsideCard ? Math.min(Math.max(aspect, 0.75), 1.25) : aspect
      const targetImgH = Math.min(Math.round(targetImgW * clampedAspect), isInsideCard ? 260 : 450)

      node.intent = {
        layoutMode: 'NONE',
        horizontalSizing: 'FILL',
        verticalSizing: 'FIXED',
        targetWidth: targetImgW,
        targetHeight: targetImgH,
        itemSpacing: 0,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        alignItems: 'MIN',
        justifyContent: 'MIN',
        preserveInstance: node.isInstance,
        isAbsoluteInAutoLayout: false,
        clipsContent: node.style.cornerRadii.tl > 0,
      }
      return
    }

    // 2. Background Layer Handling
    if (node.role === 'BACKGROUND') {
      node.intent = {
        layoutMode: 'NONE',
        horizontalSizing: 'FILL',
        verticalSizing: 'FILL',
        targetWidth: availableWidth,
        itemSpacing: 0,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        alignItems: 'MIN',
        justifyContent: 'MIN',
        preserveInstance: true,
        isAbsoluteInAutoLayout: true,
        clipsContent: false,
      }
      return
    }

    switch (node.role) {
      case 'ANNOUNCEMENT_BAR': {
        node.intent = {
          layoutMode: 'HORIZONTAL',
          horizontalSizing: 'FILL',
          verticalSizing: 'HUG',
          targetWidth: vp.width,
          itemSpacing: 8,
          padding: { top: 8, right: 12, bottom: 8, left: 12 },
          alignItems: 'CENTER',
          justifyContent: 'CENTER',
          preserveInstance: node.isInstance,
          isAbsoluteInAutoLayout: false,
        }
        for (const child of node.children) {
          planNode(child, vp.width - 24, false)
        }
        break
      }

      case 'NAVIGATION_BAR': {
        node.intent = {
          layoutMode: 'HORIZONTAL',
          horizontalSizing: 'FILL',
          verticalSizing: 'FIXED',
          targetWidth: vp.width,
          targetHeight: vp.navH,
          itemSpacing: 12,
          padding: { top: 0, right: vp.padding, bottom: 0, left: vp.padding },
          alignItems: 'CENTER',
          justifyContent: 'SPACE_BETWEEN',
          preserveInstance: false,
          isAbsoluteInAutoLayout: false,
        }
        for (const child of node.children) {
          planNode(child, vp.width - vp.padding * 2, false)
        }
        break
      }

      case 'HERO_SECTION': {
        node.intent = {
          layoutMode: 'VERTICAL',
          horizontalSizing: 'FILL',
          verticalSizing: 'HUG',
          targetWidth: availableWidth,
          itemSpacing: 18,
          padding: { top: 20, right: vp.padding, bottom: 24, left: vp.padding },
          alignItems: 'MIN',
          justifyContent: 'MIN',
          preserveInstance: false,
          isAbsoluteInAutoLayout: false,
        }
        for (const child of node.children) {
          planNode(child, availableWidth - vp.padding * 2, false)
        }
        break
      }

      case 'TRUST_BADGES': {
        node.intent = {
          layoutMode: 'HORIZONTAL',
          layoutWrap: 'WRAP',
          horizontalSizing: 'FILL',
          verticalSizing: 'HUG',
          targetWidth: availableWidth,
          itemSpacing: 12,
          padding: { top: 12, right: vp.padding, bottom: 12, left: vp.padding },
          alignItems: 'CENTER',
          justifyContent: 'CENTER',
          preserveInstance: false,
          isAbsoluteInAutoLayout: false,
        }
        for (const child of node.children) {
          planNode(child, availableWidth - vp.padding * 2, false)
        }
        break
      }

      case 'DATA_TABLE': {
        node.intent = {
          layoutMode: 'VERTICAL',
          horizontalSizing: 'FILL',
          verticalSizing: 'HUG',
          targetWidth: availableWidth,
          itemSpacing: 2,
          padding: { top: 8, right: 0, bottom: 8, left: 0 },
          alignItems: 'MIN',
          justifyContent: 'MIN',
          preserveInstance: false,
          isAbsoluteInAutoLayout: false,
        }
        for (const row of node.children) {
          row.intent = {
            layoutMode: 'HORIZONTAL',
            horizontalSizing: 'FILL',
            verticalSizing: 'HUG',
            itemSpacing: 8,
            padding: { top: 6, right: 8, bottom: 6, left: 8 },
            alignItems: 'CENTER',
            justifyContent: 'SPACE_BETWEEN',
            preserveInstance: false,
            isAbsoluteInAutoLayout: false,
          }
          for (const cell of row.children) {
            planNode(cell, availableWidth / Math.max(1, row.children.length), false)
          }
        }
        break
      }

      case 'METRIC_CARD_GROUP': {
        const cols = (availableWidth >= 320 && node.children.length >= 2) ? 2 : 1
        const itemW = cols === 2
          ? Math.floor((availableWidth - vp.colGap) / 2)
          : availableWidth

        node.intent = {
          layoutMode: 'VERTICAL',
          horizontalSizing: 'FILL',
          verticalSizing: 'HUG',
          targetWidth: availableWidth,
          itemSpacing: vp.colGap,
          padding: { top: 8, right: 0, bottom: 8, left: 0 },
          alignItems: 'MIN',
          justifyContent: 'MIN',
          preserveInstance: false,
          isAbsoluteInAutoLayout: false,
          columns: cols,
        }
        for (const child of node.children) {
          planNode(child, itemW, true)
        }
        break
      }

      case 'TAG_CLOUD': {
        node.intent = {
          layoutMode: 'HORIZONTAL',
          layoutWrap: 'WRAP',
          horizontalSizing: 'FILL',
          verticalSizing: 'HUG',
          targetWidth: availableWidth,
          itemSpacing: 8,
          padding: { top: 4, right: 0, bottom: 4, left: 0 },
          alignItems: 'CENTER',
          justifyContent: 'MIN',
          preserveInstance: false,
          isAbsoluteInAutoLayout: false,
        }
        for (const child of node.children) {
          planNode(child, availableWidth, false)
        }
        break
      }

      case 'BADGE_OR_PILL': {
        node.intent = {
          layoutMode: 'HORIZONTAL',
          horizontalSizing: 'HUG',
          verticalSizing: 'HUG',
          itemSpacing: 4,
          padding: { top: 4, right: 10, bottom: 4, left: 10 },
          alignItems: 'CENTER',
          justifyContent: 'CENTER',
          preserveInstance: node.isInstance,
          isAbsoluteInAutoLayout: false,
        }
        for (const child of node.children) {
          planNode(child, availableWidth, false)
        }
        break
      }

      case 'BUTTON_PRIMARY':
      case 'BUTTON_SECONDARY': {
        node.intent = {
          layoutMode: 'HORIZONTAL',
          horizontalSizing: isInsideCard ? 'FILL' : 'HUG',
          verticalSizing: 'HUG',
          itemSpacing: 8,
          padding: { top: 10, right: 18, bottom: 10, left: 18 },
          alignItems: 'CENTER',
          justifyContent: 'CENTER',
          preserveInstance: node.isInstance,
          isAbsoluteInAutoLayout: false,
        }
        for (const child of node.children) {
          planNode(child, availableWidth, isInsideCard)
        }
        break
      }

      case 'PRODUCT_GRID': {
        // Multi-column cards
        const cols = (availableWidth >= 320 && node.children.length >= 2) ? 2 : 1
        const itemW = cols === 2
          ? Math.floor((availableWidth - vp.colGap) / 2)
          : availableWidth

        node.intent = {
          layoutMode: 'VERTICAL',
          horizontalSizing: 'FILL',
          verticalSizing: 'HUG',
          targetWidth: availableWidth,
          itemSpacing: vp.colGap,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          alignItems: 'MIN',
          justifyContent: 'MIN',
          preserveInstance: false,
          isAbsoluteInAutoLayout: false,
          columns: cols,
        }

        for (const child of node.children) {
          planNode(child, itemW, true)
        }
        break
      }

      case 'DECORATIVE': {
        node.intent = {
          layoutMode: 'NONE',
          horizontalSizing: 'FIXED',
          verticalSizing: 'FIXED',
          targetWidth: node.geometry.width,
          targetHeight: node.geometry.height,
          itemSpacing: 0,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          alignItems: 'MIN',
          justifyContent: 'MIN',
          preserveInstance: true,
          isAbsoluteInAutoLayout: true,
        }
        break
      }

      case 'BACKGROUND': {
        node.intent = {
          layoutMode: 'NONE',
          horizontalSizing: 'FILL',
          verticalSizing: 'FILL',
          itemSpacing: 0,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          alignItems: 'MIN',
          justifyContent: 'MIN',
          preserveInstance: true,
          isAbsoluteInAutoLayout: true,
        }
        break
      }

      case 'TEXT_HEADING': {
        if (node.typography) {
          node.typography.fontSize = getMobileFontSize(node.typography.fontSize, vp.width)
        }
        node.intent = {
          layoutMode: 'NONE',
          horizontalSizing: 'FILL',
          verticalSizing: 'HUG',
          textAutoResize: 'HEIGHT',
          minWidth: 120,
          itemSpacing: 0,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          alignItems: 'MIN',
          justifyContent: 'MIN',
          preserveInstance: false,
          isAbsoluteInAutoLayout: false,
        }
        break
      }

      case 'TEXT_PARAGRAPH': {
        if (node.typography) {
          node.typography.fontSize = getMobileFontSize(node.typography.fontSize, vp.width)
        }
        node.intent = {
          layoutMode: 'NONE',
          horizontalSizing: 'FILL',
          verticalSizing: 'HUG',
          textAutoResize: 'HEIGHT',
          minWidth: 120,
          itemSpacing: 0,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          alignItems: 'MIN',
          justifyContent: 'MIN',
          preserveInstance: false,
          isAbsoluteInAutoLayout: false,
        }
        break
      }

      case 'TEXT_INLINE_LABEL': {
        if (node.typography) {
          node.typography.fontSize = getMobileFontSize(node.typography.fontSize, vp.width)
        }
        node.intent = {
          layoutMode: 'NONE',
          horizontalSizing: 'HUG',
          verticalSizing: 'HUG',
          textAutoResize: 'WIDTH_AND_HEIGHT',
          itemSpacing: 0,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          alignItems: 'MIN',
          justifyContent: 'MIN',
          preserveInstance: false,
          isAbsoluteInAutoLayout: false,
        }
        break
      }

      case 'FOOTER': {
        node.intent = {
          layoutMode: 'VERTICAL',
          horizontalSizing: 'FILL',
          verticalSizing: 'HUG',
          targetWidth: vp.width,
          itemSpacing: 20,
          padding: { top: vp.padding, right: vp.padding, bottom: vp.padding * 2, left: vp.padding },
          alignItems: 'MIN',
          justifyContent: 'MIN',
          preserveInstance: false,
          isAbsoluteInAutoLayout: false,
        }
        for (const child of node.children) {
          planNode(child, contentWidth, false)
        }
        break
      }

      default: {
        // Generic containers or cards
        const isCard = isInsideCard || node.style.fills.length > 0 || node.style.cornerRadii.tl > 0
        node.intent = {
          layoutMode: 'VERTICAL',
          horizontalSizing: 'FILL',
          verticalSizing: 'HUG',
          targetWidth: availableWidth,
          itemSpacing: isCard ? 10 : 16,
          padding: isCard
            ? { top: 12, right: 12, bottom: 12, left: 12 }
            : { top: 0, right: 0, bottom: 0, left: 0 },
          alignItems: 'MIN',
          justifyContent: 'MIN',
          preserveInstance: node.isInstance,
          isAbsoluteInAutoLayout: node.style.layoutPositioning === 'ABSOLUTE',
        }
        for (const child of node.children) {
          planNode(child, availableWidth - (isCard ? 24 : 0), isCard)
        }
        break
      }
    }

    // Set intelligent clipping policy if not explicitly overridden
    if (node.intent.clipsContent === undefined) {
      node.intent.clipsContent = determineIntelligentClipping(node)
    }
  }

  // Plan all children of root
  for (const section of root.children) {
    const isFullBleed = section.role === 'ANNOUNCEMENT_BAR' || section.role === 'NAVIGATION_BAR' || section.role === 'FOOTER'
    const sectionWidth = isFullBleed ? vp.width : contentWidth
    planNode(section, sectionWidth, false)
  }
}
