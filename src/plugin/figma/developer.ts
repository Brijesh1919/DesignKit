// ============================================================
// Developer feature module for Figma plugin sandbox.
// Covers: Full-Hierarchy CSS Generator, Design-Token CSS Variables,
// Color Export, Design Token Export.
// ============================================================

import type {
  CssGeneratorData,
  ColorExportData,
  ColorExportItem,
  DesignTokensData,
} from '../../shared/types'
import { figmaRgbToHex } from './utilities'

// -------------------------------------------------------
// Helper: Convert Figma Paint to CSS Color string
// -------------------------------------------------------
function paintToCssColor(paint: Paint): string | null {
  if (paint.visible === false) return null

  if (paint.type === 'SOLID') {
    const { r, g, b } = paint.color
    const opacity = typeof paint.opacity === 'number' ? paint.opacity : 1
    if (opacity < 1) {
      const red = Math.round(r * 255)
      const green = Math.round(g * 255)
      const blue = Math.round(b * 255)
      const a = Math.round(opacity * 100) / 100
      return `rgba(${red}, ${green}, ${blue}, ${a})`
    }
    return figmaRgbToHex(r, g, b)
  }

  if (paint.type === 'GRADIENT_LINEAR') {
    const stops = paint.gradientStops
      .map(s => {
        const hex = figmaRgbToHex(s.color.r, s.color.g, s.color.b)
        const pos = Math.round(s.position * 100)
        return `${hex} ${pos}%`
      })
      .join(', ')
    return `linear-gradient(135deg, ${stops})`
  }

  return null
}

// -------------------------------------------------------
// Helper: Clean CSS class name generator (BEM & Kebab-case aware)
// -------------------------------------------------------
function sanitizeClassName(name: string): string {
  let clean = name
    .toLowerCase()
    .replace(/[/\\]+/g, '-') // Replace path slashes with hyphen
    .replace(/[^a-z0-9_-]+/g, '-') // Replace non-alphanumeric
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-+|-+$/g, '') // Trim leading/trailing hyphens

  if (!clean || /^\d+$/.test(clean)) {
    clean = `item-${clean || 'element'}`
  }
  return clean
}

function deriveContextualClassName(
  node: SceneNode,
  parentClassName: string | null,
  usedNames: Map<string, number>
): string {
  const nodeName = node.name.trim()
  const rawClean = sanitizeClassName(nodeName)

  let baseClass = rawClean

  // If node has generic name (e.g. Frame 1, Rectangle 2, Text 3), infer semantic name
  const isGeneric = /^(rectangle|frame|group|text|ellipse|vector|line|polygon|star|union|component|section)\s*\d+$/i.test(nodeName)

  if (isGeneric) {
    if (node.type === 'TEXT') {
      const textNode = node as TextNode
      const fs = typeof textNode.fontSize === 'number' ? textNode.fontSize : 16
      if (fs >= 24) baseClass = parentClassName ? `${parentClassName}__title` : 'heading'
      else if (fs >= 18) baseClass = parentClassName ? `${parentClassName}__subtitle` : 'subheading'
      else baseClass = parentClassName ? `${parentClassName}__text` : 'text'
    } else if (node.type === 'RECTANGLE' || node.type === 'ELLIPSE') {
      baseClass = parentClassName ? `${parentClassName}__shape` : 'shape'
    } else if (node.type === 'FRAME' || node.type === 'GROUP') {
      baseClass = parentClassName ? `${parentClassName}__container` : 'container'
    }
  } else if (parentClassName && !rawClean.startsWith(parentClassName)) {
    // If it's a child with a specific sub-name (e.g. Title inside Hero -> hero__title)
    if (['title', 'heading', 'description', 'body', 'subtitle', 'image', 'icon', 'logo', 'button', 'cta', 'nav', 'card', 'header', 'footer', 'input', 'label'].includes(rawClean)) {
      baseClass = `${parentClassName}__${rawClean}`
    }
  }

  // Ensure unique class names when duplicate elements exist (e.g. .feature-card, .feature-card-2)
  if (!usedNames.has(baseClass)) {
    usedNames.set(baseClass, 1)
    return baseClass
  } else {
    const count = usedNames.get(baseClass)! + 1
    usedNames.set(baseClass, count)
    return `${baseClass}-${count}`
  }
}

// -------------------------------------------------------
// 1. RECURSIVE HIERARCHICAL CSS GENERATOR
// -------------------------------------------------------
export function getCssForSelection(
  selection: readonly SceneNode[]
): CssGeneratorData | null {
  if (!selection || selection.length === 0) return null

  const rootNode = selection[0]
  const cssRules: string[] = []
  const usedNames = new Map<string, number>()
  let totalPropertiesCount = 0

  function processNode(node: SceneNode, parentClassName: string | null, isRoot: boolean) {
    // Skip invisible nodes
    if (node.visible === false) return

    const className = deriveContextualClassName(node, parentClassName, usedNames)
    const props: string[] = []

    const width = Math.round(node.width)
    const height = Math.round(node.height)

    // 1. Layout & Dimensions
    if (isRoot) {
      if (width >= 1000 || height >= 1000) {
        // Page/Screen container: avoid rigid fixed height
        props.push(`  width: 100%;`)
        props.push(`  max-width: ${width}px;`)
        props.push(`  min-height: 100vh;`)
        totalPropertiesCount += 3
      } else {
        props.push(`  width: ${width}px;`)
        props.push(`  height: ${height}px;`)
        totalPropertiesCount += 2
      }
    } else {
      // Child node dimensions
      if ('layoutGrow' in node && (node as any).layoutGrow === 1) {
        props.push(`  flex: 1;`)
        totalPropertiesCount++
      } else if ('layoutAlign' in node && (node as any).layoutAlign === 'STRETCH') {
        props.push(`  align-self: stretch;`)
        totalPropertiesCount++
      }

      if ('layoutMode' in node && (node as FrameNode).layoutMode !== 'NONE') {
        const frame = node as FrameNode
        if (frame.primaryAxisSizingMode === 'FIXED') {
          props.push(`  width: ${width}px;`)
          totalPropertiesCount++
        }
        if (frame.counterAxisSizingMode === 'FIXED') {
          props.push(`  height: ${height}px;`)
          totalPropertiesCount++
        }
      } else if (node.type !== 'TEXT') {
        props.push(`  width: ${width}px;`)
        props.push(`  height: ${height}px;`)
        totalPropertiesCount += 2
      }
    }

    // 2. Auto Layout (Flexbox)
    if ('layoutMode' in node && (node as FrameNode).layoutMode !== 'NONE') {
      const frame = node as FrameNode
      props.push('  display: flex;')
      totalPropertiesCount++

      if (frame.layoutMode === 'VERTICAL') {
        props.push('  flex-direction: column;')
      } else {
        props.push('  flex-direction: row;')
      }
      totalPropertiesCount++

      if ('layoutWrap' in frame && (frame as any).layoutWrap === 'WRAP') {
        props.push('  flex-wrap: wrap;')
        totalPropertiesCount++
      }

      if (frame.itemSpacing > 0) {
        props.push(`  gap: ${Math.round(frame.itemSpacing)}px;`)
        totalPropertiesCount++
      }

      // Padding
      const pt = Math.round(frame.paddingTop || 0)
      const pr = Math.round(frame.paddingRight || 0)
      const pb = Math.round(frame.paddingBottom || 0)
      const pl = Math.round(frame.paddingLeft || 0)

      if (pt > 0 || pr > 0 || pb > 0 || pl > 0) {
        if (pt === pr && pr === pb && pb === pl) {
          props.push(`  padding: ${pt}px;`)
        } else if (pt === pb && pr === pl) {
          props.push(`  padding: ${pt}px ${pr}px;`)
        } else {
          props.push(`  padding: ${pt}px ${pr}px ${pb}px ${pl}px;`)
        }
        totalPropertiesCount++
      }

      // Alignment
      if (frame.primaryAxisAlignItems === 'CENTER') {
        props.push('  justify-content: center;')
        totalPropertiesCount++
      } else if (frame.primaryAxisAlignItems === 'MAX') {
        props.push('  justify-content: flex-end;')
        totalPropertiesCount++
      } else if (frame.primaryAxisAlignItems === 'SPACE_BETWEEN') {
        props.push('  justify-content: space-between;')
        totalPropertiesCount++
      }

      if (frame.counterAxisAlignItems === 'CENTER') {
        props.push('  align-items: center;')
        totalPropertiesCount++
      } else if (frame.counterAxisAlignItems === 'MAX') {
        props.push('  align-items: flex-end;')
        totalPropertiesCount++
      }
    }

    // 3. Fills & Backgrounds
    if ('fills' in node && Array.isArray(node.fills) && node.fills.length > 0) {
      let hasImageFill = false
      for (const fill of node.fills as Paint[]) {
        if (fill.visible === false) continue

        if (fill.type === 'IMAGE') {
          hasImageFill = true
          props.push('  /* Image fill from Figma */')
          props.push('  background-size: cover;')
          props.push('  background-position: center;')
          totalPropertiesCount += 2
        } else {
          const colorStr = paintToCssColor(fill)
          if (colorStr) {
            if (node.type === 'TEXT') {
              props.push(`  color: ${colorStr};`)
            } else {
              props.push(`  background: ${colorStr};`)
            }
            totalPropertiesCount++
          }
        }
      }
    }

    // 4. Borders & Corner Radius
    if ('strokes' in node && Array.isArray(node.strokes) && node.strokes.length > 0) {
      const stroke = (node.strokes as Paint[]).find(s => s.visible !== false)
      if (stroke) {
        const strokeColor = paintToCssColor(stroke)
        const weight = 'strokeWeight' in node && typeof (node as GeometryMixin).strokeWeight === 'number'
          ? Math.round((node as GeometryMixin).strokeWeight as number)
          : 1
        if (strokeColor) {
          props.push(`  border: ${weight}px solid ${strokeColor};`)
          totalPropertiesCount++
        }
      }
    }

    if ('cornerRadius' in node) {
      const cr = (node as FrameNode).cornerRadius
      if (typeof cr === 'number' && cr > 0) {
        props.push(`  border-radius: ${Math.round(cr)}px;`)
        totalPropertiesCount++
      } else if (typeof cr === 'symbol') {
        const fn = node as FrameNode
        const tl = Math.round(fn.topLeftRadius || 0)
        const tr = Math.round(fn.topRightRadius || 0)
        const br = Math.round(fn.bottomRightRadius || 0)
        const bl = Math.round(fn.bottomLeftRadius || 0)
        if (tl || tr || br || bl) {
          props.push(`  border-radius: ${tl}px ${tr}px ${br}px ${bl}px;`)
          totalPropertiesCount++
        }
      }
    }

    // 5. Box Shadow & Effects
    if ('effects' in node && Array.isArray(node.effects)) {
      const shadows: string[] = []
      for (const eff of node.effects as Effect[]) {
        if (eff.visible !== false && eff.type === 'DROP_SHADOW') {
          const shadow = eff as DropShadowEffect
          const col = shadow.color
          const a = Math.round(col.a * 100) / 100
          const rgba = `rgba(${Math.round(col.r * 255)}, ${Math.round(col.g * 255)}, ${Math.round(col.b * 255)}, ${a})`
          const x = Math.round(shadow.offset.x)
          const y = Math.round(shadow.offset.y)
          const rad = Math.round(shadow.radius)
          const spr = Math.round(shadow.spread || 0)
          shadows.push(`${x}px ${y}px ${rad}px ${spr > 0 ? `${spr}px ` : ''}${rgba}`)
        }
      }
      if (shadows.length > 0) {
        props.push(`  box-shadow: ${shadows.join(', ')};`)
        totalPropertiesCount++
      }
    }

    // 6. Opacity & Overflow
    if ('opacity' in node && typeof node.opacity === 'number' && node.opacity < 1) {
      props.push(`  opacity: ${Math.round(node.opacity * 100) / 100};`)
      totalPropertiesCount++
    }

    if ('clipsContent' in node && (node as FrameNode).clipsContent) {
      props.push(`  overflow: hidden;`)
      totalPropertiesCount++
    }

    // 7. Typography (Text Nodes)
    if (node.type === 'TEXT') {
      const textNode = node as TextNode
      if (typeof textNode.fontSize === 'number') {
        props.push(`  font-size: ${Math.round(textNode.fontSize)}px;`)
        totalPropertiesCount++
      }

      if (typeof textNode.fontWeight === 'number') {
        props.push(`  font-weight: ${textNode.fontWeight};`)
        totalPropertiesCount++
      } else if (typeof textNode.fontName !== 'symbol' && textNode.fontName) {
        const fn = textNode.fontName as FontName
        props.push(`  font-family: '${fn.family}', sans-serif;`)
        const style = fn.style.toLowerCase()
        if (style.includes('bold')) props.push('  font-weight: 700;')
        else if (style.includes('medium')) props.push('  font-weight: 500;')
        else if (style.includes('semibold')) props.push('  font-weight: 600;')
        else props.push('  font-weight: 400;')
        totalPropertiesCount += 2
      }

      if (typeof textNode.lineHeight === 'object') {
        if (textNode.lineHeight.unit === 'PIXELS') {
          props.push(`  line-height: ${Math.round(textNode.lineHeight.value)}px;`)
          totalPropertiesCount++
        } else if (textNode.lineHeight.unit === 'PERCENT') {
          props.push(`  line-height: ${Math.round(textNode.lineHeight.value) / 100};`)
          totalPropertiesCount++
        }
      }

      if (typeof textNode.letterSpacing === 'object' && textNode.letterSpacing.value !== 0) {
        if (textNode.letterSpacing.unit === 'PIXELS') {
          props.push(`  letter-spacing: ${Math.round(textNode.letterSpacing.value * 100) / 100}px;`)
          totalPropertiesCount++
        }
      }

      if (textNode.textAlignHorizontal && textNode.textAlignHorizontal !== 'LEFT') {
        props.push(`  text-align: ${textNode.textAlignHorizontal.toLowerCase()};`)
        totalPropertiesCount++
      }

      if (typeof textNode.textCase === 'string' && textNode.textCase !== 'ORIGINAL') {
        if (textNode.textCase === 'UPPER') props.push('  text-transform: uppercase;')
        else if (textNode.textCase === 'LOWER') props.push('  text-transform: lowercase;')
        else if (textNode.textCase === 'TITLE') props.push('  text-transform: capitalize;')
        totalPropertiesCount++
      }
    }

    // Only output rule if it contains properties
    if (props.length > 0) {
      cssRules.push(`.${className} {\n${props.join('\n')}\n}`)
    }

    // Recursively process children
    if ('children' in node) {
      for (const child of (node as ChildrenMixin).children) {
        processNode(child, className, false)
      }
    }
  }

  // Process full hierarchy starting at root
  processNode(rootNode, null, true)

  const fullCss = cssRules.join('\n\n')

  // Generate genuine design-token CSS Variables
  const cssVariables = generateDesignTokenCssVariables(rootNode)

  return {
    nodeId: rootNode.id,
    nodeName: rootNode.name,
    css: fullCss,
    cssVariables,
    propertiesCount: totalPropertiesCount,
  }
}

// -------------------------------------------------------
// 2. DESIGN-TOKEN CSS VARIABLES GENERATOR
// -------------------------------------------------------
function generateDesignTokenCssVariables(rootNode: SceneNode): string {
  const colorUsage = new Map<string, number>()
  const spacingUsage = new Map<number, number>()
  const radiusUsage = new Map<number, number>()
  const fontSizeUsage = new Map<number, number>()
  const shadowUsage = new Map<string, number>()

  function scan(node: SceneNode) {
    if (node.visible === false) return

    // Colors
    if ('fills' in node && Array.isArray(node.fills)) {
      for (const f of node.fills as Paint[]) {
        if (f.visible !== false && f.type === 'SOLID') {
          const hex = figmaRgbToHex(f.color.r, f.color.g, f.color.b)
          colorUsage.set(hex, (colorUsage.get(hex) || 0) + 1)
        }
      }
    }

    if ('strokes' in node && Array.isArray(node.strokes)) {
      for (const s of node.strokes as Paint[]) {
        if (s.visible !== false && s.type === 'SOLID') {
          const hex = figmaRgbToHex(s.color.r, s.color.g, s.color.b)
          colorUsage.set(hex, (colorUsage.get(hex) || 0) + 1)
        }
      }
    }

    // Spacing
    if ('layoutMode' in node && (node as FrameNode).layoutMode !== 'NONE') {
      const f = node as FrameNode
      if (f.itemSpacing > 0) {
        const gap = Math.round(f.itemSpacing)
        spacingUsage.set(gap, (spacingUsage.get(gap) || 0) + 1)
      }
      if (f.paddingTop > 0) {
        const p = Math.round(f.paddingTop)
        spacingUsage.set(p, (spacingUsage.get(p) || 0) + 1)
      }
      if (f.paddingLeft > 0) {
        const p = Math.round(f.paddingLeft)
        spacingUsage.set(p, (spacingUsage.get(p) || 0) + 1)
      }
    }

    // Radius
    if ('cornerRadius' in node && typeof (node as FrameNode).cornerRadius === 'number') {
      const r = Math.round((node as FrameNode).cornerRadius as number)
      if (r > 0) radiusUsage.set(r, (radiusUsage.get(r) || 0) + 1)
    }

    // Font size
    if (node.type === 'TEXT') {
      const textNode = node as TextNode
      if (typeof textNode.fontSize === 'number') {
        const sz = Math.round(textNode.fontSize)
        fontSizeUsage.set(sz, (fontSizeUsage.get(sz) || 0) + 1)
      }
    }

    // Shadows
    if ('effects' in node && Array.isArray(node.effects)) {
      for (const eff of node.effects as Effect[]) {
        if (eff.visible !== false && eff.type === 'DROP_SHADOW') {
          const shadow = eff as DropShadowEffect
          const col = shadow.color
          const a = Math.round(col.a * 100) / 100
          const rgba = `rgba(${Math.round(col.r * 255)}, ${Math.round(col.g * 255)}, ${Math.round(col.b * 255)}, ${a})`
          const str = `${Math.round(shadow.offset.x)}px ${Math.round(shadow.offset.y)}px ${Math.round(shadow.radius)}px ${rgba}`
          shadowUsage.set(str, (shadowUsage.get(str) || 0) + 1)
        }
      }
    }

    if ('children' in node) {
      for (const child of (node as ChildrenMixin).children) {
        scan(child)
      }
    }
  }

  scan(rootNode)

  const varLines: string[] = []

  // 1. Colors
  const sortedColors = Array.from(colorUsage.entries()).sort((a, b) => b[1] - a[1])
  if (sortedColors.length > 0) {
    varLines.push('  /* Colors */')
    sortedColors.forEach(([hex, count], i) => {
      let varName = `--color-${String(i + 1).padStart(2, '0')}`
      if (hex.toUpperCase() === '#FFFFFF') varName = '--color-white'
      else if (hex.toUpperCase() === '#000000') varName = '--color-black'
      else if (i === 0) varName = '--color-primary'
      else if (i === 1) varName = '--color-secondary'
      varLines.push(`  ${varName}: ${hex}; /* ${count} uses */`)
    })
  }

  // 2. Spacing
  const sortedSpacings = Array.from(spacingUsage.keys()).sort((a, b) => a - b)
  if (sortedSpacings.length > 0) {
    varLines.push('\n  /* Spacing */')
    const SPACING_NAMES = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl']
    sortedSpacings.forEach((sp, i) => {
      const name = SPACING_NAMES[i] || `step-${i + 1}`
      varLines.push(`  --spacing-${name}: ${sp}px;`)
    })
  }

  // 3. Border Radius
  const sortedRadii = Array.from(radiusUsage.keys()).sort((a, b) => a - b)
  if (sortedRadii.length > 0) {
    varLines.push('\n  /* Border Radius */')
    const RADIUS_NAMES = ['sm', 'md', 'lg', 'xl', 'full']
    sortedRadii.forEach((r, i) => {
      const name = r >= 99 ? 'full' : (RADIUS_NAMES[i] || `step-${i + 1}`)
      varLines.push(`  --radius-${name}: ${r}px;`)
    })
  }

  // 4. Typography (Font Sizes)
  const sortedFontSizes = Array.from(fontSizeUsage.keys()).sort((a, b) => a - b)
  if (sortedFontSizes.length > 0) {
    varLines.push('\n  /* Typography */')
    sortedFontSizes.forEach(sz => {
      let name = `${sz}px`
      if (sz <= 12) name = 'sm'
      else if (sz === 14 || sz === 16) name = 'body'
      else if (sz === 20 || sz === 24) name = 'heading-sm'
      else if (sz === 32 || sz === 36) name = 'heading-md'
      else if (sz >= 48) name = 'heading-lg'
      varLines.push(`  --font-size-${name}: ${sz}px;`)
    })
  }

  // 5. Shadows
  const sortedShadows = Array.from(shadowUsage.keys())
  if (sortedShadows.length > 0) {
    varLines.push('\n  /* Shadows */')
    const SHADOW_NAMES = ['sm', 'md', 'lg']
    sortedShadows.forEach((sh, i) => {
      const name = SHADOW_NAMES[i] || `level-${i + 1}`
      varLines.push(`  --shadow-${name}: ${sh};`)
    })
  }

  return `:root {\n${varLines.join('\n')}\n}`
}

// -------------------------------------------------------
// 3. COLOR EXPORT
// -------------------------------------------------------
export function getColorExportData(
  selection: readonly SceneNode[],
  scope: 'selection' | 'page' = 'selection'
): ColorExportData {
  const colorMap = new Map<
    string,
    { hex: string; rgb: string; rgba: string; opacity: number; count: number; sourceTypes: Set<string> }
  >()

  function recordPaint(paint: Paint, sourceType: string) {
    if (paint.visible === false) return

    if (paint.type === 'SOLID') {
      const { r, g, b } = paint.color
      const opacity = typeof paint.opacity === 'number' ? paint.opacity : 1
      const hex = figmaRgbToHex(r, g, b)
      const red = Math.round(r * 255)
      const green = Math.round(g * 255)
      const blue = Math.round(b * 255)
      const rgb = `rgb(${red}, ${green}, ${blue})`
      const rgba = `rgba(${red}, ${green}, ${blue}, ${Math.round(opacity * 100) / 100})`

      const key = `${hex}-${opacity}`
      if (colorMap.has(key)) {
        const item = colorMap.get(key)!
        item.count++
        item.sourceTypes.add(sourceType)
      } else {
        colorMap.set(key, {
          hex,
          rgb,
          rgba,
          opacity,
          count: 1,
          sourceTypes: new Set([sourceType]),
        })
      }
    } else if (paint.type === 'GRADIENT_LINEAR' || paint.type === 'GRADIENT_RADIAL') {
      for (const stop of paint.gradientStops) {
        const { r, g, b, a } = stop.color
        const hex = figmaRgbToHex(r, g, b)
        const red = Math.round(r * 255)
        const green = Math.round(g * 255)
        const blue = Math.round(b * 255)
        const opacity = Math.round(a * 100) / 100
        const key = `${hex}-${opacity}`

        if (colorMap.has(key)) {
          const item = colorMap.get(key)!
          item.count++
          item.sourceTypes.add('gradient')
        } else {
          colorMap.set(key, {
            hex,
            rgb: `rgb(${red}, ${green}, ${blue})`,
            rgba: `rgba(${red}, ${green}, ${blue}, ${opacity})`,
            opacity,
            count: 1,
            sourceTypes: new Set(['gradient']),
          })
        }
      }
    }
  }

  function scanNode(node: SceneNode) {
    if ('fills' in node && Array.isArray(node.fills)) {
      const typeLabel = node.type === 'TEXT' ? 'text' : 'fill'
      for (const f of node.fills as Paint[]) {
        recordPaint(f, typeLabel)
      }
    }

    if ('strokes' in node && Array.isArray(node.strokes)) {
      for (const s of node.strokes as Paint[]) {
        recordPaint(s, 'stroke')
      }
    }

    if ('children' in node) {
      for (const child of (node as ChildrenMixin).children) {
        scanNode(child)
      }
    }
  }

  if (scope === 'selection' && selection && selection.length > 0) {
    for (const root of selection) scanNode(root)
  } else {
    for (const root of figma.currentPage.children) scanNode(root)
  }

  const items: ColorExportItem[] = Array.from(colorMap.values()).map(item => ({
    hex: item.hex,
    rgb: item.rgb,
    rgba: item.rgba,
    opacity: item.opacity,
    count: item.count,
    sourceTypes: Array.from(item.sourceTypes),
  }))

  // Sort by usage count descending
  items.sort((a, b) => b.count - a.count)

  const totalUsages = items.reduce((sum, i) => sum + i.count, 0)

  return {
    colors: items,
    totalUnique: items.length,
    totalUsages,
  }
}

// -------------------------------------------------------
// 4. DESIGN TOKEN EXPORT
// -------------------------------------------------------
export function getDesignTokens(
  selection: readonly SceneNode[],
  scope: 'selection' | 'page' = 'selection'
): DesignTokensData {
  const colorTokens: Record<string, { value: string; type: string; description?: string }> = {}
  const typographyTokens: Record<string, any> = {}
  const spacingTokens: Record<string, { value: string; type: string }> = {}
  const radiusTokens: Record<string, { value: string; type: string }> = {}
  const shadowTokens: Record<string, { value: string; type: string }> = {}

  // 1. Color styles
  const paintStyles = figma.getLocalPaintStyles()
  let colorIdx = 1
  for (const s of paintStyles) {
    if (s.paints.length > 0 && s.paints[0].type === 'SOLID') {
      const c = s.paints[0].color
      const hex = figmaRgbToHex(c.r, c.g, c.b)
      const tokenKey = s.name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || `color-${colorIdx++}`
      colorTokens[tokenKey] = {
        value: hex,
        type: 'color',
        description: s.description || undefined,
      }
    }
  }

  // 2. Text styles
  const textStyles = figma.getLocalTextStyles()
  let textIdx = 1
  for (const s of textStyles) {
    const tokenKey = s.name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || `typography-${textIdx++}`
    typographyTokens[tokenKey] = {
      value: {
        fontFamily: s.fontName.family,
        fontSize: `${s.fontSize}px`,
        fontWeight: s.fontName.style,
        lineHeight: s.lineHeight.unit === 'PIXELS' ? `${s.lineHeight.value}px` : 'auto',
      },
      type: 'typography',
    }
  }

  // 3. Extract tokens from nodes (spacings, radii, shadows)
  const uniqueGaps = new Set<number>()
  const uniqueRadii = new Set<number>()
  let shadowIdx = 1

  function scanNode(node: SceneNode) {
    // Spacing from Auto Layout
    if ('layoutMode' in node && (node as FrameNode).layoutMode !== 'NONE') {
      const f = node as FrameNode
      if (f.itemSpacing > 0) uniqueGaps.add(Math.round(f.itemSpacing))
      if (f.paddingTop > 0) uniqueGaps.add(Math.round(f.paddingTop))
      if (f.paddingLeft > 0) uniqueGaps.add(Math.round(f.paddingLeft))
    }

    // Corner Radius
    if ('cornerRadius' in node && typeof (node as FrameNode).cornerRadius === 'number') {
      const r = Math.round((node as FrameNode).cornerRadius as number)
      if (r > 0) uniqueRadii.add(r)
    }

    // Shadows
    if ('effects' in node && Array.isArray(node.effects)) {
      for (const eff of node.effects as Effect[]) {
        if (eff.visible !== false && eff.type === 'DROP_SHADOW') {
          const shadow = eff as DropShadowEffect
          const col = shadow.color
          const rgba = `rgba(${Math.round(col.r * 255)}, ${Math.round(col.g * 255)}, ${Math.round(col.b * 255)}, ${Math.round(col.a * 100) / 100})`
          const key = `shadow-${shadowIdx++}`
          shadowTokens[key] = {
            value: `${Math.round(shadow.offset.x)}px ${Math.round(shadow.offset.y)}px ${Math.round(shadow.radius)}px ${rgba}`,
            type: 'shadow',
          }
        }
      }
    }

    // Fallback colors from fills if no paint styles
    if (Object.keys(colorTokens).length < 5 && 'fills' in node && Array.isArray(node.fills)) {
      for (const f of node.fills as Paint[]) {
        if (f.type === 'SOLID' && f.visible !== false) {
          const hex = figmaRgbToHex(f.color.r, f.color.g, f.color.b)
          const key = `color-${colorIdx++}`
          if (!Object.values(colorTokens).some(v => v.value === hex)) {
            colorTokens[key] = { value: hex, type: 'color' }
          }
        }
      }
    }

    if ('children' in node) {
      for (const child of (node as ChildrenMixin).children) {
        scanNode(child)
      }
    }
  }

  if (scope === 'selection' && selection && selection.length > 0) {
    for (const root of selection) scanNode(root)
  } else {
    for (const root of figma.currentPage.children) scanNode(root)
  }

  // Sort and assign deterministic spacing tokens (xs, sm, md, lg, xl...)
  const sortedGaps = Array.from(uniqueGaps).sort((a, b) => a - b)
  const SPACING_NAMES = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl']
  sortedGaps.forEach((val, i) => {
    const key = SPACING_NAMES[i] || `spacing-${i + 1}`
    spacingTokens[key] = { value: `${val}px`, type: 'spacing' }
  })

  // Sort and assign radius tokens (sm, md, lg...)
  const sortedRadii = Array.from(uniqueRadii).sort((a, b) => a - b)
  const RADIUS_NAMES = ['sm', 'md', 'lg', 'xl', 'full']
  sortedRadii.forEach((val, i) => {
    const key = RADIUS_NAMES[i] || `radius-${i + 1}`
    radiusTokens[key] = { value: `${val}px`, type: 'borderRadius' }
  })

  const tokenObject = {
    color: colorTokens,
    typography: typographyTokens,
    spacing: spacingTokens,
    radius: radiusTokens,
    shadow: shadowTokens,
  }

  const json = JSON.stringify(tokenObject, null, 2)

  return {
    json,
    counts: {
      colors: Object.keys(colorTokens).length,
      typography: Object.keys(typographyTokens).length,
      spacing: Object.keys(spacingTokens).length,
      radius: Object.keys(radiusTokens).length,
      shadows: Object.keys(shadowTokens).length,
    },
  }
}
