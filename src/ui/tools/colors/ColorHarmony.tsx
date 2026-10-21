import React, { useState } from 'react'
import { generateHarmonies, isValidHex, normalizeHex, shouldUseWhiteText, type HarmonySet } from '../../utils/color'
import { sendToPlugin } from '../../utils/messaging'
import type { SelectionInfo } from '../../../shared/types'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

const HARMONY_DEFS: { key: keyof HarmonySet; label: string; desc: string }[] = [
  { key: 'complementary',      label: 'Complementary',       desc: 'Opposite hues — maximum contrast' },
  { key: 'analogous',          label: 'Analogous',           desc: '±30° neighbors — calm and harmonious' },
  { key: 'triadic',            label: 'Triadic',             desc: '120° apart — vibrant and balanced' },
  { key: 'splitComplementary', label: 'Split Complementary', desc: '150°/210° — softer than complementary' },
  { key: 'tetradic',           label: 'Tetradic',            desc: '90° apart — rich and varied' },
  { key: 'monochromatic',      label: 'Monochromatic',       desc: 'Same hue, varying lightness' },
]

const MiniSwatch: React.FC<{
  hex: string
  onClick: () => void
  onApply: () => void
  title?: string
}> = ({ hex, onClick, onApply, title }) => {
  const useWhite = shouldUseWhiteText(hex)
  return (
    <div
      style={{
        background: hex,
        borderRadius: 'var(--r-md)',
        border: '1px solid rgba(0,0,0,0.06)',
        padding: 'var(--sp-2) var(--sp-3)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--sp-2)',
        transition: 'transform 100ms ease',
        minWidth: 0,
      }}
      title={title ?? hex}
      onClick={onClick}
      onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)' }}
      onMouseUp={e => { e.currentTarget.style.transform = '' }}
      onMouseLeave={e => { e.currentTarget.style.transform = '' }}
    >
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: useWhite ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.6)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {hex.toUpperCase()}
      </span>
    </div>
  )
}

export const ColorHarmony: React.FC<Props> = ({ selection, onSuccess, onError }) => {
  const [inputValue, setInputValue] = useState('#2563EB')
  const [harmonies, setHarmonies] = useState<HarmonySet | null>(null)
  const [activeKey, setActiveKey] = useState<keyof HarmonySet>('complementary')

  const baseHex = isValidHex(normalizeHex(inputValue)) ? normalizeHex(inputValue) : '#2563EB'

  const handleGenerate = () => {
    if (!isValidHex(normalizeHex(inputValue))) {
      onError('Please enter a valid hex color.')
      return
    }
    setHarmonies(generateHarmonies(baseHex))
  }

  const handleCopy = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex)
      onSuccess(`Copied ${hex}`)
    } catch {
      onError('Failed to copy')
    }
  }

  const handleCreateStyles = (colors: string[]) => {
    const groupName = `Harmony/${HARMONY_DEFS.find(d => d.key === activeKey)?.label ?? activeKey}`
    sendToPlugin({
      type: 'CREATE_COLOR_STYLES',
      payload: colors.map((hex, i) => ({
        name: String(i + 1),
        hex,
        groupName,
      })),
    })
  }

  const handleApplyToSelection = (hex: string) => {
    if (!selection || selection.count === 0) {
      onError('Select a layer in Figma first.')
      return
    }
    sendToPlugin({ type: 'APPLY_COLOR_TO_SELECTION', payload: { hex } })
  }

  const activeHarmony = harmonies ? harmonies[activeKey] : null

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Colors</div>
        <h1 className="tool-title">Color Harmony</h1>
        <p className="tool-description">
          Generate complementary, analogous, triadic and other color relationships.
        </p>
      </div>

      <div className="tool-split-view">
        {/* Left Column: Base Color & Type Selector */}
        <div className="tool-pane-left" style={{ width: 290 }}>
          {/* Input */}
          <div className="card">
            <div className="card-header" style={{ padding: 'var(--sp-2) var(--sp-3) 0' }}>
              <span className="card-title" style={{ fontSize: 12 }}>Base Color</span>
            </div>
            <div className="card-body" style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center', padding: 'var(--sp-3)' }}>
              <div className="field" style={{ flex: 1, margin: 0 }}>
                <div className="color-field">
                  <div className="color-field-swatch" style={{ background: baseHex }}>
                    <input
                      type="color"
                      value={baseHex}
                      onChange={e => setInputValue(e.target.value)}
                    />
                  </div>
                  <input
                    className="color-field-input"
                    type="text"
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    placeholder="#2563EB"
                    spellCheck={false}
                  />
                </div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={handleGenerate} id="harmony-generate-btn" style={{ height: 32 }}>
                Generate
              </button>
            </div>
          </div>

          {/* Harmony type selector */}
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="card-header" style={{ padding: 'var(--sp-2) var(--sp-3) 0' }}>
              <span className="card-title" style={{ fontSize: 12 }}>Harmony Relationships</span>
            </div>
            <div className="tool-scroll-list" style={{ padding: 'var(--sp-2)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {HARMONY_DEFS.map(def => {
                const currentHarmonies = harmonies || generateHarmonies(baseHex)
                const colors = currentHarmonies ? currentHarmonies[def.key] : []
                const isActive = activeKey === def.key
                return (
                  <button
                    key={def.key}
                    onClick={() => {
                      if (!harmonies && currentHarmonies) setHarmonies(currentHarmonies)
                      setActiveKey(def.key)
                    }}
                    id={`harmony-type-${def.key}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      borderRadius: 'var(--r-md)',
                      border: `1px solid ${isActive ? 'var(--c-accent)' : 'var(--c-border)'}`,
                      background: isActive ? 'var(--c-accent-subtle)' : 'var(--c-surface)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 120ms ease',
                    }}
                  >
                    {/* Color strip */}
                    <div style={{ display: 'flex', gap: 2, height: 16, width: 68, flexShrink: 0 }}>
                      {colors.map((hex, i) => (
                        <div
                          key={i}
                          style={{
                            flex: 1,
                            background: hex,
                            borderRadius: 2,
                            border: '1px solid rgba(0,0,0,0.06)',
                          }}
                        />
                      ))}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: isActive ? 'var(--c-accent)' : 'var(--c-text-primary)' }}>
                        {def.label}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Active Harmony Detail & Swatches */}
        <div className="tool-pane-right">
          {(() => {
            const currentHarmonies = harmonies || generateHarmonies(baseHex)
            const activeColors = currentHarmonies ? currentHarmonies[activeKey] : []
            const activeDef = HARMONY_DEFS.find(d => d.key === activeKey)

            return (
              <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div className="card-header" style={{ padding: 'var(--sp-3) var(--sp-4)', borderBottom: '1px solid var(--c-border-subtle)' }}>
                  <div>
                    <span className="card-title">{activeDef?.label}</span>
                    <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)', marginTop: 2 }}>{activeDef?.desc}</div>
                  </div>
                  <div className="btn-row">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleCreateStyles(activeColors)}
                      id="harmony-create-styles-btn"
                    >
                      Create Styles ({activeColors.length})
                    </button>
                  </div>
                </div>

                <div className="tool-scroll-list" style={{ padding: 'var(--sp-3) var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                  {activeColors.map((hex, i) => (
                    <div key={i} style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <MiniSwatch
                          hex={hex}
                          onClick={() => handleCopy(hex)}
                          onApply={() => handleApplyToSelection(hex)}
                          title={`Click to copy ${hex}`}
                        />
                      </div>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleApplyToSelection(hex)}
                        style={{ flexShrink: 0, fontSize: 11 }}
                      >
                        Apply
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

export default ColorHarmony
