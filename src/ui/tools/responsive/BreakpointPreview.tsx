import React, { useState, useEffect, useCallback } from 'react'
import type {
  SelectionInfo,
  ResponsiveAnalysis,
  PluginMessage,
} from '../../../shared/types'
import { SelectionBanner } from '../../components/Selection/SelectionBanner'
import { sendToPlugin } from '../../utils/messaging'
import { RESPONSIVE_PRESETS, ResponsivePreset, validateCustomViewport } from '../../../shared/responsivePresets'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

export const BreakpointPreview: React.FC<Props> = ({ selection, onSuccess, onError }) => {
  const [analysis, setAnalysis] = useState<ResponsiveAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [activePresetId, setActivePresetId] = useState<string>('mobile')
  const [customW, setCustomW] = useState<string>('414')
  const [customH, setCustomH] = useState<string>('896')
  const [isCustom, setIsCustom] = useState(false)

  const requestAnalysis = useCallback(() => {
    setLoading(true)
    let payload: { customWidth?: number; customHeight?: number } | undefined = undefined
    if (isCustom) {
      const w = parseInt(customW, 10)
      const h = parseInt(customH, 10)
      if (validateCustomViewport(w, h).valid) {
        payload = { customWidth: w, customHeight: h }
      }
    }
    sendToPlugin({
      type: 'GET_RESPONSIVE_ANALYSIS',
      payload,
    })
  }, [isCustom, customW, customH])

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

  useEffect(() => {
    requestAnalysis()
  }, [selection, requestAnalysis])

  const handleSelectPreset = (preset: ResponsivePreset) => {
    setIsCustom(false)
    setActivePresetId(preset.id)
  }

  const handleApplyCustom = () => {
    const w = parseInt(customW, 10)
    const h = parseInt(customH, 10)
    const valid = validateCustomViewport(w, h)
    if (!valid.valid) {
      onError(valid.error || 'Invalid custom dimensions.')
      return
    }
    setIsCustom(true)
    setActivePresetId('custom')
    requestAnalysis()
    onSuccess(`Previewing Custom ${w}×${h}`)
  }

  const handleFocus = (nodeId: string) => {
    sendToPlugin({ type: 'FOCUS_NODE', payload: { nodeId } })
  }

  const currentPreset = isCustom
    ? { id: 'custom', name: 'Custom', width: parseInt(customW, 10) || 414, height: parseInt(customH, 10) || 896 }
    : RESPONSIVE_PRESETS.find(p => p.id === activePresetId) || RESPONSIVE_PRESETS[3] // default mobile

  const currentAudit = analysis?.results.find(r => r.viewportId === (isCustom ? 'custom' : activePresetId))
  const hasFrame = selection && selection.count > 0 && (selection.hasFrame || selection.types.some(t => t === 'FRAME' || t === 'COMPONENT' || t === 'GROUP' || t === 'SECTION'))

  // Calculate container scale to fit within preview viewport box (~420px max width)
  const previewBoxWidth = 360
  const scale = Math.min(1, previewBoxWidth / (currentPreset?.width || 390))
  const previewHeight = Math.round((currentPreset?.height || 844) * scale)
  const frameWidth = analysis?.frameWidth || 1440
  const overflowDelta = Math.max(0, frameWidth - currentPreset.width)

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Responsive</div>
        <h1 className="tool-title">Breakpoint Preview</h1>
        <p className="tool-description">
          Inspect how your selected design geometry maps into Desktop, Tablet, Mobile, and Custom device viewport bounds.
        </p>
      </div>

      <div className="tool-body">
        <SelectionBanner
          selection={selection}
          selectionHint="Select a frame to simulate and inspect across viewport breakpoints."
        />

        {/* Viewport Preset Tabs */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', alignItems: 'center' }}>
          {RESPONSIVE_PRESETS.map(p => {
            const isSelected = !isCustom && activePresetId === p.id
            return (
              <button
                key={p.id}
                className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleSelectPreset(p)}
                style={{ fontSize: 12, padding: '4px 10px' }}
              >
                {p.name} ({p.width}px)
              </button>
            )
          })}
          <button
            className={`btn btn-sm ${isCustom ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setIsCustom(true)}
            style={{ fontSize: 12, padding: '4px 10px' }}
          >
            Custom
          </button>
        </div>

        {/* Custom Input Bar if selected */}
        {isCustom && (
          <div className="card" style={{ padding: 'var(--sp-3)', display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--c-text-secondary)' }}>Width:</span>
            <input
              type="number"
              className="input"
              style={{ width: 80, fontSize: 12, padding: '3px 6px' }}
              value={customW}
              onChange={e => setCustomW(e.target.value)}
              min="1"
            />
            <span style={{ fontSize: 12, color: 'var(--c-text-secondary)' }}>Height:</span>
            <input
              type="number"
              className="input"
              style={{ width: 80, fontSize: 12, padding: '3px 6px' }}
              value={customH}
              onChange={e => setCustomH(e.target.value)}
              min="1"
            />
            <button className="btn btn-secondary btn-sm" onClick={handleApplyCustom}>
              Update
            </button>
          </div>
        )}

        {/* Main Inspection & Simulator View */}
        {!analysis || !hasFrame ? (
          <div className="empty-state">
            <div className="empty-state-title">Select a Frame</div>
            <div className="empty-state-body">
              Select a frame on the canvas to inspect its dimensions against {currentPreset.name} ({currentPreset.width}×{currentPreset.height}px).
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {/* Viewport Metrics Card */}
            <div className="card" style={{ padding: 'var(--sp-3) var(--sp-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-primary)' }}>
                  Viewport: {currentPreset.name} ({currentPreset.width} × {currentPreset.height}px)
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background:
                      overflowDelta > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color:
                      overflowDelta > 0 ? 'var(--c-danger, #ef4444)' : 'var(--c-success, #10b981)',
                  }}
                >
                  {overflowDelta > 0 ? `+${overflowDelta}px Overflow` : '✓ Fits Viewport'}
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 'var(--sp-2)',
                  fontSize: 11,
                  color: 'var(--c-text-secondary)',
                }}
              >
                <div>
                  <span style={{ color: 'var(--c-text-tertiary)' }}>Design Bounds: </span>
                  <strong>{analysis.frameWidth} × {analysis.frameHeight}px</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--c-text-tertiary)' }}>Preview Scale: </span>
                  <strong>{Math.round(scale * 100)}%</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--c-text-tertiary)' }}>Audit Status: </span>
                  <strong
                    style={{
                      color:
                        currentAudit?.status === 'FAIL'
                          ? 'var(--c-danger, #ef4444)'
                          : currentAudit?.status === 'WARNING'
                          ? 'var(--c-warning, #f59e0b)'
                          : 'var(--c-success, #10b981)',
                    }}
                  >
                    {currentAudit?.status || 'PASS'} ({currentAudit?.issues.length || 0} issues)
                  </strong>
                </div>
              </div>
            </div>

            {/* Visual Viewport Simulation Frame */}
            <div
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: 'var(--sp-4)',
                background: 'var(--c-bg-subtle, #12141a)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: Math.round(currentPreset.width * scale),
                  minHeight: Math.min(300, previewHeight),
                  maxHeight: 340,
                  border: '2px solid var(--c-accent)',
                  borderRadius: Math.max(6, Math.round(16 * scale)),
                  background: 'var(--c-surface)',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Simulated Screen Header */}
                <div
                  style={{
                    height: 20,
                    background: 'var(--c-surface-raised, #252836)',
                    borderBottom: '1px solid var(--c-border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 8px',
                    fontSize: 9,
                    color: 'var(--c-text-tertiary)',
                  }}
                >
                  <span>{currentPreset.name} ({currentPreset.width}px)</span>
                  <span>{Math.round(scale * 100)}% Scale</span>
                </div>

                {/* Simulated Content Representation */}
                <div style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div
                    style={{
                      width: '100%',
                      height: 24,
                      background: 'var(--c-border-subtle)',
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 8px',
                      fontSize: 10,
                      fontWeight: 600,
                      color: 'var(--c-text-secondary)',
                    }}
                  >
                    {analysis.frameName}
                  </div>

                  {overflowDelta > 0 ? (
                    <div
                      style={{
                        padding: 10,
                        borderRadius: 6,
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px dashed var(--c-danger, #ef4444)',
                        fontSize: 11,
                        color: 'var(--c-danger, #ef4444)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <strong>Horizontal Overflow Detected</strong>
                      <span>
                        Design width ({analysis.frameWidth}px) exceeds this viewport by {overflowDelta}px.
                      </span>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: 10,
                        borderRadius: 6,
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        fontSize: 11,
                        color: 'var(--c-success, #10b981)',
                      }}
                    >
                      ✓ Element bounds fit within {currentPreset.name} viewport.
                    </div>
                  )}

                  {/* Issues overview inside preview */}
                  {currentAudit && currentAudit.issues.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--c-text-tertiary)' }}>
                        Identified Issues ({currentAudit.issues.length}):
                      </span>
                      {currentAudit.issues.slice(0, 3).map((iss, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: 10,
                            color: 'var(--c-text-secondary)',
                            background: 'var(--c-bg)',
                            padding: '4px 6px',
                            borderRadius: 4,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          • {iss.nodeName}: {iss.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* List of issues for current preview viewport */}
            {currentAudit && currentAudit.issues.length > 0 && (
              <div className="card" style={{ overflow: 'hidden' }}>
                <div
                  className="card-header"
                  style={{
                    paddingBottom: 'var(--sp-2)',
                    borderBottom: '1px solid var(--c-border-subtle)',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Issues at {currentPreset.name} ({currentPreset.width}px)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 200, overflowY: 'auto' }}>
                  {currentAudit.issues.map((iss, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 'var(--sp-2) var(--sp-4)',
                        borderBottom:
                          i < currentAudit.issues.length - 1
                            ? '1px solid var(--c-border-subtle)'
                            : 'none',
                        fontSize: 12,
                      }}
                    >
                      <div>
                        <strong>{iss.nodeName}</strong>: {iss.message}
                      </div>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleFocus(iss.nodeId)}
                        style={{ fontSize: 11 }}
                      >
                        Focus
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default BreakpointPreview
