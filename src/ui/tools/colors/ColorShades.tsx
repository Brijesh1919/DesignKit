import React, { useState } from 'react'
import {
  isValidHex,
  normalizeHex,
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  shouldUseWhiteText,
} from '../../utils/color'
import { sendToPlugin } from '../../utils/messaging'
import type { SelectionInfo } from '../../../shared/types'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

interface ShadeStep {
  name: string
  hex: string
  lightness: number
}

function generateShades(baseHex: string, curveBias: number, satMult: number): ShadeStep[] {
  const rgb = hexToRgb(baseHex) || { r: 37, g: 99, b: 235 }
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)

  // Standard 11-step scale definition: 50 -> 950
  const stepDefinitions = [
    { name: '50', targetL: 96 },
    { name: '100', targetL: 92 },
    { name: '200', targetL: 84 },
    { name: '300', targetL: 74 },
    { name: '400', targetL: 62 },
    { name: '500', targetL: 50 },
    { name: '600', targetL: 40 },
    { name: '700', targetL: 30 },
    { name: '800', targetL: 20 },
    { name: '900', targetL: 13 },
    { name: '950', targetL: 7 },
  ]

  return stepDefinitions.map(step => {
    // Apply curve bias and saturation multiplier
    let l = step.targetL + (curveBias * (100 - step.targetL)) / 100
    l = Math.max(3, Math.min(98, l))
    let s = hsl.s * satMult
    s = Math.max(0, Math.min(100, s))

    const stepRgb = hslToRgb(hsl.h, s, l)
    return {
      name: step.name,
      hex: rgbToHex(stepRgb.r, stepRgb.g, stepRgb.b).toUpperCase(),
      lightness: Math.round(l),
    }
  })
}

export const ColorShades: React.FC<Props> = ({ selection, onSuccess, onError }) => {
  const [inputHex, setInputHex] = useState('#2563EB')
  const [curveBias, setCurveBias] = useState(0)
  const [satMult, setSatMult] = useState(1.0)
  const [scaleName, setScaleName] = useState('Brand')

  const validHex = isValidHex(normalizeHex(inputHex)) ? normalizeHex(inputHex) : '#2563EB'
  const shades = generateShades(validHex, curveBias, satMult)

  const handleCopy = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex)
      onSuccess(`Copied ${hex}`)
    } catch {
      onError('Failed to copy')
    }
  }

  const handleApplyToSelection = (hex: string) => {
    if (!selection || selection.count === 0) {
      onError('Please select a layer on the canvas first.')
      return
    }
    sendToPlugin({
      type: 'APPLY_COLOR_TO_SELECTION',
      payload: { hex },
    })
  }

  const handleCreateStyles = () => {
    sendToPlugin({
      type: 'CREATE_COLOR_STYLES',
      payload: shades.map(s => ({
        name: s.name,
        hex: s.hex,
        groupName: scaleName.trim() || 'Shades',
      })),
    })
  }

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Colors / Color Shades</div>
        <h1 className="tool-title">Color Shades & Tints</h1>
        <p className="tool-desc">
          Generate and fine-tune an 11-step shade scale from 50 to 950 with curve and saturation controls.
        </p>
      </div>

      <div className="main-scroll">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', maxWidth: 680 }}>
          {/* Controls Card */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Base Color & Tuning</span>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
                <div>
                  <label className="label">Base Hex</label>
                  <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={validHex}
                      onChange={e => setInputHex(e.target.value.toUpperCase())}
                      style={{
                        width: 36,
                        height: 34,
                        borderRadius: 'var(--r-md)',
                        border: '1px solid var(--c-border)',
                        padding: 0,
                        cursor: 'pointer',
                        background: 'transparent',
                      }}
                    />
                    <input
                      className="input"
                      style={{ fontFamily: 'var(--font-mono)' }}
                      value={inputHex}
                      onChange={e => setInputHex(e.target.value)}
                      placeholder="#2563EB"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Scale Group Name</label>
                  <input
                    className="input"
                    value={scaleName}
                    onChange={e => setScaleName(e.target.value)}
                    placeholder="e.g. Primary, Slate"
                  />
                </div>
              </div>

              {/* Sliders */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)', marginTop: 'var(--sp-2)' }}>
                <div className="slider-wrap">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', color: 'var(--c-text-secondary)' }}>
                    <span>Lightness Bias</span>
                    <span className="slider-value">{curveBias > 0 ? `+${curveBias}` : curveBias}</span>
                  </div>
                  <input
                    type="range"
                    className="slider"
                    min={-30}
                    max={30}
                    value={curveBias}
                    onChange={e => setCurveBias(Number(e.target.value))}
                  />
                </div>

                <div className="slider-wrap">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', color: 'var(--c-text-secondary)' }}>
                    <span>Saturation Multiplier</span>
                    <span className="slider-value">{satMult.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    className="slider"
                    min={0.2}
                    max={1.8}
                    step={0.05}
                    value={satMult}
                    onChange={e => setSatMult(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Generated Shades Scale */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title">Generated Shades ({shades.length} Steps)</span>
              <button className="btn btn-primary btn-sm" onClick={handleCreateStyles}>
                Create Color Styles in Figma
              </button>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {shades.map(shade => {
                  const useWhite = shouldUseWhiteText(shade.hex)
                  return (
                    <div
                      key={shade.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 'var(--sp-2) var(--sp-4)',
                        borderBottom: '1px solid var(--c-border-subtle)',
                        background: 'var(--c-surface)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 'var(--r-md)',
                            background: shade.hex,
                            border: '1px solid rgba(0,0,0,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: useWhite ? '#fff' : '#000',
                            fontSize: 10,
                            fontWeight: 600,
                          }}
                        >
                          {shade.name}
                        </div>
                        <div>
                          <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-sm)', color: 'var(--c-text-primary)' }}>
                            {scaleName ? `${scaleName} / ${shade.name}` : shade.name}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', color: 'var(--c-text-secondary)' }}>
                            {shade.hex} • L: {shade.lightness}%
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleCopy(shade.hex)}
                          title="Copy Hex"
                        >
                          Copy
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleApplyToSelection(shade.hex)}
                          title="Apply to current selection"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ColorShades
