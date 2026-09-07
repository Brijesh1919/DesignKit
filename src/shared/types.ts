// ============================================================
// Shared types between plugin sandbox code and UI code.
// Import from both sides to keep messages type-safe.
// ============================================================

// --------------- Selection Info ---------------

export interface SelectionInfo {
  count: number;
  types: string[];
  hasImage: boolean;
  hasFrame: boolean;
  hasText: boolean;
  nodeId?: string;
  nodeName?: string;
}

// --------------- Color Types ---------------

export interface ColorStyleDef {
  name: string;
  hex: string;
  groupName?: string;
}

// --------------- Typography Types ---------------

export interface TextStyleDef {
  name: string;
  fontSize: number;
  lineHeight: number;
  fontWeight: number;
  letterSpacing: number;
  fontFamily?: string;
}

// --------------- Layout Types ---------------

export interface SpacingInfo {
  nodeIds: string[];
  horizontalGaps: number[];
  verticalGaps: number[];
  hasHorizontal: boolean;
  hasVertical: boolean;
}

export interface ApplySpacingPayload {
  nodeIds: string[];
  targetSpacing: number;
  direction: 'horizontal' | 'vertical' | 'both';
}

export interface AutoLayoutAnalysis {
  nodeId: string;
  nodeName: string;
  childCount: number;
  suggestedDirection: 'HORIZONTAL' | 'VERTICAL';
  suggestedGap: number;
  suggestedPaddingTop: number;
  suggestedPaddingRight: number;
  suggestedPaddingBottom: number;
  suggestedPaddingLeft: number;
  primaryAxisAlignItems: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems: 'MIN' | 'CENTER' | 'MAX';
  currentHasAutoLayout: boolean;
}

export interface ApplyAutoLayoutPayload {
  nodeId: string;
  direction: 'HORIZONTAL' | 'VERTICAL';
  gap: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  primaryAxisAlignItems: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems: 'MIN' | 'CENTER' | 'MAX';
}

// --------------- Image Types ---------------

export interface ImageBytesPayload {
  nodeId: string;
  bytes: number[];
  width: number;
  height: number;
}

export interface ApplyImagePayload {
  nodeId: string;
  bytes: number[];
  width: number;
  height: number;
}

export interface FrameContrastItem {
  nodeId: string;
  nodeName: string;
  textSnippet: string;
  fontSize: number;
  isLargeText: boolean;
  textColor: string;
  backgroundColor: string | null;
}

export interface FrameContrastAnalysis {
  frameId: string;
  frameName: string;
  items: FrameContrastItem[];
}

// --------------- Components Types ---------------

export interface CreateComponentPayload {
  name?: string;
}

export interface ComponentRenameItem {
  nodeId: string;
  currentName: string;
  suggestedName: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  checked: boolean;
}

export interface ComponentNamingAnalysis {
  items: ComponentRenameItem[];
}

export interface ApplyComponentRenamesPayload {
  renames: { nodeId: string; newName: string }[];
}

export interface LayerRenameItem {
  nodeId: string;
  currentName: string;
  suggestedName: string;
  nodeType: string;
  checked: boolean;
}

export interface LayerNamingAnalysis {
  items: LayerRenameItem[];
  totalLayersChecked: number;
}

export interface ApplyLayerRenamesPayload {
  renames: { nodeId: string; newName: string }[];
}

// --------------- Accessibility Types ---------------

export interface TouchTargetItem {
  nodeId: string;
  nodeName: string;
  width: number;
  height: number;
  status: 'PASS' | 'FAIL';
  isInteractive: boolean;
}

export interface TouchTargetAnalysis {
  threshold: number;
  items: TouchTargetItem[];
  passCount: number;
  failCount: number;
}

export interface TextSizeItem {
  nodeId: string;
  nodeName: string;
  textSnippet: string;
  fontSize: number;
  fontWeight: number | string;
  status: 'PASS' | 'WARNING';
}

export interface TextSizeAnalysis {
  minSize: number;
  items: TextSizeItem[];
  passCount: number;
  warningCount: number;
}

export interface FocusNodePayload {
  nodeId: string;
}

// --------------- Cleanup Types ---------------

export type AuditCategory = 'Naming' | 'Structure' | 'Visibility' | 'Styles';
export type AuditSeverity = 'Critical' | 'Warning' | 'Suggestion';

export interface DesignAuditIssue {
  id: string;
  nodeId: string;
  nodeName: string;
  category: AuditCategory;
  severity: AuditSeverity;
  message: string;
  details?: string;
}

export interface DesignAuditReport {
  totalIssues: number;
  counts: {
    Naming: number;
    Structure: number;
    Visibility: number;
    Styles: number;
  };
  issues: DesignAuditIssue[];
}

export interface LayerCleanupCandidate {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  reason: string;
  action: 'delete' | 'unwrap';
  checked: boolean;
}

export interface LayerCleanupAnalysis {
  candidates: LayerCleanupCandidate[];
}

export interface ApplyLayerCleanupPayload {
  candidateIds: string[];
}

export interface UnusedStyleItem {
  id: string;
  name: string;
  type: 'PAINT' | 'TEXT' | 'EFFECT' | 'GRID';
  details?: string;
}

export interface DuplicateStyleItem {
  styleId: string;
  styleName: string;
  duplicateOfId: string;
  duplicateOfName: string;
  type: 'PAINT' | 'TEXT' | 'EFFECT';
}

export interface StyleCleanupAnalysis {
  unusedStyles: UnusedStyleItem[];
  duplicateStyles: DuplicateStyleItem[];
  counts: {
    unusedPaint: number;
    unusedText: number;
    unusedEffect: number;
    unusedGrid: number;
    duplicates: number;
  };
}

export interface ApplyDeleteStylesPayload {
  styleIds: string[];
}

// --------------- Developer Types ---------------

export interface CssGeneratorData {
  nodeId: string;
  nodeName: string;
  css: string;
  cssVariables: string;
  propertiesCount: number;
}

export interface ColorExportItem {
  hex: string;
  rgb: string;
  rgba: string;
  opacity: number;
  count: number;
  sourceTypes: string[];
}

export interface ColorExportData {
  colors: ColorExportItem[];
  totalUnique: number;
  totalUsages: number;
}

export interface DesignTokensData {
  json: string;
  counts: {
    colors: number;
    typography: number;
    spacing: number;
    radius: number;
    shadows: number;
  };
}

// --------------- Responsive Types ---------------

export type ResponsiveSeverity = 'PASS' | 'WARNING' | 'FAIL';
export type ResponsiveCategory =
  | 'overflow'
  | 'fixed-width'
  | 'text-wrap'
  | 'spacing'
  | 'navigation'
  | 'stacking';

export interface ResponsiveIssue {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  viewportId: string;
  viewportName: string;
  severity: ResponsiveSeverity;
  category: ResponsiveCategory;
  message: string;
  details?: string;
  width?: number;
  height?: number;
}

export interface ViewportAuditResult {
  viewportId: string;
  viewportName: string;
  width: number;
  height: number;
  status: ResponsiveSeverity;
  issues: ResponsiveIssue[];
}

export interface ResponsiveAnalysis {
  frameId: string;
  frameName: string;
  frameWidth: number;
  frameHeight: number;
  results: ViewportAuditResult[];
  totalIssues: number;
  hasFailures: boolean;
}

export interface ResponsiveCssData {
  frameId: string;
  frameName: string;
  css: string;
  mediaQueriesCount: number;
}

// --------------- Make Responsive / Transform Types ---------------

export type ResponsiveTargetPreset = 'laptop' | 'tablet' | 'mobile' | 'small-mobile'

export interface ResponsiveTransformSummary {
  /** New frame ID created in Figma */
  newFrameId: string;
  /** Name of the new cloned frame */
  newFrameName: string;
  /** Original frame name */
  originalFrameName: string;
  /** Target viewport label (e.g. "Mobile") */
  targetViewport: string;
  /** Target viewport width applied */
  targetWidth: number;
  /** Total layout mutations applied */
  mutationsApplied: number;
  /** Human-readable list of what changed */
  changeLog: string[];
}

export interface ResponsivePreviewSummary {
  frameName: string;
  frameWidth: number;
  frameHeight: number;
  targetViewport: string;
  targetWidth: number;
  targetHeight: number;
  /** Predicted layout mutations */
  predictedChanges: string[];
  /** Issues that the transformation will resolve */
  issuesResolved: number;
}

// --------------- Message Protocol ---------------

// Messages sent from the UI iframe → plugin sandbox
export type UIMessage =
  | { type: 'GET_SELECTION' }
  | { type: 'CREATE_COLOR_STYLES'; payload: ColorStyleDef[] }
  | { type: 'APPLY_COLOR_TO_SELECTION'; payload: { hex: string } }
  | { type: 'CREATE_TEXT_STYLES'; payload: TextStyleDef[] }
  | { type: 'GET_SPACING_INFO' }
  | { type: 'APPLY_SPACING'; payload: ApplySpacingPayload }
  | { type: 'GET_AUTO_LAYOUT_ANALYSIS' }
  | { type: 'APPLY_AUTO_LAYOUT'; payload: ApplyAutoLayoutPayload }
  | { type: 'GET_IMAGE_BYTES' }
  | { type: 'APPLY_IMAGE'; payload: ApplyImagePayload }
  | { type: 'GET_FRAME_CONTRAST_ANALYSIS' }
  | { type: 'NOTIFY'; payload: { message: string } }
  // Components
  | { type: 'CREATE_COMPONENT'; payload?: CreateComponentPayload }
  | { type: 'GET_COMPONENT_NAMING_ANALYSIS'; payload?: { scope?: 'selection' | 'page' } }
  | { type: 'APPLY_COMPONENT_RENAMES'; payload: ApplyComponentRenamesPayload }
  | { type: 'GET_LAYER_NAMING_ANALYSIS'; payload?: { scope?: 'selection' | 'page' } }
  | { type: 'APPLY_LAYER_RENAMES'; payload: ApplyLayerRenamesPayload }
  // Accessibility
  | { type: 'GET_TOUCH_TARGET_ANALYSIS'; payload?: { threshold?: number; scope?: 'selection' | 'page' } }
  | { type: 'GET_TEXT_SIZE_ANALYSIS'; payload?: { minSize?: number; scope?: 'selection' | 'page' } }
  | { type: 'FOCUS_NODE'; payload: FocusNodePayload }
  // Responsive
  | { type: 'GET_RESPONSIVE_ANALYSIS'; payload?: { customWidth?: number; customHeight?: number } }
  | { type: 'GET_RESPONSIVE_CSS' }
  | { type: 'GET_RESPONSIVE_PREVIEW'; payload: { presetId: ResponsiveTargetPreset } }
  | { type: 'MAKE_RESPONSIVE'; payload: { presetId: ResponsiveTargetPreset; offsetX?: number; offsetY?: number } }
  // Cleanup
  | { type: 'GET_DESIGN_AUDIT'; payload?: { scope?: 'selection' | 'page' } }
  | { type: 'GET_LAYER_CLEANUP_CANDIDATES'; payload?: { scope?: 'selection' | 'page' } }
  | { type: 'APPLY_LAYER_CLEANUP'; payload: ApplyLayerCleanupPayload }
  | { type: 'GET_STYLE_CLEANUP_ANALYSIS' }
  | { type: 'APPLY_DELETE_STYLES'; payload: ApplyDeleteStylesPayload }
  // Developer
  | { type: 'GET_CSS_GENERATOR_DATA' }
  | { type: 'GET_COLOR_EXPORT_DATA'; payload?: { scope?: 'selection' | 'page' } }
  | { type: 'GET_DESIGN_TOKENS_DATA'; payload?: { scope?: 'selection' | 'page' } };

// Messages sent from the plugin sandbox → UI iframe
export type PluginMessage =
  | { type: 'SELECTION_CHANGED'; payload: SelectionInfo }
  | { type: 'SPACING_INFO'; payload: SpacingInfo }
  | { type: 'AUTO_LAYOUT_ANALYSIS'; payload: AutoLayoutAnalysis }
  | { type: 'IMAGE_BYTES'; payload: ImageBytesPayload }
  | { type: 'FRAME_CONTRAST_ANALYSIS'; payload: FrameContrastAnalysis | null }
  | { type: 'SUCCESS'; payload: { message: string } }
  | { type: 'ERROR'; payload: { message: string } }
  // Components
  | { type: 'COMPONENT_NAMING_ANALYSIS'; payload: ComponentNamingAnalysis }
  | { type: 'LAYER_NAMING_ANALYSIS'; payload: LayerNamingAnalysis }
  // Accessibility
  | { type: 'TOUCH_TARGET_ANALYSIS'; payload: TouchTargetAnalysis }
  | { type: 'TEXT_SIZE_ANALYSIS'; payload: TextSizeAnalysis }
  // Responsive
  | { type: 'RESPONSIVE_ANALYSIS'; payload: ResponsiveAnalysis | null }
  | { type: 'RESPONSIVE_CSS'; payload: ResponsiveCssData | null }
  | { type: 'RESPONSIVE_PREVIEW'; payload: ResponsivePreviewSummary | null }
  | { type: 'RESPONSIVE_TRANSFORM_RESULT'; payload: ResponsiveTransformSummary | null }
  // Cleanup
  | { type: 'DESIGN_AUDIT_REPORT'; payload: DesignAuditReport }
  | { type: 'LAYER_CLEANUP_ANALYSIS'; payload: LayerCleanupAnalysis }
  | { type: 'STYLE_CLEANUP_ANALYSIS'; payload: StyleCleanupAnalysis }
  // Developer
  | { type: 'CSS_GENERATOR_DATA'; payload: CssGeneratorData | null }
  | { type: 'COLOR_EXPORT_DATA'; payload: ColorExportData }
  | { type: 'DESIGN_TOKENS_DATA'; payload: DesignTokensData };
