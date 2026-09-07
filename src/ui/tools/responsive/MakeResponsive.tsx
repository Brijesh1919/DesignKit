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
        <h1 className="tool-title">Make Responsive</h1>
        <p className="tool-description">
          Transform your design for any device. Choose a target viewport, preview what will change,
          then apply — a new responsive frame is created next to the original.
        </p>
      </div>

      <div className="tool-body">
        <SelectionBanner
          selection={selection}
          selectionHint="Select a top-level frame to transform into a responsive layout."
        />

        {/* Viewport Selector */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 'var(--sp-2)',
          }}
        >
          {PRESETS.map(preset => {
            const isActive = selectedPreset === preset.id
            return (
              <button
                key={preset.id}
                onClick={() => handlePresetChange(preset.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 4,
                  padding: 'var(--sp-3)',
                  background: isActive
                    ? 'var(--c-accent-subtle, rgba(99,102,241,0.12))'
                    : 'var(--c-surface)',
                  border: `1.5px solid ${isActive ? 'var(--c-accent)' : 'var(--c-border-subtle)'}`,
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                  <span style={{ fontSize: 18 }}>{preset.icon}</span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: isActive ? 'var(--c-accent)' : 'var(--c-text-primary)',
                    }}
                  >
                    {preset.label}
                  </span>
                  {isActive && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--c-accent)',
                        background: 'rgba(99,102,241,0.15)',
                        padding: '2px 6px',
                        borderRadius: 8,
                      }}
                    >
                      SELECTED
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>
                  {preset.width} × {preset.height}px
                </div>
              </button>
            )
          })}
        </div>

        {/* Preview Panel */}
        {hasFrame && (
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
              <span className="card-title">
                {activePreset.icon} Preview — {activePreset.label} ({activePreset.width}px)
              </span>
              {loading && (
                <span style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>Analyzing…</span>
              )}
            </div>

            {loading ? (
              <div style={{ padding: 'var(--sp-4)', textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--c-text-tertiary)' }}>
                  Analyzing design for {activePreset.label} viewport…
                </div>
              </div>
            ) : preview ? (
              <div
                style={{
                  padding: 'var(--sp-3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--sp-3)',
                }}
              >
                {/* Frame dimension comparison */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 'var(--sp-2)',
                    fontSize: 11,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span
                      style={{
                        color: 'var(--c-text-tertiary)',
                        textTransform: 'uppercase',
                        fontSize: 10,
                        letterSpacing: '0.06em',
                      }}
                    >
                      Original
                    </span>
                    <strong style={{ color: 'var(--c-text-primary)', fontSize: 12 }}>
                      {preview.frameWidth} × {preview.frameHeight}px
                    </strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span
                      style={{
                        color: 'var(--c-text-tertiary)',
                        textTransform: 'uppercase',
                        fontSize: 10,
                        letterSpacing: '0.06em',
                      }}
                    >
                      Target
                    </span>
                    <strong style={{ color: 'var(--c-accent)', fontSize: 12 }}>
                      {preview.targetWidth} × {preview.targetHeight}px
                    </strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span
                      style={{
                        color: 'var(--c-text-tertiary)',
                        textTransform: 'uppercase',
                        fontSize: 10,
                        letterSpacing: '0.06em',
                      }}
                    >
                      Changes
                    </span>
                    <strong
                      style={{
                        color:
                          preview.predictedChanges.length > 0
                            ? 'var(--c-warning, #f59e0b)'
                            : 'var(--c-success, #10b981)',
                        fontSize: 12,
                      }}
                    >
                      {preview.predictedChanges.length}
                    </strong>
                  </div>
                </div>

                {/* Predicted Changes list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--c-text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: 2,
                    }}
                  >
                    Layout Transformations
                  </div>
                  {preview.predictedChanges.map((change, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        padding: '6px 8px',
                        background: 'var(--c-bg-subtle, #12141a)',
                        borderRadius: 6,
                        fontSize: 11,
                        color: 'var(--c-text-secondary)',
                        lineHeight: 1.5,
                      }}
                    >
                      <span style={{ color: 'var(--c-accent)', flexShrink: 0, marginTop: 1 }}>
                        →
                      </span>
                      <span>{change}</span>
                    </div>
                  ))}
                </div>

                {preview.issuesResolved > 0 && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--c-success, #10b981)',
                      background: 'rgba(16,185,129,0.08)',
                      border: '1px solid rgba(16,185,129,0.25)',
                      borderRadius: 6,
                      padding: '6px 10px',
                    }}
                  >
                    ✓ This transformation will resolve {preview.issuesResolved} responsive{' '}
                    {preview.issuesResolved === 1 ? 'issue' : 'issues'}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* Primary CTA */}
        {hasFrame && (
          <button
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: 'var(--sp-3)',
              fontSize: 14,
              fontWeight: 600,
              opacity: applying ? 0.7 : 1,
            }}
            onClick={handleMakeResponsive}
            disabled={applying || loading}
          >
            {applying
              ? '⏳ Creating Responsive Frame…'
              : `${activePreset.icon} Make Responsive → ${activePreset.label}`}
          </button>
        )}

        {/* Result confirmation */}
        {result && (
          <div
            className="card"
            style={{
              overflow: 'hidden',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              background: 'rgba(16, 185, 129, 0.04)',
            }}
          >
            <div
              className="card-header"
              style={{
                paddingBottom: 'var(--sp-2)',
                borderBottom: '1px solid rgba(16,185,129,0.2)',
              }}
            >
              <span
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-success, #10b981)' }}
              >
                ✓ Responsive Frame Created
              </span>
            </div>

            <div
              style={{
                padding: 'var(--sp-3)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--sp-2)',
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--c-text-primary)' }}>
                <strong>{result.newFrameName}</strong> was placed next to your original frame.
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 'var(--sp-2)',
                  fontSize: 11,
                  color: 'var(--c-text-secondary)',
                }}
              >
                <div>
                  Target:{' '}
                  <strong>
                    {result.targetViewport} ({result.targetWidth}px)
                  </strong>
                </div>
                <div>
                  Adjustments:{' '}
                  <strong style={{ color: 'var(--c-success, #10b981)' }}>
                    {result.mutationsApplied}
                  </strong>
                </div>
              </div>

              {result.changeLog.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    maxHeight: 180,
                    overflowY: 'auto',
                  }}
                >
                  {result.changeLog.map((entry, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: 11,
                        color: 'var(--c-text-tertiary)',
                        background: 'var(--c-bg-subtle)',
                        borderRadius: 4,
                        padding: '4px 8px',
                      }}
                    >
                      ✓ {entry}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)', marginTop: 4 }}>
                Your original frame was not modified.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MakeResponsive
