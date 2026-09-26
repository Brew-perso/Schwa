#!/usr/bin/env python3
"""Build Schwa course content.

  content/course.yaml + content/targets/*.yaml + content/lexicon_overrides.yaml
    -> public/content/course.json            (index: levels, targets summary, lessons, diagnostic, calibration)
    -> public/content/targets/<id>.json       (items, references GA/SBE, engine checks, audio + timings)
    -> public/audio/<hash>.mp3                (Kokoro neural TTS, loudness-normalised)
    -> content/BUILD_REPORT.md                (warnings for human review)

Usage:  python tools/build_content.py [--no-audio] [--only a2-h,b1-th] [--workers 3]
Env:    KOKORO_TS_MODEL (timestamped Kokoro ONNX), KOKORO_VOICES (voices-v1.0.bin)
"""
from __future__ import annotations
import argparse, glob, hashlib, json, os, re, sys, time
from pathlib import Path
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from phon import (UNITS, UIDX, VOWEL_UNITS, CONTENT2UNIT, k2units_spans, k2display, syllables)

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / 'content'
OUT = ROOT / 'public' / 'content'
AUDIO = ROOT / 'public' / 'audio'
REPORT: list[str] = []


def warn(msg):
    REPORT.append(msg)
    print('WARN', msg, file=sys.stderr)


def h(*parts) -> str:
    return hashlib.sha1('|'.join(str(p) for p in parts).encode()).hexdigest()[:14]


# ------------------------------------------------------------------ G2P
class G2P:
    def __init__(self, ovr):
        from misaki import en
        self.g = {'GA': en.G2P(trf=False, british=False, fallback=None),
                  'SBE': en.G2P(trf=False, british=True, fallback=None)}
        self.words = {k.lower(): v for k, v in (ovr.get('words') or {}).items()}
        self.letters = ovr.get('letters') or {}
        self.spelling_ga = ovr.get('spelling_GA') or {}
        self.verbs = {k.lower(): v for k, v in (ovr.get('verbs') or {}).items()}
        self.cache = {}

    def spell(self, text, variety):
        if variety != 'GA':
            return text
        def rep(m):
            w = m.group(0)
            r = self.spelling_ga.get(w.lower())
            if not r:
                return w
            return r.capitalize() if w[0].isupper() else r
        return re.sub(r"[A-Za-z']+", rep, text)

    def tokens(self, text, variety, letters=False):
        key = (text, variety, letters)
        if key in self.cache:
            return self.cache[key]
        toks = []
        if letters:
            for part in text.split():
                ph = self.letters[part.upper()]
                ph = ph.get(variety, ph.get('both')) if isinstance(ph, dict) else ph
                toks.append({'t': part, 'ph': ph, 'ws': ' ', 'word': True})
        else:
            _, mt = self.g[variety](text)
            prev = None
            for t in mt:
                is_word = bool(re.search(r"[A-Za-z]", t.text))
                ph = t.phonemes or ''
                o = self.words.get(t.text.lower())
                if o is not None:
                    ph = o.get(variety, o.get('both', ph)) if isinstance(o, dict) else o
                if prev is not None and prev.lower() == 'to' and t.text.lower() in self.verbs:
                    ov = self.verbs[t.text.lower()]
                    ph = ov.get(variety, ov.get('both', ph))
                if is_word:
                    prev = t.text
                if is_word and (not ph or '❓' in ph):
                    warn(f'G2P failed for {t.text!r} ({variety}) in {text!r}')
                toks.append({'t': t.text, 'ph': ph, 'ws': t.whitespace, 'word': is_word})
            apply_weak_forms(toks, variety)
        self.cache[key] = toks
        return toks


WEAK_RULES = {
    'and': ('ənd', 'ənd'), 'of': ('əv', 'əv'), 'can': ('kən', 'kən'), 'at': ('ət', 'ət'), 'was': ('wəz', 'wəz'),
    'for': ('fəɹ', 'fə'), 'from': ('fɹəm', 'fɹəm'), 'were': ('wəɹ', 'wə'), 'us': ('əs', 'əs'), 'them': ('ðəm', 'ðəm'),
    'are': ('əɹ', 'ə'), 'but': ('bət', 'bət'), 'than': ('ðən', 'ðən'), 'as': ('əz', 'əz'), 'has': ('həz', 'həz'),
    'have': ('həv', 'həv'), 'does': ('dəz', 'dəz'), 'to': ('tə', 'tə'), 'a': ('ə', 'ə'), 'an': ('ən', 'ən'),
    'the': ('ðə', 'ðə'), 'or': ('əɹ', 'ə'), 'your': ('jəɹ', 'jə'), 'her': ('həɹ', 'hə'),
}
_VOWEL_START = set('aeiouæɑɐɒɔəɛɜɪʊʌAIOQWYᵊ')
# Stranded prepositions and auxiliaries strengthen at the end of a clause ("What are you
# looking at?", "Yes, I can."). Conjunctions and object pronouns don't get that exception —
# they stay weak even right before a comma or full stop ("Come and see us.").
_STRONG_AT_CLAUSE_END = {'to', 'for', 'at', 'of', 'can', 'was', 'were', 'does', 'has', 'have', 'or'}


def apply_weak_forms(toks, variety):
    """Unstressed, non-final function words take their weak form (misaki often keeps strong vowels)."""
    words = [i for i, t in enumerate(toks) if t['word']]
    for k, i in enumerate(words):
        t = toks[i]
        lw = t['t'].lower()
        if lw not in WEAK_RULES or 'ˈ' in t['ph']:
            continue
        # final in its sentence/clause -> strong form, but only for words that actually
        # strengthen when stranded (see _STRONG_AT_CLAUSE_END above)
        nxt = toks[i + 1] if i + 1 < len(toks) else None
        clause_final = nxt is None or (not nxt['word'] and nxt['t'] in '.?!,;:')
        if clause_final and lw in _STRONG_AT_CLAUSE_END:
            continue
        weak = WEAK_RULES[lw][0 if variety == 'GA' else 1]
        if lw == 'the':
            nw = toks[words[k + 1]]['ph'].lstrip('ˈˌ') if k + 1 < len(words) else ''
            weak = 'ði' if nw[:1] in _VOWEL_START else 'ðə'
        if lw == 'to':
            nw = toks[words[k + 1]]['ph'].lstrip('ˈˌ') if k + 1 < len(words) else ''
            weak = 'tu' if nw[:1] in _VOWEL_START else 'tə'
        if lw in ('for', 'or', 'your', 'her') and variety == 'SBE':
            nw = toks[words[k + 1]]['ph'].lstrip('ˈˌ') if k + 1 < len(words) else ''
            if nw[:1] in _VOWEL_START:
                weak = weak + 'ɹ'
        t['ph'] = weak


def join_kph(toks):
    s = ''
    for t in toks:
        s += t['ph'] + (t['ws'] or '')
    return s.strip()


_pyphen = None


def ortho_syllables(word, n, ovr):
    global _pyphen
    o = (ovr.get('syllables') or {}).get(word.lower())
    if o:
        parts = o.split('-')
        if len(parts) == n:
            return parts
        warn(f'syllable override for {word!r} has {len(parts)} parts, expected {n}')
    if n == 1:
        return [word]
    from ortho import split as osplit
    parts = osplit(word, n)
    if parts:
        return parts
    if _pyphen is None:
        import pyphen
        _pyphen = pyphen.Pyphen(lang='en_US')
    parts = _pyphen.inserted(word).split('-')
    if len(parts) == n:
        return parts
    return None


def utterance(g2p, text, variety, ovr, letters=False, mods=None):
    """Reference description of an utterance for one variety."""
    shown = g2p.spell(text, variety)
    toks = g2p.tokens(shown, variety, letters=letters)
    mods = mods or {}
    kph = join_kph(toks)
    words = []
    for ti, t in enumerate(toks):
        if not t['word']:
            continue
        try:
            spans = k2units_spans(t['ph'])
        except KeyError as e:
            warn(str(e)); spans = []
        syl = syllables(spans) if spans else []
        n = len(syl)
        if re.fullmatch(r"(?:[A-Za-z]-)+[A-Za-z]\.?", t['t']) and len(re.findall('[A-Za-z]', t['t'])) == n:
            labels = re.findall('[A-Za-z]', t['t'])
        else:
            labels = ortho_syllables(re.sub(r"[^A-Za-z']", '', t['t']), n, ovr) if n else []
        if letters:
            labels = [t['t']] + [''] * (n - 1)
        if labels is None:
            warn(f'no orthographic syllabification for {t["t"]!r} ({n} syll, {variety})')
            labels = [''.join(UNITS[UIDX[spans[i][0]]] for i in s['units']) for s in syl]
        st = next((i for i, s in enumerate(syl) if s['stress'] == 1), None)
        words.append({
            'w': t['t'],
            'ipa': k2display(t['ph'], variety),
            'u': [UIDX[s[0]] for s in spans],
            'syl': [{'n': len(s['units']), 's': s['stress'], 'l': labels[i]} for i, s in enumerate(syl)],
            'st': st,
        })
    return {'text': shown, 'kph': kph, 'ipa': ' '.join(w['ipa'] for w in words), 'words': words}


# ------------------------------------------------------------------ engine checks (graph of expected errors)
def content_unit(sym):
    if sym in ('∅', 'stress', 'final', 'flat', 'other', 'nucleus', 'fall', 'rise', 'fall-rise', 'chunk', 'link', 'connected'):
        return sym
    u = CONTENT2UNIT.get(sym, sym)
    if u not in UIDX:
        raise KeyError(f'unknown content symbol {sym!r}')
    return u


FUNCTION_WORDS = {'a', 'an', 'the', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for', 'from', 'with', 'by', 'as', 'is', 'are',
                  'was', 'were', 'be', 'been', 'am', "i'm", "it's", 'it', 'its', 'he', 'him', 'his', 'she', 'her', 'we', 'us',
                  'they', 'them', 'you', 'your', 'i', 'me', 'my', 'have', 'has', 'had', 'do', 'does', 'did', 'can', 'could',
                  'will', 'would', 'shall', 'should', 'that', 'this', 'there', 'than', 'some', "he's", "she's", "we're", "they're"}


def segment_checks(ref, errors, focus_units, g2p=None, variety=None, item=None):
    """For each position of a target phone in the reference, list alternative unit sequences.
    Returns list of {w: word index, p: unit index within word, t: target unit, alts: [{r: realized, seq: [...], f: fiche, wt}]}"""
    checks = []
    seg_err = [e for e in errors if e['target'] not in ('stress', 'nucleus', 'fall', 'rise', 'fall-rise', 'chunk', 'link', 'connected')]
    for wi, w in enumerate(ref['words']):
        units = [UNITS[i] for i in w['u']]
        is_function = re.sub(r"[^a-z']", '', w['w'].lower()) in FUNCTION_WORDS
        for pi, u in enumerate(units):
            alts = []
            for e in seg_err:
                if e['target'] == '∅':
                    continue
                if content_unit(e['target']) != u:
                    continue
                if e.get('word') and e['word'].lower() != w['w'].lower():
                    continue
                if is_function and (u == 'h' or e['realized'] == 'h') and not e.get('word'):
                    continue
                if e.get('where') == 'word-final' and pi != len(units) - 1:
                    continue
                r = e['realized']
                seq = [] if r == '∅' else [UIDX[content_unit(r)]]
                alts.append({'r': r, 'seq': seq, 'f': e['fiche'], 'wt': e.get('weight', 0.5)})
            if alts:
                checks.append({'w': wi, 'p': pi, 't': UIDX[u], 'alts': alts})
        # insertions
        for e in seg_err:
            if e['target'] != '∅':
                continue
            r = e['realized']; where = e.get('where', '')
            ins = UIDX[content_unit(r)]
            if is_function and r == 'h':
                continue
            if where == 'before-vowel' and units and units[0] in VOWEL_UNITS:
                checks.append({'w': wi, 'p': 0, 't': -1, 'ins': True, 'alts': [{'r': r, 'seq': [ins], 'f': e['fiche'], 'wt': e.get('weight', 0.5)}]})
            elif where == 'word-final' and units and units[-1] not in VOWEL_UNITS:
                checks.append({'w': wi, 'p': len(units), 't': -1, 'ins': True, 'alts': [{'r': r, 'seq': [ins], 'f': e['fiche'], 'wt': e.get('weight', 0.5)}]})
            elif where == 'before-ed' and w['w'].lower().endswith('ed') and units and units[-1] in ('t', 'd') and (len(units) < 2 or units[-2] != 'ɪ'):
                checks.append({'w': wi, 'p': len(units) - 1, 't': -1, 'ins': True, 'alts': [{'r': r, 'seq': [ins], 'f': e['fiche'], 'wt': e.get('weight', 0.5)}]})
    return checks


def weak_checks(g2p, ref, variety, weak_words, strong_words, fiche='forme-pleine'):
    """Weak/strong form checks: alternative = the other form of the function word."""
    checks = []
    wanted = [(x.lower(), 'weak') for x in (weak_words or [])] + [(x.lower(), 'strong') for x in (strong_words or [])]
    used = set()
    for mode_word, mode in wanted:
        for wi, w in enumerate(ref['words']):
            if wi in used or w['w'].lower() != mode_word:
                continue
            strong = STRONG_FORMS.get(mode_word, {}).get(variety) or g2p.tokens(mode_word, variety)[0]['ph']
            try:
                su = [UIDX[u] for u, *_ in k2units_spans(strong)]
            except KeyError:
                continue
            if mode == 'weak':
                if su == w['u']:
                    warn(f'weak form of {mode_word!r} identical to strong in {variety}')
                    continue
                checks.append({'w': wi, 'p': 0, 't': -2, 'word': True, 'mode': 'weak',
                               'alts': [{'r': 'strong', 'seq': su, 'f': fiche, 'wt': 0.5}]})
            else:
                weak = WEAK_FORMS.get(mode_word, {}).get(variety)
                if weak:
                    wu = [UIDX[u] for u, *_ in k2units_spans(weak)]
                    checks.append({'w': wi, 'p': 0, 't': -2, 'word': True, 'mode': 'strong',
                                   'alts': [{'r': 'weak', 'seq': wu, 'f': 'forme-faible-inattendue', 'wt': 0.3}]})
            used.add(wi)
            break
    return checks


STRONG_FORMS = {
    'to': {'GA': 'tˈu', 'SBE': 'tˈuː'}, 'for': {'GA': 'fˈɔɹ', 'SBE': 'fˈɔː'}, 'of': {'GA': 'ˈʌv', 'SBE': 'ˈɒv'},
    'can': {'GA': 'kˈæn', 'SBE': 'kˈan'}, 'and': {'GA': 'ˈænd', 'SBE': 'ˈand'}, 'at': {'GA': 'ˈæt', 'SBE': 'ˈat'},
    'a': {'GA': 'ˈA', 'SBE': 'ˈA'}, 'the': {'GA': 'ðˈi', 'SBE': 'ðˈiː'}, 'was': {'GA': 'wˈʌz', 'SBE': 'wˈɒz'},
    'were': {'GA': 'wˈɜɹ', 'SBE': 'wˈɜː'}, 'us': {'GA': 'ˈʌs', 'SBE': 'ˈʌs'}, 'them': {'GA': 'ðˈɛm', 'SBE': 'ðˈɛm'},
    'some': {'GA': 'sˈʌm', 'SBE': 'sˈʌm'}, 'from': {'GA': 'fɹˈʌm', 'SBE': 'fɹˈɒm'}, 'are': {'GA': 'ˈɑɹ', 'SBE': 'ˈɑː'},
    'have': {'GA': 'hˈæv', 'SBE': 'hˈav'}, 'has': {'GA': 'hˈæz', 'SBE': 'hˈaz'}, 'does': {'GA': 'dˈʌz', 'SBE': 'dˈʌz'},
    'you': {'GA': 'jˈu', 'SBE': 'jˈuː'}, 'her': {'GA': 'hˈɜɹ', 'SBE': 'hˈɜː'}, 'his': {'GA': 'hˈɪz', 'SBE': 'hˈɪz'},
    'but': {'GA': 'bˈʌt', 'SBE': 'bˈʌt'}, 'than': {'GA': 'ðˈæn', 'SBE': 'ðˈan'}, 'that': {'GA': 'ðˈæt', 'SBE': 'ðˈat'},
}
WEAK_FORMS = {'at': {'GA': 'ət', 'SBE': 'ət'}, 'can': {'GA': 'kən', 'SBE': 'kən'}, 'to': {'GA': 'tə', 'SBE': 'tə'},
              'for': {'GA': 'fəɹ', 'SBE': 'fə'}, 'of': {'GA': 'əv', 'SBE': 'əv'}}


# ------------------------------------------------------------------ audio jobs
class AudioJobs:
    def __init__(self):
        self.jobs = {}

    def add(self, kph, voice, speed=1.0, lang='en-us', mods=None, timings=False, text=None):
        mods = mods or {}
        key = h(kph, voice, speed, lang, json.dumps(mods, sort_keys=True), 'v3')
        if key not in self.jobs:
            self.jobs[key] = {'kph': kph, 'voice': voice, 'speed': speed, 'lang': lang, 'mods': mods, 'timings': timings, 'text': text}
        elif timings:
            self.jobs[key]['timings'] = True
        return key


def lang_of(variety):
    return 'en-gb' if variety == 'SBE' else 'en-us'


# ------------------------------------------------------------------ build
def load_yaml(p):
    with open(p, encoding='utf-8') as f:
        return yaml.safe_load(f)


def build(args):
    course = load_yaml(CONTENT / 'course.yaml')
    ovr = load_yaml(CONTENT / 'lexicon_overrides.yaml') or {}
    g2p = G2P(ovr)
    V = course['voices']
    jobs = AudioJobs()
    targets_out = []
    index_targets = []

    def refs(text, letters=False, mods=None):
        return {v: utterance(g2p, text, v, ovr, letters=letters, mods=mods) for v in ('GA', 'SBE')}

    def model_audio(r, mods=None, slow=True, timings=True):
        """Model voices for production (2 per variety) + slow version."""
        out = {}
        for v in ('GA', 'SBE'):
            kph = r[v]['kph']
            files = [jobs.add(kph, vo, 1.0, lang_of(v), mods, timings, r[v]['text']) for vo in V[v]['model']]
            d = {'m': files}
            if slow:
                d['s'] = jobs.add(kph, V[v]['slow'], 0.78, lang_of(v), mods, timings, r[v]['text'])
            out[v] = d
        return out

    def hvpt_audio(r, n=6, mods=None):
        out = {}
        for v in ('GA', 'SBE'):
            out[v] = [jobs.add(r[v]['kph'], vo, 1.0, lang_of(v), mods, False, r[v]['text']) for vo in V[v]['hvpt'][:n]]
        return out

    only = set(args.only.split(',')) if args.only else None
    files = sorted(glob.glob(str(CONTENT / 'targets' / '*.yaml')))
    schwa_T = load_yaml(CONTENT / 'targets' / 'a2-schwa.yaml')
    for fp in files:
        T = load_yaml(fp)
        tid = T['id']
        if only and tid not in only:
            continue
        if T['kind'] == 'stress':
            # a stress error usually comes with an unreduced vowel: check the schwas of the target word too
            T['_reduction_errors'] = [e for e in schwa_T['errors'] if e['target'] == 'ə']
            T.setdefault('fiches', {}).setdefault('voyelle-pleine', schwa_T['fiches']['voyelle-pleine'])
        kind = T['kind']
        errors = T.get('errors') or []
        letters_kind = kind == 'letters'
        # ---------------- lesson
        lesson = []
        for b in T.get('lesson') or []:
            b = dict(b)
            if b['type'] == 'listen':
                its = []
                for k, text in enumerate(b['items']):
                    focus = (b.get('focus') or [None] * len(b['items']))[k] if b.get('focus') else None
                    mods = {'focus': focus} if focus is not None else None
                    r = refs(str(text), letters=letters_kind and len(str(text)) <= 2, mods=mods)
                    its.append({'text': str(text), 'ref': {v: slim_ref(r[v]) for v in r}, 'audio': model_audio(r, mods=mods, slow=False, timings=True)})
                b['items'] = its
            elif b['type'] == 'contrast':
                fr_key = jobs.add(b['french'], V['FR'], 1.0, 'fr-fr', None, False, b['french']) if b.get('french') else None
                r = refs(b['english'])
                b['audio'] = {'fr': fr_key, 'en': model_audio(r, slow=False, timings=True)}
                b['ref'] = {v: slim_ref(r[v]) for v in r}
            lesson.append(b)

        # ---------------- perception
        P = T.get('perception') or {}
        task = P.get('task')
        pitems = []
        for k, it in enumerate(P.get('items') or []):
            pid = f'{tid}.p{k}'
            if isinstance(it, list):  # minimal pair (identify)
                opts = []
                for w in it:
                    r = refs(str(w))
                    opts.append({'text': str(w), 'ref': {v: slim_ref(r[v]) for v in r}, 'audio': hvpt_audio(r)})
                pitems.append({'id': pid, 'type': 'identify', 'options': opts})
            elif 'texts' in it:
                opts = []
                for w in it['texts']:
                    r = refs(w)
                    opts.append({'text': w, 'ref': {v: slim_ref(r[v]) for v in r}, 'audio': hvpt_audio(r)})
                pitems.append({'id': pid, 'type': 'identify', 'options': opts})
            elif isinstance(it, str):  # count task: plain word
                r = refs(it)
                cnt = {v: sum(len(w['syl']) for w in r[v]['words']) for v in r}
                pitems.append({'id': pid, 'type': task, 'text': it, 'count': cnt, 'ref': {v: slim_ref(r[v]) for v in r}, 'audio': hvpt_audio(r)})
            elif 'say' in it:  # letters
                r = refs(it['say'], letters=True)
                pitems.append({'id': pid, 'type': 'letters', 'say': it['say'], 'options': it['options'], 'audio': hvpt_audio(r)})
            else:
                text = it['text']
                mods = {}
                if 'focus' in it and task in ('focus',):
                    mods['focus'] = it['focus']
                if 'tone' in it:
                    mods['tone'] = it['tone']
                if 'focus_word' in it and task == 'stress-phrase':
                    pass
                r = refs(text, mods=mods or None)
                entry = {'id': pid, 'type': task, 'text': text, 'ref': {v: slim_ref(r[v]) for v in r},
                         'audio': hvpt_audio(r, mods=mods or None)}
                for key in ('stress', 'weak', 'ending', 'nucleus', 'tone', 'chunks', 'focus', 'question', 'blanks', 'words', 'focus_word', 'word', 'pos', 'variant'):
                    if key in it:
                        entry[key] = it[key]
                validate_perception(entry, r, tid)
                pitems.append(entry)

        # ---------------- production / guided
        prod = []
        for k, it in enumerate(T.get('production') or []):
            pid = f'{tid}.r{k}'
            if 'pair' in it:
                pair = []
                for w in it['pair']:
                    r = refs(w)
                    pair.append({'text': w, 'ref': {v: slim_ref(r[v]) for v in r}, 'audio': model_audio(r)})
                prod.append({'id': pid, 'type': 'pair', 'pair': pair})
                continue
            letters = 'letters' in it
            text = it.get('letters') or it['text']
            mods = {}
            if 'focus' in it and kind == 'nucleus':
                mods['focus'] = it['focus']
            if it.get('tone') in ('rise', 'fall-rise'):
                mods['tone'] = it['tone']  # Kokoro's '?' rarely rises: impose the tone with PSOLA
            r = refs(text, letters=letters, mods=mods or None)
            entry = {'id': pid, 'type': 'letters' if letters else 'say', 'text': text,
                     'ref': {v: slim_ref(r[v]) for v in r}, 'audio': model_audio(r, mods=mods or None)}
            for key in ('stress', 'stress_words', 'weak', 'strong', 'nucleus', 'tone', 'chunks', 'focus', 'focus_word', 'links', 'word'):
                if key in it:
                    entry[key] = it[key]
            entry['checks'] = {v: item_checks(g2p, T, entry, r[v], v) for v in ('GA', 'SBE')}
            validate_production(entry, r, tid)
            prod.append(entry)

        guided = []
        for k, it in enumerate(T.get('guided') or []):
            pid = f'{tid}.g{k}'
            r = refs(it['text'])
            entry = {'id': pid, 'type': 'guided', 'text': it['text'], 'fr': it.get('fr'), 'en': it.get('en'),
                     'ref': {v: slim_ref(r[v]) for v in r}, 'audio': model_audio(r)}
            entry['checks'] = {v: item_checks(g2p, T, entry, r[v], v) for v in ('GA', 'SBE')}
            if it.get('alt'):
                ra = refs(it['alt'])
                entry['alt'] = {'text': it['alt'], 'ref': {v: slim_ref(ra[v]) for v in ra}}
            guided.append(entry)

        tout = {k: T[k] for k in ('id', 'level', 'order', 'domain', 'kind', 'planet', 'title', 'tagline', 'why', 'criterion')}
        tout['phones'] = [content_unit(p) for p in T.get('phones') or []]
        tout['errors'] = errors
        tout['lesson'] = lesson
        tout['perception'] = {'task': task, 'items': pitems}
        tout['production'] = prod
        tout['guided'] = guided
        tout['transfer'] = T.get('transfer') or []
        tout['fiches'] = T.get('fiches') or {}
        targets_out.append(tout)
        index_targets.append({k: tout[k] for k in ('id', 'level', 'order', 'domain', 'kind', 'planet', 'title', 'tagline', 'why', 'criterion', 'phones')}
                             | {'counts': {'perception': len(pitems), 'production': len(prod), 'guided': len(guided)}})

    # ---------------- calibration & diagnostic
    calib = []
    for c in course['calibration']:
        r = refs(c['text'])
        calib.append({'text': c['text'], 'vowel': content_unit(c['vowel']), 'ref': {v: slim_ref(r[v]) for v in r}, 'audio': model_audio(r, slow=False)})
    diag = course['diagnostic']
    d_out = {'perception': [], 'stress': [], 'reading': [], 'free': diag['free']}
    for it in diag['perception']:
        opts = []
        for w in it['pair']:
            r = refs(w)
            opts.append({'text': w, 'ref': {v: slim_ref(r[v]) for v in r}, 'audio': hvpt_audio(r, n=3)})
        d_out['perception'].append({'target': it['target'], 'options': opts})
    for it in diag['stress']:
        r = refs(it['word'])
        d_out['stress'].append({**it, 'ref': {v: slim_ref(r[v]) for v in r}, 'audio': hvpt_audio(r, n=2)})
    for it in diag['reading']:
        r = refs(it['text'])
        entry = {'text': it['text'], 'checks_targets': it['checks'], 'ref': {v: slim_ref(r[v]) for v in r}, 'audio': model_audio(r, slow=False)}
        # merge segment checks of the listed targets
        tmap = {t['id']: t for t in targets_out}
        ch = {}
        for v in ('GA', 'SBE'):
            lst = []
            for tid in it['checks']:
                T = tmap.get(tid)
                if T and T['kind'] in ('segment', 'reduction', 'endings'):
                    for c in segment_checks(r[v], T['errors'], T['phones']):
                        c['target'] = tid
                        lst.append(c)
            ch[v] = lst
        entry['checks'] = ch
        d_out['reading'].append(entry)

    course_out = {
        'version': time.strftime('%Y%m%d%H%M'),
        'units': UNITS,
        'levels': course['levels'],
        'voices': {k: v for k, v in V.items()},
        'messages': course['messages'],
        'calibration': calib,
        'diagnostic': d_out,
        'targets': sorted(index_targets, key=lambda t: (['A2', 'B1', 'B2', 'C1'].index(t['level']), t['order'])),
    }

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'targets').mkdir(exist_ok=True)
    # audio
    if not args.no_audio:
        render_audio(jobs, args.workers)
    timings = load_timings()
    attach_timings(course_out, timings)
    for t in targets_out:
        attach_timings(t, timings)
        with open(OUT / 'targets' / f"{t['id']}.json", 'w', encoding='utf-8') as f:
            json.dump(t, f, ensure_ascii=False, separators=(',', ':'))
    if only and (OUT / 'course.json').exists():
        # partial build: keep the other targets of the existing index
        with open(OUT / 'course.json', encoding='utf-8') as f:
            prev = json.load(f)
        kept = [t for t in prev.get('targets', []) if t['id'] not in only]
        course_out['targets'] = sorted(kept + course_out['targets'], key=lambda t: (['A2', 'B1', 'B2', 'C1'].index(t['level']), t['order']))
    with open(OUT / 'course.json', 'w', encoding='utf-8') as f:
        json.dump(course_out, f, ensure_ascii=False, separators=(',', ':'))
    with open(CONTENT / 'BUILD_REPORT.md', 'w', encoding='utf-8') as f:
        f.write('# Rapport de construction du contenu\n\n')
        f.write(f"{len(targets_out)} cibles, {len(jobs.jobs)} fichiers audio.\n\n")
        f.write('## Points à vérifier\n\n' + ('\n'.join(f'- {r}' for r in REPORT) or 'Aucun.') + '\n')
    print(f'targets={len(targets_out)} audio_jobs={len(jobs.jobs)} warnings={len(REPORT)}')


def slim_ref(r):
    return {'text': r['text'], 'ipa': r['ipa'], 'words': r['words']}


def item_checks(g2p, T, entry, ref, variety):
    kind = T['kind']
    errors = T.get('errors') or []
    if kind in ('segment', 'reduction', 'endings', 'letters', 'count', 'spelling', 'connected', 'reading'):
        return segment_checks(ref, errors, T.get('phones'))
    if kind == 'weak':
        c = weak_checks(g2p, ref, variety, entry.get('weak'), entry.get('strong'))
        return c
    if kind == 'stress' and T.get('_reduction_errors'):
        # only the word(s) whose stress is practised, and only unstressed schwas
        words = [w['w'].lower() for w in ref['words']]
        want = {entry['word'].lower()} if entry.get('word') else {w['w'].lower() for w in ref['words'] if len(w['syl']) >= 2}
        errs = [dict(e, weight=min(0.6, e.get('weight', 0.5))) for e in T['_reduction_errors']]
        return [c for c in segment_checks(ref, errs, ['ə']) if words[c['w']] in want]
    return []


def stressed_index(ref_words, word=None):
    for w in ref_words:
        if word is None or w['w'].lower().strip('.,?!') == word.lower():
            return w['st'], len(w['syl'])
    return None, 0


def validate_perception(entry, r, tid):
    if entry['type'] == 'stress' and 'stress' in entry:
        word = entry.get('word')
        for v in ('GA', 'SBE'):
            if entry.get('variant') and entry['variant'] != v:
                continue
            words = [w for w in r[v]['words'] if (word is None or w['w'].lower() == word.lower())]
            w = words[-1] if word else max(r[v]['words'], key=lambda x: len(x['syl']))
            if w['st'] != entry['stress']:
                warn(f'{tid}: stress mismatch for {entry["text"]!r} ({v}): content={entry["stress"]} g2p={w["st"]} ({w["ipa"]})')
    if entry['type'] == 'count':
        pass


def validate_production(entry, r, tid):
    if 'stress' in entry and entry['type'] == 'say':
        for v in ('GA', 'SBE'):
            ws = r[v]['words']
            word = entry.get('word')
            w = [x for x in ws if word is None or x['w'].lower() == word.lower()]
            w = w[-1] if w else ws[-1]
            if w['st'] != entry['stress']:
                warn(f'{tid}: stress mismatch for {entry["text"]!r} ({v}): content={entry["stress"]} g2p={w["st"]} ({w["ipa"]})')
    for word, st in (entry.get('stress_words') or {}).items():
        sts = st if isinstance(st, list) else [st]
        for v in ('GA', 'SBE'):
            found = [x for x in r[v]['words'] if x['w'].lower().strip('.,?!') == word.lower()]
            for x, s in zip(found, sts):
                if x['st'] != s:
                    warn(f'{tid}: stress mismatch for {word!r} in {entry["text"]!r} ({v}): content={s} g2p={x["st"]} ({x["ipa"]})')


# ------------------------------------------------------------------ audio rendering
def render_audio(jobs, workers):
    AUDIO.mkdir(parents=True, exist_ok=True)
    todo = [(k, j) for k, j in jobs.jobs.items() if not (AUDIO / f'{k}.mp3').exists() or (j['timings'] and not (AUDIO / f'{k}.json').exists())]
    print(f'audio: {len(todo)} to render / {len(jobs.jobs)} total')
    if not todo:
        return
    from multiprocessing import Pool
    chunks = [todo[i::workers] for i in range(workers)]
    with Pool(workers) as pool:
        for n in pool.imap_unordered(_render_chunk, chunks):
            print('rendered', n)


_tts = None


def _render_chunk(chunk):
    global _tts
    from tts import TTS
    if _tts is None:
        _tts = TTS(threads=1)
    n = 0
    for key, j in chunk:
        try:
            _tts.render(j, AUDIO / f'{key}.mp3', AUDIO / f'{key}.json' if j['timings'] else None)
            n += 1
        except Exception as e:  # noqa
            print('ERROR', key, j.get('text'), e, file=sys.stderr)
    return n


def load_timings():
    out = {}
    for p in AUDIO.glob('*.json'):
        with open(p) as f:
            out[p.stem] = json.load(f)
    return out


def attach_timings(obj, timings):
    """Replace audio keys by {f: key, d: duration, t: timings?} objects, recursively."""
    def conv(k):
        t = timings.get(k)
        if not t:
            return {'f': k}
        return {'f': k, 'd': t['dur'], 'wt': t.get('words'), 'ut': t.get('units'), 'f0': t.get('f0'), 'pr': t.get('prom')}

    def walk(o):
        if isinstance(o, dict):
            for key, val in list(o.items()):
                if key == 'audio':
                    o[key] = conv_audio(val)
                else:
                    walk(val)
        elif isinstance(o, list):
            for x in o:
                walk(x)

    def conv_audio(a):
        if a is None:
            return None
        if isinstance(a, str):
            return conv(a)
        if isinstance(a, list):
            return [conv_audio(x) for x in a]
        if isinstance(a, dict):
            return {k: conv_audio(v) for k, v in a.items()}
        return a
    walk(obj)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--no-audio', action='store_true')
    ap.add_argument('--only', default='')
    ap.add_argument('--workers', type=int, default=3)
    build(ap.parse_args())
