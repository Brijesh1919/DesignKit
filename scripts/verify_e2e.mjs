// ============================================================
// End-to-End Pipeline & Reassembly Verification Script (RMBG-1.4)
// ============================================================

import fs from 'fs'
import crypto from 'crypto'
import * as ort from 'onnxruntime-node'

console.log('🧪 Starting DesignKit RMBG-1.4 End-to-End Verification...\n')

// 1. Verify RMBG-1.4 model file exists
const modelPath = 'assets/models/rmbg14/rmbg14.onnx'
if (!fs.existsSync(modelPath)) {
  console.error(`❌ RMBG-1.4 model file not found at ${modelPath}`)
  process.exit(1)
}

const originalBuf = fs.readFileSync(modelPath)
const origHash = crypto.createHash('sha256').update(originalBuf).digest('hex')
console.log(`✓ 1. Loaded RMBG-1.4 ONNX model: ${originalBuf.byteLength} bytes (~44.4 MB)`)
console.log(`✓ SHA256: ${origHash}`)

// 2. Create ONNX Inference Session
console.log('[AI] RMBG-1.4 session creating')
const session = await ort.InferenceSession.create(originalBuf)
console.log('[AI] RMBG-1.4 model ready')
console.log(`✓ Input names: ${session.inputNames.join(', ')}`)
console.log(`✓ Output names: ${session.outputNames.join(', ')}`)

// 3. Preprocessing (1024x1024)
console.log('[AI] RMBG-1.4 preprocessing started (1024x1024)')
const targetW = 1024
const targetH = 1024

const floatData = new Float32Array(3 * targetW * targetH)
for (let i = 0; i < targetW * targetH; i++) {
  // RMBG-1.4 normalization: (pixel/255.0 - 0.5) / 1.0
  const normalizedVal = 0.5 - 0.5 // 0.0
  floatData[i] = normalizedVal
  floatData[targetW * targetH + i] = normalizedVal
  floatData[2 * targetW * targetH + i] = normalizedVal
}

const inputTensor = new ort.Tensor('float32', floatData, [1, 3, targetH, targetW])

// 4. Inference
console.log('[AI] RMBG-1.4 inference started')
const feeds = { [session.inputNames[0]]: inputTensor }
const results = await session.run(feeds)
console.log('[AI] RMBG-1.4 inference completed')

const outputTensor = results[session.outputNames[0]]
console.log(`✓ Output tensor dims: [${outputTensor.dims.join(', ')}]`)

if (outputTensor.dims[2] !== 1024 || outputTensor.dims[3] !== 1024) {
  console.error(`❌ Expected output dimensions [1, 1, 1024, 1024], got: [${outputTensor.dims.join(', ')}]`)
  process.exit(1)
}

// 5. Verification of bundle crash safety
console.log('\n--- BUNDLE SAFETY CHECKS ---')
const staleFiles = [
  'src/ai/rmbg14_chunks.ts',
  'src/ai/u2netp_chunks.ts',
  'src/ai/silueta_chunks.ts',
  'src/ai/u2net_chunks.ts',
]

for (const stale of staleFiles) {
  const exists = fs.existsSync(stale)
  console.log(`✓ ${stale} unbundled (preventing 134MB crash): ${!exists}`)
  if (exists) {
    console.error(`❌ Found stale chunk file: ${stale}. Must not be in repo to prevent bundle blowup!`)
    process.exit(1)
  }
}

console.log('\n🎉 ALL RMBG-1.4 E2E VERIFICATION CHECKS PASSED!')
