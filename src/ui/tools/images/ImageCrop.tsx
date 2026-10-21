import React, { useState, useEffect, useRef } from 'react'
import { sendToPlugin } from '../../utils/messaging'
import type { SelectionInfo, ImageBytesPayload } from '../../../shared/types'

interface Props {
  selection: SelectionInfo | null
  imageBytes?: ImageBytesPayload | null
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
  { label: '1 : 1', w: 1, h: 1, desc: 'Square — Avatars & Posts' },
  { label: '16 : 9', w: 16, h: 9, desc: 'Widescreen — YouTube & Hero' },
  { label: '4 : 3', w: 4, h: 3, desc: 'Standard — Cards & Tablet' },
  { label: '3 : 2', w: 3, h: 2, desc: 'Photo — 35mm Classic' },
  { label: '9 : 16', w: 9, h: 16, desc: 'Vertical — Stories & Reels' },
  { label: '21 : 9', w: 21, h: 9, desc: 'Ultrawide — Cinematic' },
]

export const ImageCrop: React.FC<Props> = ({ selection, imageBytes, onSuccess, onError }) => {
  const [selectedRatio, setSelectedRatio] = useState<AspectPreset>(ASPECT_PRESETS[0])
  const [mode, setMode] = useState<'FILL' | 'FIT'>('FILL')
  const [customW, setCustomW] = useState(1)
  const [customH, setCustomH] = useState(1)
  const [isCustom, setIsCustom] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [origW, setOrigW] = useState(800)
  const [origH, setOrigH] = useState(600)

  // Dragging crop position state (normalized: 0.5 is centered)
  const [cropOffset, setCropOffset] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.5 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startOffsetX: number; startOffsetY: number } | null>(null)
  const imageElementRef = useRef<HTMLImageElement | null>(null)

  // Request image bytes from selection when mounted or when selection changes
  useEffect(() => {
    if (selection && selection.count > 0) {
      sendToPlugin({ type: 'GET_IMAGE_BYTES' })
    }
  }, [selection])

  // Decode image bytes when received and cache in memory
  useEffect(() => {
    if (!imageBytes) return
    const blob = new Blob([new Uint8Array(imageBytes.bytes)], { type: 'image/png' })
    const url = URL.createObjectURL(blob)
    setPreviewUrl(url)
    setOrigW(imageBytes.width)
    setOrigH(imageBytes.height)
    setCropOffset({ x: 0.5, y: 0.5 })

    const img = new Image()
    img.onload = () => {
      imageElementRef.current = img
    }
    img.src = url

    return () => URL.revokeObjectURL(url)
  }, [imageBytes])

  const activeRatioW = isCustom ? customW : selectedRatio.w
  const activeRatioH = isCustom ? customH : selectedRatio.h
  const targetRatio = (activeRatioW > 0 && activeRatioH > 0) ? activeRatioW / activeRatioH : 1

  // Reset to center when ratio changes
  const handleSelectRatio = (preset: AspectPreset) => {
    setSelectedRatio(preset)
    setIsCustom(false)
    setCropOffset({ x: 0.5, y: 0.5 })
  }

  const handleResetCenter = () => {
    setCropOffset({ x: 0.5, y: 0.5 })
  }

  const handleFetchPreview = () => {
    if (!selection || selection.count === 0) {
      onError('Select an image or frame in Figma first.')
      return
    }
    sendToPlugin({ type: 'GET_IMAGE_BYTES' })
  }

  // Calculate live crop framing preview dimensions
  const maxBoxW = 560
  const maxBoxH = 380
  const origAspect = (origW > 0 && origH > 0) ? origW / origH : 1

  // Display size of the image on preview canvas
  let imgDispW = maxBoxW
  let imgDispH = Math.round(maxBoxW / origAspect)
  if (imgDispH > maxBoxH) {
    imgDispH = maxBoxH
    imgDispW = Math.round(maxBoxH * origAspect)
  }

  // In FILL mode: calculate the crop overlay box
  let cropBoxW = imgDispW
  let cropBoxH = imgDispH
  if (origAspect > targetRatio) {
    // Image is wider than target ratio -> crop horizontally (drag left / right)
    cropBoxH = imgDispH
    cropBoxW = Math.round(imgDispH * targetRatio)
  } else {
    // Image is taller than target ratio -> crop vertically (drag up / down)
    cropBoxW = imgDispW
    cropBoxH = Math.round(imgDispW / targetRatio)
  }

  const maxOffsetX = Math.max(0, imgDispW - cropBoxW)
  const maxOffsetY = Math.max(0, imgDispH - cropBoxH)

  // Current pixel coordinates of top-left corner of the crop window
  const currentCropX = Math.round(maxOffsetX * cropOffset.x)
  const currentCropY = Math.round(maxOffsetY * cropOffset.y)

  // Drag interaction handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode !== 'FILL') return
    if (maxOffsetX === 0 && maxOffsetY === 0) return
    e.preventDefault()
    setIsDragging(true)
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startOffsetX: currentCropX,
      startOffsetY: currentCropY,
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragStartRef.current) return
      const deltaX = e.clientX - dragStartRef.current.mouseX
      const deltaY = e.clientY - dragStartRef.current.mouseY

      const newX = Math.max(0, Math.min(maxOffsetX, dragStartRef.current.startOffsetX + deltaX))
      const newY = Math.max(0, Math.min(maxOffsetY, dragStartRef.current.startOffsetY + deltaY))

      setCropOffset({
        x: maxOffsetX > 0 ? newX / maxOffsetX : 0.5,
        y: maxOffsetY > 0 ? newY / maxOffsetY : 0.5,
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      dragStartRef.current = null
    }

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, maxOffsetX, maxOffsetY])

  // In FIT mode: container is shaped by target ratio
  let fitContainerW = maxBoxW
  let fitContainerH = Math.round(maxBoxW / targetRatio)
  if (fitContainerH > maxBoxH) {
    fitContainerH = maxBoxH
    fitContainerW = Math.round(maxBoxH * targetRatio)
  }

  const calculatedNewH = origW > 0 ? Math.round(origW / targetRatio) : 0

  // Apply Crop Action (renders the exact dragged region at full native resolution!)
  const handleApply = () => {
    if (!selection || selection.count === 0) {
      onError('Please select an image or frame to crop/adjust.')
      return
    }

    if (imageElementRef.current && mode === 'FILL' && imgDispW > 0 && imgDispH > 0) {
      try {
        const scaleX = origW / imgDispW
        const scaleY = origH / imgDispH

        const realCropX = Math.max(0, Math.min(origW - 1, Math.round(currentCropX * scaleX)))
        const realCropY = Math.max(0, Math.min(origH - 1, Math.round(currentCropY * scaleY)))
        const realCropW = Math.min(origW - realCropX, Math.round(cropBoxW * scaleX))
        const realCropH = Math.min(origH - realCropY, Math.round(cropBoxH * scaleY))

        const canvas = document.createElement('canvas')
        canvas.width = realCropW
        canvas.height = realCropH
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(
          imageElementRef.current,
          realCropX,
          realCropY,
          realCropW,
          realCropH,
          0,
          0,
          realCropW,
          realCropH
        )

        canvas.toBlob(blob => {
          if (!blob) {
            sendFallbackApply()
            return
          }
          blob.arrayBuffer().then(buf => {
            const bytes = Array.from(new Uint8Array(buf))
            sendToPlugin({
              type: 'APPLY_IMAGE_CROP',
              payload: {
                ratioWidth: activeRatioW,
                ratioHeight: activeRatioH,
                mode,
                croppedBytes: bytes,
                cropRect: {
                  x: realCropX,
                  y: realCropY,
                  width: realCropW,
                  height: realCropH,
                },
              },
            })
            onSuccess(`Applied ${activeRatioW}:${activeRatioH} crop (${realCropW}×${realCropH}px) to layer`)
          })
        }, 'image/png')
        return
      } catch (err) {
        console.error('Canvas crop export error:', err)
      }
    }

    sendFallbackApply()
  }

  const sendFallbackApply = () => {
    sendToPlugin({
      type: 'APPLY_IMAGE_CROP',
      payload: {
        ratioWidth: activeRatioW,
        ratioHeight: activeRatioH,
        mode,
      },
    })
    onSuccess(`Adjusted layer aspect ratio to ${activeRatioW}:${activeRatioH}`)
  }

  // Determine drag cursor and direction guidance
  const canDragX = maxOffsetX > 0
  const canDragY = maxOffsetY > 0
  const canDrag = mode === 'FILL' && (canDragX || canDragY)
  const dragDirectionText = canDragY && !canDragX
    ? '↕ Drag Up / Down'
    : canDragX && !canDragY
    ? '↔ Drag Left / Right'
    : canDragX && canDragY
    ? '⤧ Drag to position'
    : 'Centered'

  const isOffsetNonCenter = Math.abs(cropOffset.x - 0.5) > 0.02 || Math.abs(cropOffset.y - 0.5) > 0.02

  return (
    <div className="tool-view" style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="tool-header" style={{ paddingBottom: 'var(--sp-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="tool-breadcrumb">Images / Image Crop & Aspect Ratio</div>
            <h1 className="tool-title" style={{ margin: 0 }}>Image Crop & Aspect Ratio</h1>
          </div>
          <span style={{ fontSize: 10, color: 'var(--c-text-tertiary)' }}>
            Interactive draggable crop window & framing
          </span>
        </div>
      </div>

      <div className="tool-body" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', overflow: 'hidden', padding: 0 }}>
        {/* Top Controls Card */}
        <div className="card" style={{ flexShrink: 0, padding: 'var(--sp-2) var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Row 1: Selection Info, Mode Selector & Apply CTA */}
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
                    {selection?.nodeName || 'Selected Image'}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--c-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    ({origW} × {origH}px)
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--c-text-secondary)' }}>
                  <span>✂️</span>
                  <span>{selection && selection.count > 0 ? `${selection.nodeName || 'Layer'} selected` : 'Select an image in Figma'}</span>
                  <button className="btn btn-ghost btn-sm" onClick={handleFetchPreview} style={{ height: 22, fontSize: 10, padding: '0 6px' }}>
                    Fetch Preview
                  </button>
                </div>
              )}
            </div>

            {/* Mode Selector and Apply Action */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Scale Mode Buttons */}
              <div style={{ display: 'flex', background: 'var(--c-bg)', padding: 2, borderRadius: 'var(--r-md)', border: '1px solid var(--c-border)' }}>
                <button
                  className={`btn btn-sm ${mode === 'FILL' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setMode('FILL')}
                  style={{ height: 26, fontSize: 11, padding: '0 10px' }}
                  title="Fills container completely, cropping outer excess with drag freedom"
                >
                  Fill (Cover)
                </button>
                <button
                  className={`btn btn-sm ${mode === 'FIT' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setMode('FIT')}
                  style={{ height: 26, fontSize: 11, padding: '0 10px' }}
                  title="Preserves 100% of image with letterboxing"
                >
                  Fit (Contain)
                </button>
              </div>

              {/* Primary Action Button */}
              <button
                className="btn btn-primary btn-sm"
                onClick={handleApply}
                disabled={!selection || selection.count === 0}
                style={{ height: 30, fontSize: 12, padding: '0 16px', fontWeight: 600 }}
              >
                Apply {activeRatioW}:{activeRatioH} Crop
              </button>
            </div>
          </div>

          {/* Row 2: Aspect Ratio Preset Buttons, Custom Inputs & Center Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-secondary)', marginRight: 2 }}>
                Ratio:
              </span>

              {ASPECT_PRESETS.map(preset => {
                const isSelected = !isCustom && selectedRatio.label === preset.label
                return (
                  <button
                    key={preset.label}
                    className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleSelectRatio(preset)}
                    style={{
                      height: 26,
                      fontSize: 11,
                      padding: '0 8px',
                      fontWeight: isSelected ? 600 : 400,
                    }}
                    title={preset.desc}
                  >
                    {preset.label}
                  </button>
                )
              })}

              {/* Custom Ratio Toggle & Inputs */}
              <button
                className={`btn btn-sm ${isCustom ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setIsCustom(!isCustom)}
                style={{ height: 26, fontSize: 11, padding: '0 8px' }}
              >
                Custom
              </button>

              {isCustom && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 2 }}>
                  <input
                    type="number"
                    className="input"
                    style={{ width: 44, height: 26, fontSize: 11, textAlign: 'center', padding: '0 4px', fontFamily: 'var(--font-mono)' }}
                    value={customW}
                    onChange={e => setCustomW(Math.max(1, parseInt(e.target.value) || 1))}
                    placeholder="W"
                  />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-tertiary)' }}>:</span>
                  <input
                    type="number"
                    className="input"
                    style={{ width: 44, height: 26, fontSize: 11, textAlign: 'center', padding: '0 4px', fontFamily: 'var(--font-mono)' }}
                    value={customH}
                    onChange={e => setCustomH(Math.max(1, parseInt(e.target.value) || 1))}
                    placeholder="H"
                  />
                </div>
              )}
            </div>

            {/* Drag helper or re-center button */}
            {canDrag && isOffsetNonCenter && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleResetCenter}
                style={{ height: 24, fontSize: 10, padding: '0 8px', color: 'var(--c-primary)' }}
                title="Reset crop to center"
              >
                Reset to Center
              </button>
            )}
          </div>
        </div>

        {/* Bottom Area: Live Visual Crop & Framing Preview Card */}
        <div className="card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="card-header" style={{ padding: '6px 12px', borderBottom: '1px solid var(--c-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="card-title" style={{ fontSize: 11 }}>Live Framing & Crop Preview</span>
              {canDrag && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: isDragging ? 'var(--c-primary)' : 'rgba(37, 99, 235, 0.12)',
                    color: isDragging ? '#fff' : 'var(--c-primary)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {dragDirectionText}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: 'var(--c-text-tertiary)' }}>
                {mode === 'FILL'
                  ? canDrag ? 'Click and drag the blue crop box to position your shot' : 'Exact fit (no overflow)'
                  : 'Proportional scaling with full image visibility'}
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
                Target Frame: {origW} × {calculatedNewH} px
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
              userSelect: 'none',
            }}
          >
            {previewUrl ? (
              mode === 'FILL' ? (
                /* FILL (Cover) Mode: Interactive Draggable Crop Window with Darkened Margins */
                <div
                  style={{
                    width: imgDispW,
                    height: imgDispH,
                    position: 'relative',
                    borderRadius: 'var(--r-md)',
                    overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {/* Base Original Image */}
                  <img
                    src={previewUrl}
                    alt="Original Base"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* 4 Darkened Scrim Slices Outside the Active Crop Box */}
                  {/* Top Scrim */}
                  {currentCropY > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: imgDispW,
                        height: currentCropY,
                        background: 'rgba(15, 23, 42, 0.68)',
                        backdropFilter: 'blur(1px)',
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                  {/* Bottom Scrim */}
                  {currentCropY + cropBoxH < imgDispH && (
                    <div
                      style={{
                        position: 'absolute',
                        top: currentCropY + cropBoxH,
                        left: 0,
                        width: imgDispW,
                        height: imgDispH - (currentCropY + cropBoxH),
                        background: 'rgba(15, 23, 42, 0.68)',
                        backdropFilter: 'blur(1px)',
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                  {/* Left Scrim */}
                  {currentCropX > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: currentCropY,
                        left: 0,
                        width: currentCropX,
                        height: cropBoxH,
                        background: 'rgba(15, 23, 42, 0.68)',
                        backdropFilter: 'blur(1px)',
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                  {/* Right Scrim */}
                  {currentCropX + cropBoxW < imgDispW && (
                    <div
                      style={{
                        position: 'absolute',
                        top: currentCropY,
                        left: currentCropX + cropBoxW,
                        width: imgDispW - (currentCropX + cropBoxW),
                        height: cropBoxH,
                        background: 'rgba(15, 23, 42, 0.68)',
                        backdropFilter: 'blur(1px)',
                        pointerEvents: 'none',
                      }}
                    />
                  )}

                  {/* Interactive Draggable Crop Window */}
                  <div
                    onMouseDown={handleMouseDown}
                    style={{
                      position: 'absolute',
                      left: currentCropX,
                      top: currentCropY,
                      width: cropBoxW,
                      height: cropBoxH,
                      border: '2px solid var(--c-primary)',
                      borderRadius: 3,
                      cursor: canDrag ? (isDragging ? 'grabbing' : 'grab') : 'default',
                      boxShadow: isDragging ? '0 0 16px rgba(37, 99, 235, 0.6)' : '0 0 8px rgba(0,0,0,0.3)',
                      transition: isDragging ? 'none' : 'box-shadow 0.15s ease',
                    }}
                    title={canDrag ? `${dragDirectionText} — Click and drag to position crop` : ''}
                  >
                    {/* Corner Bracket Handles */}
                    {/* Top-Left */}
                    <div style={{ position: 'absolute', top: -2, left: -2, width: 10, height: 10, borderTop: '3px solid #fff', borderLeft: '3px solid #fff', pointerEvents: 'none' }} />
                    {/* Top-Right */}
                    <div style={{ position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderTop: '3px solid #fff', borderRight: '3px solid #fff', pointerEvents: 'none' }} />
                    {/* Bottom-Left */}
                    <div style={{ position: 'absolute', bottom: -2, left: -2, width: 10, height: 10, borderBottom: '3px solid #fff', borderLeft: '3px solid #fff', pointerEvents: 'none' }} />
                    {/* Bottom-Right */}
                    <div style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderBottom: '3px solid #fff', borderRight: '3px solid #fff', pointerEvents: 'none' }} />

                    {/* Rule-of-Thirds Grid Lines */}
                    <div style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, borderTop: '1px dashed rgba(255, 255, 255, 0.35)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, borderTop: '1px dashed rgba(255, 255, 255, 0.35)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, borderLeft: '1px dashed rgba(255, 255, 255, 0.35)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, borderLeft: '1px dashed rgba(255, 255, 255, 0.35)', pointerEvents: 'none' }} />

                    {/* Drag Guidance Center Hint */}
                    {canDrag && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          background: 'rgba(15, 23, 42, 0.75)',
                          color: '#fff',
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 600,
                          backdropFilter: 'blur(4px)',
                          pointerEvents: 'none',
                          opacity: isDragging ? 0.95 : 0.8,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span>{dragDirectionText}</span>
                      </div>
                    )}

                    {/* Ratio Badge (Bottom-Right) */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 6,
                        right: 6,
                        background: 'rgba(37, 99, 235, 0.9)',
                        color: '#fff',
                        padding: '2px 6px',
                        borderRadius: 3,
                        fontSize: 9,
                        fontWeight: 600,
                        backdropFilter: 'blur(4px)',
                        pointerEvents: 'none',
                      }}
                    >
                      {activeRatioW}:{activeRatioH} Crop
                    </div>
                  </div>
                </div>
              ) : (
                /* FIT (Contain) Mode: Target Aspect Ratio Frame with Preserved Content */
                <div
                  style={{
                    width: fitContainerW,
                    height: fitContainerH,
                    position: 'relative',
                    border: '2px solid var(--c-primary)',
                    borderRadius: 'var(--r-md)',
                    background: '#0f172a',
                    overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img
                    src={previewUrl}
                    alt="Fit Contain Preview"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />

                  {/* Letterbox / Fit Badge */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 6,
                      right: 6,
                      background: 'rgba(16, 185, 129, 0.9)',
                      color: '#fff',
                      padding: '2px 6px',
                      borderRadius: 3,
                      fontSize: 9,
                      fontWeight: 600,
                    }}
                  >
                    100% Contained ({activeRatioW}:{activeRatioH})
                  </div>
                </div>
              )
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--c-text-tertiary)' }}>
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35, margin: '0 auto 8px' }}>
                  <path d="M6 2v14a2 2 0 0 0 2 2h14"/>
                  <path d="M18 22V8a2 2 0 0 0-2-2H2"/>
                </svg>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-secondary)' }}>No Image Loaded for Crop Preview</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Select an image layer on the Figma canvas to see the live crop framing</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImageCrop
