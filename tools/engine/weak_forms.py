"""Weak-form correction for G2P output used to build CTC training labels.

Misaki's lexicon gives the strong/citation form for function words (e.g. "and" -> ænd,
"can" -> kæn). In real continuous speech these words are almost always reduced (/ənd/,
/kən/...). Left uncorrected, training labels for naturally-read speech (LibriSpeech)
mismatch what the audio actually contains, and the model then learns to associate the
*reduced* acoustic pattern with the *full-form* phones — so at inference, a student who
correctly says the weak form gets scored as if they said the strong one (evaluator error
report: schwa/schwa-issue "Come and see us" scored as needing work).

The word list and strong/weak split follow content/targets/b1-weak-forms.yaml: stranded
prepositions ("What are you looking at?") and elliptical modals/auxiliaries at the end of
a clause ("Yes, I can.") keep their strong form; conjunctions and pronouns don't get that
exception and stay weak even sentence-finally (curriculum example: "Come and see us.").
"""

# Weak forms, spelled in misaki's GA phoneme alphabet (ə, ɹ for the rhotic schwa).
WEAK = {
    'and': 'ənd', 'an': 'ən', 'can': 'kən', 'of': 'əv',
    'was': 'wəz', 'were': 'wəɹ',
    'to': 'tə', 'for': 'fəɹ', 'at': 'ət', 'us': 'əs',
}
# Stranded prepositions and elliptical modals/auxiliaries keep the strong form when they
# land as the last word of a sentence ("What are you looking at?", "Yes, I can.").
STRONG_WHEN_FINAL = {'to', 'for', 'at', 'of', 'can', 'was', 'were'}


def apply_weak_forms(tokens):
    """Mutate an misaki token list in place, replacing strong function-word phonemes
    with their weak form. Returns the same list."""
    last_word_idx = -1
    for i, tk in enumerate(tokens):
        if any(c.isalpha() for c in tk.text):
            last_word_idx = i
    for i, tk in enumerate(tokens):
        w = tk.text.lower()
        if w not in WEAK or not tk.phonemes:
            continue
        if w in STRONG_WHEN_FINAL and i == last_word_idx:
            continue
        tk.phonemes = WEAK[w]
    return tokens


def g2p_weak(G, text):
    """G2P a sentence and return (phoneme_string, tokens) with weak forms applied."""
    _, tokens = G(text)
    apply_weak_forms(tokens)
    ph = ''.join((tk.phonemes or '') + tk.whitespace for tk in tokens)
    return ph, tokens
