import React, { useState, useEffect } from 'react'
import { sendToPlugin } from '../../utils/messaging'
import type { SelectionInfo, ImageBytesPayload } from '../../../shared/types'

interface Props {
  selection: SelectionInfo | null
  imageBytes?: ImageBytesPayload | null
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

export const ImageResize: React.FC<Props> = ({ selection, imageBytes, onSuccess, onError }) => {
  const [width, setWidth] = useState(800)
  const [height, setHeight] = useState(600)
  const [origW, setOrigW] = useState(800)
  const [origH, setOrigH] = useState(600)
  const [lockAspect, setLockAspect] = useState(true)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Request image bytes from selection when mounted or when selection changes
  useEffect(() => {
    if (selection && selection.count > 0) {
      sendToPlugin({ type: 'GET_IMAGE_BYTES' })
    }
  }, [selection])

  // Decode image bytes when received
  useEffect(() => {
    if (!imageBytes) return
    const blob = new Blob([new Uint8Array(imageBytes.bytes)], { type: 'image/png' })
    const url = URL.createObjectURL(blob)
    setPreviewUrl(url)
    setOrigW(imageBytes.width)
    setOrigH(imageBytes.height)
    setWidth(imageBytes.width)
    setHeight(imageBytes.height)

    return () => URL.revokeObjectURL(url)
  }, [imageBytes])

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

  const handleLoadImage = () => {
    if (!selection || selection.count === 0) {
      onError('Select a layer in Figma first.')
      return
    }
    sendToPlugin({ type: 'GET_IMAGE_BYTES' })
  }

  // Calculate preview frame scaling
  const maxBoxW = 560
  const maxBoxH = 360
  const targetAspect = (width > 0 && height > 0) ? width / height : 1
  let dispW = maxBoxW
  let dispH = Math.round(maxBoxW / targetAspect)
  if (dispH > maxBoxH) {
    dispH = maxBoxH
    dispW = Math.round(maxBoxH * targetAspect)
  }

  const scalePercent = origW > 0 ? Math.round((width / origW) * 100) : 100

  return (
    <div className="tool-view" style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="tool-header" style={{ paddingBottom: 'var(--sp-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="tool-breadcrumb">Images / Image Resize</div>
            <h1 className="tool-title" style={{ margin: 0 }}>Image Resize</h1>
          </div>
          <span style={{ fontSize: 10, color: 'var(--c-text-tertiary)' }}>
            Proportional constraint locking & live preview
          </span>
        </div>
      </div>

      <div className="tool-body" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', overflow: 'hidden', padding: 0 }}>
        {/* Top Controls Card */}
        <div className="card" style={{ flexShrink: 0, padding: 'var(--sp-2) var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Row 1: Selection Info & Quick Presets */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              {previewUrl ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <img
                    src={previewUrl}
                    alt="Thumbnail"
                    style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover', border: '1px solid var(--c-border)' }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-primary)' }}>
                    {selection?.nodeName || 'Selected Layer'}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--c-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    (Original: {origW} × {origH}px)
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--c-text-secondary)' }}>
                  <span>📐</span>
                  <span>{selection && selection.count > 0 ? `${selection.nodeName || 'Layer'} selected` : 'Select an image or frame in Figma'}</span>
                  <button className="btn btn-ghost btn-sm" onClick={handleLoadImage} style={{ height: 22, fontSize: 10, padding: '0 6px' }}>
                    Fetch Preview
                  </button>
                </div>
              )}
            </div>

            {/* Presets Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>Preset:</span>
              <select
                className="input"
                style={{ height: 26, fontSize: 11, padding: '0 6px', width: 170 }}
                onChange={e => {
                  const p = COMMON_PRESETS.find(item => item.label === e.target.value)
                  if (p) {
                    setWidth(p.w)
                    setHeight(p.h)
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>Standard Resolution…</option>
                {COMMON_PRESETS.map(p => (
                  <option key={p.label} value={p.label}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Dimensions, Lock, Multipliers & Pinned CTA */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* Width Input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-secondary)' }}>W:</span>
                <input
                  type="number"
                  className="input"
                  value={width}
                  onChange={e => handleWidthChange(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ width: 70, height: 28, fontSize: 11, fontFamily: 'var(--font-mono)', padding: '0 6px' }}
                />
                <span style={{ fontSize: 10, color: 'var(--c-text-tertiary)' }}>px</span>
              </div>

              {/* Lock Aspect Button */}
              <button
                className={`btn btn-sm ${lockAspect ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setLockAspect(!lockAspect)}
                style={{ height: 28, fontSize: 10, padding: '0 8px' }}
                title={lockAspect ? 'Constrain Proportions Locked' : 'Free Proportions'}
              >
                {lockAspect ? '🔒 Proportional' : '🔓 Free'}
              </button>

              {/* Height Input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-secondary)' }}>H:</span>
                <input
                  type="number"
                  className="input"
                  value={height}
                  onChange={e => handleHeightChange(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ width: 70, height: 28, fontSize: 11, fontFamily: 'var(--font-mono)', padding: '0 6px' }}
                />
                <span style={{ fontSize: 10, color: 'var(--c-text-tertiary)' }}>px</span>
              </div>

              {/* Quick Multipliers */}
              <div style={{ display: 'flex', gap: 2, alignItems: 'center', marginLeft: 4 }}>
                {[0.5, 0.75, 1.25, 1.5, 2.0].map(s => (
                  <button
                    key={s}
                    className="btn btn-secondary btn-sm"
                    style={{ height: 24, padding: '0 6px', fontSize: 10 }}
                    onClick={() => handleScaleMultiplier(s)}
                    title={`Scale by ${s}×`}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </div>

            {/* Primary Action Button */}
            <button
              className="btn btn-primary btn-sm"
              onClick={handleApply}
              disabled={!selection || selection.count === 0}
              style={{ height: 30, fontSize: 12, padding: '0 16px', fontWeight: 600 }}
            >
              Resize to {width} × {height}px
            </button>
          </div>
        </div>

        {/* Bottom Area: Live Dimension & Image Preview Card */}
        <div className="card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="card-header" style={{ padding: '6px 12px', borderBottom: '1px solid var(--c-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title" style={{ fontSize: 11 }}>Live Dimension & Proportion Preview</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: 'var(--c-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                Target: {width} × {height} px ({scalePercent}% Scale)
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: 'rgba(37, 99, 235, 0.1)',
                  color: 'var(--c-primary)',
                }}
              >
                Aspect: {targetAspect.toFixed(2)}:1
              </span>
            </div>
          </div>

          <div
            className="card-body"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              overflow: 'hidden',
              background: 'var(--c-bg)',
              minHeight: 0,
              position: 'relative',
            }}
          >
            {previewUrl ? (
              <div
                style={{
                  width: dispW,
                  height: dispH,
                  border: '2px solid var(--c-primary)',
                  borderRadius: 'var(--r-md)',
                  background: 'var(--c-surface)',
                  overflow: 'hidden',
                  position: 'relative',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src={previewUrl}
                  alt="Resized Preview"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: lockAspect ? 'contain' : 'fill',
                    display: 'block',
                  }}
                />

                {/* Dimension Badges on Preview Frame */}
                <div
                  style={{
                    position: 'absolute',
                    top: 6,
                    left: 6,
                    background: 'rgba(15, 23, 42, 0.85)',
                    color: '#fff',
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontSize: 9,
                    fontFamily: 'var(--font-mono)',
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  {width} × {height} px
                </div>

                <div
                  style={{
                    position: 'absolute',
                    bottom: 6,
                    right: 6,
                    background: 'rgba(37, 99, 235, 0.9)',
                    color: '#fff',
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontSize: 9,
                    fontWeight: 600,
                  }}
                >
                  {scalePercent}% {lockAspect ? 'Proportional' : 'Distorted/Free'}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--c-text-tertiary)' }}>
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35, margin: '0 auto 8px' }}>
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <path d="M15 3h6v6"/>
                  <path d="M9 21H3v-6"/>
                  <path d="M21 3l-7 7"/>
                  <path d="M3 21l7-7"/>
                </svg>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-secondary)' }}>No Image Loaded for Preview</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Select an image or frame on the Figma canvas to see the live resize preview</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImageResize
