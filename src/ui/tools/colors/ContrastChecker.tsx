import React, { useState } from 'react'
import { contrastRatio, isValidHex, normalizeHex } from '../../utils/color'
import type { SelectionInfo, FrameContrastAnalysis, FrameContrastItem } from '../../../shared/types'
import { SelectionBanner } from '../../components/Selection/SelectionBanner'

interface Props {
  selection: SelectionInfo | null
  frameContrastAnalysis: FrameContrastAnalysis | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

type Mode = 'manual' | 'frame'

const CheckIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const XIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const AlertIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)

interface WCAGLevel {
  label: string
  minRatio: number
  description: string
}

const MANUAL_LEVELS: WCAGLevel[] = [
  { label: 'AA Normal Text',  minRatio: 4.5, description: 'Text < 18pt / bold < 14pt' },
  { label: 'AA Large Text',   minRatio: 3.0, description: 'Text ≥ 18pt / bold ≥ 14pt' },
  { label: 'AAA Normal Text', minRatio: 7.0, description: 'Enhanced for normal text'  },
  { label: 'AAA Large Text',  minRatio: 4.5, description: 'Enhanced for large text'   },
]

function getRatingColor(ratio: number): string {
  if (ratio >= 7) return '#059669'
  if (ratio >= 4.5) return '#D97706'
  if (ratio >= 3) return '#F59E0B'
  return '#DC2626'
}

// Single item card for Selected Frame mode
const FrameContrastRow: React.FC<{
  item: FrameContrastItem
}> = ({ item }) => {
  const [overrideBg, setOverrideBg] = useState<string | null>(null)

  const effectiveBg = overrideBg ?? item.backgroundColor
  const isBgKnown = Boolean(effectiveBg && isValidHex(effectiveBg))

  const bgHex = isBgKnown ? normalizeHex(effectiveBg!) : null
  const ratio = (bgHex && isValidHex(item.textColor)) ? contrastRatio(item.textColor, bgHex) : null

  const aaMin = item.isLargeText ? 3.0 : 4.5
  const aaaMin = item.isLargeText ? 4.5 : 7.0

  const passesAA = ratio !== null && ratio >= aaMin
  const passesAAA = ratio !== null && ratio >= aaaMin

  return (
    <div
      style={{
        padding: 'var(--sp-4)',
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        borderRadius: 'var(--r-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-3)',
      }}
    >
      {/* Title & Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--sp-2)' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-primary)' }}>
            {item.nodeName}
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)', marginTop: 2 }}>
            "{item.textSnippet}" • {item.fontSize}px ({item.isLargeText ? 'Large Text' : 'Normal Text'})
          </div>
        </div>

        {ratio !== null && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: getRatingColor(ratio), lineHeight: 1 }}>
              {ratio.toFixed(2)} : 1
            </div>
          </div>
        )}
      </div>

      {/* Color swatches */}
      <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Text color */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 'var(--r-sm)',
              background: item.textColor,
              border: '1px solid rgba(0,0,0,0.1)',
            }}
          />
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--c-text-secondary)' }}>
            Text: {item.textColor}
          </span>
        </div>

        <span style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>on</span>

        {/* Background color */}
        {isBgKnown ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 'var(--r-sm)',
                background: bgHex!,
                border: '1px solid rgba(0,0,0,0.1)',
              }}
            />
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--c-text-secondary)' }}>
              Bg: {bgHex}
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <span style={{ fontSize: 11, color: 'var(--c-warning)', fontWeight: 500 }}>
              Background could not be determined
            </span>
            <div className="color-field" style={{ height: 26, padding: '0 6px' }}>
              <div className="color-field-swatch" style={{ width: 14, height: 14, background: overrideBg ?? '#FFFFFF' }}>
                <input
                  type="color"
                  value={overrideBg ?? '#FFFFFF'}
                  onChange={e => setOverrideBg(e.target.value)}
                />
              </div>
              <input
                className="color-field-input"
                style={{ fontSize: 10, width: 60 }}
                type="text"
                placeholder="#FFFFFF"
                value={overrideBg ?? ''}
                onChange={e => setOverrideBg(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Compliance Badges */}
      {ratio !== null ? (
        <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center', flexWrap: 'wrap' }}>
          {passesAA ? (
            <span className="contrast-badge pass">
              <CheckIcon /> AA Passed ({aaMin}:1 min)
            </span>
          ) : (
            <span className="contrast-badge fail">
              <AlertIcon /> AA Failed — ratio {ratio.toFixed(2)}:1 below {aaMin}:1 min
            </span>
          )}

          {passesAAA ? (
            <span className="contrast-badge pass">
              <CheckIcon /> AAA Passed ({aaaMin}:1 min)
            </span>
          ) : (
            <span className="contrast-badge fail" style={{ opacity: passesAA ? 0.7 : 1 }}>
              <XIcon /> AAA Failed ({aaaMin}:1 min)
            </span>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)', fontStyle: 'italic' }}>
          Select or enter a background color above to calculate contrast ratio.
        </div>
      )}
    </div>
  )
}

export const ContrastChecker: React.FC<Props> = ({
  selection,
  frameContrastAnalysis,
  onError,
}) => {
  const [mode, setMode] = useState<Mode>('manual')

  // Manual mode state
  const [fg, setFg] = useState('#FFFFFF')
  const [bg, setBg] = useState('#2563EB')
  const [fgInput, setFgInput] = useState('#FFFFFF')
  const [bgInput, setBgInput] = useState('#2563EB')

  const fgHex = isValidHex(normalizeHex(fgInput)) ? normalizeHex(fgInput) : '#FFFFFF'
  const bgHex = isValidHex(normalizeHex(bgInput)) ? normalizeHex(bgInput) : '#2563EB'
  const manualRatio = contrastRatio(fgHex, bgHex)

  const handleFgChange = (val: string) => {
    setFgInput(val)
    if (isValidHex(normalizeHex(val))) setFg(normalizeHex(val))
  }

  const handleBgChange = (val: string) => {
    setBgInput(val)
    if (isValidHex(normalizeHex(val))) setBg(normalizeHex(val))
  }

  const handleSwap = () => {
    setFg(bg); setFgInput(bg)
    setBg(fg); setBgInput(fg)
  }

  const hasSelection = Boolean(selection && selection.count > 0)
  const hasAnalysisItems = Boolean(frameContrastAnalysis && frameContrastAnalysis.items.length > 0)

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Colors</div>
        <h1 className="tool-title">Contrast Checker</h1>
        <p className="tool-description">
          Calculate WCAG 2.1 contrast ratio and check AA/AAA compliance.
        </p>
      </div>

      <div className="tool-body">
        {/* Mode Switch */}
        <div className="tabs">
          <button
            className={`tab-btn${mode === 'manual' ? ' active' : ''}`}
            onClick={() => setMode('manual')}
            id="contrast-mode-manual"
          >
            Manual Colors
          </button>
          <button
            className={`tab-btn${mode === 'frame' ? ' active' : ''}`}
            onClick={() => setMode('frame')}
            id="contrast-mode-frame"
          >
            Selected Frame
          </button>
        </div>

        {/* MODE 1: MANUAL COLORS */}
        {mode === 'manual' && (
          <>
            {/* Live Preview */}
            <div
              className="preview-box"
              style={{
                background: bgHex,
                padding: 'var(--sp-6)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--sp-2)',
              }}
            >
              <p style={{ color: fgHex, fontSize: 22, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
                Large Heading Text
              </p>
              <p style={{ color: fgHex, fontSize: 14, margin: 0, lineHeight: 1.6 }}>
                Body text paragraph — The quick brown fox jumps over the lazy dog. Regular text size for reading.
              </p>
              <p style={{ color: fgHex, fontSize: 11, margin: 0, opacity: 0.8 }}>
                Small caption text — Additional detail text at a smaller size.
              </p>
            </div>

            {/* Color pickers */}
            <div className="card">
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'flex-end' }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label className="field-label">Foreground</label>
                    <div className="color-field">
                      <div className="color-field-swatch" style={{ background: fgHex }}>
                        <input type="color" value={fgHex} onChange={e => handleFgChange(e.target.value)} />
                      </div>
                      <input
                        className="color-field-input"
                        type="text"
                        value={fgInput}
                        onChange={e => handleFgChange(e.target.value)}
                        spellCheck={false}
                      />
                    </div>
                  </div>

                  {/* Swap button */}
                  <button
                    className="btn btn-secondary"
                    onClick={handleSwap}
                    title="Swap colors"
                    id="contrast-swap-btn"
                    style={{ marginBottom: 0 }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4"/>
                    </svg>
                  </button>

                  <div className="field" style={{ flex: 1 }}>
                    <label className="field-label">Background</label>
                    <div className="color-field">
                      <div className="color-field-swatch" style={{ background: bgHex }}>
                        <input type="color" value={bgHex} onChange={e => handleBgChange(e.target.value)} />
                      </div>
                      <input
                        className="color-field-input"
                        type="text"
                        value={bgInput}
                        onChange={e => handleBgChange(e.target.value)}
                        spellCheck={false}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Ratio display */}
            {manualRatio !== null && (
              <div className="card">
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--sp-3)' }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                        Contrast Ratio
                      </div>
                      <div
                        className="contrast-ratio-display"
                        style={{ color: getRatingColor(manualRatio) }}
                        id="contrast-ratio-value"
                      >
                        {manualRatio.toFixed(2)}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--c-text-tertiary)', marginTop: 2 }}>: 1</div>
                    </div>

                    {/* Visual rating bar */}
                    <div style={{ flex: 1, paddingBottom: 8 }}>
                      <div style={{ position: 'relative', height: 8, background: 'var(--c-border)', borderRadius: 'var(--r-full)', overflow: 'hidden' }}>
                        {[3, 4.5, 7].map(threshold => (
                          <div
                            key={threshold}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: `${(threshold / 21) * 100}%`,
                              width: 2,
                              height: '100%',
                              background: 'rgba(255,255,255,0.6)',
                              zIndex: 1,
                            }}
                          />
                        ))}
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min((manualRatio / 21) * 100, 100)}%`,
                            background: getRatingColor(manualRatio),
                            borderRadius: 'var(--r-full)',
                            transition: 'width 300ms ease',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--c-text-tertiary)' }}>
                        <span>1:1</span><span>3:1</span><span>4.5:1</span><span>7:1</span><span>21:1</span>
                      </div>
                    </div>
                  </div>

                  {/* WCAG level badges */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                    {MANUAL_LEVELS.map(level => {
                      const passes = manualRatio >= level.minRatio
                      return (
                        <div
                          key={level.label}
                          className={`status-row ${passes ? 'success' : 'fail'}`}
                          id={`contrast-level-${level.label.replace(/\s+/g, '-').toLowerCase()}`}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                            <span className={`contrast-badge ${passes ? 'pass' : 'fail'}`}>
                              {passes ? <CheckIcon /> : <XIcon />}
                            </span>
                            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)' }}>
                              WCAG {level.label}
                            </span>
                          </div>
                          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-tertiary)' }}>
                            {level.description} · min {level.minRatio}:1
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* MODE 2: SELECTED FRAME */}
        {mode === 'frame' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <SelectionBanner
              selection={selection}
              requiresSelection={true}
              selectionHint="Select a frame, component, group, or layer containing text."
            />

            {!hasSelection ? (
              <div className="card">
                <div className="card-body" style={{ textAlign: 'center', padding: 'var(--sp-8)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-primary)', marginBottom: 4 }}>
                    No frame selected
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--c-text-tertiary)' }}>
                    Select a frame, component, group, or layer containing text in Figma to analyze contrast.
                  </div>
                </div>
              </div>
            ) : !hasAnalysisItems ? (
              <div className="card">
                <div className="card-body" style={{ textAlign: 'center', padding: 'var(--sp-8)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-primary)', marginBottom: 4 }}>
                    No text layers found
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--c-text-tertiary)' }}>
                    The selected layer "{selection?.nodeName ?? 'Selection'}" does not contain any text layers.
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Analyzed: {frameContrastAnalysis?.frameName} ({frameContrastAnalysis?.items.length} text layer{frameContrastAnalysis?.items.length !== 1 ? 's' : ''})
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                  {frameContrastAnalysis?.items.map(item => (
                    <FrameContrastRow key={item.nodeId} item={item} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ContrastChecker
