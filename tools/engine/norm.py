import unicodedata, re
from units import UNITS
# map narrow IPA (SAA transcripts, espeak output) to Schwa units
MULTI=[('tʃ','tʃ'),('ʧ','tʃ'),('dʒ','dʒ'),('ʤ','dʒ'),('eɪ','eɪ'),('aɪ','aɪ'),('ɔɪ','ɔɪ'),('oʊ','oʊ'),('əʊ','oʊ'),('aʊ','aʊ'),
 ('ɪə','ɪə'),('ɛə','ɛə'),('eə','ɛə'),('ʊə','ʊə'),('ɚ','ə r'),('ɝ','ɜː r'),('iː','iː'),('uː','uː'),('ɑː','ɑː'),('ɔː','ɔː'),('ɜː','ɜː'),('ɛː','ɛ')]
SINGLE={'i':'iː','u':'uː','ɑ':'ɑː','ɔ':'ɔː','ɜ':'ɜː','ɐ':'ə','ə':'ə','ɪ':'ɪ','ʊ':'ʊ','ɛ':'ɛ','æ':'æ','ʌ':'ʌ','ɒ':'ɒ','e':'e','o':'o','a':'æ',
 'ɹ':'r','r':'r','ɾ':'t','ʔ':'','ɻ':'r','ɫ':'l','l':'l','ʁ':'ʁ','ʀ':'ʁ','ɡ':'ɡ','g':'ɡ','y':'uː','ø':'œ','œ':'œ','ɨ':'ɪ','ʉ':'uː','ɵ':'o','ɘ':'ə','ɤ':'o','ɯ':'uː',
 'β':'v','ɸ':'f','x':'k','ç':'h','ɦ':'h','ɱ':'m','ɲ':'n','ʎ':'l','ɣ':'ɡ','ʝ':'j','c':'k','ɟ':'ɡ','ɬ':'l'}
for c in 'pbtdkfvθðszʃʒhmnŋlwj': SINGLE[c]=c
def strip(s):
    s=unicodedata.normalize('NFD',s)
    s=''.join(ch for ch in s if not unicodedata.combining(ch))
    s=re.sub(r'[ˈˌ˺ʰˠʲʷ̚ˑ˞\s\.\-‿|ʼ]','',s)
    return s
def to_units_ipa(s):
    s=strip(s); out=[]; i=0
    while i<len(s):
        m=None
        for a,b in MULTI:
            if s.startswith(a,i): m=(a,b); break
        if m: out+=m[1].split(); i+=len(m[0]); continue
        c=s[i]; i+=1
        if c=='ː': continue
        if c in SINGLE:
            if SINGLE[c]: out.append(SINGLE[c])
        # unknown chars dropped
    # collapse geminates
    res=[]
    for u in out:
        if res and res[-1]==u and u not in ('ə',): continue
        res.append(u)
    return res
import editdistance
def per(ref,hyp): return editdistance.eval(ref,hyp)/max(1,len(ref))
