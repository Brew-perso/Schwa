import numpy as np, soundfile as sf, resampy, torch, sys, os
sys.path.insert(0, '../allosaurus')
from kokoro_onnx import Kokoro
M='../models/'
_k=None
def kokoro():
    global _k
    if _k is None: _k=Kokoro(M+'kokoro-v1.0.onnx', M+'voices-v1.0.bin')
    return _k
def tts(ph, voice, lang='en-us', speed=1.0):
    a,sr=kokoro().create(ph, voice=voice, is_phonemes=True, lang=lang, speed=speed)
    return a.astype(np.float32), sr
# kokoro phoneme -> allosaurus eng2102 phone inventory
KMAP={'A':['e','ɪ'],'I':['a','ɪ'],'O':['o','ʊ'],'Q':['o','ʊ'],'W':['a','ʊ'],'Y':['ɔ','ɪ'],'T':['t'],'ᵊ':['ə'],
 'ɜ':['ɹ̩'],'ɡ':['ɡ'],'ʤ':['d͡ʒ'],'ʧ':['t͡ʃ'],'ɒ':['ɑ'],'ɐ':['ʌ'],'ː':[], 'ˈ':[], 'ˌ':[], ' ':[], '.':[], ',':[], 'ɚ':['ɹ̩'],'ɾ':['t'],'r':['ɹ']}
def k2allo(ph):
    out=[]
    i=0
    while i<len(ph):
        c=ph[i]
        if c=='ɜ' and i+1<len(ph) and ph[i+1]=='ɹ': out.append('ɹ̩'); i+=2; continue
        if c=='ə' and i+1<len(ph) and ph[i+1]=='ɹ': out.append('ɹ̩'); i+=2; continue
        if c in KMAP: out+=KMAP[c]
        else: out.append(c)
        i+=1
    return out
