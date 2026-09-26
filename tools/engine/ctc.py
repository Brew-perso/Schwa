import numpy as np
def ctc_ll(lp, seq):
    # lp: T x V log probs, blank=0 ; seq: list of ids
    T=lp.shape[0]; L=2*len(seq)+1
    ext=[0]*L
    for i,s in enumerate(seq): ext[2*i+1]=s
    a=np.full(L,-np.inf); a[0]=lp[0,0]
    if L>1: a[1]=lp[0,ext[1]]
    for t in range(1,T):
        na=np.full(L,-np.inf)
        for s in range(L):
            v=a[s]
            if s>0: v=np.logaddexp(v,a[s-1])
            if s>1 and ext[s]!=0 and ext[s]!=ext[s-2]: v=np.logaddexp(v,a[s-2])
            na[s]=v+lp[t,ext[s]]
        a=na
    return np.logaddexp(a[-1],a[-2]) if L>1 else a[-1]
def greedy(lp, PH):
    ids=lp.argmax(-1); out=[]; prev=-1
    for i in ids:
        if i!=prev and i!=0: out.append(PH[i-1])
        prev=i
    return out
