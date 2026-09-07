import React, { useState, useEffect } from 'react'
import { sendToPlugin } from '../../utils/messaging'
import type { SelectionInfo, AutoLayoutAnalysis, ApplyAutoLayoutPayload } from '../../../shared/types'
import { SelectionBanner } from '../../components/Selection/SelectionBanner'

interface Props {
  selection: SelectionInfo | null
  autoLayoutAnalysis: AutoLayoutAnalysis | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

const DirectionIcon: React.FC<{ dir: 'HORIZONTAL' | 'VERTICAL' }> = ({ dir }) =>
  dir === 'HORIZONTAL' ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12l7 7 7-7"/>
    </svg>
  )

export const AutoLayoutOptimizer: React.FC<Props> = ({
  selection,
  autoLayoutAnalysis,
  onSuccess,
  onError,
}) => {
  const hasFrame = selection && selection.hasFrame && selection.count === 1

  const [direction, setDirection]         = useState<'HORIZONTAL' | 'VERTICAL'>('VERTICAL')
  const [gap, setGap]                     = useState(16)
  const [paddingTop, setPaddingTop]       = useState(24)
  const [paddingRight, setPaddingRight]   = useState(24)
  const [paddingBottom, setPaddingBottom] = useState(24)
  const [paddingLeft, setPaddingLeft]     = useState(24)
  const [alignItems, setAlignItems]       = useState<'MIN' | 'CENTER' | 'MAX'>('MIN')
  const [linkPadding, setLinkPadding]     = useState(true)
  const [analysed, setAnalysed]           = useState(false)

  // Populate controls from analysis
  useEffect(() => {
    if (autoLayoutAnalysis) {
      setDirection(autoLayoutAnalysis.suggestedDirection)
      setGap(autoLayoutAnalysis.suggestedGap)
      setPaddingTop(autoLayoutAnalysis.suggestedPaddingTop)
      setPaddingRight(autoLayoutAnalysis.suggestedPaddingRight)
      setPaddingBottom(autoLayoutAnalysis.suggestedPaddingBottom)
      setPaddingLeft(autoLayoutAnalysis.suggestedPaddingLeft)
      setAlignItems(autoLayoutAnalysis.counterAxisAlignItems)
      setAnalysed(true)
    }
  }, [autoLayoutAnalysis])

  const handleAnalyze = () => {
    if (!hasFrame) {
      onError('Select a single Frame layer with at least 2 children.')
      return
    }
    sendToPlugin({ type: 'GET_AUTO_LAYOUT_ANALYSIS' })
  }

  const handlePaddingChange = (side: string, val: number) => {
    const v = Math.max(0, val)
    if (linkPadding) {
      setPaddingTop(v); setPaddingRight(v)
      setPaddingBottom(v); setPaddingLeft(v)
    } else {
      if (side === 'top') setPaddingTop(v)
      if (side === 'right') setPaddingRight(v)
      if (side === 'bottom') setPaddingBottom(v)
      if (side === 'left') setPaddingLeft(v)
    }
  }

  const handleApply = () => {
    if (!autoLayoutAnalysis) {
      onError('Analyze the frame first.')
      return
    }

    const payload: ApplyAutoLayoutPayload = {
      nodeId: autoLayoutAnalysis.nodeId,
      direction,
      gap,
      paddingTop,
      paddingRight,
      paddingBottom,
      paddingLeft,
      primaryAxisAlignItems: 'MIN',
      counterAxisAlignItems: alignItems,
    }
    sendToPlugin({ type: 'APPLY_AUTO_LAYOUT', payload })
  }

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Layout</div>
        <h1 className="tool-title">Auto Layout Optimizer</h1>
        <p className="tool-description">
          Analyze a frame's children and apply optimal auto layout settings.
        </p>
      </div>

      <div className="tool-body">
        <SelectionBanner
          selection={selection}
          requiresSelection={true}
          selectionHint="Select a single Frame with at least 2 child layers."
        />

        {/* Analyze */}
        <div className="card">
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {autoLayoutAnalysis ? (
              <div style={{ padding: 'var(--sp-3)', background: 'var(--c-success-subtle)', borderRadius: 'var(--r-md)', border: '1px solid var(--c-success-border)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-success-text)', marginBottom: 4 }}>
                  Analyzed: "{autoLayoutAnalysis.nodeName}"
                </div>
                <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>
                  {autoLayoutAnalysis.childCount} children ·{' '}
                  {autoLayoutAnalysis.currentHasAutoLayout ? 'Has auto layout' : 'No auto layout yet'}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--c-text-tertiary)', lineHeight: 1.6 }}>
                Select a Frame in Figma and click Analyze to detect the optimal auto layout configuration.
              </div>
            )}
            <button
              className={`btn ${analysed ? 'btn-secondary' : 'btn-primary'}`}
              onClick={handleAnalyze}
              disabled={!hasFrame}
              id="auto-layout-analyze-btn"
            >
              {analysed ? 'Re-analyze' : 'Analyze Frame'}
            </button>
          </div>
        </div>

        {/* Configuration */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Configuration</span>
            {analysed && (
              <span className="tag tag-accent" style={{ fontSize: 10 }}>Suggested</span>
            )}
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            {/* Direction */}
            <div className="field">
              <label className="field-label">Direction</label>
              <div className="tabs">
                {(['VERTICAL', 'HORIZONTAL'] as const).map(d => (
                  <button
                    key={d}
                    className={`tab-btn${direction === d ? ' active' : ''}`}
                    onClick={() => setDirection(d)}
                    id={`autolayout-dir-${d.toLowerCase()}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <DirectionIcon dir={d} />
                    {d.charAt(0) + d.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Gap */}
            <div className="field">
              <label className="field-label">Gap between children</label>
              <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
                <input
                  type="range"
                  className="slider"
                  style={{ flex: 1 }}
                  min={0}
                  max={80}
                  step={1}
                  value={gap}
                  onChange={e => setGap(parseInt(e.target.value))}
                  id="autolayout-gap-slider"
                />
                <input
                  className="num-input"
                  type="number"
                  min={0}
                  max={200}
                  value={gap}
                  onChange={e => setGap(Math.max(0, parseInt(e.target.value) || 0))}
                  style={{ width: 60 }}
                />
                <span style={{ fontSize: 12, color: 'var(--c-text-tertiary)' }}>px</span>
              </div>
            </div>

            {/* Alignment */}
            <div className="field">
              <label className="field-label">Counter-axis Alignment</label>
              <div className="tabs">
                {(['MIN', 'CENTER', 'MAX'] as const).map(a => (
                  <button
                    key={a}
                    className={`tab-btn${alignItems === a ? ' active' : ''}`}
                    onClick={() => setAlignItems(a)}
                    id={`autolayout-align-${a.toLowerCase()}`}
                  >
                    {a === 'MIN' ? 'Start' : a === 'CENTER' ? 'Center' : 'End'}
                  </button>
                ))}
              </div>
            </div>

            {/* Padding */}
            <div className="field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="field-label">Padding</label>
                <button
                  className={`btn btn-ghost btn-sm`}
                  onClick={() => setLinkPadding(!linkPadding)}
                  style={{ fontSize: 11, color: linkPadding ? 'var(--c-accent)' : 'var(--c-text-tertiary)' }}
                  id="autolayout-link-padding-btn"
                >
                  {linkPadding ? 'Linked' : 'Individual'}
                </button>
              </div>

              {linkPadding ? (
                <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
                  <input
                    className="num-input"
                    type="number"
                    min={0}
                    value={paddingTop}
                    onChange={e => handlePaddingChange('top', parseInt(e.target.value) || 0)}
                    style={{ width: 80 }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--c-text-tertiary)' }}>px all sides</span>
                </div>
              ) : (
                <div className="two-col" style={{ gap: 'var(--sp-2)' }}>
                  {[
                    { key: 'top', label: 'Top',    val: paddingTop },
                    { key: 'right', label: 'Right', val: paddingRight },
                    { key: 'bottom', label: 'Bottom', val: paddingBottom },
                    { key: 'left', label: 'Left',  val: paddingLeft },
                  ].map(({ key, label, val }) => (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ fontSize: 10, color: 'var(--c-text-tertiary)' }}>{label}</span>
                      <input
                        className="num-input"
                        type="number"
                        min={0}
                        value={val}
                        onChange={e => handlePaddingChange(key, parseInt(e.target.value) || 0)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Preview box */}
            <div style={{ padding: 'var(--sp-3)', background: 'var(--c-bg)', borderRadius: 'var(--r-md)', border: '1px solid var(--c-border)' }}>
              <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)', marginBottom: 6 }}>Preview Configuration</div>
              <div style={{ fontSize: 12, color: 'var(--c-text-secondary)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div>Direction: <strong>{direction.charAt(0) + direction.slice(1).toLowerCase()}</strong></div>
                <div>Gap: <strong>{gap}px</strong></div>
                <div>Padding: <strong>{paddingTop === paddingRight && paddingRight === paddingBottom && paddingBottom === paddingLeft ? `${paddingTop}px` : `${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px`}</strong></div>
                <div>Alignment: <strong>{alignItems === 'MIN' ? 'Start' : alignItems === 'CENTER' ? 'Center' : 'End'}</strong></div>
              </div>
            </div>

            <button
              className="btn btn-primary btn-full"
              onClick={handleApply}
              disabled={!analysed}
              id="auto-layout-apply-btn"
            >
              Apply Auto Layout
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AutoLayoutOptimizer
