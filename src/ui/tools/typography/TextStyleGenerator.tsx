import React, { useState } from 'react'
import { sendToPlugin } from '../../utils/messaging'
import type { SelectionInfo } from '../../../shared/types'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

const WEIGHT_OPTIONS = [
  { label: 'Thin (100)', value: 100 },
  { label: 'Extra Light (200)', value: 200 },
  { label: 'Light (300)', value: 300 },
  { label: 'Regular (400)', value: 400 },
  { label: 'Medium (500)', value: 500 },
  { label: 'Semi Bold (600)', value: 600 },
  { label: 'Bold (700)', value: 700 },
  { label: 'Extra Bold (800)', value: 800 },
  { label: 'Black (900)', value: 900 },
]

const SIZE_PRESETS = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 64]

export const TextStyleGenerator: React.FC<Props> = ({ selection, onSuccess, onError }) => {
  const [styleName, setStyleName] = useState('Heading / H2')
  const [fontFamily, setFontFamily] = useState('Inter')
  const [fontWeight, setFontWeight] = useState(600)
  const [fontSize, setFontSize] = useState(28)
  const [lineHeight, setLineHeight] = useState(36)
  const [letterSpacing, setLetterSpacing] = useState(-0.5)
  const [previewText, setPreviewText] = useState('The quick brown fox jumps over the lazy dog')

  const handleCreate = () => {
    if (!styleName.trim()) {
      onError('Please provide a name for the text style.')
      return
    }

    sendToPlugin({
      type: 'CREATE_CUSTOM_TEXT_STYLE',
      payload: {
        name: styleName.trim(),
        fontFamily: fontFamily.trim() || 'Inter',
        fontWeight,
        fontSize,
        lineHeight: lineHeight > 0 ? lineHeight : undefined,
        letterSpacing,
      },
    })
  }

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Typography / Text Style Generator</div>
        <h1 className="tool-title">Text Style Generator</h1>
        <p className="tool-desc">
          Design custom typography styles with granular control over font family, weights, line heights, and tracking.
        </p>
      </div>

      <div className="main-scroll">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', maxWidth: 680 }}>
          {/* Style Configuration Card */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Typography Parameters</span>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {/* Name & Family */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
                <div>
                  <label className="label">Style Name</label>
                  <input
                    className="input"
                    value={styleName}
                    onChange={e => setStyleName(e.target.value)}
                    placeholder="e.g. Heading/H2, Body/Regular"
                  />
                </div>
                <div>
                  <label className="label">Font Family</label>
                  <input
                    className="input"
                    value={fontFamily}
                    onChange={e => setFontFamily(e.target.value)}
                    placeholder="Inter"
                  />
                </div>
              </div>

              {/* Weight & Size */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
                <div>
                  <label className="label">Weight</label>
                  <select
                    className="select"
                    value={fontWeight}
                    onChange={e => setFontWeight(Number(e.target.value))}
                  >
                    {WEIGHT_OPTIONS.map(w => (
                      <option key={w.value} value={w.value}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Font Size (px)</label>
                  <input
                    type="number"
                    className="input"
                    value={fontSize}
                    onChange={e => {
                      const val = Math.max(6, parseInt(e.target.value) || 16)
                      setFontSize(val)
                      // Auto-suggest proportional line-height if unmodified
                      setLineHeight(Math.round(val * 1.35))
                    }}
                  />
                </div>
              </div>

              {/* Size Preset Pills */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SIZE_PRESETS.map(s => (
                  <button
                    key={s}
                    className={`btn btn-sm ${fontSize === s ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ height: 24, padding: '0 8px', fontSize: 11 }}
                    onClick={() => {
                      setFontSize(s)
                      setLineHeight(Math.round(s * 1.35))
                    }}
                  >
                    {s}px
                  </button>
                ))}
              </div>

              {/* Line Height & Letter Spacing */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)', marginTop: 'var(--sp-1)' }}>
                <div>
                  <label className="label">Line Height (px)</label>
                  <input
                    type="number"
                    className="input"
                    value={lineHeight}
                    onChange={e => setLineHeight(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>
                <div>
                  <label className="label">Letter Spacing (px)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="input"
                    value={letterSpacing}
                    onChange={e => setLetterSpacing(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title">Live Preview</span>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {fontFamily} {fontWeight} • {fontSize}px / {lineHeight}px
              </span>
            </div>
            <div className="card-body">
              <textarea
                className="input"
                style={{
                  width: '100%',
                  minHeight: 110,
                  fontSize: Math.min(48, fontSize),
                  lineHeight: `${lineHeight}px`,
                  letterSpacing: `${letterSpacing}px`,
                  fontWeight,
                  fontFamily: `${fontFamily}, sans-serif`,
                  resize: 'vertical',
                  padding: 'var(--sp-3)',
                }}
                value={previewText}
                onChange={e => setPreviewText(e.target.value)}
              />
            </div>
          </div>

          {/* Action Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              style={{ minWidth: 200 }}
            >
              Create Text Style in Figma
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TextStyleGenerator
