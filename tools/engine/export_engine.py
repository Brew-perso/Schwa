import sys, onnx, torch, numpy as np, json, shutil, onnxruntime as ort
from onnx import helper, TensorProto
from train_head import Head
from units import UNITS
M='../models/sherpa-onnx-nemo-ctc-en-conformer-small/'
OUT=sys.argv[2]
ckpt=sys.argv[1]
# 1) encoder int8 + feature output renamed 'enc'
m=onnx.load(M+'model.int8.onnx')
names={o for n in m.graph.node for o in n.output}
src='/Transpose_2_output_0'
assert src in names, [n for n in names if 'Transpose' in n][:20]
m.graph.node.append(helper.make_node('Identity',[src],['enc'],name='enc_identity'))
m.graph.output.append(helper.make_tensor_value_info('enc', TensorProto.FLOAT, None))
onnx.save(m, OUT+'/schwa-encoder.int8.onnx')
# 2) head: input (1,176,T) -> logprobs (1,2T,C)
class Wrap(torch.nn.Module):
    def __init__(s,h): super().__init__(); s.h=h
    def forward(s,enc): return s.h(enc.transpose(1,2))
h=Head(); h.load_state_dict(torch.load(ckpt)); h.eval()
w=Wrap(h)
x=torch.randn(1,176,50)
torch.onnx.export(w,(x,),OUT+'/schwa-head.onnx',input_names=['enc'],output_names=['logprobs'],dynamic_axes={'enc':{2:'T'},'logprobs':{1:'T2'}},opset_version=17,dynamo=False)
# verify
s=ort.InferenceSession(OUT+'/schwa-head.onnx')
a=s.run(None,{'enc':x.numpy()})[0]
w.eval()  # torch.onnx.export leaves the module in training mode (dropout on)
with torch.no_grad(): b=w(x).numpy()
print('head max diff', np.abs(a-b).max())
shutil.copy(M+'tokens.txt', OUT+'/bpe-tokens.txt')
json.dump({'version':sys.argv[3] if len(sys.argv)>3 else 'dev','encoder':'schwa-encoder.int8.onnx','head':'schwa-head.onnx','units':UNITS,'bpe':'bpe-tokens.txt',
  'credits':'NeMo stt_en_conformer_ctc_small (CC-BY-4.0, NVIDIA) via sherpa-onnx; Schwa phone head (EUPL-1.2)'}, open(OUT+'/engine.json','w'), ensure_ascii=False)
