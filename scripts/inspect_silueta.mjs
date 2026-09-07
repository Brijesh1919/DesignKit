// ============================================================
// Inspect Silueta ONNX Model
// ============================================================

import fs from 'fs'
import crypto from 'crypto'
import * as ort from 'onnxruntime-node'

const modelPath = 'assets/models/silueta/silueta_320.onnx'
const buf = fs.readFileSync(modelPath)
const sha256 = crypto.createHash('sha256').update(buf).digest('hex')

console.log('🔍 SILUETA MODEL INSPECTION')
console.log(`Path:      ${modelPath}`)
console.log(`Size:      ${buf.byteLength} bytes (${(buf.byteLength / (1024 * 1024)).toFixed(2)} MB)`)
console.log(`SHA-256:   ${sha256}`)

const session = await ort.InferenceSession.create(buf)
console.log('\n[AI SILUETA] Session created successfully')
console.log(`[AI SILUETA] Input names:  ${JSON.stringify(session.inputNames)}`)
console.log(`[AI SILUETA] Output names: ${JSON.stringify(session.outputNames)}`)

// Test inference with dummy [1, 3, 320, 320] tensor
const dummyInput = new ort.Tensor('float32', new Float32Array(1 * 3 * 320 * 320), [1, 3, 320, 320])
const results = await session.run({ [session.inputNames[0]]: dummyInput })

console.log('\n[AI SILUETA] Output Inspection:')
for (const outName of session.outputNames) {
  const tensor = results[outName]
  const data = tensor.data
  let min = Infinity, max = -Infinity, sum = 0
  for (let i = 0; i < data.length; i++) {
    if (data[i] < min) min = data[i]
    if (data[i] > max) max = data[i]
    sum += data[i]
  }
  const mean = sum / data.length
  console.log(`- Output '${outName}': shape = [${tensor.dims.join(', ')}], type = ${tensor.type}, min = ${min.toFixed(6)}, max = ${max.toFixed(6)}, mean = ${mean.toFixed(6)}`)
}
