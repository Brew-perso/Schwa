"""Recompute the stored pitch contour (f0) of already-rendered model audio with the current cleaning rules.

The audio itself and the Kokoro unit timings are unchanged, so nothing is re-synthesised:
    python tools/retime.py            # all files in public/audio
"""
import glob
import json
import os
import sys
from concurrent.futures import ProcessPoolExecutor

import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(__file__))
from tts import clean_f0, f0_track  # noqa: E402

AUDIO = os.path.join(os.path.dirname(__file__), '..', 'public', 'audio')


def one(jp):
    mp = jp[:-5] + '.mp3'
    if not os.path.exists(mp):
        return 0
    with open(jp) as f:
        info = json.load(f)
    if 'f0' not in info:
        return 0
    a, sr = sf.read(mp, dtype='float32')
    if a.ndim > 1:
        a = a.mean(axis=1)
    _, fr = f0_track(a, sr)
    fr = clean_f0(fr)
    voiced = fr[fr > 0]
    med = float(np.median(voiced)) if len(voiced) else 150.0
    f0 = [None if x <= 0 else round(12 * np.log2(x / med), 2) for x in fr[::2]]
    if f0 == info['f0']:
        return 0
    info['f0'] = f0
    with open(jp, 'w') as f:
        json.dump(info, f, separators=(',', ':'))
    return 1


if __name__ == '__main__':
    files = sorted(glob.glob(os.path.join(AUDIO, '*.json')))
    workers = int(sys.argv[1]) if len(sys.argv) > 1 else 2
    with ProcessPoolExecutor(workers) as ex:
        changed = sum(ex.map(one, files, chunksize=32))
    print(f'retimed {changed}/{len(files)}')
