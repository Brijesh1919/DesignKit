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

      <div className="tool-split-view">
        {/* Left Column: Controls & Presets & Pinned CTA */}
        <div className="tool-pane-left" style={{ width: 320 }}>
          {/* Controls Card */}
          <div className="card">
            <div className="card-header" style={{ padding: 'var(--sp-2) var(--sp-4) 0' }}>
              <span className="card-title" style={{ fontSize: 12 }}>Settings</span>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', padding: 'var(--sp-3) var(--sp-4)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)' }}>
                <div>
                  <label className="label" style={{ fontSize: 11 }}>Font Size (px)</label>
                  <input
                    type="number"
                    className="input"
                    style={{ height: 30, fontSize: 12 }}
                    value={fontSize}
                    onChange={e => setFontSize(Math.max(6, parseInt(e.target.value) || 16))}
                  />
                </div>

                <div>
                  <label className="label" style={{ fontSize: 11 }}>Baseline Snap</label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[null, 4, 8].map((g, idx) => (
                      <button
                        key={idx}
                        className={`btn btn-sm ${snapToGrid === g ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1, height: 30, padding: 0, fontSize: 10 }}
                        onClick={() => setSnapToGrid(g)}
                      >
                        {g ? `${g}pt` : 'None'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Result Summary Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--sp-2) var(--sp-3)',
                  background: 'var(--c-bg)',
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--c-border)',
                }}
              >
                <div>
                  <div style={{ fontSize: 10, color: 'var(--c-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Calculated Height
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-text-primary)', fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>
                    {calculatedLh}px{' '}
                    <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--c-text-secondary)' }}>
                      ({(calculatedLh / fontSize).toFixed(2)}×)
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    className={`btn btn-sm ${unit === 'PIXELS' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ height: 24, padding: '0 6px', fontSize: 10 }}
                    onClick={() => setUnit('PIXELS')}
                  >
                    px
                  </button>
                  <button
                    className={`btn btn-sm ${unit === 'PERCENT' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ height: 24, padding: '0 6px', fontSize: 10 }}
                    onClick={() => setUnit('PERCENT')}
                  >
                    %
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Ratio Presets */}
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="card-header" style={{ padding: 'var(--sp-2) var(--sp-4) 0' }}>
              <span className="card-title" style={{ fontSize: 12 }}>Ratio Presets</span>
            </div>
            <div className="tool-scroll-list" style={{ padding: 'var(--sp-2) var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {RATIO_PRESETS.map(preset => (
                <div
                  key={preset.label}
                  onClick={() => setRatio(preset.ratio)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: 'var(--r-md)',
                    border: '1px solid',
                    borderColor: Math.abs(ratio - preset.ratio) < 0.01 ? 'var(--c-accent)' : 'var(--c-border)',
                    background: Math.abs(ratio - preset.ratio) < 0.01 ? 'rgba(37, 99, 235, 0.06)' : 'var(--c-surface)',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 'var(--fw-medium)', color: 'var(--c-text-primary)' }}>
                    {preset.label}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--c-text-secondary)' }}>
                    {preset.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Card */}
          <div className="card" style={{ padding: 'var(--sp-3)' }}>
            <button className="btn btn-primary btn-full" onClick={handleApply}>
              Apply Line Height ({calculatedLh}px)
            </button>
          </div>
        </div>

        {/* Right Column: Live Sample */}
        <div className="tool-pane-right">
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="card-header" style={{ padding: 'var(--sp-3) var(--sp-4)', borderBottom: '1px solid var(--c-border-subtle)' }}>
              <span className="card-title">Live Typography Sample</span>
            </div>
            <div className="card-body" style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-5)' }}>
              <p
                style={{
                  fontSize,
                  lineHeight: `${calculatedLh}px`,
                  color: 'var(--c-text-primary)',
                  margin: 0,
                  transition: 'line-height 150ms ease, font-size 150ms ease',
                }}
              >
                Typography thrives on vertical rhythm. Adequate line spacing reduces visual clutter,
                guides the reader's eye seamlessly across paragraphs, and delivers an authoritative,
                refined user experience throughout your interfaces.
              </p>
              <p
                style={{
                  fontSize: Math.round(fontSize * 0.85),
                  lineHeight: `${calculatedLh}px`,
                  color: 'var(--c-text-secondary)',
                  marginTop: 'var(--sp-4)',
                  transition: 'line-height 150ms ease',
                }}
              >
                Subtext and secondary annotations maintain the same vertical baseline grid, ensuring harmonious spacing across multi-column dashboard views and responsive device layouts.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LineHeightCalculator
