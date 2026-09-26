import onnx, numpy as np, onnxruntime as ort, kaldi_native_fbank as knf
M='../models/sherpa-onnx-nemo-ctc-en-conformer-small/'
def build():
    m=onnx.load(M+'model.onnx')
    vi=onnx.helper.make_tensor_value_info('/Transpose_2_output_0', onnx.TensorProto.FLOAT, None)
    m.graph.output.append(vi)
    onnx.save(m,'enc_feat.onnx')
import os
if not os.path.exists('enc_feat.onnx'): build()
so=ort.SessionOptions(); so.intra_op_num_threads=4
sess=ort.InferenceSession('enc_feat.onnx', so, providers=['CPUExecutionProvider'])
TOK={int(l.split()[1]):l.split()[0] for l in open(M+'tokens.txt')}
def fbank(samples16k):
    opts = knf.FbankOptions(); opts.frame_opts.dither=0; opts.frame_opts.snip_edges=False
    opts.frame_opts.samp_freq=16000; opts.mel_opts.num_bins=80
    f=knf.OnlineFbank(opts); f.accept_waveform(16000,(samples16k*32768).tolist()); f.input_finished()
    x=np.stack([f.get_frame(i) for i in range(f.num_frames_ready)])
    return ((x-x.mean(0,keepdims=True))/(x.std(0,keepdims=True)+1e-5)).astype(np.float32)
def run(samples16k):
    x=fbank(samples16k)[None].transpose(0,2,1)
    lp,h=sess.run(None,{'audio_signal':x,'length':np.array([x.shape[2]],dtype=np.int64)})
    return lp[0], h[0].T   # (T,1025), (T,D)
def greedy_text(lp):
    ids=lp.argmax(-1); out=[]; prev=-1
    for i in ids:
        if i!=prev and i!=1024: out.append(TOK[i])
        prev=i
    return ''.join(out).replace('▁',' ')
