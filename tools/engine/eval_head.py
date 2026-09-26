import sys, pickle, numpy as np, torch
from units import UNITS
from norm import to_units_ipa, per
from train_head import Head
import enc
torch.set_num_threads(1)
ckpt = sys.argv[1] if len(sys.argv) > 1 else 'head.pt'
m = Head(); m.load_state_dict(torch.load(ckpt)); m.eval()
d = pickle.load(open('saa_fr_en.pkl', 'rb'))
fr = sorted(k for k in d if k.startswith('french'))[:20]; en = sorted(k for k in d if k.startswith('english'))[:10]
# merge unit set for fair comparison with narrow transcripts
MERGE = {'o': 'oʊ', 'e': 'eɪ', 'œ': 'ɜː', 'ʁ': 'r'}
def dec(lp):
    ids = lp.argmax(-1); out = []; prev = -1
    for i in ids:
        if i != prev and i != 0: out.append(UNITS[i])
        prev = i
    return out
res = {}
for k in fr + en:
    a, tr = d[k]
    _, h = enc.run(a)
    with torch.no_grad():
        lp = m(torch.from_numpy(h.astype(np.float32))[None])[0].numpy()
    hyp = [MERGE.get(u, u) for u in dec(lp)]
    ref = [MERGE.get(u, u) for u in to_units_ipa(tr)]
    res[k] = per(ref, hyp)
print('FR PER', round(np.mean([res[k] for k in fr]), 4), 'EN PER', round(np.mean([res[k] for k in en]), 4))
