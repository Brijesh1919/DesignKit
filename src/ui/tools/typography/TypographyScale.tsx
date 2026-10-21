import React, { useState } from 'react'
import { generateTypeScale, SCALES, type ScaleKey, type TypeLevel } from '../../utils/typography'
import { sendToPlugin } from '../../utils/messaging'
import type { TextStyleDef } from '../../../shared/types'

interface Props {
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

type LineHeightMode = 'auto' | 'tight' | 'normal' | 'relaxed'

// Weight mode: "per-level" uses suggestedWeight, "uniform" applies one weight to all
type WeightMode = 'per-level' | 'uniform'

const WEIGHT_LABELS: Record<number, string> = {
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'SemiBold',
  700: 'Bold',
}

export const TypographyScale: React.FC<Props> = ({ onSuccess, onError }) => {
  const [baseSize, setBaseSize] = useState(16)
  const [scaleKey, setScaleKey] = useState<ScaleKey>('majorThird')
  const [weightMode, setWeightMode] = useState<WeightMode>('per-level')
  const [uniformWeight, setUniformWeight] = useState(400)
  const [lineHeightMode, setLineHeightMode] = useState<LineHeightMode>('auto')
  const [fontFamily, setFontFamily] = useState('Inter')
  const [prefix, setPrefix] = useState('Type/')

  const scale = generateTypeScale(baseSize, scaleKey, lineHeightMode)

  // Resolve the font weight for a given level
  const resolveWeight = (level: TypeLevel): number =>
    weightMode === 'per-level' ? level.suggestedWeight : uniformWeight

  const handleCreateStyles = () => {
    if (!fontFamily.trim()) {
      onError('Please enter a font family name.')
      return
    }

    const styles: TextStyleDef[] = scale.map(level => ({
      name: `${prefix}${level.name}`,
      fontSize: level.fontSize,
      lineHeight: level.lineHeight,
      fontWeight: resolveWeight(level),
      letterSpacing: level.letterSpacing,
      fontFamily: fontFamily.trim(),
    }))

    sendToPlugin({ type: 'CREATE_TEXT_STYLES', payload: styles })
  }

  const handleCopyCSS = () => {
    const css = scale
      .map(level => {
        const w = resolveWeight(level)
        return (
          `.${level.name.toLowerCase().replace(/\s+/g, '-')} {\n` +
          `  font-size: ${level.fontSize}px;\n` +
          `  line-height: ${level.lineHeight}px;\n` +
          `  font-weight: ${w};\n` +
          `  letter-spacing: ${level.letterSpacing}px;\n` +
          `}`
        )
      })
      .join('\n\n')
    navigator.clipboard.writeText(css)
    onSuccess('Copied CSS to clipboard')
  }

  const selectedScale = SCALES.find(s => s.key === scaleKey)

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Typography</div>
        <h1 className="tool-title">Typography Scale</h1>
        <p className="tool-description">
          Generate a musical-ratio type scale and create Figma text styles.
        </p>
      </div>

      <div className="tool-split-view">
        {/* Left Pane: Controls & Actions (~310px) */}
        <div className="tool-pane-left">
          <div className="card">
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              {/* Base size & Scale ratio */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)' }}>
                <div className="field">
                  <label className="field-label" htmlFor="type-base-size">Base Size</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      id="type-base-size"
                      className="num-input"
                      type="number"
                      min={8}
                      max={32}
                      value={baseSize}
                      onChange={e =>
                        setBaseSize(Math.max(8, Math.min(32, parseInt(e.target.value) || 16)))
                      }
                      style={{ height: 30, fontSize: 12, flex: 1 }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>px</span>
                  </div>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="type-scale">Scale Ratio</label>
                  <select
                    id="type-scale"
                    className="select"
                    value={scaleKey}
                    onChange={e => setScaleKey(e.target.value as ScaleKey)}
                    style={{ height: 30, fontSize: 11 }}
                  >
                    {SCALES.map(s => (
                      <option key={s.key} value={s.key}>
                        {s.label} (×{s.ratio})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Font Weight */}
              <div className="field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="field-label">Font Weight</label>
                  <div className="tabs" style={{ marginBottom: 0 }}>
                    {(['per-level', 'uniform'] as const).map(m => (
                      <button
                        key={m}
                        className={`tab-btn${weightMode === m ? ' active' : ''}`}
                        onClick={() => setWeightMode(m)}
                        id={`type-weight-mode-${m}`}
                        style={{ height: 22, fontSize: 10, padding: '0 8px' }}
                      >
                        {m === 'per-level' ? 'Per Level' : 'Uniform'}
                      </button>
                    ))}
                  </div>
                </div>
                {weightMode === 'uniform' && (
                  <select
                    className="select"
                    style={{ marginTop: 4, height: 28, fontSize: 11 }}
                    value={uniformWeight}
                    onChange={e => setUniformWeight(parseInt(e.target.value))}
                    id="type-uniform-weight"
                  >
                    {[300, 400, 500, 600, 700].map(w => (
                      <option key={w} value={w}>
                        {WEIGHT_LABELS[w]} ({w})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Line height */}
              <div className="field">
                <label className="field-label" htmlFor="type-lh">Line Height</label>
                <select
                  id="type-lh"
                  className="select"
                  value={lineHeightMode}
                  onChange={e => setLineHeightMode(e.target.value as LineHeightMode)}
                  style={{ height: 30, fontSize: 11 }}
                >
                  <option value="auto">Automatic</option>
                  <option value="tight">Tight (×1.2)</option>
                  <option value="normal">Normal (×1.5)</option>
                  <option value="relaxed">Relaxed (×1.7)</option>
                </select>
              </div>

              {/* Font family & Prefix */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 'var(--sp-2)' }}>
                <div className="field">
                  <label className="field-label" htmlFor="type-family">Font Family</label>
                  <input
                    id="type-family"
                    className="input"
                    type="text"
                    value={fontFamily}
                    onChange={e => setFontFamily(e.target.value)}
                    placeholder="Inter"
                    style={{ height: 30, fontSize: 11 }}
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="type-prefix">Prefix</label>
                  <input
                    id="type-prefix"
                    className="input"
                    type="text"
                    value={prefix}
                    onChange={e => setPrefix(e.target.value)}
                    placeholder="Type/"
                    style={{ height: 30, fontSize: 11 }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Actions Card */}
          <div className="card" style={{ marginTop: 'auto', background: 'var(--c-surface)' }}>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 'var(--sp-3)' }}>
              <button
                className="btn btn-primary btn-full"
                onClick={handleCreateStyles}
                id="type-create-styles-btn"
                style={{ height: 36, fontSize: 13, fontWeight: 600 }}
              >
                Create Text Styles
              </button>

              <button
                className="btn btn-secondary btn-full btn-sm"
                onClick={handleCopyCSS}
                id="type-copy-css-btn"
                style={{ height: 28, fontSize: 11 }}
              >
                Copy Scale CSS
              </button>
            </div>
          </div>

          {/* Info note */}
          <div
            style={{
              padding: '6px 10px',
              background: 'var(--c-accent-subtle)',
              border: '1px solid var(--c-accent-border)',
              borderRadius: 'var(--r-md)',
              fontSize: 10,
              color: 'var(--c-text-secondary)',
              lineHeight: 1.4,
            }}
          >
            <strong>Note:</strong> Selected font family ({fontFamily}) will be loaded from Figma when generating styles.
          </div>
        </div>

        {/* Right Pane: Live Scale Preview (flex: 1) */}
        <div className="tool-pane-right" style={{ overflow: 'hidden' }}>
          <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="card-header" style={{ padding: '8px 12px', borderBottom: '1px solid var(--c-border-subtle)' }}>
              <span className="card-title">
                Scale Preview — {selectedScale?.label} (×{selectedScale?.ratio})
              </span>
              <span style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>
                {scale.length} Levels Defined
              </span>
            </div>

            <div className="card-body tool-scroll-list" style={{ padding: '0 12px' }}>
              {scale.map((level, i) => {
                const w = resolveWeight(level)
                const previewSize = Math.min(level.fontSize, 36)
                const previewLH = Math.min(level.lineHeight, Math.round(36 * 1.3))
                const isHeading = level.step >= 2
                const previewText = isHeading
                  ? level.name
                  : level.step === 1
                    ? 'The quick brown fox'
                    : 'The quick brown fox jumps over the lazy dog'

                return (
                  <div
                    key={level.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--sp-3)',
                      padding: '8px 0',
                      borderBottom:
                        i < scale.length - 1
                          ? '1px solid var(--c-border-subtle)'
                          : 'none',
                    }}
                  >
                    {/* Meta info */}
                    <div style={{ width: 110, flexShrink: 0 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'var(--c-text-secondary)',
                        }}
                      >
                        {level.name}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: 'var(--c-text-tertiary)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {level.fontSize}px / {level.lineHeight}px
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: 'var(--c-text-tertiary)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {WEIGHT_LABELS[w] ?? w}
                      </div>
                    </div>

                    {/* Preview text */}
                    <div
                      style={{
                        fontSize: `${previewSize}px`,
                        fontWeight: w,
                        lineHeight: `${previewLH}px`,
                        letterSpacing: `${level.letterSpacing}px`,
                        color: 'var(--c-text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}
                    >
                      {previewText}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TypographyScale
