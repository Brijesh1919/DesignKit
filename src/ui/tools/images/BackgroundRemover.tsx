import React, { useState, useRef, useEffect, useCallback } from 'react'
import { sendToPlugin } from '../../utils/messaging'
import type { SelectionInfo, ImageBytesPayload } from '../../../shared/types'
import { BackgroundAI } from '../../../ai/BackgroundAI'
import type { AIRefineOptions, AIRuntimeBackend } from '../../../ai/types'

interface Props {
  selection: SelectionInfo | null
  imageBytes: ImageBytesPayload | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

type PreviewMode = 'cutout' | 'original' | 'mask'
type BrushMode = 'none' | 'remove' | 'restore'

export const BackgroundRemover: React.FC<Props> = ({
  selection,
  imageBytes,
  onSuccess,
  onError,
}) => {
  // ---- Processing State ----
  const [isProcessing, setIsProcessing] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [runtimeBackend, setRuntimeBackend] = useState<AIRuntimeBackend | null>(null)

  // ---- Mask & Image Data ----
  const [originalImageData, setOriginalImageData] = useState<ImageData | null>(null)
  const [rawAlphaMask, setRawAlphaMask] = useState<Float32Array | null>(null)
  const [manualAlphaMask, setManualAlphaMask] = useState<Float32Array | null>(null)
  const [processedBytes, setProcessedBytes] = useState<number[] | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // ---- Controls State ----
  const [previewMode, setPreviewMode] = useState<PreviewMode>('cutout')
  const [smoothEdges, setSmoothEdges] = useState(true)
  const [feather, setFeather] = useState(1.0)
  const [brushMode, setBrushMode] = useState<BrushMode>('none')
  const [brushSize, setBrushSize] = useState(30)

  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const isMouseDownRef = useRef(false)

  // Decode & cache original image when imageBytes arrives from Figma
  useEffect(() => {
    if (!imageBytes) return
    setProcessedBytes(null)
    setRawAlphaMask(null)
    setManualAlphaMask(null)
    setStatusMessage(null)
    setErrorMessage(null)

    const blob = new Blob([new Uint8Array(imageBytes.bytes)], { type: 'image/png' })
    const url = URL.createObjectURL(blob)
    setPreviewUrl(url)

    const img = new Image()
    img.onload = () => {
      const offscreen = document.createElement('canvas')
      offscreen.width = img.width
      offscreen.height = img.height
      const ctx = offscreen.getContext('2d')!
      ctx.drawImage(img, 0, 0)

      const imgData = ctx.getImageData(0, 0, img.width, img.height)
      setOriginalImageData(imgData)
    }
    img.src = url

    return () => URL.revokeObjectURL(url)
  }, [imageBytes])

  const handleLocalModelSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsProcessing(true)
    setStatusMessage('Reading local model file...')
    setErrorMessage(null)
    try {
      const buffer = await file.arrayBuffer()
      await BackgroundAI.initializeWithBuffer(buffer, msg => setStatusMessage(msg))
      setRuntimeBackend(BackgroundAI.getRuntime())
      setStatusMessage('✓ Local model loaded and ready')
      onSuccess('Local RMBG-1.4 model cached successfully.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load local model.'
      setErrorMessage(msg)
      onError(msg)
    } finally {
      setIsProcessing(false)
    }
  }

  // Run RMBG-1.4 Background Removal
  const runRemoval = useCallback(async () => {
    if (!originalImageData) {
      onError('Please load an image layer from Figma first.')
      return
    }

    setIsProcessing(true)
    setErrorMessage(null)

    try {
      if (!BackgroundAI.isReady()) {
        setStatusMessage('Initializing model (BRIA RMBG-1.4 1024×1024)...')
        await BackgroundAI.initialize(msg => setStatusMessage(msg))
      }

      setRuntimeBackend(BackgroundAI.getRuntime())
      setStatusMessage('Analyzing & segmenting subject (1024×1024)...')

      const result = await BackgroundAI.removeBackground(originalImageData, msg => setStatusMessage(msg))
      setRawAlphaMask(result.alphaMask)
      setManualAlphaMask(new Float32Array(result.alphaMask))
      setStatusMessage('✓ Background successfully removed')
      setPreviewMode('cutout')
      onSuccess('Background removed with high-definition RMBG-1.4.')
    } catch (err) {
      console.error('[BackgroundRemover] Error during removal:', err)
      const msg = err instanceof Error ? err.message : 'Background removal failed.'
      setErrorMessage(msg)
      setStatusMessage(null)
      onError(msg)
    } finally {
      setIsProcessing(false)
    }
  }, [originalImageData, onSuccess, onError])

  // Render Canvas Live Preview & Export Clean PNG Bytes
  const updatePreviewCanvas = useCallback(() => {
    if (!originalImageData || !previewCanvasRef.current) return

    const { width, height } = originalImageData
    const pCanvas = previewCanvasRef.current
    const pCtx = pCanvas.getContext('2d')!

    const maxDispWidth = 660
    const maxDispHeight = 420
    const scale = Math.min(maxDispWidth / width, maxDispHeight / height, 1)

    const dispW = Math.round(width * scale)
    const dispH = Math.round(height * scale)

    pCanvas.width = dispW
    pCanvas.height = dispH

    let processedMask: Uint8Array

    if (rawAlphaMask) {
      const baseMask = manualAlphaMask ?? rawAlphaMask
      const options: AIRefineOptions = { feather, smoothEdges }
      const floatMask = BackgroundAI.refineMask(baseMask, width, height, options)

      processedMask = new Uint8Array(width * height)
      for (let i = 0; i < width * height; i++) {
        processedMask[i] = Math.round(Math.max(0, Math.min(1, floatMask[i])) * 255)
      }
    } else {
      // No mask computed yet -> 100% opaque
      processedMask = new Uint8Array(width * height).fill(255)
    }

    // Generate Clean Cutout Canvas (Original RGB + processed alpha mask) for PNG Export & Figma Apply
    const cleanCutoutCanvas = document.createElement('canvas')
    cleanCutoutCanvas.width = width
    cleanCutoutCanvas.height = height
    const cleanCtx = cleanCutoutCanvas.getContext('2d')!

    const outImageData = new ImageData(new Uint8ClampedArray(originalImageData.data), width, height)
    const outData = outImageData.data

    for (let i = 0; i < width * height; i++) {
      const p = i * 4
      outData[p + 3] = Math.min(originalImageData.data[p + 3], processedMask[i])
    }
    cleanCtx.putImageData(outImageData, 0, 0)

    // Export PNG Bytes for Apply Action
    if (rawAlphaMask) {
      cleanCutoutCanvas.toBlob(blob => {
        if (!blob) return
        blob.arrayBuffer().then(buf => {
          setProcessedBytes(Array.from(new Uint8Array(buf)))
        })
      }, 'image/png')
    }

    // Render Preview based on previewMode
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = width
    tempCanvas.height = height
    const tempCtx = tempCanvas.getContext('2d')!

    if (previewMode === 'original' || !rawAlphaMask) {
      tempCtx.putImageData(originalImageData, 0, 0)
    } else if (previewMode === 'mask') {
      const maskImgData = tempCtx.createImageData(width, height)
      const mData = maskImgData.data
      for (let i = 0; i < width * height; i++) {
        const p = i * 4
        const val = processedMask[i]
        mData[p] = val
        mData[p + 1] = val
        mData[p + 2] = val
        mData[p + 3] = 255
      }
      tempCtx.putImageData(maskImgData, 0, 0)
    } else {
      // Cutout mode
      tempCtx.drawImage(cleanCutoutCanvas, 0, 0)
    }

    // Scale onto preview display canvas
    pCtx.clearRect(0, 0, dispW, dispH)
    pCtx.drawImage(tempCanvas, 0, 0, width, height, 0, 0, dispW, dispH)
  }, [originalImageData, rawAlphaMask, manualAlphaMask, previewMode, smoothEdges, feather])

  useEffect(() => {
    updatePreviewCanvas()
  }, [updatePreviewCanvas])

  // Brush Touch-Up Coordinates & Drawing
  const getTransformedCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement>
  ): { imgX: number; imgY: number; scaleFactor: number } | null => {
    const canvas = previewCanvasRef.current
    if (!canvas || !originalImageData) return null

    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null

    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top

    const normX = clickX / rect.width
    const normY = clickY / rect.height

    if (normX < 0 || normX > 1 || normY < 0 || normY > 1) return null

    const origW = originalImageData.width
    const origH = originalImageData.height

    const imgX = Math.max(0, Math.min(origW - 1, Math.floor(normX * origW)))
    const imgY = Math.max(0, Math.min(origH - 1, Math.floor(normY * origH)))
    const scaleFactor = origW / rect.width

    return { imgX, imgY, scaleFactor }
  }

  const handleBrushStroke = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isMouseDownRef.current || !originalImageData || !manualAlphaMask || brushMode === 'none') return

    const coords = getTransformedCoordinates(e)
    if (!coords) return

    const { imgX, imgY, scaleFactor } = coords
    const { width, height } = originalImageData
    const radius = Math.max(2, Math.round((brushSize / 2) * scaleFactor))
    const newMask = new Float32Array(manualAlphaMask)
    const baseRaw = rawAlphaMask ?? new Float32Array(width * height)

    for (let dy = -radius; dy <= radius; dy++) {
      const py = imgY + dy
      if (py >= 0 && py < height) {
        for (let dx = -radius; dx <= radius; dx++) {
          const px = imgX + dx
          if (px >= 0 && px < width && dx * dx + dy * dy <= radius * radius) {
            const idx = py * width + px
            if (brushMode === 'remove') {
              newMask[idx] = 0.0
            } else if (brushMode === 'restore') {
              newMask[idx] = baseRaw[idx] > 0.05 ? baseRaw[idx] : 1.0
            }
          }
        }
      }
    }
    setManualAlphaMask(newMask)
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (brushMode === 'none') return
    isMouseDownRef.current = true
    handleBrushStroke(e)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isMouseDownRef.current) handleBrushStroke(e)
  }

  const handleMouseUp = () => {
    isMouseDownRef.current = false
  }

  const resetManualTouchUps = () => {
    if (rawAlphaMask) {
      setManualAlphaMask(new Float32Array(rawAlphaMask))
    }
  }

  const handleLoad = () => {
    if (!selection || selection.count === 0) {
      onError('Select an image layer in Figma first.')
      return
    }
    sendToPlugin({ type: 'GET_IMAGE_BYTES' })
  }

  const handleApply = () => {
    if (!processedBytes || !imageBytes) {
      onError('No processed cutout ready. Click "Remove Background" first.')
      return
    }
    sendToPlugin({
      type: 'APPLY_IMAGE',
      payload: {
        nodeId: imageBytes.nodeId,
        bytes: processedBytes,
        width: imageBytes.width,
        height: imageBytes.height,
      },
    })
  }

  const handleDownload = () => {
    if (!processedBytes) return
    const blob = new Blob([new Uint8Array(processedBytes)], { type: 'image/png' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cutout-${Date.now()}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="tool-view" style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="tool-header" style={{ paddingBottom: 'var(--sp-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="tool-breadcrumb">Images / Background Remover</div>
            <h1 className="tool-title" style={{ margin: 0 }}>Background Remover</h1>
          </div>
          <span style={{ fontSize: 10, color: 'var(--c-text-tertiary)' }}>
            BRIA RMBG-1.4 (1024×1024 HD)
          </span>
        </div>
      </div>

      <div className="tool-body" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', overflow: 'hidden', padding: 0 }}>
        {/* Top Area: Controls, Selection Info, Model status & CTAs */}
        <div className="card" style={{ flexShrink: 0, padding: 'var(--sp-2) var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Row 1: Selection & Mode Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
              {previewUrl && originalImageData ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <img
                    src={previewUrl}
                    alt="Thumbnail"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 'var(--r-sm)',
                      objectFit: 'cover',
                      border: '1px solid var(--c-border)',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div className="truncate" style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-primary)' }}>
                      {selection?.nodeName || 'Selected Image'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--c-text-tertiary)' }}>
                      {originalImageData.width} × {originalImageData.height} px • 1024px Matting
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--c-text-secondary)' }}>
                  <span>🖼️</span>
                  <span>{selection && selection.count > 0 ? `${selection.nodeName || 'Layer'} selected` : 'Select an image layer in Figma to begin'}</span>
                  {selection && selection.count > 0 && (
                    <span className="tag" style={{ fontSize: 9, padding: '1px 5px' }}>{selection.types[0] || 'Image'}</span>
                  )}
                </div>
              )}
            </div>

            {/* If cutout exists, show tabs for Cutout / Original / Mask */}
            {rawAlphaMask ? (
              <div className="tabs" style={{ marginBottom: 0 }}>
                <button
                  className={`tab-btn${previewMode === 'cutout' ? ' active' : ''}`}
                  onClick={() => setPreviewMode('cutout')}
                  style={{ height: 26, fontSize: 11, padding: '0 8px' }}
                >
                  Cutout
                </button>
                <button
                  className={`tab-btn${previewMode === 'original' ? ' active' : ''}`}
                  onClick={() => setPreviewMode('original')}
                  style={{ height: 26, fontSize: 11, padding: '0 8px' }}
                >
                  Original
                </button>
                <button
                  className={`tab-btn${previewMode === 'mask' ? ' active' : ''}`}
                  onClick={() => setPreviewMode('mask')}
                  style={{ height: 26, fontSize: 11, padding: '0 8px' }}
                >
                  Alpha Mask
                </button>
              </div>
            ) : (
              <label style={{ fontSize: 10, color: 'var(--c-text-tertiary)', cursor: 'pointer', textDecoration: 'underline' }}>
                Offline or custom model? Load local .onnx
                <input
                  type="file"
                  accept=".onnx"
                  style={{ display: 'none' }}
                  onChange={handleLocalModelSelect}
                  disabled={isProcessing}
                />
              </label>
            )}
          </div>

          {/* Row 2: Action Buttons Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleLoad}
              disabled={!selection || selection.count === 0 || isProcessing}
              id="bg-remover-load-btn"
              style={{ fontSize: 11, height: 30, padding: '0 12px' }}
            >
              {originalImageData ? 'Re-load Selected Image' : 'Load Image from Selection'}
            </button>

            <button
              className="btn btn-primary btn-sm"
              onClick={runRemoval}
              disabled={!originalImageData || isProcessing}
              style={{ fontSize: 11, height: 30, padding: '0 16px', fontWeight: 600 }}
            >
              {isProcessing ? 'Removing Background…' : rawAlphaMask ? 'Re-run Removal' : 'Remove Background'}
            </button>

            {rawAlphaMask && (
              <>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleApply}
                  disabled={!processedBytes}
                  id="bg-remover-apply-btn"
                  style={{ fontSize: 11, height: 30, padding: '0 14px', fontWeight: 600, background: '#10B981', borderColor: '#10B981' }}
                >
                  Apply to Figma
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleDownload}
                  disabled={!processedBytes}
                  style={{ fontSize: 11, height: 30, padding: '0 10px' }}
                  title="Download transparent PNG to your computer"
                >
                  Download PNG
                </button>
              </>
            )}

            {/* Status or error message inline */}
            {statusMessage && (
              <span style={{ fontSize: 11, color: 'var(--c-accent)', fontWeight: 500, marginLeft: 4 }}>
                {statusMessage}
              </span>
            )}
            {errorMessage && (
              <span style={{ fontSize: 11, color: 'var(--c-danger)', fontWeight: 500, marginLeft: 4 }}>
                {errorMessage}
              </span>
            )}
          </div>

          {/* Row 3 (Only when rawAlphaMask exists): Edge Refinement & Brush Toolbar */}
          {rawAlphaMask && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', paddingTop: 4, borderTop: '1px solid var(--c-border-subtle)', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--c-text-secondary)' }}>Feather:</span>
                <input
                  type="range"
                  className="slider"
                  min={0}
                  max={6}
                  step={0.5}
                  value={feather}
                  onChange={e => setFeather(parseFloat(e.target.value))}
                  style={{ width: 70 }}
                />
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', minWidth: 22 }}>{feather}px</span>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={smoothEdges}
                  onChange={e => setSmoothEdges(e.target.checked)}
                />
                <span>Smooth Edge</span>
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--c-text-secondary)', marginRight: 2 }}>Touch-Up:</span>
                <button
                  className={`btn btn-sm ${brushMode === 'remove' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setBrushMode(brushMode === 'remove' ? 'none' : 'remove')}
                  style={{
                    height: 22,
                    fontSize: 10,
                    padding: '0 8px',
                    ...(brushMode === 'remove' ? { background: '#EF4444', borderColor: '#EF4444' } : {}),
                  }}
                >
                  − Erase
                </button>
                <button
                  className={`btn btn-sm ${brushMode === 'restore' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setBrushMode(brushMode === 'restore' ? 'none' : 'restore')}
                  style={{
                    height: 22,
                    fontSize: 10,
                    padding: '0 8px',
                    ...(brushMode === 'restore' ? { background: '#10B981', borderColor: '#10B981' } : {}),
                  }}
                >
                  + Restore
                </button>

                {brushMode !== 'none' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
                    <input
                      type="range"
                      className="slider"
                      min={10}
                      max={100}
                      value={brushSize}
                      onChange={e => setBrushSize(parseInt(e.target.value))}
                      style={{ width: 60 }}
                    />
                    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)' }}>{brushSize}px</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setBrushMode('none')} style={{ height: 20, fontSize: 9, padding: '0 4px' }}>
                      Done
                    </button>
                  </div>
                )}

                {manualAlphaMask && (
                  <button className="btn btn-ghost btn-sm" onClick={resetManualTouchUps} style={{ height: 20, fontSize: 9, padding: '0 4px', color: 'var(--c-text-tertiary)' }}>
                    Reset
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Area: Full-Width Preview Canvas (flex: 1, minHeight: 0) */}
        <div className="card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="card-header" style={{ padding: '6px 12px', borderBottom: '1px solid var(--c-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title" style={{ fontSize: 11 }}>Preview Canvas</span>
            <span style={{ fontSize: 10, color: 'var(--c-text-tertiary)' }}>
              {brushMode !== 'none'
                ? `Brush: ${brushMode === 'remove' ? 'Erase' : 'Restore'} (${brushSize}px) — drag on canvas to edit`
                : rawAlphaMask
                ? 'Checkerboard indicates transparent cutout'
                : 'Click "Remove Background" to generate high-resolution cutout'}
            </span>
          </div>

          <div
            className="card-body"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 12,
              overflow: 'hidden',
              background: 'var(--c-bg)',
              minHeight: 0,
            }}
          >
            {originalImageData ? (
              <div
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'repeating-conic-gradient(#d0d0d0 0% 25%, #f0f0f0 0% 50%) 0 0 / 16px 16px',
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--c-border)',
                  overflow: 'hidden',
                  cursor: brushMode !== 'none' ? 'crosshair' : 'default',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <canvas
                  ref={previewCanvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  style={{
                    display: 'block',
                    maxWidth: '100%',
                    maxHeight: '440px',
                    objectFit: 'contain',
                  }}
                />
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--c-text-tertiary)' }}>
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35, margin: '0 auto 8px' }}>
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-secondary)' }}>No Image Loaded</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Select an image layer in Figma and click "Load Image from Selection"</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default BackgroundRemover
