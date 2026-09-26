import sys, os, random, re, numpy as np, resampy, time
os.environ['OMP_NUM_THREADS']='1'
import onnxruntime as ort
from units import *
from misaki import en
from weak_forms import g2p_weak
from kokoro_onnx import Kokoro
import nltk
from nltk.corpus import brown, gutenberg, webtext
wid=int(sys.argv[1]); nw=int(sys.argv[2]); N=int(sys.argv[3]); split=sys.argv[4]
rng=random.Random(5000+wid+ (99 if split=='val' else 0))
K=Kokoro('../models/kokoro-v1.0.onnx','../models/voices-v1.0.bin')
so=ort.SessionOptions(); so.intra_op_num_threads=1; so.inter_op_num_threads=1
K.sess=ort.InferenceSession('../models/kokoro-v1.0.onnx', so, providers=['CPUExecutionProvider'])
import enc
enc.sess=ort.InferenceSession('enc_feat.onnx', so, providers=['CPUExecutionProvider'])
G={False:en.G2P(trf=False,british=False,fallback=None), True:en.G2P(trf=False,british=True,fallback=None)}
US=[v for v in K.get_voices() if v[:2] in ('af','am') and v!='am_santa']
GB=[v for v in K.get_voices() if v[:2] in ('bf','bm')]
HOLD={'af_river','am_puck','bm_lewis','bf_lily'}
if split=='train': US=[v for v in US if v not in HOLD]; GB=[v for v in GB if v not in HOLD]
else: US=[v for v in US if v in HOLD]; GB=[v for v in GB if v in HOLD]
FR=['ff_siwis']; OTHER=['ef_dora','if_sara','pf_dora','em_alex','im_nicola']
# text pool
sents=[]
for c in (brown,gutenberg,webtext):
    for s in c.sents():
        w=[x for x in s if re.match(r"^[A-Za-z][A-Za-z']*$",x)]
        if 3<=len(w)<=14 and len(w)>=0.8*len(s): sents.append(' '.join(s))
rng.shuffle(sents)
words=[w for w in set(x.lower() for x in brown.words()) if re.match(r'^[a-z]{2,14}$',w)]
def style(vlist):
    a=K.voices[rng.choice(vlist)] if hasattr(K,'voices') else None
    return a
def get_style(v): return K.get_voice_style(v)
def mix_voice(pool):
    v1,v2=rng.sample(pool,2) if len(pool)>1 else (pool[0],pool[0])
    w=rng.uniform(0.0,1.0) if rng.random()<0.6 else 1.0
    return get_style(v1)*w+get_style(v2)*(1-w)
VOW='AIOQWYaeiouæɑɐɒɔəɛɜɪʊʌᵊ'
def french_stress(ph):
    words=ph.split(' ')
    out=[]
    for w in words:
        w2=w.replace('ˈ','').replace('ˌ','')
        idx=[i for i,c in enumerate(w2) if c in VOW]
        if len(idx)>=2 and rng.random()<0.7:
            i=idx[-1]
            # move to start of last syllable-ish (before preceding consonant)
            j=i-1 if i>0 and w2[i-1] not in VOW else i
            w2=w2[:j]+'ˈ'+w2[j:]
            out.append(w2)
        else: out.append(w)
    return ' '.join(out)
def accentize(ph, strength):
    p=lambda: rng.random()<strength
    def sub(m, choices):
        return rng.choice(choices) if p() else m
    out=[]; toks=ph.split(' ')
    for w in toks:
        s=''
        for i,c in enumerate(w):
            if c=='θ': s+=sub(c,['s','s','t','f'])
            elif c=='ð': s+=sub(c,['z','z','d'])
            elif c=='h' and i<=1: s+='' if p() else c
            elif c=='ɪ': s+=sub(c,['i'])
            elif c=='ʊ': s+=sub(c,['u'])
            elif c=='ə' or c=='ᵊ' or c=='ɐ': s+=sub(c,['a','o','e','ɛ','ɔ','œ'])
            elif c=='ʌ': s+=sub(c,['a','ɔ','œ'])
            elif c=='æ': s+=sub(c,['a','ɛ'])
            elif c in 'OQ': s+=sub(c,['o','ɔ'])
            elif c=='A': s+=sub(c,['e','ɛ'])
            elif c=='ɹ': s+=sub(c,['ʁ'])
            elif c=='ɜ': s+=sub(c,['œ','ɛ'])
            elif c=='ŋ': s+=sub(c,['ŋɡ'])
            else: s+=c
        # hypercorrect h
        w2=s
        stripped=w2.lstrip('ˈˌ')
        if stripped and stripped[0] in VOW and rng.random()<strength*0.3: w2=w2[:len(w2)-len(stripped)]+'h'+stripped
        # final consonant drop (-s,-d,-t)
        if len(w2)>2 and w2[-1] in 'sztd' and rng.random()<strength*0.3: w2=w2[:-1]
        out.append(w2)
    res=' '.join(out)
    res=re.sub(r'([aoeɛɔœiu])ː', r'\1', res)
    return res
def augment(a, sr):
    a=a/ (np.abs(a).max()+1e-6) * rng.uniform(0.1,0.9)
    if rng.random()<0.4: # reverb
        L=int(sr*rng.uniform(0.1,0.5)); t=np.arange(L)/sr
        ir=np.random.randn(L)*np.exp(-t/rng.uniform(0.03,0.15)); ir[0]=1; ir/=np.abs(ir).sum()**0.5*3
        from scipy.signal import fftconvolve; a=fftconvolve(a,ir)[:len(a)]
    if rng.random()<0.5: # EQ / bandlimit (phone mic)
        from scipy.signal import butter, lfilter
        lo=rng.uniform(80,300); hi=rng.uniform(3400,7900)
        b,aa=butter(2,[lo/(sr/2),hi/(sr/2)],'band'); a=lfilter(b,aa,a)
    if rng.random()<0.6: # noise
        snr=rng.uniform(8,35)
        n=np.random.randn(len(a))
        if rng.random()<0.5: n=np.cumsum(n); n-=np.convolve(n,np.ones(200)/200,'same')  # brownish
        n=n/np.std(n)*np.std(a)/10**(snr/20); a=a+n
    # leading/trailing silence
    pad1=np.zeros(int(sr*rng.uniform(0.05,0.4))); pad2=np.zeros(int(sr*rng.uniform(0.05,0.4)))
    a=np.concatenate([pad1+np.random.randn(len(pad1))*1e-4,a,pad2+np.random.randn(len(pad2))*1e-4])
    return a.astype(np.float32)
feats=[]; labs=[]; meta=[]
t0=time.time(); i=0
while len(feats)<N:
    i+=1
    try:
        r=rng.random()
        brit = rng.random()<0.4
        if r<0.55: text=sents[(i*nw+wid)%len(sents)]
        else: text=' '.join(rng.sample(words, rng.randint(1,4)))
        ph,_=g2p_weak(G[brit],text)
        if '❓' in ph or len(ph)>200 or len(ph)<3: continue
        mode='native'
        pool = GB if brit else US
        if rng.random()<0.4:
            mode='accent'
            ph=accentize(ph, rng.uniform(0.2,0.8))
            if rng.random()<0.5: ph=french_stress(ph)
            if rng.random()<0.35: pool=FR+ (OTHER if rng.random()<0.3 else [])
        units=to_units(ph)
        if len(units)<2: continue
        stl=mix_voice(pool) if len(pool)>1 else get_style(pool[0])
        a,sr=K.create(ph, voice=stl, is_phonemes=True, speed=rng.uniform(0.8,1.25), lang='en-gb' if brit else 'en-us')
        a=augment(a,sr)
        a16=resampy.resample(a,sr,16000)
        lp,h=enc.run(a16)
        if h.shape[0]*2 < len(units)*1.2: continue
        feats.append(h.astype(np.float16)); labs.append(np.array([UIDX[u] for u in units],dtype=np.int16)); meta.append((mode,brit,text,ph))
        if len(feats)%25==0: print(wid,len(feats),round(time.time()-t0),flush=True)
        if len(feats)%100==0:
            np.save(f'data/{split}_{wid}.npy', np.array({'feats':feats,'labs':labs,'meta':meta},dtype=object), allow_pickle=True)
    except KeyError as e:
        continue
np.save(f'data/{split}_{wid}.npy', np.array({'feats':feats,'labs':labs,'meta':meta},dtype=object), allow_pickle=True)
print('done',wid)
