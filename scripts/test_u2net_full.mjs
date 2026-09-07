// ============================================================
// U²-Net Full (176 MB) vs U²-NetP (4.57 MB) Controlled Test
// ============================================================

import fs from 'fs'
import * as ort from 'onnxruntime-node'

function getMemString() {
  const m = process.memoryUsage()
  const mb = bytes => (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return `Heap: ${mb(m.heapUsed)} / RSS: ${mb(m.rss)} / Ext: ${mb(m.external)}`
}

console.log('🔬 STARTING CONTROLLED U²-NET (FULL) ISOLATED TEST...\n')

// 1. Memory before session
console.log(`[AI] U2Net test initialization started`)
console.log(`[AI] Memory before U2Net session: ${getMemString()}`)

const u2netPath = 'assets/models/u2net/u2net.onnx'
const u2netBuf = fs.readFileSync(u2netPath)
console.log(`[AI] U2Net model bytes: ${u2netBuf.byteLength} bytes (${(u2netBuf.byteLength / (1024 * 1024)).toFixed(2)} MB)`)

// 2. Create session & measure time
console.log(`[AI] U2Net session creating`)
const t0 = performance.now()
const sessionFull = await ort.InferenceSession.create(u2netBuf)
const sessionTime = (performance.now() - t0).toFixed(1)
console.log(`[AI] U2Net model ready in ${sessionTime} ms`)
console.log(`[AI] Memory after U2Net session: ${getMemString()}`)

// 3. Inspect Outputs
console.log(`\n[AI] U2Net output count: ${sessionFull.outputNames.length}`)
sessionFull.outputNames.forEach((name, idx) => {
  console.log(`[AI] U2Net output ${idx} name: '${name}'`)
})

// Also load U2NetP for side-by-side comparison
const u2netpBuf = fs.readFileSync('assets/models/u2netp/u2netp.onnx')
const sessionP = await ort.InferenceSession.create(u2netpBuf)

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

// Benchmark inference on both models
async function runComparison(testName, generateFn) {
  const { pixels, fgCheckFn } = generateFn(320, 320)
  const tensor = preprocess(pixels, 320, 320)

  // Test Full U2-Net
  const tStartFull = performance.now()
  const resultsFull = await sessionFull.run({ [sessionFull.inputNames[0]]: tensor })
  const infTimeFull = (performance.now() - tStartFull).toFixed(1)
  const rawFull = resultsFull[sessionFull.outputNames[0]].data
  const { normalized: normFull, minVal: minFull, maxVal: maxFull } = normPRED(rawFull)

  // Test U2-NetP
  const tStartP = performance.now()
  const resultsP = await sessionP.run({ [sessionP.inputNames[0]]: tensor })
  const infTimeP = (performance.now() - tStartP).toFixed(1)
  const rawP = resultsP[sessionP.outputNames[0]].data
  const { normalized: normP, minVal: minP, maxVal: maxP } = normPRED(rawP)

  // Evaluate foreground vs background
  let fgFullSum = 0, bgFullSum = 0, fgCount = 0, bgCount = 0
  let fgPSum = 0, bgPSum = 0

  for (let y = 0; y < 320; y++) {
    for (let x = 0; x < 320; x++) {
      const idx = y * 320 + x
      const isFg = fgCheckFn(x, y)
      if (isFg) {
        fgFullSum += normFull[idx]
        fgPSum += normP[idx]
        fgCount++
      } else {
        bgFullSum += normFull[idx]
        bgPSum += normP[idx]
        bgCount++
      }
    }
  }

  const fgFullAvg = (fgFullSum / Math.max(1, fgCount)) * 100
  const bgFullAvg = (bgFullSum / Math.max(1, bgCount)) * 100
  const fgPAvg = (fgPSum / Math.max(1, fgCount)) * 100
  const bgPAvg = (bgPSum / Math.max(1, bgCount)) * 100

  console.log(`\n======================================================`)
  console.log(`Test Case: ${testName}`)
  console.log(`======================================================`)
  console.log(`[U²-Net Full]  Inference: ${infTimeFull} ms | Raw range: [${minFull.toFixed(5)}, ${maxFull.toFixed(5)}]`)
  console.log(`               FG Avg: ${fgFullAvg.toFixed(1)}% | BG Avg: ${bgFullAvg.toFixed(1)}% | Contrast: ${(fgFullAvg - bgFullAvg).toFixed(1)}%`)
  console.log(`[U²-NetP]      Inference: ${infTimeP} ms | Raw range: [${minP.toFixed(5)}, ${maxP.toFixed(5)}]`)
  console.log(`               FG Avg: ${fgPAvg.toFixed(1)}% | BG Avg: ${bgPAvg.toFixed(1)}% | Contrast: ${(fgPAvg - bgPAvg).toFixed(1)}%`)
  console.log(`Quality Delta: Full U²-Net FG preservation is ${fgFullAvg >= fgPAvg ? '+' : ''}${(fgFullAvg - fgPAvg).toFixed(1)}% higher`)

  return { infTimeFull, infTimeP, fgFullAvg, fgPAvg, bgFullAvg, bgPAvg }
}

// ----------------------------------------------------
// 7 TEST CASE GENERATORS (representing the 7 user images)
// ----------------------------------------------------

// 1. Tent Scene (Low light / night camping background)
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
        pixels[idx] = 175; pixels[idx + 1] = 95; pixels[idx + 2] = 35; pixels[idx + 3] = 255 // illuminated canvas
      } else {
        pixels[idx] = 12; pixels[idx + 1] = 18; pixels[idx + 2] = 32; pixels[idx + 3] = 255 // dark night sky / trees
      }
    }
  }
  return { pixels, fgCheckFn: fgCheck }
}

// 2. Person under Night Sky (silhouette + head & body)
function genPersonNight(w, h) {
  const pixels = new Uint8Array(w * h * 4)
  const fgCheck = (x, y) => {
    // Head
    const dx = x - 160, dy = y - 80
    if (dx * dx + dy * dy < 25 * 25) return true
    // Torso / Jacket
    if (x >= 125 && x <= 195 && y >= 105 && y <= 210) return true
    // Legs
    if ((x >= 130 && x <= 155 && y > 210 && y <= 290) || (x >= 165 && x <= 190 && y > 210 && y <= 290)) return true
    return false
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      if (fgCheck(x, y)) {
        pixels[idx] = 90; pixels[idx + 1] = 80; pixels[idx + 2] = 75; pixels[idx + 3] = 255 // low-contrast person in dark jacket
      } else {
        pixels[idx] = 15; pixels[idx + 1] = 20; pixels[idx + 2] = 40; pixels[idx + 3] = 255 // starry dark night sky
      }
    }
  }
  return { pixels, fgCheckFn: fgCheck }
}

// 3. Plant with thin stems & leaves
function genPlant(w, h) {
  const pixels = new Uint8Array(w * h * 4)
  const fgCheck = (x, y) => {
    // Pot
    if (x >= 130 && x <= 190 && y >= 230 && y <= 280) return true
    // Central stem
    if (x >= 158 && x <= 162 && y >= 110 && y < 230) return true
    // Leaves (branches left and right)
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
        pixels[idx] = 45; pixels[idx + 1] = 140; pixels[idx + 2] = 60; pixels[idx + 3] = 255 // plant green
      } else {
        pixels[idx] = 220; pixels[idx + 1] = 220; pixels[idx + 2] = 225; pixels[idx + 3] = 255 // indoor light wall
      }
    }
  }
  return { pixels, fgCheckFn: fgCheck }
}

// 4. Tiger / Big Cat on Grass
function genTiger(w, h) {
  const pixels = new Uint8Array(w * h * 4)
  const fgCheck = (x, y) => {
    // Body ellipse
    const dx = (x - 160) / 75, dy = (y - 180) / 45
    if (dx * dx + dy * dy <= 1) return true
    // Head circle
    const hx = x - 230, hy = y - 150
    if (hx * hx + hy * hy <= 30 * 30) return true
    return false
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      if (fgCheck(x, y)) {
        pixels[idx] = 210; pixels[idx + 1] = 120; pixels[idx + 2] = 30; pixels[idx + 3] = 255 // orange fur
      } else {
        pixels[idx] = 70; pixels[idx + 1] = 130; pixels[idx + 2] = 40; pixels[idx + 3] = 255 // green grass
      }
    }
  }
  return { pixels, fgCheckFn: fgCheck }
}

// 5. Flamingos (Thin Legs & Slender Necks)
function genFlamingos(w, h) {
  const pixels = new Uint8Array(w * h * 4)
  const fgCheck = (x, y) => {
    // Body
    if (Math.hypot(x - 160, y - 140) < 35) return true
    // Thin neck
    if (x >= 180 && x <= 186 && y >= 90 && y < 140) return true
    // Head
    if (Math.hypot(x - 190, y - 85) < 15) return true
    // Thin legs (2-3px)
    if ((x >= 150 && x <= 153 && y >= 170 && y <= 270) || (x >= 165 && x <= 168 && y >= 170 && y <= 270)) return true
    return false
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      if (fgCheck(x, y)) {
        pixels[idx] = 240; pixels[idx + 1] = 110; pixels[idx + 2] = 140; pixels[idx + 3] = 255 // pink flamingo
      } else {
        pixels[idx] = 40; pixels[idx + 1] = 120; pixels[idx + 2] = 180; pixels[idx + 3] = 255 // water blue
      }
    }
  }
  return { pixels, fgCheckFn: fgCheck }
}

// 6. Leopard (Detailed Spots & Camouflage)
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
        pixels[idx] = 160; pixels[idx + 1] = 150; pixels[idx + 2] = 100; pixels[idx + 3] = 255 // dry savanna background
      }
    }
  }
  return { pixels, fgCheckFn: fgCheck }
}

// 7. Person / Building Urban Scene
function genPersonBuilding(w, h) {
  const pixels = new Uint8Array(w * h * 4)
  const fgCheck = (x, y) => {
    // Person in foreground left
    const hDist = Math.hypot(x - 120, y - 100)
    if (hDist < 25) return true
    if (x >= 95 && x <= 145 && y >= 125 && y <= 270) return true
    return false
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      if (fgCheck(x, y)) {
        pixels[idx] = 220; pixels[idx + 1] = 70; pixels[idx + 2] = 70; pixels[idx + 3] = 255 // red jacket person
      } else {
        // Building facade with windows
        const win = ((x % 40 < 20) && (y % 40 < 20)) ? 80 : 170
        pixels[idx] = win; pixels[idx + 1] = win + 10; pixels[idx + 2] = win + 20; pixels[idx + 3] = 255
      }
    }
  }
  return { pixels, fgCheckFn: fgCheck }
}

// Memory before inference
console.log(`\n[AI] Memory before U2Net inference: ${getMemString()}`)

// Run all 7 tests
const r1 = await runComparison('1. Tent (Low Light Camping)', genTent)
const r2 = await runComparison('2. Person under Night Sky', genPersonNight)
const r3 = await runComparison('3. Plant with Thin Stems & Leaves', genPlant)
const r4 = await runComparison('4. Tiger / Big Cat on Grass', genTiger)
const r5 = await runComparison('5. Flamingos (Thin Legs & Slender Neck)', genFlamingos)
const r6 = await runComparison('6. Leopard (Camouflage / Texture)', genLeopard)
const r7 = await runComparison('7. Person / Building Urban Scene', genPersonBuilding)

// Memory after inference
console.log(`\n[AI] Memory after U2Net inference: ${getMemString()}`)

console.log('\n======================================================')
console.log('SUMMARY TABLE: U²-Net (Full 176MB) vs U²-NetP (4.57MB)')
console.log('======================================================')
console.log(`Session Load Time:  Full U²-Net: ${sessionTime} ms`)
console.log(`Tent FG Alpha:      Full U²-Net: ${r1.fgFullAvg.toFixed(1)}%  vs  U²-NetP: ${r1.fgPAvg.toFixed(1)}%`)
console.log(`Person Night Alpha: Full U²-Net: ${r2.fgFullAvg.toFixed(1)}%  vs  U²-NetP: ${r2.fgPAvg.toFixed(1)}%`)
console.log(`Plant FG Alpha:     Full U²-Net: ${r3.fgFullAvg.toFixed(1)}%  vs  U²-NetP: ${r3.fgPAvg.toFixed(1)}%`)
console.log(`Tiger FG Alpha:     Full U²-Net: ${r4.fgFullAvg.toFixed(1)}%  vs  U²-NetP: ${r4.fgPAvg.toFixed(1)}%`)
console.log(`Flamingos FG Alpha: Full U²-Net: ${r5.fgFullAvg.toFixed(1)}%  vs  U²-NetP: ${r5.fgPAvg.toFixed(1)}%`)
console.log(`Leopard FG Alpha:   Full U²-Net: ${r6.fgFullAvg.toFixed(1)}%  vs  U²-NetP: ${r6.fgPAvg.toFixed(1)}%`)
console.log(`Person/Bldg Alpha:  Full U²-Net: ${r7.fgFullAvg.toFixed(1)}%  vs  U²-NetP: ${r7.fgPAvg.toFixed(1)}%`)
