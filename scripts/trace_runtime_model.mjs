// ============================================================
// Runtime Verification of Restored U²-NetP Model
// ============================================================

import fs from 'fs'
import crypto from 'crypto'
import * as ort from 'onnxruntime-node'

console.log('--- VERIFYING BUNDLED PRODUCTION MODEL ---')
const chunksPath = 'src/ai/u2netp_chunks.ts'
if (!fs.existsSync(chunksPath)) {
  console.error(`❌ ${chunksPath} does not exist!`)
  process.exit(1)
}

const chunksContent = fs.readFileSync(chunksPath, 'utf-8')
const match = chunksContent.match(/export const U2NETP_MODEL_CHUNKS: string\[\] = (\[[\s\S]*?\])/)
if (!match) {
  console.error('❌ Could not parse U2NETP_MODEL_CHUNKS!')
  process.exit(1)
}
const chunks = JSON.parse(match[1])

let totalLen = 0
const decoded = []
for (let i = 0; i < chunks.length; i++) {
  const buf = Buffer.from(chunks[i], 'base64')
  totalLen += buf.length
  decoded.push(buf)
}
const runtimeModelBuffer = Buffer.concat(decoded)
const sha256 = crypto.createHash('sha256').update(runtimeModelBuffer).digest('hex')

console.log(`ACTIVE MODEL:             U²-NetP`)
console.log(`MODEL SOURCE:             u2netp.onnx`)
console.log(`MODEL BYTES:              ${runtimeModelBuffer.length}`)
console.log(`MODEL BUNDLE:             src/ai/u2netp_chunks.ts (${chunks.length} chunks)`)
console.log(`MODEL SHA-256:            ${sha256}`)
console.log(`U2NET (176MB) IN BUNDLE:  ${fs.existsSync('src/ai/u2net_chunks.ts') ? 'YES' : 'NO'}`)

const distHtmlStats = fs.statSync('dist/index.html')
console.log(`DIST INDEX SIZE:          ${(distHtmlStats.size / 1024).toFixed(2)} kB (${(distHtmlStats.size / (1024*1024)).toFixed(2)} MB)`)

console.log('\n--- VERIFYING RUNTIME SESSION INITIALIZATION ---')
console.log('[AI] U2NetP initialization started')
console.log('[AI] Loading U2NetP binary model')
console.log(`[AI] U2NetP model bytes: ${runtimeModelBuffer.length}`)
console.log('[AI] U2NetP session creating')

const t0 = performance.now()
const session = await ort.InferenceSession.create(runtimeModelBuffer)
const sessionTime = (performance.now() - t0).toFixed(1)
console.log(`[AI] U2NetP model ready (in ${sessionTime} ms)`)
console.log(`✓ Active input names: ${JSON.stringify(session.inputNames)}`)
console.log(`✓ Active output count: ${session.outputNames.length}`)
