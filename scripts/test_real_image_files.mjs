import fs from 'fs'
import { inflate } from 'pako'
import * as ort from 'onnxruntime-node'

// Minimal PNG decoder for RGBA / RGB PNGs
function decodePNG(buffer) {
  let offset = 8
  let width = 0, height = 0, bitDepth = 0, colorType = 0
  const idatChunks = []

  while (offset < buffer.length) {
    const len = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    if (type === 'IHDR') {
      width = buffer.readUInt32BE(offset + 8)
      height = buffer.readUInt32BE(offset + 12)
      bitDepth = buffer[offset + 16]
      colorType = buffer[offset + 17]
    } else if (type === 'IDAT') {
      idatChunks.push(buffer.subarray(offset + 8, offset + 8 + len))
    } else if (type === 'IEND') {
      break
    }
    offset += 12 + len
  }

  const compressedData = Buffer.concat(idatChunks)
  const uncompressed = inflate(compressedData)

  const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : 4
  const rowSize = 1 + width * bytesPerPixel
  const rgba = new Uint8Array(width * height * 4)

  // Unfilter scanlines (supporting filter 0, 1, 2, 3, 4)
  const prevRow = new Uint8Array(width * bytesPerPixel)
  const currRow = new Uint8Array(width * bytesPerPixel)

  for (let y = 0; y < height; y++) {
    const filter = uncompressed[y * rowSize]
    const rawRow = uncompressed.subarray(y * rowSize + 1, (y + 1) * rowSize)

    for (let x = 0; x < width * bytesPerPixel; x++) {
      const a = x >= bytesPerPixel ? currRow[x - bytesPerPixel] : 0
      const b = prevRow[x]
      const c = x >= bytesPerPixel ? prevRow[x - bytesPerPixel] : 0
      const xVal = rawRow[x]

      let val = 0
      if (filter === 0) val = xVal
      else if (filter === 1) val = (xVal + a) & 0xff
      else if (filter === 2) val = (xVal + b) & 0xff
      else if (filter === 3) val = (xVal + Math.floor((a + b) / 2)) & 0xff
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        let pr = c
        if (pa <= pb && pa <= pc) pr = a
        else if (pb <= pc) pr = b
        val = (xVal + pr) & 0xff
      }
      currRow[x] = val
    }
    prevRow.set(currRow)

    for (let x = 0; x < width; x++) {
      const outIdx = (y * width + x) * 4
      if (colorType === 6) {
        rgba[outIdx] = currRow[x * 4]
        rgba[outIdx + 1] = currRow[x * 4 + 1]
        rgba[outIdx + 2] = currRow[x * 4 + 2]
        rgba[outIdx + 3] = currRow[x * 4 + 3]
      } else if (colorType === 2) {
        rgba[outIdx] = currRow[x * 3]
        rgba[outIdx + 1] = currRow[x * 3 + 1]
        rgba[outIdx + 2] = currRow[x * 3 + 2]
        rgba[outIdx + 3] = 255
      }
    }
  }

  return { data: rgba, width, height }
}

// Bilinear resize image to 320x320
function resizeImageData(image, targetW = 320, targetH = 320) {
  const { data, width, height } = image
  const out = new Uint8Array(targetW * targetH * 4)
  const scaleX = (width - 1) / Math.max(1, targetW - 1)
  const scaleY = (height - 1) / Math.max(1, targetH - 1)

  for (let y = 0; y < targetH; y++) {
    const srcY = y * scaleY
    const y0 = Math.floor(srcY)
    const y1 = Math.min(y0 + 1, height - 1)
    const dy = srcY - y0

    for (let x = 0; x < targetW; x++) {
      const srcX = x * scaleX
      const x0 = Math.floor(srcX)
      const x1 = Math.min(x0 + 1, width - 1)
      const dx = srcX - x0

      for (let c = 0; c < 3; c++) {
        const v00 = data[(y0 * width + x0) * 4 + c]
        const v01 = data[(y0 * width + x1) * 4 + c]
        const v10 = data[(y1 * width + x0) * 4 + c]
        const v11 = data[(y1 * width + x1) * 4 + c]

        const top = v00 * (1 - dx) + v01 * dx
        const bot = v10 * (1 - dx) + v11 * dx
        out[(y * targetW + x) * 4 + c] = Math.round(top * (1 - dy) + bot * dy)
      }
      out[(y * targetW + x) * 4 + 3] = 255
    }
  }
  return { data: out, width: targetW, height: targetH }
}

const modelBuf = fs.readFileSync('assets/models/u2netp/u2netp.onnx')
const session = await ort.InferenceSession.create(modelBuf)

async function testImageFile(filePath) {
  console.log(`\n======================================================`)
  console.log(`Testing Image: ${filePath}`)
  console.log(`======================================================`)

  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`)
    return
  }

  const rawBuf = fs.readFileSync(filePath)
  const image = decodePNG(rawBuf)
  console.log(`Decoded PNG: ${image.width}x${image.height}`)

  const resized = resizeImageData(image, 320, 320)
  const pixels = resized.data

  // 1. Reference Preprocessing
  let maxPixel = 0
  for (let i = 0; i < 320 * 320; i++) {
    const px = i * 4
    if (pixels[px] > maxPixel) maxPixel = pixels[px]
    if (pixels[px + 1] > maxPixel) maxPixel = pixels[px + 1]
    if (pixels[px + 2] > maxPixel) maxPixel = pixels[px + 2]
  }
  if (maxPixel <= 0) maxPixel = 1

  console.log(`[AI] U2NetP preprocessing maxPixel: ${maxPixel}`)
  console.log(`[AI] U2NetP input shape: [1,3,320,320]`)

  const MEAN = [0.485, 0.456, 0.406]
  const STD = [0.229, 0.224, 0.225]

  const floatData = new Float32Array(3 * 320 * 320)
  for (let i = 0; i < 320 * 320; i++) {
    const px = i * 4
    const r = pixels[px] / maxPixel
    const g = pixels[px + 1] / maxPixel
    const b = pixels[px + 2] / maxPixel

    floatData[i] = (r - MEAN[0]) / STD[0]
    floatData[320 * 320 + i] = (g - MEAN[1]) / STD[1]
    floatData[2 * 320 * 320 + i] = (b - MEAN[2]) / STD[2]
  }

  const inputTensor = new ort.Tensor('float32', floatData, [1, 3, 320, 320])

  console.log('[AI] U2NetP inference started')
  const results = await session.run({ [session.inputNames[0]]: inputTensor })
  console.log('[AI] U2NetP inference completed')

  session.outputNames.forEach((name, idx) => {
    const t = results[name]
    console.log(`[AI] Output ${idx} shape: [${t.dims.join(',')}] (name: '${name}')`)
  })

  const fusedOutput = results[session.outputNames[0]].data
  let minVal = Infinity, maxVal = -Infinity, sumVal = 0
  for (let i = 0; i < fusedOutput.length; i++) {
    const v = fusedOutput[i]
    if (v < minVal) minVal = v
    if (v > maxVal) maxVal = v
    sumVal += v
  }

  console.log(`[AI] U2NetP raw output min: ${minVal.toFixed(6)}`)
  console.log(`[AI] U2NetP raw output max: ${maxVal.toFixed(6)}`)
  console.log(`[AI] U2NetP raw output mean: ${(sumVal / fusedOutput.length).toFixed(6)}`)

  // Min-max normalization
  const range = maxVal - minVal
  const normalized = new Float32Array(fusedOutput.length)
  for (let i = 0; i < fusedOutput.length; i++) {
    normalized[i] = range > 1e-6 ? (fusedOutput[i] - minVal) / range : 0
  }

  // Count distribution of alpha in normalized mask
  let highConf = 0, midConf = 0, lowConf = 0, zeroConf = 0
  for (let i = 0; i < normalized.length; i++) {
    const a = normalized[i]
    if (a > 0.8) highConf++
    else if (a > 0.3) midConf++
    else if (a > 0.05) lowConf++
    else zeroConf++
  }

  console.log(`\nMask Distribution across 320x320:`)
  console.log(`  High Confidence (>80% alpha): ${(highConf / normalized.length * 100).toFixed(1)}%`)
  console.log(`  Mid Confidence (30-80% alpha): ${(midConf / normalized.length * 100).toFixed(1)}%`)
  console.log(`  Low Confidence (5-30% alpha):  ${(lowConf / normalized.length * 100).toFixed(1)}%`)
  console.log(`  Background (<5% alpha):        ${(zeroConf / normalized.length * 100).toFixed(1)}%`)
}

const testFiles = [
  'C:\\Users\\brijesh9177\\Downloads\\Sample.png',
  'C:\\Users\\brijesh9177\\Downloads\\Virat-with-Trophy.png'
]

for (const f of testFiles) {
  await testImageFile(f)
}
