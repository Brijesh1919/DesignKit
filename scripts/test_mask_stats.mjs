import fs from 'fs'
import * as ort from 'onnxruntime-node'

// Load model
const modelBuf = fs.readFileSync('assets/models/u2netp/u2netp.onnx')
const session = await ort.InferenceSession.create(modelBuf)

console.log('Inputs:', session.inputNames)
console.log('Outputs:', session.outputNames)

const inputName = session.inputNames[0]
const outputName = session.outputNames[0]

async function testPattern(name, fillFn) {
  const dummyData = new Float32Array(1 * 3 * 320 * 320)
  for (let i = 0; i < 320 * 320; i++) {
    const [r, g, b] = fillFn(i % 320, Math.floor(i / 320))
    dummyData[i] = (r / 255 - 0.485) / 0.229
    dummyData[320 * 320 + i] = (g / 255 - 0.456) / 0.224
    dummyData[2 * 320 * 320 + i] = (b / 255 - 0.406) / 0.225
  }

  const tensor = new ort.Tensor('float32', dummyData, [1, 3, 320, 320])
  const res = await session.run({ [inputName]: tensor })
  const raw = res[outputName].data

  let min = Infinity, max = -Infinity, sum = 0
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i]
    if (v < min) min = v
    if (v > max) max = v
    sum += v
  }
  const mean = sum / raw.length
  
  const sorted = Array.from(raw).sort((a, b) => a - b)
  const p10 = sorted[Math.floor(raw.length * 0.1)]
  const p50 = sorted[Math.floor(raw.length * 0.5)]
  const p90 = sorted[Math.floor(raw.length * 0.9)]

  console.log(`\n--- Pattern: ${name} ---`)
  console.log(`Raw min: ${min.toFixed(6)}, max: ${max.toFixed(6)}, mean: ${mean.toFixed(6)}`)
  console.log(`Percentiles: p10=${p10.toFixed(4)}, p50=${p50.toFixed(4)}, p90=${p90.toFixed(4)}`)
  console.log(`Min 5 sample values:`, sorted.slice(0, 5))
  console.log(`Max 5 sample values:`, sorted.slice(-5))
}

// 1. Circle in center on black bg
await testPattern('Bright Circle on Dark Background', (x, y) => {
  const dx = x - 160, dy = y - 160
  if (dx * dx + dy * dy < 80 * 80) return [240, 200, 180]
  return [20, 20, 30]
})

// 2. White background with central square
await testPattern('Square on White Background', (x, y) => {
  if (x > 80 && x < 240 && y > 80 && y < 240) return [40, 80, 180]
  return [250, 250, 250]
})

// 3. Person-like silhouette
await testPattern('Person silhouette on Outdoor background', (x, y) => {
  const dx = x - 160, dy = y - 80
  if (dx * dx + dy * dy < 30 * 30) return [220, 180, 150]
  if (x > 110 && x < 210 && y >= 110 && y < 270) return [50, 100, 150]
  return [100 + y * 0.3, 150 + y * 0.2, 220 - y * 0.2]
})
