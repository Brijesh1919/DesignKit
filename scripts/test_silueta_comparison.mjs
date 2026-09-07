// ============================================================
// Silueta (~44.2 MB) vs U²-NetP (~4.57 MB) Controlled Benchmark
// ============================================================

import fs from 'fs'
import crypto from 'crypto'
import * as ort from 'onnxruntime-node'

console.log('🧪 STARTING SILUETA VS U²-NETP COMPARISON TEST...\n')

// 1. Verify Silueta Chunks
const siluetaChunksFile = fs.readFileSync('src/ai/silueta_chunks.ts', 'utf-8')
const matchSilueta = siluetaChunksFile.match(/export const SILUETA_MODEL_CHUNKS: string\[\] = (\[[\s\S]*?\])/)
const siluetaChunks = JSON.parse(matchSilueta[1])

const siluetaDecoded = []
for (let i = 0; i < siluetaChunks.length; i++) {
  siluetaDecoded.push(Buffer.from(siluetaChunks[i], 'base64'))
}
const siluetaBuffer = Buffer.concat(siluetaDecoded)
const siluetaSha256 = crypto.createHash('sha256').update(siluetaBuffer).digest('hex')

// 2. Verify U2NetP Chunks
const u2netpChunksFile = fs.readFileSync('src/ai/u2netp_chunks.ts', 'utf-8')
const matchU2NetP = u2netpChunksFile.match(/export const U2NETP_MODEL_CHUNKS: string\[\] = (\[[\s\S]*?\])/)
const u2netpChunks = JSON.parse(matchU2NetP[1])

const u2netpDecoded = []
for (let i = 0; i < u2netpChunks.length; i++) {
  u2netpDecoded.push(Buffer.from(u2netpChunks[i], 'base64'))
}
const u2netpBuffer = Buffer.concat(u2netpDecoded)
const u2netpSha256 = crypto.createHash('sha256').update(u2netpBuffer).digest('hex')

console.log('--- MODEL REASSEMBLY CHECK ---')
console.log(`U²-NetP Model Bytes:   ${u2netpBuffer.length} (${u2netpChunks.length} chunks)`)
console.log(`U²-NetP SHA-256:       ${u2netpSha256}`)
console.log(`Silueta Model Bytes:   ${siluetaBuffer.length} (${siluetaChunks.length} chunks)`)
console.log(`Silueta SHA-256:       ${siluetaSha256}`)

// 3. Create Sessions
console.log('\n--- CREATING ISOLATED SESSIONS ---')
console.log('[AI SILUETA] Silueta initialization started')
console.log('[AI SILUETA] Loading silueta_320.onnx')
console.log(`[AI SILUETA] Model bytes: ${siluetaBuffer.length}`)
console.log('[AI SILUETA] WebGPU available: false (Node.js WASM/CPU)')
console.log('[AI SILUETA] Provider: wasm')

const t0Sil = performance.now()
const sessionSilueta = await ort.InferenceSession.create(siluetaBuffer)
const silSessionTime = (performance.now() - t0Sil).toFixed(1)
console.log(`[AI SILUETA] Session created (in ${silSessionTime} ms)`)
console.log(`[AI SILUETA] Input names:  ${JSON.stringify(sessionSilueta.inputNames)}`)
console.log(`[AI SILUETA] Output names: ${JSON.stringify(sessionSilueta.outputNames)}`)

const sessionU2NetP = await ort.InferenceSession.create(u2netpBuffer)

// Reference Preprocessor
function preprocess(pixels, width, height) {
  let maxPixel = 0
  const totalPixels = width * height
  for (let i = 0; i < totalPixels; i++) {
    const px = i * 4
    if (pixels[px] > maxPixel) maxPixel = pixels[px]
    if (pixels[px + 1] > maxPixel) maxPixel = pixels[px + 1]
    if (pixels[px + 2] > maxPixel) maxPixel = pixels[px + 2]
  }
  if (maxPixel <= 0) maxPixel = 1

  const MEAN = [0.485, 0.456, 0.406]
  const STD = [0.229, 0.224, 0.225]

  const floatData = new Float32Array(3 * 320 * 320)
  for (let i = 0; i < totalPixels; i++) {
    const px = i * 4
    const r = pixels[px] / maxPixel
    const g = pixels[px + 1] / maxPixel
    const b = pixels[px + 2] / maxPixel

    floatData[i] = (r - MEAN[0]) / STD[0]
    floatData[320 * 320 + i] = (g - MEAN[1]) / STD[1]
    floatData[2 * 320 * 320 + i] = (b - MEAN[2]) / STD[2]
  }

  return new ort.Tensor('float32', floatData, [1, 3, 320, 320])
}

// Postprocess normPRED
function normPRED(rawMask) {
  let minVal = Infinity, maxVal = -Infinity
  for (let i = 0; i < rawMask.length; i++) {
    const v = rawMask[i]
    if (v < minVal) minVal = v
    if (v > maxVal) maxVal = v
  }
  const range = maxVal - minVal
  const normalized = new Float32Array(rawMask.length)
  for (let i = 0; i < rawMask.length; i++) {
    normalized[i] = range > 1e-6 ? (rawMask[i] - minVal) / range : 0
  }
  return { normalized, minVal, maxVal }
}

// Benchmark single test
async function runComparison(testName, generateFn) {
  const { pixels, fgCheckFn } = generateFn(320, 320)
  const tensor = preprocess(pixels, 320, 320)

  // Test Silueta
  const tStartSil = performance.now()
  const resultsSil = await sessionSilueta.run({ [sessionSilueta.inputNames[0]]: tensor })
  const infTimeSil = (performance.now() - tStartSil).toFixed(1)
  const rawSil = resultsSil[sessionSilueta.outputNames[0]].data
  const { normalized: normSil, minVal: minSil, maxVal: maxSil } = normPRED(rawSil)

  // Test U2-NetP
  const tStartP = performance.now()
  const resultsP = await sessionU2NetP.run({ [sessionU2NetP.inputNames[0]]: tensor })
  const infTimeP = (performance.now() - tStartP).toFixed(1)
  const rawP = resultsP[sessionU2NetP.outputNames[0]].data
  const { normalized: normP, minVal: minP, maxVal: maxP } = normPRED(rawP)

  let fgSilSum = 0, bgSilSum = 0, fgCount = 0, bgCount = 0
  let fgPSum = 0, bgPSum = 0

  for (let y = 0; y < 320; y++) {
    for (let x = 0; x < 320; x++) {
      const idx = y * 320 + x
      const isFg = fgCheckFn(x, y)
      if (isFg) {
        fgSilSum += normSil[idx]
        fgPSum += normP[idx]
        fgCount++
      } else {
        bgSilSum += normSil[idx]
        bgPSum += normP[idx]
        bgCount++
      }
    }
  }

  const fgSilAvg = (fgSilSum / Math.max(1, fgCount)) * 100
  const bgSilAvg = (bgSilSum / Math.max(1, bgCount)) * 100
  const fgPAvg = (fgPSum / Math.max(1, fgCount)) * 100
  const bgPAvg = (bgPSum / Math.max(1, bgCount)) * 100

  console.log(`\n======================================================`)
  console.log(`Test Case: ${testName}`)
  console.log(`======================================================`)
  console.log(`[Silueta 44MB]  Inference: ${infTimeSil} ms | Raw range: [${minSil.toFixed(5)}, ${maxSil.toFixed(5)}]`)
  console.log(`                FG Avg: ${fgSilAvg.toFixed(1)}% | BG Avg: ${bgSilAvg.toFixed(1)}% | Contrast: ${(fgSilAvg - bgSilAvg).toFixed(1)}%`)
  console.log(`[U²-NetP 4.5MB] Inference: ${infTimeP} ms | Raw range: [${minP.toFixed(5)}, ${maxP.toFixed(5)}]`)
  console.log(`                FG Avg: ${fgPAvg.toFixed(1)}% | BG Avg: ${bgPAvg.toFixed(1)}% | Contrast: ${(fgPAvg - bgPAvg).toFixed(1)}%`)
  console.log(`Quality Delta: Silueta FG is ${fgSilAvg >= fgPAvg ? '+' : ''}${(fgSilAvg - fgPAvg).toFixed(1)}% vs U²-NetP`)

  return { infTimeSil, infTimeP, fgSilAvg, fgPAvg, bgSilAvg, bgPAvg }
}

// 7 Test Cases
function genTent(w, h) {
  const pixels = new Uint8Array(w * h * 4)
  const fgCheck = (x, y) => {
    const baseY = 270, topY = 110, centerX = 160, halfW = 90
    if (y < topY || y > baseY) return false
    const curHalfW = halfW * ((y - topY) / (baseY - topY))
    return Math.abs(x - centerX) <= curHalfW
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      if (fgCheck(x, y)) {
        pixels[idx] = 175; pixels[idx + 1] = 95; pixels[idx + 2] = 35; pixels[idx + 3] = 255
      } else {
        pixels[idx] = 12; pixels[idx + 1] = 18; pixels[idx + 2] = 32; pixels[idx + 3] = 255
      }
    }
  }
  return { pixels, fgCheckFn: fgCheck }
}

function genPersonNight(w, h) {
  const pixels = new Uint8Array(w * h * 4)
  const fgCheck = (x, y) => {
    const dx = x - 160, dy = y - 80
    if (dx * dx + dy * dy < 25 * 25) return true
    if (x >= 125 && x <= 195 && y >= 105 && y <= 210) return true
    if ((x >= 130 && x <= 155 && y > 210 && y <= 290) || (x >= 165 && x <= 190 && y > 210 && y <= 290)) return true
    return false
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      if (fgCheck(x, y)) {
        pixels[idx] = 90; pixels[idx + 1] = 80; pixels[idx + 2] = 75; pixels[idx + 3] = 255
      } else {
        pixels[idx] = 15; pixels[idx + 1] = 20; pixels[idx + 2] = 40; pixels[idx + 3] = 255
      }
    }
  }
  return { pixels, fgCheckFn: fgCheck }
}

function genPlant(w, h) {
  const pixels = new Uint8Array(w * h * 4)
  const fgCheck = (x, y) => {
    if (x >= 130 && x <= 190 && y >= 230 && y <= 280) return true
    if (x >= 158 && x <= 162 && y >= 110 && y < 230) return true
    const dLeft = Math.hypot(x - 120, y - 160)
    const dRight = Math.hypot(x - 200, y - 140)
    const dTop = Math.hypot(x - 160, y - 110)
    if (dLeft < 28 || dRight < 25 || dTop < 22) return true
    return false
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      if (fgCheck(x, y)) {
        pixels[idx] = 45; pixels[idx + 1] = 140; pixels[idx + 2] = 60; pixels[idx + 3] = 255
      } else {
        pixels[idx] = 220; pixels[idx + 1] = 220; pixels[idx + 2] = 225; pixels[idx + 3] = 255
      }
    }
  }
  return { pixels, fgCheckFn: fgCheck }
}

function genTiger(w, h) {
  const pixels = new Uint8Array(w * h * 4)
  const fgCheck = (x, y) => {
    const dx = (x - 160) / 75, dy = (y - 180) / 45
    if (dx * dx + dy * dy <= 1) return true
    const hx = x - 230, hy = y - 150
    if (hx * hx + hy * hy <= 30 * 30) return true
    return false
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      if (fgCheck(x, y)) {
        pixels[idx] = 210; pixels[idx + 1] = 120; pixels[idx + 2] = 30; pixels[idx + 3] = 255
      } else {
        pixels[idx] = 70; pixels[idx + 1] = 130; pixels[idx + 2] = 40; pixels[idx + 3] = 255
      }
    }
  }
  return { pixels, fgCheckFn: fgCheck }
}

function genFlamingos(w, h) {
  const pixels = new Uint8Array(w * h * 4)
  const fgCheck = (x, y) => {
    if (Math.hypot(x - 160, y - 140) < 35) return true
    if (x >= 180 && x <= 186 && y >= 90 && y < 140) return true
    if (Math.hypot(x - 190, y - 85) < 15) return true
    if ((x >= 150 && x <= 153 && y >= 170 && y <= 270) || (x >= 165 && x <= 168 && y >= 170 && y <= 270)) return true
    return false
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      if (fgCheck(x, y)) {
        pixels[idx] = 240; pixels[idx + 1] = 110; pixels[idx + 2] = 140; pixels[idx + 3] = 255
      } else {
        pixels[idx] = 40; pixels[idx + 1] = 120; pixels[idx + 2] = 180; pixels[idx + 3] = 255
      }
    }
  }
  return { pixels, fgCheckFn: fgCheck }
}

function genLeopard(w, h) {
  const pixels = new Uint8Array(w * h * 4)
  const fgCheck = (x, y) => {
    const dx = (x - 160) / 70, dy = (y - 170) / 40
    return dx * dx + dy * dy <= 1
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      if (fgCheck(x, y)) {
        const spot = ((x % 14 < 4) && (y % 14 < 4)) ? 30 : 190
        pixels[idx] = spot; pixels[idx + 1] = Math.min(255, spot + 20); pixels[idx + 2] = 50; pixels[idx + 3] = 255
      } else {
        pixels[idx] = 160; pixels[idx + 1] = 150; pixels[idx + 2] = 100; pixels[idx + 3] = 255
      }
    }
  }
  return { pixels, fgCheckFn: fgCheck }
}

function genPersonBuilding(w, h) {
  const pixels = new Uint8Array(w * h * 4)
  const fgCheck = (x, y) => {
    const hDist = Math.hypot(x - 120, y - 100)
    if (hDist < 25) return true
    if (x >= 95 && x <= 145 && y >= 125 && y <= 270) return true
    return false
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      if (fgCheck(x, y)) {
        pixels[idx] = 220; pixels[idx + 1] = 70; pixels[idx + 2] = 70; pixels[idx + 3] = 255
      } else {
        const win = ((x % 40 < 20) && (y % 40 < 20)) ? 80 : 170
        pixels[idx] = win; pixels[idx + 1] = win + 10; pixels[idx + 2] = win + 20; pixels[idx + 3] = 255
      }
    }
  }
  return { pixels, fgCheckFn: fgCheck }
}

// Run comparison on all 7 images
const r1 = await runComparison('1. Tent (Low Light Camping)', genTent)
const r2 = await runComparison('2. Person under Night Sky', genPersonNight)
const r3 = await runComparison('3. Plant with Thin Stems & Leaves', genPlant)
const r4 = await runComparison('4. Tiger / Big Cat on Grass', genTiger)
const r5 = await runComparison('5. Flamingos (Thin Legs & Slender Neck)', genFlamingos)
const r6 = await runComparison('6. Leopard (Camouflage / Texture)', genLeopard)
const r7 = await runComparison('7. Person / Building Urban Scene', genPersonBuilding)

console.log('\n======================================================')
console.log('SUMMARY TABLE: Silueta (44.2MB) vs U²-NetP (4.57MB)')
console.log('======================================================')
console.log(`Session Load:       Silueta: ${silSessionTime} ms`)
console.log(`Tent FG Alpha:      Silueta: ${r1.fgSilAvg.toFixed(1)}%  vs  U²-NetP: ${r1.fgPAvg.toFixed(1)}%`)
console.log(`Person Night Alpha: Silueta: ${r2.fgSilAvg.toFixed(1)}%  vs  U²-NetP: ${r2.fgPAvg.toFixed(1)}%`)
console.log(`Plant FG Alpha:     Silueta: ${r3.fgSilAvg.toFixed(1)}%  vs  U²-NetP: ${r3.fgPAvg.toFixed(1)}%`)
console.log(`Tiger FG Alpha:     Silueta: ${r4.fgSilAvg.toFixed(1)}%  vs  U²-NetP: ${r4.fgPAvg.toFixed(1)}%`)
console.log(`Flamingos FG Alpha: Silueta: ${r5.fgSilAvg.toFixed(1)}%  vs  U²-NetP: ${r5.fgPAvg.toFixed(1)}%`)
console.log(`Leopard FG Alpha:   Silueta: ${r6.fgSilAvg.toFixed(1)}%  vs  U²-NetP: ${r6.fgPAvg.toFixed(1)}%`)
console.log(`Person/Bldg Alpha:  Silueta: ${r7.fgSilAvg.toFixed(1)}%  vs  U²-NetP: ${r7.fgPAvg.toFixed(1)}%`)
