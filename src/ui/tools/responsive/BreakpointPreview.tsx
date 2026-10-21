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

  // Calculate container scale to fit within right preview pane
  const previewBoxWidth = 330
  const previewBoxHeight = 350
  const scale = Math.min(
    1,
    previewBoxWidth / (currentPreset?.width || 390),
    previewBoxHeight / (currentPreset?.height || 844)
  )
  const simWidth = Math.round((currentPreset?.width || 390) * scale)
  const simHeight = Math.round((currentPreset?.height || 844) * scale)
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

        {/* Viewport Preset Tabs & Custom Input Bar */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', alignItems: 'center' }}>
          {RESPONSIVE_PRESETS.map(p => {
            const isSelected = !isCustom && activePresetId === p.id
            return (
              <button
                key={p.id}
                className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleSelectPreset(p)}
                style={{ fontSize: 11, padding: '3px 8px' }}
              >
                {p.name} ({p.width}px)
              </button>
            )
          })}
          <button
            className={`btn btn-sm ${isCustom ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setIsCustom(true)}
            style={{ fontSize: 11, padding: '3px 8px' }}
          >
            Custom
          </button>

          {isCustom && (
            <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center', marginLeft: 4 }}>
              <input
                type="number"
                className="input"
                style={{ width: 65, fontSize: 11, padding: '2px 5px' }}
                value={customW}
                onChange={e => setCustomW(e.target.value)}
                placeholder="W"
                min="1"
              />
              <span style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>×</span>
              <input
                type="number"
                className="input"
                style={{ width: 65, fontSize: 11, padding: '2px 5px' }}
                value={customH}
                onChange={e => setCustomH(e.target.value)}
                placeholder="H"
                min="1"
              />
              <button className="btn btn-secondary btn-sm" onClick={handleApplyCustom} style={{ fontSize: 11, padding: '2px 8px' }}>
                Set
              </button>
            </div>
          )}
        </div>

        {/* Main Inspection & Simulator View in Studio Split-View */}
        {!analysis || !hasFrame ? (
          <div className="empty-state" style={{ flex: 1 }}>
            <div className="empty-state-title">Select a Frame</div>
            <div className="empty-state-body">
              Select a frame on the canvas to inspect its dimensions against {currentPreset.name} ({currentPreset.width}×{currentPreset.height}px).
            </div>
          </div>
        ) : (
          <div className="tool-split-view" style={{ flex: 1, minHeight: 0 }}>
            {/* Left Pane: Metrics and Issues List */}
            <div style={{ width: 290, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', minHeight: 0 }}>
              {/* Viewport Metrics Card */}
              <div className="card" style={{ padding: 'var(--sp-2) var(--sp-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-primary)' }}>
                    {currentPreset.name} ({currentPreset.width}×{currentPreset.height})
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '1px 6px',
                      borderRadius: 10,
                      background:
                        overflowDelta > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color:
                        overflowDelta > 0 ? 'var(--c-danger, #ef4444)' : 'var(--c-success, #10b981)',
                    }}
                  >
                    {overflowDelta > 0 ? `+${overflowDelta}px Overflow` : '✓ Fits'}
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '4px 8px',
                    fontSize: 10,
                    color: 'var(--c-text-secondary)',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--c-text-tertiary)' }}>Design: </span>
                    <strong>{analysis.frameWidth}×{analysis.frameHeight}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--c-text-tertiary)' }}>Scale: </span>
                    <strong>{Math.round(scale * 100)}%</strong>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: 'var(--c-text-tertiary)' }}>Status: </span>
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

              {/* Issues Card with Internal Scroll */}
              <div className="card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div
                  className="card-header"
                  style={{
                    padding: 'var(--sp-2) var(--sp-3)',
                    borderBottom: '1px solid var(--c-border-subtle)',
                    fontSize: 11,
                    fontWeight: 600,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Issues at {currentPreset.name}</span>
                  <span style={{ color: 'var(--c-text-tertiary)' }}>{currentAudit?.issues.length || 0}</span>
                </div>

                {(!currentAudit || currentAudit.issues.length === 0) ? (
                  <div style={{ padding: 'var(--sp-4)', textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--c-success, #10b981)' }}>✓ No issues detected</span>
                  </div>
                ) : (
                  <div className="tool-scroll-list" style={{ flex: 1, padding: 0 }}>
                    {currentAudit.issues.map((iss, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          borderBottom: '1px solid var(--c-border-subtle)',
                          fontSize: 11,
                          gap: 6,
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 600, color: 'var(--c-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {iss.nodeName}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--c-text-secondary)', lineHeight: 1.3 }}>
                            {iss.message}
                          </div>
                        </div>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleFocus(iss.nodeId)}
                          style={{ fontSize: 10, padding: '2px 6px', flexShrink: 0 }}
                          title="Focus layer in Figma"
                        >
                          Focus
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Pane: Visual Viewport Simulation Frame */}
            <div
              className="card"
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--c-bg-subtle, #12141a)',
                overflow: 'hidden',
                padding: 'var(--sp-3)',
              }}
            >
              <div
                style={{
                  width: simWidth,
                  height: simHeight,
                  border: '2px solid var(--c-accent)',
                  borderRadius: Math.max(6, Math.round(14 * scale)),
                  background: 'var(--c-surface)',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Simulated Screen Header */}
                <div
                  style={{
                    height: 18,
                    background: 'var(--c-surface-raised, #252836)',
                    borderBottom: '1px solid var(--c-border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 6px',
                    fontSize: 8,
                    color: 'var(--c-text-tertiary)',
                  }}
                >
                  <span>{currentPreset.name} ({currentPreset.width}px)</span>
                  <span>{Math.round(scale * 100)}%</span>
                </div>

                {/* Simulated Content Representation */}
                <div style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: '100%',
                      height: 20,
                      background: 'var(--c-border-subtle)',
                      borderRadius: 3,
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 6px',
                      fontSize: 9,
                      fontWeight: 600,
                      color: 'var(--c-text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {analysis.frameName}
                  </div>

                  {overflowDelta > 0 ? (
                    <div
                      style={{
                        padding: 6,
                        borderRadius: 4,
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px dashed var(--c-danger, #ef4444)',
                        fontSize: 9,
                        color: 'var(--c-danger, #ef4444)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      <strong>Overflow Detected</strong>
                      <span>Design is {overflowDelta}px wider than viewport.</span>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: 6,
                        borderRadius: 4,
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        fontSize: 9,
                        color: 'var(--c-success, #10b981)',
                      }}
                    >
                      ✓ Bounds fit inside {currentPreset.name}.
                    </div>
                  )}

                  {currentAudit && currentAudit.issues.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2 }}>
                      <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--c-text-tertiary)' }}>
                        Top Issues ({currentAudit.issues.length}):
                      </span>
                      {currentAudit.issues.slice(0, 2).map((iss, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: 8,
                            color: 'var(--c-text-secondary)',
                            background: 'var(--c-bg)',
                            padding: '3px 5px',
                            borderRadius: 3,
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
          </div>
        )}
      </div>
    </div>
  )
}

export default BreakpointPreview
