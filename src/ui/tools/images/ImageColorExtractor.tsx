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

      <div className="tool-body" style={{ flex: 1, overflow: 'hidden', padding: 0 }}>
        {/* Hidden canvas for pixel processing */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        <div className="tool-split-view" style={{ height: '100%' }}>
          {/* Left Pane: Selection & Extraction Settings & Pinned CTAs */}
          <div className="tool-pane-left" style={{ width: 310, display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <SelectionBanner
              selection={selection}
              requiresSelection={true}
              selectionHint="Select an image or frame with image fill in Figma."
            />

            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div className="card-header">
                <span className="card-title">Extractor Settings</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', flex: 1 }}>
                <div className="field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-1)' }}>
                    <label className="field-label" style={{ margin: 0 }}>Number of Colors</label>
                    <span style={{ fontSize: 'var(--fs-xs)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{colorCount}</span>
                  </div>
                  <input
                    type="range"
                    className="slider"
                    style={{ width: '100%' }}
                    min={2}
                    max={12}
                    step={1}
                    value={colorCount}
                    onChange={e => setColorCount(parseInt(e.target.value))}
                    id="image-color-count-slider"
                  />
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

                {/* Pinned Action Buttons */}
                <div style={{ marginTop: 'auto', paddingTop: 'var(--sp-3)', borderTop: '1px solid var(--c-border-subtle)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleExtract}
                    disabled={extracting || !selection || selection.count === 0}
                    id="image-extract-btn"
                    style={{ width: '100%', height: 36 }}
                  >
                    {extracting ? 'Extracting…' : 'Extract Dominant Colors'}
                  </button>

                  {colors.length > 0 && (
                    <button
                      className="btn btn-secondary"
                      onClick={handleCreateStyles}
                      id="image-create-styles-btn"
                      style={{ width: '100%', height: 34 }}
                    >
                      Create Figma Color Styles ({colors.length})
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Pane: Extracted Palette List */}
          <div className="tool-pane-right" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="card-title">
                  {colors.length > 0 ? `Extracted Palette (${colors.length})` : 'Color Swatches'}
                </span>
                {colors.length > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>
                    Click swatch to copy hex
                  </span>
                )}
              </div>

              <div className="card-body tool-scroll-list" style={{ flex: 1, padding: 'var(--sp-2)' }}>
                {colors.length === 0 ? (
                  <div style={{ padding: 'var(--sp-8)', textAlign: 'center', color: 'var(--c-text-tertiary)', fontSize: 'var(--fs-sm)' }}>
                    Select an image layer and click "Extract Dominant Colors" to generate palette swatches.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                    {colors.map((hex, i) => {
                      const useWhite = shouldUseWhiteText(hex)
                      return (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            gap: 'var(--sp-3)',
                            alignItems: 'center',
                            padding: 'var(--sp-2) var(--sp-3)',
                            background: 'var(--c-surface)',
                            border: '1px solid var(--c-border-subtle)',
                            borderRadius: 'var(--r-md)',
                          }}
                        >
                          {/* Large swatch */}
                          <div
                            style={{
                              width: 48,
                              height: 34,
                              background: hex,
                              borderRadius: 'var(--r-sm)',
                              border: '1px solid rgba(0,0,0,0.1)',
                              flexShrink: 0,
                              cursor: 'pointer',
                            }}
                            onClick={() => handleCopy(hex)}
                            title={`Click to copy ${hex}`}
                          />

                          {/* Info */}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--c-text-primary)' }}>
                              {hex.toUpperCase()}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>
                              {groupName}/{i + 1}
                            </div>
                          </div>

                          {/* Actions */}
                          <div style={{ display: 'flex', gap: 'var(--sp-1)' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleCopy(hex)} style={{ height: 26, padding: '0 8px', fontSize: 11 }}>
                              Copy
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleApply(hex)} style={{ height: 26, padding: '0 8px', fontSize: 11 }}>
                              Apply
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImageColorExtractor
