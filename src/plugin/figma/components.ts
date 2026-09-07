// ============================================================
// Components feature module for Figma plugin sandbox.
// Covers: Create Component, Component Naming, Layer Naming.
// ============================================================

import type {
  CreateComponentPayload,
  ComponentNamingAnalysis,
  ComponentRenameItem,
  ApplyComponentRenamesPayload,
  LayerNamingAnalysis,
  LayerRenameItem,
  ApplyLayerRenamesPayload,
} from '../../shared/types'

// -------------------------------------------------------
// Helper: Check if a name is a generic Figma auto-generated name
// -------------------------------------------------------
const GENERIC_NAME_REGEX = /^(Rectangle|Frame|Group|Text|Ellipse|Vector|Line|Polygon|Star|Union|Subtract|Intersect|Exclude|Component|Section|Instance|Layer|Path|Shape|Graphic)\s*\d*$/i
const COPY_NAME_REGEX = /^Copy of (Rectangle|Frame|Group|Text|Ellipse|Vector|Line|Polygon|Star|Component|Section|Layer|Shape)\s*\d*$/i
const UNTITLED_REGEX = /^(Untitled|New Layer|New Frame|New Component|New Group|Vector|Shape|Layer|Container)\s*\d*$/i

export function isGenericName(name: string): boolean {
  const trimmed = (name || '').trim()
  if (!trimmed) return true
  return (
    GENERIC_NAME_REGEX.test(trimmed) ||
    COPY_NAME_REGEX.test(trimmed) ||
    UNTITLED_REGEX.test(trimmed)
  )
}

// -------------------------------------------------------
// 1. CREATE COMPONENT
// -------------------------------------------------------
export async function createComponentFromSelection(
  payload?: CreateComponentPayload
): Promise<{ success: boolean; message: string; componentId?: string }> {
  const selection = figma.currentPage.selection

  if (!selection || selection.length === 0) {
    throw new Error('Select a layer to create a component.')
  }

  // If single component selected
  if (selection.length === 1 && selection[0].type === 'COMPONENT') {
    throw new Error('Selected layer is already a component.')
  }

  if (selection.length === 1 && selection[0].type === 'COMPONENT_SET') {
    throw new Error('Selected layer is already a component set.')
  }

  // Exactly 1 node selected
  if (selection.length === 1) {
    const node = selection[0]
    const compName = payload?.name?.trim() || node.name || 'Component'

    // If it's a FRAME, we can convert it into a COMPONENT smoothly
    if (node.type === 'FRAME') {
      const frame = node as FrameNode
      const parent = frame.parent || figma.currentPage
      const index = parent.children.indexOf(frame)

      const component = figma.createComponent()
      component.name = compName
      component.x = frame.x
      component.y = frame.y
      component.resize(frame.width, frame.height)

      // Copy Auto Layout properties
      component.layoutMode = frame.layoutMode
      if (frame.layoutMode !== 'NONE') {
        component.primaryAxisSizingMode = frame.primaryAxisSizingMode
        component.counterAxisSizingMode = frame.counterAxisSizingMode
        component.primaryAxisAlignItems = frame.primaryAxisAlignItems
        component.counterAxisAlignItems = frame.counterAxisAlignItems
        component.itemSpacing = frame.itemSpacing
        component.paddingTop = frame.paddingTop
        component.paddingRight = frame.paddingRight
        component.paddingBottom = frame.paddingBottom
        component.paddingLeft = frame.paddingLeft
        if ('layoutWrap' in frame) {
          component.layoutWrap = frame.layoutWrap
        }
        if ('itemReverseZIndex' in frame) {
          component.itemReverseZIndex = frame.itemReverseZIndex
        }
        if ('strokesIncludedInLayout' in frame) {
          component.strokesIncludedInLayout = frame.strokesIncludedInLayout
        }
      }

      // Copy Visual styles
      try { component.fills = frame.fills } catch (_) {}
      try { component.strokes = frame.strokes } catch (_) {}
      try { component.strokeWeight = frame.strokeWeight } catch (_) {}
      try { component.strokeAlign = frame.strokeAlign } catch (_) {}
      try { component.effects = frame.effects } catch (_) {}
      try { component.opacity = frame.opacity } catch (_) {}
      try { component.blendMode = frame.blendMode } catch (_) {}
      try { component.isMask = frame.isMask } catch (_) {}
      try { component.clipsContent = frame.clipsContent } catch (_) {}
      try { component.cornerRadius = frame.cornerRadius } catch (_) {}
      try { component.topLeftRadius = frame.topLeftRadius } catch (_) {}
      try { component.topRightRadius = frame.topRightRadius } catch (_) {}
      try { component.bottomLeftRadius = frame.bottomLeftRadius } catch (_) {}
      try { component.bottomRightRadius = frame.bottomRightRadius } catch (_) {}
      try { component.constraints = frame.constraints } catch (_) {}

      // Move children without cloning
      const children = [...frame.children]
      for (const child of children) {
        component.appendChild(child)
      }

      // Insert at identical position in hierarchy
      if (index >= 0 && index < parent.children.length) {
        parent.insertChild(index, component)
      } else {
        parent.appendChild(component)
      }

      frame.remove()
      figma.currentPage.selection = [component]

      return {
        success: true,
        message: `Created component "${component.name}"`,
        componentId: component.id,
      }
    }

    // If it's a GROUP
    if (node.type === 'GROUP') {
      const group = node as GroupNode
      const parent = group.parent || figma.currentPage
      const index = parent.children.indexOf(group)

      const component = figma.createComponent()
      component.name = compName
      component.x = group.x
      component.y = group.y
      component.resize(Math.max(1, group.width), Math.max(1, group.height))

      const children = [...group.children]
      for (const child of children) {
        // Adjust child x,y relative to component origin
        const origX = child.x
        const origY = child.y
        component.appendChild(child)
        child.x = origX - group.x
        child.y = origY - group.y
      }

      if (index >= 0 && index < parent.children.length) {
        parent.insertChild(index, component)
      } else {
        parent.appendChild(component)
      }

      group.remove()
      figma.currentPage.selection = [component]

      return {
        success: true,
        message: `Created component "${component.name}"`,
        componentId: component.id,
      }
    }

    // For other single nodes (shapes, text, instances)
    const parent = node.parent || figma.currentPage
    const index = parent.children.indexOf(node)

    const component = figma.createComponent()
    component.name = compName
    component.x = node.x
    component.y = node.y
    component.resize(Math.max(1, node.width), Math.max(1, node.height))

    const origX = node.x
    const origY = node.y

    if (index >= 0 && index < parent.children.length) {
      parent.insertChild(index, component)
    } else {
      parent.appendChild(component)
    }

    component.appendChild(node)
    node.x = 0
    node.y = 0

    figma.currentPage.selection = [component]
    return {
      success: true,
      message: `Created component "${component.name}"`,
      componentId: component.id,
    }
  }

  // Multiple layers selected: wrap into a single component
  const parent = selection[0].parent || figma.currentPage
  const minX = Math.min(...selection.map(n => n.x))
  const minY = Math.min(...selection.map(n => n.y))
  const maxX = Math.max(...selection.map(n => n.x + n.width))
  const maxY = Math.max(...selection.map(n => n.y + n.height))
  const width = Math.max(1, maxX - minX)
  const height = Math.max(1, maxY - minY)

  const compName = payload?.name?.trim() || 'New Component'
  const component = figma.createComponent()
  component.name = compName
  component.x = minX
  component.y = minY
  component.resize(width, height)

  parent.appendChild(component)

  // Move each node inside component adjusting coordinates
  for (const node of selection) {
    const origX = node.x
    const origY = node.y
    component.appendChild(node)
    node.x = origX - minX
    node.y = origY - minY
  }

  figma.currentPage.selection = [component]

  return {
    success: true,
    message: `Combined ${selection.length} layers into component "${component.name}"`,
    componentId: component.id,
  }
}

// -------------------------------------------------------
// 2. COMPONENT & SECTION SUMMARY HELPERS
// -------------------------------------------------------

export interface ChildSummary {
  hasText: boolean
  hasImage: boolean
  hasVector: boolean
  firstTextSnippet: string
  allTextSnippets: string[]
  maxFontSize: number
  minFontSize: number
  textCount: number
  childCount: number
  isAutoLayout: boolean
  layoutDirection: 'HORIZONTAL' | 'VERTICAL' | 'NONE'
}

export function summarizeNodeChildren(node: SceneNode): ChildSummary {
  let hasText = false
  let hasImage = false
  let hasVector = false
  let firstTextSnippet = ''
  const allTextSnippets: string[] = []
  let maxFontSize = 0
  let minFontSize = 9999
  let textCount = 0

  function inspect(n: SceneNode) {
    if (n.type === 'TEXT') {
      hasText = true
      textCount++
      const textNode = n as TextNode
      const chars = textNode.characters.trim()
      if (chars) {
        if (!firstTextSnippet) firstTextSnippet = chars.slice(0, 28)
        allTextSnippets.push(chars)
      }
      const fs = typeof textNode.fontSize === 'number' ? textNode.fontSize : 16
      if (fs > maxFontSize) maxFontSize = fs
      if (fs < minFontSize) minFontSize = fs
    }
    if (n.type === 'VECTOR' || n.type === 'BOOLEAN_OPERATION' || n.type === 'LINE' || n.type === 'STAR' || n.type === 'POLYGON') {
      hasVector = true
    }
    if ('fills' in n && Array.isArray(n.fills)) {
      for (const f of n.fills as Paint[]) {
        if (f.type === 'IMAGE') hasImage = true
      }
    }
    if ('children' in n) {
      for (const c of (n as ChildrenMixin).children) {
        inspect(c)
      }
    }
  }

  if ('children' in node) {
    for (const child of (node as ChildrenMixin).children) {
      inspect(child)
    }
  } else {
    inspect(node)
  }

  let isAutoLayout = false
  let layoutDirection: 'HORIZONTAL' | 'VERTICAL' | 'NONE' = 'NONE'
  if ('layoutMode' in node && (node as FrameNode).layoutMode !== 'NONE') {
    isAutoLayout = true
    layoutDirection = (node as FrameNode).layoutMode
  }

  return {
    hasText,
    hasImage,
    hasVector,
    firstTextSnippet,
    allTextSnippets,
    maxFontSize,
    minFontSize: minFontSize === 9999 ? 16 : minFontSize,
    textCount,
    childCount: 'children' in node ? (node as ChildrenMixin).children.length : 0,
    isAutoLayout,
    layoutDirection,
  }
}

// -------------------------------------------------------
// 3. SECTION DETECTION & HIERARCHICAL CONTEXT
// -------------------------------------------------------

export type SectionKind =
  | 'HEADER'
  | 'HERO'
  | 'FEATURES'
  | 'PRICING'
  | 'TESTIMONIALS'
  | 'FAQ'
  | 'CONTACT'
  | 'CTA'
  | 'FOOTER'
  | 'SIDEBAR'
  | 'GENERIC_SECTION'
  | 'MODAL'
  | 'NONE'

export interface SectionClassification {
  kind: SectionKind
  sectionPrefix: string
  sectionName: string
  confidence: 'high' | 'medium' | 'low'
}

export interface NamingContext {
  sectionKind: SectionKind
  sectionPrefix: string
  parentRole: 'SECTION' | 'CARD' | 'BUTTON' | 'INPUT' | 'NAV_MENU' | 'LIST' | 'GRID' | 'ROW' | 'COLUMN' | 'MODAL' | 'MEDIA' | 'FOOTER_LINKS' | 'NONE'
  cardIndex?: number
  totalCards?: number
  isFirstSection?: boolean
  isLastSection?: boolean
}

export function detectSectionKind(
  node: SceneNode,
  sectionIndex: number,
  totalSections: number
): SectionClassification {
  const nameLower = (node.name || '').toLowerCase()
  const summary = summarizeNodeChildren(node)
  const allText = summary.allTextSnippets.join(' ').toLowerCase()
  const { width, height } = node
  const isTop = sectionIndex === 0 || (node.y >= 0 && node.y < 180)
  const isBottom = totalSections > 1 && sectionIndex === totalSections - 1

  // Explicit name matches
  if (nameLower.includes('nav') || nameLower.includes('header') || nameLower.includes('topbar') || nameLower.includes('navbar')) {
    return { kind: 'HEADER', sectionPrefix: 'Nav', sectionName: 'Header / Navigation', confidence: 'high' }
  }
  if (nameLower.includes('hero') || nameLower.includes('intro') || nameLower.includes('banner')) {
    return { kind: 'HERO', sectionPrefix: 'Hero', sectionName: 'Hero Section', confidence: 'high' }
  }
  if (nameLower.includes('feature') || nameLower.includes('benefit') || nameLower.includes('service') || nameLower.includes('why us')) {
    return { kind: 'FEATURES', sectionPrefix: 'Feature', sectionName: 'Features Section', confidence: 'high' }
  }
  if (nameLower.includes('pricing') || nameLower.includes('plan') || nameLower.includes('tier') || nameLower.includes('subscription')) {
    return { kind: 'PRICING', sectionPrefix: 'Pricing', sectionName: 'Pricing Section', confidence: 'high' }
  }
  if (nameLower.includes('testimonial') || nameLower.includes('review') || nameLower.includes('story') || nameLower.includes('stories')) {
    return { kind: 'TESTIMONIALS', sectionPrefix: 'Testimonial', sectionName: 'Testimonials Section', confidence: 'high' }
  }
  if (nameLower.includes('faq') || nameLower.includes('question') || nameLower.includes('accord')) {
    return { kind: 'FAQ', sectionPrefix: 'FAQ', sectionName: 'FAQ Section', confidence: 'high' }
  }
  if (nameLower.includes('contact') || nameLower.includes('touch') || nameLower.includes('reach')) {
    return { kind: 'CONTACT', sectionPrefix: 'Contact', sectionName: 'Contact Section', confidence: 'high' }
  }
  if (nameLower.includes('footer') || nameLower.includes('bottom') || nameLower.includes('copyright')) {
    return { kind: 'FOOTER', sectionPrefix: 'Footer', sectionName: 'Footer', confidence: 'high' }
  }
  if (nameLower.includes('sidebar') || nameLower.includes('drawer') || nameLower.includes('aside')) {
    return { kind: 'SIDEBAR', sectionPrefix: 'Sidebar', sectionName: 'Sidebar', confidence: 'high' }
  }

  // 1. Header / Navigation detection
  if (isTop && width >= 400 && height <= 140) {
    if (
      allText.includes('home') ||
      allText.includes('about') ||
      allText.includes('pricing') ||
      allText.includes('features') ||
      allText.includes('contact') ||
      allText.includes('sign in') ||
      allText.includes('sign up') ||
      allText.includes('log in') ||
      allText.includes('menu') ||
      summary.layoutDirection === 'HORIZONTAL' ||
      summary.textCount >= 2
    ) {
      return { kind: 'HEADER', sectionPrefix: 'Nav', sectionName: 'Header / Navigation', confidence: 'high' }
    }
  }

  // 2. Features Section detection (Checked before general bottom check)
  if (
    allText.includes('feature') ||
    allText.includes('why choose') ||
    allText.includes('what we offer') ||
    allText.includes('how it works') ||
    allText.includes('benefits') ||
    allText.includes('services') ||
    (summary.childCount >= 2 && summary.hasImage)
  ) {
    return { kind: 'FEATURES', sectionPrefix: 'Feature', sectionName: 'Features Section', confidence: 'high' }
  }

  // 3. Pricing Section detection
  if (
    allText.includes('pricing') ||
    allText.includes('billed') ||
    allText.includes('/mo') ||
    allText.includes('/month') ||
    allText.includes('/yr') ||
    allText.includes('/year') ||
    allText.includes('enterprise') ||
    (allText.includes('$') && allText.includes('plan'))
  ) {
    return { kind: 'PRICING', sectionPrefix: 'Pricing', sectionName: 'Pricing Section', confidence: 'high' }
  }

  // 4. Testimonials Section detection
  if (
    allText.includes('testimonial') ||
    allText.includes('what our clients') ||
    allText.includes('what our users') ||
    allText.includes('customer reviews') ||
    allText.includes('stories') ||
    allText.includes('rated 5') ||
    (allText.includes('“') || allText.includes('”') || allText.includes('"'))
  ) {
    return { kind: 'TESTIMONIALS', sectionPrefix: 'Testimonial', sectionName: 'Testimonials Section', confidence: 'high' }
  }

  // 5. FAQ Section detection
  if (
    allText.includes('faq') ||
    allText.includes('frequently asked') ||
    allText.includes('have questions') ||
    (allText.includes('?') && summary.textCount >= 4)
  ) {
    return { kind: 'FAQ', sectionPrefix: 'FAQ', sectionName: 'FAQ Section', confidence: 'high' }
  }

  // 6. Contact Section detection
  if (
    allText.includes('contact') ||
    allText.includes('get in touch') ||
    allText.includes('send us a message') ||
    allText.includes('email us')
  ) {
    return { kind: 'CONTACT', sectionPrefix: 'Contact', sectionName: 'Contact Section', confidence: 'high' }
  }

  // 7. Hero Section detection
  if (
    (sectionIndex <= 1 && height >= 250 && summary.maxFontSize >= 24) ||
    allText.includes('get started') ||
    allText.includes('try for free') ||
    allText.includes('build your') ||
    allText.includes('next generation') ||
    allText.includes('the best way to')
  ) {
    return { kind: 'HERO', sectionPrefix: 'Hero', sectionName: 'Hero Section', confidence: 'high' }
  }

  // 8. Footer detection
  if (
    allText.includes('copyright') ||
    allText.includes('©') ||
    allText.includes('all rights reserved') ||
    allText.includes('privacy policy') ||
    allText.includes('terms of service') ||
    (isBottom && height >= 60 && height <= 320 && summary.textCount >= 1)
  ) {
    return { kind: 'FOOTER', sectionPrefix: 'Footer', sectionName: 'Footer', confidence: 'high' }
  }

  // 4. Testimonials Section detection
  if (
    allText.includes('testimonial') ||
    allText.includes('what our clients') ||
    allText.includes('what our users') ||
    allText.includes('customer reviews') ||
    allText.includes('stories') ||
    allText.includes('rated 5') ||
    (allText.includes('“') || allText.includes('”') || allText.includes('"'))
  ) {
    return { kind: 'TESTIMONIALS', sectionPrefix: 'Testimonial', sectionName: 'Testimonials Section', confidence: 'high' }
  }

  // 5. FAQ Section detection
  if (
    allText.includes('faq') ||
    allText.includes('frequently asked') ||
    allText.includes('have questions') ||
    (allText.includes('?') && summary.textCount >= 4)
  ) {
    return { kind: 'FAQ', sectionPrefix: 'FAQ', sectionName: 'FAQ Section', confidence: 'high' }
  }

  // 6. Contact Section detection
  if (
    allText.includes('contact') ||
    allText.includes('get in touch') ||
    allText.includes('send us a message') ||
    allText.includes('email us')
  ) {
    return { kind: 'CONTACT', sectionPrefix: 'Contact', sectionName: 'Contact Section', confidence: 'high' }
  }

  // 7. Hero Section detection
  if (
    (sectionIndex <= 1 && height >= 250 && summary.maxFontSize >= 24) ||
    allText.includes('get started') ||
    allText.includes('try for free') ||
    allText.includes('build your') ||
    allText.includes('next generation') ||
    allText.includes('the best way to')
  ) {
    return { kind: 'HERO', sectionPrefix: 'Hero', sectionName: 'Hero Section', confidence: 'high' }
  }

  // 8. Features Section detection
  if (
    allText.includes('feature') ||
    allText.includes('why choose') ||
    allText.includes('what we offer') ||
    allText.includes('how it works') ||
    allText.includes('benefits') ||
    allText.includes('services') ||
    (summary.childCount >= 3 && summary.hasImage)
  ) {
    return { kind: 'FEATURES', sectionPrefix: 'Feature', sectionName: 'Features Section', confidence: 'medium' }
  }

  // 9. CTA Section detection
  if (height <= 360 && summary.textCount <= 4 && (allText.includes('ready to') || allText.includes('start now') || allText.includes('join'))) {
    return { kind: 'CTA', sectionPrefix: 'CTA', sectionName: 'CTA Section', confidence: 'medium' }
  }

  // 10. Sidebar
  if (width <= 320 && height >= 400) {
    return { kind: 'SIDEBAR', sectionPrefix: 'Sidebar', sectionName: 'Sidebar', confidence: 'medium' }
  }

  // Generic numbered section
  const sectionNum = String(sectionIndex + 1).padStart(2, '0')
  return {
    kind: 'GENERIC_SECTION',
    sectionPrefix: `Section ${sectionNum}`,
    sectionName: `Section ${sectionNum}`,
    confidence: 'low',
  }
}

// -------------------------------------------------------
// 4. COMPONENT NAMING
// -------------------------------------------------------

export function inferSemanticComponentName(
  node: SceneNode,
  index: number
): { name: string; confidence: 'high' | 'medium' | 'low'; reason: string } {
  const { width, height } = node
  const summary = summarizeNodeChildren(node)
  const currentName = node.name.trim()

  // 1. Icon Button / Button
  if (height >= 24 && height <= 64 && width >= 24 && width <= 360) {
    if (summary.hasText && summary.textCount <= 2) {
      const snippet = summary.firstTextSnippet
      if (snippet) {
        return {
          name: `Button / ${snippet}`,
          confidence: 'high',
          reason: `Button dimensions (${Math.round(width)}×${Math.round(height)}) with label "${snippet}"`,
        }
      }
      return {
        name: 'Button / Primary',
        confidence: 'high',
        reason: `Button dimensions (${Math.round(width)}×${Math.round(height)}) with text label`,
      }
    }
    if ((summary.hasVector || summary.childCount <= 2) && width <= 64) {
      return {
        name: 'Button / Icon',
        confidence: 'high',
        reason: `Square button dimensions (${Math.round(width)}×${Math.round(height)}) with icon`,
      }
    }
  }

  // 2. Input / Form Field
  if (height >= 32 && height <= 56 && width >= 120 && summary.hasText) {
    const snippetLower = summary.firstTextSnippet.toLowerCase()
    if (
      snippetLower.includes('search') ||
      snippetLower.includes('email') ||
      snippetLower.includes('password') ||
      snippetLower.includes('enter') ||
      snippetLower.includes('type') ||
      snippetLower.includes('name') ||
      snippetLower.includes('placeholder')
    ) {
      return {
        name: `Input / ${summary.firstTextSnippet}`,
        confidence: 'high',
        reason: `Input-height frame with field placeholder "${summary.firstTextSnippet}"`,
      }
    }
  }

  // 3. Navigation / Header
  if (width >= 480 && height <= 140 && summary.layoutDirection === 'HORIZONTAL') {
    if (summary.textCount >= 2 || summary.childCount >= 3) {
      return {
        name: 'Navigation / Header',
        confidence: 'high',
        reason: `Horizontal bar (${Math.round(width)}×${Math.round(height)}) with navigation items`,
      }
    }
  }

  // 4. Footer
  if (width >= 480 && height >= 80 && summary.textCount >= 3) {
    const allText = summary.allTextSnippets.join(' ').toLowerCase()
    if (allText.includes('copyright') || allText.includes('©') || allText.includes('privacy') || allText.includes('terms')) {
      return {
        name: 'Footer',
        confidence: 'high',
        reason: 'Wide footer frame containing footer links / copyright',
      }
    }
  }

  // 5. Card
  if (width >= 160 && width <= 540 && height >= 140 && height <= 720) {
    if ((summary.hasImage && summary.hasText) || summary.textCount >= 2) {
      const heading = summary.firstTextSnippet ? ` / ${summary.firstTextSnippet}` : ''
      return {
        name: `Card${heading}`,
        confidence: 'high',
        reason: `Card container with mixed content (${summary.hasImage ? 'Image + ' : ''}${summary.textCount} texts)`,
      }
    }
  }

  // 6. Modal / Dialog
  if (width >= 280 && width <= 720 && height >= 200 && height <= 600 && summary.textCount >= 2) {
    if ('effects' in node && Array.isArray(node.effects) && node.effects.some(e => e.type === 'DROP_SHADOW')) {
      return {
        name: 'Modal / Dialog',
        confidence: 'high',
        reason: 'Framed dialog with elevation shadow and content',
      }
    }
  }

  // 7. Hero Section
  if (width >= 600 && height >= 250 && summary.hasText && summary.maxFontSize >= 24) {
    return {
      name: 'Hero Section',
      confidence: 'high',
      reason: `Hero header frame (${Math.round(width)}×${Math.round(height)}) with prominent headline`,
    }
  }

  // 8. Avatar
  if (width <= 96 && height <= 96 && Math.abs(width - height) <= 4) {
    if (summary.hasImage || node.type === 'ELLIPSE' || ('cornerRadius' in node && (node as FrameNode).cornerRadius >= width / 2)) {
      return {
        name: 'Avatar',
        confidence: 'high',
        reason: `Circular/avatar dimensions (${Math.round(width)}×${Math.round(height)})`,
      }
    }
  }

  // 9. Icon
  if (width <= 48 && height <= 48 && (summary.hasVector || node.type === 'VECTOR')) {
    return {
      name: 'Icon',
      confidence: 'high',
      reason: `Small icon dimensions (${Math.round(width)}×${Math.round(height)})`,
    }
  }

  // Fallback
  if (isGenericName(currentName)) {
    const num = String(index + 1).padStart(2, '0')
    return {
      name: `Component / ${num}`,
      confidence: 'low',
      reason: `Generic layer name "${currentName}" standardized`,
    }
  }

  return {
    name: currentName,
    confidence: 'low',
    reason: 'Existing name is already custom and descriptive',
  }
}

export function getComponentNamingAnalysis(
  selection: readonly SceneNode[],
  scope: 'selection' | 'page' = 'selection'
): ComponentNamingAnalysis {
  let targetNodes: SceneNode[] = []

  if (scope === 'selection' && selection && selection.length > 0) {
    for (const node of selection) {
      if (node.type === 'COMPONENT' || node.type === 'FRAME' || node.type === 'COMPONENT_SET') {
        targetNodes.push(node)
      } else if ('children' in node) {
        for (const child of (node as ChildrenMixin).children) {
          if (child.type === 'COMPONENT' || child.type === 'FRAME') {
            targetNodes.push(child)
          }
        }
      }
    }
  } else {
    targetNodes = figma.currentPage.findAll(
      n => n.type === 'COMPONENT' || (n.type === 'FRAME' && n.parent?.type === 'PAGE')
    )
  }

  const uniqueNodes = Array.from(new Set(targetNodes))
  const items: ComponentRenameItem[] = []

  uniqueNodes.forEach((node, idx) => {
    const result = inferSemanticComponentName(node, idx)
    const isDifferent = result.name !== node.name
    items.push({
      nodeId: node.id,
      currentName: node.name,
      suggestedName: result.name,
      confidence: result.confidence,
      reason: result.reason,
      checked: isDifferent,
    })
  })

  return { items }
}

export async function applyComponentRenames(
  payload: ApplyComponentRenamesPayload
): Promise<number> {
  let count = 0
  for (const item of payload.renames) {
    const node = figma.getNodeById(item.nodeId)
    if (node && 'name' in node && item.newName.trim()) {
      node.name = item.newName.trim()
      count++
    }
  }
  return count
}

// -------------------------------------------------------
// 5. HIERARCHICAL & SECTION-WISE LAYER NAMING
// -------------------------------------------------------

export function inferContextualLayerName(
  node: SceneNode,
  parent: SceneNode | null,
  context: NamingContext,
  siblingIndex: number,
  totalSiblings: number
): string | null {
  const currentName = node.name.trim()

  // Always preserve non-generic, descriptive user-given names
  if (!isGenericName(currentName)) {
    return null
  }

  const { width, height } = node
  const prefix = context.sectionPrefix || ''

  // ==========================================
  // 1. TEXT NODES
  // ==========================================
  if (node.type === 'TEXT') {
    const textNode = node as TextNode
    const chars = textNode.characters.trim()
    const fontSize = typeof textNode.fontSize === 'number' ? textNode.fontSize : 16
    const isBold = typeof textNode.fontName === 'object' && !('style' in textNode.fontName ? false : false) &&
      (textNode.fontName as FontName)?.style?.toLowerCase()?.includes('bold')

    if (!chars) return 'Text'

    // Button label context
    if (context.parentRole === 'BUTTON') {
      return 'Button Label'
    }

    // Input context
    if (context.parentRole === 'INPUT') {
      return chars.length <= 25 ? 'Placeholder Text' : 'Input Label'
    }

    // Navigation Header context
    if (context.sectionKind === 'HEADER') {
      if (chars.length <= 24 && (context.parentRole === 'NAV_MENU' || context.parentRole === 'ROW' || parent?.type === 'FRAME')) {
        return 'Nav Item'
      }
      if (fontSize >= 18 || isBold) {
        return 'Logo'
      }
    }

    // Hero Section context
    if (context.sectionKind === 'HERO') {
      if (fontSize >= 24 || (fontSize >= 20 && chars.length <= 80 && siblingIndex === 0)) {
        return 'Hero Heading'
      }
      if (fontSize >= 14 && chars.length > 20) {
        return 'Hero Description'
      }
      if (fontSize < 14 && chars.length <= 30) {
        return 'Hero Eyebrow'
      }
    }

    // Feature Card context
    if (context.sectionKind === 'FEATURES' || context.parentRole === 'CARD') {
      if (fontSize >= 18 || (isBold && chars.length <= 40) || (siblingIndex === 0 && chars.length <= 40)) {
        return `${prefix} Title` || 'Card Title'
      }
      if (chars.length > 40 || fontSize <= 15) {
        return `${prefix} Description` || 'Card Description'
      }
      if (chars.length <= 20) {
        return 'Badge Label'
      }
    }

    // Pricing Section context
    if (context.sectionKind === 'PRICING') {
      if (chars.includes('$') || chars.includes('€') || chars.includes('£') || /^\d+(\.\d+)?$/.test(chars)) {
        return 'Price'
      }
      if (chars.toLowerCase().includes('/mo') || chars.toLowerCase().includes('month') || chars.toLowerCase().includes('annual')) {
        return 'Billing Period'
      }
      if (fontSize >= 18 || isBold) {
        return 'Plan Name'
      }
      if (chars.length <= 40) {
        return 'Feature Item'
      }
    }

    // Testimonials Section context
    if (context.sectionKind === 'TESTIMONIALS') {
      if (chars.length > 40 || chars.includes('“') || chars.includes('”') || chars.includes('"')) {
        return 'Testimonial Quote'
      }
      if (chars.length <= 25 && isBold) {
        return 'Author Name'
      }
      if (chars.length <= 40) {
        return 'Author Role'
      }
    }

    // FAQ Section context
    if (context.sectionKind === 'FAQ') {
      if (chars.includes('?') || isBold || fontSize >= 16) {
        return 'FAQ Question'
      }
      return 'FAQ Answer'
    }

    // Footer context
    if (context.sectionKind === 'FOOTER') {
      if (chars.toLowerCase().includes('copyright') || chars.includes('©') || chars.toLowerCase().includes('all rights')) {
        return 'Copyright Text'
      }
      if (fontSize >= 14 && isBold && chars.length <= 25) {
        return 'Column Title'
      }
      if (chars.length <= 30) {
        return 'Footer Link'
      }
    }

    // General text rules
    if (fontSize >= 28) return 'Main Heading'
    if (fontSize >= 22) return 'Heading'
    if (fontSize >= 16 && isBold) return 'Title'
    if (chars.length > 60) return 'Body Text'
    if (chars.length <= 20) return 'Label'
    return 'Text'
  }

  // ==========================================
  // 2. RECTANGLE
  // ==========================================
  if (node.type === 'RECTANGLE') {
    // Section/parent full-bleed background
    if (parent && 'width' in parent && 'height' in parent) {
      if (
        Math.abs(node.x) <= 4 &&
        Math.abs(node.y) <= 4 &&
        Math.abs(width - parent.width) <= 8 &&
        Math.abs(height - parent.height) <= 8
      ) {
        return 'Background'
      }
    }

    // Check for Image Fill
    if ('fills' in node && Array.isArray(node.fills)) {
      for (const fill of node.fills as Paint[]) {
        if (fill.type === 'IMAGE') {
          if (context.sectionKind === 'HERO') return 'Hero Image'
          if (context.sectionKind === 'FEATURES') return 'Feature Image'
          if (context.sectionKind === 'TESTIMONIALS') return 'Author Avatar'
          if (context.parentRole === 'CARD') return 'Card Image'
          return 'Image'
        }
      }
    }

    // Divider line
    if (height <= 3 && width >= 40) {
      return 'Divider'
    }
    if (width <= 3 && height >= 40) {
      return 'Vertical Divider'
    }

    // Input background
    if (context.parentRole === 'INPUT') {
      return 'Input Background'
    }

    // Card background
    if (context.parentRole === 'CARD') {
      return 'Card Background'
    }

    return 'Container'
  }

  // ==========================================
  // 3. ELLIPSE
  // ==========================================
  if (node.type === 'ELLIPSE') {
    if (width <= 96 && Math.abs(width - height) <= 4) {
      if ('fills' in node && Array.isArray(node.fills)) {
        for (const fill of node.fills as Paint[]) {
          if (fill.type === 'IMAGE') return 'Avatar'
        }
      }
      if (width <= 16) return 'Status Indicator'
      if (context.sectionKind === 'TESTIMONIALS') return 'Author Avatar'
      return 'Avatar'
    }
    return 'Shape'
  }

  // ==========================================
  // 4. VECTOR / LINE / POLYGON / STAR
  // ==========================================
  if (node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION') {
    if (width <= 48 && height <= 48) {
      if (context.parentRole === 'BUTTON') return 'Button Icon'
      if (context.sectionKind === 'FAQ') return 'Accordion Icon'
      if (context.sectionKind === 'PRICING') return 'Check Icon'
      if (context.sectionKind === 'HEADER') return 'Nav Icon'
      if (context.sectionKind === 'FEATURES') return 'Feature Icon'
      if (context.sectionKind === 'FOOTER') return 'Social Icon'
      return 'Icon'
    }
    return 'Graphic'
  }

  if (node.type === 'LINE') {
    return 'Divider'
  }

  if (node.type === 'STAR') {
    return 'Star Icon'
  }

  if (node.type === 'POLYGON') {
    return width <= 32 ? 'Arrow Icon' : 'Shape'
  }

  // ==========================================
  // 5. FRAMES & GROUPS (CONTAINERS / COMPONENTS)
  // ==========================================
  if (node.type === 'FRAME' || node.type === 'GROUP') {
    const summary = summarizeNodeChildren(node)

    // A. Navigation Links Container
    if (context.sectionKind === 'HEADER' && summary.textCount >= 2) {
      return 'Nav Links'
    }

    // B. Card Container inside Grid or Section
    if (
      (context.parentRole === 'GRID' || context.parentRole === 'ROW' || context.parentRole === 'SECTION') &&
      width >= 140 &&
      width <= 540 &&
      height >= 100
    ) {
      const cardNum = String(siblingIndex + 1).padStart(2, '0')
      if (context.sectionKind === 'FEATURES') return `Feature Card ${cardNum}`
      if (context.sectionKind === 'PRICING') return `Pricing Card ${cardNum}`
      if (context.sectionKind === 'TESTIMONIALS') return `Testimonial Card ${cardNum}`
      if (context.sectionKind === 'FAQ') return `FAQ Item ${cardNum}`
      return `Card ${cardNum}`
    }

    // C. Grid / Row / Column / List Container
    if (summary.childCount >= 2 && width >= 300) {
      if (context.sectionKind === 'FEATURES') return 'Feature Grid'
      if (context.sectionKind === 'PRICING') return 'Pricing Grid'
      if (context.sectionKind === 'TESTIMONIALS') return 'Testimonial List'
      if (context.sectionKind === 'FAQ') return 'FAQ List'
      if (context.sectionKind === 'FOOTER' && summary.layoutDirection === 'HORIZONTAL') return 'Footer Columns'
      if (summary.layoutDirection === 'HORIZONTAL') return 'Row'
      return 'Grid'
    }

    // D. Button Detection
    if (height >= 26 && height <= 64 && width >= 40 && width <= 340 && summary.hasText && summary.textCount <= 1) {
      if (context.sectionKind === 'HERO') {
        return siblingIndex === 0 ? 'CTA Button' : 'Secondary Button'
      }
      if (context.sectionKind === 'HEADER') {
        return 'Sign In Button'
      }
      if (context.sectionKind === 'PRICING') {
        return 'Plan CTA Button'
      }
      return 'Button'
    }

    // E. Icon Button Detection
    if (width <= 56 && height <= 56 && (summary.hasVector || node.type === 'GROUP')) {
      return 'Icon Button'
    }

    // F. Input Field Detection
    if (height >= 32 && height <= 56 && width >= 120 && summary.hasText) {
      const firstLower = summary.firstTextSnippet.toLowerCase()
      if (firstLower.includes('search')) return 'Search Bar'
      if (firstLower.includes('email')) return 'Email Input'
      return 'Input Field'
    }

    // G. Avatar Container
    if (width <= 80 && height <= 80 && Math.abs(width - height) <= 4) {
      return 'Avatar'
    }

    // H. Badge / Pill
    if (height >= 20 && height <= 34 && width <= 200 && summary.hasText) {
      return 'Badge'
    }

    // I. Media Container
    if (summary.hasImage && summary.childCount <= 2) {
      return 'Media Container'
    }

    return 'Container'
  }

  return null
}

export function getLayerNamingAnalysis(
  selection: readonly SceneNode[],
  scope: 'selection' | 'page' = 'selection'
): LayerNamingAnalysis {
  const items: LayerRenameItem[] = []
  let totalChecked = 0

  function scanHierarchy(
    node: SceneNode,
    parent: SceneNode | null,
    context: NamingContext,
    siblingIndex: number,
    totalSiblings: number
  ) {
    totalChecked++
    // Skip locked layers
    if (node.locked) return

    // Evaluate current node
    const suggested = inferContextualLayerName(node, parent, context, siblingIndex, totalSiblings)
    if (suggested && suggested !== node.name) {
      items.push({
        nodeId: node.id,
        currentName: node.name,
        suggestedName: suggested,
        nodeType: node.type,
        checked: true,
      })
    }

    // Determine context for children
    if ('children' in node) {
      const children = (node as ChildrenMixin).children
      const childCount = children.length

      // Determine parent role
      let nextParentRole: NamingContext['parentRole'] = 'NONE'
      const nodeNameLower = (suggested || node.name).toLowerCase()

      if (nodeNameLower.includes('card')) {
        nextParentRole = 'CARD'
      } else if (nodeNameLower.includes('button')) {
        nextParentRole = 'BUTTON'
      } else if (nodeNameLower.includes('input') || nodeNameLower.includes('search')) {
        nextParentRole = 'INPUT'
      } else if (nodeNameLower.includes('nav link') || nodeNameLower.includes('nav menu') || nodeNameLower.includes('navigation')) {
        nextParentRole = 'NAV_MENU'
      } else if (nodeNameLower.includes('grid')) {
        nextParentRole = 'GRID'
      } else if (nodeNameLower.includes('list')) {
        nextParentRole = 'LIST'
      } else if (nodeNameLower.includes('footer column')) {
        nextParentRole = 'FOOTER_LINKS'
      } else if ('layoutMode' in node && (node as FrameNode).layoutMode === 'HORIZONTAL') {
        nextParentRole = 'ROW'
      } else if ('layoutMode' in node && (node as FrameNode).layoutMode === 'VERTICAL') {
        nextParentRole = 'COLUMN'
      }

      const nextContext: NamingContext = {
        ...context,
        parentRole: nextParentRole,
      }

      children.forEach((child, idx) => {
        scanHierarchy(child, node, nextContext, idx, childCount)
      })
    }
  }

  // Root scan: identify top-level sections
  const rootTargets =
    scope === 'selection' && selection && selection.length > 0
      ? [...selection]
      : [...figma.currentPage.children]

  rootTargets.forEach((root, rootIdx) => {
    // If root is a page artboard/frame containing sections, detect each child section
    if (root.type === 'FRAME' && 'children' in root && root.children.length > 0) {
      totalChecked++
      const frameChildren = (root as FrameNode).children
      const totalSections = frameChildren.length

      frameChildren.forEach((sectionNode, secIdx) => {
        // Classify section
        const classification = detectSectionKind(sectionNode, secIdx, totalSections)
        const suggestedSectionName = classification.sectionName

        // Propose rename if section frame has generic name
        if (isGenericName(sectionNode.name) && suggestedSectionName !== sectionNode.name && !sectionNode.locked) {
          items.push({
            nodeId: sectionNode.id,
            currentName: sectionNode.name,
            suggestedName: suggestedSectionName,
            nodeType: sectionNode.type,
            checked: true,
          })
        }

        const secContext: NamingContext = {
          sectionKind: classification.kind,
          sectionPrefix: classification.sectionPrefix,
          parentRole: 'SECTION',
        }

        // Recursively inspect inside section
        if ('children' in sectionNode) {
          const innerChildren = (sectionNode as ChildrenMixin).children
          innerChildren.forEach((inner, idx) => {
            scanHierarchy(inner, sectionNode, secContext, idx, innerChildren.length)
          })
        }
      })
    } else {
      // Single node or non-frame root
      const classification = detectSectionKind(root, rootIdx, rootTargets.length)
      const context: NamingContext = {
        sectionKind: classification.kind,
        sectionPrefix: classification.sectionPrefix,
        parentRole: 'SECTION',
      }
      scanHierarchy(root, null, context, rootIdx, rootTargets.length)
    }
  })

  return {
    items,
    totalLayersChecked: totalChecked,
  }
}

export async function applyLayerRenames(
  payload: ApplyLayerRenamesPayload
): Promise<number> {
  let count = 0
  for (const item of payload.renames) {
    const node = figma.getNodeById(item.nodeId)
    if (node && 'name' in node && item.newName.trim()) {
      node.name = item.newName.trim()
      count++
    }
  }
  return count
}

