import React, { useState } from 'react'
import { sendToPlugin } from '../../utils/messaging'
import type { SelectionInfo } from '../../../shared/types'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

const PRESET_VALUES = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64]

export const PaddingTool: React.FC<Props> = ({ selection, onSuccess, onError }) => {
  const [isUniform, setIsUniform] = useState(true)
  const [uniformPadding, setUniformPadding] = useState(16)
  const [top, setTop] = useState(16)
  const [right, setRight] = useState(16)
  const [bottom, setBottom] = useState(16)
  const [left, setLeft] = useState(16)

  const handleApply = () => {
    if (!selection || selection.count === 0) {
      onError('Please select a frame or container layer first.')
      return
    }

    const pTop = isUniform ? uniformPadding : top
    const pRight = isUniform ? uniformPadding : right
    const pBottom = isUniform ? uniformPadding : bottom
    const pLeft = isUniform ? uniformPadding : left

    sendToPlugin({
      type: 'APPLY_PADDING',
      payload: {
        paddingTop: pTop,
        paddingRight: pRight,
        paddingBottom: pBottom,
        paddingLeft: pLeft,
      },
    })
  }

  const handleUniformChange = (val: number) => {
    setUniformPadding(val)
    setTop(val)
    setRight(val)
    setBottom(val)
    setLeft(val)
  }

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Layout / Padding Tool</div>
        <h1 className="tool-title">Padding Tool</h1>
        <p className="tool-desc">
          Set uniform or asymmetric internal padding on auto-layout frames with quick 8pt design token presets.
        </p>
      </div>

      <div className="main-scroll">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', maxWidth: 640 }}>
          {/* Mode Switch Card */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title">Padding Mode</span>
              <div style={{ display: 'inline-flex', background: 'var(--c-bg)', padding: 2, borderRadius: 'var(--r-md)', border: '1px solid var(--c-border)' }}>
                <button
                  className={`btn btn-sm ${isUniform ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setIsUniform(true)}
                  style={{ height: 26, padding: '0 var(--sp-3)' }}
                >
                  Uniform (All Sides)
                </button>
                <button
                  className={`btn btn-sm ${!isUniform ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setIsUniform(false)}
                  style={{ height: 26, padding: '0 var(--sp-3)' }}
                >
                  Individual (T / R / B / L)
                </button>
              </div>
            </div>

            <div className="card-body">
              {isUniform ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                  <label className="label">Uniform Padding (px)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                    <input
                      type="number"
                      className="input"
                      style={{ width: 100, fontFamily: 'var(--font-mono)' }}
                      value={uniformPadding}
                      onChange={e => handleUniformChange(Math.max(0, parseInt(e.target.value) || 0))}
                    />
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {PRESET_VALUES.map(p => (
                        <button
                          key={p}
                          className={`btn btn-sm ${uniformPadding === p ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ height: 28, padding: '0 8px', fontSize: 11 }}
                          onClick={() => handleUniformChange(p)}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--sp-2) 0' }}>
                  {/* Visual Box Model */}
                  <div
                    style={{
                      width: 280,
                      height: 180,
                      background: 'var(--c-bg)',
                      border: '2px dashed var(--c-border-strong)',
                      borderRadius: 'var(--r-lg)',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {/* Top Input */}
                    <div style={{ position: 'absolute', top: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--c-text-tertiary)', fontWeight: 600 }}>T:</span>
                      <input
                        type="number"
                        className="input"
                        style={{ width: 60, height: 26, padding: '0 6px', textAlign: 'center', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                        value={top}
                        onChange={e => setTop(Math.max(0, parseInt(e.target.value) || 0))}
                      />
                    </div>

                    {/* Right Input */}
                    <div style={{ position: 'absolute', right: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--c-text-tertiary)', fontWeight: 600 }}>R:</span>
                      <input
                        type="number"
                        className="input"
                        style={{ width: 60, height: 26, padding: '0 6px', textAlign: 'center', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                        value={right}
                        onChange={e => setRight(Math.max(0, parseInt(e.target.value) || 0))}
                      />
                    </div>

                    {/* Center Frame */}
                    <div
                      style={{
                        width: 100,
                        height: 60,
                        background: 'var(--c-surface)',
                        border: '1px solid var(--c-border)',
                        borderRadius: 'var(--r-md)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        color: 'var(--c-text-secondary)',
                        fontWeight: 600,
                        boxShadow: 'var(--shadow-xs)',
                      }}
                    >
                      Frame
                    </div>

                    {/* Bottom Input */}
                    <div style={{ position: 'absolute', bottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--c-text-tertiary)', fontWeight: 600 }}>B:</span>
                      <input
                        type="number"
                        className="input"
                        style={{ width: 60, height: 26, padding: '0 6px', textAlign: 'center', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                        value={bottom}
                        onChange={e => setBottom(Math.max(0, parseInt(e.target.value) || 0))}
                      />
                    </div>

                    {/* Left Input */}
                    <div style={{ position: 'absolute', left: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--c-text-tertiary)', fontWeight: 600 }}>L:</span>
                      <input
                        type="number"
                        className="input"
                        style={{ width: 60, height: 26, padding: '0 6px', textAlign: 'center', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                        value={left}
                        onChange={e => setLeft(Math.max(0, parseInt(e.target.value) || 0))}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--sp-2)' }}>
            <button
              className="btn btn-primary"
              onClick={handleApply}
              style={{ minWidth: 160 }}
            >
              Apply Padding to Frame{selection && selection.count > 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PaddingTool
