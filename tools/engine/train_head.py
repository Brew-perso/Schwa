import numpy as np, torch, torch.nn as nn, glob, random, sys, time, math
from units import UNITS
if __name__=="__main__": torch.set_num_threads(int(sys.argv[2]) if len(sys.argv)>2 else 3)
C=len(UNITS)
class Head(nn.Module):
    def __init__(s, D=176, H=256, L=4):
        super().__init__()
        s.inp=nn.Linear(D,H)
        s.convs=nn.ModuleList([nn.Conv1d(H,H,5,padding=2,groups=1) for _ in range(L)])
        s.norms=nn.ModuleList([nn.LayerNorm(H) for _ in range(L)])
        s.out=nn.Linear(H,2*C)
        s.drop=nn.Dropout(0.15)
    def forward(s,x):  # x: B,T,D
        h=torch.nn.functional.gelu(s.inp(x))
        for c,n in zip(s.convs,s.norms):
            h=h+s.drop(torch.nn.functional.gelu(c(n(h).transpose(1,2)).transpose(1,2)))
        o=s.out(h)  # B,T,2C
        B,T,_=o.shape
        return torch.log_softmax(o.reshape(B,T*2,C),-1)
def val_loss(model,va,ctc):
    model.eval(); tot=0;n=0
    with torch.no_grad():
        for i in range(0,len(va[0]),32):
            b=list(range(i,min(i+32,len(va[0]))))
            T=max(va[0][j].shape[0] for j in b)
            x=torch.zeros(len(b),T,176)
            for k,j in enumerate(b): x[k,:va[0][j].shape[0]]=torch.from_numpy(va[0][j].astype(np.float32))
            ys=torch.cat([torch.from_numpy(va[1][j].astype(np.int64)) for j in b])
            yl=torch.tensor([len(va[1][j]) for j in b]); xl=torch.tensor([2*va[0][j].shape[0] for j in b])
            tot+=ctc(model(x).transpose(0,1),ys,xl,yl).item(); n+=1
    model.train(); return tot/max(1,n)
def load(pats):
    F=[];L=[];M=[]
    for p in pats:
        for f in glob.glob(p):
            d=np.load(f,allow_pickle=True).item(); F+=d['feats']; L+=d['labs']; M+=d['meta']
    return F,L,M
if __name__=='__main__':
    tr=load(sys.argv[1].split(','))
    OUTP=sys.argv[4] if len(sys.argv)>4 else 'head.pt'
    va=load(sys.argv[5].split(',')) if len(sys.argv)>5 else None
    print('train utts',len(tr[0]))
    idx=list(range(len(tr[0])))
    model=Head(); opt=torch.optim.AdamW(model.parameters(),lr=2e-3,weight_decay=1e-2)
    ctc=nn.CTCLoss(blank=0,zero_infinity=True)
    EP=int(sys.argv[3]) if len(sys.argv)>3 else 12
    steps=EP*math.ceil(len(idx)/32); sched=torch.optim.lr_scheduler.OneCycleLR(opt,2e-3,total_steps=steps,pct_start=0.1)
    t0=time.time()
    for ep in range(EP):
        random.shuffle(idx); model.train(); tot=0;n=0
        # bucket by length
        chunks=[idx[i:i+32*50] for i in range(0,len(idx),32*50)]
        for ch in chunks:
            ch.sort(key=lambda i: tr[0][i].shape[0])
            bs=[ch[i:i+32] for i in range(0,len(ch),32)]; random.shuffle(bs)
            for b in bs:
                T=max(tr[0][i].shape[0] for i in b)
                x=torch.zeros(len(b),T,176)
                for j,i in enumerate(b):
                    f=torch.from_numpy(tr[0][i].astype(np.float32))
                    if random.random()<0.5: # feature masking
                        f=f*(torch.rand(1,176)>0.1).float()
                    x[j,:f.shape[0]]=f
                ys=torch.cat([torch.from_numpy(tr[1][i].astype(np.int64)) for i in b])
                yl=torch.tensor([len(tr[1][i]) for i in b]); xl=torch.tensor([2*tr[0][i].shape[0] for i in b])
                lp=model(x).transpose(0,1)
                loss=ctc(lp,ys,xl,yl)
                opt.zero_grad(); loss.backward(); nn.utils.clip_grad_norm_(model.parameters(),5); opt.step(); sched.step()
                tot+=loss.item();n+=1
        vl=val_loss(model,va,ctc) if va else 0
        print('ep',ep,'loss',round(tot/n,3),'val',round(vl,3),'t',round(time.time()-t0),flush=True)
        torch.save(model.state_dict(),OUTP)
