import React, { useState } from 'react'
import { sendToPlugin } from '../../utils/messaging'
import type { SelectionInfo } from '../../../shared/types'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

interface AspectPreset {
  label: string
  w: number
  h: number
  desc: string
}

const ASPECT_PRESETS: AspectPreset[] = [
  { label: '1 : 1', w: 1, h: 1, desc: 'Square — Avatars & Instagram posts' },
  { label: '16 : 9', w: 16, h: 9, desc: 'Widescreen — YouTube, presentation & hero banners' },
  { label: '4 : 3', w: 4, h: 3, desc: 'Standard — Cards, tablets & legacy displays' },
  { label: '3 : 2', w: 3, h: 2, desc: 'Classic 35mm photography' },
  { label: '9 : 16', w: 9, h: 16, desc: 'Vertical — Mobile reels, stories & TikTok' },
  { label: '21 : 9', w: 21, h: 9, desc: 'Ultrawide cinematic banner' },
]

export const ImageCrop: React.FC<Props> = ({ selection, onSuccess, onError }) => {
  const [selectedRatio, setSelectedRatio] = useState<AspectPreset>(ASPECT_PRESETS[0])
  const [mode, setMode] = useState<'FILL' | 'FIT'>('FILL')
  const [customW, setCustomW] = useState(1)
  const [customH, setCustomH] = useState(1)
  const [isCustom, setIsCustom] = useState(false)

  const activeRatioW = isCustom ? customW : selectedRatio.w
  const activeRatioH = isCustom ? customH : selectedRatio.h

  const handleApply = () => {
    if (!selection || selection.count === 0) {
      onError('Please select an image or frame to crop/adjust.')
      return
    }

    sendToPlugin({
      type: 'APPLY_IMAGE_CROP',
      payload: {
        ratioWidth: activeRatioW,
        ratioHeight: activeRatioH,
        mode,
      },
    })
  }

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Images / Image Crop & Aspect Ratio</div>
        <h1 className="tool-title">Image Crop & Aspect Ratio</h1>
        <p className="tool-desc">
          Crop images and conform frames to standard photographic and social media aspect ratios with Fill or Fit scaling.
        </p>
      </div>

      <div className="main-scroll">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', maxWidth: 660 }}>
          {/* Fill Mode Card */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title">Image Scale Behavior</span>
              <div style={{ display: 'inline-flex', background: 'var(--c-bg)', padding: 2, borderRadius: 'var(--r-md)', border: '1px solid var(--c-border)' }}>
                <button
                  className={`btn btn-sm ${mode === 'FILL' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setMode('FILL')}
                  style={{ height: 26, padding: '0 var(--sp-3)' }}
                >
                  Fill (Crop to Cover)
                </button>
                <button
                  className={`btn btn-sm ${mode === 'FIT' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setMode('FIT')}
                  style={{ height: 26, padding: '0 var(--sp-3)' }}
                >
                  Fit (Letterbox / Contain)
                </button>
              </div>
            </div>

            <div className="card-body">
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-secondary)' }}>
                {mode === 'FILL'
                  ? 'Fills the entire frame seamlessly, cropping outer edges that exceed the target ratio.'
                  : 'Scales the entire image down so 100% of the image content fits inside the container.'}
              </span>
            </div>
          </div>

          {/* Ratio Presets */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Standard Aspect Ratios</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-2)' }}>
                {ASPECT_PRESETS.map(preset => {
                  const isCurrent = !isCustom && selectedRatio.label === preset.label
                  return (
                    <div
                      key={preset.label}
                      onClick={() => {
                        setSelectedRatio(preset)
                        setIsCustom(false)
                      }}
                      style={{
                        padding: 'var(--sp-3)',
                        borderRadius: 'var(--r-md)',
                        border: '1px solid',
                        borderColor: isCurrent ? 'var(--c-accent)' : 'var(--c-border)',
                        background: isCurrent ? 'rgba(37, 99, 235, 0.06)' : 'var(--c-surface)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--c-text-primary)' }}>
                          {preset.label}
                        </span>
                        <div
                          style={{
                            width: 24,
                            height: 24 * (preset.h / preset.w),
                            maxHeight: 24,
                            border: '1px solid var(--c-accent)',
                            borderRadius: 2,
                            background: 'rgba(37, 99, 235, 0.2)',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--c-text-secondary)' }}>{preset.desc}</span>
                    </div>
                  )
                })}
              </div>

              {/* Custom Ratio */}
              <div style={{ marginTop: 'var(--sp-4)', paddingTop: 'var(--sp-3)', borderTop: '1px solid var(--c-border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isCustom}
                      onChange={e => setIsCustom(e.target.checked)}
                    />
                    <span>Custom Aspect Ratio:</span>
                  </label>
                  <input
                    type="number"
                    className="input"
                    disabled={!isCustom}
                    style={{ width: 60, height: 28, textAlign: 'center' }}
                    value={customW}
                    onChange={e => setCustomW(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                  <span>:</span>
                  <input
                    type="number"
                    className="input"
                    disabled={!isCustom}
                    style={{ width: 60, height: 28, textAlign: 'center' }}
                    value={customH}
                    onChange={e => setCustomH(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleApply} style={{ minWidth: 200 }}>
              Apply {activeRatioW}:{activeRatioH} Crop ({mode})
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImageCrop
