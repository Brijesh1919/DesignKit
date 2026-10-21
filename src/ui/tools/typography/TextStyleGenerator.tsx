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

      <div className="tool-split-view">
        {/* Left Column: Parameters & Pinned CTA */}
        <div className="tool-pane-left" style={{ width: 320 }}>
          {/* Style Configuration Card */}
          <div className="card">
            <div className="card-header" style={{ padding: 'var(--sp-2) var(--sp-4) 0' }}>
              <span className="card-title" style={{ fontSize: 12 }}>Typography Parameters</span>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', padding: 'var(--sp-3) var(--sp-4)' }}>
              {/* Name & Family */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)' }}>
                <div>
                  <label className="label" style={{ fontSize: 11 }}>Style Name</label>
                  <input
                    className="input"
                    style={{ height: 30, fontSize: 12 }}
                    value={styleName}
                    onChange={e => setStyleName(e.target.value)}
                    placeholder="e.g. Heading/H2"
                  />
                </div>
                <div>
                  <label className="label" style={{ fontSize: 11 }}>Font Family</label>
                  <input
                    className="input"
                    style={{ height: 30, fontSize: 12 }}
                    value={fontFamily}
                    onChange={e => setFontFamily(e.target.value)}
                    placeholder="Inter"
                  />
                </div>
              </div>

              {/* Weight & Size */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)' }}>
                <div>
                  <label className="label" style={{ fontSize: 11 }}>Weight</label>
                  <select
                    className="select"
                    style={{ height: 30, fontSize: 12 }}
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
                  <label className="label" style={{ fontSize: 11 }}>Font Size (px)</label>
                  <input
                    type="number"
                    className="input"
                    style={{ height: 30, fontSize: 12 }}
                    value={fontSize}
                    onChange={e => {
                      const val = Math.max(6, parseInt(e.target.value) || 16)
                      setFontSize(val)
                      setLineHeight(Math.round(val * 1.35))
                    }}
                  />
                </div>
              </div>

              {/* Size Preset Pills */}
              <div>
                <label className="label" style={{ fontSize: 11 }}>Preset Sizes</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {SIZE_PRESETS.map(s => (
                    <button
                      key={s}
                      className={`btn btn-sm ${fontSize === s ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ height: 22, padding: '0 6px', fontSize: 10 }}
                      onClick={() => {
                        setFontSize(s)
                        setLineHeight(Math.round(s * 1.35))
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Line Height & Letter Spacing */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)' }}>
                <div>
                  <label className="label" style={{ fontSize: 11 }}>Line Height (px)</label>
                  <input
                    type="number"
                    className="input"
                    style={{ height: 30, fontSize: 12 }}
                    value={lineHeight}
                    onChange={e => setLineHeight(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>
                <div>
                  <label className="label" style={{ fontSize: 11 }}>Tracking (px)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="input"
                    style={{ height: 30, fontSize: 12 }}
                    value={letterSpacing}
                    onChange={e => setLetterSpacing(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Button Card */}
          <div className="card" style={{ padding: 'var(--sp-3)' }}>
            <button
              className="btn btn-primary btn-full"
              onClick={handleCreate}
              id="create-text-style-btn"
            >
              Create Text Style in Figma
            </button>
          </div>
        </div>

        {/* Right Column: Live Preview */}
        <div className="tool-pane-right">
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="card-header" style={{ padding: 'var(--sp-2) var(--sp-4)', borderBottom: '1px solid var(--c-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title">Live Preview</span>
              <span style={{ fontSize: 11, color: 'var(--c-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {fontFamily} {fontWeight} • {fontSize}px / {lineHeight}px
              </span>
            </div>
            <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 'var(--sp-3)' }}>
              <textarea
                className="input"
                style={{
                  width: '100%',
                  flex: 1,
                  fontSize: Math.min(48, fontSize),
                  lineHeight: `${lineHeight}px`,
                  letterSpacing: `${letterSpacing}px`,
                  fontWeight,
                  fontFamily: `${fontFamily}, sans-serif`,
                  resize: 'none',
                  padding: 'var(--sp-3)',
                }}
                value={previewText}
                onChange={e => setPreviewText(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TextStyleGenerator
