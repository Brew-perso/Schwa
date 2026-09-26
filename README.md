# Schwa

**Prononciation anglaise pour francophones, de A2 à C1.** Application web installable (PWA), pensée pour la classe :
écouter, comparer, s'entraîner, avec un retour immédiat calculé **sur l'appareil**. Aucune voix n'est envoyée sur un serveur.

- 27 cibles en 4 niveaux (A2 « Décollage », B1 « Croisière », B2 « Haute altitude », C1 « Espace profond »).
  Chaque cible suit 5 étapes : découvrir → entendre → produire → guidé → transfert.
- Deux modèles de prononciation : américain (GA, par défaut) et britannique (SBE).
- Consignes en français en A2–B1, bilingues en B2, en anglais en C1 (réglable).
- Environ 6 900 enregistrements modèles, synthétisés par Kokoro-82M. Plusieurs voix pour l'entraînement perceptif à haute variabilité (HVPT).
- Moteur de parole local : encodeur Conformer-CTC (NeMo, int8, 46 Mo) + tête phonétique « Schwa » entraînée pour ce projet.
  Le moteur note le texte attendu en le comparant aux erreurs typiques des francophones. Il n'utilise pas de reconnaissance vocale libre.
- Carnet de progression, révisions espacées, export JSON. Un « Observatoire » enseignant agrège des rapports importés (heat map, CSV).

## Démarrer

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # dist/ (déployé tel quel sur Vercel)
npm test             # tests unitaires (fbank, calibration de l'évaluateur)
```

Le micro exige HTTPS ou `localhost`. Le moteur utilise WebAssembly multithread, qui demande les en-têtes COOP/COEP
(configurés dans `vite.config.ts` et `vercel.json`).

## Organisation

| Dossier | Contenu |
|---|---|
| `content/` | **Source pédagogique** (YAML) : `course.yaml`, `targets/*.yaml` (une cible par fichier), `lexicon_overrides.yaml`. Voir `content/README.md`. |
| `tools/` | Chaîne de construction Python : G2P (misaki), syllabation, TTS Kokoro, manipulation prosodique Praat (PSOLA), génération des icônes. |
| `public/content/`, `public/audio/` | Généré par `tools/build_content.py` (ne pas éditer à la main). |
| `public/models/` | Modèles ONNX du moteur (encodeur, tête Schwa, VAD Silero). |
| `src/engine/` | Moteur : fbank Kaldi en TS, CTC (forward / Viterbi), évaluation (segments, accent, tons, pauses, voyelles). |
| `src/audio/` | Capture (AudioWorklet, VAD neuronale), lecture, DSP. |
| `src/learning/` | Parcours, révisions espacées, maîtrise N1–N5, rapports. |
| `src/screens/`, `src/exercises/`, `src/art/`, `src/viz/` | Interface, exercices, illustrations SVG, visualisations. |
| `tests/` | Vitest (+ `tests/e2e/flow.mjs`, parcours Playwright avec « micro simulé »). |
| `docs/` | Décisions, moteur, feuille de route. |

## Modifier le contenu

1. Éditer `content/targets/<id>.yaml` : consignes, items, erreurs attendues, fiches de remédiation.
2. `python tools/build_content.py --workers 2`, ou `--only b1-th` pour une seule cible. Seuls les audios nouveaux sont synthétisés.
3. Relire `content/BUILD_REPORT.md` (mots inconnus, formes faibles douteuses…), puis `python tools/prune_audio.py` pour supprimer les audios devenus inutiles.

Dépendances Python : `kokoro-onnx`, `misaki[en]`, `onnxruntime`, `praat-parselmouth`, `lameenc`, `soundfile`, `pyyaml`.
Les modèles Kokoro (`kokoro-v1.0.onnx`, `voices-v1.0.bin`, variante horodatée) se placent dans `tools/models/`.

## Licences

- Code : **EUPL-1.2** (`LICENSES/EUPL-1.2.txt`).
- Contenu pédagogique (textes, fiches, audios générés) : **CC BY-NC-SA 4.0** (`LICENSES/CC-BY-NC-SA-4.0.txt`).
- Composants tiers : NeMo Conformer-CTC (CC-BY-4.0, NVIDIA), Kokoro-82M (Apache-2.0), Silero VAD (MIT),
  ONNX Runtime (MIT), polices Fraunces, Atkinson Hyperlegible Next et Charis SIL (OFL). Détails dans `docs/PROVENANCE.md`.

Voir aussi `docs/ENGINE.md` (fonctionnement et limites du moteur) et `docs/ROADMAP.md` (RGPD, options payantes, corpus humain).
