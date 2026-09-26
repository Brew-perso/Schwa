# Contenus pédagogiques de Schwa

Tout le contenu du parcours (A2 → C1) vit dans ce dossier, en **YAML lisible et éditable sans développeur**.
Un script (`tools/build_content.py`) :

1. lit `course.yaml` (paliers, textes transversaux) et `targets/*.yaml` (une « cible » par fichier) ;
2. calcule les transcriptions de référence **GA** et **SBE** (dictionnaire `misaki`, avec surcharges manuelles dans `lexicon_overrides.yaml`) ;
3. génère l'audio modèle avec la synthèse neuronale **Kokoro** (voix américaines et britanniques, plusieurs voix pour l'entraînement perceptif) ;
4. écrit `public/content/course.json` et `public/audio/**`.

> Toute voix de l'application est une **voix de synthèse** (signalée comme telle dans l'app, AI Act art. 50).
> À vérifier à l'oreille avant diffusion : noms propres, formes faibles, mots rares.

## Structure d'une cible (`targets/<id>.yaml`)

| Champ | Rôle |
|---|---|
| `id`, `level` (A2/B1/B2/C1), `order`, `domain` | Place dans la carte du ciel. `domain` ∈ `percevoir`, `articuler`, `prosodie`, `aisance`. |
| `kind` | Type de moteur d'évaluation : `segment`, `stress`, `rhythm`, `weak`, `intonation`, `spelling`, `connected`, `reading`. |
| `title`, `tagline`, `why`, `criterion` | Textes `{fr, en}`. `criterion` = « à quoi je vois que j'ai réussi » (affiché avant l'activité). |
| `phones` | Sons surveillés par le moteur (symboles de l'inventaire Schwa). |
| `errors` | **Graphe d'erreurs attendues** des francophones : `{target, realized, fiche, weight}`. `realized: '∅'` = omission. |
| `lesson` | Micro-leçon (60–90 s) : blocs `text`, `listen`, `contrast`, `gesture`, `rule`, `quiz`. |
| `perception` | Entraînement perceptif (HVPT) : `identify`, `stress`, `count`, `same`, `odd`, `tone`. |
| `production` | Production contrôlée : mots, paires « faites-vous comprendre », phrases. |
| `guided` | Production guidée : phrases dont le sens dépend du son travaillé. |
| `transfer` | Mini-tâches de parole semi-spontanée. |
| `fiches` | Fiches de remédiation, indexées par clé et appelées par le moteur. |

### Registre : vouvoiement / tutoiement

Dans les textes français, la syntaxe `[vous|tu]` permet d'écrire les deux registres :
`[Posez|Pose] la langue entre les dents.` → « Posez… » (défaut) ou « Pose… » (option tutoiement).

### Symboles

L'API suit la tradition des dictionnaires et des concours (`iː ɪ e æ ʌ ɑː ɒ ɔː ʊ uː ɜː ə eɪ aɪ ɔɪ əʊ aʊ ɪə eə ʊə`),
avec l'équivalent GA (`oʊ`, `ɝ`, `ɚ`) affiché selon le modèle choisi.
