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

export * from './rlm/index'

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
  laptop: { width: 1024, height: 768, name: 'Laptop', padding: 32, colGap: 20, rowGap: 40, navH: 64, defaultCardCols: 3 },
  tablet: { width: 768, height: 1024, name: 'Tablet', padding: 24, colGap: 16, rowGap: 34, navH: 60, defaultCardCols: 2 },
  mobile: { width: 390, height: 844, name: 'Mobile', padding: 20, colGap: 12, rowGap: 28, navH: 56, defaultCardCols: 1 },
  'small-mobile': { width: 320, height: 568, name: 'Small Mobile', padding: 16, colGap: 10, rowGap: 24, navH: 52, defaultCardCols: 1 },
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

/**
 * Checks if a Figma node is currently valid, alive, and not destroyed/removed.
 * Safely guards against Figma's "The node (instance sublayer or table cell) does not exist" error.
 */
export function isValidFigmaNode(node: BaseNode | null | undefined): boolean {
  if (!node) return false
  try {
    if ('removed' in node && (node as any).removed) return false
    if (!node.id) return false
    // If the node handle was invalidated (e.g. destroyed instance sublayer or table cell),
    // accessing any getter like .type will throw:
    // "The node (instance sublayer or table cell) with id ... does not exist"
    const t = (node as any).type
    if (!t) return false
    if (typeof figma !== 'undefined' && typeof figma.getNodeById === 'function' && !node.id.includes(';')) {
      return !!figma.getNodeById(node.id)
    }
    return true
  } catch (_) {
    return false
  }
}

/**
 * Checks if a node is valid, alive, and visible.
 * Safely handles proxy nodes and instance sublayers.
 */
export function isNodeValidAndVisible(node: BaseNode | null | undefined): boolean {
  if (!isValidFigmaNode(node)) return false
  try {
    if ('visible' in (node as any) && (node as any).visible === false) return false
    return true
  } catch (_) {
    return false
  }
}

/**
 * Safely extracts visible children from a node, ignoring destroyed/stale proxy nodes and invisible items.
 */
export function safeChildren(node: SceneNode | BaseNode | null | undefined): SceneNode[] {
  if (!isValidFigmaNode(node)) return []
  if (!('children' in (node as any))) return []
  try {
    const raw = (node as ChildrenMixin).children
    if (!raw || !Array.isArray(raw)) return []
    const result: SceneNode[] = []
    for (let i = 0; i < raw.length; i++) {
      const kid = raw[i]
      if (isNodeValidAndVisible(kid)) {
        result.push(kid as SceneNode)
      }
    }
    return result
  } catch (_) {
    return []
  }
}

/**
 * Safely extracts all alive children from a node (including hidden ones), ignoring destroyed/stale proxy nodes.
 */
export function safeAllChildren(node: SceneNode | BaseNode | null | undefined): SceneNode[] {
  if (!isValidFigmaNode(node)) return []
  if (!('children' in (node as any))) return []
  try {
    const raw = (node as ChildrenMixin).children
    if (!raw || !Array.isArray(raw)) return []
    const result: SceneNode[] = []
    for (let i = 0; i < raw.length; i++) {
      const kid = raw[i]
      if (isValidFigmaNode(kid)) {
        result.push(kid as SceneNode)
      }
    }
    return result
  } catch (_) {
    return []
  }
}

function nX(n: SceneNode): number {
  if (!isValidFigmaNode(n)) return 0
  try {
    return 'x' in n ? ((n as any).x as number) : 0
  } catch (_) {
    return 0
  }
}
function nY(n: SceneNode): number {
  if (!isValidFigmaNode(n)) return 0
  try {
    return 'y' in n ? ((n as any).y as number) : 0
  } catch (_) {
    return 0
  }
}

function setPos(n: SceneNode, x: number, y: number): void {
  if (!isValidFigmaNode(n)) return
  try {
    if ('x' in n) (n as any).x = Math.round(x)
  } catch (_) {
    try {
      // If setting x fails because node or ancestor is in an instance, attempt detachment
      let p: any = n
      while (p && p.type !== 'PAGE' && p.type !== 'DOCUMENT') {
        if (p.type === 'INSTANCE' && 'detachInstance' in p && typeof p.detachInstance === 'function') {
          p.detachInstance()
          break
        }
        p = p.parent
      }
      if ('x' in n) (n as any).x = Math.round(x)
    } catch (_) { }
  }

  try {
    if ('y' in n) (n as any).y = Math.round(y)
  } catch (_) {
    try {
      let p: any = n
      while (p && p.type !== 'PAGE' && p.type !== 'DOCUMENT') {
        if (p.type === 'INSTANCE' && 'detachInstance' in p && typeof p.detachInstance === 'function') {
          p.detachInstance()
          break
        }
        p = p.parent
      }
      if ('y' in n) (n as any).y = Math.round(y)
    } catch (_) { }
  }
}

function doResize(n: SceneNode, w: number, h: number): void {
  if (!isValidFigmaNode(n)) return
  if (n.type === 'TEXT') {
    // Calling resize directly on a TextNode destroys textAutoResize = 'WIDTH_AND_HEIGHT' in Figma.
    // TextNode dimensions must only be managed via reflowTextNode.
    return
  }
  if ('resize' in n && typeof (n as any).resize === 'function') {
    try {
      (n as any).resize(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)))
    } catch (_) {
      try {
        let p: any = n
        while (p && p.type !== 'PAGE' && p.type !== 'DOCUMENT') {
          if (p.type === 'INSTANCE' && 'detachInstance' in p && typeof p.detachInstance === 'function') {
            p.detachInstance()
            break
          }
          p = p.parent
        }
        (n as any).resize(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)))
      } catch (_) { }
    }
  }
}

/**
 * Recursively detaches all component instances in a node tree.
 * Converts InstanceNodes into regular mutable FrameNodes so that
 * children's positions, sizes, Auto Layout modes, and hierarchies
 * can be freely transformed without Figma "property cannot be overridden in an instance" errors.
 */
export function detachInstancesRecursively(node: SceneNode): SceneNode {
  if (!isValidFigmaNode(node)) return node

  let current = node
  if (current.type === 'INSTANCE' && 'detachInstance' in current && typeof (current as any).detachInstance === 'function') {
    try {
      current = (current as any).detachInstance()
    } catch (_) { }
  }

  try {
    if ('children' in current) {
      const kids = safeAllChildren(current)
      for (const kid of kids) {
        detachInstancesRecursively(kid)
      }
    }
  } catch (_) { }

  return current
}

/**
 * Safely collect all descendant SceneNodes up to maxDepth.
 */
export function getAllDescendants(node: SceneNode, maxDepth = 4): SceneNode[] {
  const result: SceneNode[] = []
  function recurse(curr: SceneNode, depth: number) {
    if (depth > maxDepth || !isValidFigmaNode(curr)) return
    result.push(curr)
    if ('children' in curr) {
      for (const c of safeChildren(curr)) {
        recurse(c, depth + 1)
      }
    }
  }
  if ('children' in node) {
    for (const c of safeChildren(node)) {
      recurse(c, 1)
    }
  }
  return result
}

/**
 * Checks if a frame/group is a visual media composite (e.g. product mockup, device frame,
 * 3D graphic, or illustration) that should be scaled proportionally rather than reflowed as text columns.
 */
export function isVisualMediaComposite(node: SceneNode): boolean {
  if (!isValidFigmaNode(node)) return false
  if (!('children' in node)) return false
  const name = (node.name || '').toLowerCase()
  if (/(mockup|illustration|graphic|hero-img|product-shot|display|device|phone|laptop|art|visual|showcase|3d)/i.test(name)) {
    return true
  }
  // Check children: if it has 0 body text nodes, and contains images, vectors, or shape groups
  const descendants = getAllDescendants(node, 3)
  const textNodes = descendants.filter(d => d.type === 'TEXT') as TextNode[]
  const hasLongText = textNodes.some(t => ((t.characters || '').length > 30))
  if (hasLongText) return false

  const hasMedia = descendants.some(d => isImageNode(d) || d.type === 'VECTOR' || d.type === 'ELLIPSE' || d.type === 'POLYGON')
  if (hasMedia && node.height >= 120 && node.width >= 120 && node.height < 900) {
    return true
  }
  return false
}

/**
 * Scales a visual media composite proportionally so its relative illustration/mockup
 * parts remain in perfect relative geometry.
 */
export function scaleVisualMediaComposite(node: SceneNode, targetW: number, vp: RVP): number {
  const origW = Math.max(1, node.width)
  const origH = Math.max(1, node.height)
  const scale = Math.min(targetW / origW, 1)
  const newW = Math.round(origW * scale)
  const newH = Math.round(origH * scale)

  function scaleChildren(parent: SceneNode, s: number) {
    if (!('children' in parent)) return
    for (const c of safeChildren(parent)) {
      const cx = Math.round(nX(c) * s)
      const cy = Math.round(nY(c) * s)
      const cw = Math.max(1, Math.round(c.width * s))
      const ch = Math.max(1, Math.round(c.height * s))
      setPos(c, cx, cy)
      doResize(c, cw, ch)
      if (c.type === 'TEXT') {
        const txt = c as TextNode
        try {
          if (typeof txt.fontSize === 'number') {
            txt.fontSize = Math.max(9, Math.round(txt.fontSize * s))
          }
        } catch (_) { }
      }
      scaleChildren(c, s)
    }
  }

  doResize(node, newW, newH)
  preserveCardCornerRadius(node, newW, newH)
  scaleChildren(node, scale)
  return newH
}

export function isImageNode(n: SceneNode): boolean {
  if (!isValidFigmaNode(n)) return false
  try {
    if ('fills' in n && Array.isArray((n as any).fills)) {
      return (n as any).fills.some((f: any) => f && f.type === 'IMAGE' && f.visible !== false)
    }
    return false
  } catch (_) {
    return false
  }
}

/** A node that acts as a full-bleed background (covers most of its container). */
function isBackgroundNode(n: SceneNode, containerW: number, containerH: number): boolean {
  if (!isValidFigmaNode(n)) return false
  try {
    const name = (n.name || '').toLowerCase()
    if (/(^bg$|^background$|backdrop|canvas-bg)/i.test(name) && n.width >= containerW * 0.45) {
      return true
    }

    // A node with text content or 2+ interactive/layout children is NEVER a background node!
    if (hasTextContent(n)) return false
    if ('children' in n && safeChildren(n).length >= 2) return false

    if (n.type === 'RECTANGLE' || n.type === 'VECTOR') {
      if (nX(n) <= 16 && nY(n) <= 16 && n.width >= containerW * 0.85 && n.height >= containerH * 0.85) return true
    } else if (n.type === 'FRAME') {
      if (nX(n) <= 16 && nY(n) <= 16 && n.width >= containerW * 0.90 && n.height >= containerH * 0.90) return true
    }
    return false
  } catch (_) {
    return false
  }
}

/**
 * Checks if a node is an absolute decorative element that should not drive vertical flow.
 * (e.g. floating background shapes, vector blurs, sparkles, or explicit ABSOLUTE positioned nodes).
 */
function isDecorativeNode(n: SceneNode): boolean {
  if (!isValidFigmaNode(n)) return false
  try {
    if ('layoutPositioning' in n && (n as any).layoutPositioning === 'ABSOLUTE') {
      return true
    }
    const name = (n.name || '').toLowerCase()
    if (/(decor|accent|blob|glow|blur|sparkle|float|particle|ambient)/i.test(name)) {
      return true
    }
    if ((n.type === 'VECTOR' || n.type === 'ELLIPSE' || n.type === 'POLYGON' || n.type === 'STAR') &&
      n.width <= 64 && n.height <= 64 && !('children' in n)) {
      return true
    }
    return false
  } catch (_) {
    return false
  }
}

interface CornerRadii {
  tl: number
  tr: number
  bl: number
  br: number
}

function extractNodeCornerRadii(n: any): CornerRadii | null {
  if (!n) return null
  if ('topLeftRadius' in n && typeof n.topLeftRadius === 'number') {
    const tl = n.topLeftRadius || 0
    const tr = n.topRightRadius || 0
    const bl = n.bottomLeftRadius || 0
    const br = n.bottomRightRadius || 0
    if (tl > 0 || tr > 0 || bl > 0 || br > 0) {
      return { tl, tr, bl, br }
    }
  }
  if ('cornerRadius' in n && typeof n.cornerRadius === 'number' && n.cornerRadius > 0) {
    const r = n.cornerRadius
    return { tl: r, tr: r, bl: r, br: r }
  }
  return null
}

/**
 * Detects whether a node is a small badge, chip, tag, or pill (e.g. "[PROPOSED]", category pills).
 */
export function isBadgeOrPillTag(n: SceneNode): boolean {
  if (!isValidFigmaNode(n)) return false
  const name = (n.name || '').toLowerCase()
  if (/(badge|tag|pill|chip|category-pill|label|sticker|tag-item)/i.test(name)) return true
  if (n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE') {
    if (n.height >= 16 && n.height <= 44 && n.width <= 260) {
      if ('children' in n) {
        const kids = safeChildren(n)
        if (kids.length >= 1 && kids.length <= 4 && kids.some(k => k.type === 'TEXT')) {
          return true
        }
      }
    }
  }
  return false
}

/**
 * Clamps corner radii so small pills stay cleanly rounded,
 * while large container cards and sections never get deformed into giant stadium pills.
 */
function applyClampedCornerRadii(node: any, radii: CornerRadii, w: number, h: number): void {
  const minDim = Math.min(w, h)
  // Only true small pills/badges (min dimension <= 56) may have stadium half-height pill radius
  const isPill = minDim <= 56 && (radii.tl >= minDim * 0.38 || radii.tl >= 999)
  // For cards, containers, and sections: cap corner radius to max 24px (never giant stadium capsule!)
  const maxAllowedRadius = isPill ? Math.round(minDim / 2) : Math.min(24, Math.round(minDim * 0.15))

  const clamp = (r: number) => {
    if (r <= 0) return 0
    if (isPill) return Math.round(minDim / 2)
    return Math.min(r, maxAllowedRadius)
  }

  const tl = clamp(radii.tl)
  const tr = clamp(radii.tr)
  const bl = clamp(radii.bl)
  const br = clamp(radii.br)

  try {
    if ('topLeftRadius' in node) {
      node.topLeftRadius = tl
      node.topRightRadius = tr
      node.bottomLeftRadius = bl
      node.bottomRightRadius = br
    } else if ('cornerRadius' in node) {
      node.cornerRadius = tl
    }
  } catch (_) { }
}

/**
 * Preserves corner radius and card clipping on any card-like container.
 * Supports both uniform cornerRadius and individual corner radii (topLeftRadius, etc.).
 * 1. Ensures the card frame itself retains its OWN corner radius (clamped to max 24px).
 * 2. Never pulls pill button radius from children into the parent container.
 * 3. Ensures any background rectangle inside the card has matching dimensions and corner radius.
 */
function preserveCardCornerRadius(card: SceneNode, targetW: number, targetH: number): void {
  if (!isValidFigmaNode(card)) return

  // If card is a leaf (e.g. single RectangleNode or Component instance without children)
  if (!('children' in card)) {
    const leafRadii = extractNodeCornerRadii(card)
    if (leafRadii) {
      applyClampedCornerRadii(card, leafRadii, targetW, targetH)
    }
    return
  }

  const fr = card as FrameNode
  let bestRadii: CornerRadii | null = extractNodeCornerRadii(fr)

  // If card container itself has no corner radius, check ONLY direct full-bleed background shape
  // NEVER search arbitrary child buttons, tags, or pills, which would bleed pill radius to parent container!
  if (!bestRadii) {
    const directKids = safeChildren(fr)
    for (const c of directKids) {
      if (isBackgroundNode(c, fr.width, fr.height) && !isButtonLike(c) && !isImageNode(c) && !isBadgeOrPillTag(c)) {
        const cRadii = extractNodeCornerRadii(c)
        if (cRadii) {
          bestRadii = cRadii
          break
        }
      }
    }
  }

  if (bestRadii) {
    applyClampedCornerRadii(fr, bestRadii, targetW, targetH)
    try { fr.clipsContent = true } catch (_) { }

    // Synchronize onto background rectangles or card surfaces (never product images, buttons, or badges!)
    for (const c of safeChildren(fr)) {
      if (isImageNode(c) || isButtonLike(c) || isBadgeOrPillTag(c)) continue

      const isCardBg =
        isBackgroundNode(c, fr.width, fr.height) ||
        (c.type === 'RECTANGLE' &&
          nX(c) <= 8 &&
          nY(c) <= 8 &&
          c.width >= targetW * 0.75 &&
          c.height >= targetH * 0.70)
      if (isCardBg) {
        applyClampedCornerRadii(c, bestRadii, targetW, targetH)
        setPos(c, 0, 0)
        doResize(c, targetW, targetH)
      }
    }
  }
}

function hasVisibleFillOrStroke(n: SceneNode): boolean {
  if (!isValidFigmaNode(n)) return false
  try {
    if ('fills' in n && Array.isArray((n as any).fills) && (n as any).fills.length > 0) {
      const hasFill = (n as any).fills.some((f: any) => f && f.visible !== false)
      if (hasFill) return true
    }
    if ('strokes' in n && Array.isArray((n as any).strokes) && (n as any).strokes.length > 0) {
      const hasStroke = (n as any).strokes.some((s: any) => s && s.visible !== false)
      if (hasStroke) return true
    }
    return false
  } catch (_) {
    return false
  }
}

function isButtonLike(n: SceneNode): boolean {
  if (!isValidFigmaNode(n)) return false
  if (isBadgeOrPillTag(n)) return false
  try {
    if ((n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE' || n.type === 'GROUP') &&
      n.height >= 28 && n.height <= 72 && n.width >= 40 && n.width <= 360) {
      if ('children' in n) {
        const kids = safeAllChildren(n)
        const texts = kids.filter(c => c.type === 'TEXT')
        const hasFrame = kids.some(c => c.type !== 'TEXT')
        // If mostly text (≥ 1 text child) with optional background, likely a button
        if (texts.length >= 1 && texts.length <= 3) return true
      }
    }
    const name = (n.name || '').toLowerCase()
    if (name.includes('button') || name.includes('btn') || name.includes('cta')) return true
    return false
  } catch (_) {
    return false
  }
}

function isIconNode(n: SceneNode): boolean {
  if (!isValidFigmaNode(n)) return false
  try {
    return (n.width <= 52 && n.height <= 52) &&
      (n.type === 'VECTOR' || n.type === 'FRAME' || n.type === 'GROUP' || n.type === 'INSTANCE')
  } catch (_) {
    return false
  }
}

function visibleChildren(node: SceneNode): SceneNode[] {
  return safeChildren(node)
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

  // If text nodes explicitly have CENTER text alignment
  const textKids = kids.filter(k => k.type === 'TEXT') as TextNode[]
  const centerTextCount = textKids.filter(t => t.textAlignHorizontal === 'CENTER').length
  if (textKids.length > 0 && centerTextCount >= textKids.length * 0.60) {
    return 'CENTER'
  }

  // Check left edge of children: if children start near the left margin, they are LEFT aligned
  const minX = Math.min(...kids.map(k => nX(k)))
  if (minX <= 28 || minX <= parentW * 0.10) {
    return 'LEFT'
  }

  // Measure each child's visual center relative to parent
  const centerOffsets = kids.map(k => {
    const kCenter = nX(k) + k.width / 2
    return kCenter - parentCenter
  })
  const avgOffset = centerOffsets.reduce((s, v) => s + v, 0) / kids.length
  const tolerance = parentW * 0.15

  if (Math.abs(avgOffset) <= tolerance && minX >= parentW * 0.12) return 'CENTER'
  if (avgOffset > tolerance) return 'RIGHT'
  return 'LEFT'
}

/**
 * Clusters children into column groups when desktop layout has loose multi-column elements.
 * Prevents side-by-side elements (e.g. Hero Text + Image) from having their internal elements
 * jumbled together during sequential Y-sorting.
 */
function clusterKidsIntoColumns(kids: SceneNode[], containerW: number): SceneNode[] {
  if (kids.length < 3) return kids

  const xs = kids.map(k => nX(k))
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)

  // If all items are clustered within 35% width, they are a single column
  if (maxX - minX < containerW * 0.35) {
    return kids
  }

  // Find natural column groupings along X
  interface ColCluster {
    minX: number
    maxX: number
    centerX: number
    nodes: SceneNode[]
  }
  const sortedByX = [...kids].sort((a, b) => nX(a) - nX(b))
  const colClusters: ColCluster[] = []

  for (const k of sortedByX) {
    const kCenterX = nX(k) + k.width / 2
    let matchedCol: ColCluster | null = null
    for (const c of colClusters) {
      if (Math.abs(kCenterX - c.centerX) <= containerW * 0.18 || (nX(k) >= c.minX && nX(k) <= c.maxX + 30)) {
        matchedCol = c
        break
      }
    }
    if (matchedCol) {
      matchedCol.nodes.push(k)
      matchedCol.minX = Math.min(matchedCol.minX, nX(k))
      matchedCol.maxX = Math.max(matchedCol.maxX, nX(k) + k.width)
      matchedCol.centerX = (matchedCol.minX + matchedCol.maxX) / 2
    } else {
      colClusters.push({
        minX: nX(k),
        maxX: nX(k) + k.width,
        centerX: kCenterX,
        nodes: [k],
      })
    }
  }

  // If 2 or more distinct columns were found, sort within each column top-to-bottom
  if (colClusters.length >= 2 && colClusters.every(c => c.nodes.length >= 1)) {
    colClusters.sort((a, b) => a.minX - b.minX)
    const result: SceneNode[] = []
    for (const col of colClusters) {
      col.nodes.sort((a, b) => nY(a) - nY(b))
      result.push(...col.nodes)
    }
    return result
  }

  return kids
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
    case 'RIGHT': return Math.round(baseX + contentW - childW)
    case 'FILL': return baseX
    case 'LEFT':
    default: return baseX
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
  if (kid.type === 'TEXT') {
    const txt = kid as TextNode
    if (txt.textAlignHorizontal === 'CENTER') return 'CENTER'
  }

  // If child visual center was within 18% of parent center on desktop
  const parentCenter = parentW / 2
  const childCenter = nX(kid) + kid.width / 2
  if (Math.abs(childCenter - parentCenter) <= parentW * 0.18) {
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
    } else {
      try {
        const rangeFont = node.getRangeFontName(0, 1) as FontName
        if (rangeFont) await loadFontSafe(rangeFont)
      } catch (_) { }
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
          try { node.lineHeight = { unit: 'AUTO' } } catch (_) { }
        }
      }
    }

    const chars = (node.characters || '').trim()
    const hasExplicitNewlines = chars.includes('\n')
    const maxAllowedW = Math.max(60, targetWidth)

    // First, allow the text to measure its natural single-line width
    node.textAutoResize = 'WIDTH_AND_HEIGHT'
    const naturalW = node.width

    // Check if text is micro-copy that should hug width (buttons, tags, badges, pills, prices, sku, links):
    const isMicroCopy = (chars.length <= 28 && !hasExplicitNewlines) ||
      (typeof node.fontSize === 'number' && node.fontSize <= 16 && chars.length <= 40 && !hasExplicitNewlines)
    const fitsTarget = naturalW <= maxAllowedW && !hasExplicitNewlines

    if (fitsTarget || isMicroCopy) {
      node.textAutoResize = 'WIDTH_AND_HEIGHT'
      return node.height
    }

    // Otherwise, multi-line headlines, paragraphs, and descriptions wrap cleanly with Auto Height
    node.textAutoResize = 'NONE'
    try {
      (node as any).resize(maxAllowedW, Math.max(16, node.height))
    } catch (_) { }
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

  // Similar child count — or both are image tiles in a gallery
  if (isImageNode(a) && isImageNode(b)) {
    score += 0.3
  } else {
    const aKids = 'children' in a ? safeChildren(a).length : 0
    const bKids = 'children' in b ? safeChildren(b).length : 0
    if (aKids > 0 && bKids > 0) {
      const ratio = Math.min(aKids, bKids) / Math.max(aKids, bKids)
      score += ratio * 0.3
    }
  }

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
export function looksLikeCard(node: SceneNode): boolean {
  if (!isValidFigmaNode(node)) return false
  if (isImageNode(node)) return true
  if (node.type !== 'FRAME' && node.type !== 'COMPONENT' &&
    node.type !== 'INSTANCE' && node.type !== 'GROUP') return false
  if (!('children' in node)) return false
  const kids = safeChildren(node)
  if (kids.length === 0) return false
  // A card-like item is NOT entirely made of a single wide text node
  if (kids.length === 1 && kids[0].type === 'TEXT') return false

  // Sections that span full desktop width (>= 500px) or are named section/area/wrapper/feed are NOT individual cards!
  const name = (node.name || '').toLowerCase()
  if (node.width >= 500) {
    if (/(section|area|wrapper|container|feed|main|body)/i.test(name)) return false
    if (node.height >= 180) return false
  }

  return true
}

/**
 * Checks if a card is a metric/stat widget (e.g. Total Revenue $45.2K +18%)
 */
export function isMetricCard(node: SceneNode): boolean {
  if (!looksLikeCard(node)) return false
  if (!('children' in node)) return false
  const kids = visibleChildren(node)
  if (kids.length < 1 || kids.length > 7) return false

  // Metric cards do NOT have product images or cart/buy buttons
  if (kids.some(k => isImageNode(k))) return false
  if (kids.some(k => /(buy|cart|bag|checkout|shop|price)/i.test(k.name || ''))) return false

  const texts = kids.filter(k => k.type === 'TEXT') as TextNode[]
  if (texts.length === 0) return false

  return texts.some(t => {
    const chars = (t.characters || '').trim()
    return /^([+$€£₹¥]?\s*[\d,.]+[kKmMbB%]?|[\d,.]+%?|[+$€£₹¥]\s*[\d,.]+)$/.test(chars) ||
      /(revenue|users|orders|conversions|bounce|sales|profit|growth|total|active|rate|sessions|views|subscribers|mrr|arr)/i.test(t.name || chars)
  })
}

/**
 * Checks if a card is an e-commerce product card (e.g. photo + title + $99 price)
 */
export function isProductCard(node: SceneNode): boolean {
  if (!looksLikeCard(node)) return false
  if (!('children' in node)) return false

  const name = (node.name || '').toLowerCase()
  if (/(product|item-card|product-card|shoe|sneaker|catalog-item|merch|apparel|listing-card|productcard)/i.test(name)) {
    return true
  }

  const allDescendants = getAllDescendants(node, 3)

  const hasPrice = allDescendants.some(d => {
    if (d.type !== 'TEXT') return false
    const text = ((d as TextNode).characters || '').trim()
    return /([$€£₹¥]\s*[\d,.]+|[\d,.]+\s*[$€£₹¥]|\b(USD|EUR|INR|GBP)\s*[\d,.]+)/i.test(text)
  })

  const hasImage = allDescendants.some(d => isImageNode(d) || /(product-img|product-image|thumb|photo|pic|shoe|apparel)/i.test(d.name || ''))
  const hasEcommerceAction = allDescendants.some(d => /(cart|buy|bag|add-to-cart|order|wishlist|heart)/i.test(d.name || ''))
  const hasDiscountBadge = allDescendants.some(d => {
    if (d.type !== 'TEXT') return false
    const text = ((d as TextNode).characters || '').trim()
    return /(-\d+%\b|\d+%\s*OFF\b|SAVE\s*[$€£₹¥]?\d+)/i.test(text)
  })

  return (
    (hasImage && hasPrice) ||
    (hasPrice && (hasEcommerceAction || hasDiscountBadge || allDescendants.length >= 2)) ||
    (hasImage && /(product|item|shoe|apparel|sneaker|catalog|shop)/i.test(node.name || ''))
  )
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
  // If any sibling is a wide section (width >= 500) or named section/feed, this is NOT a repeated collection of cards
  if (kids.some(k => k.width >= 500 && /(section|area|wrapper|container|feed|main)/i.test(k.name || ''))) {
    return false
  }

  // Filter to only proper containers that look like cards
  const cards = kids.filter(k => looksLikeCard(k))

  // Need at least 3 card-like siblings
  if (cards.length < 3) return false

  // Guard: if the sibling count is small relative to containers, it may be
  // a heterogeneous composition (e.g. Hero: [image, text-group, button-group]).
  // Exclude section title/subtitle text nodes located above the cards when evaluating density.
  const firstCardY = Math.min(...cards.map(c => nY(c)))
  const contentKids = kids.filter(k => isNodeValidAndVisible(k) && !(k.type === 'TEXT' && nY(k) < firstCardY))
  if (cards.length < contentKids.length * 0.70) return false

  // Check height variance: cards in a repeated collection should have reasonably similar heights
  const heights = cards.map(c => c.height)
  const minH = Math.min(...heights)
  const maxH = Math.max(...heights)
  if (maxH > 0 && minH / maxH < 0.50) return false

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
 * Default is 1 column. 2 columns is applied for:
 * - Metric / stat cards (dashboards)
 * - E-Commerce product cards
 * - Image / photo gallery items
 * - Compact chips / cards (W <= 300 & H <= 300)
 */
function detectCollectionColumns(kids: SceneNode[], vp: RVP, archetype?: string): number {
  const cards = kids.filter(k => looksLikeCard(k))
  if (cards.length === 0) return 1

  // Tablet (768px - 1023px): 2 or 3 columns
  if (vp.width >= 768 && vp.width < 1024) {
    if (cards.length >= 4) return Math.min(cards.length <= 4 ? 2 : 3, 3)
    return 2
  }

  // Mobile (< 768px):
  const sampleCount = Math.min(cards.length, 4)
  const sample = cards.slice(0, sampleCount)
  const avgW = sample.reduce((s, c) => s + c.width, 0) / sampleCount
  const avgH = sample.reduce((s, c) => s + c.height, 0) / sampleCount
  const avgKidCount = sample.reduce((s, c) => {
    return s + ('children' in c ? safeChildren(c).length : 0)
  }, 0) / sampleCount

  // Wide banners / large feature kits (e.g. 2 wide banners of 500-600px) MUST stay 1 column on mobile!
  if (avgW >= 460 || (cards.length <= 2 && avgW >= 360)) {
    return 1
  }

  // 1. Metric cards in dashboards: 2-column grid
  const metricCards = cards.filter(c => isMetricCard(c))
  if (metricCards.length >= 2 && metricCards.length >= cards.length * 0.5) {
    return 2
  }

  // 2. Product cards in e-commerce: 2-column grid
  const productCards = cards.filter(c => isProductCard(c))
  if (productCards.length >= 2 || (archetype === 'E_COMMERCE' && cards.length >= 3 && avgW < 460)) {
    return 2
  }

  // 3. Image / photo gallery: 2-column grid
  const isAllImages = cards.every(c => isImageNode(c) || (c.type === 'FRAME' && visibleChildren(c).every(k => isImageNode(k))))
  if (isAllImages && cards.length >= 3 && avgW < 480) {
    return 2
  }

  // What would each card's width be in a 2-col layout?
  const mobileItemW = Math.floor((vp.width - vp.padding * 2 - vp.colGap) / 2)

  // Hard minimum: cards must be at least 100px wide in mobile 2-col
  if (mobileItemW < 100) return 1

  // Text-heavy cards (tall & many children): always 1 column
  const aspectRatio = avgH / Math.max(avgW, 1)
  if (aspectRatio > 2.0 && avgKidCount > 3) return 1

  // Cards that are already compact squares or short rectangles on desktop → 2 col
  if (avgW <= 300 && avgH <= 300 && avgKidCount <= 5) return 2

  // Default: 1 column to maintain readable cards
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
  if (!isValidFigmaNode(node)) return false
  // Badges, tags, pills, buttons, and chips are NEVER announcement bars
  if (isBadgeOrPillTag(node) || isButtonLike(node)) return false
  // Announcement bars are wide banner strips across the page
  if (node.width < 250) return false

  const name = (node.name || '').toLowerCase()

  // Navigation, header, and already-created mobile menus are NEVER announcement bars
  if (/(nav|navbar|navigation|site-nav|main-nav)/i.test(name)) return false
  if (/^header(\s+section)?$/i.test(name) || /(site-header|main-header)/i.test(name)) return false
  if (/(mobile\s*nav|hamburger|menu\s*icon)/i.test(name)) return false

  // 1. Explicit announcement/promo/marquee keywords
  if (/(announce|promo|marquee|strip|notice|alert|broadcast|offer|deal|discount)/i.test(name)) {
    return true
  }

  // 2. Any thin strip at or near the top of the canvas (height <= 56px)
  if (node.height <= 56 && node.width >= 280) {
    if (/(banner|strip|sale|shipping)/i.test(name) && !/(sidebar|nav-links|menu-list)/i.test(name)) {
      if ('children' in node) {
        const kids = visibleChildren(node).filter(k => !isBackgroundNode(k, node.width, node.height))
        const hasBrand = kids.some(k => isLikelyBrandElement(k))
        const navLinks = kids.filter(k => isNavItemCandidate(k))
        if (!hasBrand || navLinks.length <= 1) return true
      } else {
        return true
      }
    }
  }

  // 3. Structural check: thin row (<= 48px) without brand logo and without multiple nav links
  if (node.height <= 48 && node.width >= 280 && 'children' in node) {
    const kids = visibleChildren(node).filter(k => !isBackgroundNode(k, node.width, node.height))
    const hasBrand = kids.some(k => isLikelyBrandElement(k))
    const navLinks = kids.filter(k => isNavItemCandidate(k))
    if (!hasBrand && navLinks.length <= 1) return true
  }

  // 4. Pure text banner at top
  if (node.type === 'TEXT' && node.height <= 48 && node.width >= 280) {
    return true
  }

  return false
}

function detectNavigationStructure(
  node: SceneNode,
  parentH: number
): boolean {
  if (!('children' in node)) return false
  if (isAnnouncementBar(node)) return false

  const name = (node.name || '').toLowerCase()
  const isNamedNav = /(nav|header|navbar|top-bar|topbar|appbar|menu-bar|site-header|masthead|navigation)/i.test(name)
  const relY = nY(node) / Math.max(1, parentH)

  // Must be located near the top of the canvas (top 35% of page height or Y <= 320)
  if (relY > 0.35 && nY(node) > 320) return false

  // Unwrap single-child / content wrappers (e.g. Header -> InnerContainer -> [Logo, Links, Button])
  // even if background rectangle/fill exists at this level
  let container: SceneNode = node
  let kids = visibleChildren(container)
  while ('children' in container) {
    const nonBgKids = visibleChildren(container).filter(
      c => !isBackgroundNode(c, container.width, container.height)
    )
    if (nonBgKids.length === 1 && 'children' in nonBgKids[0]) {
      container = nonBgKids[0]
      kids = visibleChildren(container)
    } else {
      kids = visibleChildren(container)
      break
    }
  }

  // Must have a nav-like height: compact row, not an entire long content section
  // Headers are compact (<= 140px). If explicitly named nav/header, allow up to 260px.
  const isShort = isNamedNav ? node.height <= 260 : node.height <= 140
  const isThinSlice = isNamedNav && node.height / Math.max(1, parentH) <= 0.25
  if (!isShort && !isThinSlice) return false

  // If explicitly named nav/header and near top with valid height, accept!
  if (isNamedNav && (isShort || isThinSlice)) {
    return true
  }

  // For un-named frames, it MUST NOT look like a hero, feature, card, or content section
  if (node.height > 140) return false
  const fgKids = kids.filter(k => !isBackgroundNode(k, container.width, container.height))
  if (fgKids.some(k => looksLikeCard(k) || isProductCard(k))) return false
  if (fgKids.some(k => k.type === 'TEXT' && typeof (k as TextNode).fontSize === 'number' && (k as TextNode).fontSize > 24)) return false
  if (fgKids.some(k => isImageNode(k) && k.width > 200 && k.height > 100)) return false

  const alMode = detectAutoLayout(container)

  // Must be horizontal or have horizontally-arranged children
  const isHorizontal =
    alMode === 'HORIZONTAL' ||
    (alMode === 'NONE' && isHorizontallyArranged(kids, container.width)) ||
    (alMode === 'VERTICAL' &&
      kids.some(k => 'children' in k && isHorizontallyArranged(visibleChildren(k), container.width)))

  if (!isHorizontal) return false

  // Must NOT be a repeated collection of similar items (that's a horizontal card row, not a nav)
  if (detectRepeatedCollection(fgKids)) return false

  // For un-named frames, must contain at least one navigation-like indicator:
  // Brand logo, nav links, or utility/action element
  const hasBrand = fgKids.some(k => isLikelyBrandElement(k))
  const hasNavLinks = fgKids.some(k => isNavItemCandidate(k))
  const hasUtility = fgKids.some(k => isUtilityElement(k) || isMenuTriggerElement(k))
  if (!hasBrand && !hasNavLinks && !hasUtility) return false

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
  if (!isValidFigmaNode(n)) return false
  try {
    if (n.type === 'TEXT') return true
    if ('children' in n) {
      for (const c of safeChildren(n)) {
        if (hasTextContent(c)) return true
      }
    }
    return false
  } catch (_) {
    return false
  }
}

/**
 * Checks if a candidate node looks like an individual navigation item.
 */
function isNavItemCandidate(n: SceneNode): boolean {
  if (!isValidFigmaNode(n)) return false
  if (isMenuTriggerElement(n)) return false
  if (isUtilityElement(n)) return false
  if (isLikelyBrandElement(n)) return false

  if (n.type === 'TEXT') {
    const t = n as TextNode
    const fs = typeof t.fontSize === 'number' ? t.fontSize : 16
    if (fs > 20) return false
    const len = (t.characters || '').length
    if (len < 1 || len > 35) return false
    return true
  }

  if ('children' in n) {
    if (n.height > 48 || n.width > 220) return false
    if (looksLikeCard(n) || isProductCard(n)) return false
    const name = (n.name || '').toLowerCase()
    const isNamedNavKid = name.includes('nav') || name.includes('link') || name.includes('tab') || name.includes('menu') || name.includes('item')
    const kids = safeChildren(n)
    if (kids.some(k => k.type === 'TEXT' && typeof (k as TextNode).fontSize === 'number' && (k as TextNode).fontSize > 18)) {
      return false
    }
    const textKids = kids.filter(k => k.type === 'TEXT') as TextNode[]
    if (textKids.length === 1 && (textKids[0].characters || '').length <= 35) {
      return true
    }
    if (isNamedNavKid && kids.length <= 3) return true
  }
  return false
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
      if (subKids.length >= 2 && subKids.every(k => isNavItemCandidate(k))) {
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
    if (
      isBackgroundNode(k, containerW, containerH) ||
      (k.type === 'RECTANGLE' && k.width >= node.width * 0.70 && k.height >= node.height * 0.50)
    ) {
      bgNodes.push(k)
    } else {
      remaining.push(k)
    }
  }

  // If remaining has a single container child holding the real content (e.g. Header -> InnerContainer)
  while (remaining.length === 1 && 'children' in remaining[0] && !isLikelyBrandElement(remaining[0])) {
    const innerKids = visibleChildren(remaining[0])
    const innerNonBg = innerKids.filter(
      k => !isBackgroundNode(k, (remaining[0] as any).width, (remaining[0] as any).height)
    )
    if (innerNonBg.length > 1) {
      remaining.splice(0, 1, ...innerNonBg)
      break
    } else if (innerNonBg.length === 1 && 'children' in innerNonBg[0]) {
      remaining.splice(0, 1, innerNonBg[0])
    } else {
      break
    }
  }

  if (remaining.length === 0) {
    return { brandCandidates: [], navLinkCandidates: [], actionCandidates: [], bgNodes }
  }

  // Sort by Y position for vertical sidebars/menus, by X position for horizontal bars
  const isVertical = node.height > node.width || ('layoutMode' in node && (node as FrameNode).layoutMode === 'VERTICAL')
  if (isVertical) {
    remaining.sort((a, b) => nY(a) - nY(b))
  } else {
    remaining.sort((a, b) => nX(a) - nX(b))
  }

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
 * Detects if a container has 2 prominent side-by-side columns (e.g. Hero [Text | Image] or Feature [Col 1 | Col 2]).
 */
function isTwoColumnLayout(kids: SceneNode[], containerW: number): boolean {
  // If container is already narrow (e.g. a card < 450px), it's not a two-column layout section!
  if (containerW < 450) return false
  if (kids.length < 2) return false

  const xs = kids.map(k => nX(k))
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)

  // Must span across at least 35% of the desktop container width
  if (maxX - minX < containerW * 0.35) return false

  if (kids.length === 2) {
    const [a, b] = kids
    const separation = Math.abs(nX(b) - nX(a))
    return separation >= containerW * 0.20
  }

  const midX = minX + (maxX - minX) / 2
  const leftKids = kids.filter(k => nX(k) + k.width / 2 < midX)
  const rightKids = kids.filter(k => nX(k) + k.width / 2 >= midX)
  return leftKids.length >= 1 && rightKids.length >= 1
}

/**
 * Detects if a node is a footer section with multi-column links, copyright, or footer topology.
 */
function detectFooterStructure(node: SceneNode, parentH: number): boolean {
  if (!('children' in node)) return false
  const name = (node.name || '').toLowerCase()

  // Guard against tables, grids, dashboards, analytics, forms, etc.
  if (/(table|grid|data|chart|metrics|dash|analytics|invoices|transactions|records|form|modal|dialog)/i.test(name)) {
    return false
  }

  const isNamedFooter = /(footer|colophon|site-footer|page-footer)/i.test(name)

  const relY = nY(node) / Math.max(1, parentH)
  const isNearBottom = (parentH >= 1200 && relY >= 0.75) || (parentH > 0 && nY(node) >= parentH - 900 && relY >= 0.70)

  const kids = visibleChildren(node)
  const hasCopyright = kids.some(k => {
    const kn = (k.name || '').toLowerCase()
    const kt = k.type === 'TEXT' ? ((k as TextNode).characters || '').toLowerCase() : ''
    return /(copyright|all rights reserved|©|\b202\d\b|privacy policy|terms of service)/i.test(kn) ||
      /(copyright|all rights reserved|©|\b202\d\b|privacy policy|terms of service)/i.test(kt)
  })

  const linkColCount = kids.filter(k => {
    const kn = (k.name || '').toLowerCase()
    return /(links|column|col|navigation|menu|legal|company|product|resources|about|support)/i.test(kn) ||
      ('children' in k && visibleChildren(k).filter(c => c.type === 'TEXT').length >= 3)
  }).length

  if (isNamedFooter) return true
  if (isNearBottom && (hasCopyright || linkColCount >= 2)) return true
  return false
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
  // Check direct top-level children
  for (const kid of topLevelKids) {
    if (!isValidFigmaNode(kid)) continue
    const kidX = nX(kid)
    const kidW = kid.width
    const kidH = kid.height
    const name = (kid.name || '').toLowerCase()

    // Must not be a footer, header, banner, or content section
    if (/(footer|bottom|header|banner|promo|hero|product|industry|catalog|pricing|alert)/i.test(name)) {
      continue
    }

    const isNamedSidebar =
      /(sidebar|side-nav|sidenav|side_nav|side\s*nav|side-menu|sidemenu|side\s*menu|dashboard-nav|dashboard\s*nav|left-nav|left\s*nav|left-menu|left\s*menu|vertical-nav|vertical\s*nav|drawer|aside)/i.test(name) ||
      (/(nav|navigation|menu)/i.test(name) && kidH > kidW * 1.5 && !/(footer|header)/i.test(name))

    const isNarrow = kidW <= parentW * 0.42
    const isTall = kidH >= Math.max(300, parentH * 0.35)
    const isLeftEdge = kidX <= parentW * 0.30
    const isRightEdge = kidX >= parentW * 0.58

    if (isNamedSidebar && isNarrow && isTall && (isLeftEdge || isRightEdge)) {
      if ('children' in kid) {
        const subKids = visibleChildren(kid).filter(c => !isBackgroundNode(c, kid.width, kid.height))
        if (subKids.length >= 1) {
          const mainContent = topLevelKids.filter(k => k !== kid)
          return { hasSidebar: true, sidebarNode: kid, mainContentNodes: mainContent }
        }
      }
    }
  }

  // Also check if a single top-level wrapper contains the sidebar (e.g. AppFrame -> [Sidebar, Content])
  if (topLevelKids.length === 1 && 'children' in topLevelKids[0]) {
    const wrapper = topLevelKids[0] as FrameNode
    const innerKids = visibleChildren(wrapper).filter(k => !isBackgroundNode(k, wrapper.width, wrapper.height))
    for (const kid of innerKids) {
      const kidX = nX(kid)
      const kidW = kid.width
      const kidH = kid.height
      const name = (kid.name || '').toLowerCase()

      if (/(footer|bottom|header|banner|promo|hero|product|industry|catalog|pricing|alert)/i.test(name)) {
        continue
      }

      const isNamedSidebar =
        /(sidebar|side-nav|sidenav|side_nav|side\s*nav|side-menu|sidemenu|side\s*menu|dashboard-nav|dashboard\s*nav|left-nav|left\s*nav|left-menu|left\s*menu|vertical-nav|vertical\s*nav|drawer|aside)/i.test(name) ||
        (/(nav|navigation|menu)/i.test(name) && kidH > kidW * 1.5 && !/(footer|header)/i.test(name))

      const isNarrow = kidW <= wrapper.width * 0.42
      const isTall = kidH >= Math.max(300, wrapper.height * 0.35)
      const isLeftEdge = kidX <= wrapper.width * 0.30
      const isRightEdge = kidX >= wrapper.width * 0.58

      if (isNamedSidebar && isNarrow && isTall && (isLeftEdge || isRightEdge)) {
        if ('children' in kid) {
          const subKids = visibleChildren(kid).filter(c => !isBackgroundNode(c, kid.width, kid.height))
          if (subKids.length >= 1) {
            const mainContent = innerKids.filter(k => k !== kid)
            return { hasSidebar: true, sidebarNode: kid, mainContentNodes: mainContent }
          }
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
  | 'FOOTER'                  // Multi-column / page footer → clean mobile vertical flow
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
  if (isTopLevel && !alreadyHasNav && detectNavigationStructure(node, parentH)) {
    return 'NAVIGATION'
  }

  // 2. TABLE — check table before footer or horizontal group so data tables don't get misclassified
  if (detectTableStructure(node)) return 'TABLE'

  // 3. FOOTER — multi-column links / copyright / bottom content
  if (detectFooterStructure(node, parentH)) {
    return 'FOOTER'
  }

  const alMode = detectAutoLayout(node)

  // 4. AUTO LAYOUT — preserve existing AL structure
  if (alMode === 'HORIZONTAL') return 'AUTO_LAYOUT_HORIZONTAL'
  if (alMode === 'VERTICAL') return 'AUTO_LAYOUT_VERTICAL'

  if (!('children' in node)) return 'SINGLE_COLUMN'
  const kids = visibleChildren(node).filter(k => !isBackgroundNode(k, node.width, node.height))
  if (kids.length === 0) return 'SINGLE_COLUMN'

  // 5. REPEATED COLLECTION — structurally similar sibling items
  if (detectRepeatedCollection(kids)) return 'REPEATED_COLLECTION'

  // 6. HORIZONTAL GROUP — non-AL children arranged horizontally or 2-column hero/feature
  if (kids.length >= 2 && (isHorizontallyArranged(kids, node.width) || isTwoColumnLayout(kids, node.width))) {
    return 'HORIZONTAL_GROUP'
  }

  // 7. DEFAULT
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

  if (node.itemSpacing && node.itemSpacing > SPACING.NORMAL) {
    node.itemSpacing = SPACING.NORMAL
  }

  // Resize to mobile width
  if (node.primaryAxisSizingMode === 'FIXED') {
    doResize(node, targetW, node.height)
  } else {
    doResize(node, targetW, node.height)
    node.primaryAxisSizingMode = 'AUTO'
  }

  // Adapt horizontal sizing
  if (node.counterAxisSizingMode === 'AUTO') {
    doResize(node, targetW, node.height)
  }

  const innerW = Math.max(1, targetW - node.paddingLeft - node.paddingRight)

  // Recurse into children that have Auto Layout or complex structure
  for (const child of safeChildren(node)) {
    const isBadge = isBadgeOrPillTag(child) || (child.height <= 36 && child.width <= 160)
    if (isBadge) {
      try {
        (child as any).layoutAlign = 'INHERIT'
        (child as any).layoutSizingHorizontal = 'HUG'
        (child as any).layoutSizingVertical = 'HUG'
        (child as any).primaryAxisSizingMode = 'AUTO'
        (child as any).counterAxisSizingMode = 'AUTO'
      } catch (_) { }
      if ('children' in child) {
        for (const ck of visibleChildren(child)) {
          if (ck.type === 'TEXT') {
            (ck as TextNode).textAutoResize = 'WIDTH_AND_HEIGHT'
          }
        }
      }
      preserveCardCornerRadius(child, child.width, child.height)
    } else if ('layoutMode' in child) {
      doResize(child, innerW, child.height)
      await reflowNode(child, vp, innerW, log)
      preserveCardCornerRadius(child, innerW, child.height)
    } else if (child.type === 'TEXT') {
      await reflowTextNode(child as TextNode, innerW, vp, log)
      preserveCardCornerRadius(child, innerW, child.height)
    } else if (isImageNode(child)) {
      const aspect = child.height / Math.max(1, child.width)
      const imgW = innerW
      const imgH = Math.round(imgW * aspect)
      doResize(child, imgW, imgH)
      preserveCardCornerRadius(child, innerW, child.height)
    } else if ('children' in child) {
      doResize(child, innerW, child.height)
      await reflowNode(child, vp, innerW, log)
      preserveCardCornerRadius(child, innerW, child.height)
    } else {
      if (child.width > innerW) {
        doResize(child, innerW, child.height)
      }
      preserveCardCornerRadius(child, innerW, child.height)
    }
  }

  try {
    node.primaryAxisSizingMode = 'AUTO'
  } catch (_) { }

  const kids = safeChildren(node)
  const totalChildH = kids.reduce((s, c) => s + c.height, 0) + Math.max(0, kids.length - 1) * (node.itemSpacing || 0)
  const expectedH = totalChildH + (node.paddingTop || 0) + (node.paddingBottom || 0)
  const finalH = Math.max(expectedH, 20)
  doResize(node, targetW, finalH)
  preserveCardCornerRadius(node, targetW, finalH)

  log.push(`"${node.name}" [AUTO_LAYOUT_VERTICAL]: preserved, width ${targetW}px, height ${finalH}px`)
  return finalH
}

// ============================================================
// TRANSFORMER: AUTO LAYOUT (HORIZONTAL)
// ============================================================

/**
 * Checks if a horizontal Auto Layout row contains inline micro-content
 * (such as a rating row, price row, color swatches, tag pills, or icon+label)
 * that should remain horizontal and never be flipped to vertical unless overflowing.
 */
function isInlineMicroRow(node: FrameNode, kids: SceneNode[]): boolean {
  if (kids.length <= 1) return true
  // Rating row (stars + review text)
  const isRating = kids.some(k => /(star|rating|review)/i.test(k.name || '')) ||
    (kids.length === 2 && kids.some(k => k.type === 'TEXT' && /[★☆]/.test((k as TextNode).characters || '')))
  if (isRating) return true

  // Price row (price + strikethrough price or badge)
  const isPrice = kids.every(k => k.type === 'TEXT' || isButtonLike(k) || (k.width <= 90 && k.height <= 36)) &&
    kids.some(k => k.type === 'TEXT' && /[$€£₹¥\d%]/.test((k as TextNode).characters || ''))
  if (isPrice) return true

  // Swatches / chips (dots, color circles, size pills)
  const isSwatches = kids.every(k => (k.width <= 36 && k.height <= 36) || (k.height <= 28 && k.width <= 50))
  if (isSwatches) return true

  // Icon + label pair (e.g. [Icon] Text)
  if (kids.length === 2 && (isIconNode(kids[0]) || kids[0].width <= 28)) return true

  // Compact tag / pill row (only micro if it actually fits in available space)
  if (kids.every(k => k.height <= 32 && k.width <= 110)) {
    const totalW = kids.reduce((s, c) => s + c.width, 0) + (kids.length - 1) * (node.itemSpacing || 8)
    if (totalW <= node.width) return true
  }

  // Compact button group that fits within available width
  if (kids.every(k => isButtonLike(k))) {
    const totalW = kids.reduce((s, c) => s + c.width, 0) + (kids.length - 1) * (node.itemSpacing || 8)
    if (totalW <= node.width) return true
  }

  return false
}

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
  const kids = safeChildren(node)

  // Announcement bar fast-path: preserve full width, compact height, center contents
  if (isAnnouncementBar(node)) {
    const barH = Math.max(36, Math.min(node.height, 52))
    node.paddingLeft = 12
    node.paddingRight = 12
    node.paddingTop = 0
    node.paddingBottom = 0
    node.primaryAxisAlignItems = 'CENTER'
    node.counterAxisAlignItems = 'CENTER'
    doResize(node, targetW, barH)
    preserveCardCornerRadius(node, targetW, barH)
    for (const c of kids) {
      if (c.type === 'TEXT') {
        const txt = c as TextNode
        try {
          if (typeof txt.fontName !== 'symbol') {
            await loadFontSafe(txt.fontName as FontName)
          }
          txt.textAlignHorizontal = 'CENTER'
        } catch (_) { }
      }
    }
    log.push(`"${node.name}" [ANNOUNCEMENT_BAR|AL]: preserved top banner (${targetW}x${barH}px)`)
    return barH
  }

  // Badge / Chip / Pill fast-path: preserve compact chip dimensions, hug contents horizontally & auto-width text
  if (isBadgeOrPillTag(node)) {
    try {
      (node as any).layoutSizingHorizontal = 'HUG'
      (node as any).layoutSizingVertical = 'HUG'
      node.primaryAxisSizingMode = 'AUTO'
      node.counterAxisSizingMode = 'AUTO'
    } catch (_) { }
    for (const c of kids) {
      if (c.type === 'TEXT') {
        const txt = c as TextNode
        await reflowTextNode(txt, node.width, vp, log)
        txt.textAutoResize = 'WIDTH_AND_HEIGHT'
      }
    }
    preserveCardCornerRadius(node, node.width, node.height)
    return node.height
  }

  const totalChildW = kids.reduce((s, c) => s + c.width, 0) + (kids.length - 1) * (node.itemSpacing || 0)

  // Scale padding
  const scalePad = (v: number) => Math.min(v, vp.padding)
  const origPadL = node.paddingLeft
  const origPadR = node.paddingRight
  node.paddingLeft = Math.round(scalePad(origPadL))
  node.paddingRight = Math.round(scalePad(origPadR))
  node.paddingTop = Math.round(Math.min(node.paddingTop, vp.padding * 2))
  node.paddingBottom = Math.round(Math.min(node.paddingBottom, vp.padding * 2))

  const newAvailW = targetW - node.paddingLeft - node.paddingRight

  // Flip to vertical on mobile if:
  // 1. Total child width exceeds available viewport width, OR
  // 2. Children are cards, columns, or containers (not an inline micro row), OR
  // 3. 3 or more substantial items are arranged horizontally
  const isMicro = isInlineMicroRow(node, kids)
  const hasSubstantialCards = kids.some(c => 'children' in c || c.height >= 45 || isImageNode(c) || looksLikeCard(c))
  const shouldFlip =
    totalChildW > newAvailW ||
    (!isMicro && vp.width < 768 && (kids.length >= 3 || hasSubstantialCards || (kids.length >= 2 && totalChildW > newAvailW * 0.85)))

  if (shouldFlip) {
    // Children won't fit horizontally → switch to vertical
    node.layoutMode = 'VERTICAL'
    node.primaryAxisAlignItems = 'MIN'
    node.itemSpacing = Math.max(20, node.itemSpacing || 20)

    // Resize children to fill width
    for (const child of kids) {
      const isBadge = isBadgeOrPillTag(child) || (child.height <= 36 && child.width <= 160)
      if (isBadge) {
        try {
          (child as any).layoutAlign = 'INHERIT'
          (child as any).layoutSizingHorizontal = 'HUG'
          (child as any).layoutSizingVertical = 'HUG'
          (child as any).primaryAxisSizingMode = 'AUTO'
          (child as any).counterAxisSizingMode = 'AUTO'
        } catch (_) { }
        if ('children' in child) {
          for (const ck of visibleChildren(child)) {
            if (ck.type === 'TEXT') {
              (ck as TextNode).textAutoResize = 'WIDTH_AND_HEIGHT'
            }
          }
        }
      } else {
        doResize(child, newAvailW, child.height)
        try { (child as any).layoutAlign = 'STRETCH' } catch (_) { }
        try { (child as any).layoutSizingHorizontal = 'FILL' } catch (_) { }
      }

      let chH = child.height
      if (child.type === 'TEXT') {
        chH = await reflowTextNode(child as TextNode, newAvailW, vp, log)
      } else if (isImageNode(child)) {
        const aspect = child.height / Math.max(1, child.width)
        chH = Math.round(newAvailW * aspect)
        doResize(child, newAvailW, chH)
      } else if ('children' in child) {
        chH = await reflowNode(child, vp, isBadge ? child.width : newAvailW, log, true)
        if (!isBadge) {
          doResize(child, newAvailW, chH)
        }
      }
      preserveCardCornerRadius(child, isBadge ? child.width : newAvailW, chH)
    }

    try {
      node.primaryAxisSizingMode = 'AUTO'
    } catch (_) { }

    const totalChildH = kids.reduce((s, c) => s + c.height, 0) + Math.max(0, kids.length - 1) * (node.itemSpacing || 0)
    const expectedH = totalChildH + (node.paddingTop || 0) + (node.paddingBottom || 0)
    const finalH = Math.max(expectedH, 20)
    doResize(node, targetW, finalH)
    preserveCardCornerRadius(node, targetW, finalH)

    log.push(`"${node.name}" [AUTO_LAYOUT_HORIZONTAL→VERTICAL]: flipped due to overflow (${finalH}px)`)
    return finalH
  } else {
    // Children fit — preserve HORIZONTAL, just resize node
    // Scale children that have FILL sizing
    for (const child of kids) {
      const isBadge = isBadgeOrPillTag(child) || (child.height <= 36 && child.width <= 160)
      if (isBadge) {
        try {
          (child as any).layoutAlign = 'INHERIT'
          (child as any).layoutSizingHorizontal = 'HUG'
          (child as any).layoutSizingVertical = 'HUG'
          (child as any).primaryAxisSizingMode = 'AUTO'
          (child as any).counterAxisSizingMode = 'AUTO'
        } catch (_) { }
        if ('children' in child) {
          for (const ck of visibleChildren(child)) {
            if (ck.type === 'TEXT') {
              (ck as TextNode).textAutoResize = 'WIDTH_AND_HEIGHT'
            }
          }
        }
      } else if (child.type === 'TEXT') {
        await reflowTextNode(child as TextNode, Math.min(child.width, newAvailW), vp, log)
      } else if ('children' in child) {
        await reflowNode(child, vp, child.width, log)
      }
      preserveCardCornerRadius(child, child.width, child.height)
    }

    const maxChildH = Math.max(...kids.map(c => c.height), 1)
    const expectedH = maxChildH + (node.paddingTop || 0) + (node.paddingBottom || 0)
    const finalH = Math.max(expectedH, 20)
    doResize(node, targetW, finalH)
    preserveCardCornerRadius(node, targetW, finalH)
    node.clipsContent = true

    log.push(`"${node.name}" [AUTO_LAYOUT_HORIZONTAL]: preserved (children fit)`)
    return finalH
  }
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

  // If sourceNode is an INSTANCE, detach it so its children and layout can be manipulated
  if (sourceNode.type === 'INSTANCE' && 'detachInstance' in sourceNode && typeof (sourceNode as any).detachInstance === 'function') {
    try {
      sourceNode = (sourceNode as any).detachInstance()
    } catch (_) { }
  }

  const originalName = sourceNode.name

  if (!('children' in sourceNode)) {
    doResize(sourceNode, vp.width, H)
    log.push(`"${originalName}" [NAVIGATION]: leaf node resized to compact bar`)
    return { height: H, activeNode: sourceNode }
  }

  const fr = sourceNode as FrameNode

  // Extract structural nav elements BEFORE modifying the node
  const { brandCandidates, navLinkCandidates, actionCandidates, bgNodes } =
    extractNavElements(fr, vp.width, H)

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

  if (vp.width >= 768) {
    // ── Tablet / Laptop: simple horizontal reflow ──
    if ('layoutMode' in fr && fr.layoutMode !== 'NONE') fr.layoutMode = 'NONE'
    doResize(fr, vp.width, H)
    fr.clipsContent = false
    const brandNode = brandCandidates.length > 0 ? brandCandidates[0] : null
    if (brandNode && isValidFigmaNode(brandNode)) {
      setPos(brandNode, vp.padding, Math.round((H - Math.min(brandNode.height, H)) / 2))
    }
    let rightX = vp.width - vp.padding
    for (let i = actionCandidates.length - 1; i >= 0; i--) {
      const act = actionCandidates[i]
      if (!isValidFigmaNode(act)) continue
      const aw = Math.min(act.width, 80)
      const ah = Math.min(act.height, H - vp.padding)
      rightX -= aw
      setPos(act, rightX, Math.round((H - ah) / 2))
      doResize(act, aw, ah)
      rightX -= SPACING.SMALL
    }
    for (const bg of bgNodes) {
      if (isValidFigmaNode(bg)) {
        setPos(bg, 0, 0)
        doResize(bg, vp.width, H)
      }
    }
    log.push(`"${originalName}" [NAVIGATION]: tablet/laptop horizontal nav, H=${H}px`)
    return { height: H, activeNode: fr }
  }

  // ──────────────────────────────────────────
  // MOBILE: Reflow directly in-place inside the page frame!
  // Preserves single mobile artboard — no off-canvas screens or component sets!
  // ──────────────────────────────────────────
  if ('layoutMode' in fr && fr.layoutMode !== 'NONE') fr.layoutMode = 'NONE'
  setPos(fr, 0, nY(fr))
  doResize(fr, vp.width, H)
  fr.clipsContent = false

  // Backgrounds: position at (0, 0) and resize
  for (const bg of bgNodes) {
    if (isValidFigmaNode(bg)) {
      bg.visible = true
      setPos(bg, 0, 0)
      doResize(bg, vp.width, H)
    }
  }

  // Identify essential elements
  const brand = brandCandidates.length > 0 && isValidFigmaNode(brandCandidates[0]) ? brandCandidates[0] : null
  const cartAction = actionCandidates.find(
    a => isValidFigmaNode(a) && /(cart|bag|basket|shop|order)/i.test((a.name || '') + ' ' + (a.type === 'TEXT' ? (a as TextNode).characters : ''))
  )
  const searchAction = actionCandidates.find(
    a => isValidFigmaNode(a) && a !== cartAction && /(search|find|lookup)/i.test((a.name || '') + ' ' + (a.type === 'TEXT' ? (a as TextNode).characters : ''))
  )
  const otherUtilities = actionCandidates.filter(
    a => isValidFigmaNode(a) && a !== cartAction && a !== searchAction && !isButtonLike(a) && a.width <= 40 && a.height <= 40
  )
  const existingMenuTrigger = actionCandidates.find(a => isValidFigmaNode(a) && isMenuTriggerElement(a))

  // Ensure key elements are direct children of fr if they were nested in a single container
  const promoteToFr = (node: SceneNode) => {
    if (isValidFigmaNode(node) && node.parent !== fr && 'appendChild' in fr) {
      try { fr.appendChild(node) } catch (_) { }
    }
  }
  if (brand) promoteToFr(brand)
  if (cartAction) promoteToFr(cartAction)
  if (searchAction) promoteToFr(searchAction)
  if (existingMenuTrigger) promoteToFr(existingMenuTrigger)
  for (const u of otherUtilities) promoteToFr(u)

  // Hide non-essential desktop children (desktop text links, desktop search input boxes, etc.)
  const keepSet = new Set<SceneNode>()
  for (const bg of bgNodes) keepSet.add(bg)
  if (brand) keepSet.add(brand)
  if (cartAction) keepSet.add(cartAction)
  if (searchAction) keepSet.add(searchAction)
  if (existingMenuTrigger) keepSet.add(existingMenuTrigger)
  for (const u of otherUtilities) keepSet.add(u)

  for (const c of safeAllChildren(fr)) {
    if (!keepSet.has(c)) {
      try { c.visible = false } catch (_) { }
    }
  }

  // 1. Mobile Menu / Hamburger Trigger (on far left)
  if (existingMenuTrigger) {
    existingMenuTrigger.visible = true
    const mw = Math.min(existingMenuTrigger.width, 28)
    const mh = Math.min(existingMenuTrigger.height, 28)
    setPos(existingMenuTrigger, vp.padding, Math.round((H - mh) / 2))
    doResize(existingMenuTrigger, mw, mh)
  } else {
    createHamburgerIcon(fr, vp.padding, Math.round((H - 26) / 2), iconColor)
  }

  // 2. Brand / Logo (next to hamburger)
  let brandEndX = vp.padding + 26 + SPACING.SMALL
  if (brand) {
    brand.visible = true
    const bH = Math.min(brand.height, H - vp.padding)
    const bAspect = brand.width / Math.max(1, brand.height)
    const bW = Math.min(Math.round(vp.width * 0.40), Math.round(bH * bAspect))
    setPos(brand, brandEndX, Math.round((H - bH) / 2))
    doResize(brand, bW, bH)
    if (brand.type === 'TEXT') await reflowTextNode(brand as TextNode, bW, vp)
    brandEndX += bW + SPACING.SMALL
  }

  // 3. Header Action Icons (on right: Cart, Search, Utility)
  let currentRightX = vp.width - vp.padding

  if (cartAction) {
    cartAction.visible = true
    const cw = Math.min(cartAction.width, 70)
    const ch = Math.min(cartAction.height, H - 16)
    const targetX = currentRightX - cw
    if (targetX > brandEndX + SPACING.SMALL) {
      setPos(cartAction, targetX, Math.round((H - ch) / 2))
      doResize(cartAction, cw, ch)
      currentRightX = targetX - SPACING.SMALL
    }
  }

  if (searchAction) {
    searchAction.visible = true
    const sw = Math.min(searchAction.width, 36)
    const sh = Math.min(searchAction.height, 36)
    const targetX = currentRightX - sw
    if (targetX > brandEndX + SPACING.SMALL) {
      setPos(searchAction, targetX, Math.round((H - sh) / 2))
      doResize(searchAction, sw, sh)
      currentRightX = targetX - SPACING.SMALL
    }
  }

  if (!cartAction && !searchAction && otherUtilities.length > 0) {
    const act = otherUtilities[otherUtilities.length - 1]
    if (isValidFigmaNode(act)) {
      act.visible = true
      const aw = Math.min(act.width, 32)
      const ah = Math.min(act.height, 32)
      const targetX = currentRightX - aw
      if (targetX > brandEndX + SPACING.SMALL) {
        setPos(act, targetX, Math.round((H - ah) / 2))
        doResize(act, aw, ah)
      }
    }
  }

  // Containment clamp
  for (const c of safeChildren(fr)) {
    if (!isBackgroundNode(c, vp.width, H)) {
      if (nX(c) + c.width > vp.width) doResize(c, Math.max(8, vp.width - nX(c) - vp.padding), c.height)
      if (nX(c) < 0) setPos(c, 0, nY(c))
      if (nY(c) + c.height > H) doResize(c, c.width, Math.max(4, H - nY(c)))
      if (nY(c) < 0) setPos(c, nX(c), 0)
    }
  }

  console.log('[Mobile Navigation]', {
    navigationDetected: true,
    navigationItemCount: navLinkCandidates.length,
    menuTriggerCount: 1,
    componentCreated: false,
    initialState: 'closed',
    prototypeInteractionCreated: false,
  })

  log.push(`"${originalName}" [NAVIGATION]: reflowed in-place to mobile header H=${H}px`)
  return { height: H, activeNode: fr }
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
  log: string[],
  parentW?: number
): Promise<number> {
  if (!('children' in node)) return node.height

  const fr = node as FrameNode

  // Flatten AL if present (we take over layout)
  if ('layoutMode' in fr && fr.layoutMode !== 'NONE') fr.layoutMode = 'NONE'

  const isNested = !!parentW && parentW < vp.width
  const containerW = parentW ? Math.min(parentW, vp.width) : vp.width
  const baseX = isNested ? 0 : vp.padding
  const contentW = isNested ? containerW : Math.max(10, containerW - vp.padding * 2)

  const allKids = visibleChildren(node)

  // Separate backgrounds, headers, and collection items
  const bgNodes: SceneNode[] = []
  const headerNodes: SceneNode[] = []  // Wide text elements — section headings
  const collectionItems: SceneNode[] = []

  for (const k of allKids) {
    if (isBackgroundNode(k, fr.width, fr.height)) {
      bgNodes.push(k)
    } else if (k.type === 'TEXT' || !looksLikeCard(k)) {
      headerNodes.push(k)
    } else {
      collectionItems.push(k)
    }
  }

  const cols = detectCollectionColumns(collectionItems, vp)
  const itemW = cols === 2
    ? Math.floor((contentW - vp.colGap) / 2)
    : contentW

  let localY = isNested ? 0 : vp.padding

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

  const cardGap = cols === 1 ? 20 : vp.colGap

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

    // Equalize row heights and preserve card corner radius
    for (let col = 0; col < rowItems.length; col++) {
      const card = rowItems[col]
      doResize(card, itemW, maxRowH)
      preserveCardCornerRadius(card, itemW, maxRowH)
    }

    localY += maxRowH + cardGap
  }

  const finalH = localY + (isNested ? 0 : vp.padding)
  doResize(fr, containerW, finalH)
  preserveCardCornerRadius(fr, containerW, finalH)

  for (const bg of bgNodes) {
    setPos(bg, 0, 0)
    doResize(bg, containerW, finalH)
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
  fr.clipsContent = true
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
  // If sidebar is an instance, detach it so it can be transformed
  if (sidebarNode.type === 'INSTANCE' && 'detachInstance' in sidebarNode && typeof (sidebarNode as any).detachInstance === 'function') {
    try {
      sidebarNode = (sidebarNode as any).detachInstance()
    } catch (_) { }
  }

  for (let m = 0; m < mainNodes.length; m++) {
    if (mainNodes[m].type === 'INSTANCE' && 'detachInstance' in mainNodes[m] && typeof (mainNodes[m] as any).detachInstance === 'function') {
      try {
        mainNodes[m] = (mainNodes[m] as any).detachInstance()
      } catch (_) { }
    }
  }

  // Route sidebar through the navigation transformer to create mobile nav with single list button
  const { height: navH, activeNode: activeNav } = await transformNavigationNode(sidebarNode, vp, log)

  if (isValidFigmaNode(activeNav)) {
    setPos(activeNav, 0, 0)
  }

  const allSections: SceneNode[] = isValidFigmaNode(activeNav) ? [activeNav] : []

  // Stack main content nodes below the compact nav
  let localY = navH + SPACING.SECTION
  for (const main of mainNodes) {
    if (!isValidFigmaNode(main)) continue
    setPos(main, 0, localY)
    doResize(main, vp.width, main.height)
    let h = main.height
    try {
      h = await reflowNode(main, vp, vp.width, log)
    } catch (e) {
      console.warn('[SidebarLayout] Section reflow fallback:', e)
    }
    const actualH = Math.max(h, 20)
    doResize(main, vp.width, actualH)
    preserveCardCornerRadius(main, vp.width, actualH)
    localY += actualH + SPACING.SECTION
    allSections.push(main)
  }

  // Safety audits, overlap correction, and viewport clamping on parent frame
  auditAndFixOffFrameContent(parentFrame, log)
  verifyAndCorrectSectionOverlaps(allSections.filter(s => isNodeValidAndVisible(s)), log)

  const finalTop = safeChildren(parentFrame).sort((a, b) => nY(a) - nY(b))
  const lastSec = finalTop[finalTop.length - 1]
  const finalH = lastSec ? nY(lastSec) + lastSec.height : localY

  parentFrame.resize(vp.width, finalH)
  parentFrame.clipsContent = true
  validateAndClampLayout(parentFrame, vp, log)

  log.push(`"${parentFrame.name}" [SIDEBAR_LAYOUT]: sidebar → mobile nav with list button (H=${navH}px), ${mainNodes.length} sections stacked below`)
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
  log: string[],
  parentW?: number
): Promise<number> {
  if (!('children' in node)) return node.height

  const fr = node as FrameNode
  if ('layoutMode' in fr && fr.layoutMode !== 'NONE') fr.layoutMode = 'NONE'

  const isNested = !!parentW && parentW < vp.width
  const containerW = parentW ? Math.min(parentW, vp.width) : vp.width
  const baseX = isNested ? 0 : vp.padding
  const contentW = isNested ? containerW : Math.max(10, containerW - vp.padding * 2)
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

  let localY = isNested ? 0 : vp.padding
  const cardGap = cols === 1 ? 20 : vp.colGap

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
    for (const item of rowItems) {
      doResize(item, itemW, maxRowH)
      preserveCardCornerRadius(item, itemW, maxRowH)
    }

    localY += maxRowH + cardGap
  }

  const finalH = localY + (isNested ? 0 : vp.padding)
  doResize(fr, containerW, finalH)
  preserveCardCornerRadius(fr, containerW, finalH)

  for (const bg of bgNodes) {
    setPos(bg, 0, 0)
    doResize(bg, containerW, finalH)
  }

  log.push(`"${node.name}" [HORIZONTAL_GROUP]: ${fgKids.length} items → ${cols}-col (repeated=${isRepeated}) (${finalH}px)`)
  return finalH
}

// ============================================================
// TRANSFORMER: FOOTER (Clean Mobile Flow)
// ============================================================

/**
 * Transforms a multi-column desktop footer into a clean, compact vertical mobile flow.
 *
 * Requirements:
 * 1. Brand/Logo positioned at top.
 * 2. Multi-column link structures reflowed vertically: Category header + link list.
 * 3. Dividers resized to available content width.
 * 4. Social icon row positioned cleanly within content width.
 * 5. Copyright / legal text stacked neatly at the bottom.
 * 6. Footer container height strictly follows actual content bounds (no giant empty block).
 * 7. Background resized to match final bounds.
 * 8. All desktop column X coordinates (e.g. 700, 1000) recalculated inside mobile viewport.
 */
async function transformFooterLayout(
  node: SceneNode,
  vp: RVP,
  log: string[],
  parentW?: number
): Promise<number> {
  if (!('children' in node)) return node.height

  const fr = node as FrameNode
  if ('layoutMode' in fr && fr.layoutMode !== 'NONE') fr.layoutMode = 'NONE'

  const containerW = parentW ? Math.min(parentW, vp.width) : vp.width
  const contentW = Math.max(10, containerW - vp.padding * 2)
  const baseX = vp.padding

  const allKids = visibleChildren(node)
  const bgNodes = allKids.filter(k => isBackgroundNode(k, fr.width, fr.height))
  const fgKids = allKids.filter(k => !isBackgroundNode(k, fr.width, fr.height) && !isDecorativeNode(k))

  if (fgKids.length === 0) {
    doResize(fr, containerW, 120)
    return 120
  }

  // Classify footer components
  const brandNodes: SceneNode[] = []
  const copyrightNodes: SceneNode[] = []
  const dividerNodes: SceneNode[] = []
  const socialNodes: SceneNode[] = []
  const columnNodes: SceneNode[] = []

  for (const kid of fgKids) {
    const kn = (kid.name || '').toLowerCase()
    const kt = kid.type === 'TEXT' ? ((kid as TextNode).characters || '').toLowerCase() : ''
    const isCopy = /(copyright|all rights reserved|©|\b202\d\b)/i.test(kn) || /(copyright|all rights reserved|©|\b202\d\b)/i.test(kt)
    const isDivider = (kid.height <= 4 && kid.width >= fr.width * 0.40) || /divider|separator|line/i.test(kn)
    const isSocial = /social|icon-group|icons|twitter|facebook|instagram|linkedin|github/i.test(kn) || (isIconNode(kid) && kid.width <= 44)
    const isBrand = (isLikelyBrandElement(kid) || /brand|logo/i.test(kn)) && columnNodes.length === 0

    if (isCopy) {
      copyrightNodes.push(kid)
    } else if (isDivider) {
      dividerNodes.push(kid)
    } else if (isSocial) {
      socialNodes.push(kid)
    } else if (isBrand) {
      brandNodes.push(kid)
    } else {
      columnNodes.push(kid)
    }
  }

  // If columns were side-by-side in desktop, sort by original X
  columnNodes.sort((a, b) => nX(a) - nX(b))

  let localY = vp.padding

  // 1. Brand / Logo
  for (const b of brandNodes) {
    setPos(b, baseX, localY)
    if (b.type === 'TEXT') {
      const bh = await reflowTextNode(b as TextNode, contentW, vp, log)
      localY += bh + SPACING.NORMAL
    } else {
      const bw = Math.min(b.width, contentW)
      doResize(b, bw, b.height)
      localY += b.height + SPACING.NORMAL
    }
  }

  // 2. Link Columns — stacked sequentially as a clean mobile flow
  for (const col of columnNodes) {
    setPos(col, baseX, localY)
    doResize(col, contentW, col.height)

    if ('children' in col) {
      const colKids = visibleChildren(col).filter(c => !isBackgroundNode(c, col.width, col.height) && !isDecorativeNode(c))
      colKids.sort((a, b) => nY(a) - nY(b))
      let colY = 0

      for (const ck of colKids) {
        setPos(ck, 0, colY)
        if (ck.type === 'TEXT') {
          const txt = ck as TextNode
          const isHeading = colY === 0 || (typeof txt.fontSize === 'number' && txt.fontSize >= 15) || ck === colKids[0]
          const fontW = isHeading ? contentW : contentW - 8
          const th = await reflowTextNode(txt, fontW, vp, log)
          colY += th + (isHeading ? SPACING.SMALL : 6)
        } else if ('children' in ck) {
          doResize(ck, contentW, ck.height)
          const subH = await reflowNode(ck, vp, contentW, log, true)
          colY += subH + 6
        } else {
          const cw = Math.min(ck.width, contentW)
          doResize(ck, cw, ck.height)
          colY += ck.height + 6
        }
      }

      const colH = Math.max(colY, 20)
      doResize(col, contentW, colH)
      localY += colH + SPACING.NORMAL
    } else if (col.type === 'TEXT') {
      const th = await reflowTextNode(col as TextNode, contentW, vp, log)
      localY += th + SPACING.SMALL
    } else {
      doResize(col, contentW, col.height)
      localY += col.height + SPACING.NORMAL
    }
  }

  // 3. Dividers
  for (const div of dividerNodes) {
    setPos(div, baseX, localY)
    doResize(div, contentW, Math.min(div.height, 2))
    localY += Math.min(div.height, 2) + SPACING.NORMAL
  }

  // 4. Social Icons (Row)
  if (socialNodes.length > 0) {
    let iconX = baseX
    let maxIconH = 24
    for (const s of socialNodes) {
      const sw = Math.min(s.width, 36)
      const sh = Math.min(s.height, 36)
      maxIconH = Math.max(maxIconH, sh)
      if (iconX + sw > baseX + contentW) {
        iconX = baseX
        localY += maxIconH + SPACING.SMALL
      }
      setPos(s, iconX, localY)
      doResize(s, sw, sh)
      iconX += sw + SPACING.SMALL
    }
    localY += maxIconH + SPACING.NORMAL
  }

  // 5. Copyright / Legal
  for (const cp of copyrightNodes) {
    setPos(cp, baseX, localY)
    if (cp.type === 'TEXT') {
      const cph = await reflowTextNode(cp as TextNode, contentW, vp, log)
      localY += cph + SPACING.SMALL
    } else {
      doResize(cp, Math.min(cp.width, contentW), cp.height)
      localY += cp.height + SPACING.SMALL
    }
  }

  const finalH = localY + vp.padding
  doResize(fr, containerW, finalH)
  preserveCardCornerRadius(fr, containerW, finalH)

  for (const bg of bgNodes) {
    setPos(bg, 0, 0)
    doResize(bg, containerW, finalH)
    preserveCardCornerRadius(bg, containerW, finalH)
    try { fr.insertChild(0, bg) } catch (_) { }
  }

  log.push(`"${node.name}" [FOOTER]: reflowed into vertical flow (${containerW}×${finalH}px)`)
  return finalH
}

// ============================================================
// TRANSFORMER: SINGLE COLUMN (Universal)
// ============================================================

interface LayoutRow {
  items: SceneNode[]
  isSideBySide: boolean
}

/**
 * Groups children into rows, preserving side-by-side elements on desktop
 * (such as sale price + strikethrough price, rating stars + count, swatches, or dual buttons).
 */
function groupIntoLayoutRows(kids: SceneNode[], contentW: number, frWidth: number): LayoutRow[] {
  const rows: LayoutRow[] = []
  let currentRow: SceneNode[] = []

  for (let i = 0; i < kids.length; i++) {
    const curr = kids[i]
    if (currentRow.length === 0) {
      currentRow.push(curr)
      continue
    }

    const prev = currentRow[currentRow.length - 1]
    const sameY = Math.abs(nY(curr) - nY(prev)) <= 14
    const totalW = currentRow.reduce((s, k) => s + k.width, 0) + curr.width + currentRow.length * SPACING.SMALL

    // Check if texts are genuinely short inline micro-copy (e.g. price + strikethrough, badge + label)
    const isShortText = (n: SceneNode): boolean => {
      if (n.type !== 'TEXT') return false
      const txt = n as TextNode
      const charLen = (txt.characters || '').trim().length
      const fSize = typeof txt.fontSize === 'number' ? txt.fontSize : 16
      return charLen <= 15 && fSize <= 15
    }

    const bothShortInlineText = isShortText(curr) && isShortText(prev)
    const iconAndText = (isIconNode(prev) && curr.type === 'TEXT' && (curr as TextNode).characters.length <= 25) ||
      (isIconNode(curr) && prev.type === 'TEXT' && (prev as TextNode).characters.length <= 25)
    const bothIcons = isIconNode(curr) && isIconNode(prev)
    const bothButtons = isButtonLike(curr) && isButtonLike(prev) && currentRow.length < 2
    const bothSmallBadges = curr.height <= 32 && prev.height <= 32 && curr.width <= contentW * 0.45 && prev.width <= contentW * 0.45

    // Can they stay on the same line?
    const bothInline =
      bothShortInlineText ||
      iconAndText ||
      bothIcons ||
      bothButtons ||
      bothSmallBadges

    if (sameY && totalW <= contentW && bothInline) {
      currentRow.push(curr)
    } else {
      rows.push({ items: currentRow, isSideBySide: currentRow.length > 1 })
      currentRow = [curr]
    }
  }

  if (currentRow.length > 0) {
    rows.push({ items: currentRow, isSideBySide: currentRow.length > 1 })
  }

  return rows
}

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
  isNestedChild = false,  // true when called from reflowNode as a child element
  parentW?: number
): Promise<number> {
  const containerW = parentW
    ? Math.min(parentW, vp.width)
    : isNestedChild ? Math.min(node.width || vp.width, vp.width) : vp.width

  if (!('children' in node)) {
    if (node.type === 'TEXT') {
      const h = await reflowTextNode(node as TextNode, containerW, vp, log)
      return h + (isNestedChild ? 0 : vp.padding * 2)
    }
    return node.height
  }

  const fr = node as FrameNode
  if ('layoutMode' in fr && fr.layoutMode !== 'NONE') fr.layoutMode = 'NONE'

  const allKids = visibleChildren(node)
  const bgNodes = allKids.filter(k => isBackgroundNode(k, fr.width, fr.height))
  const fgKids = allKids.filter(k => !isBackgroundNode(k, fr.width, fr.height))

  // Announcement bar fast-path: preserve full width, compact height, center contents with background intact
  if (isAnnouncementBar(node)) {
    const barH = Math.max(36, Math.min(node.height, 52))
    doResize(fr, vp.width, barH)
    preserveCardCornerRadius(fr, vp.width, barH)
    for (const bg of bgNodes) {
      setPos(bg, 0, 0)
      doResize(bg, vp.width, barH)
      preserveCardCornerRadius(bg, vp.width, barH)
    }
    for (const kid of fgKids) {
      if (kid.type === 'TEXT') {
        const textNode = kid as TextNode
        try {
          if (typeof textNode.fontName !== 'symbol') {
            await loadFontSafe(textNode.fontName as FontName)
          }
          textNode.textAlignHorizontal = 'CENTER'
        } catch (_) { }
        const tw = vp.width - 24
        await reflowTextNode(textNode, tw, vp)
        const ty = Math.round((barH - textNode.height) / 2)
        setPos(textNode, 12, Math.max(0, ty))
      }
    }
    log.push(`"${node.name}" [ANNOUNCEMENT_BAR]: preserved top banner (390x${barH}px)`)
    return barH
  }

  // Card detection: an inner container with visual boundaries (fills/strokes/bg) or card structure
  const isCard = isNestedChild && (
    hasVisibleFillOrStroke(fr) ||
    bgNodes.length > 0 ||
    looksLikeCard(fr)
  )

  // Card padding: if it is a card with visual boundaries, text & controls must have internal padding
  const cardPad = isCard ? 14 : 0
  const ownPaddingL = isNestedChild ? cardPad : vp.padding
  const ownPaddingR = isNestedChild ? cardPad : vp.padding
  const contentW = Math.max(10, containerW - ownPaddingL - ownPaddingR)
  const baseX = ownPaddingL

  // Sort by columns if multi-column desktop structure, or sequentially by Y
  const orderedKids = clusterKidsIntoColumns(fgKids, fr.width)
  if (orderedKids === fgKids) {
    orderedKids.sort((a, b) => {
      const dy = nY(a) - nY(b)
      if (Math.abs(dy) > 10) return dy
      return nX(a) - nX(b)
    })
  }

  // Detect original alignment of children relative to the DESKTOP container
  const alignment = detectAlignmentIntent(fgKids, fr.width)

  let localY = isCard ? cardPad : (isNestedChild ? 0 : vp.padding)

  // 1. Separate corner overlay badges inside cards (discount badge top-left, wishlist heart top-right)
  const flowKids: SceneNode[] = []
  for (const kid of orderedKids) {
    if (isDecorativeNode(kid)) {
      const decorW = Math.min(kid.width, contentW)
      const decorX = Math.max(0, Math.min(nX(kid), containerW - decorW))
      setPos(kid, decorX, Math.max(0, Math.min(nY(kid), localY)))
      continue
    }

    if (isCard) {
      const origX = nX(kid)
      const origY = nY(kid)
      const isTopLeftBadge = kid.height <= 36 && kid.width <= 140 && origX <= 40 && origY <= 40
      const isTopRightHeart = (isIconNode(kid) || (kid.height <= 36 && kid.width <= 48)) && origX >= fr.width - 60 && origY <= 40

      if (isTopLeftBadge) {
        const badgeW = Math.min(kid.width, contentW)
        try {
          (kid as any).layoutSizingHorizontal = 'HUG'
          (kid as any).layoutSizingVertical = 'HUG'
          ;(kid as any).primaryAxisSizingMode = 'AUTO'
          ;(kid as any).counterAxisSizingMode = 'AUTO'
        } catch (_) { }
        doResize(kid, badgeW, kid.height)
        if ('children' in kid) await reflowNode(kid, vp, badgeW, log, true)
        setPos(kid, 10, 10)
        continue
      }
      if (isTopRightHeart) {
        setPos(kid, containerW - kid.width - 10, 10)
        continue
      }
    }

    flowKids.push(kid)
  }

  // Helper to reflow a single flow element
  async function reflowSingleElement(kid: SceneNode, targetW: number, startX: number, y: number): Promise<number> {
    const kidAlign = getChildAlignment(kid, fr.width, alignment)

    if (kid.type === 'TEXT') {
      const textNode = kid as TextNode
      const origAlign = textNode.textAlignHorizontal
      const h = await reflowTextNode(textNode, targetW, vp, log)

      if (kidAlign === 'CENTER' || origAlign === 'CENTER') {
        try {
          if (typeof textNode.fontName !== 'symbol') {
            await loadFontSafe(textNode.fontName as FontName)
          } else {
            const rangeFont = textNode.getRangeFontName(0, 1) as FontName
            if (rangeFont) await loadFontSafe(rangeFont)
          }
          textNode.textAlignHorizontal = 'CENTER'
        } catch (_) { }
      } else if (kidAlign === 'RIGHT' || origAlign === 'RIGHT') {
        try {
          if (typeof textNode.fontName !== 'symbol') {
            await loadFontSafe(textNode.fontName as FontName)
          } else {
            const rangeFont = textNode.getRangeFontName(0, 1) as FontName
            if (rangeFont) await loadFontSafe(rangeFont)
          }
          textNode.textAlignHorizontal = 'RIGHT'
        } catch (_) { }
      } else {
        try {
          if (typeof textNode.fontName !== 'symbol') {
            await loadFontSafe(textNode.fontName as FontName)
          }
          textNode.textAlignHorizontal = origAlign === 'JUSTIFIED' ? 'JUSTIFIED' : 'LEFT'
        } catch (_) { }
      }

      setPos(textNode, startX, y)
      return Math.max(h, textNode.height)

    } else if (isButtonLike(kid)) {
      const btnW = isCard ? targetW : Math.min(Math.max(kid.width, 160), targetW)
      const btnH = isCard ? Math.min(Math.max(kid.height, 36), 44) : Math.min(Math.max(kid.height, 40), 52)
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
            } catch (_) { }
            await reflowTextNode(txt, btnW, vp)
            txt.textAutoResize = 'WIDTH_AND_HEIGHT'
            const txtY = Math.round((btnH - txt.height) / 2)
            setPos(txt, Math.max(0, Math.round((btnW - txt.width) / 2)), Math.max(0, txtY))
          }
        }
      }

      try {
        (kid as any).layoutSizingHorizontal = isCard ? 'FILL' : 'HUG'
        (kid as any).layoutSizingVertical = 'HUG'
      } catch (_) { }

      preserveCardCornerRadius(kid, btnW, btnH)
      const x = isCard ? startX : alignedX(btnW, targetW, startX, kidAlign)
      setPos(kid, x, y)
      return btnH

    } else if (isImageNode(kid)) {
      const origW = kid.width, origH = kid.height
      const rawAspect = origH / Math.max(1, origW)
      // For cards, clamp aspect ratio between 0.75 and 1.25 for clean square or apparel portrait
      const aspect = isCard ? Math.min(Math.max(rawAspect, 0.75), 1.25) : rawAspect
      const isCardImage = isCard && (origW >= fr.width * 0.70 || nY(kid) <= 12)
      const isSubstantialImg = origW >= 140 || origW >= fr.width * 0.25 || origH >= 100
      const imgW = isCardImage ? containerW : (isSubstantialImg ? targetW : Math.min(origW, targetW))
      const maxH = Math.round(vp.width * 0.90)
      const imgH = Math.min(Math.round(imgW * aspect), maxH)

      doResize(kid, imgW, imgH)
      preserveCardCornerRadius(kid, imgW, imgH)
      const x = isCardImage ? 0 : (imgW >= targetW * 0.90 ? startX : alignedX(imgW, targetW, startX, kidAlign))
      setPos(kid, x, y)
      return imgH

    } else if (isIconNode(kid)) {
      const x = alignedX(kid.width, targetW, startX, kidAlign)
      setPos(kid, x, y)
      return kid.height

    } else if ('children' in kid) {
      if (isVisualMediaComposite(kid)) {
        const mh = scaleVisualMediaComposite(kid, targetW, vp)
        setPos(kid, startX, y)
        return mh
      }

      const isBadge = isBadgeOrPillTag(kid) || (kid.height <= 36 && kid.width <= 160 && visibleChildren(kid).length <= 2)
      const targetCardW = isBadge ? Math.min(kid.width, targetW) : targetW

      if (isBadge) {
        try {
          (kid as any).layoutSizingHorizontal = 'HUG'
          (kid as any).layoutSizingVertical = 'HUG'
          (kid as any).primaryAxisSizingMode = 'AUTO'
          (kid as any).counterAxisSizingMode = 'AUTO'
        } catch (_) { }
        for (const bc of visibleChildren(kid)) {
          if (bc.type === 'TEXT') {
            (bc as TextNode).textAutoResize = 'WIDTH_AND_HEIGHT'
          }
        }
      } else {
        doResize(kid, targetCardW, kid.height)
      }

      const h = await reflowNode(kid, vp, targetCardW, log, true)
      const fgSubKids = visibleChildren(kid).filter(c => !isBackgroundNode(c, kid.width, kid.height) && !isDecorativeNode(c))
      const maxSubBottom = fgSubKids.length > 0 ? Math.max(...fgSubKids.map(c => nY(c) + c.height)) : 0
      const actualH = isBadge ? Math.max(h, kid.height) : Math.max(h, maxSubBottom + (isCard ? 14 : 0), 20)

      if (!isBadge) {
        doResize(kid, targetCardW, actualH)
      } else {
        try {
          (kid as any).layoutSizingHorizontal = 'HUG'
          (kid as any).layoutSizingVertical = 'HUG'
          ;(kid as any).primaryAxisSizingMode = 'AUTO'
          ;(kid as any).counterAxisSizingMode = 'AUTO'
        } catch (_) { }
      }
      preserveCardCornerRadius(kid, targetCardW, actualH)

      const x = isBadge ? alignedX(targetCardW, targetW, startX, kidAlign) : startX
      setPos(kid, x, y)
      return actualH

    } else {
      const isDivider = kid.height <= 4 && kid.width >= fr.width * 0.50
      const w = isDivider ? targetW : Math.min(kid.width, targetW)
      doResize(kid, w, kid.height)
      const x = isDivider ? startX : alignedX(w, targetW, startX, kidAlign)
      setPos(kid, x, y)
      return kid.height
    }
  }

  // 2. Group items into layout rows (detecting side-by-side elements like prices, ratings, or dual buttons)
  const rows = groupIntoLayoutRows(flowKids, contentW, fr.width)

  for (const row of rows) {
    if (row.isSideBySide && row.items.length >= 2) {
      // Side-by-side row: place items horizontally on the same line
      const allButtons = row.items.every(k => isButtonLike(k))
      const btnW = allButtons
        ? Math.floor((contentW - (row.items.length - 1) * SPACING.SMALL) / row.items.length)
        : 0

      let curX = baseX
      let maxRowH = 0

      for (let idx = 0; idx < row.items.length; idx++) {
        const item = row.items[idx]
        const itemW = allButtons ? btnW : Math.min(item.width, contentW - (curX - baseX))
        const h = await reflowSingleElement(item, itemW, curX, localY)
        maxRowH = Math.max(maxRowH, h, item.height)
        curX += (allButtons ? btnW : item.width) + SPACING.SMALL
      }

      localY += maxRowH + (isCard ? 6 : SPACING.NORMAL)
    } else {
      // Single element in row
      const singleItem = row.items[0]
      const h = await reflowSingleElement(singleItem, contentW, baseX, localY)
      const isImage = isImageNode(singleItem)
      const gapAfter = isCard ? (isImage ? 8 : (looksLikeCard(singleItem) ? 14 : 6)) : (looksLikeCard(singleItem) ? 20 : SPACING.NORMAL)
      localY += h + gapAfter
    }
  }

  const finalH = localY + (isCard ? cardPad : (isNestedChild ? 0 : vp.padding))
  const finalContainerW = isNestedChild ? containerW : vp.width
  doResize(fr, finalContainerW, finalH)
  preserveCardCornerRadius(fr, finalContainerW, finalH)

  for (const bg of bgNodes) {
    setPos(bg, 0, 0)
    doResize(bg, finalContainerW, finalH)
    preserveCardCornerRadius(bg, finalContainerW, finalH)
    try { fr.insertChild(0, bg) } catch (_) { }
  }

  log.push(`"${node.name}" [SINGLE_COLUMN|${alignment}]: ${fgKids.length} items stacked (${finalH}px, nested=${isNestedChild}, card=${isCard})`)
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

  if (isImageNode(node)) {
    const origW = Math.max(1, node.width)
    const origH = Math.max(1, node.height)
    const aspect = origH / origW
    const w = Math.min(origW, parentW)
    const maxH = Math.round(vp.width * 0.85)
    const h = Math.min(Math.round(w * aspect), maxH)
    doResize(node, w, h)
    preserveCardCornerRadius(node, w, h)
    return h
  }

  // Visual Media Composite (Mockup devices, product showcases, illustrations)
  if (isVisualMediaComposite(node)) {
    const h = scaleVisualMediaComposite(node, parentW, vp)
    if (log) log.push(`"${node.name}" [VISUAL_COMPOSITE]: scaled proportionally to ${node.width}×${h}px`)
    return h
  }

  if (!('children' in node)) {
    // Non-container, non-text: resize to fit
    const isDivider = node.height <= 4 && node.width >= parentW * 0.40
    const w = isDivider ? parentW : Math.min(node.width, parentW)
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

    case 'FOOTER':
      return transformFooterLayout(node, vp, log, parentW)

    case 'TABLE':
      return transformTableNode(node, vp, log)

    case 'REPEATED_COLLECTION':
      return transformRepeatedCollection(node, vp, log, parentW)

    case 'HORIZONTAL_GROUP':
      return transformHorizontalGroup(node, vp, log, parentW)

    case 'SINGLE_COLUMN':
    default:
      // Pass asChild=true when called recursively so double-padding is avoided
      return transformSingleColumn(node, vp, log, asChild, parentW)
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
    // An announcement bar sits flush against the navigation bar directly below it (gap = 0)
    const gap = (i === 1 && isAnnouncementBar(prev)) ? 0 : SPACING.SECTION
    const expectedY = prevBottom + gap
    const curY = nY(cur)

    if (curY !== expectedY || nX(cur) !== 0) {
      setPos(cur, 0, expectedY)
      adjustedCount++
      log.push(`[SPACE] "${cur.name}" positioned at Y=${expectedY}px (gap=${gap}px)`)
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
    if (!isValidFigmaNode(frame)) return
    if (!('children' in frame)) return

    const fgKids = safeChildren(frame).filter(
      c => !isBackgroundNode(c, frame.width, frame.height)
    )
    if (fgKids.length === 0) return

    const flowKids = fgKids.filter(c => !isDecorativeNode(c))
    if (flowKids.length === 0) return

    const minY = Math.min(...flowKids.map(c => nY(c)))
    if (minY < -4) {
      const shiftY = Math.abs(minY) + 8
      for (const c of flowKids) setPos(c, nX(c), nY(c) + shiftY)
      fixCount++
    }

    if (frame !== clone) {
      const maxChildBottom = Math.max(...flowKids.map(c => nY(c) + c.height))
      if (maxChildBottom > frame.height + 40) {
        const newH = Math.min(maxChildBottom + 16, 2500)
        doResize(frame, frame.width, newH)
        for (const c of safeAllChildren(frame)) {
          if (isBackgroundNode(c, frame.width, newH)) {
            setPos(c, 0, 0)
            doResize(c, frame.width, newH)
          }
        }
        fixCount++
      }
    }

    // Do NOT recurse into INSTANCE sublayers
    if (frame.type === 'INSTANCE') return

    for (const c of safeChildren(frame)) {
      if ('children' in c && (c.type === 'FRAME' || c.type === 'GROUP')) {
        inspectFrame(c as FrameNode)
      }
    }
  }

  try {
    inspectFrame(clone)
  } catch (_) { }
  if (fixCount > 0) log.push(`Off-frame audit: ${fixCount} containers adjusted`)
}

// ============================================================
// FINAL LAYOUT CLAMP & VALIDATION
// ============================================================

function validateAndClampLayout(clone: FrameNode, vp: RVP, log: string[]): void {
  let clampCount = 0

  function checkNode(node: SceneNode, maxW: number): void {
    if (!isNodeValidAndVisible(node)) return
    try {
      let x = nX(node)
      let w = node.width

      // Text nodes must be managed via reflowTextNode, never squashed via doResize!
      if (node.type === 'TEXT') {
        if (x < 0) { setPos(node, 0, nY(node)); clampCount++ }
        if (x >= maxW) { setPos(node, vp.padding, nY(node)); clampCount++ }
        if (node.width > maxW || x + node.width > maxW + 4) {
          const availW = Math.max(40, maxW - nX(node))
          reflowTextNode(node as TextNode, availW, vp)
          clampCount++
        }
        return
      }

      // 1. Negative X: move to 0
      if (x < 0) {
        setPos(node, 0, nY(node))
        x = 0
        clampCount++
      }

      // 2. Off-canvas to the right: node is completely outside the parent frame (e.g. desktop x=900)
      if (x >= maxW) {
        const targetX = isBackgroundNode(node, maxW, node.height) ? 0 : vp.padding
        setPos(node, targetX, nY(node))
        x = targetX
        clampCount++
      }

      // 3. Node width exceeds container width
      if (w > maxW) {
        const newW = maxW
        doResize(node, newW, node.height)
        w = newW
        setPos(node, 0, nY(node))
        x = 0
        clampCount++
      }

      // 4. Node overflows the right edge: x + w > maxW
      if (x + w > maxW + 4) {
        if (w <= maxW) {
          const shiftX = Math.max(0, maxW - w)
          setPos(node, shiftX, nY(node))
          x = shiftX
        } else {
          const allowedW = maxW - x
          if (allowedW < 60) {
            setPos(node, 0, nY(node))
            x = 0
            doResize(node, maxW, node.height)
            w = maxW
          } else {
            doResize(node, allowedW, node.height)
            w = allowedW
          }
        }
        clampCount++
      }

      // Do NOT recurse into INSTANCE sublayers — their internals cannot be individually clamped
      if (node.type === 'INSTANCE') return

      if ('children' in node) {
        for (const c of safeChildren(node)) {
          checkNode(c, node.width)
        }
      }
    } catch (_) { }
  }

  try {
    for (const c of safeChildren(clone)) {
      checkNode(c, vp.width)
    }
  } catch (_) { }

  if (clampCount > 0) {
    log.push(`Validation: ${clampCount} elements reflowed & clamped to mobile viewport`)
  }
}

// ============================================================
// SCREEN ARCHETYPE SYSTEM
// ============================================================

export type ScreenArchetype =
  | 'MODAL_DIALOG'
  | 'APP_DASHBOARD'
  | 'E_COMMERCE'
  | 'DATA_TABLE_ADMIN'
  | 'EDITORIAL_GALLERY'
  | 'LANDING_PAGE'

export function detectScreenArchetype(
  root: FrameNode,
  origW: number,
  origH: number
): ScreenArchetype {
  const name = (root.name || '').toLowerCase()
  const kids = visibleChildren(root)

  // 1. MODAL / DIALOG CHECK
  const isDialogName = /(modal|dialog|popup|alert|prompt|sheet|auth|login|signup|signin|register|confirm|subscribe)/i.test(name)
  const isCompactSize = origW <= 640 && origH <= 800
  const hasCloseButton = kids.some(k => /(close|dismiss|cancel|x\b)/i.test(k.name || ''))
  if ((isCompactSize && (isDialogName || hasCloseButton)) || (isDialogName && origW <= 768)) {
    return 'MODAL_DIALOG'
  }

  // 2. DATA TABLE CHECK (Higher precedence than generic "admin")
  const isTableName = /(table|records|grid|datatable|spreadsheet|invoices|transactions|users-list)/i.test(name)
  const hasTableNode = kids.some(k => detectTableStructure(k)) || detectTableStructure(root)
  if (isTableName || hasTableNode) {
    return 'DATA_TABLE_ADMIN'
  }

  // 3. E-COMMERCE CHECK
  const allSubKids = kids.flatMap(k => 'children' in k ? visibleChildren(k) : [k])
  const isEcommerceName = /(shop|store|product|catalog|cart|checkout|ecommerce|market|clothing|shoes|apparel|sneakers)/i.test(name)
  const productCards = allSubKids.filter(c => isProductCard(c))
  if (isEcommerceName || productCards.length >= 2) {
    return 'E_COMMERCE'
  }

  // 4. APP DASHBOARD CHECK
  const isDashboardName = /(dash|analytics|portal|overview|console|crm|metrics|admin)/i.test(name)
  const sidebarInfo = detectSidebarLayout(kids, origW, origH)
  const metricCards = allSubKids.filter(c => isMetricCard(c))
  if (sidebarInfo.hasSidebar || isDashboardName || metricCards.length >= 3) {
    return 'APP_DASHBOARD'
  }

  // 5. EDITORIAL / PHOTO GALLERY CHECK
  const isGalleryName = /(gallery|portfolio|lookbook|editorial|photos|photography|album|case-study)/i.test(name)
  const imageNodes = allSubKids.filter(c => isImageNode(c))
  if (isGalleryName || imageNodes.length >= 5) {
    return 'EDITORIAL_GALLERY'
  }

  return 'LANDING_PAGE'
}

// ============================================================
// VISUAL BAND SYNTHESIZER
// ============================================================

export function synthesizeVisualBands(
  root: FrameNode,
  origW: number,
  origH: number,
  log: string[]
): void {
  const kids = visibleChildren(root)
  if (kids.length < 8) return

  // Check if children are already organized into section frames
  const sectionContainers = kids.filter(k => (k.type === 'FRAME' || k.type === 'GROUP' || k.type === 'SECTION') && k.height >= 40)
  if (sectionContainers.length >= 3) {
    return
  }

  const fullWidthSections = kids.filter(k => k.width >= origW * 0.70)
  if (fullWidthSections.length >= kids.length * 0.40) {
    return
  }

  // Separate canvas-level backgrounds
  const contentKids: SceneNode[] = []
  for (const k of kids) {
    if (isBackgroundNode(k, origW, origH) || (k.width >= origW * 0.85 && k.height >= origH * 0.85)) {
      continue
    }
    contentKids.push(k)
  }

  if (contentKids.length < 8) return

  contentKids.sort((a, b) => {
    const dy = nY(a) - nY(b)
    if (Math.abs(dy) > 12) return dy
    return nX(a) - nX(b)
  })

  interface BandCluster {
    minY: number
    maxY: number
    nodes: SceneNode[]
  }

  const clusters: BandCluster[] = []
  let curCluster: BandCluster | null = null

  for (const node of contentKids) {
    const y1 = nY(node)
    const y2 = y1 + node.height

    if (!curCluster) {
      curCluster = { minY: y1, maxY: y2, nodes: [node] }
      clusters.push(curCluster)
    } else {
      const gap = y1 - curCluster.maxY
      const curSpan = curCluster.maxY - curCluster.minY
      if ((gap <= 40 || y1 <= curCluster.maxY) && (curSpan < 950 || gap <= 16)) {
        curCluster.maxY = Math.max(curCluster.maxY, y2)
        curCluster.nodes.push(node)
      } else {
        curCluster = { minY: y1, maxY: y2, nodes: [node] }
        clusters.push(curCluster)
      }
    }
  }

  if (clusters.length <= 1 || clusters.every(c => c.nodes.length === 1)) {
    return
  }

  log.push(`[SYNTHESIZER]: Clustered ${contentKids.length} loose layers into ${clusters.length} section bands`)

  let bandIdx = 1
  for (const cluster of clusters) {
    if (cluster.nodes.length === 1 && cluster.nodes[0].width >= origW * 0.70) {
      continue
    }

    try {
      const bandFrame = figma.createFrame()
      const hasNav = cluster.nodes.some(n => isLikelyBrandElement(n) || isNavItemCandidate(n))
      const hasCard = cluster.nodes.some(n => looksLikeCard(n))
      const hasHeading = cluster.nodes.some(n => n.type === 'TEXT' && n.width >= origW * 0.35)

      let bandName = `Section Band ${bandIdx++}`
      if (hasNav && cluster.minY <= origH * 0.20) bandName = 'Header Section'
      else if (hasCard) bandName = 'Feature Cards Section'
      else if (hasHeading && cluster.minY <= origH * 0.45) bandName = 'Hero Section'
      else if (cluster.minY >= origH * 0.75) bandName = 'Footer Section'

      bandFrame.name = bandName
      const bW = origW
      const bH = Math.max(30, cluster.maxY - cluster.minY)
      bandFrame.resize(bW, bH)
      bandFrame.layoutMode = 'NONE'
      bandFrame.clipsContent = false

      for (const node of cluster.nodes) {
        const relX = nX(node)
        const relY = nY(node) - cluster.minY
        bandFrame.appendChild(node)
        setPos(node, relX, relY)
      }

      root.appendChild(bandFrame)
      setPos(bandFrame, 0, cluster.minY)
    } catch (e) {
      console.warn('[SynthesizeBands] Failed to wrap cluster:', e)
    }
  }
}

// ============================================================
// TRANSFORMER: MODAL / DIALOG
// ============================================================

async function transformModalDialog(
  root: FrameNode,
  vp: RVP,
  log: string[]
): Promise<void> {
  log.push(`[MODAL_DIALOG]: Reflowing compact modal/dialog layout`)

  if ('layoutMode' in root && root.layoutMode !== 'NONE') {
    root.layoutMode = 'NONE'
  }

  const kids = visibleChildren(root)
  const bgNodes = kids.filter(k => isBackgroundNode(k, root.width, root.height))
  const fgKids = kids.filter(k => !isBackgroundNode(k, root.width, root.height))

  const dialogMargin = vp.width <= 340 ? 12 : 20
  const targetModalW = Math.min(vp.width - dialogMargin * 2, 360)
  const contentW = targetModalW - vp.padding * 2

  let localY = vp.padding

  fgKids.sort((a, b) => nY(a) - nY(b))

  for (const kid of fgKids) {
    if (/(close|dismiss|cancel|x\b)/i.test(kid.name || '') && kid.width <= 36 && kid.height <= 36) {
      setPos(kid, targetModalW - kid.width - 16, 16)
      continue
    }

    if (kid.type === 'TEXT') {
      const txt = kid as TextNode
      await reflowTextNode(txt, contentW, vp, log)
      setPos(txt, vp.padding, localY)
      localY += txt.height + SPACING.SMALL
    } else if (isButtonLike(kid)) {
      const btnW = contentW
      const btnH = Math.min(Math.max(kid.height, 40), 48)
      doResize(kid, btnW, btnH)
      preserveCardCornerRadius(kid, btnW, btnH)
      if ('children' in kid) {
        for (const bc of visibleChildren(kid)) {
          if (bc.type === 'TEXT') {
            await reflowTextNode(bc as TextNode, btnW, vp)
            setPos(bc, 0, Math.round((btnH - bc.height) / 2))
          }
        }
      }
      setPos(kid, vp.padding, localY)
      localY += btnH + SPACING.NORMAL
    } else if ('children' in kid) {
      const fieldW = contentW
      doResize(kid, fieldW, kid.height)
      const h = await reflowNode(kid, vp, fieldW, log, true)
      const actualH = Math.max(h, kid.height)
      doResize(kid, fieldW, actualH)
      preserveCardCornerRadius(kid, fieldW, actualH)
      setPos(kid, vp.padding, localY)
      localY += actualH + SPACING.NORMAL
    } else {
      const w = Math.min(kid.width, contentW)
      doResize(kid, w, kid.height)
      setPos(kid, vp.padding, localY)
      localY += kid.height + SPACING.SMALL
    }
  }

  const finalModalH = localY + vp.padding
  const canvasH = Math.max(finalModalH + 48, vp.height <= 600 ? finalModalH + 24 : Math.min(vp.height, finalModalH + 64))

  root.resize(vp.width, canvasH)

  const modalLeft = Math.round((vp.width - targetModalW) / 2)
  const modalTop = Math.round((canvasH - finalModalH) / 2)

  for (const kid of fgKids) {
    setPos(kid, modalLeft + nX(kid), modalTop + nY(kid))
  }

  for (const bg of bgNodes) {
    setPos(bg, 0, 0)
    doResize(bg, vp.width, canvasH)
    try { root.insertChild(0, bg) } catch (_) { }
  }

  log.push(`[MODAL_DIALOG]: Dialog ${targetModalW}×${finalModalH}px centered on canvas ${vp.width}×${canvasH}px`)
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

  // ---- PRE-STAGE 0: Detach component instances in the cloned copy ----
  // The clone is an independent mobile artboard. Detaching instances converts
  // component instances into mutable frames, preventing Figma "This property cannot be overridden in an instance: relative-transform"
  // errors when modifying layouts, positions, and hierarchies.
  try {
    detachInstancesRecursively(clone)
  } catch (e) {
    console.warn('[ResponsiveEngine] Instance detachment warning:', e)
  }

  const origW = clone.width
  const origH = clone.height

  log.push(`Target Viewport: ${vp.name} (${vp.width}×${vp.height}px)`)
  log.push(`Engine: Generic Structure-Aware Responsive Engine V9`)

  // ---- PRE-STAGE: Screen Archetype Detection ----
  const archetype = detectScreenArchetype(clone, origW, origH)
  log.push(`Screen Archetype: ${archetype}`)

  // Fast-path: MODAL / AUTH DIALOG
  if (archetype === 'MODAL_DIALOG') {
    await transformModalDialog(clone, vp, log)
    return
  }

  // ---- STAGE 1: Normalize root frame ----
  // If the root frame uses Auto Layout, normalize child positions and remove it.
  if ('layoutMode' in clone && clone.layoutMode !== 'NONE') {
    const isVertical = clone.layoutMode === 'VERTICAL'
    const padT = clone.paddingTop || 0
    const padL = clone.paddingLeft || 0
    const spacing = clone.itemSpacing || 0
    const kids = safeChildren(clone)

    // Normalize constraints FIRST so turning off AL or resizing doesn't displace nodes
    for (const c of kids) {
      try { (c as any).constraints = { horizontal: 'MIN', vertical: 'MIN' } } catch (_) {}
    }

    clone.layoutMode = 'NONE'

    if (isVertical) {
      // In VERTICAL Auto Layout, kids array is ALREADY the natural top-to-bottom visual sequence
      let curY = padT
      for (const c of kids) {
        setPos(c, padL, curY)
        curY += c.height + spacing
      }
    } else {
      let curX = padL
      for (const c of kids) {
        setPos(c, curX, padT)
        curX += c.width + spacing
      }
    }
    log.push(`Root frame Auto Layout normalized to free positioning`)
  } else {
    // For free-positioned frames, normalize constraints to MIN/MIN
    // so clone.resize(vp.width, origH) doesn't cause Figma to move/scale children
    const kids = safeChildren(clone)
    for (const c of kids) {
      try { (c as any).constraints = { horizontal: 'MIN', vertical: 'MIN' } } catch (_) {}
    }
  }

  // ---- STAGE 1.5: Visual Band Synthesizer for loose layers ----
  synthesizeVisualBands(clone, origW, origH, log)

  // Set root width to target mobile width
  clone.resize(vp.width, origH)
  clone.clipsContent = false

  // ---- STAGE 2: Get top-level visible sections ----
  const topLevelKids = safeChildren(clone)
    .sort((a, b) => {
      const dy = nY(a) - nY(b)
      if (Math.abs(dy) > 2) return dy
      return nX(a) - nX(b)
    })

  if (topLevelKids.length === 0) {
    log.push(`No visible top-level children. Nothing to reflow.`)
    return
  }

  // ---- STAGE 2.5: Absorb loose section background shapes into overlying content frames ----
  // Designers often draw full-width background rectangles (e.g. dark footer bg) as loose siblings
  // on the canvas behind the content frame. Pair them up so the section keeps its background on mobile.
  const absorbedNodes = new Set<SceneNode>()
  for (let i = 0; i < topLevelKids.length; i++) {
    const sec = topLevelKids[i]
    if (!isValidFigmaNode(sec) || absorbedNodes.has(sec)) continue

    for (let j = 0; j < topLevelKids.length; j++) {
      if (i === j) continue
      const candidate = topLevelKids[j]
      if (!isValidFigmaNode(candidate) || absorbedNodes.has(candidate)) continue

      const isShape = candidate.type === 'RECTANGLE' || candidate.type === 'VECTOR' ||
        (candidate.type === 'FRAME' && (!('children' in candidate) || visibleChildren(candidate).length === 0))
      const hasFill = hasVisibleFillOrStroke(candidate)
      const hasText = hasTextContent(candidate)
      const isWide = candidate.width >= origW * 0.70

      if (isShape && hasFill && !hasText && isWide) {
        const candY1 = nY(candidate)
        const candY2 = candY1 + candidate.height
        const secY1 = nY(sec)
        const secY2 = secY1 + sec.height

        const overlapY = Math.max(0, Math.min(candY2, secY2) - Math.max(candY1, secY1))
        if (overlapY >= Math.min(candidate.height * 0.50, sec.height * 0.50)) {
          if ('children' in sec && 'insertChild' in sec) {
            try {
              ;(sec as FrameNode).insertChild(0, candidate)
              setPos(candidate, 0, 0)
              doResize(candidate, sec.width, sec.height)
              absorbedNodes.add(candidate)
              log.push(`Absorbed background "${candidate.name}" into section "${sec.name}"`)
            } catch (_) {
              if ('fills' in sec && 'fills' in candidate) {
                try {
                  ;(sec as any).fills = (candidate as any).fills
                  absorbedNodes.add(candidate)
                  candidate.remove()
                } catch (_) {}
              }
            }
          } else if ('fills' in sec && 'fills' in candidate) {
            try {
              ;(sec as any).fills = (candidate as any).fills
              absorbedNodes.add(candidate)
              candidate.remove()
            } catch (_) {}
          }
        }
      }
    }
  }

  const liveTopSections = topLevelKids.filter(k => !absorbedNodes.has(k) && isValidFigmaNode(k))
  log.push(`Top-level sections: ${liveTopSections.length}`)

  // ---- STAGE 3: Detect sidebar layout at the page level ----
  const sidebarResult = (archetype === 'LANDING_PAGE' || archetype === 'E_COMMERCE')
    ? { hasSidebar: false, sidebarNode: null, mainContentNodes: liveTopSections }
    : detectSidebarLayout(liveTopSections, origW, origH)

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

    for (let i = 0; i < liveTopSections.length; i++) {
      let section = liveTopSections[i]
      if (!isValidFigmaNode(section)) continue

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
          const navRes = await transformNavigationNode(section, vp, log)
          sectionH = navRes.height
          activeSection = navRes.activeNode
          liveTopSections[i] = activeSection
          hasNavTransformed = true
          break
        }
        case 'FOOTER':
          sectionH = await transformFooterLayout(section, vp, log, vp.width)
          break
        case 'TABLE':
          sectionH = await transformTableNode(section, vp, log)
          break
        case 'REPEATED_COLLECTION':
          sectionH = await transformRepeatedCollection(section, vp, log, vp.width)
          break
        case 'HORIZONTAL_GROUP':
          sectionH = await transformHorizontalGroup(section, vp, log, vp.width)
          break
        case 'SINGLE_COLUMN':
        default:
          sectionH = await transformSingleColumn(section, vp, log, false, vp.width)
          break
      }

      // Safety: wrap section height to fit its flow children (ignore specialized navigation/footer and decorative nodes)
      if (strategy !== 'NAVIGATION' && strategy !== 'FOOTER' && isValidFigmaNode(activeSection) && 'children' in activeSection) {
        const fr = activeSection as FrameNode
        const flowKids = safeChildren(fr).filter(
          c => !isBackgroundNode(c, fr.width, fr.height) && !isBackgroundNode(c, origW, origH) && !isDecorativeNode(c)
        )
        if (flowKids.length > 0) {
          const maxChildBottom = Math.max(...flowKids.map(c => nY(c) + c.height))
          const minPad = isAnnouncementBar(fr) ? 0 : 16
          const contentDrivenH = Math.max(maxChildBottom + minPad, 24)
          sectionH = contentDrivenH
          doResize(fr, vp.width, sectionH)
          preserveCardCornerRadius(fr, vp.width, sectionH)
          for (const bg of safeAllChildren(fr)) {
            if (isBackgroundNode(bg, fr.width, fr.height) || isBackgroundNode(bg, origW, origH)) {
              setPos(bg, 0, 0)
              doResize(bg, vp.width, sectionH)
              preserveCardCornerRadius(bg, vp.width, sectionH)
              try { fr.insertChild(0, bg) } catch (_) { }
            }
          }
        }
      }

      const finalH = isValidFigmaNode(activeSection) ? activeSection.height : sectionH
      const gap = (i === 0 && isAnnouncementBar(activeSection)) ? 0 : SPACING.SECTION
      currentY = (isValidFigmaNode(activeSection) ? nY(activeSection) : currentY) + finalH + gap
    }

    // ---- STAGE 5: Off-frame safety audit ----
    auditAndFixOffFrameContent(clone, log)

    // ---- STAGE 6: Overlap & Spacing Alignment ----
    const liveTopLevelKids = liveTopSections.filter(k => isNodeValidAndVisible(k))
    verifyAndCorrectSectionOverlaps(liveTopLevelKids, log)
  }

  // ---- STAGE 7: Content-driven final frame height ----
  const allTop = safeChildren(clone)
    .sort((a, b) => nY(a) - nY(b))

  const lastSection = allTop[allTop.length - 1]
  const finalPageHeight = lastSection
    ? nY(lastSection) + lastSection.height
    : origH

  clone.resize(vp.width, finalPageHeight)
  clone.clipsContent = false

  log.push(`Canvas: ${origW}×${origH}px → ${vp.width}×${finalPageHeight}px`)

  // ---- STAGE 8: Final clamp & validation ----
  validateAndClampLayout(clone, vp, log)
}
