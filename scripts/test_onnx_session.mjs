import * as ort from 'onnxruntime-node'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const modelPath = path.resolve(__dirname, '../assets/models/text_qa/text_qa.onnx')

async function test() {
  const bytes = fs.readFileSync(modelPath)
  console.log(`Read model file: ${bytes.length} bytes`)

  const session = await ort.InferenceSession.create(bytes)
  console.log('✅ Session created successfully!')
  console.log('Inputs:', session.inputNames)
  console.log('Outputs:', session.outputNames)

  // Test inference
  const seqLen = 6
  const inputIds = new BigInt64Array([101n, 2023n, 2003n, 1037n, 3231n, 102n])
  const attentionMask = new BigInt64Array([1n, 1n, 1n, 1n, 1n, 1n])

  const tensorInputs = {
    input_ids: new ort.Tensor('int64', inputIds, [1, seqLen]),
    attention_mask: new ort.Tensor('int64', attentionMask, [1, seqLen]),
  }

  const results = await session.run(tensorInputs)
  console.log('✅ Inference executed successfully!')
  console.log('Output logits shape:', results.logits.dims)
  console.log('Sample logits data length:', results.logits.data.length)
}

test().catch(err => {
  console.error('❌ Error testing session:', err)
  process.exit(1)
})
