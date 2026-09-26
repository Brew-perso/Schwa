# Le moteur d'évaluation

Tout tourne dans le navigateur, dans un Web Worker, via ONNX Runtime Web (WASM). Aucune donnée audio ne quitte l'appareil.

## Chaîne de traitement

1. **Capture**. Un AudioWorklet capture le son avec l'annulation d'écho, la réduction de bruit et le gain automatique désactivés : ces traitements déforment les formants et la F0.
   La VAD Silero v4 détecte la fin de parole, avec 300 ms de pré-roll. Un mode « maintenir pour parler » est prévu pour les salles bruyantes.
2. **Caractéristiques**. Le fbank Kaldi (80 bandes) est réimplémenté en TypeScript et vérifié contre `kaldi-native-fbank` (écart max < 0,02).
   Un léger dither est ajouté : le silence numérique fausse la normalisation.
3. **Encodeur**. NeMo `stt_en_conformer_ctc_small`, quantifié int8 (46 Mo). On en extrait la sortie de l'encodeur (176 dimensions, trames de 40 ms).
   Sa propre sortie BPE sert à afficher « ce que la machine a compris ».
4. **Tête Schwa** (5,5 Mo) : convolutions résiduelles, sur-échantillonnage à 20 ms, 49 unités. Les unités sont les 44 phonèmes anglais plus des sons français
   (o, e, œ, ʁ) pour reconnaître les substitutions typiques. Elle est entraînée en CTC sur LibriSpeech (train-clean-100) et sur des données synthétiques
   « accentuées » : Kokoro fait prononcer des erreurs de francophones, avec réverbération et bruit.
5. **Évaluation contrainte** (`src/engine/evaluate.ts`). On ne transcrit pas librement : on compare le texte attendu à ses variantes erronées
   prévues par la cible (le « graphe d'erreurs » du YAML). Chaque vérification produit un rapport de vraisemblance, avec des seuils plus
   indulgents en A2 qu'en C1.

## Ce qui est mesuré

| Dimension | Méthode | Remarques |
|---|---|---|
| Phonèmes (substitution, omission, insertion) | CTC forward sur l'alignement attendu vs variante | Très fiable sur les paires et les phrases |
| Paires minimales | Comparaison des deux textes, avec une marge exigée | « Pas sûr » si l'écart est faible |
| Accent de mot | Proéminence syllabique (durée, F0, intensité) **comparée à celle du modèle audio**, analysé par le même moteur | Neutralise l'allongement final et la longueur intrinsèque des voyelles |
| Voyelles réduites | Vérification ə vs voyelle pleine, ajoutée automatiquement aux mots des cibles d'accent | |
| Ton final | YIN → demi-tons ; seules les trames voisées fortes sont gardées ; les fragments de moins de 60 ms isolés par un saut sont rejetés | Montée, descente, descente-montée, plat |
| Mot noyau / focus | Proéminence des mots | |
| Groupes de souffle | Pauses détectées vs frontières attendues | |
| Voyelles (carte) | Formants LPC normalisés par la calibration | Affichage seulement, jamais une note |
| Contrôle qualité | Trop court, trop faible, saturé, **texte non reconnu** (écart par trame de parole) | Aucun verdict n'est donné si la qualité est douteuse |

**Principe de précision d'abord.** En cas de doute, l'application dit « pas bien entendu » et propose d'écouter et de comparer.
Elle n'affirme jamais une erreur sans indices solides : une fausse alarme décourage plus qu'une erreur non signalée.

## Résultats mesurés

Taux d'erreur phonétique sur le Speech Accent Archive (20 locuteurs francophones, « Please call Stella… ») :

| Moteur | Taille | Francophones | Anglophones natifs |
|---|---|---|---|
| Tête Schwa (LibriSpeech, 3 époques) | 46 Mo | **0,196** | 0,148 |
| wav2vec2-lv-60-espeak (int8) | 318 Mo | 0,256 | 0,129 |

Calibration de l'évaluateur (`tests/calibrate.test.ts`, 76 rendus synthétiques corrects ou « accentués ») :
**0 fausse alarme sur 40 rendus corrects**. Les erreurs manquées concernent surtout des rendus TTS où Kokoro n'a pas vraiment déplacé l'accent
(par exemple *career* : les indices sont identiques au rendu correct). Ce sont donc des limites du jeu de test plus que du moteur.

Test de bout en bout (`tests/e2e/flow.mjs`) : les items dits par une autre voix que le modèle sont jugés « clair » ;
les phrases qui ne correspondent pas au texte attendu sont rejetées (« pas bien entendu »).

## Limites connues

- Les données d'accent français sont **synthétiques**. Un corpus humain annoté (voir ROADMAP) est la prochaine étape décisive.
- L'accent de mot est le jugement le plus fragile, surtout pour les mots isolés dits très vite. L'application reste prudente.
- Les voix d'enfants et les voix très aiguës n'ont pas été testées.
- Premier chargement : environ 52 Mo de modèles, mis en cache ensuite (hors ligne possible).
