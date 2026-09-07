import React, { useState, useEffect, useCallback } from 'react'
import type {
  SelectionInfo,
  ResponsiveAnalysis,
  ResponsiveIssue,
  PluginMessage,
} from '../../../shared/types'
import { SelectionBanner } from '../../components/Selection/SelectionBanner'
import { sendToPlugin } from '../../utils/messaging'
import { validateCustomViewport } from '../../../shared/responsivePresets'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

export const ResponsiveChecker: React.FC<Props> = ({ selection, onSuccess, onError }) => {
  const [analysis, setAnalysis] = useState<ResponsiveAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedViewportId, setSelectedViewportId] = useState<string>('mobile')
  const [customWidth, setCustomWidth] = useState<string>('414')
  const [customHeight, setCustomHeight] = useState<string>('896')
  const [includeCustom, setIncludeCustom] = useState<boolean>(false)

  const requestAnalysis = useCallback(
    (includeCust = includeCustom, cWidth = customWidth, cHeight = customHeight) => {
      setLoading(true)
      let customPayload: { customWidth?: number; customHeight?: number } | undefined = undefined

      if (includeCust) {
        const w = parseInt(cWidth, 10)
        const h = parseInt(cHeight, 10)
        const valid = validateCustomViewport(w, h)
        if (valid.valid) {
          customPayload = { customWidth: w, customHeight: h }
        }
      }

      sendToPlugin({
        type: 'GET_RESPONSIVE_ANALYSIS',
        payload: customPayload,
      })
    },
    [includeCustom, customWidth, customHeight]
  )

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as PluginMessage | undefined
      if (msg?.type === 'RESPONSIVE_ANALYSIS') {
        setAnalysis(msg.payload)
        setLoading(false)
      }
    }

    window.addEventListener('message', handleMessage)
    requestAnalysis()

    return () => window.removeEventListener('message', handleMessage)
  }, [requestAnalysis])

  // Re-run analysis when selection changes
  useEffect(() => {
    requestAnalysis()
  }, [selection, requestAnalysis])

  const handleFocus = (nodeId: string) => {
    sendToPlugin({ type: 'FOCUS_NODE', payload: { nodeId } })
  }

  const handleApplyCustom = () => {
    const w = parseInt(customWidth, 10)
    const h = parseInt(customHeight, 10)
    const valid = validateCustomViewport(w, h)
    if (!valid.valid) {
      onError(valid.error || 'Invalid custom viewport dimensions.')
      return
    }
    setIncludeCustom(true)
    setSelectedViewportId('custom')
    requestAnalysis(true, customWidth, customHeight)
    onSuccess(`Auditing against Custom viewport (${w}×${h})`)
  }

  const currentResult = analysis?.results.find(r => r.viewportId === selectedViewportId) || analysis?.results[0]
  const hasFrameSelected = selection && selection.count > 0 && (selection.hasFrame || selection.types.some(t => t === 'FRAME' || t === 'COMPONENT' || t === 'GROUP' || t === 'SECTION'))

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Responsive</div>
        <h1 className="tool-title">Responsive Checker</h1>
        <p className="tool-description">
          Audit the selected design across Desktop, Laptop, Tablet, Mobile, and Custom viewports to detect overflow, fixed sizing, and layout constraints.
        </p>
      </div>

      <div className="tool-body">
        <SelectionBanner
          selection={selection}
          selectionHint="Select a frame to audit responsive layout and overflow issues."
        />

        {/* Viewport Selector / Summary Cards */}
        {analysis && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-primary)' }}>
                Target Viewports ({analysis.results.length})
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => requestAnalysis()}
                disabled={loading}
              >
                {loading ? 'Auditing…' : 'Re-audit'}
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: 'var(--sp-2)',
              }}
            >
              {analysis.results.map(r => {
                const isSelected = r.viewportId === selectedViewportId
                const issueCount = r.issues.length
                const isPass = r.status === 'PASS'
                const isFail = r.status === 'FAIL'

                const borderColor = isSelected
                  ? 'var(--c-accent)'
                  : isFail
                  ? 'rgba(239, 68, 68, 0.4)'
                  : !isPass
                  ? 'rgba(245, 158, 11, 0.4)'
                  : 'var(--c-border-subtle)'

                const statusColor = isFail
                  ? 'var(--c-danger, #ef4444)'
                  : !isPass
                  ? 'var(--c-warning, #f59e0b)'
                  : 'var(--c-success, #10b981)'

                const statusIcon = isFail ? '✕' : !isPass ? '⚠' : '✓'
                const statusLabel = isPass
                  ? 'No issues'
                  : `${issueCount} issue${issueCount !== 1 ? 's' : ''}`

                return (
                  <button
                    key={r.viewportId}
                    onClick={() => setSelectedViewportId(r.viewportId)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: 'var(--sp-3)',
                      background: isSelected ? 'var(--c-surface-raised, #252836)' : 'var(--c-surface)',
                      border: `1px solid ${borderColor}`,
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-primary)' }}>
                        {r.viewportName.split(' ')[0]}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: statusColor,
                        }}
                      >
                        {statusIcon}
                      </span>
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)', marginBottom: 6 }}>
                      {r.width} × {r.height}
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: statusColor,
                      }}
                    >
                      {statusLabel}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Custom Viewport Form */}
        <div className="card" style={{ padding: 'var(--sp-3) var(--sp-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-2)' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-primary)' }}>
              Add Custom Viewport
            </span>
            <span style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>
              Width & Height (px)
            </span>
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
              <span style={{ fontSize: 11, color: 'var(--c-text-secondary)' }}>W:</span>
              <input
                type="number"
                className="input"
                style={{ width: '100%', fontSize: 12, padding: '4px 8px' }}
                value={customWidth}
                onChange={e => setCustomWidth(e.target.value)}
                placeholder="414"
                min="1"
                max="10000"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
              <span style={{ fontSize: 11, color: 'var(--c-text-secondary)' }}>H:</span>
              <input
                type="number"
                className="input"
                style={{ width: '100%', fontSize: 12, padding: '4px 8px' }}
                value={customHeight}
                onChange={e => setCustomHeight(e.target.value)}
                placeholder="896"
                min="1"
                max="10000"
              />
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={handleApplyCustom}
              disabled={loading}
              style={{ whiteSpace: 'nowrap' }}
            >
              Check Custom
            </button>
          </div>
        </div>

        {/* Audit Details for Selected Viewport */}
        {loading ? (
          <div className="empty-state">
            <div style={{ fontSize: 13, color: 'var(--c-text-tertiary)' }}>
              Auditing responsive layout and geometry…
            </div>
          </div>
        ) : !analysis || !hasFrameSelected ? (
          <div className="empty-state">
            <div className="empty-state-title">Select a Frame</div>
            <div className="empty-state-body">
              Select a frame or container on the canvas to check for horizontal overflows, fixed sizing, and responsive constraints.
            </div>
          </div>
        ) : currentResult ? (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div
              className="card-header"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: 'var(--sp-3)',
                borderBottom: '1px solid var(--c-border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <span className="card-title">
                  {currentResult.viewportName} ({currentResult.width}×{currentResult.height})
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background:
                      currentResult.status === 'FAIL'
                        ? 'rgba(239, 68, 68, 0.15)'
                        : currentResult.status === 'WARNING'
                        ? 'rgba(245, 158, 11, 0.15)'
                        : 'rgba(16, 185, 129, 0.15)',
                    color:
                      currentResult.status === 'FAIL'
                        ? 'var(--c-danger, #ef4444)'
                        : currentResult.status === 'WARNING'
                        ? 'var(--c-warning, #f59e0b)'
                        : 'var(--c-success, #10b981)',
                  }}
                >
                  {currentResult.status}
                </span>
              </div>

              <span style={{ fontSize: 12, color: 'var(--c-text-tertiary)' }}>
                {currentResult.issues.length} {currentResult.issues.length === 1 ? 'item' : 'items'} found
              </span>
            </div>

            {currentResult.issues.length === 0 ? (
              <div style={{ padding: 'var(--sp-4)', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-success, #10b981)', marginBottom: 4 }}>
                  ✓ No Responsive Issues Detected
                </div>
                <div style={{ fontSize: 12, color: 'var(--c-text-tertiary)' }}>
                  All element bounds and text fit within the {currentResult.viewportName} ({currentResult.width}px) viewport.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 380, overflowY: 'auto' }}>
                {currentResult.issues.map((issue: ResponsiveIssue, idx: number) => {
                  const isFail = issue.severity === 'FAIL'

                  return (
                    <div
                      key={issue.id || idx}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 'var(--sp-3)',
                        padding: 'var(--sp-3) var(--sp-4)',
                        borderBottom:
                          idx < currentResult.issues.length - 1
                            ? '1px solid var(--c-border-subtle)'
                            : 'none',
                        background: isFail ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          marginTop: 2,
                          background: isFail
                            ? 'rgba(239, 68, 68, 0.2)'
                            : 'rgba(245, 158, 11, 0.2)',
                          color: isFail
                            ? 'var(--c-danger, #ef4444)'
                            : 'var(--c-warning, #f59e0b)',
                        }}
                      >
                        {issue.severity}
                      </span>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-primary)' }}>
                            {issue.nodeName}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              color: 'var(--c-text-tertiary)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            [{issue.category}]
                          </span>
                        </div>

                        <div style={{ fontSize: 12, color: 'var(--c-text-primary)', marginBottom: 4 }}>
                          {issue.message}
                        </div>

                        {issue.details && (
                          <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>
                            {issue.details}
                          </div>
                        )}
                      </div>

                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleFocus(issue.nodeId)}
                        title="Zoom to layer in Figma"
                        style={{ fontSize: 11, whiteSpace: 'nowrap', padding: '3px 8px' }}
                      >
                        Focus
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default ResponsiveChecker
