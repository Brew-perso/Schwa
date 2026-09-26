"""Kokoro-82M rendering for Schwa (Apache-2.0 model, run locally with onnxruntime).

Uses the *timestamped* ONNX export (onnx-community/Kokoro-82M-v1.0-ONNX-timestamped), which returns
per-phoneme durations: we derive unit / word timings and model prosody (syllable prominence, F0 contour).
"""
from __future__ import annotations
import json, os, re
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
from phon import k2units_spans, VOWEL_UNITS, syllables  # noqa: E402

DEFAULT_TS = os.environ.get('KOKORO_TS_MODEL', str(HERE / 'models' / 'kokoro-ts.onnx'))
DEFAULT_STD = os.environ.get('KOKORO_MODEL', str(HERE / 'models' / 'kokoro-v1.0.onnx'))
DEFAULT_VOICES = os.environ.get('KOKORO_VOICES', str(HERE / 'models' / 'voices-v1.0.bin'))
SR = 24000


class TTS:
    def __init__(self, threads=1):
        import onnxruntime as ort
        from kokoro_onnx import Kokoro
        so = ort.SessionOptions(); so.intra_op_num_threads = threads; so.inter_op_num_threads = 1
        self.k = Kokoro(DEFAULT_STD, DEFAULT_VOICES)
        self.k.sess = ort.InferenceSession(DEFAULT_STD, so, providers=['CPUExecutionProvider'])
        self.sess = ort.InferenceSession(DEFAULT_TS, so, providers=['CPUExecutionProvider'])
        self.vocab = self.k.tokenizer.vocab

    # ---------------------------------------------------------------- synthesis
    def synth(self, kph, voice, speed=1.0):
        kept = [i for i, c in enumerate(kph) if c in self.vocab]
        ids = [self.vocab[kph[i]] for i in kept]
        style = self.k.get_voice_style(voice)[len(ids)]
        style = style.reshape(1, -1).astype(np.float32)
        tok = np.array([[0, *ids, 0]], dtype=np.int64)
        w, d = self.sess.run(None, {'input_ids': tok, 'style': style, 'speed': np.array([speed], dtype=np.float32)})
        w = w.reshape(-1).astype(np.float32)
        d = d.reshape(-1).astype(np.float64)
        scale = len(w) / d.sum()
        ends = np.cumsum(d) * scale / SR
        starts = np.concatenate([[0], ends[:-1]])
        char_t = {}
        for j, ci in enumerate(kept):
            char_t[ci] = (starts[j + 1], ends[j + 1])
        return w, char_t

    def render(self, job, mp3_path, json_path=None):
        if job['lang'].startswith('fr'):
            a, sr = self.k.create(job['kph'], voice=job['voice'], lang='fr-fr', speed=job['speed'])
            a = normalize(trim(a.astype(np.float32), sr)[0])
            write_mp3(a, sr, mp3_path)
            return
        kph = job['kph']
        w, char_t = self.synth(kph, job['voice'], job['speed'])
        spans = unit_spans_with_words(kph)
        ut = []
        for (u, cs, ce, st, wi) in spans:
            ts = [char_t[c] for c in range(cs, ce) if c in char_t]
            if not ts:
                ut.append(None); continue
            ut.append([min(t[0] for t in ts), max(t[1] for t in ts)])
        # stress marks carry duration in Kokoro: attach the gap to the next unit start (already handled: the unit starts at its own char)
        mods = job.get('mods') or {}
        if mods.get('focus') is not None or mods.get('tone'):
            w = manipulate(w, SR, spans, ut, mods)
        a, off = trim(w, SR)
        ut = [[max(0.0, x[0] - off), max(0.0, x[1] - off)] if x else None for x in ut]
        a = normalize(a)
        write_mp3(a, SR, mp3_path)
        if json_path:
            info = timing_info(a, SR, spans, ut)
            with open(json_path, 'w') as f:
                json.dump(info, f, separators=(',', ':'))


def unit_spans_with_words(kph):
    """(unit, char_start, char_end, stress, word_index) for every unit, words split on spaces."""
    out = []
    wi = -1
    for m in re.finditer(r'\S+', kph):
        token = m.group(0)
        try:
            sp = k2units_spans(token)
        except KeyError:
            sp = []
        if not sp:
            continue
        wi += 1
        for (u, cs, ce, st) in sp:
            out.append((u, cs + m.start(), ce + m.start(), st, wi))
    return out


def trim(a, sr, thr_db=-45, pad=0.05):
    env = np.convolve(np.abs(a), np.ones(240) / 240, mode='same')
    thr = np.max(env) * 10 ** (thr_db / 20)
    idx = np.where(env > thr)[0]
    if len(idx) == 0:
        return a, 0.0
    s = max(0, idx[0] - int(pad * sr)); e = min(len(a), idx[-1] + int(pad * 2 * sr))
    return a[s:e], s / sr


def normalize(a, target_db=-20.0, peak_db=-1.0):
    frame = 480
    n = len(a) // frame
    if n == 0:
        return a
    fr = a[:n * frame].reshape(n, frame)
    rms = np.sqrt((fr ** 2).mean(1) + 1e-12)
    loud = rms[rms > np.max(rms) * 0.1]
    cur = 20 * np.log10(np.sqrt((loud ** 2).mean()) + 1e-12)
    g = 10 ** ((target_db - cur) / 20)
    a = a * g
    pk = np.max(np.abs(a))
    lim = 10 ** (peak_db / 20)
    if pk > lim:
        a = a * (lim / pk)
    # 5 ms fades
    f = int(0.005 * SR)
    a[:f] *= np.linspace(0, 1, f); a[-f:] *= np.linspace(1, 0, f)
    return a.astype(np.float32)


def write_mp3(a, sr, path):
    import lameenc
    enc = lameenc.Encoder()
    enc.set_bit_rate(48); enc.set_in_sample_rate(sr); enc.set_channels(1); enc.set_quality(2)
    pcm = (np.clip(a, -1, 1) * 32767).astype('<i2').tobytes()
    data = enc.encode(pcm) + enc.flush()
    with open(path, 'wb') as f:
        f.write(data)


def f0_track(a, sr):
    import parselmouth
    snd = parselmouth.Sound(a.astype(np.float64), sampling_frequency=sr)
    p = snd.to_pitch_ac(time_step=0.01, pitch_floor=65, pitch_ceiling=500)
    f = p.selected_array['frequency']
    t = p.xs()
    return t, f


def clean_f0(f, min_len=5, jump_st=3.0):
    """Remove pitch-tracking artefacts: split the contour at > jump_st semitone jumps between 10 ms frames and
    unvoice fragments shorter than min_len frames (octave errors, creak and glottal pulses at phrase edges)."""
    f = f.copy()
    i, n = 0, len(f)
    while i < n:
        if f[i] <= 0:
            i += 1; continue
        j = i + 1
        while j < n and f[j] > 0 and abs(12 * np.log2(f[j] / f[j - 1])) <= jump_st:
            j += 1
        if j - i < min_len:
            f[i:j] = 0
        i = j
    return f


def intensity_track(a, sr):
    import parselmouth
    snd = parselmouth.Sound(a.astype(np.float64), sampling_frequency=sr)
    it = snd.to_intensity(minimum_pitch=75, time_step=0.01)
    return it.xs(), it.values[0]


def timing_info(a, sr, spans, ut):
    dur = len(a) / sr
    nwords = max((s[4] for s in spans), default=-1) + 1
    words = []
    for wi in range(nwords):
        idx = [i for i, s in enumerate(spans) if s[4] == wi and ut[i]]
        words.append([round(ut[idx[0]][0], 3), round(ut[idx[-1]][1], 3)] if idx else None)
    t, f = f0_track(a, sr)
    f = clean_f0(f)
    ti, iv = intensity_track(a, sr)
    voiced = f[f > 0]
    med = float(np.median(voiced)) if len(voiced) else 150.0
    # contour in semitones relative to the median, 50 Hz frame rate (None = unvoiced)
    f0 = [None if x <= 0 else round(12 * np.log2(x / med), 2) for x in f[::2]]
    # syllable prominence per word: duration, mean intensity (dB), f0 max (st) of the nucleus
    prom = []
    for wi in range(nwords):
        idx = [i for i, s in enumerate(spans) if s[4] == wi]
        sp4 = [[spans[i][0], spans[i][1], spans[i][2], spans[i][3]] for i in idx]
        syl = syllables(sp4) if sp4 else []
        wp = []
        for s in syl:
            ui = [idx[k] for k in s['units']]
            times = [ut[k] for k in ui if ut[k]]
            if not times:
                wp.append([0, 0, 0]); continue
            t0, t1 = times[0][0], times[-1][1]
            vt = [ut[k] for k in ui if ut[k] and spans[k][0] in VOWEL_UNITS]
            v0, v1 = (vt[0][0], vt[-1][1]) if vt else (t0, t1)
            m = (ti >= v0) & (ti <= v1)
            inten = float(np.mean(iv[m])) if m.any() else 0.0
            mf = (t >= v0) & (t <= v1) & (f > 0)
            fmax = float(12 * np.log2(np.max(f[mf]) / med)) if mf.any() else 0.0
            wp.append([round(t1 - t0, 3), round(inten, 1), round(fmax, 2)])
        prom.append(wp)
    return {'dur': round(dur, 3), 'words': words, 'units': [[round(x[0], 3), round(x[1], 3)] if x else None for x in ut],
            'f0': f0, 'prom': prom}


def manipulate(a, sr, spans, ut, mods):
    """Praat PSOLA manipulation: contrastive focus on a word, or a final tone (rise / fall / fall-rise)."""
    import parselmouth
    from parselmouth.praat import call
    snd = parselmouth.Sound(a.astype(np.float64), sampling_frequency=sr)
    man = call(snd, 'To Manipulation', 0.01, 70, 450)
    pt = call(man, 'Extract pitch tier')
    dt = call(man, 'Extract duration tier')
    t, f = f0_track(a, sr)
    voiced = f[f > 0]
    med = float(np.median(voiced)) if len(voiced) else 180.0
    nwords = max((s[4] for s in spans), default=-1) + 1

    def wtimes(wi):
        idx = [i for i, s in enumerate(spans) if s[4] == wi and ut[i]]
        return (ut[idx[0]][0], ut[idx[-1]][1]) if idx else None

    def stressed_vowel(wi):
        idx = [i for i, s in enumerate(spans) if s[4] == wi and ut[i] and s[0] in VOWEL_UNITS]
        for i in idx:
            if spans[i][3] == 1:
                return ut[i]
        return ut[idx[0]] if idx else None

    end = len(a) / sr
    tone = mods.get('tone')
    if mods.get('focus') is not None:
        call(pt, 'Remove points between', 0, end)
    base = med
    if mods.get('focus') is not None:
        fw = int(mods['focus'])
        # gentle declination before, high peak on the focused stressed vowel, low and flat after
        for wi in range(nwords):
            wt = wtimes(wi)
            if not wt:
                continue
            if wi < fw:
                call(pt, 'Add point', (wt[0] + wt[1]) / 2, base * (1.05 - 0.02 * wi))
            elif wi == fw:
                sv = stressed_vowel(wi) or wt
                call(pt, 'Add point', max(0.0, sv[0] - 0.02), base * 0.98)
                call(pt, 'Add point', (sv[0] + sv[1]) / 2, base * 1.55)
                call(pt, 'Add point', sv[1] + 0.03, base * 0.9)
                call(dt, 'Add point', wt[0] - 0.001, 1.0)
                call(dt, 'Add point', wt[0], 1.25)
                call(dt, 'Add point', wt[1], 1.25)
                call(dt, 'Add point', wt[1] + 0.001, 1.0)
            else:
                call(pt, 'Add point', (wt[0] + wt[1]) / 2, base * 0.78)
        call(pt, 'Add point', end, base * 0.72)
    if tone:
        # nucleus = last word carrying a primary stress (function words at the end are part of the tail)
        stressed_words = sorted({s_[4] for i, s_ in enumerate(spans) if s_[3] == 1 and ut[i]})
        last = stressed_words[-1] if stressed_words else nwords - 1
        wt = wtimes(last) or (0, end)
        sv = stressed_vowel(last) or wt
        final = wtimes(nwords - 1) or wt
        voiced_t = [x for x, y in zip(t, f) if y > 0 and sv[0] <= x <= final[1] + 0.08]
        t_end = max(voiced_t) if voiced_t else min(end - 0.01, final[1])  # PSOLA acts on voiced frames only
        tail = t_end - sv[1]
        if mods.get('focus') is None:
            # keep the natural contour up to the nuclear syllable; reshape only the nuclear tone
            call(pt, 'Remove points between', max(0.0, sv[0] - 0.03), end)
            prev = [y for x, y in zip(t, f) if y > 0 and x < sv[0]][-8:]
            loc = float(np.median(prev)) if prev else base
        else:
            loc = base * 0.9
        svm = (sv[0] + sv[1]) / 2
        if tone == 'fall-rise':
            call(pt, 'Add point', sv[0], loc * 1.25)
            call(pt, 'Add point', sv[1] if tail > 0.08 else svm, loc * 0.82)
            call(pt, 'Add point', max(t_end, sv[1]), loc * 1.2)
        elif tone == 'rise':
            call(pt, 'Add point', sv[0], loc * 0.9)
            if tail > 0.08:
                call(pt, 'Add point', sv[1], loc * 1.12)
            call(pt, 'Add point', max(t_end, sv[1]), loc * 1.55)
        elif tone == 'fall':
            call(pt, 'Add point', sv[0], loc * 1.25)
            call(pt, 'Add point', max(t_end, sv[1]), loc * 0.75)
    call([pt, man], 'Replace pitch tier')
    call([dt, man], 'Replace duration tier')
    out = call(man, 'Get resynthesis (overlap-add)')
    b = out.values[0].astype(np.float32)
    # the duration tier stretched the focused word by 1.25: remap unit times exactly
    if mods.get('focus') is not None:
        wt = wtimes(int(mods['focus']))
        if wt:
            w0, w1 = wt

            def remap(x):
                if x <= w0:
                    return x
                if x <= w1:
                    return w0 + (x - w0) * 1.25
                return x + 0.25 * (w1 - w0)
            for i, x in enumerate(ut):
                if x:
                    ut[i] = [remap(x[0]), remap(x[1])]
    return b
