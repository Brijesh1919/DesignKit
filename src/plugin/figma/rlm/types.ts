// ============================================================
// src/plugin/figma/rlm/types.ts
// Responsive Layout Model (RLM) Comprehensive Type Definitions
// 100% Offline & Deterministic — Zero External Dependencies
// ============================================================

export type RLMRole =
  | 'ROOT'
  | 'BACKGROUND'
  | 'DECORATIVE'
  | 'NAVIGATION_BAR'
  | 'ANNOUNCEMENT_BAR'
  | 'HERO_SECTION'
  | 'FEATURE_SPLIT'
  | 'PRODUCT_GRID'
  | 'METRIC_CARD_GROUP'
  | 'DATA_TABLE'
  | 'FORM_CONTAINER'
  | 'FORM_FIELD'
  | 'FORM_ROW'
  | 'INPUT_GROUP'
  | 'INLINE_MICRO_ROW'
  | 'TESTIMONIAL_CAROUSEL'
  | 'PRICING_TABLE'
  | 'SIDEBAR_NAV'
  | 'TRUST_BADGES'
  | 'CARD'
  | 'CARD_MEDIA'
  | 'CARD_BODY'
  | 'BADGE_OR_PILL'
  | 'BUTTON_PRIMARY'
  | 'BUTTON_SECONDARY'
  | 'TEXT_HEADING'
  | 'TEXT_PARAGRAPH'
  | 'TEXT_INLINE_LABEL'
  | 'TAG_CLOUD'
  | 'FOOTER'
  | 'CONTAINER'
  | 'UNKNOWN'

export interface RLMGeometry {
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}

export interface RLMCornerRadii {
  tl: number
  tr: number
  bl: number
  br: number
}

export interface RLMStyle {
  fills: Paint[]
  strokes: Paint[]
  strokeWeight?: number
  effects: Effect[]
  opacity?: number
  cornerRadii: RLMCornerRadii
  clipsContent: boolean
  layoutPositioning?: 'AUTO' | 'ABSOLUTE'
}

export interface RLMTypography {
  characters: string
  fontSize: number
  fontName: FontName | typeof figma.mixed
  lineHeight: LineHeight | typeof figma.mixed
  textAlignHorizontal: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED'
  textAlignVertical?: 'TOP' | 'CENTER' | 'BOTTOM'
  textCase?: TextCase | typeof figma.mixed
  isSingleLine: boolean
  naturalWidth: number
}

export interface RLMResponsiveIntent {
  layoutMode: 'NONE' | 'HORIZONTAL' | 'VERTICAL'
  layoutWrap?: 'NO_WRAP' | 'WRAP'
  horizontalSizing: 'FILL' | 'HUG' | 'FIXED'
  verticalSizing: 'FILL' | 'HUG' | 'FIXED'
  targetWidth?: number
  targetHeight?: number
  minWidth?: number
  maxWidth?: number
  itemSpacing: number
  padding: {
    top: number
    right: number
    bottom: number
    left: number
  }
  alignItems: 'MIN' | 'CENTER' | 'MAX'
  justifyContent: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'
  preserveInstance: boolean
  isAbsoluteInAutoLayout: boolean
  clipsContent?: boolean
  textAutoResize?: 'NONE' | 'WIDTH_AND_HEIGHT' | 'HEIGHT'
  columns?: number
  preserveMediaAspect?: boolean
  aspectRatio?: number
}

export interface RLMNode {
  id: string
  name: string
  originalType: string
  figmaNodeRef: SceneNode
  role: RLMRole
  confidence: number // 0.0 to 1.0
  geometry: RLMGeometry
  style: RLMStyle
  typography?: RLMTypography
  intent: RLMResponsiveIntent
  children: RLMNode[]
  parent?: RLMNode
  isInstance: boolean
  isComponent: boolean
  isImage: boolean
  isVectorIcon: boolean
}

export interface RLMViewport {
  width: number
  height: number
  name: string
  padding: number
  colGap: number
  rowGap: number
  navH: number
  defaultCardCols: number
}

export interface RLMValidationResult {
  valid: boolean
  healthScore: number // 0 to 100
  issues: string[]
  textSquashCount: number
  overlapCount: number
  overflowCount: number
  blankSpaceCount: number
}
