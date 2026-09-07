import React, { useState, useEffect, useRef } from 'react'
import { extractDominantColors, shouldUseWhiteText } from '../../utils/color'
import { sendToPlugin } from '../../utils/messaging'
import type { SelectionInfo, ImageBytesPayload } from '../../../shared/types'
import { SelectionBanner } from '../../components/Selection/SelectionBanner'

interface Props {
  selection: SelectionInfo | null
  imageBytes: ImageBytesPayload | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

export const ImageColorExtractor: React.FC<Props> = ({
  selection,
  imageBytes,
  onSuccess,
  onError,
}) => {
  const [colors, setColors] = useState<string[]>([])
  const [colorCount, setColorCount] = useState(6)
  const [extracting, setExtracting] = useState(false)
  const [groupName, setGroupName] = useState('Image')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Process image bytes when they arrive from plugin
  useEffect(() => {
    if (!imageBytes || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    setExtracting(true)

    // Load PNG bytes into an Image then draw to canvas
    const blob = new Blob([new Uint8Array(imageBytes.bytes)], { type: 'image/png' })
    const url = URL.createObjectURL(blob)
    const img = new Image()

    img.onload = () => {
      // Scale down for performance
      const maxDim = 200
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1)
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const dominant = extractDominantColors(imageData.data, colorCount)
      setColors(dominant)
      URL.revokeObjectURL(url)
      setExtracting(false)
    }

    img.onerror = () => {
      onError('Could not decode image data.')
      URL.revokeObjectURL(url)
      setExtracting(false)
    }

    img.src = url
  }, [imageBytes, colorCount])

  const handleExtract = () => {
    if (!selection || selection.count === 0) {
      onError('Select an image layer in Figma first.')
      return
    }
    sendToPlugin({ type: 'GET_IMAGE_BYTES' })
  }

  const handleCopy = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex)
      onSuccess(`Copied ${hex}`)
    } catch {
      onError('Failed to copy')
    }
  }

  const handleCreateStyles = () => {
    if (colors.length === 0) return
    sendToPlugin({
      type: 'CREATE_COLOR_STYLES',
      payload: colors.map((hex, i) => ({
        name: String(i + 1),
        hex,
        groupName,
      })),
    })
  }

  const handleApply = (hex: string) => {
    if (!selection || selection.count === 0) {
      onError('Select a layer to apply color to.')
      return
    }
    sendToPlugin({ type: 'APPLY_COLOR_TO_SELECTION', payload: { hex } })
  }

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Images</div>
        <h1 className="tool-title">Image Color Extractor</h1>
        <p className="tool-description">
          Extract dominant colors from a selected image layer using local pixel analysis.
        </p>
      </div>

      <div className="tool-body">
        {/* Hidden canvas for pixel processing */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        <SelectionBanner
          selection={selection}
          requiresSelection={true}
          selectionHint="Select an image layer (or any layer with an image fill) in Figma."
        />

        {/* Controls */}
        <div className="card">
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <div className="two-col">
              <div className="field">
                <label className="field-label">Number of Colors</label>
                <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
                  <input
                    type="range"
                    className="slider"
                    style={{ flex: 1 }}
                    min={2}
                    max={12}
                    step={1}
                    value={colorCount}
                    onChange={e => setColorCount(parseInt(e.target.value))}
                    id="image-color-count-slider"
                  />
                  <span className="slider-value">{colorCount}</span>
                </div>
              </div>

              <div className="field">
                <label className="field-label">Style Group Name</label>
                <input
                  className="input"
                  type="text"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="Image"
                />
              </div>
            </div>

            <button
              className={`btn btn-primary ${extracting ? '' : ''}`}
              onClick={handleExtract}
              disabled={extracting || !selection || selection.count === 0}
              id="image-extract-btn"
            >
              {extracting ? 'Extracting…' : 'Extract Colors'}
            </button>
          </div>
        </div>

        {/* Results */}
        {colors.length > 0 && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Dominant Colors</span>
              <button className="btn btn-secondary btn-sm" onClick={handleCreateStyles} id="image-create-styles-btn">
                Create Styles
              </button>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              {colors.map((hex, i) => {
                const useWhite = shouldUseWhiteText(hex)
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: 'var(--sp-3)',
                      alignItems: 'center',
                    }}
                  >
                    {/* Large swatch */}
                    <div
                      style={{
                        width: 52,
                        height: 36,
                        background: hex,
                        borderRadius: 'var(--r-md)',
                        border: '1px solid rgba(0,0,0,0.06)',
                        flexShrink: 0,
                        cursor: 'pointer',
                      }}
                      onClick={() => handleCopy(hex)}
                      title={`Click to copy ${hex}`}
                    />

                    {/* Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--c-text-primary)' }}>
                        {hex.toUpperCase()}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>
                        Color {i + 1}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="btn-row">
                      <button className="btn btn-ghost btn-sm" onClick={() => handleCopy(hex)}>
                        Copy
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleApply(hex)}>
                        Apply
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ImageColorExtractor
