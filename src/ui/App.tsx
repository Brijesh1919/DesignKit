import React, { useReducer, useEffect, Suspense, useCallback } from 'react'
import { Header } from './components/Layout/Header'
import { Sidebar } from './components/Layout/Sidebar'
import { Dashboard } from './tools/Dashboard'
import { ComingSoon } from './tools/ComingSoon'
import {
  CATEGORIES,
  findTool,
  findCategory,
  type ToolCategoryId,
} from './registry/toolRegistry'
import type {
  SelectionInfo,
  SpacingInfo,
  AutoLayoutAnalysis,
  ImageBytesPayload,
  FrameContrastAnalysis,
  PluginMessage,
} from '../shared/types'
import './styles/base.css'
import './styles/components.css'

// ============================================================
// App State
// ============================================================

interface AppState {
  activeCategoryId: ToolCategoryId | null
  activeToolId: string | null
  selection: SelectionInfo | null
  spacingInfo: SpacingInfo | null
  autoLayoutAnalysis: AutoLayoutAnalysis | null
  imageBytes: ImageBytesPayload | null
  frameContrastAnalysis: FrameContrastAnalysis | null
  recentToolIds: string[]
  notification: { type: 'success' | 'error'; message: string } | null
}

type AppAction =
  | { type: 'SET_CATEGORY'; payload: ToolCategoryId }
  | { type: 'SET_TOOL'; payload: string }
  | { type: 'SET_SELECTION'; payload: SelectionInfo }
  | { type: 'SET_SPACING_INFO'; payload: SpacingInfo }
  | { type: 'SET_AUTO_LAYOUT_ANALYSIS'; payload: AutoLayoutAnalysis }
  | { type: 'SET_IMAGE_BYTES'; payload: ImageBytesPayload }
  | { type: 'SET_FRAME_CONTRAST_ANALYSIS'; payload: FrameContrastAnalysis | null }
  | { type: 'NOTIFY'; payload: { type: 'success' | 'error'; message: string } }
  | { type: 'CLEAR_NOTIFICATION' }

const MAX_RECENT = 5

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_CATEGORY':
      return { ...state, activeCategoryId: action.payload, activeToolId: null }

    case 'SET_TOOL': {
      const toolId = action.payload
      const recent = [toolId, ...state.recentToolIds.filter(id => id !== toolId)].slice(0, MAX_RECENT)
      // Determine category from registry
      const tool = findTool(toolId)
      const categoryId = tool?.categoryId ?? state.activeCategoryId
      return {
        ...state,
        activeToolId: toolId,
        activeCategoryId: categoryId ?? state.activeCategoryId,
        recentToolIds: recent,
        // Reset tool-specific data when switching tools
        spacingInfo: null,
        autoLayoutAnalysis: null,
        imageBytes: null,
      }
    }

    case 'SET_SELECTION':
      return { ...state, selection: action.payload }

    case 'SET_SPACING_INFO':
      return { ...state, spacingInfo: action.payload }

    case 'SET_AUTO_LAYOUT_ANALYSIS':
      return { ...state, autoLayoutAnalysis: action.payload }

    case 'SET_IMAGE_BYTES':
      return { ...state, imageBytes: action.payload }

    case 'SET_FRAME_CONTRAST_ANALYSIS':
      return { ...state, frameContrastAnalysis: action.payload }

    case 'NOTIFY':
      return { ...state, notification: action.payload }

    case 'CLEAR_NOTIFICATION':
      return { ...state, notification: null }

    default:
      return state
  }
}

const initialState: AppState = {
  activeCategoryId: null,
  activeToolId: null,
  selection: null,
  spacingInfo: null,
  autoLayoutAnalysis: null,
  imageBytes: null,
  frameContrastAnalysis: null,
  recentToolIds: [],
  notification: null,
}

// ============================================================
// Tool view router
// ============================================================

interface ToolViewProps {
  toolId: string
  state: AppState
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

const ToolViewRouter: React.FC<ToolViewProps> = ({ toolId, state, onSuccess, onError }) => {
  const tool = findTool(toolId)
  const category = tool ? findCategory(tool.categoryId) : null

  if (!tool) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Tool not found</div>
      </div>
    )
  }

  if (!tool.implemented || !tool.component) {
    return <ComingSoon toolName={tool.name} category={category?.label ?? ''} />
  }

  const ToolComponent = tool.component

  // Pass all relevant state as props
  return (
    <ToolComponent
      selection={state.selection}
      spacingInfo={state.spacingInfo}
      autoLayoutAnalysis={state.autoLayoutAnalysis}
      imageBytes={state.imageBytes}
      frameContrastAnalysis={state.frameContrastAnalysis}
      onSuccess={onSuccess}
      onError={onError}
    />
  )
}

// ============================================================
// Main App Component
// ============================================================

export const App: React.FC = () => {
  const [state, dispatch] = useReducer(appReducer, initialState)

  const notify = useCallback((type: 'success' | 'error', message: string) => {
    dispatch({ type: 'NOTIFY', payload: { type, message } })
  }, [])

  const onSuccess = useCallback((msg: string) => notify('success', msg), [notify])
  const onError   = useCallback((msg: string) => notify('error', msg), [notify])

  // Listen for messages from the Figma plugin sandbox
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as PluginMessage | undefined
      if (!msg?.type) return

      switch (msg.type) {
        case 'SELECTION_CHANGED':
          dispatch({ type: 'SET_SELECTION', payload: msg.payload })
          break
        case 'SPACING_INFO':
          dispatch({ type: 'SET_SPACING_INFO', payload: msg.payload })
          break
        case 'AUTO_LAYOUT_ANALYSIS':
          dispatch({ type: 'SET_AUTO_LAYOUT_ANALYSIS', payload: msg.payload })
          break
        case 'IMAGE_BYTES':
          dispatch({ type: 'SET_IMAGE_BYTES', payload: msg.payload })
          break
        case 'FRAME_CONTRAST_ANALYSIS':
          dispatch({ type: 'SET_FRAME_CONTRAST_ANALYSIS', payload: msg.payload })
          break
        case 'SUCCESS':
          notify('success', msg.payload.message)
          break
        case 'ERROR':
          notify('error', msg.payload.message)
          break
      }
    }

    window.addEventListener('message', handleMessage)

    // Request initial selection on mount
    parent.postMessage({ pluginMessage: { type: 'GET_SELECTION' } }, '*')

    return () => window.removeEventListener('message', handleMessage)
  }, [notify])

  // Auto-dismiss notifications after 3.5 seconds
  useEffect(() => {
    if (!state.notification) return
    const timer = setTimeout(() => dispatch({ type: 'CLEAR_NOTIFICATION' }), 3500)
    return () => clearTimeout(timer)
  }, [state.notification])

  const handleToolSelect = useCallback((toolId: string) => {
    dispatch({ type: 'SET_TOOL', payload: toolId })
  }, [])

  const handleCategorySelect = useCallback((categoryId: ToolCategoryId) => {
    dispatch({ type: 'SET_CATEGORY', payload: categoryId })
  }, [])

  return (
    <div className="app">
      <Header onToolSelect={handleToolSelect} />

      <div className="app-body">
        <Sidebar
          activeToolId={state.activeToolId}
          onToolSelect={handleToolSelect}
        />

        <main className="app-main">
          <Suspense
            fallback={
              <div className="empty-state">
                <div style={{ fontSize: 13, color: 'var(--c-text-tertiary)' }}>Loading…</div>
              </div>
            }
          >
            {state.activeToolId ? (
              <ToolViewRouter
                key={state.activeToolId}
                toolId={state.activeToolId}
                state={state}
                onSuccess={onSuccess}
                onError={onError}
              />
            ) : (
              <Dashboard
                selection={state.selection}
                recentToolIds={state.recentToolIds}
                onToolSelect={handleToolSelect}
              />
            )}
          </Suspense>
        </main>
      </div>

      {/* Toast notification */}
      {state.notification && (
        <div
          className={`notification notification-${state.notification.type}`}
          role="status"
          aria-live="polite"
        >
          {state.notification.type === 'success' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          )}
          {state.notification.message}
        </div>
      )}
    </div>
  )
}
