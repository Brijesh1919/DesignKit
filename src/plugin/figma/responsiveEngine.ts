// ============================================================
// responsiveEngine.ts — Generic Structure-Aware Responsive Engine V9
// DesignKit Figma Plugin
//
// Core Philosophy:
//   Inspect the ACTUAL Figma document structure — node types,
//   Auto Layout properties, sibling relationships, repeated
//   patterns, navigation topology, table rows, sidebar geometry —
//   and derive the appropriate mobile reflow per container.
//
//   NEVER hard-code behavior for:
//     - specific node names
//     - specific node IDs
//     - specific page types (landing page / dashboard / etc.)
//     - specific section orderings
//     - specific index positions
//
//   ALWAYS derive layout decisions from:
//     - layoutMode / Auto Layout properties
//     - structural similarity of siblings
//     - spatial relationships (horizontal / vertical grouping)
//     - content roles (brand, nav-links, utility actions, table rows)
//     - size relationships relative to parent
//
// Architecture:
//   INPUT FIGMA DESIGN
//     ↓  STRUCTURE ANALYSIS  (per container)
//     ↓  LAYOUT STRATEGY DETECTION
//     ↓  RESPONSIVE REFLOW  (strategy-appropriate)
//     ↓  CONTENT-DRIVEN BOUNDS
//     ↓  OVERLAP VALIDATION
//     ↓  FINAL MOBILE FRAME
//
// ============================================================

// ---- Spacing Tokens ----

export const SPACING = {
  MICRO: 4,    // Between icon & label, badge & title
  SMALL: 8,    // Between heading & subheading, tightly related items
  NORMAL: 14,  // Between description & CTA, related elements in a group
  MEDIUM: 20,  // Between distinct content groups inside a section
  SECTION: 28, // Between major sections on mobile
}

// ---- Viewport Definitions ----

export interface RVP {
  width: number
  height: number
  name: string
  padding: number        // Horizontal page padding
  colGap: number         // Gap between columns in grids
  rowGap: number         // Gap between stacked sections
  navH: number           // Target navbar height
  defaultCardCols: number
}

export const VIEWPORTS: Record<string, RVP> = {
  laptop:         { width: 1024, height: 768,  name: 'Laptop',       padding: 32, colGap: 20, rowGap: 40, navH: 64, defaultCardCols: 3 },
  tablet:         { width: 768,  height: 1024, name: 'Tablet',       padding: 24, colGap: 16, rowGap: 34, navH: 60, defaultCardCols: 2 },
  mobile:         { width: 390,  height: 844,  name: 'Mobile',       padding: 20, colGap: 12, rowGap: 28, navH: 56, defaultCardCols: 1 },
  'small-mobile': { width: 320,  height: 568,  name: 'Small Mobile', padding: 16, colGap: 10, rowGap: 24, navH: 52, defaultCardCols: 1 },
}

// ---- Typography Scale ----

export function getResponsiveFontSize(desktopPx: number, vp: RVP): number {
  if (vp.width >= 1024) {
    if (desktopPx >= 80) return Math.round(desktopPx * 0.85)
    if (desktopPx >= 60) return Math.round(desktopPx * 0.90)
    return desktopPx
  }

  if (vp.width >= 768) {
    if (desktopPx >= 72) return 40
    if (desktopPx >= 56) return 34
    if (desktopPx >= 44) return 28
    if (desktopPx >= 36) return 24
    if (desktopPx >= 28) return 20
    if (desktopPx >= 20) return 17
    return desktopPx
  }

  // Mobile (390px) & Small Mobile (320px)
  if (desktopPx >= 72) return 32
  if (desktopPx >= 56) return 28
  if (desktopPx >= 44) return 24
  if (desktopPx >= 36) return 20
  if (desktopPx >= 28) return 17
  if (desktopPx >= 22) return 15
  if (desktopPx >= 18) return 14
  if (desktopPx >= 14) return 13
  return Math.max(11, desktopPx)
}

// ============================================================
// GEOMETRY & NODE HELPERS
// ============================================================

function isValidFigmaNode(node: BaseNode | null | undefined): boolean {
  if (!node) return false
  try {
    return !!(node.id && figma.getNodeById(node.id))
  } catch (_) {
    return false
  }
}

function nX(n: SceneNode): number {
  if (!isValidFigmaNode(n)) return 0
  return 'x' in n ? (n as any).x as number : 0
}
function nY(n: SceneNode): number {
  if (!isValidFigmaNode(n)) return 0
  return 'y' in n ? (n as any).y as number : 0
}

function setPos(n: SceneNode, x: number, y: number): void {
  if (!isValidFigmaNode(n)) return
  if ('x' in n) (n as any).x = Math.round(x)
  if ('y' in n) (n as any).y = Math.round(y)
}

function doResize(n: SceneNode, w: number, h: number): void {
  if (!isValidFigmaNode(n)) return
  if ('resize' in n && typeof (n as any).resize === 'function') {
    try {
      (n as any).resize(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)))
    } catch (_) {}
  }
}

export function isImageNode(n: SceneNode): boolean {
  if ('fills' in n && Array.isArray((n as any).fills)) {
    return (n as any).fills.some((f: any) => f.type === 'IMAGE' && f.visible !== false)
  }
  return false
}

/** A node that acts as a full-bleed background (covers most of its container). */
function isBackgroundNode(n: SceneNode, containerW: number, containerH: number): boolean {
  if (n.type === 'RECTANGLE' || n.type === 'VECTOR') {
    if (n.width >= containerW * 0.70 && n.height >= containerH * 0.50) return true
  }
  return false
}

function hasVisibleFillOrStroke(n: SceneNode): boolean {
  if ('fills' in n && Array.isArray((n as any).fills) && (n as any).fills.length > 0) {
    const hasFill = (n as any).fills.some((f: any) => f.visible !== false)
    if (hasFill) return true
  }
  if ('strokes' in n && Array.isArray((n as any).strokes) && (n as any).strokes.length > 0) {
    const hasStroke = (n as any).strokes.some((s: any) => s.visible !== false)
    if (hasStroke) return true
  }
  return false
}

function isButtonLike(n: SceneNode): boolean {
  if ((n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE' || n.type === 'GROUP') &&
      n.height >= 28 && n.height <= 72 && n.width >= 40 && n.width <= 360) {
    if ('children' in n) {
      const texts = (n as ChildrenMixin).children.filter(c => c.type === 'TEXT')
      const hasFrame = (n as ChildrenMixin).children.some(c => c.type !== 'TEXT')
      // If mostly text (≥ 1 text child) with optional background, likely a button
      if (texts.length >= 1 && texts.length <= 3) return true
    }
  }
  const name = (n.name || '').toLowerCase()
  if (name.includes('button') || name.includes('btn') || name.includes('cta')) return true
  return false
}

function isIconNode(n: SceneNode): boolean {
  return (n.width <= 52 && n.height <= 52) &&
    (n.type === 'VECTOR' || n.type === 'FRAME' || n.type === 'GROUP' || n.type === 'INSTANCE')
}

function visibleChildren(node: SceneNode): SceneNode[] {
  if (!('children' in node)) return []
  return (node as ChildrenMixin).children.filter(c => c.visible !== false) as SceneNode[]
}

// ============================================================
// FONT LOADING CACHE
// ============================================================

const _loadedFonts = new Set<string>()

async function loadFontSafe(fn: FontName): Promise<boolean> {
  const key = `${fn.family}::${fn.style}`
  if (_loadedFonts.has(key)) return true
  try {
    await figma.loadFontAsync(fn)
    _loadedFonts.add(key)
    return true
  } catch (_) {
    return false
  }
}

// ============================================================
// ALIGNMENT DETECTION
// ============================================================

/**
 * Detects the original horizontal alignment intent of a set of children
 * relative to their parent container.
 *
 * Returns 'CENTER', 'LEFT', 'RIGHT', or 'FILL'.
 *
 * Logic:
 *  - FILL:   all children span ≥ 90% of parent width
 *  - CENTER: avg child center X ≈ parent center X (within 15% tolerance)
 *  - RIGHT:  avg child is positioned in right half of parent
 *  - LEFT:   default
 */
function detectAlignmentIntent(
  kids: SceneNode[],
  parentW: number
): 'LEFT' | 'CENTER' | 'RIGHT' | 'FILL' {
  if (kids.length === 0) return 'LEFT'

  const parentCenter = parentW / 2

  // FILL: all children are full width
  const allFull = kids.every(k => k.width >= parentW * 0.90)
  if (allFull) return 'FILL'

  // Measure each child's visual center relative to parent
  const centerOffsets = kids.map(k => {
    const kCenter = nX(k) + k.width / 2
    return kCenter - parentCenter
  })
  const avgOffset = centerOffsets.reduce((s, v) => s + v, 0) / kids.length
  const tolerance = parentW * 0.15

  if (Math.abs(avgOffset) <= tolerance) return 'CENTER'
  if (avgOffset > tolerance) return 'RIGHT'
  return 'LEFT'
}

/**
 * Computes child X position for a given alignment inside a mobile container.
 *
 * @param childW    child width after resizing
 * @param contentW  usable content width (containerW - paddingLeft - paddingRight)
 * @param baseX     left edge of content area (= container.x + paddingLeft, usually 0 + padding)
 * @param alignment detected alignment intent
 */
function alignedX(
  childW: number,
  contentW: number,
  baseX: number,
  alignment: 'LEFT' | 'CENTER' | 'RIGHT' | 'FILL'
): number {
  switch (alignment) {
    case 'CENTER': return Math.round(baseX + (contentW - childW) / 2)
    case 'RIGHT':  return Math.round(baseX + contentW - childW)
    case 'FILL':   return baseX
    case 'LEFT':
    default:       return baseX
  }
}

/**
 * Determines child-specific alignment intent, taking into account:
 * 1. Overall container alignment intent
 * 2. Explicit text node alignment (e.g. textAlignHorizontal === 'CENTER')
 * 3. Whether the child was centered horizontally within its desktop container
 */
function getChildAlignment(
  kid: SceneNode,
  parentW: number,
  containerAlignment: 'LEFT' | 'CENTER' | 'RIGHT' | 'FILL'
): 'LEFT' | 'CENTER' | 'RIGHT' | 'FILL' {
  if (containerAlignment === 'CENTER') return 'CENTER'

  // If text node was explicitly centered on desktop
  if (kid.type === 'TEXT' && (kid as TextNode).textAlignHorizontal === 'CENTER') {
    return 'CENTER'
  }

  // If child visual center was within 12% of parent center on desktop
  const parentCenter = parentW / 2
  const childCenter = nX(kid) + kid.width / 2
  if (Math.abs(childCenter - parentCenter) <= parentW * 0.12) {
    return 'CENTER'
  }

  if (containerAlignment === 'RIGHT') return 'RIGHT'
  return 'LEFT'
}

// ============================================================
// TEXT REFLOW
// ============================================================

async function reflowTextNode(
  node: TextNode,
  targetWidth: number,
  vp: RVP,
  log?: string[]
): Promise<number> {
  try {
    if (typeof node.fontName !== 'symbol') {
      await loadFontSafe(node.fontName as FontName)
    }

    if (typeof node.fontSize === 'number') {
      const origSize = node.fontSize
      const newSize = getResponsiveFontSize(origSize, vp)
      if (newSize !== origSize) {
        node.fontSize = newSize
        if (log) log.push(`"${node.name}" font: ${origSize}px → ${newSize}px`)
      }

      if (node.lineHeight && typeof node.lineHeight === 'object') {
        if (node.lineHeight.unit === 'PIXELS' && node.lineHeight.value > newSize * 1.5) {
          try { node.lineHeight = { unit: 'AUTO' } } catch (_) {}
        }
      }
    }

    node.textAutoResize = 'NONE'
    doResize(node, targetWidth, node.height)
    node.textAutoResize = 'HEIGHT'

    return node.height
  } catch (_) {
    return node.height
  }
}

// ============================================================
// HAMBURGER ICON CREATOR
// ============================================================

function createHamburgerIcon(parent: FrameNode, x: number, y: number, color?: RGB): FrameNode {
  const iconFrame = figma.createFrame()
  iconFrame.name = 'Mobile Menu Icon'
  iconFrame.resize(26, 26)
  iconFrame.x = Math.round(x)
  iconFrame.y = Math.round(y)
  iconFrame.fills = []
  iconFrame.clipsContent = false

  const barColor: RGB = color || { r: 0.12, g: 0.14, b: 0.17 }

  for (let i = 0; i < 3; i++) {
    const bar = figma.createRectangle()
    bar.name = `Bar ${i + 1}`
    bar.resize(20, 2.2)
    bar.cornerRadius = 2
    bar.x = 3
    bar.y = 5 + i * 7
    bar.fills = [{ type: 'SOLID', color: barColor }]
    iconFrame.appendChild(bar)
  }

  parent.appendChild(iconFrame)
  return iconFrame
}

/** Creates a close (×) icon frame. */
function createCloseIcon(color: RGB): FrameNode {
  const frame = figma.createFrame()
  frame.name = 'Close Menu Icon'
  frame.resize(26, 26)
  frame.fills = []
  frame.clipsContent = false

  for (let i = 0; i < 2; i++) {
    const line = figma.createRectangle()
    line.name = `X Line ${i + 1}`
    line.resize(18, 2.2)
    line.cornerRadius = 2
    line.x = 4
    line.y = 12
    line.rotation = i === 0 ? 45 : -45
    line.fills = [{ type: 'SOLID', color }]
    frame.appendChild(line)
  }
  return frame
}

// ============================================================
// STRUCTURE ANALYSIS FUNCTIONS
// ============================================================

/**
 * Checks if a node uses Auto Layout (HORIZONTAL or VERTICAL).
 */
function detectAutoLayout(node: SceneNode): 'HORIZONTAL' | 'VERTICAL' | 'NONE' {
  if ('layoutMode' in node) {
    const f = node as FrameNode
    if (f.layoutMode === 'HORIZONTAL') return 'HORIZONTAL'
    if (f.layoutMode === 'VERTICAL') return 'VERTICAL'
  }
  return 'NONE'
}

/**
 * Structural similarity score between two sibling nodes [0..1].
 * Based on: node type, child count, width/height variance.
 *
 * IMPORTANT: Leaf nodes (TEXT, VECTOR, RECTANGLE with 0 children) are NOT
 * awarded similarity just for both being leaves — that caused false positives
 * where any 3+ mixed children were detected as repeated.
 */
function siblingSimScore(a: SceneNode, b: SceneNode): number {
  let score = 0

  // Same type — primary signal
  if (a.type === b.type) score += 0.4

  // Similar child count — only meaningful when BOTH have children
  const aKids = 'children' in a ? (a as ChildrenMixin).children.length : 0
  const bKids = 'children' in b ? (b as ChildrenMixin).children.length : 0
  if (aKids > 0 && bKids > 0) {
    const ratio = Math.min(aKids, bKids) / Math.max(aKids, bKids)
    score += ratio * 0.3
  }
  // NOTE: no bonus for "both have 0 children" — leaf nodes are NOT evidence of repetition

  // Similar width — must be meaningful (avoid scoring 1x1 vs 2x2 as similar)
  if (a.width > 10 && b.width > 10) {
    const wRatio = Math.min(a.width, b.width) / Math.max(a.width, b.width)
    score += wRatio * 0.15
  }

  // Similar height
  if (a.height > 10 && b.height > 10) {
    const hRatio = Math.min(a.height, b.height) / Math.max(a.height, b.height)
    score += hRatio * 0.15
  }

  return score
}

/**
 * Checks if a single node looks like a self-contained card/tile:
 * - Is a container type (FRAME, COMPONENT, INSTANCE, GROUP)
 * - Has at least 1 child
 * - Does NOT look like a full-width section header (wide text-only)
 */
function looksLikeCard(node: SceneNode): boolean {
  if (node.type !== 'FRAME' && node.type !== 'COMPONENT' &&
      node.type !== 'INSTANCE' && node.type !== 'GROUP') return false
  if (!('children' in node)) return false
  const kids = (node as ChildrenMixin).children
  if (kids.length === 0) return false
  // A card-like item is NOT entirely made of a single wide text node
  if (kids.length === 1 && kids[0].type === 'TEXT') return false
  return true
}

/**
 * Detects if the children of a node form a repeated collection.
 *
 * Stricter criteria vs V9:
 * - Minimum 3 container siblings that look like cards/tiles
 * - Average pairwise structural similarity ≥ 0.75 (raised from 0.60)
 * - The siblings must be CONTAINER types (FRAME/COMPONENT/INSTANCE/GROUP)
 * - Heterogeneous compositions (e.g. one image + one text + one button) are NOT repeated
 * - All containers must have at least 1 child
 *
 * DEFAULT: false — when in doubt, do NOT classify as repeated.
 */
function detectRepeatedCollection(kids: SceneNode[]): boolean {
  // Filter to only proper containers that look like cards
  const cards = kids.filter(k => looksLikeCard(k))

  // Need at least 3 card-like siblings
  if (cards.length < 3) return false

  // Guard: if the sibling count is small relative to containers, it may be
  // a heterogeneous composition (e.g. Hero: [image, text-group, button-group])
  // Require that at least 75% of visible children are card-like
  const allVisible = kids.filter(k => k.visible !== false)
  if (cards.length < allVisible.length * 0.75) return false

  // Calculate average pairwise structural similarity
  let totalSim = 0
  let pairs = 0
  const sample = cards.slice(0, Math.min(cards.length, 6))
  for (let i = 0; i < sample.length - 1; i++) {
    totalSim += siblingSimScore(sample[i], sample[i + 1])
    pairs++
  }
  const avgSim = pairs > 0 ? totalSim / pairs : 0

  // Raised threshold: 0.75 (was 0.60)
  return avgSim >= 0.75
}

/**
 * Determines the optimal column count for a confirmed repeated collection on mobile.
 * Only called AFTER detectRepeatedCollection has returned true.
 *
 * Default is 1 column. 2 columns requires positive evidence that items
 * are compact enough to fit side-by-side and remain readable.
 */
function detectCollectionColumns(kids: SceneNode[], vp: RVP): number {
  const cards = kids.filter(k => looksLikeCard(k))
  if (cards.length === 0) return 1

  const sampleCount = Math.min(cards.length, 4)
  const sample = cards.slice(0, sampleCount)

  const avgW = sample.reduce((s, c) => s + c.width, 0) / sampleCount
  const avgH = sample.reduce((s, c) => s + c.height, 0) / sampleCount
  const avgKidCount = sample.reduce((s, c) => {
    return s + ('children' in c ? (c as ChildrenMixin).children.length : 0)
  }, 0) / sampleCount

  // What would each card's width be in a 2-col layout?
  const mobileItemW = Math.floor((vp.width - vp.padding * 2 - vp.colGap) / 2)

  // Hard minimum: cards must be at least 100px wide in mobile 2-col
  if (mobileItemW < 100) return 1

  // Text-heavy cards (tall & many children): always 1 column
  const aspectRatio = avgH / Math.max(avgW, 1)
  if (aspectRatio > 2.0 && avgKidCount > 3) return 1

  // Very wide desktop cards that would be squished too much: 1 column
  // If avg desktop card width > 60% of desktop parent, items are wide-format
  // and would become unreadably narrow at 2-col on mobile
  if (avgW > vp.width * 1.0) return 1  // wider than mobile viewport = full width

  // Cards that are already compact squares or short rectangles on desktop → 2 col
  // Evidence: desktop item width < 300px AND height < 300px AND few children
  if (avgW <= 300 && avgH <= 300 && avgKidCount <= 5) return 2

  // Large cards (wider desktop layout) → 1 column to preserve readability
  return 1
}

/**
 * Detects if a node is a navigation bar.
 * A navigation bar:
 * - Is a horizontal frame (or has children laid out horizontally)
 * - Has heterogeneous children: at least one brand/logo element + at least one nav-link-like element
 * - Or has 3+ text children treated as nav links in a horizontal row
 * - Position: near the top of its parent (top 20% of parent height)
 */
interface NavElements {
  brandCandidates: SceneNode[]
  navLinkCandidates: SceneNode[]
  actionCandidates: SceneNode[]
  bgNodes: SceneNode[]
}

/**
 * Detects if a node is an announcement / promotional banner bar.
 * An announcement bar:
 * - Has compact height (<= 48px)
 * - Is named like banner, promo, announcement, alert, top-bar, notice
 * - Or contains at most 1 text node and no brand/logo
 * Should NEVER be transformed into a mobile navigation with hamburger button.
 */
function isAnnouncementBar(node: SceneNode): boolean {
  const name = (node.name || '').toLowerCase()
  if (/(announce|promo|banner|notice|alert|top-bar|topbar)/i.test(name)) return true
  if (node.height <= 48 && 'children' in node) {
    const kids = visibleChildren(node).filter(k => !isBackgroundNode(k, node.width, node.height))
    const hasBrand = kids.some(k => isLikelyBrandElement(k))
    const textKids = kids.filter(k => k.type === 'TEXT')
    if (!hasBrand && textKids.length <= 1) return true
  }
  return false
}

function detectNavigationStructure(
  node: SceneNode,
  parentH: number
): boolean {
  if (!('children' in node)) return false
  if (isAnnouncementBar(node)) return false
  const kids = visibleChildren(node)
  if (kids.length < 2) return false

  const relY = nY(node) / Math.max(1, parentH)
  const alMode = detectAutoLayout(node)

  // Must be near the top of the page (top 20%)
  if (relY > 0.20) return false

  // Must be horizontal or have horizontally-arranged children
  const isHorizontal = alMode === 'HORIZONTAL' ||
    (alMode === 'NONE' && isHorizontallyArranged(kids, node.width))

  if (!isHorizontal) return false

  // Must have a nav-like height: compact row, not a content section.
  // Raised from 120 → 160 to handle taller desktop navbars.
  // Also allow taller if the node is a very thin vertical slice of the page (< 12% of page height).
  const isShort = node.height <= 160
  const isThinSlice = node.height / Math.max(1, parentH) < 0.12
  if (!isShort && !isThinSlice) return false

  // Must NOT be a repeated collection of similar items (that's a horizontal card row, not a nav)
  const fgKids = kids.filter(k => !isBackgroundNode(k, node.width, node.height))
  if (detectRepeatedCollection(fgKids)) return false

  return true
}

/**
 * Checks if a node is an existing menu, hamburger, or drawer trigger
 * that should NEVER be cloned into mobile action items (we generate exactly ONE standardized trigger).
 */
function isMenuTriggerElement(n: SceneNode): boolean {
  const name = (n.name || '').toLowerCase()
  if (
    name.includes('hamburger') ||
    name.includes('nav-toggle') ||
    name.includes('drawer') ||
    name.includes('list-button') ||
    name.includes('list_button')
  ) {
    return true
  }
  if (name.includes('menu')) {
    if (
      name.includes('button') ||
      name.includes('icon') ||
      name.includes('trigger') ||
      name.includes('toggle') ||
      name.includes('btn')
    ) {
      return true
    }
    if (n.width <= 48 && n.height <= 48) return true
  }
  return false
}

/**
 * Checks if a node is a header utility element (search, cart, profile, etc.)
 * that should NEVER be treated as a navigation link or brand.
 */
function isUtilityElement(n: SceneNode): boolean {
  if (isMenuTriggerElement(n)) return true
  const name = (n.name || '').toLowerCase()
  if (
    name.includes('search') ||
    name.includes('cart') ||
    name.includes('bag') ||
    name.includes('basket') ||
    name.includes('profile') ||
    name.includes('user') ||
    name.includes('account') ||
    name.includes('avatar') ||
    name.includes('bell') ||
    name.includes('notif') ||
    name.includes('close')
  ) {
    return true
  }
  if (isIconNode(n)) {
    if ('children' in n) {
      const hasText = (n as ChildrenMixin).children.some(c => c.type === 'TEXT')
      if (!hasText) return true
    } else {
      return true
    }
  }
  return false
}

/**
 * Checks if a node is likely a brand / logo element.
 */
function isLikelyBrandElement(n: SceneNode): boolean {
  if (isUtilityElement(n)) return false
  const name = (n.name || '').toLowerCase()
  if (name.includes('logo') || name.includes('brand')) return true
  if (isImageNode(n)) return true
  if (nX(n) <= 60 && n.width <= 260 && n.height <= 60) {
    if (n.type === 'TEXT' && (n as TextNode).characters.length <= 30) return true
    if ('children' in n) {
      const kids = visibleChildren(n)
      if (kids.length >= 1 && kids.length <= 3) return true
    }
  }
  return false
}

function hasTextContent(n: SceneNode): boolean {
  if (n.type === 'TEXT') return true
  if ('children' in n) {
    for (const c of (n as ChildrenMixin).children) {
      if (c.visible !== false && hasTextContent(c)) return true
    }
  }
  return false
}

/**
 * Checks if a candidate node looks like an individual navigation item.
 */
function isNavItemCandidate(n: SceneNode): boolean {
  if (isMenuTriggerElement(n)) return false
  if (isUtilityElement(n)) return false
  if (isLikelyBrandElement(n)) return false

  if (n.type === 'TEXT') return true

  if ('children' in n) {
    if (n.height > 80 || n.width > 320) return false
    const name = (n.name || '').toLowerCase()
    if (
      name.includes('nav') ||
      name.includes('link') ||
      name.includes('item') ||
      name.includes('tab') ||
      name.includes('menu')
    ) {
      return true
    }
    // Has text content anywhere inside this compact item
    if (hasTextContent(n)) return true
  }
  return false
}

/**
 * Detects if a top-level section or node is a navigation/menu/links item or container
 * that should be replaced/consumed by the mobile list button, NOT reflowed as page content.
 */
function isNavLinksSection(node: SceneNode, parentH: number, origY: number): boolean {
  if (!isValidFigmaNode(node)) return false

  const name = (node.name || '').toLowerCase()

  // Footer is NEVER a nav links section to be consumed
  if (name.includes('footer')) return false

  // Must be located near the top of the design (top 35% of canvas height or Y <= 320)
  const relY = origY / Math.max(1, parentH)
  if (relY > 0.35 && origY > 320) return false

  // If it's a very tall content section (> 220px and > 15% of page), it's not a pure nav links bar
  if (node.height > 220 && node.height / Math.max(1, parentH) > 0.15) return false

  // 1. Direct name match for nav/menu/links
  if (
    name.includes('nav') ||
    name.includes('menu') ||
    name.includes('link') ||
    name.includes('tab') ||
    name.includes('header')
  ) {
    return true
  }

  // 2. Loose text node or button-like node at the top of the canvas
  if (node.type === 'TEXT') {
    return true
  }
  if (isButtonLike(node) && node.width <= 220 && node.height <= 64) {
    return true
  }

  // 3. Structural navigation detection
  if (detectNavigationStructure(node, parentH)) return true

  // 4. Container whose foreground children are primarily nav items, links, or buttons
  if ('children' in node) {
    const kids = visibleChildren(node).filter(k => !isBackgroundNode(k, node.width, node.height))
    if (kids.length === 0) return false
    const navLikeKids = kids.filter(k => isNavItemCandidate(k) || isButtonLike(k) || isUtilityElement(k))
    if (navLikeKids.length >= 1 && navLikeKids.length >= kids.length * 0.5) {
      return true
    }
  }

  return false
}

/**
 * Extracts navigation links from a secondary nav section.
 */
function extractSecondaryNavItems(secondaryNode: SceneNode): SceneNode[] {
  if (!isValidFigmaNode(secondaryNode)) return []
  if (secondaryNode.type === 'TEXT') return [secondaryNode]
  if ('children' in secondaryNode) {
    const { navItems } = findNavigationCollection(secondaryNode, null)
    if (navItems.length > 0) return navItems
    const kids = visibleChildren(secondaryNode).filter(
      k => !isBackgroundNode(k, secondaryNode.width, secondaryNode.height) && !isUtilityElement(k)
    )
    const candidates = kids.filter(k => isNavItemCandidate(k) || isButtonLike(k))
    if (candidates.length > 0) return candidates
  }
  return []
}

/**
 * Finds the actual collection of navigation items.
 * Distinguishes the navigation container frame from the actual navigation items inside it.
 * Uses controlled recursive unwrapping if a single intermediate wrapper frame exists.
 */
function findNavigationCollection(
  node: SceneNode,
  brandCandidate: SceneNode | null
): { navItems: SceneNode[]; navContainer: SceneNode | null } {
  if (!('children' in node)) return { navItems: [], navContainer: null }

  const candidates = visibleChildren(node).filter(
    c => c !== brandCandidate && !isBackgroundNode(c, node.width, node.height)
  )

  // Step 1: Look for a container child that holds multiple navigation items
  for (const cand of candidates) {
    if (isUtilityElement(cand)) continue

    if ('children' in cand) {
      let container: SceneNode = cand
      // Controlled unwrap of single-child wrappers (e.g. NavContainer -> Wrapper -> [Items])
      while ('children' in container) {
        const sub = visibleChildren(container).filter(
          c => !isBackgroundNode(c, container.width, container.height)
        )
        if (sub.length === 1 && 'children' in sub[0] && !isNavItemCandidate(sub[0])) {
          container = sub[0]
        } else {
          break
        }
      }

      const innerKids = visibleChildren(container).filter(
        c => !isBackgroundNode(c, container.width, container.height)
      )

      if (innerKids.length >= 2) {
        const navKids = innerKids.filter(k => isNavItemCandidate(k))
        if (navKids.length >= 2 && navKids.length >= innerKids.length * 0.5) {
          return { navItems: navKids, navContainer: cand }
        }
      }
    }
  }

  // Step 2: Check if direct children themselves are navigation items
  const directNav = candidates.filter(c => isNavItemCandidate(c))
  if (directNav.length >= 2) {
    return { navItems: directNav, navContainer: null }
  } else if (directNav.length === 1) {
    const single = directNav[0]
    if ('children' in single) {
      const subKids = visibleChildren(single).filter(
        c => !isBackgroundNode(c, single.width, single.height) && !isUtilityElement(c)
      )
      if (subKids.length >= 2) {
        return { navItems: subKids, navContainer: single }
      }
    }
    return { navItems: directNav, navContainer: null }
  }

  // Step 3: Check any candidate container with children
  for (const cand of candidates) {
    if ('children' in cand && !isUtilityElement(cand)) {
      const subKids = visibleChildren(cand).filter(
        c => !isBackgroundNode(c, cand.width, cand.height) && !isUtilityElement(c)
      )
      if (subKids.length >= 2) {
        return { navItems: subKids, navContainer: cand }
      }
    }
  }

  return { navItems: [], navContainer: null }
}

/**
 * Extracts brand, nav-link, and action elements from a nav node.
 * Logic: purely structural with controlled recursive navigation item detection.
 */
function extractNavElements(node: SceneNode, containerW: number, containerH: number): NavElements {
  if (!('children' in node)) {
    return { brandCandidates: [], navLinkCandidates: [], actionCandidates: [], bgNodes: [] }
  }

  const kids = visibleChildren(node)
  const bgNodes: SceneNode[] = []
  const remaining: SceneNode[] = []

  for (const k of kids) {
    if (isBackgroundNode(k, containerW, containerH)) {
      bgNodes.push(k)
    } else {
      remaining.push(k)
    }
  }

  if (remaining.length === 0) {
    return { brandCandidates: [], navLinkCandidates: [], actionCandidates: [], bgNodes }
  }

  // Sort by X position
  remaining.sort((a, b) => nX(a) - nX(b))

  const brandCandidates: SceneNode[] = []
  const navLinkCandidates: SceneNode[] = []
  const actionCandidates: SceneNode[] = []

  // 1. Identify Brand / Logo
  let brandNode: SceneNode | null = null
  const namedLogo = remaining.find(n => /(logo|brand)/i.test(n.name))
  if (namedLogo && !isUtilityElement(namedLogo)) {
    brandNode = namedLogo
  } else if (remaining.length > 0 && isLikelyBrandElement(remaining[0])) {
    brandNode = remaining[0]
  } else if (
    remaining.length >= 2 &&
    remaining[0].width <= 260 &&
    remaining[0].height <= 60 &&
    !isUtilityElement(remaining[0])
  ) {
    brandNode = remaining[0]
  }

  if (brandNode) {
    brandCandidates.push(brandNode)
  }

  // 2. Find Navigation Items (controlled recursive inspection)
  const { navItems, navContainer } = findNavigationCollection(node, brandNode)
  navLinkCandidates.push(...navItems)

  // 3. Classify remaining elements as actions/utilities
  for (const el of remaining) {
    if (el === brandNode) continue
    if (el === navContainer) continue
    if (navItems.includes(el)) continue
    // Exclude any existing menu or hamburger triggers so we never duplicate the list button
    if (isMenuTriggerElement(el)) continue

    if (isUtilityElement(el) || isButtonLike(el)) {
      actionCandidates.push(el)
    } else if ('children' in el) {
      const sub = visibleChildren(el).filter(c => !isBackgroundNode(c, el.width, el.height))
      if (sub.length > 0 && sub.every(c => isUtilityElement(c) || isButtonLike(c))) {
        actionCandidates.push(...sub.filter(s => !isMenuTriggerElement(s)))
      } else {
        actionCandidates.push(el)
      }
    } else {
      actionCandidates.push(el)
    }
  }

  return { brandCandidates, navLinkCandidates, actionCandidates, bgNodes }
}

/**
 * Detects if an array of nodes is horizontally arranged (non-Auto Layout).
 * Criteria: nodes share similar Y coordinate and have consistent gaps.
 */
function isHorizontallyArranged(kids: SceneNode[], parentW: number): boolean {
  if (kids.length < 2) return false

  const ys = kids.map(k => nY(k))
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  // All nodes are roughly at the same vertical position
  const yVariance = maxY - minY
  const avgH = kids.reduce((s, k) => s + k.height, 0) / kids.length

  return yVariance < avgH * 0.5
}

/**
 * Detects if a node is a table-like structure.
 * Table: a vertical list of rows where each row has very consistent
 * child count and horizontal spans.
 */
function detectTableStructure(node: SceneNode): boolean {
  if (!('children' in node)) return false
  const kids = visibleChildren(node)
  if (kids.length < 3) return false

  // All children should be frames/groups (rows)
  const allContainers = kids.every(
    k => k.type === 'FRAME' || k.type === 'GROUP' || k.type === 'COMPONENT' || k.type === 'INSTANCE'
  )
  if (!allContainers) return false

  // All children should span most of the parent width (full-width rows)
  const fullWidthRows = kids.filter(k => k.width >= node.width * 0.80)
  if (fullWidthRows.length < kids.length * 0.75) return false

  // All children should have consistent child count (columns)
  const childCounts = kids.map(k => ('children' in k ? (k as ChildrenMixin).children.length : 0))
  const firstCount = childCounts[0]
  if (firstCount < 2) return false
  const consistentColumns = childCounts.filter(c => Math.abs(c - firstCount) <= 1)
  if (consistentColumns.length < kids.length * 0.80) return false

  return true
}

/**
 * Detects if a top-level child is a sidebar:
 * - A vertical frame (or group) occupying < 30% of the parent width
 * - Positioned at the left (x < 0.3 * parentW) or right (x > 0.7 * parentW)
 * - Has multiple children arranged vertically (navigation items)
 */
interface SidebarDetectionResult {
  hasSidebar: boolean
  sidebarNode: SceneNode | null
  mainContentNodes: SceneNode[]
}

function detectSidebarLayout(
  topLevelKids: SceneNode[],
  parentW: number,
  parentH: number
): SidebarDetectionResult {
  // Look for a child that occupies a narrow vertical strip
  for (const kid of topLevelKids) {
    const kidX = nX(kid)
    const kidW = kid.width
    const kidH = kid.height

    const isNarrow = kidW < parentW * 0.35
    const isTall = kidH >= parentH * 0.50
    const isLeftEdge = kidX < parentW * 0.15
    const isRightEdge = kidX > parentW * 0.65

    if (isNarrow && isTall && (isLeftEdge || isRightEdge)) {
      // Confirm it has multiple stacked children (vertical nav pattern)
      if ('children' in kid) {
        const subKids = visibleChildren(kid)
        if (subKids.length >= 3 && !isHorizontallyArranged(subKids, kidW)) {
          const mainContent = topLevelKids.filter(k => k !== kid)
          return { hasSidebar: true, sidebarNode: kid, mainContentNodes: mainContent }
        }
      }
    }
  }

  return { hasSidebar: false, sidebarNode: null, mainContentNodes: topLevelKids }
}

// ============================================================
// LAYOUT STRATEGY TYPES
// ============================================================

export type LayoutStrategy =
  | 'AUTO_LAYOUT_VERTICAL'    // Existing vertical AL → preserve, scale padding
  | 'AUTO_LAYOUT_HORIZONTAL'  // Existing horizontal AL → may flip to VERTICAL
  | 'NAVIGATION'              // Navigation bar → mobile nav (hamburger + brand + actions)
  | 'REPEATED_COLLECTION'     // Repeated siblings → N-column grid
  | 'TABLE'                   // Table rows → horizontal scroll or stacked
  | 'SIDEBAR_LAYOUT'          // Sidebar + main → stack vertically
  | 'HORIZONTAL_GROUP'        // Non-AL siblings in a row → reflow into columns
  | 'SINGLE_COLUMN'           // Everything else → 1-col vertical stack

// ============================================================
// STRATEGY DETERMINATION
// ============================================================

/**
 * Determines the appropriate mobile layout strategy for a given node.
 * Called per container — NOT globally.
 * Priority order matches specificity: more specific patterns override general ones.
 */
function determineStrategy(
  node: SceneNode,
  vp: RVP,
  parentH: number,
  isTopLevel = false,
  alreadyHasNav = false
): LayoutStrategy {
  // 1. NAVIGATION — horizontal frame near top with brand + links
  // ONLY for top-level section near top of page, and ONLY if navigation hasn't already been reflowed!
  // This avoids Auto Layout headers being misclassified as AUTO_LAYOUT_HORIZONTAL, and prevents
  // nested children or repeated sections from ever generating multiple mobile menus.
  if (isTopLevel && !alreadyHasNav && detectNavigationStructure(node, parentH)) {
    return 'NAVIGATION'
  }

  const alMode = detectAutoLayout(node)

  // 2. AUTO LAYOUT — preserve existing AL structure
  if (alMode === 'HORIZONTAL') return 'AUTO_LAYOUT_HORIZONTAL'
  if (alMode === 'VERTICAL') return 'AUTO_LAYOUT_VERTICAL'

  if (!('children' in node)) return 'SINGLE_COLUMN'
  const kids = visibleChildren(node).filter(k => !isBackgroundNode(k, node.width, node.height))
  if (kids.length === 0) return 'SINGLE_COLUMN'

  // 3. TABLE — consistent rows spanning full width
  if (detectTableStructure(node)) return 'TABLE'

  // 4. REPEATED COLLECTION — structurally similar sibling items
  if (detectRepeatedCollection(kids)) return 'REPEATED_COLLECTION'

  // 5. HORIZONTAL GROUP — non-AL children arranged horizontally
  if (kids.length >= 2 && isHorizontallyArranged(kids, node.width)) return 'HORIZONTAL_GROUP'

  // 6. DEFAULT
  return 'SINGLE_COLUMN'
}

// ============================================================
// TRANSFORMER: AUTO LAYOUT (VERTICAL)
// ============================================================

/**
 * Transforms a VERTICAL Auto Layout node for mobile.
 * Preserves all AL properties. Only scales padding.
 */
async function transformAutoLayoutVertical(
  node: FrameNode,
  targetW: number,
  vp: RVP,
  log: string[]
): Promise<number> {
  // Scale padding to mobile
  const scalePad = (v: number) => Math.min(v, vp.padding)
  node.paddingLeft = Math.round(scalePad(node.paddingLeft))
  node.paddingRight = Math.round(scalePad(node.paddingRight))
  node.paddingTop = Math.round(Math.min(node.paddingTop, vp.padding * 2))
  node.paddingBottom = Math.round(Math.min(node.paddingBottom, vp.padding * 2))

  // Resize to mobile width
  if (node.primaryAxisSizingMode === 'FIXED') {
    doResize(node, targetW, node.height)
  } else {
    doResize(node, targetW, node.height)
    node.primaryAxisSizingMode = 'AUTO'
  }

  // Adapt horizontal sizing
  if (node.counterAxisSizingMode === 'AUTO') {
    // HUG width — let it shrink to content
    doResize(node, targetW, node.height)
  }

  // Recurse into children that have Auto Layout or complex structure
  for (const child of node.children) {
    if (child.visible === false) continue
    if ('layoutMode' in child) {
      await reflowNode(child, vp, targetW - node.paddingLeft - node.paddingRight, log)
    } else if (child.type === 'TEXT') {
      const innerW = targetW - node.paddingLeft - node.paddingRight
      await reflowTextNode(child as TextNode, Math.max(1, innerW), vp, log)
    } else if ('children' in child) {
      const innerW = targetW - node.paddingLeft - node.paddingRight
      await reflowNode(child, vp, Math.max(1, innerW), log)
    }
  }

  log.push(`"${node.name}" [AUTO_LAYOUT_VERTICAL]: preserved, width ${targetW}px`)
  return node.height
}

// ============================================================
// TRANSFORMER: AUTO LAYOUT (HORIZONTAL)
// ============================================================

/**
 * Transforms a HORIZONTAL Auto Layout node for mobile.
 * If total child widths exceed available width, switches to VERTICAL.
 * Otherwise preserves HORIZONTAL with scaled padding.
 */
async function transformAutoLayoutHorizontal(
  node: FrameNode,
  targetW: number,
  vp: RVP,
  log: string[]
): Promise<number> {
  const kids = node.children.filter(c => c.visible !== false)
  const totalChildW = kids.reduce((s, c) => s + c.width, 0) + (kids.length - 1) * (node.itemSpacing || 0)
  const availW = targetW - (node.paddingLeft || 0) - (node.paddingRight || 0)

  // Scale padding
  const scalePad = (v: number) => Math.min(v, vp.padding)
  const origPadL = node.paddingLeft
  const origPadR = node.paddingRight
  node.paddingLeft = Math.round(scalePad(origPadL))
  node.paddingRight = Math.round(scalePad(origPadR))
  node.paddingTop = Math.round(Math.min(node.paddingTop, vp.padding * 2))
  node.paddingBottom = Math.round(Math.min(node.paddingBottom, vp.padding * 2))

  const newAvailW = targetW - node.paddingLeft - node.paddingRight

  if (totalChildW > availW && vp.width < 768) {
    // Children won't fit horizontally → switch to vertical
    node.layoutMode = 'VERTICAL'
    if (!node.itemSpacing || node.itemSpacing > 40) node.itemSpacing = SPACING.NORMAL

    // Resize children to fill width
    for (const child of kids) {
      if ('layoutSizingHorizontal' in child && (child as any).layoutSizingHorizontal === 'FILL') {
        // Keep FILL — Auto Layout handles it
      } else {
        doResize(child, newAvailW, child.height)
      }
      if (child.type === 'TEXT') {
        await reflowTextNode(child as TextNode, newAvailW, vp, log)
      } else if ('children' in child) {
        await reflowNode(child, vp, newAvailW, log)
      }
    }

    doResize(node, targetW, node.height)
    log.push(`"${node.name}" [AUTO_LAYOUT_HORIZONTAL→VERTICAL]: flipped due to overflow`)
  } else {
    // Children fit — preserve HORIZONTAL, just resize node
    doResize(node, targetW, node.height)

    // Scale children that have FILL sizing
    for (const child of kids) {
      if (child.type === 'TEXT') {
        await reflowTextNode(child as TextNode, Math.min(child.width, newAvailW), vp, log)
      } else if ('children' in child) {
        await reflowNode(child, vp, child.width, log)
      }
    }

    log.push(`"${node.name}" [AUTO_LAYOUT_HORIZONTAL]: preserved (children fit)`)
  }

  return node.height
}

// ============================================================
// TRANSFORMER: NAVIGATION
// ============================================================

interface NavigationSnapshot {
  originalId: string
  originalName: string
  originalX: number
  originalY: number
  originalWidth: number
  originalHeight: number
  originalLayoutMode: string
  parent: (BaseNode & ChildrenMixin) | null
  parentIndex: number
  brandNode: SceneNode | null
  navigationItems: SceneNode[]
  actionItems: SceneNode[]
  bgNodes: SceneNode[]
  bgPaints: Paint[]
  iconColor: RGB
}

interface NavigationTransformResult {
  height: number
  activeNode: SceneNode
}

function safeClone(n: SceneNode): SceneNode {
  try {
    return n.clone()
  } catch (_) {
    return n
  }
}

/**
 * Transforms a desktop navigation bar into a Figma ComponentSet with two variants:
 *   Variant 1: State=Closed  — compact header row (hamburger | brand | actions)
 *   Variant 2: State=Open    — header row + full-width menu panel with all links
 *
 * Sequence:
 *   1. Detect navigation & capture snapshot of structure & geometry BEFORE mutation
 *   2. Build mobile navigation (Closed + Open variants) using cloned nodes
 *   3. Wire prototype interactions on live nodes (Closed <-> Open)
 *   4. Validate new nodes
 *   5. Remove/replace obsolete desktop navigation ONLY after successful transformation
 *   6. Return the new live node for downstream page flow calculations
 *
 * Debug log: [Mobile Navigation]
 */
async function transformNavigationNode(
  sourceNode: SceneNode,
  vp: RVP,
  log: string[],
  extraNavItems: SceneNode[] = []
): Promise<NavigationTransformResult> {
  const H = Math.max(52, vp.navH)

  if (!isValidFigmaNode(sourceNode)) {
    console.warn('[Navigation] Node became invalid; stopping stale-node transformation', sourceNode?.id)
    return { height: H, activeNode: sourceNode }
  }

  // 1. Capture required values BEFORE mutation
  const originalId = sourceNode.id
  const originalName = sourceNode.name
  const originalX = nX(sourceNode)
  const originalY = nY(sourceNode)
  const originalWidth = sourceNode.width
  const originalHeight = sourceNode.height
  const originalLayoutMode = 'layoutMode' in sourceNode ? (sourceNode as FrameNode).layoutMode : 'NONE'
  const navParent = sourceNode.parent as (BaseNode & ChildrenMixin) | null
  const parentIndex = navParent && 'children' in navParent ? navParent.children.indexOf(sourceNode) : -1

  if (!('children' in sourceNode)) {
    doResize(sourceNode, vp.width, H)
    log.push(`"${originalName}" [NAVIGATION]: leaf node resized to compact bar`)
    return { height: H, activeNode: sourceNode }
  }

  const fr = sourceNode as FrameNode

  // 2. Extract structural nav elements BEFORE modifying the node
  const { brandCandidates, navLinkCandidates, actionCandidates, bgNodes } =
    extractNavElements(fr, vp.width, H)

  // Merge any extra nav items discovered from adjacent navigation/links sections
  for (const extra of extraNavItems) {
    if (isValidFigmaNode(extra) && !navLinkCandidates.includes(extra)) {
      navLinkCandidates.push(extra)
    }
  }

  // Detect icon color from background
  let iconColor: RGB = { r: 0.12, g: 0.14, b: 0.17 }
  for (const bg of bgNodes) {
    if ('fills' in bg && Array.isArray((bg as any).fills)) {
      const solidFill = (bg as any).fills.find(
        (f: any) => f.type === 'SOLID' && f.visible !== false
      )
      if (solidFill) {
        const lum =
          0.299 * solidFill.color.r +
          0.587 * solidFill.color.g +
          0.114 * solidFill.color.b
        iconColor = lum > 0.5
          ? { r: 0.12, g: 0.14, b: 0.17 }
          : { r: 0.95, g: 0.95, b: 0.95 }
        break
      }
    }
  }

  // Background paint used for both variants
  let navBgPaints: Paint[] = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]
  if (bgNodes.length > 0 && 'fills' in bgNodes[0]) {
    const bgFills = (bgNodes[0] as any).fills
    if (Array.isArray(bgFills) && bgFills.length > 0) navBgPaints = bgFills
  }

  // 3. Snapshot source structure
  const snapshot: NavigationSnapshot = {
    originalId,
    originalName,
    originalX,
    originalY,
    originalWidth,
    originalHeight,
    originalLayoutMode,
    parent: navParent,
    parentIndex,
    brandNode: brandCandidates.length > 0 ? brandCandidates[0] : null,
    navigationItems: navLinkCandidates,
    actionItems: actionCandidates,
    bgNodes,
    bgPaints: navBgPaints,
    iconColor,
  }

  if (vp.width >= 768) {
    // ── Tablet / Laptop: simple horizontal reflow ──
    if ('layoutMode' in fr && fr.layoutMode !== 'NONE') fr.layoutMode = 'NONE'
    doResize(fr, vp.width, H)
    fr.clipsContent = false
    if (snapshot.brandNode && isValidFigmaNode(snapshot.brandNode)) {
      setPos(snapshot.brandNode, vp.padding, Math.round((H - Math.min(snapshot.brandNode.height, H)) / 2))
    }
    let rightX = vp.width - vp.padding
    for (let i = snapshot.actionItems.length - 1; i >= 0; i--) {
      const act = snapshot.actionItems[i]
      if (!isValidFigmaNode(act)) continue
      const aw = Math.min(act.width, 80)
      const ah = Math.min(act.height, H - vp.padding)
      rightX -= aw
      setPos(act, rightX, Math.round((H - ah) / 2))
      doResize(act, aw, ah)
      rightX -= SPACING.SMALL
    }
    for (const bg of snapshot.bgNodes) {
      if (isValidFigmaNode(bg)) {
        setPos(bg, 0, 0)
        doResize(bg, vp.width, H)
      }
    }
    log.push(`"${snapshot.originalName}" [NAVIGATION]: tablet/laptop horizontal nav, H=${H}px`)
    return { height: H, activeNode: fr }
  }

  // ──────────────────────────────────────────
  // MOBILE: Create ComponentSet with Closed + Open variants
  // ──────────────────────────────────────────

  const allPanelItems = [
    ...snapshot.navigationItems,
    ...snapshot.actionItems.filter(a => isButtonLike(a) || a.width > 40),
  ]
  const panelLinkH = 48
  const panelInnerH = allPanelItems.length * (panelLinkH + SPACING.SMALL)
  const panelH = SPACING.NORMAL + panelInnerH + SPACING.NORMAL
  const openVariantH = H + panelH

  // Helper: build compact header row using clones
  async function buildHeaderRow(
    targetFrame: FrameNode,
    iconType: 'hamburger' | 'close'
  ): Promise<void> {
    if (iconType === 'hamburger') {
      createHamburgerIcon(targetFrame, vp.padding, Math.round((H - 26) / 2), snapshot.iconColor)
    } else {
      const closeIcon = createCloseIcon(snapshot.iconColor)
      setPos(closeIcon, vp.padding, Math.round((H - 26) / 2))
      targetFrame.appendChild(closeIcon)
    }

    let brandEndX = vp.padding + 26 + SPACING.SMALL
    if (snapshot.brandNode && isValidFigmaNode(snapshot.brandNode)) {
      const brand = safeClone(snapshot.brandNode)
      try { targetFrame.appendChild(brand) } catch (_) {}
      brand.visible = true
      const bH = Math.min(brand.height, H - vp.padding)
      const bAspect = brand.width / Math.max(1, brand.height)
      const bW = Math.min(Math.round(vp.width * 0.40), Math.round(bH * bAspect))
      setPos(brand, brandEndX, Math.round((H - bH) / 2))
      doResize(brand, bW, bH)
      if (brand.type === 'TEXT') await reflowTextNode(brand as TextNode, bW, vp)
      brandEndX += bW + SPACING.SMALL
    }

    // Header bar allows at most ONE small utility icon (<= 40px) on the right.
    // All other action buttons (CTAs, Sign-In, etc.) are placed cleanly in the open menu panel!
    const utilityActions = snapshot.actionItems.filter(
      a => isValidFigmaNode(a) && !isButtonLike(a) && a.width <= 40 && a.height <= 40
    )
    if (utilityActions.length > 0) {
      const actOrig = utilityActions[utilityActions.length - 1]
      const act = safeClone(actOrig)
      try { targetFrame.appendChild(act) } catch (_) {}
      const aw = Math.min(act.width, 32)
      const ah = Math.min(act.height, 32)
      const targetX = vp.width - vp.padding - aw
      if (targetX > brandEndX + SPACING.SMALL) {
        act.visible = true
        setPos(act, targetX, Math.round((H - ah) / 2))
        doResize(act, aw, ah)
      }
    }
  }

  // Helper: build nav links panel using clones
  async function buildLinksPanel(targetFrame: FrameNode, startY: number): Promise<void> {
    let linkY = startY + SPACING.NORMAL
    for (const linkOrig of allPanelItems) {
      if (!isValidFigmaNode(linkOrig)) continue
      const linkClone = safeClone(linkOrig)
      try { targetFrame.appendChild(linkClone) } catch (_) {}
      linkClone.visible = true
      const lH = Math.min(linkClone.height, panelLinkH)
      const lW = vp.width - vp.padding * 2
      setPos(linkClone, vp.padding, linkY)
      doResize(linkClone, lW, lH)
      if (linkClone.type === 'TEXT') {
        await reflowTextNode(linkClone as TextNode, lW, vp)
      }
      linkY += lH + SPACING.SMALL
    }
  }

  let prototypeInteractionCreated = false

  try {
    // 5. Create closed variant component
    const closedComp = figma.createComponent()
    closedComp.name = 'State=Closed'
    closedComp.resize(vp.width, H)
    closedComp.fills = snapshot.bgPaints
    closedComp.clipsContent = false
    await buildHeaderRow(closedComp, 'hamburger')

    // 6. Create open variant component
    const openComp = figma.createComponent()
    openComp.name = 'State=Open'
    openComp.resize(vp.width, openVariantH)
    openComp.fills = snapshot.bgPaints
    openComp.clipsContent = false
    await buildHeaderRow(openComp, 'close')

    // Separator line
    const sep = figma.createRectangle()
    sep.name = 'Separator'
    sep.resize(vp.width, 1)
    sep.fills = [{ type: 'SOLID', color: { r: 0.85, g: 0.85, b: 0.87 } }]
    setPos(sep, 0, H)
    openComp.appendChild(sep)

    // 7. Populate panel
    await buildLinksPanel(openComp, H)

    // Combine into ComponentSet (position master component set off-canvas to the right)
    const compSet = figma.combineAsVariants([closedComp, openComp], figma.currentPage)
    compSet.name = 'Mobile Navigation'
    const parentCanvasX = snapshot.parent && 'x' in snapshot.parent ? (snapshot.parent as any).x : 0
    const parentCanvasY = snapshot.parent && 'y' in snapshot.parent ? (snapshot.parent as any).y : 0
    const offCanvasX = parentCanvasX + vp.width + 120
    setPos(compSet as unknown as SceneNode, offCanvasX, parentCanvasY)
    compSet.resize(vp.width, openVariantH)

    // 10. Wire prototype interactions on live nodes
    try {
      const hamburgerInClosed = closedComp.children.find(c => c.name === 'Mobile Menu Icon')
      const closeIconInOpen = openComp.children.find(c => c.name === 'Close Menu Icon')

      if (
        isValidFigmaNode(hamburgerInClosed) &&
        isValidFigmaNode(openComp) &&
        'reactions' in hamburgerInClosed
      ) {
        const reaction: Reaction = {
          trigger: { type: 'ON_CLICK' },
          action: {
            type: 'NODE',
            destinationId: openComp.id,
            navigation: 'CHANGE_TO',
            transition: {
              type: 'SMART_ANIMATE',
              easing: { type: 'EASE_OUT' },
              duration: 200,
            },
            preserveScrollPosition: false,
          },
        }
        ;(hamburgerInClosed as any).reactions = [reaction]
        prototypeInteractionCreated = true
      }

      if (
        isValidFigmaNode(closeIconInOpen) &&
        isValidFigmaNode(closedComp) &&
        'reactions' in closeIconInOpen
      ) {
        const reaction: Reaction = {
          trigger: { type: 'ON_CLICK' },
          action: {
            type: 'NODE',
            destinationId: closedComp.id,
            navigation: 'CHANGE_TO',
            transition: {
              type: 'SMART_ANIMATE',
              easing: { type: 'EASE_IN' },
              duration: 200,
            },
            preserveScrollPosition: false,
          },
        }
        ;(closeIconInOpen as any).reactions = [reaction]
        prototypeInteractionCreated = true
      }
    } catch (_) {
      console.log('[Mobile Navigation] Prototype interaction unavailable')
      log.push('[Mobile Navigation] Prototype interaction unavailable')
    }

    // Insert instance of CLOSED variant into the page
    const closedInstance = closedComp.createInstance()
    closedInstance.name = 'Mobile Nav (Closed)'

    const targetParent = snapshot.parent
    if (targetParent && isValidFigmaNode(targetParent as BaseNode)) {
      if ('insertChild' in targetParent) {
        const targetIdx = snapshot.parentIndex >= 0 ? snapshot.parentIndex : 0
        try {
          ;(targetParent as any).insertChild(targetIdx, closedInstance)
        } catch (_) {
          ;(targetParent as any).appendChild(closedInstance)
        }
      } else if ('appendChild' in targetParent) {
        ;(targetParent as any).appendChild(closedInstance)
      }
    }
    setPos(closedInstance, 0, 0)
    doResize(closedInstance, vp.width, H)

    // 11. Validate new node before touching old source
    if (!isValidFigmaNode(closedInstance)) {
      console.warn('[Navigation] Mobile navigation creation failed; keeping source node')
      return { height: snapshot.originalHeight, activeNode: sourceNode }
    }

    // 12. Safe removal of obsolete source node
    let sourceNodeRemoved = false
    if (isValidFigmaNode(sourceNode)) {
      try {
        sourceNode.locked = false
        sourceNode.remove()
        sourceNodeRemoved = true
      } catch (err) {
        console.warn('[Navigation] Could not remove obsolete source node', err)
        try {
          sourceNode.visible = false
          sourceNode.locked = false
          if ('children' in sourceNode) {
            for (const c of (sourceNode as ChildrenMixin).children) {
              c.visible = false
            }
          }
        } catch (_) {}
      }
    }

    // 25. Required debug logging
    console.log('[Mobile Navigation]', {
      navigationDetected: true,
      navigationItemCount: snapshot.navigationItems.length,
      menuTriggerCount: 1,
      componentCreated: true,
      initialState: 'closed',
      prototypeInteractionCreated,
    })

    console.log('[Mobile Navigation]', {
      sourceNodeId: snapshot.originalId,
      sourceNodeRemoved,
      activeNodeId: closedInstance.id,
      activeNodeExists: isValidFigmaNode(closedInstance),
    })

    log.push(
      `"${snapshot.originalName}" [NAVIGATION]: ComponentSet created (Closed H=${H}px, Open H=${openVariantH}px), ${snapshot.navigationItems.length} links, prototype=${prototypeInteractionCreated}`
    )

    // 15. Return the new live node
    return { height: H, activeNode: closedInstance }

  } catch (componentErr) {
    log.push(`[NAVIGATION] ComponentSet unavailable (${componentErr}), using frame fallback`)

    // Source node is STILL ALIVE here (not removed)
    if (!isValidFigmaNode(sourceNode)) {
      return { height: H, activeNode: sourceNode }
    }

    if ('layoutMode' in fr && fr.layoutMode !== 'NONE') fr.layoutMode = 'NONE'
    setPos(fr, 0, 0)
    doResize(fr, vp.width, H)
    fr.clipsContent = false

    // Hide all existing children
    for (const c of [...fr.children]) c.visible = false

    // ONE hamburger button
    createHamburgerIcon(fr, vp.padding, Math.round((H - 26) / 2), snapshot.iconColor)

    // Brand
    let brandEndX = vp.padding + 26 + SPACING.SMALL
    if (snapshot.brandNode && isValidFigmaNode(snapshot.brandNode)) {
      const brand = snapshot.brandNode
      try { fr.appendChild(brand) } catch (_) {}
      brand.visible = true
      const bH = Math.min(brand.height, H - vp.padding)
      const bAspect = brand.width / Math.max(1, brand.height)
      const bW = Math.min(Math.round(vp.width * 0.40), Math.round(bH * bAspect))
      setPos(brand, brandEndX, Math.round((H - bH) / 2))
      doResize(brand, bW, bH)
      if (brand.type === 'TEXT') await reflowTextNode(brand as TextNode, bW, vp)
      brandEndX += bW + SPACING.SMALL
    }

    // At most ONE compact utility icon on header bar
    const fallbackUtility = snapshot.actionItems.filter(
      a => isValidFigmaNode(a) && !isButtonLike(a) && a.width <= 40 && a.height <= 40
    )
    if (fallbackUtility.length > 0) {
      const act = fallbackUtility[fallbackUtility.length - 1]
      if (isValidFigmaNode(act)) {
        try { fr.appendChild(act) } catch (_) {}
        const aw = Math.min(act.width, 32)
        const ah = Math.min(act.height, 32)
        const targetX = vp.width - vp.padding - aw
        if (targetX > brandEndX + SPACING.SMALL) {
          act.visible = true
          setPos(act, targetX, Math.round((H - ah) / 2))
          doResize(act, aw, ah)
        }
      }
    }

    // Backgrounds
    for (const bg of snapshot.bgNodes) {
      if (isValidFigmaNode(bg)) {
        bg.visible = true
        setPos(bg, 0, 0)
        doResize(bg, vp.width, H)
      }
    }

    // Menu panel (hidden drawer, one panel for ALL links)
    if (allPanelItems.length > 0) {
      const panel = figma.createFrame()
      panel.name = 'Mobile Menu Panel'
      panel.resize(vp.width, panelH)
      panel.fills = snapshot.bgPaints
      panel.clipsContent = false
      panel.visible = false

      // Close icon inside panel header
      const closeIcon = createCloseIcon(snapshot.iconColor)
      setPos(closeIcon, vp.padding, Math.round((H - 26) / 2))
      panel.appendChild(closeIcon)

      // All nav links inside ONE panel
      let linkY = SPACING.NORMAL
      for (const link of allPanelItems) {
        if (!isValidFigmaNode(link)) continue
        try {
          panel.appendChild(link)
          link.visible = true
          const lH = Math.min(link.height, panelLinkH)
          const lW = vp.width - vp.padding * 2
          setPos(link, vp.padding, linkY)
          doResize(link, lW, lH)
          if (link.type === 'TEXT') await reflowTextNode(link as TextNode, lW, vp)
          linkY += lH + SPACING.SMALL
        } catch (_) { link.visible = false }
      }

      // Place panel off-canvas on current page (not polluting clone page flow)
      const parentCanvasX = snapshot.parent && 'x' in snapshot.parent ? (snapshot.parent as any).x : 0
      const parentCanvasY = snapshot.parent && 'y' in snapshot.parent ? (snapshot.parent as any).y : 0
      const offCanvasX = parentCanvasX + vp.width + 120
      try {
        figma.currentPage.appendChild(panel)
        setPos(panel, offCanvasX, parentCanvasY)
      } catch (_) {
        panel.visible = false
      }

      // Prototype reactions (fallback path)
      try {
        const hamburgerBtn = fr.children.find(c => c.name === 'Mobile Menu Icon')
        if (hamburgerBtn && 'reactions' in hamburgerBtn) {
          ;(hamburgerBtn as any).reactions = [{
            trigger: { type: 'ON_CLICK' },
            action: {
              type: 'NODE',
              destinationId: null,
              navigation: 'OVERLAY',
              transition: null,
              preserveScrollPosition: false,
            },
          }]
          prototypeInteractionCreated = true
        }
      } catch (_) {}
    }

    // Containment clamp
    for (const c of fr.children) {
      if (isValidFigmaNode(c) && c.visible !== false && !isBackgroundNode(c, vp.width, H)) {
        if (nX(c) + c.width > vp.width) doResize(c, Math.max(8, vp.width - nX(c) - vp.padding), c.height)
        if (nX(c) < 0) setPos(c, 0, nY(c))
        if (nY(c) + c.height > H) doResize(c, c.width, Math.max(4, H - nY(c)))
        if (nY(c) < 0) setPos(c, nX(c), 0)
      }
    }

    console.log('[Mobile Navigation]', {
      navigationDetected: true,
      navigationItemCount: snapshot.navigationItems.length,
      menuTriggerCount: 1,
      componentCreated: false,
      initialState: 'closed',
      prototypeInteractionCreated,
    })

    log.push(
      `"${snapshot.originalName}" [NAVIGATION]: frame fallback, compact nav H=${H}px, ${snapshot.navigationItems.length} links in ONE panel`
    )

    return { height: H, activeNode: fr }
  }
}

// ============================================================
// TRANSFORMER: REPEATED COLLECTION
// ============================================================

/**
 * Transforms a repeated collection of items into a column grid.
 * Column count is determined structurally from item size and content density.
 */
async function transformRepeatedCollection(
  node: SceneNode,
  vp: RVP,
  log: string[]
): Promise<number> {
  if (!('children' in node)) return node.height

  const fr = node as FrameNode

  // Flatten AL if present (we take over layout)
  if ('layoutMode' in fr && fr.layoutMode !== 'NONE') fr.layoutMode = 'NONE'

  const contentW = vp.width - vp.padding * 2
  const allKids = visibleChildren(node)

  // Separate backgrounds, headers, and collection items
  const bgNodes: SceneNode[] = []
  const headerNodes: SceneNode[] = []  // Wide text elements — section headings
  const collectionItems: SceneNode[] = []

  for (const k of allKids) {
    if (isBackgroundNode(k, fr.width, fr.height)) {
      bgNodes.push(k)
    } else if (k.type === 'TEXT' && k.width > fr.width * 0.40) {
      headerNodes.push(k)
    } else {
      collectionItems.push(k)
    }
  }

  const cols = detectCollectionColumns(collectionItems, vp)
  const itemW = cols === 2
    ? Math.floor((contentW - vp.colGap) / 2)
    : contentW

  let localY = vp.padding
  const baseX = vp.padding

  // 1. Section header(s)
  for (const h of headerNodes) {
    setPos(h, baseX, localY)
    if (h.type === 'TEXT') {
      const hh = await reflowTextNode(h as TextNode, contentW, vp, log)
      localY += hh + SPACING.NORMAL
    } else {
      doResize(h, contentW, h.height)
      localY += h.height + SPACING.NORMAL
    }
  }

  // 2. Items in N-column grid
  collectionItems.sort((a, b) => {
    const dy = nY(a) - nY(b)
    if (Math.abs(dy) > 20) return dy
    return nX(a) - nX(b)
  })

  for (let i = 0; i < collectionItems.length; i += cols) {
    const rowItems = collectionItems.slice(i, i + cols)
    const rowHeights: number[] = []

    for (let col = 0; col < rowItems.length; col++) {
      const item = rowItems[col]
      const itemX = baseX + col * (itemW + vp.colGap)

      setPos(item, itemX, localY)
      doResize(item, itemW, item.height)
      const h = await reflowNode(item, vp, itemW, log, true)
      rowHeights.push(h)
    }

    const maxRowH = Math.max(...rowHeights, 1)

    // Equalize row heights
    for (let col = 0; col < rowItems.length; col++) {
      doResize(rowItems[col], itemW, maxRowH)
    }

    localY += maxRowH + vp.colGap
  }

  const finalH = localY + vp.padding
  doResize(fr, vp.width, finalH)

  for (const bg of bgNodes) {
    setPos(bg, 0, 0)
    doResize(bg, vp.width, finalH)
  }

  log.push(`"${node.name}" [REPEATED_COLLECTION]: ${collectionItems.length} items → ${cols}-column grid (${finalH}px)`)
  return finalH
}

// ============================================================
// TRANSFORMER: TABLE
// ============================================================

/**
 * Transforms a table-like structure for mobile.
 * Strategy: wrap in a horizontal scroll container to preserve column structure.
 * The table itself is left at its natural width inside a scrollable wrapper.
 */
async function transformTableNode(
  node: SceneNode,
  vp: RVP,
  log: string[]
): Promise<number> {
  if (!('children' in node)) return node.height

  const fr = node as FrameNode
  if ('layoutMode' in fr && fr.layoutMode !== 'NONE') fr.layoutMode = 'NONE'

  const kids = visibleChildren(node)
  const bgNodes = kids.filter(k => isBackgroundNode(k, fr.width, fr.height))
  const rows = kids.filter(k => !isBackgroundNode(k, fr.width, fr.height))

  // Compact the table: scale font sizes in all text nodes
  async function compactRow(row: SceneNode): Promise<void> {
    if (!('children' in row)) return
    for (const cell of visibleChildren(row)) {
      if (cell.type === 'TEXT') {
        await reflowTextNode(cell as TextNode, cell.width, vp, log)
      } else if ('children' in cell) {
        await compactRow(cell)
      }
    }
  }

  for (const row of rows) {
    await compactRow(row)
  }

  // Stack rows vertically with tight spacing
  let localY = 0
  for (const row of rows) {
    setPos(row, 0, localY)
    localY += row.height + 1
  }

  // Resize frame to contain all rows at its original width (enable scroll in viewer)
  const tableW = Math.min(fr.width, vp.width) // Don't expand beyond mobile width
  const tableH = localY
  doResize(fr, tableW, tableH)
  setPos(fr, Math.max(0, Math.round((vp.width - tableW) / 2)), nY(fr))

  for (const bg of bgNodes) {
    setPos(bg, 0, 0)
    doResize(bg, tableW, tableH)
  }

  log.push(`"${node.name}" [TABLE]: ${rows.length} rows preserved, width capped at ${tableW}px`)
  return tableH
}

// ============================================================
// TRANSFORMER: SIDEBAR LAYOUT
// ============================================================

/**
 * Transforms a sidebar+main layout for mobile.
 *
 * The sidebar is treated as navigation — routed through transformNavigationNode
 * to guarantee exactly ONE hamburger button and a proper mobile nav component.
 * Main content sections are then stacked below.
 */
async function transformSidebarLayout(
  parentFrame: FrameNode,
  sidebarNode: SceneNode,
  mainNodes: SceneNode[],
  vp: RVP,
  log: string[]
): Promise<number> {
  // Route sidebar through the navigation transformer.
  // This guarantees ONE hamburger, ONE menu panel, and the correct compact height.
  const { height: navH, activeNode: activeNav } = await transformNavigationNode(sidebarNode, vp, log)

  // Position the active nav at top
  if (isValidFigmaNode(activeNav)) {
    setPos(activeNav, 0, 0)
  }

  // Stack main content nodes below the compact nav
  let localY = navH + SPACING.SECTION
  for (const main of mainNodes) {
    if (!isValidFigmaNode(main)) continue
    setPos(main, 0, localY)
    doResize(main, vp.width, main.height)
    const h = await reflowNode(main, vp, vp.width, log)
    localY += h + SPACING.SECTION
  }

  const finalH = localY + vp.padding
  doResize(parentFrame, vp.width, finalH)

  log.push(`"${parentFrame.name}" [SIDEBAR_LAYOUT]: sidebar → mobile nav (H=${navH}px), ${mainNodes.length} sections stacked below`)
  return finalH
}

// ============================================================
// TRANSFORMER: HORIZONTAL GROUP
// ============================================================

/**
 * Transforms a non-Auto Layout horizontal group of siblings for mobile.
 *
 * IMPORTANT: Default is SINGLE COLUMN (1 col).
 * 2 columns is only used when:
 *   1. detectRepeatedCollection returns true (structurally similar siblings), AND
 *   2. The items are confirmed compact cards (detectCollectionColumns returns 2)
 *
 * This prevents heterogeneous compositions (Image | Text, or Heading | Button)
 * from being split into an arbitrary 2-column layout.
 */
async function transformHorizontalGroup(
  node: SceneNode,
  vp: RVP,
  log: string[]
): Promise<number> {
  if (!('children' in node)) return node.height

  const fr = node as FrameNode
  if ('layoutMode' in fr && fr.layoutMode !== 'NONE') fr.layoutMode = 'NONE'

  const contentW = vp.width - vp.padding * 2
  const allKids = visibleChildren(node)
  const bgNodes = allKids.filter(k => isBackgroundNode(k, fr.width, fr.height))
  const fgKids = allKids.filter(k => !isBackgroundNode(k, fr.width, fr.height))

  if (fgKids.length === 0) return node.height

  // Sort by original X position
  fgKids.sort((a, b) => nX(a) - nX(b))

  // SAFE DEFAULT: 1 column
  // 2 columns ONLY when there is strong structural evidence of a repeated collection
  const isRepeated = detectRepeatedCollection(fgKids)
  const cols = isRepeated ? detectCollectionColumns(fgKids, vp) : 1

  const itemW = cols === 2
    ? Math.floor((contentW - vp.colGap) / 2)
    : contentW

  let localY = vp.padding
  const baseX = vp.padding

  for (let i = 0; i < fgKids.length; i += cols) {
    const rowItems = fgKids.slice(i, i + cols)
    const rowHeights: number[] = []

    for (let col = 0; col < rowItems.length; col++) {
      const item = rowItems[col]
      const itemX = baseX + col * (itemW + vp.colGap)
      setPos(item, itemX, localY)
      doResize(item, itemW, item.height)
      const h = await reflowNode(item, vp, itemW, log, true)
      rowHeights.push(h)
    }

    const maxRowH = Math.max(...rowHeights, 1)
    for (const item of rowItems) doResize(item, itemW, maxRowH)

    localY += maxRowH + vp.colGap
  }

  const finalH = localY + vp.padding
  doResize(fr, vp.width, finalH)

  for (const bg of bgNodes) {
    setPos(bg, 0, 0)
    doResize(bg, vp.width, finalH)
  }

  log.push(`"${node.name}" [HORIZONTAL_GROUP]: ${fgKids.length} items → ${cols}-col (repeated=${isRepeated}) (${finalH}px)`)
  return finalH
}

// ============================================================
// TRANSFORMER: SINGLE COLUMN (Universal)
// ============================================================

/**
 * Universal single-column transformer.
 * Handles all non-repeated, non-AL, non-nav, non-table content.
 *
 * ALIGNMENT:
 * Detects the original horizontal alignment intent of the children
 * (LEFT / CENTER / RIGHT / FILL) and preserves it in the mobile layout.
 *
 * DOUBLE-PADDING GUARD:
 * When called as a child (asChild=true via reflowNode), the parentW already
 * represents the usable content width. We use parentW directly as contentW
 * and set baseX=0 to avoid re-applying container padding.
 */
async function transformSingleColumn(
  node: SceneNode,
  vp: RVP,
  log: string[],
  isNestedChild = false  // true when called from reflowNode as a child element
): Promise<number> {
  // contentW = full usable width at this level
  // For a top-level section: containerW - 2*padding
  // For a nested child: the parentW already passed in IS the content width
  const containerW = isNestedChild ? (node.width || vp.width) : vp.width
  const ownPaddingL = isNestedChild ? 0 : vp.padding
  const ownPaddingR = isNestedChild ? 0 : vp.padding
  const contentW = containerW - ownPaddingL - ownPaddingR
  const baseX = ownPaddingL

  if (!('children' in node)) {
    if (node.type === 'TEXT') {
      const h = await reflowTextNode(node as TextNode, contentW, vp, log)
      return h + (isNestedChild ? 0 : vp.padding * 2)
    }
    return node.height
  }

  const fr = node as FrameNode
  if ('layoutMode' in fr && fr.layoutMode !== 'NONE') fr.layoutMode = 'NONE'

  const allKids = visibleChildren(node)
  const bgNodes = allKids.filter(k => isBackgroundNode(k, fr.width, fr.height))
  const fgKids = allKids.filter(k => !isBackgroundNode(k, fr.width, fr.height))

  // Sort by original Y (then X for same-level items)
  fgKids.sort((a, b) => {
    const dy = nY(a) - nY(b)
    if (Math.abs(dy) > 10) return dy
    return nX(a) - nX(b)
  })

  // Detect original alignment of children relative to the DESKTOP container
  // so we can preserve it in the mobile layout
  const alignment = detectAlignmentIntent(fgKids, fr.width)

  // Log alignment for debugging
  console.log('[Mobile Alignment]', {
    containerWidth: containerW,
    contentWidth: contentW,
    horizontalPadding: ownPaddingL + ownPaddingR,
    alignment,
    childCount: fgKids.length,
  })

  let localY = isNestedChild ? 0 : vp.padding

  for (const kid of fgKids) {
    const kidAlign = getChildAlignment(kid, fr.width, alignment)

    if (kid.type === 'TEXT') {
      const textNode = kid as TextNode
      const textW = contentW
      const h = await reflowTextNode(textNode, textW, vp, log)

      if (kidAlign === 'CENTER') {
        try {
          if (typeof textNode.fontName !== 'symbol') {
            await loadFontSafe(textNode.fontName as FontName)
          }
          textNode.textAlignHorizontal = 'CENTER'
        } catch (_) {}
      } else if (kidAlign === 'RIGHT') {
        try {
          if (typeof textNode.fontName !== 'symbol') {
            await loadFontSafe(textNode.fontName as FontName)
          }
          textNode.textAlignHorizontal = 'RIGHT'
        } catch (_) {}
      } else {
        try {
          if (typeof textNode.fontName !== 'symbol') {
            await loadFontSafe(textNode.fontName as FontName)
          }
          textNode.textAlignHorizontal = 'LEFT'
        } catch (_) {}
      }

      setPos(textNode, baseX, localY)
      localY += h + SPACING.NORMAL

    } else if (isButtonLike(kid)) {
      const btnW = Math.min(kid.width, contentW)
      const btnH = Math.min(Math.max(kid.height, 40), 52)
      doResize(kid, btnW, btnH)

      if ('children' in kid) {
        for (const bc of visibleChildren(kid)) {
          if (bc.type === 'TEXT') {
            const txt = bc as TextNode
            try {
              if (typeof txt.fontName !== 'symbol') {
                await loadFontSafe(txt.fontName as FontName)
              }
              txt.textAlignHorizontal = 'CENTER'
            } catch (_) {}
            await reflowTextNode(txt, btnW, vp)
            const txtY = Math.round((btnH - txt.height) / 2)
            setPos(txt, 0, Math.max(0, txtY))
          }
        }
      }

      const x = alignedX(btnW, contentW, baseX, kidAlign)
      setPos(kid, x, localY)
      localY += btnH + SPACING.NORMAL

    } else if (isImageNode(kid)) {
      const origW = kid.width, origH = kid.height
      const aspect = origH / Math.max(1, origW)
      const isFullWidthImg = origW >= fr.width * 0.75
      const imgW = isFullWidthImg ? contentW : Math.min(origW, contentW)
      const maxH = Math.round(vp.width * 0.80)
      const imgH = Math.min(Math.round(imgW * aspect), maxH)

      doResize(kid, imgW, imgH)
      const x = alignedX(imgW, contentW, baseX, kidAlign)
      setPos(kid, x, localY)
      localY += imgH + SPACING.NORMAL

    } else if (isIconNode(kid)) {
      const x = alignedX(kid.width, contentW, baseX, kidAlign)
      setPos(kid, x, localY)
      localY += kid.height + SPACING.SMALL

    } else if ('children' in kid) {
      const isCompactGroup = kid.width < contentW * 0.70 && kid.height <= 80
      if (isCompactGroup) {
        const groupW = Math.min(kid.width, contentW)
        doResize(kid, groupW, kid.height)
        const h = await reflowNode(kid, vp, groupW, log, true)
        const x = alignedX(groupW, contentW, baseX, kidAlign)
        setPos(kid, x, localY)
        localY += h + SPACING.NORMAL
      } else {
        doResize(kid, contentW, kid.height)
        const h = await reflowNode(kid, vp, contentW, log, true)
        setPos(kid, baseX, localY)
        localY += h + SPACING.NORMAL
      }

    } else {
      const isDivider = kid.height <= 2 && kid.width >= fr.width * 0.70
      const w = isDivider ? contentW : Math.min(kid.width, contentW)
      doResize(kid, w, kid.height)
      const x = alignedX(w, contentW, baseX, kidAlign)
      setPos(kid, x, localY)
      localY += kid.height + SPACING.NORMAL
    }
  }

  const finalH = localY + (isNestedChild ? 0 : vp.padding)
  doResize(fr, isNestedChild ? contentW : vp.width, finalH)

  for (const bg of bgNodes) {
    setPos(bg, 0, 0)
    doResize(bg, isNestedChild ? contentW : vp.width, finalH)
  }

  log.push(`"${node.name}" [SINGLE_COLUMN|${alignment}]: ${fgKids.length} items stacked (${finalH}px, nested=${isNestedChild})`)
  return finalH
}

// ============================================================
// CORE RECURSIVE REFLOW DISPATCHER
// ============================================================

/**
 * Determines the strategy for a node and applies the appropriate transformer.
 * Called recursively — each container gets its own strategy determination.
 *
 * @param node         The node to reflow
 * @param vp           Target viewport
 * @param parentW      Available width from parent
 * @param log          Change log
 * @param asChild      If true, node is being reflowed as a child (don't set X to padding)
 */
async function reflowNode(
  node: SceneNode,
  vp: RVP,
  parentW: number,
  log: string[],
  asChild = false
): Promise<number> {
  // Leaf nodes
  if (node.type === 'TEXT') {
    return reflowTextNode(node as TextNode, parentW, vp, log)
  }

  if (!('children' in node)) {
    // Non-container, non-text: just resize to fit
    const w = Math.min(node.width, parentW)
    doResize(node, w, node.height)
    return node.height
  }

  const alMode = detectAutoLayout(node)
  // asChild / nested containers must NEVER be classified as top-level NAVIGATION
  const strategy = determineStrategy(node, vp, vp.height, false, true)

  // Debug logging — per-container strategy decision (includes repeated/navigation flags)
  const fgKidsForLog = ('children' in node)
    ? visibleChildren(node).filter(k => !isBackgroundNode(k, node.width, node.height))
    : []
  console.log('[Responsive Strategy]', {
    node: node.name,
    nodeType: node.type,
    autoLayout: alMode,
    children: ('children' in node ? (node as any).children.length : 0),
    repeatedCollection: fgKidsForLog.length > 0 ? detectRepeatedCollection(fgKidsForLog) : false,
    navigation: false,
    strategy,
    columns: strategy === 'REPEATED_COLLECTION' || strategy === 'HORIZONTAL_GROUP'
      ? detectRepeatedCollection(fgKidsForLog) ? detectCollectionColumns(fgKidsForLog, vp) : 1
      : null,
  })

  switch (strategy) {
    case 'AUTO_LAYOUT_VERTICAL':
      return transformAutoLayoutVertical(node as FrameNode, parentW, vp, log)

    case 'AUTO_LAYOUT_HORIZONTAL':
      return transformAutoLayoutHorizontal(node as FrameNode, parentW, vp, log)

    case 'NAVIGATION': {
      const navRes = await transformNavigationNode(node, vp, log)
      return navRes.height
    }

    case 'TABLE':
      return transformTableNode(node, vp, log)

    case 'REPEATED_COLLECTION':
      return transformRepeatedCollection(node, vp, log)

    case 'HORIZONTAL_GROUP':
      return transformHorizontalGroup(node, vp, log)

    case 'SINGLE_COLUMN':
    default:
      // Pass asChild=true when called recursively so double-padding is avoided
      return transformSingleColumn(node, vp, log, asChild)
  }
}

// ============================================================
// OVERLAP & SPACE ALIGNMENT CORRECTION
// ============================================================

function verifyAndCorrectSectionOverlaps(
  sections: SceneNode[],
  log: string[]
): void {
  if (sections.length === 0) return

  // Section 0 must start flush at top (y = 0) and left (x = 0)
  if (isValidFigmaNode(sections[0])) {
    setPos(sections[0], 0, 0)
  }

  let adjustedCount = 0

  for (let i = 1; i < sections.length; i++) {
    const prev = sections[i - 1]
    const cur = sections[i]
    if (!isValidFigmaNode(prev) || !isValidFigmaNode(cur)) continue

    const prevBottom = nY(prev) + prev.height
    const expectedY = prevBottom + SPACING.SECTION
    const curY = nY(cur)

    if (curY !== expectedY || nX(cur) !== 0) {
      setPos(cur, 0, expectedY)
      adjustedCount++
      log.push(`[SPACE] "${cur.name}" positioned at Y=${expectedY}px (gap=${SPACING.SECTION}px)`)
    }
  }

  if (adjustedCount === 0) {
    log.push(`Spacing audit: all sections cleanly aligned with ${SPACING.SECTION}px gap`)
  }
}

// ============================================================
// OFF-FRAME SAFETY AUDIT
// ============================================================

function auditAndFixOffFrameContent(clone: FrameNode, log: string[]): void {
  let fixCount = 0

  function inspectFrame(frame: FrameNode): void {
    if (!('children' in frame) || frame.children.length === 0) return

    const fgKids = frame.children.filter(
      c => c.visible !== false && !isBackgroundNode(c, frame.width, frame.height)
    )
    if (fgKids.length === 0) return

    const minY = Math.min(...fgKids.map(c => nY(c)))
    if (minY < 0) {
      const shiftY = Math.abs(minY) + 8
      for (const c of fgKids) setPos(c, nX(c), nY(c) + shiftY)
      fixCount++
    }

    const maxChildBottom = Math.max(...fgKids.map(c => nY(c) + c.height))
    if (maxChildBottom > frame.height) {
      const newH = maxChildBottom + 16
      doResize(frame, frame.width, newH)
      for (const c of frame.children) {
        if (isBackgroundNode(c, frame.width, newH)) {
          setPos(c, 0, 0)
          doResize(c, frame.width, newH)
        }
      }
      fixCount++
    }

    for (const c of frame.children) {
      if ('children' in c && (c.type === 'FRAME' || c.type === 'GROUP')) {
        inspectFrame(c as FrameNode)
      }
    }
  }

  inspectFrame(clone)
  if (fixCount > 0) log.push(`Off-frame audit: ${fixCount} containers adjusted`)
}

// ============================================================
// FINAL LAYOUT CLAMP & VALIDATION
// ============================================================

function validateAndClampLayout(clone: FrameNode, vp: RVP, log: string[]): void {
  let clampCount = 0

  function checkNode(node: SceneNode, maxW: number): void {
    const x = nX(node)
    const w = node.width

    if (x < 0) {
      setPos(node, 0, nY(node))
      clampCount++
    }
    if (x + w > maxW + 4) {
      const allowedW = Math.max(10, maxW - Math.max(0, x))
      doResize(node, allowedW, node.height)
      clampCount++
    }

    if ('children' in node) {
      for (const c of (node as ChildrenMixin).children) {
        if (c.visible !== false) checkNode(c, node.width)
      }
    }
  }

  for (const c of clone.children) {
    if (c.visible !== false) checkNode(c, vp.width)
  }

  if (clampCount > 0) {
    log.push(`Validation: ${clampCount} elements clamped to mobile viewport`)
  }
}

// ============================================================
// MAIN ENTRY POINT
// ============================================================

export async function applyResponsiveEngine(
  clone: FrameNode,
  viewportId: string,
  log: string[]
): Promise<void> {
  const vp = VIEWPORTS[viewportId]
  if (!vp) {
    log.push(`Unknown viewport preset: ${viewportId}`)
    return
  }

  const origW = clone.width
  const origH = clone.height

  log.push(`Target Viewport: ${vp.name} (${vp.width}×${vp.height}px)`)
  log.push(`Engine: Generic Structure-Aware Responsive Engine V9`)

  // ---- STAGE 1: Normalize root frame ----
  // If the root frame uses Auto Layout, snapshot child positions and remove it.
  // The root frame itself must be free-positioned so we can do sequential section flow.
  if ('layoutMode' in clone && clone.layoutMode !== 'NONE') {
    const snapshot = clone.children.map(c => ({
      node: c,
      x: nX(c),
      y: nY(c),
      w: c.width,
      h: c.height,
    }))
    clone.layoutMode = 'NONE'
    for (const item of snapshot) {
      setPos(item.node, item.x, item.y)
      doResize(item.node, item.w, item.h)
    }
    log.push(`Root frame Auto Layout normalized to free positioning`)
  }

  // Set root width to target mobile width
  clone.resize(vp.width, origH)
  clone.clipsContent = false

  // ---- STAGE 2: Get top-level visible sections ----
  const topLevelKids = clone.children
    .filter(c => c.visible !== false)
    .sort((a, b) => nY(a) - nY(b))

  if (topLevelKids.length === 0) {
    log.push(`No visible top-level children. Nothing to reflow.`)
    return
  }

  log.push(`Top-level sections: ${topLevelKids.length}`)

  // ---- STAGE 3: Detect sidebar layout at the page level ----
  // A sidebar layout means one child is a narrow vertical strip beside the main content.
  // In this case the entire page is treated as a sidebar-layout frame.
  const sidebarResult = detectSidebarLayout(topLevelKids, origW, origH)

  if (sidebarResult.hasSidebar && sidebarResult.sidebarNode) {
    log.push(`Sidebar detected: "${sidebarResult.sidebarNode.name}" + ${sidebarResult.mainContentNodes.length} main sections`)
    await transformSidebarLayout(
      clone,
      sidebarResult.sidebarNode,
      sidebarResult.mainContentNodes,
      vp,
      log
    )
  } else {
    // ---- STAGE 4: Sequential page flow — per-section strategy ----
    let currentY = 0
    let hasNavTransformed = false

    for (let i = 0; i < topLevelKids.length; i++) {
      let section = topLevelKids[i]
      if (!isValidFigmaNode(section)) continue

      // If navigation has ALREADY been transformed into a mobile list button,
      // any subsequent section that is a navigation/menu/links bar or loose nav links
      // MUST NOT be reflowed as content on the mobile page!
      // The single list button was added in place of them.
      if (hasNavTransformed && isNavLinksSection(section, origH, nY(section))) {
        log.push(`"${section.name}": navigation items consumed into mobile list button (removed from page)`)
        section.locked = false
        try {
          section.remove()
        } catch (_) {
          section.visible = false
        }
        continue
      }

      // Position section at current Y
      setPos(section, 0, currentY)

      // Determine and apply strategy (only top-level sections can be NAVIGATION, and at most once)
      const strategy = determineStrategy(section, vp, origH, true, hasNavTransformed)

      console.log('[Responsive][TOP-LEVEL]', {
        name: section.name,
        type: section.type,
        autoLayout: detectAutoLayout(section),
        strategy,
        childCount: 'children' in section ? (section as any).children.length : 0,
      })

      let sectionH: number
      let activeSection: SceneNode = section

      switch (strategy) {
        case 'AUTO_LAYOUT_VERTICAL':
          sectionH = await transformAutoLayoutVertical(section as FrameNode, vp.width, vp, log)
          break
        case 'AUTO_LAYOUT_HORIZONTAL':
          sectionH = await transformAutoLayoutHorizontal(section as FrameNode, vp.width, vp, log)
          break
        case 'NAVIGATION': {
          // Look ahead to check if immediate subsequent sections are secondary nav/links
          const extraNavItems: SceneNode[] = []
          for (let j = i + 1; j < topLevelKids.length; j++) {
            const nextSec = topLevelKids[j]
            if (!isValidFigmaNode(nextSec)) continue
            if (isNavLinksSection(nextSec, origH, nY(nextSec))) {
              extraNavItems.push(...extractSecondaryNavItems(nextSec))
            } else {
              break
            }
          }

          const navRes = await transformNavigationNode(section, vp, log, extraNavItems)
          sectionH = navRes.height
          activeSection = navRes.activeNode
          topLevelKids[i] = activeSection
          hasNavTransformed = true
          break
        }
        case 'TABLE':
          sectionH = await transformTableNode(section, vp, log)
          break
        case 'REPEATED_COLLECTION':
          sectionH = await transformRepeatedCollection(section, vp, log)
          break
        case 'HORIZONTAL_GROUP':
          sectionH = await transformHorizontalGroup(section, vp, log)
          break
        case 'SINGLE_COLUMN':
        default:
          sectionH = await transformSingleColumn(section, vp, log)
          break
      }

      // Safety: ensure section height wraps its children
      if (isValidFigmaNode(activeSection) && 'children' in activeSection) {
        const fr = activeSection as FrameNode
        const fgKids = fr.children.filter(
          c => c.visible !== false && !isBackgroundNode(c, fr.width, fr.height)
        )
        if (fgKids.length > 0) {
          const maxChildBottom = Math.max(...fgKids.map(c => nY(c) + c.height))
          if (fr.height < maxChildBottom + 8) {
            sectionH = maxChildBottom + 16
            doResize(fr, vp.width, sectionH)
            for (const bg of fr.children) {
              if (isBackgroundNode(bg, fr.width, fr.height)) {
                setPos(bg, 0, 0)
                doResize(bg, vp.width, sectionH)
              }
            }
          }
        }
      }

      const finalH = isValidFigmaNode(activeSection) ? activeSection.height : sectionH
      currentY = (isValidFigmaNode(activeSection) ? nY(activeSection) : currentY) + finalH + SPACING.SECTION
    }

    // ---- STAGE 5: Off-frame safety audit (run BEFORE spacing alignment so expansions are accommodated) ----
    auditAndFixOffFrameContent(clone, log)

    // ---- STAGE 6: Overlap & Spacing Alignment ----
    // Snap section 0 to (0, 0) and stack all subsequent sections with exact SPACING.SECTION
    const liveTopLevelKids = topLevelKids.filter(k => isValidFigmaNode(k) && k.visible !== false)
    verifyAndCorrectSectionOverlaps(liveTopLevelKids, log)
  }

  // ---- STAGE 7: Content-driven final frame height ----
  const allTop = clone.children
    .filter(c => c.visible !== false)
    .sort((a, b) => nY(a) - nY(b))

  const lastSection = allTop[allTop.length - 1]
  const finalPageHeight = lastSection
    ? nY(lastSection) + lastSection.height
    : origH

  clone.resize(vp.width, finalPageHeight)
  clone.clipsContent = true

  log.push(`Canvas: ${origW}×${origH}px → ${vp.width}×${finalPageHeight}px`)

  // ---- STAGE 8: Final clamp & validation ----
  validateAndClampLayout(clone, vp, log)
}
