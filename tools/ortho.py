"""Heuristic orthographic syllabification aligned to a known number of spoken syllables (for bubble labels)."""
import re
VOW = set('aeiouy')
ONSETS = {'bl','br','ch','cl','cr','dr','fl','fr','gl','gr','pl','pr','sc','sh','sk','sl','sm','sn','sp','st','sw','th','tr','tw',
          'wh','wr','sch','scr','shr','spl','spr','str','thr','phr','ph','qu','squ','kn','gn','ps','pn'}
DIGRAPHS = {'th','sh','ch','ph','wh','ck','ng','gh','qu'}

def _groups(w):
    lw = w.lower(); g = []; i = 0
    while i < len(lw):
        c = lw[i]
        isv = c in 'aeiou' or (c == 'y' and i > 0 and lw[i-1] not in 'aeiou')
        if c == 'u' and i > 0 and lw[i-1] == 'q':
            isv = False
        if isv:
            j = i + 1
            while j < len(lw) and (lw[j] in 'aeiou' or (lw[j] == 'y' and j == len(lw) - 1)):
                j += 1
            g.append([i, j]); i = j
        else:
            i += 1
    return g

def split(word, n):
    w = word
    lw = w.lower()
    if n <= 1:
        return [w]
    g = _groups(w)
    # silent final e (not -le after consonant), silent -ed, -es
    def silent(k):
        a, b = g[k]
        if k != len(g) - 1 or k == 0:
            return False
        if lw[a:b] == 'e' and b == len(lw):
            return not (len(lw) >= 3 and lw[-2] == 'l' and lw[-3] not in 'aeiouy')
        if lw[a:b] == 'e' and lw[b:] in ('d', 's') and b + 1 == len(lw) and len(lw) > 3 and lw[a-1] not in 'td':
            return True
        return False
    if len(g) > n:
        g = [x for k, x in enumerate(g) if not silent(k)] if any(silent(k) for k in range(len(g))) else g
    # split long vowel groups if too few
    while len(g) < n:
        cand = [k for k, (a, b) in enumerate(g) if b - a >= 2 and lw[a:b] not in ('ee', 'oo', 'ea', 'ai', 'ay', 'oa', 'ou', 'ow', 'oi', 'oy', 'ey', 'au', 'aw', 'ie', 'ei')]
        cand = cand or [k for k, (a, b) in enumerate(g) if b - a >= 2]
        if cand:
            k = cand[-1]; a, b = g[k]
            g[k:k+1] = [[a, a + 1], [a + 1, b]]
            continue
        # syllabic -le / -ism etc.: add group for final 'le'
        if lw.endswith('le') and [len(lw) - 1, len(lw)] not in g:
            g.append([len(lw) - 2, len(lw)])
            g = sorted(g); continue
        return None
    while len(g) > n:
        # merge the pair with fewest consonants between
        gaps = [(g[k+1][0] - g[k][1], k) for k in range(len(g) - 1)]
        _, k = min(gaps)
        g[k:k+2] = [[g[k][0], g[k+1][1]]]
    cuts = []
    for k in range(len(g) - 1):
        a = g[k][1]; b = g[k+1][0]
        cl = lw[a:b]
        if len(cl) == 0:
            cuts.append(b); continue
        if len(cl) == 1:
            cuts.append(a if cl != 'x' else b); continue
        # maximal legal onset for next syllable
        cut = b - 1
        for s in range(a, b):
            if lw[s:b] in ONSETS:
                cut = s; break
        # keep digraphs together
        if cut > a and lw[cut-1:cut+1] in DIGRAPHS and lw[cut-1:cut+1] not in ONSETS:
            cut += 1
        cuts.append(cut)
    parts = []; prev = 0
    for c in cuts:
        parts.append(w[prev:c]); prev = c
    parts.append(w[prev:])
    if any(p == '' for p in parts):
        return None
    return parts

if __name__ == '__main__':
    for w, n in [('about',2),('banana',3),('lemon',2),('again',2),('Canada',3),('potato',3),('idea',3),('idea',2),('event',2),('city',2),('very',2),('Tony',2),('forty',2),
                 ('photograph',3),('photographer',4),('economic',4),('development',4),('comparison',4),('opportunity',5),('interesting',3),('table',2),('walked',1),('wanted',2),('horses',2),('happiness',3),('museum',3),('career',2),('hotel',2),('police',2),('famous',2),('support',2)]:
        print(w, n, split(w, n))
