// ============================================================
// Real Image Single-Test for Silueta
// ============================================================

import fs from 'fs'
import * as pako from 'pako'
import * as ort from 'onnxruntime-node'

function decodePNG(buffer) {
  let pos = 8
  let width = 0, height = 0, bitDepth = 0, colorType = 0
  const idatChunks = []

  while (pos < buffer.length) {
    const length = buffer.readUInt32BE(pos)
    const type = buffer.toString('ascii', pos + 4, pos + 8)
    if (type === 'IHDR') {
      width = buffer.readUInt32BE(pos + 8)
      height = buffer.readUInt32BE(pos + 12)
      bitDepth = buffer[pos + 16]
      colorType = buffer[pos + 17]
    } else if (type === 'IDAT') {
      idatChunks.push(buffer.subarray(pos + 8, pos + 8 + length))
    } else if (type === 'IEND') {
      break
    }
    pos += 12 + length
  }

  const compressed = Buffer.concat(idatChunks)
  const uncompressed = pako.inflate(compressed)

  const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : 1
  const stride = width * bytesPerPixel
  const rawData = new Uint8Array(width * height * 4)

  let srcPos = 0
  let dstPos = 0
  const rowBuffer = new Uint8Array(stride)
  const prevRow = new Uint8Array(stride)

  for (let y = 0; y < height; y++) {
    const filterType = uncompressed[srcPos++]
    for (let x = 0; x < stride; x++) {
      const xByte = uncompressed[srcPos++]
      let val = 0
      if (filterType === 0) val = xByte
      else if (filterType === 1) {
        const a = x >= bytesPerPixel ? rowBuffer[x - bytesPerPixel] : 0
        val = (xByte + a) & 0xff
      } else if (filterType === 2) {
        const b = prevRow[x]
        val = (xByte + b) & 0xff
      } else if (filterType === 3) {
        const a = x >= bytesPerPixel ? rowBuffer[x - bytesPerPixel] : 0
        const b = prevRow[x]
        val = (xByte + Math.floor((a + b) / 2)) & 0xff
      } else if (filterType === 4) {
        const a = x >= bytesPerPixel ? rowBuffer[x - bytesPerPixel] : 0
        const b = prevRow[x]
        const c = x >= bytesPerPixel ? prevRow[x - bytesPerPixel] : 0
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        let pr = 0
        if (pa <= pb && pa <= pc) pr = a
        else if (pb <= pc) pr = b
        else pr = c
        val = (xByte + pr) & 0xff
      }
      rowBuffer[x] = val
    }
    prevRow.set(rowBuffer)

    for (let x = 0; x < width; x++) {
      if (colorType === 6) {
        rawData[dstPos++] = rowBuffer[x * 4]
        rawData[dstPos++] = rowBuffer[x * 4 + 1]
        rawData[dstPos++] = rowBuffer[x * 4 + 2]
        rawData[dstPos++] = rowBuffer[x * 4 + 3]
      } else if (colorType === 2) {
        rawData[dstPos++] = rowBuffer[x * 3]
        rawData[dstPos++] = rowBuffer[x * 3 + 1]
        rawData[dstPos++] = rowBuffer[x * 3 + 2]
        rawData[dstPos++] = 255
      }
    }
  }

  return { width, height, data: rawData }
}

const siluetaBuf = fs.readFileSync('assets/models/silueta/silueta_320.onnx')
console.log(`[AI SILUETA] Silueta initialization started`)
console.log(`[AI SILUETA] Loading silueta_320.onnx`)
console.log(`[AI SILUETA] Model bytes: ${siluetaBuf.byteLength}`)
console.log(`[AI SILUETA] Provider: wasm`)

const t0 = performance.now()
const session = await ort.InferenceSession.create(siluetaBuf)
const sessionTime = (performance.now() - t0).toFixed(1)
console.log(`[AI SILUETA] Session created (in ${sessionTime} ms)`)

const imgPath = 'C:/Users/brijesh9177/Downloads/Virat-with-Trophy.png'
const imgBuf = fs.readFileSync(imgPath)
const { width, height, data } = decodePNG(imgBuf)
console.log(`\nTest Image: ${imgPath} (${width}x${height})`)

// Preprocess
let maxPixel = 0
for (let i = 0; i < 320 * 320; i++) {
  const px = i * 4
  if (data[px] > maxPixel) maxPixel = data[px]
  if (data[px + 1] > maxPixel) maxPixel = data[px + 1]
  if (data[px + 2] > maxPixel) maxPixel = data[px + 2]
}
if (maxPixel <= 0) maxPixel = 1

const floatData = new Float32Array(3 * 320 * 320)
const MEAN = [0.485, 0.456, 0.406], STD = [0.229, 0.224, 0.225]
for (let y = 0; y < 320; y++) {
  const origY = Math.floor((y / 320) * height)
  for (let x = 0; x < 320; x++) {
    const origX = Math.floor((x / 320) * width)
    const px = (origY * width + origX) * 4
    const r = data[px] / maxPixel, g = data[px + 1] / maxPixel, b = data[px + 2] / maxPixel
    const idx = y * 320 + x
    floatData[idx] = (r - MEAN[0]) / STD[0]
    floatData[320 * 320 + idx] = (g - MEAN[1]) / STD[1]
    floatData[2 * 320 * 320 + idx] = (b - MEAN[2]) / STD[2]
  }
}
const inputTensor = new ort.Tensor('float32', floatData, [1, 3, 320, 320])

console.log('[AI SILUETA] Running inference')
const tInfStart = performance.now()
const results = await session.run({ [session.inputNames[0]]: inputTensor })
const infTime = (performance.now() - tInfStart).toFixed(1)
console.log(`[AI SILUETA] Inference completed (in ${infTime} ms)`)

const outTensor = results[session.outputNames[0]]
console.log(`Output dims: [${outTensor.dims.join(', ')}]`)

let minVal = Infinity, maxVal = -Infinity, sumVal = 0
const raw = outTensor.data
for (let i = 0; i < raw.length; i++) {
  const v = raw[i]
  if (v < minVal) minVal = v
  if (v > maxVal) maxVal = v
  sumVal += v
}
console.log(`Raw output min: ${minVal.toFixed(6)}, max: ${maxVal.toFixed(6)}, mean: ${(sumVal/raw.length).toFixed(6)}`)
console.log('✓ Single real-image test SUCCESSFUL!')
