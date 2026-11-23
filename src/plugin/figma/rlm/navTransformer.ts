// ============================================================
// src/plugin/figma/rlm/navTransformer.ts
// Mobile Navigation Transformer & Component Generator
// 100% Offline & Deterministic — Zero External Dependencies
// ============================================================

import type { RLMNode, RLMViewport } from './types'

/**
 * Attempts to safely load a font in Figma with robust fallbacks.
 */
async function loadFontSafe(font: FontName = { family: 'Inter', style: 'Regular' }): Promise<FontName | null> {
  if (typeof figma === 'undefined' || typeof figma.loadFontAsync !== 'function') return null
  const candidates: FontName[] = [
    font,
    { family: 'Inter', style: 'Regular' },
    { family: 'Roboto', style: 'Regular' },
    { family: 'Arial', style: 'Regular' },
  ]
  for (const f of candidates) {
    try {
      await figma.loadFontAsync(f)
      return f
    } catch (_) { }
  }
  return null
}

/**
 * Safely creates a TextNode with fonts properly loaded to prevent Figma runtime errors.
 */
async function createTextSafe(
  text: string,
  fontSize: number,
  color: RGB,
  bold = false
): Promise<TextNode | null> {
  if (typeof figma === 'undefined' || typeof figma.createText !== 'function') return null
  try {
    const desiredFont: FontName = {
      family: 'Inter',
      style: bold ? 'Bold' : 'Regular',
    }
    const loadedFont = await loadFontSafe(desiredFont)
    const textNode = figma.createText()
    if (loadedFont) {
      try { textNode.fontName = loadedFont } catch (_) { }
    }
    try {
      textNode.characters = text
      textNode.fontSize = fontSize
      textNode.fills = [{ type: 'SOLID', color }]
    } catch (_) { }
    return textNode
  } catch (_) {
    return null
  }
}

/**
 * Creates a clean 3-line hamburger menu icon frame.
 */
export function createHamburgerIcon(color: RGB = { r: 0.12, g: 0.16, b: 0.22 }): FrameNode {
  if (typeof figma === 'undefined' || typeof figma.createFrame !== 'function') {
    return {} as FrameNode
  }

  const iconFrame = figma.createFrame()
  iconFrame.name = 'Hamburger Menu Icon'
  if ('resize' in iconFrame) iconFrame.resize(28, 28)
  iconFrame.fills = []
  iconFrame.clipsContent = false
  if ('layoutAlign' in iconFrame) (iconFrame as any).layoutAlign = 'INHERIT'
  if ('layoutSizingHorizontal' in iconFrame) (iconFrame as any).layoutSizingHorizontal = 'FIXED'
  if ('layoutSizingVertical' in iconFrame) (iconFrame as any).layoutSizingVertical = 'FIXED'

  for (let i = 0; i < 3; i++) {
    const bar = figma.createRectangle()
    bar.name = `Bar ${i + 1}`
    if ('resize' in bar) bar.resize(22, 2.5)
    if ('cornerRadius' in bar) bar.cornerRadius = 2
    bar.x = 3
    bar.y = 5 + i * 7
    bar.fills = [{ type: 'SOLID', color }]
    iconFrame.appendChild(bar)
  }

  return iconFrame
}

/**
 * Creates a close (×) icon frame.
 */
export function createCloseIcon(color: RGB = { r: 0.12, g: 0.16, b: 0.22 }): FrameNode {
  if (typeof figma === 'undefined' || typeof figma.createFrame !== 'function') {
    return {} as FrameNode
  }

  const frame = figma.createFrame()
  frame.name = 'Close Icon'
  if ('resize' in frame) frame.resize(26, 26)
  frame.fills = []
  frame.clipsContent = false

  for (let i = 0; i < 2; i++) {
    const line = figma.createRectangle()
    line.name = `X Line ${i + 1}`
    if ('resize' in line) line.resize(18, 2.5)
    if ('cornerRadius' in line) line.cornerRadius = 2
    line.x = 4
    line.y = 12
    line.rotation = i === 0 ? 45 : -45
    line.fills = [{ type: 'SOLID', color }]
    frame.appendChild(line)
  }

  return frame
}

/**
 * Transforms the navigation bar into a compact mobile header with a hamburger menu,
 * and generates an adjacent Component Frame for the expanded mobile menu content.
 */
export async function transformMobileNavigation(
  navRLM: RLMNode,
  vp: RLMViewport,
  rootNode: FrameNode,
  log?: string[]
): Promise<void> {
  const navFrame = navRLM.figmaNodeRef as FrameNode
  if (!navFrame || !('children' in navFrame)) return

  // 1. Determine theme color from background
  let iconColor: RGB = { r: 0.12, g: 0.16, b: 0.22 }
  if ('fills' in navFrame && Array.isArray((navFrame as any).fills)) {
    const solid = (navFrame as any).fills.find((f: any) => f.type === 'SOLID' && f.visible !== false)
    if (solid && solid.color) {
      const lum = 0.299 * solid.color.r + 0.587 * solid.color.g + 0.114 * solid.color.b
      iconColor = lum > 0.45 ? { r: 0.12, g: 0.16, b: 0.22 } : { r: 0.95, g: 0.95, b: 0.95 }
    }
  }

  // 2. Identify Brand, Actions, Links, and Search
  let brandChild = navRLM.children.find(c =>
    /(logo|brand)/i.test(c.name) || c.isImage || (c.typography && c.geometry.x <= 140 && c.geometry.width <= 260)
  )

  // Check nested brand if not found at top level
  if (!brandChild) {
    for (const kid of navRLM.children) {
      const subBrand = kid.children.find(c => /(logo|brand)/i.test(c.name) || c.isImage)
      if (subBrand) {
        brandChild = subBrand
        break
      }
    }
  }
  if (!brandChild) brandChild = navRLM.children[0]

  // 3. Compact Mobile Header on the Artboard
  navFrame.layoutMode = 'HORIZONTAL'
  navFrame.primaryAxisAlignItems = 'SPACE_BETWEEN'
  navFrame.counterAxisAlignItems = 'CENTER'
  navFrame.paddingLeft = vp.padding
  navFrame.paddingRight = vp.padding
  navFrame.paddingTop = 0
  navFrame.paddingBottom = 0
  navFrame.itemSpacing = 12
  if ('resize' in navFrame) navFrame.resize(vp.width, vp.navH)

  // Keep brand visible on left
  if (brandChild && brandChild.figmaNodeRef) {
    brandChild.figmaNodeRef.visible = true
    if ('resize' in brandChild.figmaNodeRef && brandChild.figmaNodeRef.height > 36) {
      const aspect = brandChild.figmaNodeRef.width / Math.max(1, brandChild.figmaNodeRef.height)
      const bH = 32
      const bW = Math.round(bH * aspect)
      brandChild.figmaNodeRef.resize(bW, bH)
    }
  }

  // Hide desktop link list and large search inputs from compact 56px header
  for (const c of navRLM.children) {
    if (c !== brandChild) {
      const isQuickIcon = (c.geometry.width <= 44 && c.geometry.height <= 44) && /(cart|bag|search)/i.test(c.name)
      if (!isQuickIcon && c.figmaNodeRef) {
        try { c.figmaNodeRef.visible = false } catch (_) { }
      }
    }
  }

  // Add Hamburger Menu Icon to header
  const hamburger = createHamburgerIcon(iconColor)
  if (hamburger && 'name' in hamburger) {
    try { navFrame.appendChild(hamburger) } catch (_) { }
  }

  if (log) log.push(`[RLM Navigation] Formatted compact mobile nav bar (${vp.width}x${vp.navH}px) with hamburger menu`)

  // 4. Generate Mobile Navigation Menu Component Frame
  if (typeof figma === 'undefined') return

  const createComp = typeof figma.createComponent === 'function'
    ? figma.createComponent.bind(figma)
    : figma.createFrame.bind(figma)

  const navComp = createComp()
  if (!navComp || !('resize' in navComp)) return

  navComp.name = `${navFrame.name || 'Navigation'} — Mobile Menu Component`
  navComp.x = (rootNode.x || 0) + (rootNode.width || vp.width) + 60
  navComp.y = rootNode.y || 0
  navComp.resize(vp.width, 600)
  navComp.layoutMode = 'VERTICAL'
  navComp.counterAxisAlignItems = 'MIN'
  navComp.primaryAxisAlignItems = 'MIN'
  navComp.paddingTop = 24
  navComp.paddingBottom = 28
  navComp.paddingLeft = 20
  navComp.paddingRight = 20
  navComp.itemSpacing = 16
  navComp.cornerRadius = 16
  navComp.clipsContent = true

  // Background matching nav theme
  navComp.fills = (navFrame.fills && navFrame.fills.length > 0)
    ? navFrame.fills
    : [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]

  if ('strokes' in navComp) {
    navComp.strokes = [{ type: 'SOLID', color: { r: 0.88, g: 0.91, b: 0.94 } }]
    navComp.strokeWeight = 1
  }

  // A. Header Row: "Navigation Menu" + Close Icon
  const headerRow = figma.createFrame()
  headerRow.name = 'Menu Header'
  headerRow.layoutMode = 'HORIZONTAL'
  headerRow.primaryAxisAlignItems = 'SPACE_BETWEEN'
  headerRow.counterAxisAlignItems = 'CENTER'
  headerRow.fills = []
  if ('layoutAlign' in headerRow) (headerRow as any).layoutAlign = 'STRETCH'
  headerRow.resize(vp.width - 40, 36)

  const menuTitle = await createTextSafe('Navigation Menu', 18, iconColor, true)
  if (menuTitle) headerRow.appendChild(menuTitle)

  const closeIcon = createCloseIcon(iconColor)
  headerRow.appendChild(closeIcon)
  navComp.appendChild(headerRow)

  // B. Search Bar inside Menu
  const searchBar = figma.createFrame()
  searchBar.name = 'Mobile Menu Search'
  searchBar.layoutMode = 'HORIZONTAL'
  searchBar.counterAxisAlignItems = 'CENTER'
  searchBar.paddingLeft = 14
  searchBar.paddingRight = 14
  searchBar.cornerRadius = 8
  searchBar.fills = [{ type: 'SOLID', color: { r: 0.94, g: 0.96, b: 0.98 } }]
  if ('layoutAlign' in searchBar) (searchBar as any).layoutAlign = 'STRETCH'
  searchBar.resize(vp.width - 40, 42)

  const searchPlaceholder = await createTextSafe('Search product, category or SKU...', 14, { r: 0.5, g: 0.55, b: 0.62 })
  if (searchPlaceholder) searchBar.appendChild(searchPlaceholder)
  navComp.appendChild(searchBar)

  // C. Navigation Links List
  const linkTexts: string[] = []
  function collectLinks(node: RLMNode) {
    if (node.typography && node.typography.characters.trim()) {
      const str = node.typography.characters.trim()
      if (str.length >= 2 && str.length <= 40 && !/(logo|search|cart|login|register|quote)/i.test(node.name)) {
        linkTexts.push(str)
      }
    }
    for (const kid of node.children) {
      collectLinks(kid)
    }
  }
  collectLinks(navRLM)

  const uniqueLinks = [...new Set(linkTexts)].filter(l => l.length > 2 && l.length <= 35)
  const displayLinks = uniqueLinks.length >= 2
    ? uniqueLinks.slice(0, 8)
    : ['All Categories', 'Featured Products', 'Drinkware', 'Journals & Padfolios', 'Tech Gear', 'Writing Instruments', 'Closeouts', 'Distributor Portal']

  const linksContainer = figma.createFrame()
  linksContainer.name = 'Nav Links List'
  linksContainer.layoutMode = 'VERTICAL'
  linksContainer.itemSpacing = 8
  linksContainer.fills = []
  if ('layoutAlign' in linksContainer) (linksContainer as any).layoutAlign = 'STRETCH'
  linksContainer.resize(vp.width - 40, displayLinks.length * 48)

  for (const text of displayLinks) {
    const itemFrame = figma.createFrame()
    itemFrame.name = `Nav Link — ${text}`
    itemFrame.layoutMode = 'HORIZONTAL'
    itemFrame.counterAxisAlignItems = 'CENTER'
    itemFrame.paddingLeft = 14
    itemFrame.paddingRight = 14
    itemFrame.cornerRadius = 8
    itemFrame.fills = []
    if ('layoutAlign' in itemFrame) (itemFrame as any).layoutAlign = 'STRETCH'
    itemFrame.resize(vp.width - 40, 42)

    const linkTextNode = await createTextSafe(text, 15, iconColor)
    if (linkTextNode) itemFrame.appendChild(linkTextNode)
    linksContainer.appendChild(itemFrame)
  }
  navComp.appendChild(linksContainer)

  // D. Action Buttons at the Bottom
  const actionsContainer = figma.createFrame()
  actionsContainer.name = 'Menu Action Buttons'
  actionsContainer.layoutMode = 'VERTICAL'
  actionsContainer.itemSpacing = 10
  actionsContainer.fills = []
  if ('layoutAlign' in actionsContainer) (actionsContainer as any).layoutAlign = 'STRETCH'
  actionsContainer.resize(vp.width - 40, 96)

  // Primary action button (Distributor Login / Contact)
  const btn1 = figma.createFrame()
  btn1.name = 'Primary Action'
  btn1.layoutMode = 'HORIZONTAL'
  btn1.primaryAxisAlignItems = 'CENTER'
  btn1.counterAxisAlignItems = 'CENTER'
  btn1.cornerRadius = 8
  btn1.fills = [{ type: 'SOLID', color: { r: 0.12, g: 0.38, b: 0.95 } }]
  if ('layoutAlign' in btn1) (btn1 as any).layoutAlign = 'STRETCH'
  btn1.resize(vp.width - 40, 44)

  const btn1Text = await createTextSafe('Distributor Login / Register', 15, { r: 1, g: 1, b: 1 }, true)
  if (btn1Text) btn1.appendChild(btn1Text)
  actionsContainer.appendChild(btn1)

  navComp.appendChild(actionsContainer)

  if (typeof figma.currentPage !== 'undefined' && 'appendChild' in figma.currentPage) {
    try {
      figma.currentPage.appendChild(navComp)
    } catch (_) { }
  }

  if (log) log.push(`[RLM Navigation] Generated Mobile Navigation Menu Component (${navComp.name}) beside artboard`)
}
