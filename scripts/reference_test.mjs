import fs from 'fs'
import * as ort from 'onnxruntime-node'

console.log('🔬 Comparing Reference Preprocessing (maxPixel) vs 255.0 Preprocessing...\n')

const modelBuf = fs.readFileSync('assets/models/u2netp/u2netp.onnx')
const session = await ort.InferenceSession.create(modelBuf)

function generateNightTentScene(width = 320, height = 320) {
  const pixels = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      
      const tentBaseY = 280, tentTopY = 120, tentCenterX = 160, tentHalfW = 100
      const inTentHeight = y >= tentTopY && y <= tentBaseY
      const tentProgress = (y - tentTopY) / (tentBaseY - tentTopY)
      const curHalfW = tentHalfW * tentProgress
      const inTent = inTentHeight && Math.abs(x - tentCenterX) <= curHalfW

      if (inTent) {
        pixels[idx] = 160
        pixels[idx + 1] = 90
        pixels[idx + 2] = 30
        pixels[idx + 3] = 255
      } else {
        if (y < 240) {
          pixels[idx] = 10 + Math.floor(y * 0.05)
          pixels[idx + 1] = 15 + Math.floor(y * 0.08)
          pixels[idx + 2] = 35 + Math.floor(y * 0.1)
          pixels[idx + 3] = 255
        } else {
          pixels[idx] = 15
          pixels[idx + 1] = 25
          pixels[idx + 2] = 10
          pixels[idx + 3] = 255
        }
      }
    }
  }
  return { pixels, width, height }
}

async function runTest(divisorType, { pixels, width, height }) {
  let maxPixel = 0
  const totalPixels = width * height
  for (let i = 0; i < totalPixels; i++) {
    const px = i * 4
    if (pixels[px] > maxPixel) maxPixel = pixels[px]
    if (pixels[px + 1] > maxPixel) maxPixel = pixels[px + 1]
    if (pixels[px + 2] > maxPixel) maxPixel = pixels[px + 2]
  }
  if (maxPixel <= 0) maxPixel = 1

  const divisor = divisorType.startsWith('maxPixel') ? maxPixel : 255.0

  const MEAN = [0.485, 0.456, 0.406]
  const STD = [0.229, 0.224, 0.225]

  const floatData = new Float32Array(3 * 320 * 320)
  for (let i = 0; i < totalPixels; i++) {
    const px = i * 4
    const r = pixels[px] / divisor
    const g = pixels[px + 1] / divisor
    const b = pixels[px + 2] / divisor

    floatData[i] = (r - MEAN[0]) / STD[0]
    floatData[320 * 320 + i] = (g - MEAN[1]) / STD[1]
    floatData[2 * 320 * 320 + i] = (b - MEAN[2]) / STD[2]
  }

  const inputTensor = new ort.Tensor('float32', floatData, [1, 3, 320, 320])
  const results = await session.run({ [session.inputNames[0]]: inputTensor })
  const rawMask = results[session.outputNames[0]].data

  let minVal = Infinity, maxVal = -Infinity, sumVal = 0
  for (let i = 0; i < rawMask.length; i++) {
    const v = rawMask[i]
    if (v < minVal) minVal = v
    if (v > maxVal) maxVal = v
    sumVal += v
  }

  const range = maxVal - minVal
  const normalizedMask = new Float32Array(rawMask.length)
  for (let i = 0; i < rawMask.length; i++) {
    normalizedMask[i] = range > 1e-6 ? (rawMask[i] - minVal) / range : 0
  }

  let tentMaskSum = 0, tentCount = 0
  let bgMaskSum = 0, bgCount = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const tentBaseY = 280, tentTopY = 120, tentCenterX = 160, tentHalfW = 100
      const inTentHeight = y >= tentTopY && y <= tentBaseY
      const tentProgress = (y - tentTopY) / (tentBaseY - tentTopY)
      const curHalfW = tentHalfW * tentProgress
      const inTent = inTentHeight && Math.abs(x - tentCenterX) <= curHalfW

      if (inTent) {
        tentMaskSum += normalizedMask[idx]
        tentCount++
      } else {
        bgMaskSum += normalizedMask[idx]
        bgCount++
      }
    }
  }

  const avgTent = (tentMaskSum / tentCount) * 100
  const avgBg = (bgMaskSum / bgCount) * 100

  console.log(`--- Preprocessing: ${divisorType} (Divisor: ${divisor}) ---`)
  console.log(`Raw min: ${minVal.toFixed(6)}, max: ${maxVal.toFixed(6)}, mean: ${(sumVal/rawMask.length).toFixed(6)}`)
  console.log(`Tent Foreground Avg Alpha: ${avgTent.toFixed(2)}%`)
  console.log(`Background Avg Alpha:       ${avgBg.toFixed(2)}%`)
  console.log(`Contrast Separation:        ${(avgTent - avgBg).toFixed(2)}%\n`)
}

const tentScene = generateNightTentScene(320, 320)
await runTest('maxPixel (Reference)', tentScene)
await runTest('255.0 (Old)', tentScene)
