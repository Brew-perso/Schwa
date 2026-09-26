# Unified phone inventory for Schwa engine (GA + SBE + French-accent units)
UNITS=['<b>','p','b','t','d','k','ɡ','f','v','θ','ð','s','z','ʃ','ʒ','h','tʃ','dʒ','m','n','ŋ','l','r','w','j',
 'iː','ɪ','ɛ','æ','ʌ','ɑː','ɒ','ɔː','ʊ','uː','ɜː','ə','eɪ','aɪ','ɔɪ','oʊ','aʊ','ɪə','ɛə','ʊə',
 'o','e','œ','ʁ']
UIDX={u:i for i,u in enumerate(UNITS)}
PAIRS={'ɪə':'ɪə','ɛə':'ɛə','ʊə':'ʊə','ɛː':'ɛə','eə':'ɛə','ɜɹ':None}
SINGLE={'A':['eɪ'],'I':['aɪ'],'O':['oʊ'],'Q':['oʊ'],'W':['aʊ'],'Y':['ɔɪ'],'T':['t'],'ɾ':['t'],'ʔ':['t'],
 'ʤ':['dʒ'],'ʧ':['tʃ'],'ɹ':['r'],'ᵊ':['ə'],'ɚ':['ə','r'],'ɜ':['ɜː'],'i':['iː'],'u':['uː'],'ɑ':['ɑː'],'ɔ':['ɔː'],
 'ɐ':['ə'],'ɒ':['ɒ'],'ɡ':['ɡ'],'g':['ɡ'],'ɛ':['ɛ'],'æ':['æ'],'ʌ':['ʌ'],'ɪ':['ɪ'],'ʊ':['ʊ'],'ə':['ə'],'ᵻ':['ɪ'],
 'o':['o'],'e':['e'],'a':['æ'],'œ':['œ'],'ø':['œ'],'y':['uː'],'ʁ':['ʁ'],'ç':['h'],'x':['k']}
for c in 'pbtdkfvθðszʃʒhmnŋlwj': SINGLE[c]=[c]
SKIP=set("ˈˌː ,.!?;:—-'\"()“”…̃")
def to_units(ph):
    out=[]; i=0
    while i<len(ph):
        two=ph[i:i+2]
        if two in ('ɪə','ɛə','ʊə','eə'): out.append('ɛə' if two=='eə' else two); i+=2; continue
        if two=='ɛː': out.append('ɛə'); i+=2; continue
        c=ph[i]
        if c in SKIP: i+=1; continue
        if c in SINGLE: out+=SINGLE[c]; i+=1; continue
        raise KeyError(c)
    return out
