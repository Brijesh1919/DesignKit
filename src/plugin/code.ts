// ============================================================
// Plugin main entry — runs inside Figma's sandboxed JS env.
// No DOM access here. Communicates with the UI via messages.
// ============================================================

import type { UIMessage } from '../shared/types'
import { getSelectionInfo } from './figma/utilities'
import { createColorStyles, applyColorToSelection, getFrameContrastAnalysis } from './figma/colors'
import { createTextStyles } from './figma/typography'
import {
  getSpacingInfo,
  applySpacing,
  getAutoLayoutAnalysis,
  applyAutoLayout,
} from './figma/layout'
import { getImageBytes, applyImage } from './figma/images'
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
