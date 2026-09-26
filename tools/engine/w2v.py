import os
import onnxruntime as ort, numpy as np, json
S=os.environ.get('SCHWA_WORK', 'work') + '/' + ''
MD=S+'hf/onnx-community__wav2vec2-lv-60-espeak-cv-ft-ONNX/'
voc=json.load(open(MD+'vocab.json')); inv={v:k for k,v in voc.items()}
so=ort.SessionOptions(); so.intra_op_num_threads=2
sess=ort.InferenceSession(MD+'onnx/model_quantized.onnx',so,providers=['CPUExecutionProvider'])
def logits(a16):
    x=(a16-a16.mean())/(a16.std()+1e-7)
    o=sess.run(None,{sess.get_inputs()[0].name:x[None].astype(np.float32)})[0][0]
    return o
def decode(o):
    ids=o.argmax(-1); out=[]; prev=-1
    for i in ids:
        if i!=prev and inv[i] not in ('<pad>','<s>','</s>','<unk>'): out.append(inv[i])
        prev=i
    return out
