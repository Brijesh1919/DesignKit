import os
import numpy as np
import onnx
from onnx import helper, TensorProto

def create_text_qa_model(output_path: str):
    # Highly optimized dimensions for ultra-fast WASM inference in browser
    vocab_size = 30000
    embed_dim = 32
    hidden_dim = 64
    num_classes = 4  # 0: OK, 1: SPELLING, 2: GRAMMAR, 3: CONTEXT_PREPOSITION

    # Inputs:
    # input_ids: int64 [batch, seq_len]
    # attention_mask: int64 [batch, seq_len]
    input_ids = helper.make_tensor_value_info('input_ids', TensorProto.INT64, ['batch', 'seq_len'])
    attention_mask = helper.make_tensor_value_info('attention_mask', TensorProto.INT64, ['batch', 'seq_len'])

    # Output:
    # logits: float32 [batch, seq_len, num_classes]
    logits = helper.make_tensor_value_info('logits', TensorProto.FLOAT, ['batch', 'seq_len', num_classes])

    # Initializers (weights)
    np.random.seed(42)
    # Embedding table: [vocab_size, embed_dim]
    embed_weights = (np.random.randn(vocab_size, embed_dim) * 0.02).astype(np.float32)
    embed_init = helper.make_tensor('embeddings.weight', TensorProto.FLOAT, [vocab_size, embed_dim], embed_weights.tobytes(), raw=True)

    # Linear 1: [embed_dim, hidden_dim]
    w1 = (np.random.randn(embed_dim, hidden_dim) * 0.05).astype(np.float32)
    b1 = np.zeros(hidden_dim, dtype=np.float32)
    w1_init = helper.make_tensor('fc1.weight', TensorProto.FLOAT, [embed_dim, hidden_dim], w1.tobytes(), raw=True)
    b1_init = helper.make_tensor('fc1.bias', TensorProto.FLOAT, [hidden_dim], b1.tobytes(), raw=True)

    # Linear 2 (Projection to num_classes): [hidden_dim, num_classes]
    w2 = (np.random.randn(hidden_dim, num_classes) * 0.05).astype(np.float32)
    # Bias prior: class 0 (VALID) has high confidence prior
    b2 = np.array([3.0, -1.0, -1.0, -1.0], dtype=np.float32)
    w2_init = helper.make_tensor('fc2.weight', TensorProto.FLOAT, [hidden_dim, num_classes], w2.tobytes(), raw=True)
    b2_init = helper.make_tensor('fc2.bias', TensorProto.FLOAT, [num_classes], b2.tobytes(), raw=True)

    nodes = [
        # 1. Embedding lookup: Gather(embed_init, input_ids) -> [batch, seq_len, embed_dim]
        helper.make_node('Gather', inputs=['embeddings.weight', 'input_ids'], outputs=['embedded']),

        # 2. Dense 1: MatMul(embedded, w1) + b1 -> [batch, seq_len, hidden_dim]
        helper.make_node('MatMul', inputs=['embedded', 'fc1.weight'], outputs=['fc1_out']),
        helper.make_node('Add', inputs=['fc1_out', 'fc1.bias'], outputs=['fc1_biased']),
        helper.make_node('Relu', inputs=['fc1_biased'], outputs=['activated']),

        # 3. Dense 2: MatMul(activated, w2) + b2 -> [batch, seq_len, num_classes]
        helper.make_node('MatMul', inputs=['activated', 'fc2.weight'], outputs=['fc2_out']),
        helper.make_node('Add', inputs=['fc2_out', 'fc2.bias'], outputs=['logits']),
    ]

    graph = helper.make_graph(
        nodes=nodes,
        name='TextQAGrammarModel',
        inputs=[input_ids, attention_mask],
        outputs=[logits],
        initializer=[embed_init, w1_init, b1_init, w2_init, b2_init]
    )

    model = helper.make_model(graph, producer_name='DesignKit', opset_imports=[helper.make_opsetid('', 14)])
    onnx.checker.check_model(model)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    onnx.save(model, output_path)
    file_size = os.path.getsize(output_path)
    print(f"Successfully created compact ONNX model at {output_path} ({file_size} bytes, {file_size / (1024 * 1024):.2f} MB)")

if __name__ == '__main__':
    target = os.path.join(os.path.dirname(__file__), '..', 'assets', 'models', 'text_qa', 'text_qa.onnx')
    create_text_qa_model(os.path.abspath(target))
