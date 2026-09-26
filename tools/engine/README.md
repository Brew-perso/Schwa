# Entraînement du moteur (tête phonétique Schwa)

Scripts utilisés pour produire `public/models/schwa-head.onnx`. Les données de travail vont dans `$SCHWA_WORK` (par défaut `./work`).

1. `libri_feats.py` : sorties de l'encodeur NeMo sur LibriSpeech train-clean-100 et étiquettes phonétiques GA (misaki), après téléchargement
   du jeu Hugging Face `openslr/librispeech_asr` dans `$SCHWA_WORK/hf/`.
2. `gen_data.py <worker> <nworkers>` : données « accentuées » synthétiques. Kokoro prononce des substitutions typiques des francophones,
   avec réverbération et bruit.
3. `train_head.py` : entraînement CTC de la tête (PyTorch, CPU).
4. `eval_head.py`, `saa.py`, `w2v.py` : taux d'erreur phonétique sur le Speech Accent Archive (20 francophones), et comparaison avec wav2vec2.
5. `export_engine.py <ckpt> public/models <version>` : export ONNX et `engine.json`.
6. `gen_fixtures.py` : jeux de test de l'évaluateur (`tests/fixtures/eval`), à régénérer après chaque nouvel export.

`units.py` définit les 49 unités ; l'ordre doit rester identique à `engine.json`.
