"""Fixtures for calibrating the TS evaluator: audio (float32 .bin) + phone log-probs from the exported ONNX engine."""
import json, sys, os, numpy as np, onnxruntime as ort, resampy
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0,ROOT + '/tools')
from kokoro_onnx import Kokoro
import enc
OUT=ROOT + '/tests/fixtures/eval'
os.makedirs(OUT, exist_ok=True)
K=Kokoro('../models/kokoro-v1.0.onnx','../models/voices-v1.0.bin')
E=ort.InferenceSession(ROOT + '/public/models/schwa-encoder.int8.onnx')
H=ort.InferenceSession(ROOT + '/public/models/schwa-head.onnx')
C=ROOT + '/public/content/targets/'
def item(tid, pred):
    t=json.load(open(C+tid+'.json'))
    for it in t['production']+t['guided']:
        if pred(it): return t, it
    raise KeyError(tid)
def run(a16):
    x=enc.fbank(a16)[None].transpose(0,2,1)
    _,f=E.run(None,{'audio_signal':x,'length':np.array([x.shape[2]],dtype=np.int64)})
    return H.run(None,{'enc':f})[0][0]
cases=[]
def final_rise(a, sr, st=7.0, dur=0.4):
    """PSOLA: keep the contour, then raise the last `dur` s of voiced speech by a ramp up to +st semitones."""
    import parselmouth
    from parselmouth.praat import call
    snd=parselmouth.Sound(a.astype(np.float64), sampling_frequency=sr)
    man=call(snd,'To Manipulation',0.01,70,450)
    pt=call(man,'Extract pitch tier')
    p=snd.to_pitch(time_step=0.01); f=p.selected_array['frequency']; ts=p.xs()
    vt=ts[f>0]; t1=float(vt[-1]); t0=t1-dur
    n=call(pt,'Get number of points')
    pts=[(call(pt,'Get time from index',i), call(pt,'Get value at index',i)) for i in range(1,n+1)]
    call(pt,'Remove points between',t0,t1+0.1)
    base=float(np.median([v for t,v in pts if t<t0][-5:]))
    low=base*2**(-1.5/12)
    call(pt,'Add point',t0,base); call(pt,'Add point',t0+dur*0.35,low); call(pt,'Add point',t1,low*2**(st/12))
    call([man,pt],'Replace pitch tier')
    out=call(man,'Get resynthesis (overlap-add)')
    return out.values[0].astype(np.float32)
def add(name, tid, pred, kph_fn, voices, label, variety='GA', expect=None, pair=None, post=None):
    t,it=item(tid,pred)
    ref=it['pair'][0]['ref'][variety] if pair is not None else it['ref'][variety]
    comp=it['pair'][1]['ref'][variety] if pair is not None else None
    checks=it.get('checks',{}).get(variety,[])
    for v in voices:
        kph=kph_fn(ref)
        a,sr=K.create(kph, voice=v, is_phonemes=True, lang='en-gb' if variety=='SBE' else 'en-us')
        if post: a=post(a,sr)
        a16=resampy.resample(a,sr,16000).astype(np.float32)
        a16=np.concatenate([np.zeros(3200,np.float32),a16,np.zeros(4800,np.float32)]); a16=a16+np.random.RandomState(0).randn(len(a16)).astype(np.float32)*1.5e-3
        lp=run(a16)
        fn=f'{name}-{v}'
        a16.tofile(f'{OUT}/{fn}.audio.bin'); lp.astype(np.float32).tofile(f'{OUT}/{fn}.lp.bin')
        cases.append({'id':fn,'target':tid,'kind':t['kind'],'level':t['level'],'label':label,'T':int(lp.shape[0]),'V':int(lp.shape[1]),
                      'ref':ref,'checks':checks,'expect':expect or {},'competitor':comp,'kph':kph})
V=['af_heart','am_michael','af_nicole','am_adam']
# kokoro phoneme strings: rebuild from ref? simplest: use misaki via content kph is not stored -> use explicit strings
from misaki import en
G=en.G2P(trf=False,british=False,fallback=None)
def kph_of(text): return G(text)[0]
def sub(text, a, b): return kph_of(text).replace(a,b,1)
add('think-ok','b1-th',lambda i:i.get('type')=='pair' and i['pair'][0]['text']=='think',lambda r:kph_of('think'),V,'target',pair=0)
add('think-s','b1-th',lambda i:i.get('type')=='pair' and i['pair'][0]['text']=='think',lambda r:sub('think','θ','s'),V,'competitor',pair=0)
add('heat-ok','a2-h',lambda i:i.get('type')=='pair' and i['pair'][0]['text']=='heat',lambda r:kph_of('heat'),V,'target',pair=0)
add('heat-drop','a2-h',lambda i:i.get('type')=='pair' and i['pair'][0]['text']=='heat',lambda r:kph_of('eat'),V,'competitor',pair=0)
add('ship-ok','a2-ih-iy',lambda i:i.get('type')=='pair' and i['pair'][0]['text']=='ship',lambda r:kph_of('ship'),V,'target',pair=0)
add('ship-ee','a2-ih-iy',lambda i:i.get('type')=='pair' and i['pair'][0]['text']=='ship',lambda r:kph_of('sheep'),V,'competitor',pair=0)
# sentence-level segment checks
add('harry-ok','a2-h',lambda i:i.get('text')=='Harry has a horse in his house.',lambda r:kph_of('Harry has a horse in his house.'),V,'clear')
add('harry-drop','a2-h',lambda i:i.get('text')=='Harry has a horse in his house.',lambda r:kph_of('Harry has a horse in his house.').replace('hˈɔɹs','ˈɔɹs').replace('hˈWs','ˈWs'),V,'error')
add('thank-ok','b1-th',lambda i:i.get('text')=='Thank you for the three things.',lambda r:kph_of('Thank you for the three things.'),V,'clear')
add('thank-s','b1-th',lambda i:i.get('text')=='Thank you for the three things.',lambda r:kph_of('Thank you for the three things.').replace('θ','s'),V,'error')
# stress
add('photo-ok','b1-stress-long',lambda i:i.get('text')=='photograph',lambda r:kph_of('photograph'),V,'clear',expect={'stressWord':0,'stress':0})
add('photo-fr','b1-stress-long',lambda i:i.get('text')=='photograph',lambda r:'fOtOɡɹˈæf',V,'error',expect={'stressWord':0,'stress':0})
add('hotel-ok','a2-stress2',lambda i:i.get('text')=='hotel',lambda r:kph_of('hotel'),V,'clear',expect={'stressWord':0,'stress':1})
add('career-ok','a2-stress2',lambda i:i.get('text')=='career',lambda r:kph_of('career'),V,'clear',expect={'stressWord':0,'stress':1})
add('career-fr','a2-stress2',lambda i:i.get('text')=='career',lambda r:'kˈɛɹiɹ',V,'error',expect={'stressWord':0,'stress':1})
add('develop-ok','b1-stress-long',lambda i:i.get('text')=='development',lambda r:kph_of('development'),V,'clear',expect={'stressWord':0,'stress':1})
add('develop-fr','b1-stress-long',lambda i:i.get('text')=='development',lambda r:'dɛvɛlɔpmˈɛnt',V,'error',expect={'stressWord':0,'stress':1})
# tone
add('fall-ok','b2-final-fall',lambda i:i.get('text')=='I work in a bank.',lambda r:kph_of('I work in a bank.'),V,'clear',expect={'tone':'fall'})
add('fall-rise','b2-final-fall',lambda i:i.get('text')=='I work in a bank.',lambda r:kph_of('I work in a bank.'),V,'error',expect={'tone':'fall'},post=final_rise)
json.dump(cases,open(OUT+'/cases.json','w'),ensure_ascii=False)
print(len(cases))
