"""Phonology helpers shared by the Schwa build tools.

Three notations are involved:
  * Kokoro/misaki phonemes ("kph"): what the TTS reads (e.g. hOtˈɛl, ˈA, ɹ).
  * Engine units: the phone inventory the in-browser recogniser outputs (UNITS).
  * Display IPA: dictionary-style transcription shown to learners (GA or SBE conventions).
"""
from __future__ import annotations
import re

UNITS = ['<b>', 'p', 'b', 't', 'd', 'k', 'ɡ', 'f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ', 'h', 'tʃ', 'dʒ', 'm', 'n', 'ŋ', 'l', 'r', 'w', 'j',
         'iː', 'ɪ', 'ɛ', 'æ', 'ʌ', 'ɑː', 'ɒ', 'ɔː', 'ʊ', 'uː', 'ɜː', 'ə', 'eɪ', 'aɪ', 'ɔɪ', 'oʊ', 'aʊ', 'ɪə', 'ɛə', 'ʊə',
         'o', 'e', 'œ', 'ʁ']
UIDX = {u: i for i, u in enumerate(UNITS)}
VOWEL_UNITS = {'iː', 'ɪ', 'ɛ', 'æ', 'ʌ', 'ɑː', 'ɒ', 'ɔː', 'ʊ', 'uː', 'ɜː', 'ə', 'eɪ', 'aɪ', 'ɔɪ', 'oʊ', 'aʊ', 'ɪə', 'ɛə', 'ʊə', 'o', 'e', 'œ'}

# Content (dictionary-style) symbols -> engine units
CONTENT2UNIT = {'e': 'ɛ', 'əʊ': 'oʊ', 'oʊ': 'oʊ', 'eə': 'ɛə', 'iː': 'iː', 'uː': 'uː', 'ɑː': 'ɑː', 'ɔː': 'ɔː', 'ɜː': 'ɜː',
                'i': 'iː', 'u': 'uː', 'ɑ': 'ɑː', 'ɔ': 'ɔː', 'juː': 'uː', 'r': 'r', 'ɹ': 'r', 'g': 'ɡ'}

KSINGLE = {'A': ['eɪ'], 'I': ['aɪ'], 'O': ['oʊ'], 'Q': ['oʊ'], 'W': ['aʊ'], 'Y': ['ɔɪ'], 'T': ['t'], 'ɾ': ['t'], 'ʔ': ['t'],
           'ʤ': ['dʒ'], 'ʧ': ['tʃ'], 'ɹ': ['r'], 'ᵊ': ['ə'], 'ɚ': ['ə', 'r'], 'ɜ': ['ɜː'], 'i': ['iː'], 'u': ['uː'],
           'ɑ': ['ɑː'], 'ɔ': ['ɔː'], 'ɐ': ['ə'], 'ɒ': ['ɒ'], 'ɡ': ['ɡ'], 'g': ['ɡ'], 'ɛ': ['ɛ'], 'æ': ['æ'], 'ʌ': ['ʌ'],
           'ɪ': ['ɪ'], 'ʊ': ['ʊ'], 'ə': ['ə'], 'ᵻ': ['ɪ'], 'o': ['o'], 'e': ['e'], 'a': ['æ'], 'œ': ['œ'], 'ø': ['œ'],
           'y': ['uː'], 'ʁ': ['ʁ'], 'ç': ['h'], 'x': ['k']}
for _c in 'pbtdkfvθðszʃʒhmnŋlwj':
    KSINGLE[_c] = [_c]
KPAIRS = {'ɪə': ['ɪə'], 'ɛə': ['ɛə'], 'ʊə': ['ʊə'], 'eə': ['ɛə'], 'ɛː': ['ɛə']}
SKIP = set("ˈˌː ,.!?;:—–-'\"()“”…̃")
KVOWELS = set('AIOQWYaeiouæɑɐɒɔəɛɜɪʊʌᵊᵻœøy')


def k2units_spans(ph: str):
    """Kokoro phonemes -> list of (unit, char_start, char_end, stress) where stress in {0,1,2}."""
    out = []
    i = 0
    pending_stress = 0
    while i < len(ph):
        c = ph[i]
        if c == 'ˈ':
            pending_stress = 1; i += 1; continue
        if c == 'ˌ':
            pending_stress = 2; i += 1; continue
        two = ph[i:i + 2]
        if two in KPAIRS:
            for u in KPAIRS[two]:
                out.append([u, i, i + 2, pending_stress if u in VOWEL_UNITS else 0])
            if any(u in VOWEL_UNITS for u in KPAIRS[two]):
                pending_stress = 0
            i += 2
            continue
        if c in SKIP:
            i += 1
            continue
        if c in KSINGLE:
            us = KSINGLE[c]
            for u in us:
                st = 0
                if u in VOWEL_UNITS:
                    st = pending_stress; pending_stress = 0
                out.append([u, i, i + 1, st])
            i += 1
            continue
        raise KeyError(f'unknown kokoro phoneme {c!r} in {ph!r}')
    return out


def k2units(ph: str):
    return [u for u, *_ in k2units_spans(ph)]


# ---------- display IPA ----------
DISP_GA = {'A': 'eɪ', 'I': 'aɪ', 'O': 'oʊ', 'Q': 'oʊ', 'W': 'aʊ', 'Y': 'ɔɪ', 'T': 't', 'ɾ': 't', 'ᵊ': 'ə', 'ɐ': 'ə',
           'ɹ': 'r', 'ʤ': 'dʒ', 'ʧ': 'tʃ', 'ᵻ': 'ɪ', 'a': 'æ', 'ʔ': 't'}
DISP_SBE = {'A': 'eɪ', 'I': 'aɪ', 'O': 'əʊ', 'Q': 'əʊ', 'W': 'aʊ', 'Y': 'ɔɪ', 'T': 't', 'ɾ': 't', 'ᵊ': 'ə', 'ɐ': 'ə',
            'ɹ': 'r', 'ʤ': 'dʒ', 'ʧ': 'tʃ', 'ᵻ': 'ɪ', 'a': 'æ', 'ɛ': 'e', 'ʔ': 't'}


def k2display(ph: str, variety: str) -> str:
    """Dictionary-style IPA for display. GA keeps r-coloured vowels as ɝ/ɚ; SBE uses traditional symbols."""
    s = ph
    if variety == 'GA':
        s = s.replace('ɜɹ', 'ɝ')
        s = re.sub(r'əɹ(?![aeiouæɑɐɒɔəɛɜɪʊʌAIOQWYᵊ])', 'ɚ', s)
        s = s.replace('ɛɹ', 'ɛr')
        table = DISP_GA
    else:
        s = s.replace('ɛː', 'eə').replace('ɛə', 'eə')
        table = DISP_SBE
    out = ''.join(table.get(c, c) for c in s)
    # misaki puts stress marks right before the vowel; dictionaries put them before the syllable onset.
    out = move_stress_to_onset(out)
    return out


ONSETS = {'p', 'b', 't', 'd', 'k', 'ɡ', 'f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ', 'h', 'tʃ', 'dʒ', 'm', 'n', 'l', 'r', 'w', 'j',
          'pl', 'pr', 'pj', 'bl', 'br', 'bj', 'tr', 'tj', 'tw', 'dr', 'dj', 'dw', 'kl', 'kr', 'kj', 'kw', 'ɡl', 'ɡr', 'ɡj', 'ɡw',
          'fl', 'fr', 'fj', 'vj', 'θr', 'θj', 'θw', 'sp', 'st', 'sk', 'sm', 'sn', 'sl', 'sw', 'sj', 'ʃr', 'mj', 'nj', 'hj', 'lj',
          'spl', 'spr', 'spj', 'str', 'stj', 'skr', 'skw', 'skj', 'hw'}
DISP_VOWEL_START = set('aeiouæɑɒɔəɛɜɝɚɪʊʌ')


def _disp_segments(s: str):
    """Split a display string into segments (multi-char symbols kept together)."""
    segs = []
    i = 0
    multi = ['tʃ', 'dʒ', 'eɪ', 'aɪ', 'ɔɪ', 'oʊ', 'əʊ', 'aʊ', 'ɪə', 'eə', 'ʊə', 'iː', 'uː', 'ɑː', 'ɔː', 'ɜː']
    while i < len(s):
        for m in multi:
            if s.startswith(m, i):
                segs.append(m); i += len(m); break
        else:
            segs.append(s[i]); i += 1
    return segs


def move_stress_to_onset(s: str) -> str:
    words = s.split(' ')
    out = []
    for w in words:
        segs = _disp_segments(w)
        res = []
        k = 0
        while k < len(segs):
            seg = segs[k]
            if seg in ('ˈ', 'ˌ'):
                # walk back over consonants forming a legal onset
                j = len(res)
                cons = []
                while j > 0 and res[j - 1] not in ('ˈ', 'ˌ') and res[j - 1][0] not in DISP_VOWEL_START and res[j - 1] not in ',.?!':
                    cand = ''.join([res[j - 1]] + cons)
                    if cand in ONSETS:
                        cons.insert(0, res[j - 1]); j -= 1
                    else:
                        break
                res.insert(j, seg)
                k += 1
                continue
            res.append(seg)
            k += 1
        out.append(''.join(res))
    return ' '.join(out)


def syllables(units_spans):
    """Group unit spans of ONE word into syllables (maximal onset). Returns list of dicts."""
    idx_v = [i for i, (u, *_r) in enumerate(units_spans) if u in VOWEL_UNITS]
    if not idx_v:
        return [{'units': list(range(len(units_spans))), 'stress': 0}]
    bounds = [0]
    for a, b in zip(idx_v, idx_v[1:]):
        cons = list(range(a + 1, b))
        # maximal legal onset from the consonants between a and b
        split = b
        for s in range(a + 1, b + 1):
            cl = ''.join(units_spans[x][0] for x in range(s, b))
            if cl == '' or cl in ONSETS:
                split = s
                break
        bounds.append(split)
    bounds.append(len(units_spans))
    sylls = []
    for x, y in zip(bounds, bounds[1:]):
        rng = list(range(x, y))
        st = max((units_spans[i][3] for i in rng if units_spans[i][0] in VOWEL_UNITS), default=0)
        sylls.append({'units': rng, 'stress': st})
    return sylls
