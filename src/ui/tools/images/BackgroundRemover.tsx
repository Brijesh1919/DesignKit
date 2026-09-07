import React, { useState, useRef, useEffect, useCallback } from 'react'
import { isValidHex, normalizeHex, hexToRgb } from '../../utils/color'
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

type MainMode = 'quick' | 'smart' | 'ai'

// Quick Remove Types
type RemovalMethod = 'auto' | 'pick' | 'edge'
type BgMode = 'white' | 'black' | 'custom'
type QuickBrushMode = 'none' | 'remove' | 'restore'

// Smart Cutout Types
type SmartBrush = 'fg' | 'bg'
type SmartPreview = 'cutout' | 'original' | 'mask'

// AI Remove Types
type AIPreview = 'cutout' | 'original' | 'mask' | 'raw'
type AIBrushMode = 'none' | 'remove' | 'restore'

// -------------------------------------------------------
// Color Math & Perceptual Distance (Redmean)
// -------------------------------------------------------
function redmeanDistance(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number
): number {
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  const rmean = (r1 + r2) / 2
  return Math.sqrt(
    (2 + rmean / 256) * dr * dr +
    4 * dg * dg +
    (2 + (255 - rmean) / 256) * db * db
  )
}

const MAX_REDMEAN_DIST = 764.83

function toleranceToRedmeanThreshold(uiTolerance: number): number {
  const t = uiTolerance / 100
  return Math.pow(t, 1.35) * MAX_REDMEAN_DIST
}

// -------------------------------------------------------
// Auto-detect dominant edge background color (Quick Remove)
// -------------------------------------------------------
interface AutoDetectResult {
  hex: string
  rgb: { r: number; g: number; b: number }
  confidence: 'High' | 'Medium' | 'Low'
  variance: number
}

function detectEdgeBackground(imageData: ImageData): AutoDetectResult {
  const { width, height, data } = imageData
  const samples: { r: number; g: number; b: number }[] = []

  const samplePixel = (x: number, y: number) => {
    const i = (y * width + x) * 4
    if (data[i + 3] > 128) {
      samples.push({ r: data[i], g: data[i + 1], b: data[i + 2] })
    }
  }

  samplePixel(0, 0)
  samplePixel(width - 1, 0)
  samplePixel(0, height - 1)
  samplePixel(width - 1, height - 1)

  const stepX = Math.max(1, Math.floor(width / 20))
  for (let x = 0; x < width; x += stepX) {
    samplePixel(x, 0)
    samplePixel(x, height - 1)
  }

  const stepY = Math.max(1, Math.floor(height / 20))
  for (let y = 0; y < height; y += stepY) {
    samplePixel(0, y)
    samplePixel(width - 1, y)
  }

  if (samples.length === 0) {
    return { hex: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 }, confidence: 'Low', variance: 100 }
  }

  let sumR = 0, sumG = 0, sumB = 0
  for (const s of samples) {
    sumR += s.r; sumG += s.g; sumB += s.b
  }
  const avgR = Math.round(sumR / samples.length)
  const avgG = Math.round(sumG / samples.length)
  const avgB = Math.round(sumB / samples.length)

  let totalDist = 0
  for (const s of samples) {
    totalDist += redmeanDistance(s.r, s.g, s.b, avgR, avgG, avgB)
  }
  const avgDist = totalDist / samples.length

  let confidence: 'High' | 'Medium' | 'Low' = 'High'
  if (avgDist > 65) confidence = 'Low'
  else if (avgDist > 32) confidence = 'Medium'

  const toHex = (v: number) => v.toString(16).padStart(2, '0')
  const hex = `#${toHex(avgR)}${toHex(avgG)}${toHex(avgB)}`.toUpperCase()

  return { hex, rgb: { r: avgR, g: avgG, b: avgB }, confidence, variance: avgDist }
}

// -------------------------------------------------------
// Quick Remove Alpha Mask Generator
// -------------------------------------------------------
function generateQuickAlphaMask(
  imageData: ImageData,
  bgR: number, bgG: number, bgB: number,
  threshold: number,
  edgeConnectedOnly: boolean
): Uint8Array {
  const { width, height, data } = imageData
  const totalPixels = width * height
  const alphaMask = new Uint8Array(totalPixels)
  alphaMask.fill(255)

  if (edgeConnectedOnly) {
    const visited = new Uint8Array(totalPixels)
    const queue: number[] = []

    const checkAndPush = (idx: number) => {
      if (!visited[idx]) {
        visited[idx] = 1
        const p = idx * 4
        if (redmeanDistance(data[p], data[p + 1], data[p + 2], bgR, bgG, bgB) <= threshold) {
          queue.push(idx)
        }
      }
    }

    for (let x = 0; x < width; x++) {
      checkAndPush(x)
      checkAndPush((height - 1) * width + x)
    }
    for (let y = 0; y < height; y++) {
      checkAndPush(y * width)
      checkAndPush(y * width + (width - 1))
    }

    let head = 0
    while (head < queue.length) {
      const idx = queue[head++]
      alphaMask[idx] = 0

      const x = idx % width
      const y = Math.floor(idx / width)

      if (y > 0)          checkAndPush(idx - width)
      if (y < height - 1) checkAndPush(idx + width)
      if (x > 0)          checkAndPush(idx - 1)
      if (x < width - 1)  checkAndPush(idx + 1)
    }
  } else {
    for (let idx = 0; idx < totalPixels; idx++) {
      const p = idx * 4
      if (redmeanDistance(data[p], data[p + 1], data[p + 2], bgR, bgG, bgB) <= threshold) {
        alphaMask[idx] = 0
      }
    }
  }

  return alphaMask
}

// -------------------------------------------------------
// Alpha Edge Polish (Smoothing & Feathering)
// -------------------------------------------------------
function processAlphaEdges(
  alphaMask: Uint8Array,
  width: number,
  height: number,
  smoothEdges: boolean,
  featherPx: number
): Uint8Array {
  let result = new Uint8Array(alphaMask)

  if (smoothEdges) {
    const smoothed = new Uint8Array(result)
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x
        const val = result[idx]

        const n1 = result[idx - width]
        const n2 = result[idx + width]
        const n3 = result[idx - 1]
        const n4 = result[idx + 1]

        if (
          (val > 0 && (n1 === 0 || n2 === 0 || n3 === 0 || n4 === 0)) ||
          (val === 0 && (n1 > 0 || n2 > 0 || n3 > 0 || n4 > 0))
        ) {
          const avg = (
            result[idx - width - 1] + result[idx - width] + result[idx - width + 1] +
            result[idx - 1] + val + result[idx + 1] +
            result[idx + width - 1] + result[idx + width] + result[idx + width + 1]
          ) / 9
          smoothed[idx] = Math.round(avg)
        }
      }
    }
    result = smoothed
  }

  if (featherPx > 0) {
    const radius = Math.min(5, Math.max(1, Math.round(featherPx)))
    const feathered = new Uint8Array(result)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0
        let count = 0
        for (let dy = -radius; dy <= radius; dy++) {
          const py = y + dy
          if (py >= 0 && py < height) {
            for (let dx = -radius; dx <= radius; dx++) {
              const px = x + dx
              if (px >= 0 && px < width) {
                sum += result[py * width + px]
                count++
              }
            }
          }
        }
        feathered[y * width + x] = Math.round(sum / count)
      }
    }
    result = feathered
  }

  return result
}

// ============================================================
// PIXEL-PERFECT AUTOMATIC SEGMENTATION & DESPECKLE ENGINE
// ============================================================

const BGD = 0
const FGD = 1
const PR_BGD = 2
const PR_FGD = 3

function runSmartSegmentationEngine(
  procData: ImageData,
  userLabels: Uint8Array
): { labels: Uint8Array; fgProbGrid: Float32Array; fgColors: { r: number; g: number; b: number }[]; bgColors: { r: number; g: number; b: number }[] } {
  const { width: w, height: h, data } = procData
  const n = w * h
  const labels = new Uint8Array(n)
  const fgProbGrid = new Float32Array(n)

  // 1. Extract FG and BG seed colors
  const fgSeeds: number[] = []
  const bgSeeds: number[] = []
  const fgColors: { r: number; g: number; b: number }[] = []
  const bgColors: { r: number; g: number; b: number }[] = []

  for (let i = 0; i < n; i++) {
    const p = i * 4
    if (userLabels[i] === 1) {
      fgSeeds.push(i)
      fgColors.push({ r: data[p], g: data[p + 1], b: data[p + 2] })
    } else if (userLabels[i] === 2) {
      bgSeeds.push(i)
      bgColors.push({ r: data[p], g: data[p + 1], b: data[p + 2] })
    }
  }

  // Auto-detect border background if no strokes exist
  if (fgSeeds.length === 0 && bgSeeds.length === 0) {
    const marginX = Math.floor(w * 0.12)
    const marginY = Math.floor(h * 0.12)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x
        if (x < marginX || x >= w - marginX || y < marginY || y >= h - marginY) {
          labels[idx] = PR_BGD
          fgProbGrid[idx] = 0.0
        } else {
          labels[idx] = PR_FGD
          fgProbGrid[idx] = 1.0
        }
      }
    }
    return { labels, fgProbGrid, fgColors, bgColors }
  }

  const minDistToColors = (r: number, g: number, b: number, seeds: { r: number; g: number; b: number }[]) => {
    if (seeds.length === 0) return Infinity
    let minD = Infinity
    for (const s of seeds) {
      const d = redmeanDistance(r, g, b, s.r, s.g, s.b)
      if (d < minD) minD = d
      if (minD < 5) break
    }
    return minD
  }

  // 2. Region Growing BFS for Foreground
  const visitedFG = new Uint8Array(n)
  const queueFG: number[] = []

  for (const idx of fgSeeds) {
    visitedFG[idx] = 1
    queueFG.push(idx)
  }

  let headFG = 0
  while (headFG < queueFG.length) {
    const u = queueFG[headFG++]
    const ux = u % w
    const uy = Math.floor(u / w)
    const up = u * 4
    const uR = data[up], uG = data[up + 1], uB = data[up + 2]

    const neighbors = [
      ux > 0 ? u - 1 : -1,
      ux < w - 1 ? u + 1 : -1,
      uy > 0 ? u - w : -1,
      uy < h - 1 ? u + w : -1,
    ]

    for (const v of neighbors) {
      if (v >= 0 && !visitedFG[v] && userLabels[v] !== 2) {
        const vp = v * 4
        const vR = data[vp], vG = data[vp + 1], vB = data[vp + 2]
        const stepDist = redmeanDistance(uR, uG, uB, vR, vG, vB)
        const seedDist = minDistToColors(vR, vG, vB, fgColors)

        if (stepDist < 70 || seedDist < 100) {
          visitedFG[v] = 1
          queueFG.push(v)
        }
      }
    }
  }

  // 3. Region Growing BFS for Background
  const visitedBG = new Uint8Array(n)
  const queueBG: number[] = []

  for (const idx of bgSeeds) {
    visitedBG[idx] = 1
    queueBG.push(idx)
  }

  let headBG = 0
  while (headBG < queueBG.length) {
    const u = queueBG[headBG++]
    const ux = u % w
    const uy = Math.floor(u / w)
    const up = u * 4
    const uR = data[up], uG = data[up + 1], uB = data[up + 2]

    const neighbors = [
      ux > 0 ? u - 1 : -1,
      ux < w - 1 ? u + 1 : -1,
      uy > 0 ? u - w : -1,
      uy < h - 1 ? u + w : -1,
    ]

    for (const v of neighbors) {
      if (v >= 0 && !visitedBG[v] && userLabels[v] !== 1) {
        const vp = v * 4
        const vR = data[vp], vG = data[vp + 1], vB = data[vp + 2]
        const stepDist = redmeanDistance(uR, uG, uB, vR, vG, vB)
        const seedDist = minDistToColors(vR, vG, vB, bgColors)

        if (stepDist < 70 || seedDist < 100) {
          visitedBG[v] = 1
          queueBG.push(v)
        }
      }
    }
  }

  // 4. Grid Labeling & Continuous Probability Assignment
  for (let i = 0; i < n; i++) {
    const p = i * 4
    const r = data[p], g = data[p + 1], b = data[p + 2]

    if (userLabels[i] === 1) {
      labels[i] = FGD; fgProbGrid[i] = 1.0
    } else if (userLabels[i] === 2) {
      labels[i] = BGD; fgProbGrid[i] = 0.0
    } else if (visitedFG[i] && !visitedBG[i]) {
      labels[i] = PR_FGD; fgProbGrid[i] = 1.0
    } else if (visitedBG[i] && !visitedFG[i]) {
      labels[i] = PR_BGD; fgProbGrid[i] = 0.0
    } else {
      const dFG = minDistToColors(r, g, b, fgColors)
      const dBG = minDistToColors(r, g, b, bgColors)

      if (dFG < dBG) {
        labels[i] = PR_FGD; fgProbGrid[i] = 1.0
      } else {
        labels[i] = PR_BGD; fgProbGrid[i] = 0.0
      }
    }
  }

  return { labels, fgProbGrid, fgColors, bgColors }
}

// -------------------------------------------------------
// Main Component
// -------------------------------------------------------
export const BackgroundRemover: React.FC<Props> = ({
  selection,
  imageBytes,
  onSuccess,
  onError,
}) => {
  const [mainMode, setMainMode] = useState<MainMode>('quick')

  // ---- QUICK REMOVE STATE ----
  const [method, setMethod] = useState<RemovalMethod>('auto')
  const [bgMode, setBgMode] = useState<BgMode>('white')
  const [customBg, setCustomBg] = useState('#FFFFFF')
  const [detectedResult, setDetectedResult] = useState<AutoDetectResult | null>(null)
  const [quickTolerance, setQuickTolerance] = useState(32)
  const [edgeConnectedOnly, setEdgeConnectedOnly] = useState(true)
  const [quickBrushMode, setQuickBrushMode] = useState<QuickBrushMode>('none')
  const [quickBrushSize, setQuickBrushSize] = useState(30)
  const [quickManualMask, setQuickManualMask] = useState<Uint8Array | null>(null)

  // ---- SMART CUTOUT STATE ----
  const [smartBrush, setSmartBrush] = useState<SmartBrush>('fg')
  const [smartBrushSize, setSmartBrushSize] = useState(30)
  const [smartPreview, setSmartPreview] = useState<SmartPreview>('cutout')
  const [userStrokeMask, setUserStrokeMask] = useState<Uint8Array | null>(null)
  const [smartAlphaMask, setSmartAlphaMask] = useState<Uint8Array | null>(null)
  const [smartNotice, setSmartNotice] = useState<string | null>(null)
  const [isSegmenting, setIsSegmenting] = useState(false)
  const [seedStats, setSeedStats] = useState<{ fg: number; bg: number } | null>(null)

  // ---- AI REMOVE STATE ----
  const [aiPreview, setAiPreview] = useState<AIPreview>('cutout')
  const [aiStatus, setAiStatus] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [isInferenceError, setIsInferenceError] = useState(false)
  const [aiRuntime, setAiRuntime] = useState<AIRuntimeBackend | null>(null)
  const [aiRawAlphaMask, setAiRawAlphaMask] = useState<Float32Array | null>(null)
  const [aiManualMask, setAiManualMask] = useState<Float32Array | null>(null)
  const [aiBrushMode, setAiBrushMode] = useState<AIBrushMode>('none')
  const [aiBrushSize, setAiBrushSize] = useState(30)
  const [isProcessingAI, setIsProcessingAI] = useState(false)

  // Shared Polish Sliders (neutral defaults for pure soft model mask)
  const [smoothEdges, setSmoothEdges] = useState(false)
  const [feather, setFeather] = useState(0)

  // Image & Canvas Caches
  const [originalImageData, setOriginalImageData] = useState<ImageData | null>(null)
  const [processedBytes, setProcessedBytes] = useState<number[] | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const isMouseDownRef = useRef(false)

  // Decode & cache original image when imageBytes arrives
  useEffect(() => {
    if (!imageBytes) return
    setProcessedBytes(null)
    setQuickManualMask(null)
    setUserStrokeMask(null)
    setSmartAlphaMask(null)
    setSmartNotice(null)
    setSeedStats(null)
    setAiRawAlphaMask(null)
    setAiManualMask(null)
    setAiStatus(null)
    setAiError(null)

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
      setQuickManualMask(new Uint8Array(img.width * img.height))
      setUserStrokeMask(new Uint8Array(img.width * img.height))

      const detected = detectEdgeBackground(imgData)
      setDetectedResult(detected)
    }
    img.src = url

    return () => URL.revokeObjectURL(url)
  }, [imageBytes])

  const getQuickBgRgb = useCallback((): { r: number; g: number; b: number } => {
    if (method === 'auto') return detectedResult?.rgb ?? { r: 255, g: 255, b: 255 }
    if (bgMode === 'white') return { r: 255, g: 255, b: 255 }
    if (bgMode === 'black') return { r: 0, g: 0, b: 0 }
    const rgb = hexToRgb(customBg)
    return rgb ?? { r: 255, g: 255, b: 255 }
  }, [method, bgMode, customBg, detectedResult])

  // Run Local AI Removal
  const runAIRemoval = useCallback(async () => {
    if (!originalImageData) return

    setIsProcessingAI(true)
    setAiError(null)

    try {
      if (!BackgroundAI.isReady()) {
        setAiStatus('Initializing AI...')
        await BackgroundAI.initialize(status => setAiStatus(status))
      }

      setAiRuntime(BackgroundAI.getRuntime())
      setAiStatus('Running AI segmentation...')

      const result = await BackgroundAI.removeBackground(originalImageData, status => setAiStatus(status))
      setAiRawAlphaMask(result.alphaMask)
      setAiManualMask(new Float32Array(result.alphaMask))
      setAiStatus('✓ AI model ready')
    } catch (err) {
      console.error('[AI] Background removal error:', err)
      const isInfErr = Boolean((err as any)?.isInferenceError || BackgroundAI.isReady())
      setIsInferenceError(isInfErr)
      const message = err instanceof Error ? err.message : 'AI background removal failed.'
      setAiError(message)
      setAiStatus(null)
    } finally {
      setIsProcessingAI(false)
    }
  }, [originalImageData])

  // Diagnostic testing with small images (160x160 / 320x320 scaled to 320x320 tensor)
  const runDiagnosticTest = async (size: 160 | 320) => {
    setIsProcessingAI(true)
    setAiError(null)
    setAiStatus(`Running ${size}x${size} diagnostic test...`)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, size, size)
        ctx.fillStyle = '#FF5500'
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size / 3, 0, Math.PI * 2)
        ctx.fill()
      }
      const testImageData = ctx ? ctx.getImageData(0, 0, size, size) : null
      canvas.width = 0
      canvas.height = 0

      if (testImageData) {
        console.log(`[AI] Running diagnostic test on ${size}x${size} image...`)
        const result = await BackgroundAI.removeBackground(testImageData, status => setAiStatus(status))
        console.log(`[AI] Diagnostic test for ${size}x${size} SUCCEEDED! Mask length: ${result.alphaMask.length}`)
        setAiStatus(`✓ ${size}x${size} diagnostic test passed!`)
      }
    } catch (err: any) {
      console.error(`[AI] Diagnostic test for ${size}x${size} failed:`, err)
      setAiError(err?.message || `Diagnostic failed for ${size}x${size}`)
      setAiStatus(null)
    } finally {
      setIsProcessingAI(false)
    }
  }

  // Handle local model file selection.
  // initializeWithBuffer() automatically saves the buffer to IndexedDB,
  // so all subsequent plugin sessions will auto-load without this picker.
  const handleModelFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsProcessingAI(true)
    setAiError(null)
    setAiStatus(`Reading ${file.name} (${(file.size / (1024 * 1024)).toFixed(0)} MB)...`)

    try {
      let buffer: ArrayBuffer | null = await file.arrayBuffer()
      setAiStatus('Saving model to local cache & initializing ONNX Runtime...')
      await BackgroundAI.initializeWithBuffer(buffer, status => setAiStatus(status))
      // Release buffer reference immediately to free JS heap memory
      buffer = null
      e.target.value = ''

      setAiRuntime(BackgroundAI.getRuntime())
      setAiStatus('✓ AI model ready — future sessions will load automatically')

      if (originalImageData) {
        setAiStatus('Running AI segmentation...')
        const result = await BackgroundAI.removeBackground(originalImageData, status => setAiStatus(status))
        setAiRawAlphaMask(result.alphaMask)
        setAiManualMask(new Float32Array(result.alphaMask))
        setAiStatus('✓ AI model ready')
      }
    } catch (err) {
      console.error('[AI] Local model file load error:', err)
      const message = err instanceof Error ? err.message : 'Failed to load model file.'
      setAiError(message)
      setAiStatus(null)
    } finally {
      setIsProcessingAI(false)
    }
  }

  // Automatically trigger AI removal when switching to AI Remove mode if no result exists
  useEffect(() => {
    if (mainMode === 'ai' && originalImageData && !aiRawAlphaMask && !isProcessingAI && !aiError) {
      runAIRemoval()
    }
  }, [mainMode, originalImageData, aiRawAlphaMask, isProcessingAI, aiError, runAIRemoval])

  // Run Pixel-Perfect Smart Segmentation & Despeckle Engine
  const runSmartCutoutSegmentation = useCallback((overrideStrokes?: Uint8Array) => {
    if (!originalImageData) return

    setIsSegmenting(true)
    setSmartNotice(null)

    setTimeout(() => {
      try {
        const { width: origW, height: origH, data: origData } = originalImageData

        const strokeMask = overrideStrokes ?? userStrokeMask ?? new Uint8Array(origW * origH)
        let fgSeeds = 0, bgSeeds = 0
        for (let i = 0; i < origW * origH; i++) {
          if (strokeMask[i] === 1) fgSeeds++
          else if (strokeMask[i] === 2) bgSeeds++
        }
        setSeedStats({ fg: fgSeeds, bg: bgSeeds })

        const maxProcDim = 400
        const scale = Math.min(maxProcDim / origW, maxProcDim / origH, 1)
        const procW = Math.max(16, Math.round(origW * scale))
        const procH = Math.max(16, Math.round(origH * scale))

        const procCanvas = document.createElement('canvas')
        procCanvas.width = procW
        procCanvas.height = procH
        const procCtx = procCanvas.getContext('2d')!

        const origCanvas = document.createElement('canvas')
        origCanvas.width = origW
        origCanvas.height = origH
        const origCtx = origCanvas.getContext('2d')!
        origCtx.putImageData(originalImageData, 0, 0)

        procCtx.drawImage(origCanvas, 0, 0, procW, procH)
        const procImageData = procCtx.getImageData(0, 0, procW, procH)

        const procUserStrokes = new Uint8Array(procW * procH)
        for (let py = 0; py < procH; py++) {
          const oy = Math.min(origH - 1, Math.floor(py / scale))
          for (let px = 0; px < procW; px++) {
            const ox = Math.min(origW - 1, Math.floor(px / scale))
            procUserStrokes[py * procW + px] = strokeMask[oy * origW + ox]
          }
        }

        const { fgProbGrid, fgColors, bgColors } = runSmartSegmentationEngine(procImageData, procUserStrokes)

        const rawAlphaMask = new Uint8Array(origW * origH)

        const getGridProb = (gx: number, gy: number) => {
          const cx = Math.max(0, Math.min(procW - 1, gx))
          const cy = Math.max(0, Math.min(procH - 1, gy))
          return fgProbGrid[cy * procW + cx]
        }

        for (let oy = 0; oy < origH; oy++) {
          const gy = oy * scale
          const gY0 = Math.floor(gy)
          const gY1 = Math.min(procH - 1, gY0 + 1)
          const fy = gy - gY0

          for (let ox = 0; ox < origW; ox++) {
            const origIdx = oy * origW + ox

            if (strokeMask[origIdx] === 1) {
              rawAlphaMask[origIdx] = 255
            } else if (strokeMask[origIdx] === 2) {
              rawAlphaMask[origIdx] = 0
            } else {
              const gx = ox * scale
              const gX0 = Math.floor(gx)
              const gX1 = Math.min(procW - 1, gX0 + 1)
              const fx = gx - gX0

              const p00 = getGridProb(gX0, gY0)
              const p10 = getGridProb(gX1, gY0)
              const p01 = getGridProb(gX0, gY1)
              const p11 = getGridProb(gX1, gY1)

              const interpProb = (1 - fx) * (1 - fy) * p00 +
                                 fx * (1 - fy) * p10 +
                                 (1 - fx) * fy * p01 +
                                 fx * fy * p11

              rawAlphaMask[origIdx] = interpProb >= 0.5 ? 255 : 0
            }
          }
        }

        const cleanAlphaMask = new Uint8Array(rawAlphaMask)

        for (let y = 1; y < origH - 1; y++) {
          for (let x = 1; x < origW - 1; x++) {
            const idx = y * origW + x
            if (strokeMask[idx] !== 0) continue

            const val = rawAlphaMask[idx]
            let fgNeighbors = 0
            let bgNeighbors = 0

            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue
                const nVal = rawAlphaMask[(y + dy) * origW + (x + dx)]
                if (nVal > 128) fgNeighbors++
                else bgNeighbors++
              }
            }

            if (val === 0 && fgNeighbors >= 5) {
              cleanAlphaMask[idx] = 255
            } else if (val === 255 && bgNeighbors >= 5) {
              cleanAlphaMask[idx] = 0
            }
          }
        }

        if (fgColors.length > 0 && bgColors.length > 0) {
          const minDist = (r: number, g: number, b: number, seeds: { r: number; g: number; b: number }[]) => {
            let minD = Infinity
            for (let k = 0; k < Math.min(30, seeds.length); k++) {
              const d = redmeanDistance(r, g, b, seeds[k].r, seeds[k].g, seeds[k].b)
              if (d < minD) minD = d
            }
            return minD
          }

          for (let y = 1; y < origH - 1; y++) {
            for (let x = 1; x < origW - 1; x++) {
              const idx = y * origW + x
              if (strokeMask[idx] !== 0) continue

              const val = cleanAlphaMask[idx]
              const n1 = cleanAlphaMask[idx - origW]
              const n2 = cleanAlphaMask[idx + origW]
              const n3 = cleanAlphaMask[idx - 1]
              const n4 = cleanAlphaMask[idx + 1]

              if (
                (val === 255 && (n1 === 0 || n2 === 0 || n3 === 0 || n4 === 0)) ||
                (val === 0 && (n1 === 255 || n2 === 255 || n3 === 255 || n4 === 255))
              ) {
                const p = idx * 4
                const r = origData[p], g = origData[p + 1], b = origData[p + 2]
                const dFG = minDist(r, g, b, fgColors)
                const dBG = minDist(r, g, b, bgColors)

                if (dBG < dFG - 20) {
                  cleanAlphaMask[idx] = 0
                } else if (dFG < dBG - 20) {
                  cleanAlphaMask[idx] = 255
                }
              }
            }
          }
        }

        setSmartAlphaMask(cleanAlphaMask)
      } catch (err) {
        console.error('[DesignKit] Smart Cutout error:', err)
        setSmartNotice('Cutout calculation error. Please add + Foreground strokes and click Refine.')
      } finally {
        setIsSegmenting(false)
      }
    }, 15)
  }, [originalImageData, userStrokeMask])

  useEffect(() => {
    if (mainMode === 'smart' && originalImageData && !smartAlphaMask && !isSegmenting) {
      runSmartCutoutSegmentation()
    }
  }, [mainMode, originalImageData, smartAlphaMask, isSegmenting, runSmartCutoutSegmentation])

  // Render Canvas Live Preview & Export Clean PNG Bytes
  const updatePreviewCanvas = useCallback(() => {
    if (!originalImageData || !previewCanvasRef.current) return

    const { width, height } = originalImageData
    const pCanvas = previewCanvasRef.current
    const pCtx = pCanvas.getContext('2d')!

    const maxDispWidth = 460
    const maxDispHeight = 240
    const scale = Math.min(maxDispWidth / width, maxDispHeight / height, 1)

    const dispW = Math.round(width * scale)
    const dispH = Math.round(height * scale)

    pCanvas.width = dispW
    pCanvas.height = dispH

    let processedMask: Uint8Array

    if (mainMode === 'quick') {
      const { r: bgR, g: bgG, b: bgB } = getQuickBgRgb()
      const threshold = toleranceToRedmeanThreshold(quickTolerance)
      const isEdgeConn = method === 'auto' || method === 'edge' || (method === 'pick' && edgeConnectedOnly)
      const rawMask = generateQuickAlphaMask(originalImageData, bgR, bgG, bgB, threshold, isEdgeConn)
      processedMask = processAlphaEdges(rawMask, width, height, smoothEdges, feather)
    } else if (mainMode === 'smart') {
      const rawMask = smartAlphaMask ?? new Uint8Array(width * height)
      processedMask = processAlphaEdges(rawMask, width, height, smoothEdges, feather)
    } else {
      // AI Remove Mode
      const baseMask = aiManualMask ?? aiRawAlphaMask ?? new Float32Array(width * height)
      const options: AIRefineOptions = { feather, smoothEdges }
      const floatMask = BackgroundAI.refineMask(baseMask, width, height, options)

      // Convert Float32Array (0.0..1.0) to Uint8Array (0..255)
      processedMask = new Uint8Array(width * height)
      for (let i = 0; i < width * height; i++) {
        processedMask[i] = Math.round(floatMask[i] * 255)
      }
    }

    // ALWAYS generate CLEAN CUTOUT Canvas (Original RGB + processed alpha mask) for PNG Export & Figma Apply
    const cleanCutoutCanvas = document.createElement('canvas')
    cleanCutoutCanvas.width = width
    cleanCutoutCanvas.height = height
    const cleanCtx = cleanCutoutCanvas.getContext('2d')!

    const outImageData = new ImageData(new Uint8ClampedArray(originalImageData.data), width, height)
    const outData = outImageData.data

    for (let i = 0; i < width * height; i++) {
      const p = i * 4
      if (mainMode === 'quick') {
        const manualVal = quickManualMask ? quickManualMask[i] : 0
        if (manualVal === 1) outData[p + 3] = 0
        else if (manualVal === 2) outData[p + 3] = originalImageData.data[p + 3]
        else outData[p + 3] = Math.min(originalImageData.data[p + 3], processedMask[i])
      } else {
        outData[p + 3] = Math.min(originalImageData.data[p + 3], processedMask[i])
      }
    }
    cleanCtx.putImageData(outImageData, 0, 0)

    // Export PNG Bytes for Apply Action
    cleanCutoutCanvas.toBlob(blob => {
      if (!blob) return
      blob.arrayBuffer().then(buf => {
        setProcessedBytes(Array.from(new Uint8Array(buf)))
      })
    }, 'image/png')

    // Render current preview mode on UI Canvas
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = width
    tempCanvas.height = height
    const tempCtx = tempCanvas.getContext('2d')!

    if (mainMode === 'quick') {
      tempCtx.drawImage(cleanCutoutCanvas, 0, 0)
    } else if (mainMode === 'smart') {
      if (smartPreview === 'original') {
        tempCtx.putImageData(originalImageData, 0, 0)
        if (userStrokeMask) {
          const strokeOverlay = tempCtx.createImageData(width, height)
          const sData = strokeOverlay.data
          for (let i = 0; i < width * height; i++) {
            const p = i * 4
            const sVal = userStrokeMask[i]
            if (sVal === 1) {
              sData[p] = 16; sData[p + 1] = 185; sData[p + 2] = 129; sData[p + 3] = 230
            } else if (sVal === 2) {
              sData[p] = 239; sData[p + 1] = 68; sData[p + 2] = 68; sData[p + 3] = 230
            }
          }
          const overlayCanvas = document.createElement('canvas')
          overlayCanvas.width = width; overlayCanvas.height = height
          overlayCanvas.getContext('2d')!.putImageData(strokeOverlay, 0, 0)
          tempCtx.drawImage(overlayCanvas, 0, 0)
        }
      } else if (smartPreview === 'mask') {
        const maskImgData = tempCtx.createImageData(width, height)
        const mData = maskImgData.data
        for (let i = 0; i < width * height; i++) {
          const p = i * 4
          const val = processedMask[i]
          mData[p] = val; mData[p + 1] = val; mData[p + 2] = val; mData[p + 3] = 255
        }
        tempCtx.putImageData(maskImgData, 0, 0)
      } else {
        tempCtx.drawImage(cleanCutoutCanvas, 0, 0)
      }
    } else {
      // AI Remove Mode Preview Switcher: [ Result ] [ Original ] [ Soft Mask ] [ Raw Model ]
      if (aiPreview === 'original') {
        tempCtx.putImageData(originalImageData, 0, 0)
      } else if (aiPreview === 'mask') {
        const maskImgData = tempCtx.createImageData(width, height)
        const mData = maskImgData.data
        for (let i = 0; i < width * height; i++) {
          const p = i * 4
          const val = processedMask[i]
          mData[p] = val; mData[p + 1] = val; mData[p + 2] = val; mData[p + 3] = 255
        }
        tempCtx.putImageData(maskImgData, 0, 0)
      } else if (aiPreview === 'raw') {
        const rawMask = aiRawAlphaMask ?? new Float32Array(width * height)
        const maskImgData = tempCtx.createImageData(width, height)
        const mData = maskImgData.data
        for (let i = 0; i < width * height; i++) {
          const p = i * 4
          const val = Math.round(Math.max(0, Math.min(1, rawMask[i])) * 255)
          mData[p] = val; mData[p + 1] = val; mData[p + 2] = val; mData[p + 3] = 255
        }
        tempCtx.putImageData(maskImgData, 0, 0)
      } else {
        tempCtx.drawImage(cleanCutoutCanvas, 0, 0)
      }
    }

    pCtx.clearRect(0, 0, dispW, dispH)
    pCtx.drawImage(tempCanvas, 0, 0, dispW, dispH)
  }, [
    originalImageData,
    mainMode,
    getQuickBgRgb,
    quickTolerance,
    method,
    edgeConnectedOnly,
    quickManualMask,
    smartAlphaMask,
    smartPreview,
    userStrokeMask,
    aiPreview,
    aiRawAlphaMask,
    aiManualMask,
    smoothEdges,
    feather,
  ])

  useEffect(() => {
    updatePreviewCanvas()
  }, [updatePreviewCanvas])

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
    if (!isMouseDownRef.current || !originalImageData) return

    const coords = getTransformedCoordinates(e)
    if (!coords) return

    const { imgX, imgY, scaleFactor } = coords
    const { width, height } = originalImageData

    if (mainMode === 'quick') {
      if (quickBrushMode === 'none' || !quickManualMask) return
      const radius = Math.max(2, Math.round((quickBrushSize / 2) * scaleFactor))
      const newMask = new Uint8Array(quickManualMask)
      const fillVal = quickBrushMode === 'remove' ? 1 : 2

      for (let dy = -radius; dy <= radius; dy++) {
        const py = imgY + dy
        if (py >= 0 && py < height) {
          for (let dx = -radius; dx <= radius; dx++) {
            const px = imgX + dx
            if (px >= 0 && px < width && dx * dx + dy * dy <= radius * radius) {
              newMask[py * width + px] = fillVal
            }
          }
        }
      }
      setQuickManualMask(newMask)
    } else if (mainMode === 'smart') {
      if (!userStrokeMask) return
      const radius = Math.max(2, Math.round((smartBrushSize / 2) * scaleFactor))
      const newStrokes = new Uint8Array(userStrokeMask)
      const strokeVal = smartBrush === 'fg' ? 1 : 2

      for (let dy = -radius; dy <= radius; dy++) {
        const py = imgY + dy
        if (py >= 0 && py < height) {
          for (let dx = -radius; dx <= radius; dx++) {
            const px = imgX + dx
            if (px >= 0 && px < width && dx * dx + dy * dy <= radius * radius) {
              newStrokes[py * width + px] = strokeVal
            }
          }
        }
      }
      setUserStrokeMask(newStrokes)
    } else if (mainMode === 'ai') {
      // AI Remove Manual Refinement (Remove / Restore brush on alpha mask)
      if (aiBrushMode === 'none' || !aiManualMask) return
      const radius = Math.max(2, Math.round((aiBrushSize / 2) * scaleFactor))
      const newMask = new Float32Array(aiManualMask)
      const baseRaw = aiRawAlphaMask ?? new Float32Array(width * height)

      for (let dy = -radius; dy <= radius; dy++) {
        const py = imgY + dy
        if (py >= 0 && py < height) {
          for (let dx = -radius; dx <= radius; dx++) {
            const px = imgX + dx
            if (px >= 0 && px < width && dx * dx + dy * dy <= radius * radius) {
              const idx = py * width + px
              if (aiBrushMode === 'remove') {
                newMask[idx] = 0.0
              } else if (aiBrushMode === 'restore') {
                newMask[idx] = baseRaw[idx] > 0 ? baseRaw[idx] : 1.0
              }
            }
          }
        }
      }
      setAiManualMask(newMask)
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isMouseDownRef.current = true
    handleBrushStroke(e)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isMouseDownRef.current) handleBrushStroke(e)
  }

  const handleMouseUp = () => {
    if (isMouseDownRef.current && mainMode === 'smart') {
      runSmartCutoutSegmentation()
    }
    isMouseDownRef.current = false
  }

  const clearSmartStrokes = () => {
    if (originalImageData) {
      const emptyStrokes = new Uint8Array(originalImageData.width * originalImageData.height)
      setUserStrokeMask(emptyStrokes)
      runSmartCutoutSegmentation(emptyStrokes)
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
      onError('No processed image ready. Load and edit an image first.')
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

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Images</div>
        <h1 className="tool-title">Background Remover</h1>
        <p className="tool-description">
          Remove backgrounds locally using Quick Color Removal, Smart Cutout, or Local AI Segmentation.
        </p>
      </div>

      <div className="tool-body">
        <SelectionBanner
          selection={selection}
          requiresSelection={true}
          selectionHint="Select an image layer in Figma to start."
        />

        {/* Load Image Card */}
        <div className="card">
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <button
              className="btn btn-secondary btn-full"
              onClick={handleLoad}
              disabled={!selection || selection.count === 0}
              id="bg-remover-load-btn"
            >
              Load Image from Selection
            </button>

            {previewUrl && (
              <div style={{ textAlign: 'center' }}>
                <img
                  src={previewUrl}
                  alt="Original image"
                  style={{
                    maxWidth: '100%',
                    maxHeight: 100,
                    borderRadius: 'var(--r-md)',
                    border: '1px solid var(--c-border)',
                    objectFit: 'contain',
                  }}
                />
                <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)', marginTop: 4 }}>
                  Original ({originalImageData?.width}×{originalImageData?.height}px)
                </div>
              </div>
            )}
          </div>
        </div>

        {/* MAIN MODE SELECTOR */}
        {originalImageData && (
          <>
            <div className="card">
              <div className="card-header">
                <span className="card-title">Removal Method</span>
              </div>
              <div className="card-body">
                <div className="tabs" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                  <button
                    className={`tab-btn${mainMode === 'quick' ? ' active' : ''}`}
                    onClick={() => setMainMode('quick')}
                    id="bg-main-mode-quick"
                  >
                    Quick Remove
                  </button>
                  <button
                    className={`tab-btn${mainMode === 'smart' ? ' active' : ''}`}
                    onClick={() => setMainMode('smart')}
                    id="bg-main-mode-smart"
                  >
                    Smart Cutout
                  </button>
                  <button
                    className={`tab-btn${mainMode === 'ai' ? ' active' : ''}`}
                    onClick={() => setMainMode('ai')}
                    id="bg-main-mode-ai"
                  >
                    AI Remove
                  </button>
                </div>
              </div>
            </div>

            {/* QUICK REMOVE MODE */}
            {mainMode === 'quick' && (
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Quick Settings</span>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                  <div className="tabs">
                    <button className={`tab-btn${method === 'auto' ? ' active' : ''}`} onClick={() => setMethod('auto')}>
                      Auto Detect
                    </button>
                    <button className={`tab-btn${method === 'pick' ? ' active' : ''}`} onClick={() => setMethod('pick')}>
                      Pick Color
                    </button>
                    <button className={`tab-btn${method === 'edge' ? ' active' : ''}`} onClick={() => setMethod('edge')}>
                      Edge Connected
                    </button>
                  </div>

                  {method === 'auto' && detectedResult && (
                    <div style={{ padding: 'var(--sp-3)', background: 'var(--c-surface-subtle)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                        <div style={{ width: 24, height: 24, borderRadius: 'var(--r-sm)', background: detectedResult.hex, border: '1px solid rgba(0,0,0,0.15)' }} />
                        <span style={{ fontSize: 12, fontWeight: 600 }}>Detected: {detectedResult.hex}</span>
                      </div>
                      <span className={`contrast-badge ${detectedResult.confidence === 'High' ? 'pass' : 'fail'}`} style={{ fontSize: 11 }}>
                        Confidence: {detectedResult.confidence}
                      </span>
                    </div>
                  )}

                  {(method === 'pick' || method === 'edge') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                      <div className="tabs">
                        {(['white', 'black', 'custom'] as const).map(m => (
                          <button key={m} className={`tab-btn${bgMode === m ? ' active' : ''}`} onClick={() => setBgMode(m)}>
                            {m.charAt(0).toUpperCase() + m.slice(1)}
                          </button>
                        ))}
                      </div>
                      {bgMode === 'custom' && (
                        <div className="color-field">
                          <div className="color-field-swatch" style={{ background: customBg }}>
                            <input type="color" value={customBg} onChange={e => setCustomBg(e.target.value)} />
                          </div>
                          <input className="color-field-input" type="text" value={customBg} onChange={e => setCustomBg(e.target.value)} />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="field">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="field-label" style={{ margin: 0 }}>Tolerance</label>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{quickTolerance}</span>
                    </div>
                    <input type="range" className="slider" min={0} max={100} value={quickTolerance} onChange={e => setQuickTolerance(parseInt(e.target.value))} />
                  </div>
                </div>
              </div>
            )}

            {/* SMART CUTOUT MODE (GRABCUT / REGION GROWING) */}
            {mainMode === 'smart' && (
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Smart Cutout Controls</span>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                  <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>
                        1. Mark Foreground
                      </div>
                      <button
                        className={`btn btn-secondary btn-full${smartBrush === 'fg' ? ' active' : ''}`}
                        onClick={() => setSmartBrush('fg')}
                        style={smartBrush === 'fg' ? { borderColor: '#10B981', color: '#10B981', fontWeight: 700 } : undefined}
                        id="smart-brush-fg"
                      >
                        + Foreground Brush
                      </button>
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>
                        2. Mark Background
                      </div>
                      <button
                        className={`btn btn-secondary btn-full${smartBrush === 'bg' ? ' active' : ''}`}
                        onClick={() => setSmartBrush('bg')}
                        style={smartBrush === 'bg' ? { borderColor: '#EF4444', color: '#EF4444', fontWeight: 700 } : undefined}
                        id="smart-brush-bg"
                      >
                        − Background Brush
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flex: 1 }}>
                      <span style={{ fontSize: 11, color: 'var(--c-text-tertiary)', whiteSpace: 'nowrap' }}>Brush Size:</span>
                      <input
                        type="range"
                        className="slider"
                        min={10}
                        max={100}
                        value={smartBrushSize}
                        onChange={e => setSmartBrushSize(parseInt(e.target.value))}
                        id="smart-brush-size"
                      />
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', minWidth: 24, textAlign: 'right' }}>
                        {smartBrushSize}px
                      </span>
                    </div>

                    <button className="btn btn-ghost btn-sm" onClick={clearSmartStrokes} id="smart-clear-strokes">
                      Clear Strokes
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, color: 'var(--c-text-tertiary)' }}>
                    <span>
                      Strokes: {seedStats ? `${seedStats.fg} +FG seeds · ${seedStats.bg} −BG seeds` : 'A few strokes are enough to guide the cutout'}
                    </span>
                  </div>

                  <button
                    className="btn btn-primary btn-full"
                    onClick={() => runSmartCutoutSegmentation()}
                    disabled={isSegmenting}
                    id="smart-refine-btn"
                  >
                    {isSegmenting ? 'Segmenting Image…' : 'Refine Cutout'}
                  </button>

                  {smartNotice && (
                    <div style={{ fontSize: 11, color: 'var(--c-warning-text)', background: 'var(--c-warning-subtle)', border: '1px solid var(--c-warning-border)', padding: 'var(--sp-2) var(--sp-3)', borderRadius: 'var(--r-md)' }}>
                      {smartNotice}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* LOCAL AI REMOVE MODE */}
            {mainMode === 'ai' && (
              <div className="card">
                <div className="card-header">
                  <span className="card-title">AI Background Remover</span>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                  {/* Local AI Badges */}
                  <div style={{ display: 'flex', gap: 'var(--sp-3)', background: 'var(--c-surface-subtle)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-md)', padding: 'var(--sp-3)', fontSize: 11, color: 'var(--c-text-secondary)', flexWrap: 'wrap' }}>
                    <span>✓ Runs on your device</span>
                    <span>✓ No backend</span>
                    <span>✓ No API key</span>
                    <span>✓ No image upload</span>
                    {aiRuntime && (
                      <span style={{ fontWeight: 600, color: 'var(--c-brand)' }}>
                        Backend: {aiRuntime === 'webgpu' ? 'WebGPU' : 'WASM'}
                      </span>
                    )}
                  </div>

                  {/* AI Status / Progress Indicator */}
                  {aiStatus && !aiError && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-3)', background: 'var(--c-brand-subtle)', border: '1px solid var(--c-brand-border)', borderRadius: 'var(--r-md)', fontSize: 12, fontWeight: 500, color: 'var(--c-brand-text)' }}>
                      <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                      <span>{aiStatus}</span>
                    </div>
                  )}

                  {/* AI Error Display */}
                  {aiError && (
                    <div style={{ padding: 'var(--sp-3)', background: 'var(--c-error-subtle)', border: '1px solid var(--c-error-border)', borderRadius: 'var(--r-md)', fontSize: 12, color: 'var(--c-error-text)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontWeight: 700 }}>{isInferenceError ? 'AI Inference Error' : 'AI Model Initialization Error'}</div>
                      <div style={{ fontSize: 11, opacity: 0.9 }}>{aiError}</div>
                      {!isInferenceError && (
                        <>
                          <div style={{ fontSize: 11, color: 'var(--c-text-secondary)', marginTop: 4 }}>
                            Fallback: Select a local model file manually:
                          </div>
                          <label className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start', cursor: 'pointer', marginTop: 2 }}>
                            Select Local Model File (.onnx)
                            <input
                              type="file"
                              accept=".onnx"
                              onChange={handleModelFileSelect}
                              style={{ display: 'none' }}
                            />
                          </label>
                        </>
                      )}
                    </div>
                  )}

                  {/* Trigger AI Button */}
                  <button
                    className="btn btn-primary btn-full"
                    onClick={runAIRemoval}
                    disabled={isProcessingAI}
                    id="ai-remove-btn"
                  >
                    {isProcessingAI ? 'Processing AI Segmentation…' : aiRawAlphaMask ? 'Re-run AI Remove' : 'Remove Background'}
                  </button>

                  {/* Diagnostic Test Buttons */}
                  <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ flex: 1, fontSize: 10 }}
                      onClick={() => runDiagnosticTest(160)}
                      disabled={isProcessingAI}
                      title="Run diagnostic inference on a 160x160 test image"
                    >
                      Test 160×160
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ flex: 1, fontSize: 10 }}
                      onClick={() => runDiagnosticTest(320)}
                      disabled={isProcessingAI}
                      title="Run diagnostic inference on a 320x320 test image"
                    >
                      Test 320×320
                    </button>
                  </div>

                  {/* Manual Refinement Brush Tools for AI */}
                  {aiRawAlphaMask && (
                    <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-secondary)', textTransform: 'uppercase' }}>
                        Manual Mask Refinement
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                        <button
                          className={`btn btn-secondary${aiBrushMode === 'remove' ? ' active' : ''}`}
                          onClick={() => setAiBrushMode(aiBrushMode === 'remove' ? 'none' : 'remove')}
                          style={aiBrushMode === 'remove' ? { borderColor: '#EF4444', color: '#EF4444', fontWeight: 700 } : undefined}
                        >
                          [ Remove ]
                        </button>
                        <button
                          className={`btn btn-secondary${aiBrushMode === 'restore' ? ' active' : ''}`}
                          onClick={() => setAiBrushMode(aiBrushMode === 'restore' ? 'none' : 'restore')}
                          style={aiBrushMode === 'restore' ? { borderColor: '#10B981', color: '#10B981', fontWeight: 700 } : undefined}
                        >
                          [ Restore ]
                        </button>
                      </div>

                      {aiBrushMode !== 'none' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                          <span style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>Brush Size:</span>
                          <input
                            type="range"
                            className="slider"
                            min={10}
                            max={100}
                            value={aiBrushSize}
                            onChange={e => setAiBrushSize(parseInt(e.target.value))}
                          />
                          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{aiBrushSize}px</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Edge Refinement Polish */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Edge Refinement</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                <div className="field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="field-label" style={{ margin: 0 }}>Feather</label>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{feather}px</span>
                  </div>
                  <input type="range" className="slider" min={0} max={5} step={0.5} value={feather} onChange={e => setFeather(parseFloat(e.target.value))} />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={smoothEdges} onChange={e => setSmoothEdges(e.target.checked)} />
                  <span>Smooth Edges (Anti-Aliasing)</span>
                </label>
              </div>
            </div>

            {/* Live Preview Card */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Preview</span>
                {mainMode === 'smart' && (
                  <div className="tabs" style={{ marginBottom: 0 }}>
                    {(['cutout', 'original', 'mask'] as const).map(p => (
                      <button key={p} className={`tab-btn${smartPreview === p ? ' active' : ''}`} onClick={() => setSmartPreview(p)}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
                {mainMode === 'ai' && (
                  <div className="tabs" style={{ marginBottom: 0 }}>
                    <button className={`tab-btn${aiPreview === 'cutout' ? ' active' : ''}`} onClick={() => setAiPreview('cutout')}>
                      Result
                    </button>
                    <button className={`tab-btn${aiPreview === 'original' ? ' active' : ''}`} onClick={() => setAiPreview('original')}>
                      Original
                    </button>
                    <button className={`tab-btn${aiPreview === 'mask' ? ' active' : ''}`} onClick={() => setAiPreview('mask')}>
                      Soft Mask
                    </button>
                    <button className={`tab-btn${aiPreview === 'raw' ? ' active' : ''}`} onClick={() => setAiPreview('raw')} title="Raw U2NetP model output">
                      Raw (Debug)
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
                    cursor: (mainMode === 'smart' || (mainMode === 'ai' && aiBrushMode !== 'none') || (mainMode === 'quick' && quickBrushMode !== 'none')) ? 'crosshair' : 'default',
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

                <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)', marginTop: 6 }}>
                  {mainMode === 'smart'
                    ? 'Click & drag on image to paint foreground (+) or background (−) strokes.'
                    : mainMode === 'ai' && aiBrushMode !== 'none'
                    ? 'Click & drag on image to refine AI mask with brush.'
                    : 'Checkerboard = Transparent'}
                </div>

                <button
                  className="btn btn-primary btn-full btn-lg"
                  onClick={handleApply}
                  disabled={!processedBytes}
                  id="bg-remover-apply-btn"
                  style={{ marginTop: 'var(--sp-4)' }}
                >
                  Apply Background Removal
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default BackgroundRemover

