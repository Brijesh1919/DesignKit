// ============================================================
// responsiveEngine.ts — Section-Aware Responsive Engine
// DesignKit Figma Plugin
//
// Core Philosophy:
//   READ DESIGN → TOP-LEVEL SECTION MANIFEST (INDEPENDENT SECTIONS) →
//   DEFAULT TO 1-COLUMN (FULL WIDTH) FOR EVERYTHING.
//   ONLY GENUINE REPEATED PRODUCT CARDS USE 2 COLUMNS.
//
//   • NAVBAR: Dedicated Mobile Header Rebuild (☰ + Logo + Utility Actions, 100% Contained)
//   • HERO / INTRO / TEXT / MEDIA+TEXT / CTA / PROMO: 1-Column Full Width Stack (350px)
//   • CARD_GRID: 2-Column ONLY for genuine repeated compact product cards (4+ items with image+price)
//   • FOOTER: Preserved 2-column link grid at page bottom
//
//   STAGE B: SEQUENTIAL PAGE FLOW POSITIONING (SINGLE SOURCE OF TRUTH) →
//   STAGE C: HARD OVERLAP DETECTION & CORRECTION →
//   STAGE D: RECURSIVE OFF-FRAME SAFETY AUDIT & NATURAL PAGE HEIGHT
//
// ZERO proportional scaling (no child.x *= scale).
// ============================================================

// ---- Spacing Tokens ----

export const SPACING = {
  MICRO: 4,     // Between icon & label, badge & title
  SMALL: 8,     // Between heading & subheading, price & title, link to link
  NORMAL: 14,   // Between description & CTA, related elements in a group
  MEDIUM: 20,   // Between distinct content groups inside a section
  SECTION: 28,  // Between major sections on mobile (34px on tablet, 40px on laptop)
}

// ---- Viewport Definitions ----

export interface RVP {
  width: number
  height: number
  name: string
  padding: number              // Horizontal page padding (20px for mobile)
  colGap: number               // Gap between columns in grids (12px for mobile)
  rowGap: number               // Gap between stacked sections (28px for mobile)
  navH: number                 // Target navbar height (56px for mobile)
  defaultCardCols: number      // Default card columns at this viewport
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

// ---- Geometry & Node Helpers ----

function nX(n: SceneNode): number { return 'x' in n ? (n as any).x as number : 0 }
function nY(n: SceneNode): number { return 'y' in n ? (n as any).y as number : 0 }

function setPos(n: SceneNode, x: number, y: number): void {
  if ('x' in n) (n as any).x = Math.round(x)
  if ('y' in n) (n as any).y = Math.round(y)
}

function doResize(n: SceneNode, w: number, h: number): void {
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
  const name = (n.name || '').toLowerCase()
  if (name.includes('button') || name.includes('btn') || name.includes('cta') || name.includes('subscribe')) return true
  if ((n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE' || n.type === 'GROUP') &&
      n.height >= 28 && n.height <= 64 && n.width >= 40 && n.width <= 320) {
    if ('children' in n) {
      const texts = (n as ChildrenMixin).children.filter(c => c.type === 'TEXT')
      if (texts.length === 1) return true
    }
  }
  return false
}

function isIconNode(n: SceneNode): boolean {
  return (n.width <= 48 && n.height <= 48) && (n.type === 'VECTOR' || n.type === 'FRAME' || n.type === 'GROUP' || n.type === 'INSTANCE')
}

// ---- Font Loading Cache ----

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

// ---- Text Reflow & Dynamic Height ----

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

// ---- Container Internals Reflow (Normalized Padding) ----

async function reflowContainerInternals(
  container: SceneNode,
  targetWidth: number,
  vp: RVP,
  log: string[]
): Promise<number> {
  if (!('children' in container)) return container.height
  const fr = container as FrameNode
  const children = [...fr.children]
  if (children.length === 0) return container.height

  for (const c of children) {
    if (c.visible === false && (c.type === 'TEXT' || isButtonLike(c) || isImageNode(c))) {
      c.visible = true
    }
  }

  // Auto Layout Container Handling
  if ('layoutMode' in fr && fr.layoutMode !== 'NONE') {
    if (fr.layoutMode === 'HORIZONTAL' && vp.width < 768) {
      const totalChildW = children.reduce((s, c) => s + c.width, 0)
      if (totalChildW > targetWidth) {
        fr.layoutMode = 'VERTICAL'
        fr.itemSpacing = SPACING.SMALL
      }
    }
    const padL = fr.paddingLeft || 0
    const padR = fr.paddingRight || 0
    const availInnerW = Math.max(1, targetWidth - (padL + padR))
    for (const c of children) {
      if (c.type === 'TEXT') {
        await reflowTextNode(c as TextNode, availInnerW, vp, log)
      } else if ('children' in c) {
        await reflowContainerInternals(c, availInnerW, vp, log)
      }
    }
    return fr.height
  }

  // Non-Auto Layout Container: Content-Driven Vertical Flow (1 Column)
  const hasCardStyling = hasVisibleFillOrStroke(fr)
  const innerPad = hasCardStyling ? (targetWidth < 200 ? 8 : 12) : 0
  const innerContentW = Math.max(1, targetWidth - innerPad * 2)

  const sorted = [...children].sort((a, b) => {
    const dy = nY(a) - nY(b)
    if (Math.abs(dy) > 10) return dy
    return nX(a) - nX(b)
  })

  const bgNodes: SceneNode[] = []
  const fgNodes: SceneNode[] = []

  for (const c of sorted) {
    if (isBackgroundNode(c, container.width, container.height)) {
      bgNodes.push(c)
    } else {
      fgNodes.push(c)
    }
  }

  let localY = innerPad

  for (let i = 0; i < fgNodes.length; i++) {
    const node = fgNodes[i]

    if (node.type === 'TEXT') {
      const txt = node as TextNode
      setPos(txt, innerPad, localY)
      const h = await reflowTextNode(txt, innerContentW, vp, log)
      localY += h + SPACING.SMALL
    } else if (isImageNode(node)) {
      const origW = node.width, origH = node.height
      const aspect = origH / Math.max(1, origW)
      const maxImgH = targetWidth < 200 ? 140 : Math.min(230, Math.round(innerContentW * aspect))
      const imgH = Math.min(Math.round(innerContentW * aspect), maxImgH)
      setPos(node, innerPad, localY)
      doResize(node, innerContentW, imgH)
      localY += imgH + SPACING.SMALL
    } else if (isButtonLike(node)) {
      setPos(node, innerPad, localY)
      const btnW = Math.min(node.width, innerContentW)
      doResize(node, btnW, Math.min(node.height, 44))
      if ('children' in node) {
        for (const bc of (node as ChildrenMixin).children) {
          if (bc.type === 'TEXT') await reflowTextNode(bc as TextNode, btnW, vp)
        }
      }
      localY += Math.min(node.height, 44) + SPACING.SMALL
    } else if (isIconNode(node)) {
      setPos(node, innerPad, localY)
      localY += node.height + SPACING.MICRO
    } else if ('children' in node) {
      setPos(node, innerPad, localY)
      doResize(node, innerContentW, node.height)
      const subH = await reflowContainerInternals(node, innerContentW, vp, log)
      localY += subH + SPACING.SMALL
    } else {
      const w = Math.min(node.width, innerContentW)
      setPos(node, innerPad, localY)
      doResize(node, w, node.height)
      localY += node.height + SPACING.SMALL
    }
  }

  const finalContainerH = localY + innerPad
  doResize(container, targetWidth, finalContainerH)

  for (const bg of bgNodes) {
    setPos(bg, 0, 0)
    doResize(bg, targetWidth, finalContainerH)
  }

  return finalContainerH
}

// ---- Section Manifest & Classification ----

export type SectionType =
  | 'NAVBAR'
  | 'HERO'
  | 'SINGLE_COLUMN'
  | 'CARD_GRID'
  | 'FOOTER'

export interface SectionManifest {
  node: SceneNode
  originalIndex: number
  type: SectionType
}

/**
 * Detects if a node is genuinely a repeated product card collection.
 * Requirements:
 * - 4 or more sibling child frames/groups with similar structure
 * - Each child frame contains an image AND (price, title, or button)
 * - Cards are compact (not text-heavy articles)
 */
function isRepeatedProductCards(node: SceneNode): boolean {
  if (!('children' in node)) return false
  const fr = node as FrameNode
  const kids = fr.children.filter(c => c.visible !== false && !isBackgroundNode(c, fr.width, fr.height))

  if (kids.length < 4) return false

  let productCardCount = 0
  for (const k of kids) {
    if (k.type === 'FRAME' || k.type === 'GROUP' || k.type === 'INSTANCE' || k.type === 'COMPONENT') {
      const subKids = 'children' in k ? (k as ChildrenMixin).children : []
      const hasImg = subKids.some(s => isImageNode(s)) || isImageNode(k)
      const hasTxt = subKids.some(s => s.type === 'TEXT')
      if (hasImg && hasTxt) {
        productCardCount++
      }
    }
  }

  return productCardCount >= 4
}

function classifyTopLevelNode(
  node: SceneNode,
  idx: number,
  total: number,
  origW: number,
  origH: number
): SectionType {
  const relY = nY(node) / Math.max(1, origH)
  const nameLower = (node.name || '').toLowerCase()

  // 1. NAVBAR
  if (idx === 0 && relY < 0.15) return 'NAVBAR'
  if (nameLower.includes('nav') || nameLower.includes('header') || nameLower.includes('menu') || nameLower.includes('topbar')) return 'NAVBAR'

  // 2. FOOTER
  if (nameLower.includes('footer') || (idx === total - 1 && relY > 0.60)) return 'FOOTER'

  // 3. HERO
  if (nameLower.includes('hero') || idx === 1) return 'HERO'

  // 4. Genuine repeated product card collection
  if (isRepeatedProductCards(node)) {
    return 'CARD_GRID'
  }

  // 5. DEFAULT FOR EVERYTHING ELSE: SINGLE_COLUMN (1 Column Full Width)
  return 'SINGLE_COLUMN'
}

function extractSectionManifest(clone: FrameNode, origW: number, origH: number): SectionManifest[] {
  const visibleChildren = clone.children
    .filter(c => c.visible !== false)
    .sort((a, b) => nY(a) - nY(b))

  if (visibleChildren.length === 0) return []

  return visibleChildren.map((node, idx) => ({
    node,
    originalIndex: idx,
    type: classifyTopLevelNode(node, idx, visibleChildren.length, origW, origH),
  }))
}

// ---- Create Native Mobile Hamburger Icon ----

function createHamburgerIcon(parent: FrameNode, x: number, y: number): FrameNode {
  const iconFrame = figma.createFrame()
  iconFrame.name = 'Mobile Menu'
  iconFrame.resize(26, 26)
  iconFrame.x = Math.round(x)
  iconFrame.y = Math.round(y)
  iconFrame.fills = []
  iconFrame.clipsContent = false

  const barColor: RGB = { r: 0.12, g: 0.14, b: 0.17 }

  for (let i = 0; i < 3; i++) {
    const bar = figma.createRectangle()
    bar.name = `Line ${i + 1}`
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

// ---- Section Transformer: Mobile Navbar (100% Contained, No Overflow) ----

async function transformNavbarSection(
  node: SceneNode,
  vp: RVP,
  log: string[]
): Promise<number> {
  const H = Math.max(56, vp.navH)
  doResize(node, vp.width, H)

  if ('children' in node) {
    const fr = node as FrameNode
    fr.clipsContent = false

    if ('layoutMode' in fr && fr.layoutMode !== 'NONE') {
      fr.layoutMode = 'NONE'
    }

    const bgNodes: SceneNode[] = []
    let logoNode: SceneNode | null = null
    const actionNodes: SceneNode[] = []
    const navLinkNodes: SceneNode[] = []

    function inspectNavbarKids(parent: FrameNode | GroupNode) {
      for (const c of parent.children) {
        if (isBackgroundNode(c, vp.width, H)) {
          bgNodes.push(c)
        } else if (isButtonLike(c) || isIconNode(c)) {
          actionNodes.push(c)
        } else if (c.type === 'TEXT') {
          const txt = (c as TextNode).characters || ''
          const name = (c.name || '').toLowerCase()
          if (name.includes('logo') || name.includes('brand') || (!logoNode && txt.length <= 15 && nX(c) < 200)) {
            if (!logoNode) logoNode = c
            else navLinkNodes.push(c)
          } else {
            navLinkNodes.push(c)
          }
        } else if (isImageNode(c) || (c.name || '').toLowerCase().includes('logo')) {
          if (!logoNode) logoNode = c
          else actionNodes.push(c)
        } else if ('children' in c && (c.type === 'FRAME' || c.type === 'GROUP')) {
          const frameName = (c.name || '').toLowerCase()
          if (frameName.includes('logo') || frameName.includes('brand')) {
            if (!logoNode) logoNode = c
            else actionNodes.push(c)
          } else if (frameName.includes('nav') || frameName.includes('link') || frameName.includes('menu')) {
            for (const sub of (c as ChildrenMixin).children) navLinkNodes.push(sub)
          } else if (frameName.includes('action') || frameName.includes('icon') || frameName.includes('cart') || frameName.includes('right')) {
            for (const sub of (c as ChildrenMixin).children) actionNodes.push(sub)
          } else {
            inspectNavbarKids(c as FrameNode | GroupNode)
          }
        } else {
          navLinkNodes.push(c)
        }
      }
    }

    inspectNavbarKids(fr)

    if (vp.width < 768) {
      // 1. Left: Hamburger Menu
      createHamburgerIcon(fr, vp.padding, Math.round((H - 26) / 2))

      // 2. Logo / Brand
      let logoEndX = vp.padding + 34
      if (logoNode) {
        try { fr.appendChild(logoNode) } catch (_) {}
        logoNode.visible = true
        const maxLogoH = Math.min(logoNode.height, 28)
        const logoAspect = logoNode.width / Math.max(1, logoNode.height)
        const maxLogoW = Math.min(Math.round(vp.width * 0.40), Math.round(maxLogoH * logoAspect))

        setPos(logoNode, vp.padding + 34, Math.round((H - maxLogoH) / 2))
        doResize(logoNode, maxLogoW, maxLogoH)
        if (logoNode.type === 'TEXT') {
          await reflowTextNode(logoNode as TextNode, maxLogoW, vp)
        }
        logoEndX = vp.padding + 34 + maxLogoW
      }

      // 3. Right: Utility Actions (Cart, Search, Profile)
      let curRightX = vp.width - vp.padding
      actionNodes.sort((a, b) => {
        const nameA = (a.name || '').toLowerCase()
        const nameB = (b.name || '').toLowerCase()
        if (nameA.includes('cart') || nameA.includes('bag')) return 1
        if (nameB.includes('cart') || nameB.includes('bag')) return -1
        return nX(b) - nX(a)
      })

      for (const act of actionNodes) {
        try { fr.appendChild(act) } catch (_) {}
        act.visible = true
        const actW = Math.min(act.width, isButtonLike(act) ? 75 : 32)
        const actH = Math.min(act.height, 32)
        const targetX = curRightX - actW

        if (targetX < logoEndX + 8) {
          act.visible = false
          continue
        }

        setPos(act, targetX, Math.round((H - actH) / 2))
        doResize(act, actW, actH)
        curRightX = targetX - 8
      }

      // 4. Desktop Nav Links: Preserved in hierarchy inside a hidden frame
      if (navLinkNodes.length > 0) {
        const navWrapper = figma.createFrame()
        navWrapper.name = 'Mobile Nav Links (Preserved)'
        navWrapper.resize(vp.width - vp.padding * 2, 1)
        navWrapper.fills = []
        navWrapper.clipsContent = true
        navWrapper.visible = false
        setPos(navWrapper, vp.padding, H)

        for (const link of navLinkNodes) {
          try {
            navWrapper.appendChild(link)
          } catch (_) {
            link.visible = false
          }
        }
        fr.appendChild(navWrapper)
      }

    } else {
      if (logoNode) {
        setPos(logoNode, vp.padding, Math.round((H - logoNode.height) / 2))
      }
      let rightX = vp.width - vp.padding
      for (let i = actionNodes.length - 1; i >= 0; i--) {
        const act = actionNodes[i]
        rightX -= act.width
        setPos(act, rightX, Math.round((H - act.height) / 2))
        rightX -= 12
      }
    }

    // Snap Backgrounds
    for (const bg of bgNodes) {
      setPos(bg, 0, 0)
      doResize(bg, vp.width, H)
    }

    // Containment Clamp
    for (const c of fr.children) {
      if (c.visible !== false && !isBackgroundNode(c, vp.width, H)) {
        if (nX(c) + c.width > vp.width) {
          const allowedW = Math.max(10, vp.width - nX(c) - vp.padding)
          doResize(c, allowedW, c.height)
        }
      }
    }
  }

  log.push(`Navbar: reconstructed mobile header row (☰ + Logo + Actions, ${H}px)`)
  return H
}

// ---- Section Transformer: HERO (1-Column Full Width Stack) ----

async function transformHeroSection(
  node: SceneNode,
  vp: RVP,
  log: string[]
): Promise<number> {
  const contentW = vp.width - vp.padding * 2

  if ('children' in node) {
    const fr = node as FrameNode
    if ('layoutMode' in fr && fr.layoutMode !== 'NONE') fr.layoutMode = 'NONE'

    const allKids = [...fr.children]
    const bgNodes: SceneNode[] = []
    const textNodes: SceneNode[] = []
    const mediaNodes: SceneNode[] = []
    const buttonNodes: SceneNode[] = []

    for (const n of allKids) {
      if (isBackgroundNode(n, fr.width, fr.height)) {
        bgNodes.push(n)
      } else if (isButtonLike(n)) {
        buttonNodes.push(n)
      } else if (isImageNode(n)) {
        mediaNodes.push(n)
      } else if (n.type === 'TEXT') {
        textNodes.push(n)
      } else if ('children' in n && (n.type === 'FRAME' || n.type === 'GROUP')) {
        const frameKids = (n as ChildrenMixin).children
        if (frameKids.some(k => isImageNode(k))) {
          mediaNodes.push(n)
        } else {
          textNodes.push(n)
        }
      } else {
        textNodes.push(n)
      }
    }

    textNodes.sort((a, b) => nY(a) - nY(b))
    let localY = vp.padding
    const baseX = vp.padding

    // 1. Text Group (Eyebrow, Heading, Paragraph)
    for (const t of textNodes) {
      if (t.type === 'TEXT') {
        setPos(t, baseX, localY)
        const h = await reflowTextNode(t as TextNode, contentW, vp, log)
        localY += h + SPACING.SMALL
      } else {
        setPos(t, baseX, localY)
        doResize(t, contentW, t.height)
        const h = await reflowContainerInternals(t, contentW, vp, log)
        localY += h + SPACING.SMALL
      }
    }

    // 2. Buttons
    if (buttonNodes.length > 0) {
      localY += SPACING.SMALL
      buttonNodes.sort((a, b) => nX(a) - nX(b))
      const totalBtnW = buttonNodes.reduce((s, b) => s + b.width, 0) + (buttonNodes.length - 1) * SPACING.SMALL

      if (totalBtnW <= contentW) {
        let btnX = baseX
        let maxBtnH = 0
        for (const btn of buttonNodes) {
          setPos(btn, btnX, localY)
          btnX += btn.width + SPACING.SMALL
          maxBtnH = Math.max(maxBtnH, btn.height)
        }
        localY += maxBtnH + SPACING.MEDIUM
      } else {
        for (const btn of buttonNodes) {
          setPos(btn, baseX, localY)
          doResize(btn, contentW, btn.height)
          if ('children' in btn) {
            for (const bc of (btn as ChildrenMixin).children) {
              if (bc.type === 'TEXT') await reflowTextNode(bc as TextNode, contentW, vp)
            }
          }
          localY += btn.height + SPACING.SMALL
        }
        localY += SPACING.NORMAL
      }
    } else {
      localY += SPACING.NORMAL
    }

    // 3. Media / Hero Image (Full Width Stacked)
    for (const media of mediaNodes) {
      const origW = media.width, origH = media.height
      const aspect = origH / Math.max(1, origW)
      const maxImgH = Math.round(vp.width * 0.62) // ~240px on 390px mobile
      const newH = Math.min(Math.round(contentW * aspect), maxImgH)

      setPos(media, baseX, localY)
      doResize(media, contentW, newH)

      if ('children' in media) {
        await reflowContainerInternals(media, contentW, vp, log)
      }

      localY += newH + SPACING.MEDIUM
    }

    const finalHeroH = localY + vp.padding
    doResize(fr, vp.width, finalHeroH)

    for (const bg of bgNodes) {
      setPos(bg, 0, 0)
      doResize(bg, vp.width, finalHeroH)
    }

    log.push(`Hero: 1-column full width stack (${finalHeroH}px)`)
    return finalHeroH
  }

  if (node.type === 'TEXT') {
    const h = await reflowTextNode(node as TextNode, contentW, vp, log)
    return h + vp.padding * 2
  }
  return node.height
}

// ---- Section Transformer: SINGLE_COLUMN (Universal 1-Column Full Width for All General Content) ----

async function transformSingleColumnSection(
  node: SceneNode,
  vp: RVP,
  log: string[]
): Promise<number> {
  const contentW = vp.width - vp.padding * 2

  if ('children' in node) {
    const fr = node as FrameNode
    if ('layoutMode' in fr && fr.layoutMode !== 'NONE') fr.layoutMode = 'NONE'

    const allKids = [...fr.children]
    const bgNodes: SceneNode[] = []
    const fgKids: SceneNode[] = []

    for (const n of allKids) {
      if (isBackgroundNode(n, fr.width, fr.height)) {
        bgNodes.push(n)
      } else {
        fgKids.push(n)
      }
    }

    // Sort strictly in natural top-to-bottom reading order
    fgKids.sort((a, b) => {
      const dy = nY(a) - nY(b)
      if (Math.abs(dy) > 15) return dy
      return nX(a) - nX(b)
    })

    let localY = vp.padding
    const baseX = vp.padding

    for (const kid of fgKids) {
      if (kid.type === 'TEXT') {
        setPos(kid, baseX, localY)
        const h = await reflowTextNode(kid as TextNode, contentW, vp, log)
        localY += h + SPACING.NORMAL
      } else if (isButtonLike(kid)) {
        setPos(kid, baseX, localY)
        const btnW = Math.min(kid.width, contentW)
        doResize(kid, btnW, Math.min(kid.height, 44))
        if ('children' in kid) {
          for (const bc of (kid as ChildrenMixin).children) {
            if (bc.type === 'TEXT') await reflowTextNode(bc as TextNode, btnW, vp)
          }
        }
        localY += Math.min(kid.height, 44) + SPACING.NORMAL
      } else if (isImageNode(kid)) {
        const origW = kid.width, origH = kid.height
        const aspect = origH / Math.max(1, origW)
        const maxH = Math.round(vp.width * 0.60)
        const imgH = Math.min(Math.round(contentW * aspect), maxH)
        setPos(kid, baseX, localY)
        doResize(kid, contentW, imgH)
        localY += imgH + SPACING.NORMAL
      } else if ('children' in kid) {
        setPos(kid, baseX, localY)
        doResize(kid, contentW, kid.height)
        const h = await reflowContainerInternals(kid, contentW, vp, log)
        localY += h + SPACING.NORMAL
      } else {
        const w = Math.min(kid.width, contentW)
        setPos(kid, baseX, localY)
        doResize(kid, w, kid.height)
        localY += kid.height + SPACING.NORMAL
      }
    }

    const finalH = localY + vp.padding
    doResize(fr, vp.width, finalH)

    for (const bg of bgNodes) {
      setPos(bg, 0, 0)
      doResize(bg, vp.width, finalH)
    }

    log.push(`Section "${fr.name}": 1-column full width (${finalH}px)`)
    return finalH
  }

  if (node.type === 'TEXT') {
    const h = await reflowTextNode(node as TextNode, contentW, vp, log)
    return h + vp.padding * 2
  }

  return node.height
}

// ---- Section Transformer: CARD_GRID (2-Column ONLY for Genuine Repeated Product Cards) ----

async function transformCardGridSection(
  node: SceneNode,
  vp: RVP,
  log: string[]
): Promise<number> {
  const contentW = vp.width - vp.padding * 2

  if ('children' in node) {
    const fr = node as FrameNode
    if ('layoutMode' in fr && fr.layoutMode !== 'NONE') fr.layoutMode = 'NONE'

    const allKids = [...fr.children]
    const bgNodes: SceneNode[] = []
    const headerNodes: SceneNode[] = []
    const cards: SceneNode[] = []

    for (const n of allKids) {
      if (isBackgroundNode(n, fr.width, fr.height)) {
        bgNodes.push(n)
      } else if (n.type === 'TEXT' && n.width > fr.width * 0.45) {
        headerNodes.push(n)
      } else {
        cards.push(n)
      }
    }

    let localY = vp.padding
    const baseX = vp.padding

    // 1. Section Header Text (if any)
    for (const h of headerNodes) {
      setPos(h, baseX, localY)
      const textH = await reflowTextNode(h as TextNode, contentW, vp, log)
      localY += textH + SPACING.NORMAL
    }

    // 2. 2-Column Product Card Grid
    cards.sort((a, b) => nX(a) - nX(b))
    const cardW = Math.floor((contentW - vp.colGap) / 2) // ~169px on 390px mobile

    for (let i = 0; i < cards.length; i += 2) {
      const cardA = cards[i]
      const cardB = i + 1 < cards.length ? cards[i + 1] : null

      const xA = baseX
      const xB = baseX + cardW + vp.colGap

      setPos(cardA, xA, localY)
      doResize(cardA, cardW, cardA.height)
      const hA = await reflowContainerInternals(cardA, cardW, vp, log)

      let hB = 0
      if (cardB) {
        setPos(cardB, xB, localY)
        doResize(cardB, cardW, cardB.height)
        hB = await reflowContainerInternals(cardB, cardW, vp, log)
      }

      const maxRowH = Math.max(hA, hB)
      doResize(cardA, cardW, maxRowH)
      if (cardB) doResize(cardB, cardW, maxRowH)

      localY += maxRowH + vp.colGap
    }

    const finalGridH = localY + vp.padding
    doResize(fr, vp.width, finalGridH)

    for (const bg of bgNodes) {
      setPos(bg, 0, 0)
      doResize(bg, vp.width, finalGridH)
    }

    log.push(`Product Card Grid: ${cards.length} cards → 2-column mobile grid (${finalGridH}px)`)
    return finalGridH
  }

  return node.height
}

// ---- Section Transformer: FOOTER (100% Content Preserved) ----

async function transformFooterSection(
  node: SceneNode,
  vp: RVP,
  log: string[]
): Promise<number> {
  const contentW = vp.width - vp.padding * 2

  if ('children' in node) {
    const fr = node as FrameNode
    if ('layoutMode' in fr && fr.layoutMode !== 'NONE') fr.layoutMode = 'NONE'

    const allKids = [...fr.children]

    for (const n of allKids) {
      n.visible = true
      if ('children' in n) {
        for (const c of (n as ChildrenMixin).children) c.visible = true
      }
    }

    const bgNodes: SceneNode[] = []
    const linkColumns: SceneNode[] = []
    const interactiveBlocks: SceneNode[] = []
    let copyrightNode: SceneNode | null = null

    for (const n of allKids) {
      const nameLower = (n.name || '').toLowerCase()
      if (isBackgroundNode(n, fr.width, fr.height)) {
        bgNodes.push(n)
      } else if (nameLower.includes('copyright') || nameLower.includes('rights') || (n.type === 'TEXT' && (n as TextNode).characters?.includes('©'))) {
        copyrightNode = n
      } else if (nameLower.includes('newsletter') || nameLower.includes('subscribe') || isButtonLike(n) || (n.type === 'FRAME' && n.width > 220 && isImageNode(n))) {
        interactiveBlocks.push(n)
      } else if ('children' in n && (n as ChildrenMixin).children.length >= 2) {
        linkColumns.push(n)
      } else {
        interactiveBlocks.push(n)
      }
    }

    let localY = vp.padding
    const baseX = vp.padding

    // 1. Link Columns in 2-Column Mobile Grid
    if (linkColumns.length >= 2 && vp.width < 768) {
      const colW = Math.floor((contentW - vp.colGap) / 2) // ~169px each on 390px mobile

      for (let i = 0; i < linkColumns.length; i += 2) {
        const colA = linkColumns[i]
        const colB = i + 1 < linkColumns.length ? linkColumns[i + 1] : null

        const xA = baseX
        const xB = baseX + colW + vp.colGap

        setPos(colA, xA, localY)
        doResize(colA, colW, colA.height)
        const hA = await reflowContainerInternals(colA, colW, vp, log)

        let hB = 0
        if (colB) {
          setPos(colB, xB, localY)
          doResize(colB, colW, colB.height)
          hB = await reflowContainerInternals(colB, colW, vp, log)
        }

        const rowH = Math.max(hA, hB)
        doResize(colA, colW, rowH)
        if (colB) doResize(colB, colW, rowH)

        localY += rowH + SPACING.NORMAL
      }
    } else {
      for (const col of linkColumns) {
        setPos(col, baseX, localY)
        doResize(col, contentW, col.height)
        const h = await reflowContainerInternals(col, contentW, vp, log)
        localY += h + SPACING.NORMAL
      }
    }

    // 2. Interactive Blocks (Newsletter, Subscribe, Social Icons)
    for (const block of interactiveBlocks) {
      setPos(block, baseX, localY)
      doResize(block, contentW, block.height)
      const h = await reflowContainerInternals(block, contentW, vp, log)
      localY += h + SPACING.SMALL
    }

    // 3. Copyright
    if (copyrightNode) {
      setPos(copyrightNode, baseX, localY + SPACING.SMALL)
      if (copyrightNode.type === 'TEXT') {
        await reflowTextNode(copyrightNode as TextNode, contentW, vp)
      }
      localY += copyrightNode.height + SPACING.SMALL
    }

    const finalFooterH = localY + vp.padding
    doResize(fr, vp.width, finalFooterH)

    for (const bg of bgNodes) {
      setPos(bg, 0, 0)
      doResize(bg, vp.width, finalFooterH)
    }

    log.push(`Footer: all links preserved in 2-column grid (${finalFooterH}px height)`)
    return finalFooterH
  }

  return node.height
}

// ---- Hard Overlap Verification & Correction ----

function verifyAndCorrectSectionOverlaps(sections: SectionManifest[], vp: RVP, log: string[]): void {
  let overlapCount = 0

  for (let i = 1; i < sections.length; i++) {
    const prevNode = sections[i - 1].node
    const curNode = sections[i].node

    const prevBottom = nY(prevNode) + prevNode.height
    const curTop = nY(curNode)

    if (curTop < prevBottom) {
      const correctedY = prevBottom + SPACING.SECTION
      setPos(curNode, 0, correctedY)
      overlapCount++
      log.push(`[OVERLAP CORRECTED] "${curNode.name}" overlapped "${prevNode.name}". Corrected Y: ${curTop}px → ${correctedY}px`)
    }
  }

  if (overlapCount === 0) {
    log.push(`Overlap Audit: Zero section overlaps detected. All sections in perfect vertical sequence.`)
  }
}

// ---- Recursive Off-Frame Content & Geometry Safety Audit ----

function auditAndFixOffFrameContent(clone: FrameNode, log: string[]): void {
  let offFrameFixedCount = 0

  function inspectFrame(frame: FrameNode) {
    if (!('children' in frame) || frame.children.length === 0) return

    const fgKids = frame.children.filter(c => c.visible !== false && !isBackgroundNode(c, frame.width, frame.height))
    if (fgKids.length === 0) return

    const minY = Math.min(...fgKids.map(c => nY(c)))
    if (minY < 0) {
      const shiftY = Math.abs(minY) + 8
      for (const c of fgKids) setPos(c, nX(c), nY(c) + shiftY)
      offFrameFixedCount++
    }

    const maxChildBottom = Math.max(...fgKids.map(c => nY(c) + c.height))
    if (maxChildBottom > frame.height) {
      const newH = maxChildBottom + 16
      doResize(frame, frame.width, newH)

      for (const c of frame.children) {
        if (isBackgroundNode(c, frame.width, frame.height)) {
          setPos(c, 0, 0)
          doResize(c, frame.width, newH)
        }
      }
      offFrameFixedCount++
    }

    for (const c of frame.children) {
      if ('children' in c && (c.type === 'FRAME' || c.type === 'GROUP')) {
        inspectFrame(c as FrameNode)
      }
    }
  }

  inspectFrame(clone)
}

// ---- Post-Reflow Layout Clamping & Validation ----

function validateAndClampLayout(clone: FrameNode, vp: RVP, log: string[]): void {
  let clampCount = 0

  function checkNode(node: SceneNode, maxW: number) {
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
    log.push(`Validation: ${clampCount} elements adjusted to stay inside mobile viewport`)
  }
}

// ---- Main Entry Point ----

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
  log.push(`Engine: Section-Aware Responsive Composition`)

  // 1. Normalize Root Frame
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
    log.push(`Root Auto Layout converted to free positioning`)
  }

  // 2. Set root width to target mobile width
  clone.resize(vp.width, origH)
  clone.clipsContent = false

  // 3. Extract Section Manifest (Independent sections)
  const sections = extractSectionManifest(clone, origW, origH)
  log.push(`Identified ${sections.length} top-level sections`)

  // 4. STAGE A: Sequential Page Flow Positioning
  let currentY = 0

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i]
    const node = sec.node

    // A. Assign top-level Y position strictly from previous section's bottom
    setPos(node, 0, currentY)

    // B. Transform section internally based on its pattern
    let sectionH = node.height
    const columns = sec.type === 'CARD_GRID' ? 2 : 1

    console.log('[Responsive]', node.name, 'layout:', sec.type, 'columns:', columns)

    switch (sec.type) {
      case 'NAVBAR': {
        sectionH = await transformNavbarSection(node, vp, log)
        break
      }

      case 'HERO': {
        sectionH = await transformHeroSection(node, vp, log)
        break
      }

      case 'CARD_GRID': {
        sectionH = await transformCardGridSection(node, vp, log)
        break
      }

      case 'FOOTER': {
        sectionH = await transformFooterSection(node, vp, log)
        break
      }

      case 'SINGLE_COLUMN':
      default: {
        sectionH = await transformSingleColumnSection(node, vp, log)
        break
      }
    }

    // C. Safety check: ensure section height strictly wraps its children
    if ('children' in node && (node as FrameNode).children.length > 0) {
      const fr = node as FrameNode
      const fgKids = fr.children.filter(c => c.visible !== false && !isBackgroundNode(c, fr.width, fr.height))
      if (fgKids.length > 0) {
        const maxChildBottom = Math.max(...fgKids.map(c => nY(c) + c.height))
        if (fr.height < maxChildBottom + 10) {
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

    // D. Advance currentY for next section
    currentY = nY(node) + node.height + SPACING.SECTION
  }

  // 5. Hard Overlap Verification & Correction
  verifyAndCorrectSectionOverlaps(sections, vp, log)

  // 6. Recursive Off-Frame Safety Audit
  auditAndFixOffFrameContent(clone, log)

  // 7. Content-Driven Frame Height (Ends naturally after last section)
  const allSections = sections.map(s => s.node)
  const lastSection = allSections[allSections.length - 1]
  const finalPageHeight = lastSection ? nY(lastSection) + lastSection.height + vp.padding : currentY
  clone.resize(vp.width, finalPageHeight)
  clone.clipsContent = true
  log.push(`Canvas resized: ${origW}×${origH}px → ${vp.width}×${finalPageHeight}px`)

  // 8. Final Validation & Clamping
  validateAndClampLayout(clone, vp, log)
}
