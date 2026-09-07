// ============================================================
// U²-NetP Model Pre-build Validation Script
// ============================================================

import { existsSync, readFileSync, statSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import * as ort from 'onnxruntime-node'

const __dirname = dirname(fileURLToPath(import.meta.url))
const modelPath = resolve(__dirname, '../assets/models/u2netp/u2netp.onnx')

console.log('🔍 Validating U²-NetP ONNX Model...\n')
console.log(`Path: ${modelPath}`)

// 1. File exists
if (!existsSync(modelPath)) {
  console.error('❌ Error: Model file does not exist at:', modelPath)
  process.exit(1)
}
console.log('✓ 1. File exists')

// 2. File size is approximately 4.57 MB
const stats = statSync(modelPath)
const sizeInMB = stats.size / (1024 * 1024)
console.log(`✓ 2. File size: ${stats.size} bytes (${sizeInMB.toFixed(2)} MB)`)

if (sizeInMB < 4.0 || sizeInMB > 5.2) {
  console.error(`❌ Error: Unexpected model file size (${sizeInMB.toFixed(2)} MB). Expected ~4.57 MB.`)
  process.exit(1)
}

// 3. File can be read as binary
let modelBuffer
try {
  modelBuffer = readFileSync(modelPath)
  if (!(modelBuffer instanceof Buffer) || modelBuffer.length === 0) {
    throw new Error('Read buffer is empty or invalid')
  }
  console.log(`✓ 3. File read as binary Buffer (${modelBuffer.byteLength} bytes)`)
} catch (err) {
  console.error('❌ Error: Failed to read model as binary:', err)
  process.exit(1)
}

// 4. ONNX Runtime can create an inference session
let session
try {
  session = await ort.InferenceSession.create(modelBuffer)
  console.log('✓ 4. ONNX Runtime InferenceSession created successfully')
} catch (err) {
  console.error('❌ Error: ONNX Runtime failed to create inference session:', err)
  process.exit(1)
}

// 5. Input name and shape can be inspected
const inputNames = session.inputNames
console.log(`✓ 5. Input names: ${JSON.stringify(inputNames)}`)

const testDims = [1, 3, 320, 320]
const testInput = new ort.Tensor('float32', new Float32Array(1 * 3 * 320 * 320), testDims)
console.log(`✓ Expected input shape: [${testDims.join(', ')}]`)

// 6. Output name and shape can be inspected via test inference
let outputTensor
try {
  const feeds = { [inputNames[0]]: testInput }
  const results = await session.run(feeds)
  const outputNames = session.outputNames
  console.log(`✓ 6. Output names: ${JSON.stringify(outputNames)}`)
  outputTensor = results[outputNames[0]] || Object.values(results)[0]
  console.log(`✓ Output tensor dims: [${outputTensor.dims.join(', ')}]`)
  console.log(`✓ Output elements count: ${outputTensor.data.length}`)
} catch (err) {
  console.error('❌ Error: Failed during inference verification:', err)
  process.exit(1)
}

const dims = outputTensor.dims
if (dims.length !== 4 || dims[0] !== 1 || dims[1] !== 1 || dims[2] !== 320 || dims[3] !== 320) {
  console.error(`❌ Error: Output dims [${dims.join(', ')}] do not match expected [1, 1, 320, 320]`)
  process.exit(1)
}

console.log('\n🎉 U²-NetP ONNX model validation PASSED!')
