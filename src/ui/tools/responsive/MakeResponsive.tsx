import React, { useState, useEffect, useCallback } from 'react'
import type {
  SelectionInfo,
  ResponsivePreviewSummary,
  ResponsiveTransformSummary,
  ResponsiveTargetPreset,
  PluginMessage,
} from '../../../shared/types'
import { SelectionBanner } from '../../components/Selection/SelectionBanner'
import { sendToPlugin } from '../../utils/messaging'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

type PresetOption = {
  id: ResponsiveTargetPreset
  label: string
  width: number
  height: number
  icon: string
  description: string
}

const PRESETS: PresetOption[] = [
  {
    id: 'laptop',
    label: 'Laptop',
    width: 1024,
    height: 768,
    icon: '💻',
    description: 'MacBook / Windows laptop — 1024px wide',
  },
  {
    id: 'tablet',
    label: 'Tablet',
    width: 768,
    height: 1024,
    icon: '📱',
    description: 'iPad / Android tablet — 768px wide',
  },
  {
    id: 'mobile',
    label: 'Mobile',
    width: 390,
    height: 844,
    icon: '📲',
    description: 'iPhone 14 / standard — 390px wide',
  },
  {
    id: 'small-mobile',
    label: 'Small Mobile',
    width: 320,
    height: 568,
    icon: '📟',
    description: 'iPhone SE / compact — 320px wide',
  },
]

export const MakeResponsive: React.FC<Props> = ({ selection, onSuccess, onError }) => {
  const [selectedPreset, setSelectedPreset] = useState<ResponsiveTargetPreset>('mobile')
  const [preview, setPreview] = useState<ResponsivePreviewSummary | null>(null)
  const [result, setResult] = useState<ResponsiveTransformSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)

  const hasFrame =
    selection &&
    selection.count > 0 &&
    (selection.hasFrame ||
      selection.types.some(
        t => t === 'FRAME' || t === 'COMPONENT' || t === 'GROUP' || t === 'SECTION'
      ))

  const requestPreview = useCallback(
    (presetId: ResponsiveTargetPreset) => {
      if (!hasFrame) return
      setLoading(true)
      setResult(null)
      sendToPlugin({ type: 'GET_RESPONSIVE_PREVIEW', payload: { presetId } })
    },
    [hasFrame]
  )

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as PluginMessage | undefined
      if (!msg) return

      if (msg.type === 'RESPONSIVE_PREVIEW') {
        setPreview(msg.payload)
        setLoading(false)
      }
      if (msg.type === 'RESPONSIVE_TRANSFORM_RESULT') {
        setApplying(false)
        if (msg.payload) {
          setResult(msg.payload)
          onSuccess(
            `✅ "${msg.payload.newFrameName}" created — ${msg.payload.mutationsApplied} adjustments applied`
          )
        } else {
          onError('Could not apply transformation. Select a top-level Frame.')
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onSuccess, onError])

  useEffect(() => {
    if (hasFrame) {
      requestPreview(selectedPreset)
    } else {
      setPreview(null)
      setResult(null)
    }
  }, [selection, selectedPreset, hasFrame, requestPreview])

  const handlePresetChange = (id: ResponsiveTargetPreset) => {
    setSelectedPreset(id)
    requestPreview(id)
  }

  const handleMakeResponsive = () => {
    if (!hasFrame) {
      onError('Select a frame first.')
      return
    }
    setApplying(true)
    setResult(null)
    sendToPlugin({
      type: 'MAKE_RESPONSIVE',
      payload: { presetId: selectedPreset, offsetX: 100, offsetY: 0 },
    })
  }

  const activePreset = PRESETS.find(p => p.id === selectedPreset)!

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Responsive</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <h1 className="tool-title" style={{ margin: 0 }}>Make Responsive</h1>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--c-warning-text, #92400e)',
              background: 'var(--c-warning-subtle, #fffbeb)',
              border: '1px solid var(--c-warning-border, #fde68a)',
              padding: '2px 8px',
              borderRadius: 12,
            }}
          >
            Under Development
          </span>
        </div>
        <p className="tool-description">
          Transform your design for any device. Choose a target viewport, preview what will change,
          then apply — a new responsive frame is created next to the original.
        </p>
      </div>

      <div className="tool-body" style={{ flex: 1, overflow: 'hidden', padding: 0 }}>
        <div className="tool-split-view" style={{ height: '100%' }}>
          {/* Left Pane: Preset Viewports & Pinned Make Responsive CTA */}
          <div className="tool-pane-left" style={{ width: 310, display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            <SelectionBanner
              selection={selection}
              selectionHint="Select a top-level frame to transform."
            />

            {/* Development Notice */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-2)',
                padding: 'var(--sp-2) var(--sp-3)',
                background: 'var(--c-warning-subtle, #FFFBEB)',
                border: '1px solid var(--c-warning-border, #FDE68A)',
                borderRadius: 'var(--r-md)',
                color: 'var(--c-warning-text, #92400E)',
                fontSize: 11,
                flexShrink: 0,
              }}
            >
              <span>⚠️</span>
              <span><strong>Under Development:</strong> Generated reflow may require minor manual tuning.</span>
            </div>

            {/* Viewport Selector */}
            <div className="card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="card-header" style={{ padding: 'var(--sp-2) var(--sp-3)', flexShrink: 0 }}>
                <span className="card-title" style={{ fontSize: 12 }}>Target Viewport</span>
              </div>

              <div className="tool-scroll-list" style={{ flex: 1, padding: 'var(--sp-2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {PRESETS.map(preset => {
                  const isActive = selectedPreset === preset.id
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handlePresetChange(preset.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 'var(--sp-2) var(--sp-3)',
                        background: isActive ? 'rgba(37, 99, 235, 0.08)' : 'var(--c-surface)',
                        border: `1.5px solid ${isActive ? 'var(--c-primary)' : 'var(--c-border-subtle)'}`,
                        borderRadius: 'var(--r-md)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{preset.icon}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? 'var(--c-primary)' : 'var(--c-text-primary)' }}>
                            {preset.label}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--c-text-tertiary)' }}>
                            {preset.width} × {preset.height}px
                          </div>
                        </div>
                      </div>
                      {isActive && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--c-primary)', background: 'rgba(37, 99, 235, 0.12)', padding: '2px 6px', borderRadius: 4 }}>
                          SELECTED
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Pinned Primary CTA */}
              <div style={{ padding: 'var(--sp-2) var(--sp-3)', borderTop: '1px solid var(--c-border-subtle)', background: 'var(--c-surface-subtle)', flexShrink: 0 }}>
                <button
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    height: 36,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                  onClick={handleMakeResponsive}
                  disabled={!hasFrame || applying || loading}
                >
                  {applying
                    ? '⏳ Creating Frame…'
                    : `${activePreset.icon} Make Responsive → ${activePreset.label}`}
                </button>
              </div>
            </div>
          </div>

          {/* Right Pane: Transformation Preview & Log */}
          <div className="tool-pane-right" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div
                className="card-header"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--sp-2) var(--sp-3)',
                  borderBottom: '1px solid var(--c-border-subtle)',
                  flexShrink: 0,
                }}
              >
                <span className="card-title" style={{ fontSize: 12 }}>
                  {activePreset.icon} Layout Reflow Preview — {activePreset.label} ({activePreset.width}px)
                </span>
                {loading && (
                  <span style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>Analyzing…</span>
                )}
              </div>

              <div className="tool-scroll-list" style={{ flex: 1, padding: 'var(--sp-3)' }}>
                {loading ? (
                  <div style={{ padding: 'var(--sp-8)', textAlign: 'center', color: 'var(--c-text-tertiary)', fontSize: 12 }}>
                    Analyzing frame structure for {activePreset.label}…
                  </div>
                ) : !hasFrame ? (
                  <div style={{ padding: 'var(--sp-8)', textAlign: 'center', color: 'var(--c-text-tertiary)', fontSize: 12 }}>
                    Select a frame on Figma canvas to preview responsive layout transformations.
                  </div>
                ) : preview ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                    {/* Dimension comparison */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-2)', background: 'var(--c-surface-subtle)', padding: 'var(--sp-2) var(--sp-3)', borderRadius: 'var(--r-md)' }}>
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--c-text-tertiary)', textTransform: 'uppercase' }}>Original</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text-primary)' }}>
                          {preview.frameWidth} × {preview.frameHeight}px
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--c-text-tertiary)', textTransform: 'uppercase' }}>Target</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-primary)' }}>
                          {preview.targetWidth} × {preview.targetHeight}px
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--c-text-tertiary)', textTransform: 'uppercase' }}>Adjustments</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text-primary)' }}>
                          {preview.predictedChanges.length}
                        </div>
                      </div>
                    </div>

                    {/* Predicted changes */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-secondary)', textTransform: 'uppercase' }}>
                        Reflow Actions
                      </span>
                      {preview.predictedChanges.map((change, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 6,
                            padding: '6px 10px',
                            background: 'var(--c-surface)',
                            border: '1px solid var(--c-border-subtle)',
                            borderRadius: 'var(--r-sm)',
                            fontSize: 11,
                            color: 'var(--c-text-secondary)',
                            lineHeight: 1.4,
                          }}
                        >
                          <span style={{ color: 'var(--c-primary)', fontWeight: 700 }}>→</span>
                          <span>{change}</span>
                        </div>
                      ))}
                    </div>

                    {/* Result card if created */}
                    {result && (
                      <div style={{ marginTop: 'var(--sp-2)', padding: 'var(--sp-3)', background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--r-md)' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-success)' }}>
                          ✓ Created: {result.newFrameName} ({result.mutationsApplied} changes applied)
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--c-text-secondary)', marginTop: 2 }}>
                          Placed next to original frame. Original frame preserved.
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MakeResponsive
