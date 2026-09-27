# Provenance des données et des modèles

| Élément | Source | Licence | Usage dans Schwa |
|---|---|---|---|
| Encodeur `stt_en_conformer_ctc_small` | NVIDIA NeMo, export ONNX int8 de sherpa-onnx | CC-BY-4.0 | Encodeur acoustique du moteur (`public/models/schwa-encoder.int8.onnx`) ; sortie intermédiaire exposée |
| Vocabulaire BPE | idem | CC-BY-4.0 | Transcription indicative « ce que la machine a compris » |
| Tête phonétique Schwa | Entraînée pour ce projet | EUPL-1.2 (poids) | `public/models/schwa-head.onnx` |
| LibriSpeech train-clean-100 | Panayotov et al., OpenSLR 12 | CC-BY-4.0 | Données d'entraînement de la tête (étiquettes phonétiques GA générées par misaki) |
| Données « accentuées » synthétiques | Générées avec Kokoro-82M | Apache-2.0 (modèle) | Entraînement : substitutions typiques des francophones, avec réverbération et bruit |
| Speech Accent Archive | Weinberger, George Mason University | CC BY-NC-SA 2.0 | **Évaluation uniquement** (20 locuteurs francophones) ; aucune donnée redistribuée |
| Kokoro-82M v1.0 (+ variante horodatée ONNX) | hexgrad / onnx-community | Apache-2.0 | Tous les enregistrements modèles (`public/audio`) |
| misaki (G2P) | hexgrad | Apache-2.0 | Transcriptions GA et SBE, formes faibles |
| Silero VAD v4 | Silero | MIT | Détection de fin de parole |
| ONNX Runtime Web | Microsoft | MIT | Exécution des modèles |
| Praat / parselmouth | Boersma & Weenink / Jadoul et al. | GPL-3.0 (outil de build uniquement, non distribué) | Manipulation PSOLA de l'intonation, mesures F0 |
| Fraunces, Atkinson Hyperlegible Next, Charis SIL | Undercase Type ; Braille Institute ; SIL | OFL-1.1 | Polices (auto-hébergées via Fontsource) |
| Illustrations (oiseau, planètes, cartes du ciel, papier) | Dessinées en SVG pour ce projet | CC BY-NC-SA 4.0 | Interface |
| Textes pédagogiques, fiches, items | Rédigés pour ce projet d'après le cadre didactique fourni | CC BY-NC-SA 4.0 | `content/` |

Remarque : les voix Kokoro sont des voix de synthèse. L'écran « À propos » l'indique à l'apprenant.
