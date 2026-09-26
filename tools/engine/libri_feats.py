# Extract NeMo encoder features + unit labels (misaki GA G2P) from LibriSpeech parquet shards
import sys, io, os, numpy as np, pyarrow.parquet as pq, soundfile as sf, glob, random
os.environ['OMP_NUM_THREADS']='2'
import onnxruntime as ort
import enc
so=ort.SessionOptions(); so.intra_op_num_threads=2
enc.sess=ort.InferenceSession('enc_feat.onnx', so, providers=['CPUExecutionProvider'])
from misaki import en
from units import *
from weak_forms import g2p_weak
from scipy.signal import butter, lfilter
G=en.G2P(trf=False,british=False,fallback=None)
S=os.environ.get('SCHWA_WORK', 'work') + '/' + 'hf/openslr__librispeech_asr/all/'
split=sys.argv[1]; files=sorted(glob.glob(S+split+'/*.parquet')); maxn=int(sys.argv[2]); out=sys.argv[3]
rng=random.Random(0)
feats=[];labs=[];meta=[]
def aug(a):
    if rng.random()<0.3:
        lo=rng.uniform(80,300); hi=rng.uniform(3400,7900); b,aa=butter(2,[lo/8000,hi/8000],'band'); a=lfilter(b,aa,a)
    if rng.random()<0.3:
        n=np.random.randn(len(a)); snr=rng.uniform(10,35); a=a+n/np.std(n)*np.std(a)/10**(snr/20)
    return a.astype(np.float32)
for f in files:
    pf=pq.ParquetFile(f)
    for batch in pf.iter_batches(batch_size=64, columns=['audio','text','speaker_id']):
        for r in batch.to_pylist():
            a,sr=sf.read(io.BytesIO(r['audio']['bytes'])); a=a.astype(np.float32)
            if len(a)>16000*16: continue
            ph,_=g2p_weak(G,r['text'].lower())
            if '❓' in ph: continue
            try: u=to_units(ph)
            except KeyError: continue
            if split.startswith('train'): a=aug(a)
            lp,h=enc.run(a)
            feats.append(h.astype(np.float16)); labs.append(np.array([UIDX[x] for x in u],dtype=np.int16)); meta.append(('libri',r['speaker_id'],r['text'],ph))
            if len(feats)%200==0: print(len(feats),flush=True)
            if len(feats)>=maxn: break
        if len(feats)>=maxn: break
    if len(feats)>=maxn: break
np.save(out, np.array({'feats':feats,'labs':labs,'meta':meta},dtype=object), allow_pickle=True)
print('done',len(feats))
