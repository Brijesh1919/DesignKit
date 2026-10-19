import React, { useState } from 'react'
import { sendToPlugin } from '../../utils/messaging'
import type { SelectionInfo } from '../../../shared/types'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

const COMMON_PRESETS = [
  { label: 'Full HD (1920 × 1080)', w: 1920, h: 1080 },
  { label: 'HD (1280 × 720)', w: 1280, h: 720 },
  { label: 'Square Post (1080 × 1080)', w: 1080, h: 1080 },
  { label: 'Card (800 × 600)', w: 800, h: 600 },
  { label: 'Avatar / Icon (512 × 512)', w: 512, h: 512 },
  { label: 'Thumbnail (300 × 200)', w: 300, h: 200 },
]

export const ImageResize: React.FC<Props> = ({ selection, onSuccess, onError }) => {
  const [width, setWidth] = useState(800)
  const [height, setHeight] = useState(600)
  const [lockAspect, setLockAspect] = useState(true)

  const handleWidthChange = (val: number) => {
    setWidth(val)
    if (lockAspect && width > 0 && height > 0) {
      setHeight(Math.round(val * (height / width)))
    }
  }

  const handleHeightChange = (val: number) => {
    setHeight(val)
    if (lockAspect && width > 0 && height > 0) {
      setWidth(Math.round(val * (width / height)))
    }
  }

  const handleApply = () => {
    if (!selection || selection.count === 0) {
      onError('Please select an image or layer to resize.')
      return
    }

    sendToPlugin({
      type: 'APPLY_IMAGE_RESIZE',
      payload: {
        width,
        height,
        lockAspect,
      },
    })
  }

  const handleScaleMultiplier = (multiplier: number) => {
    setWidth(Math.round(width * multiplier))
    setHeight(Math.round(height * multiplier))
  }

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Images / Image Resize</div>
        <h1 className="tool-title">Image Resize</h1>
        <p className="tool-desc">
          Resize image layers and frames precisely with proportional constraint locking and standard resolution presets.
        </p>
      </div>

      <div className="main-scroll">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', maxWidth: 660 }}>
          {/* Dimensions Card */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title">Target Dimensions</span>
              <button
                className={`btn btn-sm ${lockAspect ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setLockAspect(!lockAspect)}
              >
                {lockAspect ? '🔒 Constrain Proportions' : '🔓 Free Aspect'}
              </button>
            </div>

            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
                <div>
                  <label className="label">Width (px)</label>
                  <input
                    type="number"
                    className="input"
                    value={width}
                    onChange={e => handleWidthChange(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
                <div>
                  <label className="label">Height (px)</label>
                  <input
                    type="number"
                    className="input"
                    value={height}
                    onChange={e => handleHeightChange(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
              </div>

              {/* Quick Scale Buttons */}
              <div>
                <label className="label">Quick Scale</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[0.5, 0.75, 1.25, 1.5, 2.0].map(s => (
                    <button
                      key={s}
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleScaleMultiplier(s)}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Standard Presets Card */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Resolution Presets</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--sp-2)' }}>
                {COMMON_PRESETS.map(p => (
                  <button
                    key={p.label}
                    className="btn btn-secondary btn-sm"
                    style={{ height: 'auto', padding: 'var(--sp-2)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}
                    onClick={() => {
                      setWidth(p.w)
                      setHeight(p.h)
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 11, color: 'var(--c-text-primary)' }}>{p.label}</span>
                    <span style={{ fontSize: 10, color: 'var(--c-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {p.w} × {p.h}px
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleApply} style={{ minWidth: 200 }}>
              Resize Selected Layer ({width} × {height}px)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImageResize
