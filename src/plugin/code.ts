// ============================================================
// Plugin main entry — runs inside Figma's sandboxed JS env.
// No DOM access here. Communicates with the UI via messages.
// ============================================================

import type { UIMessage } from '../shared/types'
import { getSelectionInfo } from './figma/utilities'
import {
  createColorStyles,
  applyColorToSelection,
  getFrameContrastAnalysis,
  getExtractedColorsData,
} from './figma/colors'
import {
  createTextStyles,
  createCustomTextStyle,
  getTextStyleExtractorData,
  applyStyleToText,
  applyLineHeightToSelection,
} from './figma/typography'
import {
  getSpacingInfo,
  applySpacing,
  getAutoLayoutAnalysis,
  applyAutoLayout,
  getGridCheckerAnalysis,
  applyGridFixes,
  applyPaddingToSelection,
  applyAlignmentToSelection,
} from './figma/layout'
import {
  getImageBytes,
  applyImage,
  applyImageResize,
  applyImageCrop,
} from './figma/images'
import {
  createComponentFromSelection,
  getComponentNamingAnalysis,
  applyComponentRenames,
  getLayerNamingAnalysis,
  applyLayerRenames,
} from './figma/components'
import {
  getTouchTargetAnalysis,
  getTextSizeAnalysis,
} from './figma/accessibility'
import {
  getDesignAudit,
  getLayerCleanupCandidates,
  applyLayerCleanup,
  getStyleCleanupAnalysis,
  applyDeleteStyles,
} from './figma/cleanup'
import {
  getCssForSelection,
  getColorExportData,
  getDesignTokens,
} from './figma/developer'
import {
  getResponsiveAnalysis,
  getResponsiveCssForSelection,
  getResponsivePreview,
  applyResponsiveTransform,
} from './figma/responsive'
import {
  collectTextNodes,
  applyTextCorrection,
  applyBatchCorrections,
  setReviewHighlights,
  clearReviewHighlights,
  setFocusedWordHighlight,
  loadFontsForTextNode,
} from './figma/textQA'


// -------------------------------------------------------
// Open plugin UI (900×675 ≈ 4:3)
// -------------------------------------------------------
figma.showUI(__html__, {
  width: 900,
  height: 675,
  themeColors: false,
})

// Send initial selection immediately
figma.ui.postMessage({
  type: 'SELECTION_CHANGED',
  payload: getSelectionInfo(figma.currentPage.selection),
})
figma.ui.postMessage({
  type: 'FRAME_CONTRAST_ANALYSIS',
  payload: getFrameContrastAnalysis(figma.currentPage.selection),
})

// Push selection updates whenever the user changes it
figma.on('selectionchange', () => {
  figma.ui.postMessage({
    type: 'SELECTION_CHANGED',
    payload: getSelectionInfo(figma.currentPage.selection),
  })
  figma.ui.postMessage({
    type: 'FRAME_CONTRAST_ANALYSIS',
    payload: getFrameContrastAnalysis(figma.currentPage.selection),
  })
})

// Clean up temporary Review Mode highlights when the plugin closes
figma.on('close', () => {
  clearReviewHighlights()
})


// -------------------------------------------------------
// Message router — handle all requests from the UI
// -------------------------------------------------------
figma.ui.on('message', async (msg: UIMessage) => {
  try {
    switch (msg.type) {
      // ---- General ----
      case 'GET_SELECTION': {
        figma.ui.postMessage({
          type: 'SELECTION_CHANGED',
          payload: getSelectionInfo(figma.currentPage.selection),
        })
        figma.ui.postMessage({
          type: 'FRAME_CONTRAST_ANALYSIS',
          payload: getFrameContrastAnalysis(figma.currentPage.selection),
        })
        break
      }

      case 'GET_FRAME_CONTRAST_ANALYSIS': {
        figma.ui.postMessage({
          type: 'FRAME_CONTRAST_ANALYSIS',
          payload: getFrameContrastAnalysis(figma.currentPage.selection),
        })
        break
      }

      case 'NOTIFY': {
        figma.notify(msg.payload.message)
        break
      }

      case 'FOCUS_NODE': {
        const node = figma.getNodeById(msg.payload.nodeId)
        if (node && node.type !== 'PAGE' && node.type !== 'DOCUMENT') {
          figma.currentPage.selection = [node as SceneNode]
          figma.viewport.scrollAndZoomIntoView([node as SceneNode])
        }
        break
      }

      // ---- Colors ----
      case 'CREATE_COLOR_STYLES': {
        const count = await createColorStyles(msg.payload)
        figma.notify(`✅ Created ${count} color style${count !== 1 ? 's' : ''}`)
        figma.ui.postMessage({
          type: 'SUCCESS',
          payload: { message: `Created ${count} color style${count !== 1 ? 's' : ''}` },
        })
        break
      }

      case 'APPLY_COLOR_TO_SELECTION': {
        await applyColorToSelection(msg.payload.hex)
        figma.ui.postMessage({
          type: 'SUCCESS',
          payload: { message: 'Color applied to selected layer(s)' },
        })
        break
      }

      // ---- Typography ----
      case 'CREATE_TEXT_STYLES': {
        const count = await createTextStyles(msg.payload)
        figma.notify(`✅ Created ${count} text style${count !== 1 ? 's' : ''}`)
        figma.ui.postMessage({
          type: 'SUCCESS',
          payload: { message: `Created ${count} text style${count !== 1 ? 's' : ''}` },
        })
        break
      }

      // ---- Layout: Spacing ----
      case 'GET_SPACING_INFO': {
        const info = getSpacingInfo(figma.currentPage.selection)
        figma.ui.postMessage({ type: 'SPACING_INFO', payload: info })
        break
      }

      case 'APPLY_SPACING': {
        await applySpacing(msg.payload)
        figma.ui.postMessage({
          type: 'SUCCESS',
          payload: { message: 'Spacing normalized successfully' },
        })
        break
      }

      // ---- Layout: Auto Layout ----
      case 'GET_AUTO_LAYOUT_ANALYSIS': {
        const analysis = getAutoLayoutAnalysis(figma.currentPage.selection)
        if (analysis) {
          figma.ui.postMessage({ type: 'AUTO_LAYOUT_ANALYSIS', payload: analysis })
        } else {
          figma.ui.postMessage({
            type: 'ERROR',
            payload: {
              message:
                'Please select a single Frame containing at least 2 child layers to analyze.',
            },
          })
        }
        break
      }

      case 'APPLY_AUTO_LAYOUT': {
        await applyAutoLayout(msg.payload)
        figma.notify('✅ Auto layout applied')
        figma.ui.postMessage({
          type: 'SUCCESS',
          payload: { message: 'Auto layout applied successfully' },
        })
        break
      }

      // ---- Images ----
      case 'GET_IMAGE_BYTES': {
        const data = await getImageBytes(figma.currentPage.selection)
        if (data) {
          figma.ui.postMessage({ type: 'IMAGE_BYTES', payload: data })
        } else {
          figma.ui.postMessage({
            type: 'ERROR',
            payload: {
              message:
                'No image layer selected. Select a layer with an image fill, or any visible layer to export.',
            },
          })
        }
        break
      }

      case 'APPLY_IMAGE': {
        await applyImage(msg.payload)
        figma.notify('✅ Image updated')
        figma.ui.postMessage({
          type: 'SUCCESS',
          payload: { message: 'Image applied to layer' },
        })
        break
      }

      // ---- Components ----
      case 'CREATE_COMPONENT': {
        const result = await createComponentFromSelection(msg.payload)
        figma.notify(`✅ ${result.message}`)
        figma.ui.postMessage({
          type: 'SUCCESS',
          payload: { message: result.message },
        })
        break
      }

      case 'GET_COMPONENT_NAMING_ANALYSIS': {
        const analysis = getComponentNamingAnalysis(
          figma.currentPage.selection,
          msg.payload?.scope ?? 'selection'
        )
        figma.ui.postMessage({
          type: 'COMPONENT_NAMING_ANALYSIS',
          payload: analysis,
        })
        break
      }

      case 'APPLY_COMPONENT_RENAMES': {
        const count = await applyComponentRenames(msg.payload)
        figma.notify(`✅ Renamed ${count} component${count !== 1 ? 's' : ''}`)
        figma.ui.postMessage({
          type: 'SUCCESS',
          payload: { message: `Renamed ${count} component${count !== 1 ? 's' : ''}` },
        })
        break
      }

      case 'GET_LAYER_NAMING_ANALYSIS': {
        const analysis = getLayerNamingAnalysis(
          figma.currentPage.selection,
          msg.payload?.scope ?? 'selection'
        )
        figma.ui.postMessage({
          type: 'LAYER_NAMING_ANALYSIS',
          payload: analysis,
        })
        break
      }

      case 'APPLY_LAYER_RENAMES': {
        const count = await applyLayerRenames(msg.payload)
        figma.notify(`✅ Renamed ${count} layer${count !== 1 ? 's' : ''}`)
        figma.ui.postMessage({
          type: 'SUCCESS',
          payload: { message: `Renamed ${count} layer${count !== 1 ? 's' : ''}` },
        })
        break
      }

      // ---- Accessibility ----
      case 'GET_TOUCH_TARGET_ANALYSIS': {
        const analysis = getTouchTargetAnalysis(
          figma.currentPage.selection,
          msg.payload?.threshold ?? 44,
          msg.payload?.scope ?? 'selection'
        )
        figma.ui.postMessage({
          type: 'TOUCH_TARGET_ANALYSIS',
          payload: analysis,
        })
        break
      }

      case 'GET_TEXT_SIZE_ANALYSIS': {
        const analysis = getTextSizeAnalysis(
          figma.currentPage.selection,
          msg.payload?.minSize ?? 12,
          msg.payload?.scope ?? 'selection'
        )
        figma.ui.postMessage({
          type: 'TEXT_SIZE_ANALYSIS',
          payload: analysis,
        })
        break
      }

      // ---- Responsive ----
      case 'GET_RESPONSIVE_ANALYSIS': {
        const analysis = getResponsiveAnalysis(
          figma.currentPage.selection,
          msg.payload
        )
        figma.ui.postMessage({
          type: 'RESPONSIVE_ANALYSIS',
          payload: analysis,
        })
        break
      }

      case 'GET_RESPONSIVE_CSS': {
        const cssData = getResponsiveCssForSelection(figma.currentPage.selection)
        figma.ui.postMessage({
          type: 'RESPONSIVE_CSS',
          payload: cssData,
        })
        break
      }

      case 'GET_RESPONSIVE_PREVIEW': {
        const preview = getResponsivePreview(
          figma.currentPage.selection,
          msg.payload.presetId
        )
        figma.ui.postMessage({
          type: 'RESPONSIVE_PREVIEW',
          payload: preview,
        })
        break
      }

      case 'MAKE_RESPONSIVE': {
        const result = await applyResponsiveTransform(
          figma.currentPage.selection,
          msg.payload.presetId,
          msg.payload.offsetX ?? 100,
          msg.payload.offsetY ?? 0
        )
        figma.ui.postMessage({
          type: 'RESPONSIVE_TRANSFORM_RESULT',
          payload: result,
        })
        if (result) {
          figma.notify(`✅ "${result.newFrameName}" created — ${result.mutationsApplied} adjustments applied`)
        }
        break
      }

      // ---- Cleanup ----
      case 'GET_DESIGN_AUDIT': {
        const report = getDesignAudit(
          figma.currentPage.selection,
          msg.payload?.scope ?? 'selection'
        )
        figma.ui.postMessage({
          type: 'DESIGN_AUDIT_REPORT',
          payload: report,
        })
        break
      }

      case 'GET_LAYER_CLEANUP_CANDIDATES': {
        const analysis = getLayerCleanupCandidates(
          figma.currentPage.selection,
          msg.payload?.scope ?? 'selection'
        )
        figma.ui.postMessage({
          type: 'LAYER_CLEANUP_ANALYSIS',
          payload: analysis,
        })
        break
      }

      case 'APPLY_LAYER_CLEANUP': {
        const count = await applyLayerCleanup(msg.payload)
        figma.notify(`✅ Cleaned ${count} layer${count !== 1 ? 's' : ''}`)
        figma.ui.postMessage({
          type: 'SUCCESS',
          payload: { message: `Cleaned ${count} layer${count !== 1 ? 's' : ''}` },
        })
        break
      }

      case 'GET_STYLE_CLEANUP_ANALYSIS': {
        const analysis = getStyleCleanupAnalysis()
        figma.ui.postMessage({
          type: 'STYLE_CLEANUP_ANALYSIS',
          payload: analysis,
        })
        break
      }

      case 'APPLY_DELETE_STYLES': {
        const count = await applyDeleteStyles(msg.payload)
        figma.notify(`✅ Deleted ${count} unused style${count !== 1 ? 's' : ''}`)
        figma.ui.postMessage({
          type: 'SUCCESS',
          payload: { message: `Deleted ${count} unused style${count !== 1 ? 's' : ''}` },
        })
        break
      }

      // ---- Developer ----
      case 'GET_CSS_GENERATOR_DATA': {
        const data = getCssForSelection(figma.currentPage.selection)
        figma.ui.postMessage({
          type: 'CSS_GENERATOR_DATA',
          payload: data,
        })
        break
      }

      case 'GET_COLOR_EXPORT_DATA': {
        const data = getColorExportData(
          figma.currentPage.selection,
          msg.payload?.scope ?? 'selection'
        )
        figma.ui.postMessage({
          type: 'COLOR_EXPORT_DATA',
          payload: data,
        })
        break
      }

      case 'GET_DESIGN_TOKENS_DATA': {
        const data = getDesignTokens(
          figma.currentPage.selection,
          msg.payload?.scope ?? 'selection'
        )
        figma.ui.postMessage({
          type: 'DESIGN_TOKENS_DATA',
          payload: data,
        })
        break
      }

      // ---- Text QA ----
      case 'COLLECT_TEXT_NODES': {
        const response = collectTextNodes(figma.currentPage.selection)
        figma.ui.postMessage({
          type: 'COLLECTED_TEXT_NODES',
          payload: response,
        })
        break
      }

      case 'TEXT_QA_APPLY_CORRECTION': {
        const success = await applyTextCorrection(msg.payload)
        figma.ui.postMessage({
          type: 'TEXT_QA_CORRECTION_APPLIED',
          payload: {
            issueId: msg.payload.issueId,
            nodeId: msg.payload.nodeId,
            success,
          },
        })
        figma.notify('✅ Correction applied')
        break
      }

      case 'TEXT_QA_APPLY_BATCH_CORRECTIONS': {
        const count = await applyBatchCorrections(msg.payload)
        figma.ui.postMessage({
          type: 'TEXT_QA_BATCH_APPLIED',
          payload: { count, success: true },
        })
        figma.notify(`✅ Applied ${count} safe fix${count !== 1 ? 'es' : ''}`)
        break
      }

      case 'TEXT_QA_SET_HIGHLIGHTS': {
        await setReviewHighlights(msg.payload)
        break
      }

      case 'TEXT_QA_CLEAR_HIGHLIGHTS': {
        clearReviewHighlights()
        break
      }

      case 'TEXT_QA_FOCUS_WORD': {
        const node = figma.getNodeById(msg.payload.nodeId)
        if (node && node.type === 'TEXT') {
          const textNode = node as TextNode

          let start = msg.payload.start
          let end = msg.payload.end
          if (msg.payload.original) {
            if (textNode.characters.slice(start, end) !== msg.payload.original) {
              const idx = textNode.characters.indexOf(msg.payload.original)
              if (idx !== -1) {
                start = idx
                end = idx + msg.payload.original.length
              }
            }
          }

          // 1. Ensure fonts are loaded first
          await loadFontsForTextNode(textNode)

          // 2. Create the visual focused word highlight over the specific word
          await setFocusedWordHighlight(
            textNode,
            msg.payload.original,
            msg.payload.issueType ?? 'SPELLING',
            start,
            end
          )

          // 3. Select node and scroll into view
          figma.currentPage.selection = [textNode]
          figma.viewport.scrollAndZoomIntoView([textNode])

          // 4. Set character range selection in Figma LAST so cursor/range stays focused on that exact word
          try {
            const len = textNode.characters.length
            const safeStart = Math.max(0, Math.min(start, len))
            const safeEnd = Math.max(safeStart, Math.min(end, len))
            figma.currentPage.selectedTextRange = {
              node: textNode,
              start: safeStart,
              end: safeEnd,
            }
          } catch (err) {
            console.warn('[DesignKit TextQA] selectedTextRange error:', err)
          }
        }
        break
      }

      case 'GET_EXTRACTED_COLORS': {
        const data = getExtractedColorsData(msg.payload?.scope ?? 'selection')
        figma.ui.postMessage({
          type: 'EXTRACTED_COLORS_DATA',
          payload: data,
        })
        break
      }

      case 'GET_GRID_CHECKER_ANALYSIS': {
        const grid = msg.payload?.grid ?? 8
        const scope = msg.payload?.scope ?? 'selection'
        const analysis = getGridCheckerAnalysis(grid, scope)
        figma.ui.postMessage({
          type: 'GRID_CHECKER_ANALYSIS',
          payload: analysis,
        })
        break
      }

      case 'APPLY_GRID_FIXES': {
        const count = applyGridFixes(msg.payload)
        figma.notify(`✅ Snapped ${count} property values to grid`)
        figma.ui.postMessage({
          type: 'SUCCESS',
          payload: { message: `Snapped ${count} properties to grid` },
        })
        break
      }

      case 'APPLY_PADDING': {
        applyPaddingToSelection(msg.payload)
        figma.notify('✅ Padding applied successfully')
        figma.ui.postMessage({
          type: 'SUCCESS',
          payload: { message: 'Padding updated' },
        })
        break
      }

      case 'APPLY_ALIGNMENT': {
        const count = applyAlignmentToSelection(msg.payload.alignType)
        figma.notify(`✅ Aligned ${count} layer${count !== 1 ? 's' : ''}`)
        figma.ui.postMessage({
          type: 'SUCCESS',
          payload: { message: `Aligned ${count} layer${count !== 1 ? 's' : ''}` },
        })
        break
      }

      case 'CREATE_CUSTOM_TEXT_STYLE': {
        const style = await createCustomTextStyle(msg.payload)
        figma.notify(`✅ Created style "${style.name}"`)
        figma.ui.postMessage({
          type: 'SUCCESS',
          payload: { message: `Created text style "${style.name}"` },
        })
        break
      }

      case 'GET_TEXT_STYLE_EXTRACTOR_DATA': {
        const data = getTextStyleExtractorData(msg.payload?.scope ?? 'selection')
        figma.ui.postMessage({
          type: 'TEXT_STYLE_EXTRACTOR_DATA',
          payload: data,
        })
        break
      }

      case 'APPLY_STYLE_TO_TEXT': {
        applyStyleToText(msg.payload.nodeId, msg.payload.styleId)
        figma.notify('✅ Style linked to text layer')
        figma.ui.postMessage({
          type: 'SUCCESS',
          payload: { message: 'Style linked to layer' },
        })
        break
      }

      case 'APPLY_LINE_HEIGHT': {
        const count = await applyLineHeightToSelection(msg.payload)
        figma.notify(`✅ Updated line height on ${count} text layer${count !== 1 ? 's' : ''}`)
        figma.ui.postMessage({
          type: 'SUCCESS',
          payload: { message: `Updated line height on ${count} layer${count !== 1 ? 's' : ''}` },
        })
        break
      }

      case 'APPLY_IMAGE_RESIZE': {
        const count = applyImageResize(msg.payload)
        figma.notify(`✅ Resized ${count} layer${count !== 1 ? 's' : ''}`)
        figma.ui.postMessage({
          type: 'SUCCESS',
          payload: { message: `Resized ${count} layer${count !== 1 ? 's' : ''}` },
        })
        break
      }

      case 'APPLY_IMAGE_CROP': {
        const count = applyImageCrop(msg.payload)
        figma.notify(`✅ Aspect ratio updated on ${count} layer${count !== 1 ? 's' : ''}`)
        figma.ui.postMessage({
          type: 'SUCCESS',
          payload: { message: `Adjusted aspect ratio on ${count} layer${count !== 1 ? 's' : ''}` },
        })
        break
      }

      default: {
        console.warn('[DesignKit] Unknown message type:', (msg as any).type)
        break
      }
    }
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Something went wrong. Please try again.'
    console.error('[DesignKit] Error:', err)
    figma.ui.postMessage({ type: 'ERROR', payload: { message } })
  }
})
