import pyarrow.parquet as pq, glob, io, soundfile as sf, numpy as np, resampy, pickle, os
S=os.environ.get('SCHWA_WORK', 'work') + '/' + ''
out={}
for f in sorted(glob.glob(S+'hf/changelinglab__speechaccentarchive-pr/data/*.parquet')):
    t=pq.read_table(f).to_pylist()
    for r in t:
        if r['id'].startswith('french') or r['id'].startswith('english') and len(out)<999:
            a,sr=sf.read(io.BytesIO(r['audio']['bytes']))
            if a.ndim>1: a=a.mean(1)
            a=resampy.resample(a.astype(np.float32),sr,16000)
            out[r['id']]=(a,r['transcript'])
pickle.dump(out,open('saa_fr_en.pkl','wb'))
print(len(out), sorted(out)[:80])
