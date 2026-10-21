import React, { useState, useEffect } from 'react'
import { sendToPlugin } from '../../utils/messaging'
import type { SelectionInfo, SpacingInfo } from '../../../shared/types'
import { SelectionBanner } from '../../components/Selection/SelectionBanner'

interface Props {
  selection: SelectionInfo | null
  spacingInfo: SpacingInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

const GRID_PRESETS = [4, 8, 12, 16, 20, 24, 32, 40, 48]

function nearestGrid(value: number, grid: number): number {
  return Math.round(value / grid) * grid
}

function suggestSpacing(gaps: number[], grid = 8): number {
  if (gaps.length === 0) return grid
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length
  return nearestGrid(avg, grid)
}

export const SpacingNormalizer: React.FC<Props> = ({ selection, spacingInfo, onSuccess, onError }) => {
  const [targetSpacing, setTargetSpacing] = useState(16)
  const [grid, setGrid] = useState(8)
  const [direction, setDirection] = useState<'horizontal' | 'vertical' | 'both'>('vertical')
  const [analysed, setAnalysed] = useState(false)

  const hasSelection = selection && selection.count >= 2

  // Auto-set suggested spacing when info arrives
  useEffect(() => {
    if (spacingInfo) {
      setAnalysed(true)
      const gaps = direction === 'horizontal' ? spacingInfo.horizontalGaps : spacingInfo.verticalGaps
      if (gaps.length > 0) {
        setTargetSpacing(suggestSpacing(gaps, grid))
      }
    }
  }, [spacingInfo, grid, direction])

  const handleAnalyze = () => {
    if (!hasSelection) {
      onError('Select 2 or more layers to analyze spacing.')
      return
    }
    sendToPlugin({ type: 'GET_SPACING_INFO' })
  }

  const handleApply = () => {
    if (!spacingInfo || spacingInfo.nodeIds.length < 2) {
      onError('Analyze spacing first, then apply.')
      return
    }
    sendToPlugin({
      type: 'APPLY_SPACING',
      payload: {
        nodeIds: spacingInfo.nodeIds,
        targetSpacing,
        direction,
      },
    })
  }

  const activeGaps = spacingInfo
    ? (direction === 'horizontal' ? spacingInfo.horizontalGaps : spacingInfo.verticalGaps)
    : []

  const maxGap = activeGaps.length > 0 ? Math.max(...activeGaps.filter(g => g >= 0)) : 0

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Layout</div>
        <h1 className="tool-title">Spacing Normalizer</h1>
        <p className="tool-description">
          Normalize gaps between selected layers to a consistent 4/8pt grid value.
        </p>
      </div>

      <div className="tool-split-view">
        {/* Left Pane: Controls & Presets (~320px) */}
        <div className="tool-pane-left">
          <SelectionBanner
            selection={selection}
            requiresSelection={true}
            selectionHint="Select 2 or more layers to analyze their spacing."
          />

          {/* Controls Card */}
          <div className="card">
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 'var(--sp-2)' }}>
                <div className="field">
                  <label className="field-label">Direction</label>
                  <div className="tabs" style={{ marginBottom: 0 }}>
                    {(['vertical', 'horizontal', 'both'] as const).map(d => (
                      <button
                        key={d}
                        className={`tab-btn${direction === d ? ' active' : ''}`}
                        onClick={() => setDirection(d)}
                        id={`spacing-dir-${d}`}
                        style={{ height: 24, fontSize: 10, padding: '0 6px' }}
                      >
                        {d.charAt(0).toUpperCase() + d.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <label className="field-label">Grid Base</label>
                  <div className="tabs" style={{ marginBottom: 0 }}>
                    {[4, 8].map(g => (
                      <button
                        key={g}
                        className={`tab-btn${grid === g ? ' active' : ''}`}
                        onClick={() => setGrid(g)}
                        id={`spacing-grid-${g}`}
                        style={{ height: 24, fontSize: 10, padding: '0 8px' }}
                      >
                        {g}px
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                className="btn btn-secondary btn-full btn-sm"
                onClick={handleAnalyze}
                disabled={!hasSelection}
                id="spacing-analyze-btn"
                style={{ height: 28, fontSize: 11, marginTop: 2 }}
              >
                Analyze Selection
              </button>
            </div>
          </div>

          {/* Target Value & Presets */}
          {analysed && (
            <div className="card">
              <div className="card-header" style={{ padding: '8px 12px 0' }}>
                <span className="card-title">Normalize Target</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', padding: '8px 12px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {GRID_PRESETS.map(preset => (
                    <button
                      key={preset}
                      className={`btn btn-sm ${targetSpacing === preset ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setTargetSpacing(preset)}
                      id={`spacing-preset-${preset}`}
                      style={{ height: 24, padding: '0 8px', fontSize: 10 }}
                    >
                      {preset}px
                    </button>
                  ))}
                </div>

                <div className="field" style={{ marginTop: 2 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--c-text-secondary)' }}>Custom:</span>
                    <input
                      className="num-input"
                      type="number"
                      min={0}
                      max={400}
                      value={targetSpacing}
                      onChange={e => setTargetSpacing(Math.max(0, parseInt(e.target.value) || 0))}
                      style={{ width: 64, height: 26, fontSize: 11 }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>px</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Pane: Gaps Analysis (flex: 1) */}
        <div className="tool-pane-right" style={{ overflow: 'hidden', minHeight: 0 }}>
          <div className="card" style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="card-header" style={{ padding: '8px 12px', borderBottom: '1px solid var(--c-border-subtle)' }}>
              <span className="card-title">Current Gaps Analysis</span>
              {analysed && (
                <span style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>
                  {activeGaps.length} gap{activeGaps.length !== 1 ? 's' : ''} detected
                </span>
              )}
            </div>

            <div className="card-body tool-scroll-list" style={{ padding: 12 }}>
              {!analysed ? (
                <div style={{ textAlign: 'center', padding: 'var(--sp-6)', color: 'var(--c-text-tertiary)', fontSize: 12 }}>
                  Select layers and click "Analyze Selection" to inspect gaps.
                </div>
              ) : activeGaps.length === 0 ? (
                <div style={{ color: 'var(--c-text-tertiary)', fontSize: 12, textAlign: 'center', padding: 'var(--sp-6)' }}>
                  No {direction} gaps found between the selected layers.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {activeGaps.map((gap, i) => (
                    <div key={i} className="spacing-bar">
                      <span style={{ minWidth: 32, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--c-text-secondary)', fontWeight: 600 }}>
                        {gap}px
                      </span>
                      <div className="spacing-bar-visual">
                        <div
                          className="spacing-bar-fill"
                          style={{ width: `${maxGap > 0 ? (gap / maxGap) * 100 : 0}%` }}
                        />
                      </div>
                      <span style={{ fontSize: 11, color: nearestGrid(gap, grid) === gap ? 'var(--c-success)' : 'var(--c-warning)', fontWeight: 600 }}>
                        → {nearestGrid(gap, grid)}px
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pinned Action Bar at Bottom */}
      <div className="tool-footer">
        <div style={{ fontSize: 11, color: 'var(--c-text-secondary)' }}>
          {analysed
            ? `Target: ${targetSpacing}px spacing across ${activeGaps.length} gap(s)`
            : 'Select 2+ layers to normalize spacing'}
        </div>
        <button
          className="btn btn-primary"
          onClick={handleApply}
          disabled={!analysed || activeGaps.length === 0}
          id="spacing-apply-btn"
          style={{ height: 32, padding: '0 var(--sp-5)', fontSize: 12, fontWeight: 600 }}
        >
          Apply {targetSpacing}px Spacing
        </button>
      </div>
    </div>
  )
}

export default SpacingNormalizer
