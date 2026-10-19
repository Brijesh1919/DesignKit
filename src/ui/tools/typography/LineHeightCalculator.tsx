import React, { useState } from 'react'
import { sendToPlugin } from '../../utils/messaging'
import type { SelectionInfo } from '../../../shared/types'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

const RATIO_PRESETS = [
  { label: 'Tight / Heading (1.20×)', ratio: 1.2, desc: 'Ideal for large display and titles' },
  { label: 'Standard / UI (1.35×)', ratio: 1.35, desc: 'Balanced for buttons and labels' },
  { label: 'Normal / Body (1.50×)', ratio: 1.5, desc: 'Optimal for readable paragraphs' },
  { label: 'Golden Ratio (1.62×)', ratio: 1.618, desc: 'Harmonious long-form reading' },
  { label: 'Relaxed (1.75×)', ratio: 1.75, desc: 'Spacious editorial layouts' },
]

export const LineHeightCalculator: React.FC<Props> = ({ selection, onSuccess, onError }) => {
  const [fontSize, setFontSize] = useState(16)
  const [ratio, setRatio] = useState(1.5)
  const [snapToGrid, setSnapToGrid] = useState<number | null>(4) // 4 or 8 or null
  const [unit, setUnit] = useState<'PIXELS' | 'PERCENT'>('PIXELS')

  // Raw calculated line height
  const rawLh = fontSize * ratio
  // Snapped line height
  let calculatedLh = Math.round(rawLh)
  if (snapToGrid) {
    calculatedLh = Math.round(rawLh / snapToGrid) * snapToGrid
  }
  if (calculatedLh < fontSize) calculatedLh = fontSize

  const handleApply = () => {
    if (!selection || selection.count === 0) {
      onError('Please select a text layer or container first.')
      return
    }

    sendToPlugin({
      type: 'APPLY_LINE_HEIGHT',
      payload: {
        lineHeight: unit === 'PERCENT' ? Math.round(ratio * 100) : calculatedLh,
        unit,
      },
    })
  }

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Typography / Line Height Calculator</div>
        <h1 className="tool-title">Line Height Calculator</h1>
        <p className="tool-desc">
          Compute mathematically balanced leading for any font size and snap line heights to a 4pt/8pt baseline grid.
        </p>
      </div>

      <div className="main-scroll">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', maxWidth: 660 }}>
          {/* Controls Card */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Font Size & Ratio Settings</span>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
                <div>
                  <label className="label">Font Size (px)</label>
                  <input
                    type="number"
                    className="input"
                    value={fontSize}
                    onChange={e => setFontSize(Math.max(6, parseInt(e.target.value) || 16))}
                  />
                </div>

                <div>
                  <label className="label">Baseline Snap</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[null, 4, 8].map((g, idx) => (
                      <button
                        key={idx}
                        className={`btn btn-sm ${snapToGrid === g ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1 }}
                        onClick={() => setSnapToGrid(g)}
                      >
                        {g ? `${g}pt Grid` : 'None'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Ratio Presets */}
              <div style={{ marginTop: 'var(--sp-2)' }}>
                <label className="label">Ratio Presets</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {RATIO_PRESETS.map(preset => (
                    <div
                      key={preset.label}
                      onClick={() => setRatio(preset.ratio)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 'var(--sp-2) var(--sp-3)',
                        borderRadius: 'var(--r-md)',
                        border: '1px solid',
                        borderColor: Math.abs(ratio - preset.ratio) < 0.01 ? 'var(--c-accent)' : 'var(--c-border)',
                        background: Math.abs(ratio - preset.ratio) < 0.01 ? 'rgba(37, 99, 235, 0.05)' : 'var(--c-surface)',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--c-text-primary)' }}>
                        {preset.label}
                      </span>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-secondary)' }}>
                        {preset.desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Result Summary Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--sp-3)',
                  background: 'var(--c-bg)',
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--c-border)',
                  marginTop: 'var(--sp-2)',
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: 'var(--c-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Target Line Height
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--c-text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {calculatedLh}px{' '}
                    <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--c-text-secondary)' }}>
                      ({(calculatedLh / fontSize).toFixed(2)}×)
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                  <button
                    className={`btn btn-sm ${unit === 'PIXELS' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setUnit('PIXELS')}
                  >
                    Pixels
                  </button>
                  <button
                    className={`btn btn-sm ${unit === 'PERCENT' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setUnit('PERCENT')}
                  >
                    %
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Typography Sample Card */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Live Typography Sample</span>
            </div>
            <div className="card-body">
              <p
                style={{
                  fontSize,
                  lineHeight: `${calculatedLh}px`,
                  color: 'var(--c-text-primary)',
                  margin: 0,
                  transition: 'line-height 150ms ease',
                }}
              >
                Typography thrives on vertical rhythm. Adequate line spacing reduces visual clutter,
                guides the reader's eye seamlessly across paragraphs, and delivers an authoritative,
                refined user experience throughout your interfaces.
              </p>
            </div>
          </div>

          {/* Action */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleApply} style={{ minWidth: 200 }}>
              Apply Line Height ({calculatedLh}px)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LineHeightCalculator
