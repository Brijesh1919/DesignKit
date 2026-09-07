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

      <div className="tool-body">
        <SelectionBanner
          selection={selection}
          requiresSelection={true}
          selectionHint="Select 2 or more layers to analyze their spacing."
        />

        {/* Controls */}
        <div className="card">
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <div className="two-col">
              <div className="field">
                <label className="field-label">Direction</label>
                <div className="tabs">
                  {(['vertical', 'horizontal', 'both'] as const).map(d => (
                    <button
                      key={d}
                      className={`tab-btn${direction === d ? ' active' : ''}`}
                      onClick={() => setDirection(d)}
                      id={`spacing-dir-${d}`}
                    >
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label className="field-label">Grid Base</label>
                <div className="tabs">
                  {[4, 8].map(g => (
                    <button
                      key={g}
                      className={`tab-btn${grid === g ? ' active' : ''}`}
                      onClick={() => setGrid(g)}
                      id={`spacing-grid-${g}`}
                    >
                      {g}px
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              className="btn btn-secondary"
              onClick={handleAnalyze}
              disabled={!hasSelection}
              id="spacing-analyze-btn"
            >
              Analyze Selection
            </button>
          </div>
        </div>

        {/* Analysis results */}
        {analysed && spacingInfo && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Current Gaps</span>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {activeGaps.length === 0 ? (
                <div style={{ color: 'var(--c-text-tertiary)', fontSize: 'var(--fs-sm)', textAlign: 'center', padding: 'var(--sp-4)' }}>
                  No {direction} gaps found between the selected layers.
                </div>
              ) : (
                activeGaps.map((gap, i) => (
                  <div key={i} className="spacing-bar">
                    <span style={{ minWidth: 32, fontSize: 'var(--fs-xs)', fontFamily: 'var(--font-mono)', color: 'var(--c-text-secondary)', fontWeight: 600 }}>
                      {gap}px
                    </span>
                    <div className="spacing-bar-visual">
                      <div
                        className="spacing-bar-fill"
                        style={{ width: `${maxGap > 0 ? (gap / maxGap) * 100 : 0}%` }}
                      />
                    </div>
                    <span style={{ fontSize: 'var(--fs-xs)', color: nearestGrid(gap, grid) === gap ? 'var(--c-success)' : 'var(--c-warning)', fontWeight: 600 }}>
                      → {nearestGrid(gap, grid)}px
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Target + Apply */}
        {analysed && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Normalize To</span>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              {/* Preset grid values */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
                {GRID_PRESETS.map(preset => (
                  <button
                    key={preset}
                    className={`btn btn-sm ${targetSpacing === preset ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setTargetSpacing(preset)}
                    id={`spacing-preset-${preset}`}
                  >
                    {preset}px
                  </button>
                ))}
              </div>

              {/* Custom value */}
              <div className="field">
                <label className="field-label">Custom Value</label>
                <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
                  <input
                    className="num-input"
                    type="number"
                    min={0}
                    max={400}
                    value={targetSpacing}
                    onChange={e => setTargetSpacing(Math.max(0, parseInt(e.target.value) || 0))}
                    style={{ width: 80 }}
                  />
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--c-text-tertiary)' }}>px</span>
                </div>
              </div>

              <button
                className="btn btn-primary btn-full"
                onClick={handleApply}
                id="spacing-apply-btn"
              >
                Apply {targetSpacing}px Spacing
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SpacingNormalizer
