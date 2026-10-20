import React, { useState, useRef, useEffect, useCallback } from 'react'
import { sendToPlugin } from '../../utils/messaging'
import type { SelectionInfo, ImageBytesPayload } from '../../../shared/types'
import { SelectionBanner } from '../../components/Selection/SelectionBanner'
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

    const maxDispWidth = 520
    const maxDispHeight = 320
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
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Images / Background Remover</div>
        <h1 className="tool-title">Background Remover</h1>
        <p className="tool-desc">
          Remove backgrounds with studio-grade precision using BRIA RMBG-1.4 (1024×1024 high-resolution matting).
        </p>
      </div>

      <div className="main-scroll" style={{ paddingBottom: 80 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', maxWidth: 640 }}>
          <SelectionBanner
            selection={selection}
            requiresSelection={true}
            selectionHint="Select an image layer on the canvas to remove its background."
          />

          {/* Load / Image Selection Card */}
          <div className="card">
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              <button
                className="btn btn-secondary btn-full"
                onClick={handleLoad}
                disabled={!selection || selection.count === 0 || isProcessing}
                id="bg-remover-load-btn"
              >
                {originalImageData ? 'Re-load Selected Image' : 'Load Image from Selection'}
              </button>

              {previewUrl && originalImageData && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--sp-2) var(--sp-3)', background: 'var(--c-bg)', borderRadius: 'var(--r-md)', border: '1px solid var(--c-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                    <img
                      src={previewUrl}
                      alt="Thumbnail"
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 'var(--r-sm)',
                        objectFit: 'cover',
                        border: '1px solid var(--c-border)',
                      }}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-primary)' }}>
                        {selection?.nodeName || 'Selected Image'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>
                        {originalImageData.width} × {originalImageData.height} px
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-accent)', background: 'rgba(37, 99, 235, 0.08)', padding: '2px 8px', borderRadius: 4 }}>
                      1024px Matting
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {originalImageData && (
            <>
              {/* Primary Action Card */}
              <div className="card" style={{ border: '1px solid var(--c-accent)', background: 'rgba(37, 99, 235, 0.02)' }}>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                  <button
                    className="btn btn-primary btn-full btn-lg"
                    onClick={runRemoval}
                    disabled={isProcessing}
                    style={{ height: 42, fontSize: 14, fontWeight: 600 }}
                  >
                    {isProcessing ? 'Removing Background…' : rawAlphaMask ? 'Re-run Removal' : 'Remove Background'}
                  </button>

                  {statusMessage && (
                    <div style={{ fontSize: 12, color: 'var(--c-accent)', fontWeight: 500, textAlign: 'center' }}>
                      {statusMessage}
                    </div>
                  )}

                  {errorMessage && (
                    <div style={{ fontSize: 12, color: 'var(--c-danger)', textAlign: 'center' }}>
                      {errorMessage}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 2 }}>
                    <label style={{ fontSize: 11, color: 'var(--c-text-tertiary)', cursor: 'pointer', textDecoration: 'underline' }}>
                      Offline or custom model? Load local .onnx
                      <input
                        type="file"
                        accept=".onnx"
                        style={{ display: 'none' }}
                        onChange={handleLocalModelSelect}
                        disabled={isProcessing}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Live Preview Card */}
              <div className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="card-title">Preview Canvas</span>
                  {rawAlphaMask && (
                    <div className="tabs" style={{ marginBottom: 0 }}>
                      <button
                        className={`tab-btn${previewMode === 'cutout' ? ' active' : ''}`}
                        onClick={() => setPreviewMode('cutout')}
                      >
                        Cutout
                      </button>
                      <button
                        className={`tab-btn${previewMode === 'original' ? ' active' : ''}`}
                        onClick={() => setPreviewMode('original')}
                      >
                        Original
                      </button>
                      <button
                        className={`tab-btn${previewMode === 'mask' ? ' active' : ''}`}
                        onClick={() => setPreviewMode('mask')}
                      >
                        Alpha Mask
                      </button>
                    </div>
                  )}
                </div>

                <div className="card-body" style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      display: 'inline-block',
                      background: 'repeating-conic-gradient(#d0d0d0 0% 25%, #f0f0f0 0% 50%) 0 0 / 16px 16px',
                      borderRadius: 'var(--r-md)',
                      border: '1px solid var(--c-border)',
                      overflow: 'hidden',
                      maxWidth: '100%',
                      cursor: brushMode !== 'none' ? 'crosshair' : 'default',
                    }}
                  >
                    <canvas
                      ref={previewCanvasRef}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      style={{ display: 'block', maxWidth: '100%' }}
                    />
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)', marginTop: 8 }}>
                    {brushMode !== 'none'
                      ? `Brush active: Paint on the image to ${brushMode === 'remove' ? 'erase extra background' : 'restore foreground details'}.`
                      : rawAlphaMask
                      ? 'Checkerboard indicates transparent background.'
                      : 'Click "Remove Background" above to generate cutout.'}
                  </div>
                </div>
              </div>

              {/* Edge Refinement & Manual Touch-up */}
              {rawAlphaMask && (
                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Edge Refinement & Polish</span>
                  </div>

                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                    {/* Feather & Smooth sliders */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)', alignItems: 'center' }}>
                      <div className="field" style={{ margin: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <label className="field-label" style={{ margin: 0 }}>Edge Feather</label>
                          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{feather}px</span>
                        </div>
                        <input
                          type="range"
                          className="slider"
                          min={0}
                          max={6}
                          step={0.5}
                          value={feather}
                          onChange={e => setFeather(parseFloat(e.target.value))}
                        />
                      </div>

                      <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontSize: 12, cursor: 'pointer', marginTop: 14 }}>
                        <input
                          type="checkbox"
                          checked={smoothEdges}
                          onChange={e => setSmoothEdges(e.target.checked)}
                        />
                        <span>Smooth Anti-Aliasing</span>
                      </label>
                    </div>

                    {/* Touch-up Brush Controls */}
                    <div style={{ borderTop: '1px solid var(--c-border-subtle)', paddingTop: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-primary)' }}>
                          Manual Touch-Up Brush
                        </span>
                        {manualAlphaMask && (
                          <button className="btn btn-ghost btn-sm" onClick={resetManualTouchUps} style={{ height: 24, fontSize: 11 }}>
                            Reset Edits
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
                        <button
                          className={`btn btn-sm ${brushMode === 'remove' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setBrushMode(brushMode === 'remove' ? 'none' : 'remove')}
                          style={brushMode === 'remove' ? { background: '#EF4444', borderColor: '#EF4444' } : undefined}
                        >
                          − Erase Background
                        </button>
                        <button
                          className={`btn btn-sm ${brushMode === 'restore' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setBrushMode(brushMode === 'restore' ? 'none' : 'restore')}
                          style={brushMode === 'restore' ? { background: '#10B981', borderColor: '#10B981' } : undefined}
                        >
                          + Restore Subject
                        </button>
                        {brushMode !== 'none' && (
                          <button className="btn btn-ghost btn-sm" onClick={() => setBrushMode('none')}>
                            Done
                          </button>
                        )}
                      </div>

                      {brushMode !== 'none' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                          <span style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>Brush Size:</span>
                          <input
                            type="range"
                            className="slider"
                            min={10}
                            max={100}
                            value={brushSize}
                            onChange={e => setBrushSize(parseInt(e.target.value))}
                            style={{ flex: 1 }}
                          />
                          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', minWidth: 28 }}>
                            {brushSize}px
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {rawAlphaMask && (
                <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                  <button
                    className="btn btn-primary btn-full btn-lg"
                    onClick={handleApply}
                    disabled={!processedBytes}
                    id="bg-remover-apply-btn"
                    style={{ flex: 2 }}
                  >
                    Apply to Figma Layer
                  </button>

                  <button
                    className="btn btn-secondary btn-lg"
                    onClick={handleDownload}
                    disabled={!processedBytes}
                    style={{ flex: 1 }}
                    title="Download transparent PNG to your computer"
                  >
                    Download PNG
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default BackgroundRemover
