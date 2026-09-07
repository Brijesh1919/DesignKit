import type { ComponentType } from 'react'
import { lazy } from 'react'

// ============================================================
// Tool Registry — single source of truth for all tools.
// Add new tools here; no other files need to change.
// ============================================================

export type ToolCategoryId =
  | 'colors'
  | 'typography'
  | 'layout'
  | 'images'
  | 'components'
  | 'accessibility'
  | 'responsive'
  | 'cleanup'
  | 'developer'

export interface ToolDef {
  id: string
  name: string
  description: string
  keywords: string[]
  categoryId: ToolCategoryId
  implemented: boolean
  component?: ComponentType<any>
}

export interface CategoryDef {
  id: ToolCategoryId
  label: string
  iconName: string
  tools: ToolDef[]
}

// ---- Lazy-load tool components ----
// Using lazy() keeps the initial bundle small and each tool independent.
const ColorPalette      = lazy(() => import('../tools/colors/ColorPalette'))
const ColorHarmony      = lazy(() => import('../tools/colors/ColorHarmony'))
const ContrastChecker   = lazy(() => import('../tools/colors/ContrastChecker'))
const TypographyScale   = lazy(() => import('../tools/typography/TypographyScale'))
const SpacingNormalizer = lazy(() => import('../tools/layout/SpacingNormalizer'))
const AutoLayoutOpt     = lazy(() => import('../tools/layout/AutoLayoutOptimizer'))
const ImageColorExtractor = lazy(() => import('../tools/images/ImageColorExtractor'))
const BackgroundRemover = lazy(() => import('../tools/images/BackgroundRemover'))
const CreateComponent   = lazy(() => import('../tools/components/CreateComponent'))
const ComponentNaming   = lazy(() => import('../tools/components/ComponentNaming'))
const LayerNaming       = lazy(() => import('../tools/components/LayerNaming'))
const TouchTargetChecker = lazy(() => import('../tools/accessibility/TouchTargetChecker'))
const TextSizeChecker    = lazy(() => import('../tools/accessibility/TextSizeChecker'))
const ResponsiveChecker  = lazy(() => import('../tools/responsive/ResponsiveChecker'))
const BreakpointPreview  = lazy(() => import('../tools/responsive/BreakpointPreview'))
const ResponsiveCss      = lazy(() => import('../tools/responsive/ResponsiveCss'))
const MakeResponsive     = lazy(() => import('../tools/responsive/MakeResponsive'))
const DesignAudit        = lazy(() => import('../tools/cleanup/DesignAudit'))
const LayerCleanup       = lazy(() => import('../tools/cleanup/LayerCleanup'))
const StyleCleanup       = lazy(() => import('../tools/cleanup/StyleCleanup'))
const CssGenerator       = lazy(() => import('../tools/developer/CssGenerator'))
const ColorExport        = lazy(() => import('../tools/developer/ColorExport'))
const DesignTokenExport  = lazy(() => import('../tools/developer/DesignTokenExport'))

// ---- Category + Tool definitions ----

export const CATEGORIES: CategoryDef[] = [
  {
    id: 'colors',
    label: 'Colors',
    iconName: 'palette',
    tools: [
      {
        id: 'color-palette',
        name: 'Color Palette',
        description: 'Generate a full 50–950 shade scale from a base color',
        keywords: ['palette', 'shades', 'scale', 'color', 'generate', 'tints'],
        categoryId: 'colors',
        implemented: true,
        component: ColorPalette,
      },
      {
        id: 'color-harmony',
        name: 'Color Harmony',
        description: 'Generate complementary, analogous, triadic and more',
        keywords: ['harmony', 'complementary', 'analogous', 'triadic', 'color wheel'],
        categoryId: 'colors',
        implemented: true,
        component: ColorHarmony,
      },
      {
        id: 'contrast-checker',
        name: 'Contrast Checker',
        description: 'Check WCAG AA/AAA contrast ratios',
        keywords: ['contrast', 'wcag', 'accessibility', 'a11y', 'ratio', 'aa', 'aaa'],
        categoryId: 'colors',
        implemented: true,
        component: ContrastChecker,
      },
      {
        id: 'color-shades',
        name: 'Color Shades',
        description: 'Fine-tune individual shades of a color',
        keywords: ['shades', 'tints', 'darken', 'lighten'],
        categoryId: 'colors',
        implemented: false,
      },
      {
        id: 'extract-colors',
        name: 'Extract Colors',
        description: 'Extract all colors used on the current page',
        keywords: ['extract', 'document', 'audit', 'page colors'],
        categoryId: 'colors',
        implemented: false,
      },
    ],
  },

  {
    id: 'typography',
    label: 'Typography',
    iconName: 'type',
    tools: [
      {
        id: 'typography-scale',
        name: 'Typography Scale',
        description: 'Generate a musical-ratio type scale and create text styles',
        keywords: ['typography', 'type', 'scale', 'font', 'size', 'heading', 'body', 'text'],
        categoryId: 'typography',
        implemented: true,
        component: TypographyScale,
      },
      {
        id: 'text-style-generator',
        name: 'Text Style Generator',
        description: 'Create custom text styles with precision controls',
        keywords: ['text', 'style', 'font', 'weight', 'size'],
        categoryId: 'typography',
        implemented: false,
      },
      {
        id: 'text-style-extractor',
        name: 'Text Style Extractor',
        description: 'List and audit all text styles in the document',
        keywords: ['extract', 'audit', 'text', 'styles'],
        categoryId: 'typography',
        implemented: false,
      },
      {
        id: 'line-height',
        name: 'Line Height Calculator',
        description: 'Calculate optimal line heights for any font size',
        keywords: ['line height', 'leading', 'spacing'],
        categoryId: 'typography',
        implemented: false,
      },
    ],
  },

  {
    id: 'layout',
    label: 'Layout',
    iconName: 'layout',
    tools: [
      {
        id: 'spacing-normalizer',
        name: 'Spacing Normalizer',
        description: 'Normalize gaps between selected layers to an 8pt grid',
        keywords: ['spacing', 'gap', 'normalize', '8pt', 'grid', 'distance'],
        categoryId: 'layout',
        implemented: true,
        component: SpacingNormalizer,
      },
      {
        id: 'auto-layout-optimizer',
        name: 'Auto Layout Optimizer',
        description: 'Analyze a frame and apply optimal auto layout settings',
        keywords: ['auto layout', 'flex', 'gap', 'padding', 'alignment', 'frame'],
        categoryId: 'layout',
        implemented: true,
        component: AutoLayoutOpt,
      },
      {
        id: 'padding-tool',
        name: 'Padding Tool',
        description: 'Set uniform or asymmetric padding on frames',
        keywords: ['padding', 'inset', 'frame', 'space'],
        categoryId: 'layout',
        implemented: false,
      },
      {
        id: 'alignment-tool',
        name: 'Alignment Tool',
        description: 'Advanced alignment and distribution controls',
        keywords: ['align', 'distribute', 'center', 'spacing'],
        categoryId: 'layout',
        implemented: false,
      },
      {
        id: 'grid-checker',
        name: '8pt Grid Checker',
        description: 'Highlight elements that don\'t align to the grid',
        keywords: ['grid', '8pt', 'alignment', 'check', 'audit'],
        categoryId: 'layout',
        implemented: false,
      },
    ],
  },

  {
    id: 'images',
    label: 'Images',
    iconName: 'image',
    tools: [
      {
        id: 'image-color-extractor',
        name: 'Image Color Extractor',
        description: 'Extract dominant colors from a selected image',
        keywords: ['image', 'color', 'extract', 'dominant', 'palette'],
        categoryId: 'images',
        implemented: true,
        component: ImageColorExtractor,
      },
      {
        id: 'background-remover',
        name: 'Background Remover',
        description: 'Remove solid-color backgrounds from images',
        keywords: ['background', 'remove', 'transparent', 'white', 'erase'],
        categoryId: 'images',
        implemented: true,
        component: BackgroundRemover,
      },
      {
        id: 'image-resize',
        name: 'Image Resize',
        description: 'Resize selected image layers precisely',
        keywords: ['resize', 'scale', 'image', 'dimensions'],
        categoryId: 'images',
        implemented: false,
      },
      {
        id: 'image-crop',
        name: 'Image Crop',
        description: 'Crop images to exact dimensions',
        keywords: ['crop', 'trim', 'image'],
        categoryId: 'images',
        implemented: false,
      },
    ],
  },

  {
    id: 'components',
    label: 'Components',
    iconName: 'component',
    tools: [
      {
        id: 'create-component',
        name: 'Create Component',
        description: 'Convert selection to a component with smart naming',
        keywords: ['component', 'create', 'symbol', 'convert'],
        categoryId: 'components',
        implemented: true,
        component: CreateComponent,
      },
      {
        id: 'component-naming',
        name: 'Component Naming',
        description: 'Batch rename components with a consistent convention',
        keywords: ['rename', 'naming', 'component', 'convention'],
        categoryId: 'components',
        implemented: true,
        component: ComponentNaming,
      },
      {
        id: 'layer-naming',
        name: 'Layer Naming',
        description: 'Batch rename layers with pattern-based rules',
        keywords: ['layer', 'rename', 'naming', 'batch'],
        categoryId: 'components',
        implemented: true,
        component: LayerNaming,
      },
    ],
  },

  {
    id: 'accessibility',
    label: 'Accessibility',
    iconName: 'accessibility',
    tools: [
      {
        id: 'touch-target',
        name: 'Touch Target Checker',
        description: 'Highlight elements smaller than 44×44px',
        keywords: ['touch', 'target', 'mobile', 'a11y', 'accessibility'],
        categoryId: 'accessibility',
        implemented: true,
        component: TouchTargetChecker,
      },
      {
        id: 'text-size-checker',
        name: 'Text Size Checker',
        description: 'Flag text smaller than WCAG minimum sizes',
        keywords: ['text', 'size', 'readable', 'a11y', 'minimum'],
        categoryId: 'accessibility',
        implemented: true,
        component: TextSizeChecker,
      },
    ],
  },

  {
    id: 'responsive',
    label: 'Responsive',
    iconName: 'responsive',
    tools: [
      {
        id: 'make-responsive',
        name: 'Make Responsive',
        description: 'Transform any design into a responsive layout for Laptop, Tablet, Mobile, or Small Mobile',
        keywords: ['make responsive', 'transform', 'clone', 'mobile', 'tablet', 'laptop', 'resize', 'layout'],
        categoryId: 'responsive',
        implemented: true,
        component: MakeResponsive,
      },
      {
        id: 'responsive-checker',
        name: 'Responsive Checker',
        description: 'Audit design against Desktop, Tablet, Mobile, and Custom viewports',
        keywords: ['responsive', 'checker', 'mobile', 'tablet', 'desktop', 'viewport', 'overflow'],
        categoryId: 'responsive',
        implemented: true,
        component: ResponsiveChecker,
      },
      {
        id: 'breakpoint-preview',
        name: 'Breakpoint Preview',
        description: 'Inspect design geometry across different viewport sizes',
        keywords: ['breakpoint', 'preview', 'simulator', 'device', 'viewport', 'responsive'],
        categoryId: 'responsive',
        implemented: true,
        component: BreakpointPreview,
      },
      {
        id: 'responsive-css',
        name: 'Responsive CSS',
        description: 'Generate CSS with media queries for Tablet, Mobile, and Small Mobile',
        keywords: ['responsive', 'css', 'media queries', 'breakpoints', 'code'],
        categoryId: 'responsive',
        implemented: true,
        component: ResponsiveCss,
      },
    ],
  },

  {
    id: 'cleanup',
    label: 'Cleanup',
    iconName: 'cleanup',
    tools: [
      {
        id: 'design-audit',
        name: 'Design Audit',
        description: 'Find unused styles, missing constraints and issues',
        keywords: ['audit', 'clean', 'unused', 'styles', 'health'],
        categoryId: 'cleanup',
        implemented: true,
        component: DesignAudit,
      },
      {
        id: 'layer-cleanup',
        name: 'Layer Cleanup',
        description: 'Remove hidden layers, merge groups and flatten',
        keywords: ['layer', 'clean', 'flatten', 'hidden', 'merge'],
        categoryId: 'cleanup',
        implemented: true,
        component: LayerCleanup,
      },
      {
        id: 'style-cleanup',
        name: 'Style Cleanup',
        description: 'Remove unused color and text styles',
        keywords: ['style', 'clean', 'unused', 'delete'],
        categoryId: 'cleanup',
        implemented: true,
        component: StyleCleanup,
      },
    ],
  },

  {
    id: 'developer',
    label: 'Developer',
    iconName: 'code',
    tools: [
      {
        id: 'css-generator',
        name: 'CSS Generator',
        description: 'Export CSS variables from selected layer properties',
        keywords: ['css', 'export', 'variables', 'code', 'developer'],
        categoryId: 'developer',
        implemented: true,
        component: CssGenerator,
      },
      {
        id: 'color-export',
        name: 'Color Export',
        description: 'Export color styles as JSON, CSS or Swift',
        keywords: ['color', 'export', 'json', 'css', 'tokens'],
        categoryId: 'developer',
        implemented: true,
        component: ColorExport,
      },
      {
        id: 'design-token-export',
        name: 'Design Token Export',
        description: 'Export all styles as design tokens (JSON)',
        keywords: ['tokens', 'export', 'json', 'design system'],
        categoryId: 'developer',
        implemented: true,
        component: DesignTokenExport,
      },
    ],
  },
]

// ---- Flat list of all tools (for search) ----
export const ALL_TOOLS: ToolDef[] = CATEGORIES.flatMap(c => c.tools)

// ---- Lookup helpers ----
export function findTool(toolId: string): ToolDef | undefined {
  return ALL_TOOLS.find(t => t.id === toolId)
}

export function findCategory(categoryId: ToolCategoryId): CategoryDef | undefined {
  return CATEGORIES.find(c => c.id === categoryId)
}

export function searchTools(query: string): ToolDef[] {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  return ALL_TOOLS.filter(
    t =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.keywords.some(k => k.includes(q))
  )
}
