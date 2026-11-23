// ============================================================
// src/plugin/figma/rlm/classifier.ts
// Semantic Pattern Recognition with Multi-Factor Evidence & Confidence Scoring
// 100% Offline & Deterministic — Zero External Dependencies
// ============================================================

import type { RLMNode, RLMRole } from './types'
import { areNodesHorizontallyAligned } from './relationships'

/**
 * Checks if a node has any visible fills.
 */
export function hasVisibleFill(node: RLMNode): boolean {
  return node.style.fills.some(f => f.visible !== false)
}

/**
 * Checks if a node has any visible strokes.
 */
export function hasVisibleStroke(node: RLMNode): boolean {
  return node.style.strokes.some(s => s.visible !== false)
}

/**
 * Checks if a node has image fills.
 */
export function hasImageFill(node: RLMNode): boolean {
  return node.style.fills.some(f => f.type === 'IMAGE' && f.visible !== false)
}

/**
 * Checks if a node contains text in any descendant.
 */
export function hasDescendantText(node: RLMNode): boolean {
  if (node.typography && node.typography.characters.trim().length > 0) return true
  for (const child of node.children) {
    if (hasDescendantText(child)) return true
  }
  return false
}

/**
 * Collects all text contents from descendants.
 */
export function getAllTextContent(node: RLMNode): string[] {
  const result: string[] = []
  if (node.typography && node.typography.characters.trim().length > 0) {
    result.push(node.typography.characters.trim())
  }
  for (const child of node.children) {
    result.push(...getAllTextContent(child))
  }
  return result
}

/**
 * Checks if node is an intentional background layer.
 */
export function classifyBackground(node: RLMNode, parentW: number, parentH: number): { isBackground: boolean; confidence: number } {
  const name = node.name.toLowerCase()
  if (/(^bg$|^background$|backdrop|canvas-bg)/i.test(name) && node.geometry.width >= parentW * 0.5) {
    return { isBackground: true, confidence: 0.95 }
  }

  // A node with text content or interactive children is never a background layer
  if (hasDescendantText(node)) return { isBackground: false, confidence: 0 }
  if (node.children.length >= 2) return { isBackground: false, confidence: 0 }

  const coversParent =
    node.geometry.x <= 16 &&
    node.geometry.y <= 16 &&
    node.geometry.width >= parentW * 0.85 &&
    node.geometry.height >= parentH * 0.85

  if (coversParent && (hasVisibleFill(node) || hasImageFill(node))) {
    return { isBackground: true, confidence: 0.88 }
  }

  return { isBackground: false, confidence: 0 }
}

/**
 * Checks if node is an absolute decorative element (glow blob, sparkle, blur, accent).
 */
export function classifyDecorative(node: RLMNode): { isDecorative: boolean; confidence: number } {
  if (node.style.layoutPositioning === 'ABSOLUTE') {
    return { isDecorative: true, confidence: 0.98 }
  }

  const name = node.name.toLowerCase()
  if (/(decor|accent|blob|glow|blur|sparkle|float|particle|ambient)/i.test(name)) {
    return { isDecorative: true, confidence: 0.92 }
  }

  const isSmallVector = (node.originalType === 'VECTOR' || node.originalType === 'ELLIPSE' || node.originalType === 'STAR') &&
    node.geometry.width <= 64 && node.geometry.height <= 64 && node.children.length === 0
  if (isSmallVector && !hasDescendantText(node)) {
    return { isDecorative: true, confidence: 0.80 }
  }

  return { isDecorative: false, confidence: 0 }
}

/**
 * Checks if node is a small badge, tag, or pill.
 */
export function classifyBadgeOrPill(node: RLMNode): { isBadge: boolean; confidence: number } {
  const name = node.name.toLowerCase()
  const isNamed = /(badge|tag|pill|chip|sticker|label-pill|category-pill)/i.test(name)
  const isCompact = node.geometry.height >= 16 && node.geometry.height <= 44 && node.geometry.width <= 260

  if (isNamed && isCompact) return { isBadge: true, confidence: 0.95 }

  if (isCompact && (hasVisibleFill(node) || hasVisibleStroke(node))) {
    const texts = node.children.filter(c => c.typography)
    if (texts.length === 1 && texts[0].typography!.characters.length <= 32) {
      return { isBadge: true, confidence: 0.88 }
    }
  }

  return { isBadge: false, confidence: 0 }
}

/**
 * Checks if node is a button (primary or secondary CTA).
 */
export function classifyButton(node: RLMNode): { isButton: boolean; role: RLMRole; confidence: number } {
  const name = node.name.toLowerCase()
  const isNamed = /(btn|button|cta|action-btn|submit)/i.test(name)
  const isSizeAppropriate = node.geometry.height >= 28 && node.geometry.height <= 64 && node.geometry.width >= 40 && node.geometry.width <= 360

  if (!isSizeAppropriate) return { isButton: false, role: 'UNKNOWN', confidence: 0 }

  const hasBg = hasVisibleFill(node) || hasVisibleStroke(node)
  const texts = node.children.filter(c => c.typography)

  if (isNamed && (hasBg || texts.length > 0)) {
    const isSec = /(secondary|outline|ghost|cancel)/i.test(name) || !hasVisibleFill(node)
    return { isButton: true, role: isSec ? 'BUTTON_SECONDARY' : 'BUTTON_PRIMARY', confidence: 0.92 }
  }

  if (hasBg && texts.length >= 1 && texts.length <= 2 && node.children.length <= 3) {
    return { isButton: true, role: 'BUTTON_PRIMARY', confidence: 0.82 }
  }

  return { isButton: false, role: 'UNKNOWN', confidence: 0 }
}

/**
 * Checks if a section is an announcement or promo banner.
 */
export function classifyAnnouncementBar(node: RLMNode, rootHeight: number): { isBanner: boolean; confidence: number } {
  const name = node.name.toLowerCase()
  const isNamed = /(announce|promo|marquee|top-bar|alert|broadcast|notice|strip)/i.test(name)
  const isThin = node.geometry.height <= 56 && node.geometry.width >= 240
  const isAtTop = node.geometry.y <= 60

  if (isNamed && isThin && isAtTop) return { isBanner: true, confidence: 0.95 }
  if (isThin && isAtTop && node.children.length <= 3 && !name.includes('nav')) {
    return { isBanner: true, confidence: 0.85 }
  }

  return { isBanner: false, confidence: 0 }
}

/**
 * Checks if a section is a main navigation bar.
 */
export function classifyNavigationBar(node: RLMNode, rootHeight: number): { isNav: boolean; confidence: number } {
  const name = node.name.toLowerCase()
  const isNamed = /(nav|header|navbar|site-header|appbar|masthead)/i.test(name)
  const isNearTop = node.geometry.y <= Math.max(160, rootHeight * 0.25)
  const isCompactH = node.geometry.height <= 140

  if (isNamed && isNearTop && isCompactH) return { isNav: true, confidence: 0.92 }

  if (isNearTop && isCompactH) {
    const hasLogo = node.children.some(c => /(logo|brand)/i.test(c.name))
    const linkLikeCount = node.children.filter(c => c.typography && c.typography.characters.length <= 25).length
    if (hasLogo && linkLikeCount >= 2) return { isNav: true, confidence: 0.85 }
  }

  return { isNav: false, confidence: 0 }
}

/**
 * Checks if a section is a Hero Section (top prominent section with headline, CTA, and media).
 */
export function classifyHeroSection(node: RLMNode, rootHeight: number): { isHero: boolean; confidence: number } {
  const name = node.name.toLowerCase()
  const isNamed = /(hero|masthead|intro-banner|main-banner)/i.test(name)
  const isNearTop = node.geometry.y <= Math.max(250, rootHeight * 0.35)
  const isSubstantial = node.geometry.height >= 180

  if (isNamed && isNearTop) return { isHero: true, confidence: 0.92 }

  if (isNearTop && isSubstantial) {
    const texts = getAllTextContent(node)
    const hasBigHeading = node.children.some(c => c.typography && c.typography.fontSize >= 28)
    const hasCta = node.children.some(c => classifyButton(c).isButton)
    if (hasBigHeading && (hasCta || texts.length >= 2)) {
      return { isHero: true, confidence: 0.88 }
    }
  }

  return { isHero: false, confidence: 0 }
}

/**
 * Checks if a section is a Trust Badges strip (logos, rating certifications, press mentions).
 */
export function classifyTrustBadges(node: RLMNode): { isTrust: boolean; confidence: number } {
  const name = node.name.toLowerCase()
  if (/(trust|badges|partners|clients|press|as-seen-on|certifications|ratings)/i.test(name)) {
    return { isTrust: true, confidence: 0.92 }
  }

  const texts = getAllTextContent(node).join(' ').toLowerCase()
  if (/(rated #1|star supplier|supplier ratings|satisfaction|iso 9001|guarantee|certified)/i.test(texts)) {
    return { isTrust: true, confidence: 0.90 }
  }

  return { isTrust: false, confidence: 0 }
}

/**
 * Checks if a section is a Data Table.
 */
export function classifyDataTable(node: RLMNode): { isTable: boolean; confidence: number } {
  const name = node.name.toLowerCase()
  if (/(table|datatable|records|invoices|transactions|spreadsheet|grid-table)/i.test(name)) {
    return { isTable: true, confidence: 0.94 }
  }

  // If 3+ rows where each row has 2+ columns with similar counts
  if (node.children.length >= 3) {
    const rowKids = node.children.filter(c => c.children.length >= 2)
    if (rowKids.length >= 3 && rowKids.length >= node.children.length * 0.75) {
      return { isTable: true, confidence: 0.85 }
    }
  }

  return { isTable: false, confidence: 0 }
}

/**
 * Checks if a section is a metric card or stats widget.
 */
export function classifyMetricCard(node: RLMNode): { isMetric: boolean; confidence: number } {
  const name = node.name.toLowerCase()
  if (/(metric|stat|kpi|analytics-card|counter)/i.test(name)) {
    return { isMetric: true, confidence: 0.92 }
  }

  const texts = getAllTextContent(node).join(' ')
  const hasStatPattern = /^([+$€£₹¥]?\s*[\d,.]+[kKmMbB%]?|[\d,.]+%?|[+$€£₹¥]\s*[\d,.]+)$/.test(texts.trim()) ||
    /(revenue|users|orders|conversions|bounce|sales|mrr|arr|active users|churn)/i.test(texts)

  if (hasStatPattern && node.geometry.width <= 400 && node.children.length <= 5) {
    return { isMetric: true, confidence: 0.88 }
  }

  return { isMetric: false, confidence: 0 }
}

/**
 * Checks if a section is a footer.
 */
export function classifyFooter(node: RLMNode, rootHeight: number): { isFooter: boolean; confidence: number } {
  const name = node.name.toLowerCase()
  const isNamed = /(footer|colophon|site-footer|page-footer)/i.test(name)
  const isNearBottom = rootHeight > 0 && node.geometry.y >= rootHeight * 0.65

  if (isNamed) return { isFooter: true, confidence: 0.95 }

  const textBlobs = getAllTextContent(node).join(' ').toLowerCase()
  const hasCopyright = /(copyright|all rights reserved|©|\b202\d\b|privacy policy|terms)/i.test(textBlobs)

  if (isNearBottom && hasCopyright) {
    return { isFooter: true, confidence: 0.90 }
  }

  return { isFooter: false, confidence: 0 }
}

/**
 * Checks if a container is a Tag Cloud (horizontal collection of badges/pills).
 */
export function classifyTagCloud(node: RLMNode): { isTagCloud: boolean; confidence: number } {
  const badgeKids = node.children.filter(c => classifyBadgeOrPill(c).isBadge)
  if (badgeKids.length >= 3 && badgeKids.length >= node.children.length * 0.70) {
    return { isTagCloud: true, confidence: 0.92 }
  }
  return { isTagCloud: false, confidence: 0 }
}

/**
 * Structural similarity between two sibling RLM nodes.
 */
export function computeRLMSimilarity(a: RLMNode, b: RLMNode): number {
  let score = 0
  if (a.originalType === b.originalType) score += 0.35
  const aKids = a.children.length
  const bKids = b.children.length
  if (aKids > 0 && bKids > 0) {
    score += (Math.min(aKids, bKids) / Math.max(aKids, bKids)) * 0.35
  } else if (aKids === 0 && bKids === 0) {
    score += 0.25
  }

  const wRatio = Math.min(a.geometry.width, b.geometry.width) / Math.max(a.geometry.width, b.geometry.width, 1)
  score += wRatio * 0.15
  const hRatio = Math.min(a.geometry.height, b.geometry.height) / Math.max(a.geometry.height, b.geometry.height, 1)
  score += hRatio * 0.15

  return score
}

/**
 * Checks if container is a Product Grid or repeated card collection.
 */
export function classifyProductGrid(node: RLMNode): { isGrid: boolean; confidence: number } {
  const cards = node.children.filter(c => c.children.length >= 1 && c.geometry.width >= 100)
  if (cards.length < 3) return { isGrid: false, confidence: 0 }

  let totalSim = 0
  let pairs = 0
  const sample = cards.slice(0, Math.min(cards.length, 6))
  for (let i = 0; i < sample.length - 1; i++) {
    totalSim += computeRLMSimilarity(sample[i], sample[i + 1])
    pairs++
  }
  const avgSim = pairs > 0 ? totalSim / pairs : 0

  if (avgSim >= 0.70) {
    const texts = getAllTextContent(node).join(' ')
    const hasPrice = /[$€£₹¥]\s*[\d,.]+|[\d,.]+\s*[$€£₹¥]|\b(USD|EUR|INR|GBP)\b/i.test(texts)
    const confidence = hasPrice ? 0.95 : 0.85
    return { isGrid: true, confidence }
  }

  return { isGrid: false, confidence: 0 }
}

/**
 * Classifies an entire RLM tree recursively.
 */
export function classifyRLMTree(node: RLMNode, rootHeight: number, parentW?: number, parentH?: number): void {
  const pw = parentW || node.geometry.width
  const ph = parentH || node.geometry.height

  // 1. Check Background
  const bgCheck = classifyBackground(node, pw, ph)
  if (bgCheck.isBackground) {
    node.role = 'BACKGROUND'
    node.confidence = bgCheck.confidence
    return
  }

  // 2. Check Decorative
  const decorCheck = classifyDecorative(node)
  if (decorCheck.isDecorative) {
    node.role = 'DECORATIVE'
    node.confidence = decorCheck.confidence
    return
  }

  // 3. Leaf elements (Text / Icons)
  if (node.typography) {
    const fs = node.typography.fontSize
    if (fs >= 22) {
      node.role = 'TEXT_HEADING'
      node.confidence = 0.90
    } else if (node.typography.characters.length <= 30 && node.typography.isSingleLine) {
      node.role = 'TEXT_INLINE_LABEL'
      node.confidence = 0.85
    } else {
      node.role = 'TEXT_PARAGRAPH'
      node.confidence = 0.85
    }
  } else {
    // 4. Container classification hierarchy
    const badgeCheck = classifyBadgeOrPill(node)
    if (badgeCheck.isBadge) {
      node.role = 'BADGE_OR_PILL'
      node.confidence = badgeCheck.confidence
    } else {
      const btnCheck = classifyButton(node)
      if (btnCheck.isButton) {
        node.role = btnCheck.role
        node.confidence = btnCheck.confidence
      } else {
        const tagCloudCheck = classifyTagCloud(node)
        if (tagCloudCheck.isTagCloud) {
          node.role = 'TAG_CLOUD'
          node.confidence = tagCloudCheck.confidence
        } else {
          const annCheck = classifyAnnouncementBar(node, rootHeight)
          if (annCheck.isBanner) {
            node.role = 'ANNOUNCEMENT_BAR'
            node.confidence = annCheck.confidence
          } else {
            const navCheck = classifyNavigationBar(node, rootHeight)
            if (navCheck.isNav) {
              node.role = 'NAVIGATION_BAR'
              node.confidence = navCheck.confidence
            } else {
              const heroCheck = classifyHeroSection(node, rootHeight)
              if (heroCheck.isHero) {
                node.role = 'HERO_SECTION'
                node.confidence = heroCheck.confidence
              } else {
                const trustCheck = classifyTrustBadges(node)
                if (trustCheck.isTrust) {
                  node.role = 'TRUST_BADGES'
                  node.confidence = trustCheck.confidence
                } else {
                  const tableCheck = classifyDataTable(node)
                  if (tableCheck.isTable) {
                    node.role = 'DATA_TABLE'
                    node.confidence = tableCheck.confidence
                  } else {
                    const footCheck = classifyFooter(node, rootHeight)
                    if (footCheck.isFooter) {
                      node.role = 'FOOTER'
                      node.confidence = footCheck.confidence
                    } else {
                      const gridCheck = classifyProductGrid(node)
                      if (gridCheck.isGrid) {
                        node.role = 'PRODUCT_GRID'
                        node.confidence = gridCheck.confidence
                      } else {
                        const metricCheck = classifyMetricCard(node)
                        if (metricCheck.isMetric) {
                          node.role = 'METRIC_CARD_GROUP'
                          node.confidence = metricCheck.confidence
                        } else if (node.children.length > 0) {
                          node.role = 'CONTAINER'
                          node.confidence = 0.50
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // Recurse into children
  for (const child of node.children) {
    classifyRLMTree(child, rootHeight, node.geometry.width, node.geometry.height)
  }
}
