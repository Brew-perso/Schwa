# Feuille de route et options pour les versions suivantes

Ce document répond à la demande de rapport sur les options complexes : RGPD, options payantes, corpus construit par des humains.
Il liste aussi les questions qui restent à trancher.

## 1. RGPD : où en est la v2 ?

**Conception actuelle : minimisation maximale.**

- Pas de compte, pas de serveur applicatif, pas de cookie, pas de police ni de CDN tiers : tout est auto-hébergé.
- **Mesure d'audience anonyme** (Vercel Web Analytics, script servi par le même domaine) : pages vues uniquement, sans cookie ni identifiant durable
  (empreinte de visite recalculée chaque jour). Elle indique la fréquentation et les cibles et étapes consultées (l'adresse de la page les contient).
  Aucun événement personnalisé, aucune réponse ni aucun enregistrement. Activée par défaut, désactivable dans Réglages ; public visé : adultes
  (étudiants du supérieur, particuliers). Résultats dans Vercel → projet schwa → onglet Analytics.
- La voix est analysée **dans le navigateur**. Les enregistrements restent **sur l'appareil** (IndexedDB) pour la réécoute et le portfolio :
  seules les 5 dernières tentatives par item sont gardées, et l'option se désactive dans Réglages.
- Le partage avec l'enseignant se fait par **export volontaire** d'un fichier JSON, remis par l'apprenant (ENT, clé USB…).
  L'Observatoire enseignant lit ces fichiers localement ; rien n'est téléversé.
- Vercel ne sert que des fichiers statiques. Ses journaux techniques (IP, horodatage) relèvent de l'hébergeur ; les en-têtes
  `Referrer-Policy: no-referrer` et `Permissions-Policy` sont posés.

**Ce qu'il reste à faire, même sans serveur :**

1. Une **mention d'information** (art. 13) dans « À propos » : finalité, absence de transfert, durée de conservation locale, droit d'effacement
   (bouton « tout effacer » déjà présent dans Réglages). Un premier texte figure dans l'écran À propos ; à relire par vos soins.
2. Si vous l'utilisez avec des **mineurs** en établissement : informer le DPO académique et l'inscrire au registre des traitements de l'établissement.
   Le traitement est minime, mais l'export de fichiers vers l'enseignant en est un.
3. Hébergement : Vercel est une société américaine (Data Privacy Framework). Aucune donnée personnelle n'y transite en v2,
   mais un hébergement européen reste plus simple à défendre. **Alternatives gratuites ou peu chères** : Cloudflare Pages (région UE non garantie),
   ou un **serveur de l'établissement / apps.education.fr** (idéal).

**Si une synchronisation serveur est ajoutée un jour** (suivi de classe en direct), il faudra : une base de données en UE (voir 2.3),
une AIPD si des mineurs sont concernés, un consentement parental ou une base légale « mission d'intérêt public » via l'établissement,
le chiffrement et une durée de conservation définie.

## 2. Options payantes (non activées)

| Option | Apport | Coût indicatif | Commentaire |
|---|---|---|---|
| **Azure Pronunciation Assessment** | Scores phonème, mot et prosodie validés industriellement | ~1 € / h d'audio | Envoie la voix à Microsoft (UE possible). À réserver au mode enseignant ou à une validation ponctuelle. |
| **Voix TTS premium** (ElevenLabs, Azure Neural) | Encore plus naturelles, émotions, accents régionaux | 5–22 € / mois | Kokoro est déjà très bon ; gain surtout pour les dialogues et l'intonation expressive (C1). |
| **Synchronisation de classe** (Supabase UE, Scaleway) | Tableau de bord enseignant en direct | 0–25 € / mois | Nécessite l'étude RGPD ci-dessus. |
| **GPU ponctuel** (Hugging Face, RunPod) | Entraîner une tête plus grosse ; générer des illustrations | ~0,5–2 € / h | Utile pour la v3 : moteur haute précision, voir 3.2. |
| **Génération d'images** (Hugging Face Spaces / ZeroGPU) | Illustrations collage plus riches | Gratuit avec quota, via jeton | Le jeton `HF_TOKEN` est bien visible dans cette nouvelle session (compte `ggrluoy` authentifié), mais l'appel des Spaces (`dynamic_space`, opération `invoke`) reste bloqué par la politique du connecteur (« gradio=none »/scope non activé) — seule l'inspection des Spaces (liste, paramètres) fonctionne. Voir 4. |

## 3. Corpus humain : le levier principal pour la précision

Le moteur a été calibré sur des voix de synthèse et sur 20 locuteurs francophones du Speech Accent Archive.
**Des enregistrements réels de vos apprenants, annotés, sont ce qui améliorera le plus la fiabilité**, surtout pour l'accent de mot et l'intonation.

### 3.1 Protocole proposé (artisanal, réaliste)

1. **Collecte volontaire** : dans Réglages, une option « contribuer au corpus » (à ajouter) exporte les tentatives audio et leur verdict
   dans un fichier ZIP remis à l'enseignant. Consentement écrit, et parental pour les mineurs. Anonymisation : ni nom, ni métadonnées.
2. **Annotation** : un outil web local (à construire, ~1 jour) fait réécouter chaque tentative à l'enseignant, qui choisit « correct »,
   « erreur X » ou « inaudible ». 200 à 300 tentatives par cible suffisent pour recaler les seuils ; environ 30 à 60 minutes d'annotation par cible.
3. **Recalibrage automatique** : les seuils de `evaluate.ts` (THR par niveau, marges d'accent et de ton) sont réajustés par script
   pour maximiser l'accord avec l'enseignant **sous contrainte de fausses alarmes < 5 %**.
4. **Ré-entraînement** de la tête Schwa en ajoutant ces données aux données synthétiques (quelques heures sur CPU).
5. **Accord inter-annotateurs** : si un ou une collègue annote 10 % du corpus, on mesure la fiabilité (kappa de Cohen) et la limite atteignable.

### 3.2 Moteur haute précision (option)

wav2vec2-lv-60-espeak (318 Mo) est meilleur sur les natifs mais moins bon sur les francophones que la tête Schwa. Un modèle plus grand,
affiné sur le corpus humain (GPU requis, voir 2), pourrait être proposé comme « mode précis » téléchargeable à la demande.

## 4. Illustrations

Les illustrations actuelles sont des SVG faits main : oiseau (passereau gris-bleu de la maquette), planètes en trame demi-teinte, cartes du ciel, papier découpé.
Elles sont légères et ne dépendent d'aucun service. Pour des collages plus riches dans l'esprit de la maquette (liège, gravures anciennes) :

- **Tenté dans cette session** : le jeton `HF_TOKEN` est bien présent (compte Hugging Face `ggrluoy`, scope `inference-api` inclus) et les Spaces
  d'image (FLUX.1-schnell, Qwen-Image…) sont listés et inspectables. Mais l'opération d'appel (`invoke`) est désactivée par la configuration
  du connecteur MCP Hugging Face pour cette session (« l'opération invoke est désactivée car gradio=none est défini »). Aucune image n'a donc
  pu être générée. Pour lever ce blocage : vérifier, dans les réglages du connecteur Hugging Face sur claude.ai, qu'un accès Gradio/Spaces est
  bien autorisé (au besoin en listant explicitement l'ID du Space à utiliser), puis relancer une session ;
- en attendant, une alternative sans dépendance : des **gravures du domaine public** (Wikimedia Commons, Gallica, BHL : oiseaux, planches astronomiques
  du XIXᵉ), détourées. C'est gratuit, cohérent avec le style collage et juridiquement sûr.

## 0. Moteur 1.0.1 : formes faibles corrigées

La session précédente avait identifié un vrai problème de précision (voir aussi 4bis pour le reste de cette session) :
le moteur entendait « and », « can », etc. dans leur forme pleine même bien prononcés en forme faible, si bien qu'une
phrase correcte comme « Come and see us » recevait un « à affiner ». Cause : les transcriptions d'entraînement
utilisaient la forme pleine de ces mots (le G2P misaki donne la forme de citation, pas la forme réduite du discours
continu). Les données avaient été réétiquetées mais pas ré-entraînées.

**Fait dans cette session** : ré-entraînement complet (`tools/engine/weak_forms.py` corrige les étiquettes avant
l'entraînement, aussi bien pour la parole réelle que synthétique ; le même bug existait côté fabrication du contenu,
voir 4bis). Vérifié directement : sur le même enregistrement de « come and see us », le moteur actuellement en ligne
décode « ænd » et « ʌs » (forme pleine, à tort) ; le nouveau moteur décode « ənd » et « əs » (forme faible, correct).

Les jeux d'entraînement et de calibration (LibriSpeech, Speech Accent Archive) de la session précédente n'étaient pas
dans le dépôt et n'ont pas survécu au changement de session ; il a fallu retélécharger les modèles et données
(encodeur NeMo, Kokoro, ~5 900 énoncés LibriSpeech, 400 énoncés synthétiques accentués, 228 locuteurs SAA) et
reconstruire le jeu depuis zéro, à une échelle réduite par le temps disponible en session interactive :

| Mesure | 1.0.0 (production) | 1.0.1 (cette session) |
|---|---|---|
| Erreur phonétique, locuteurs français (SAA) | 0,184 | 0,211 |
| Erreur phonétique, locuteurs natifs (SAA) | 0,128 | **0,124** (meilleur) |
| Calibration (`tests/calibrate.test.ts`) | 70/76 | 68/76 |
| Fausses alertes sur prononciations correctes | 0/40 | **0/40** (inchangé) |

La régression sur l'erreur phonétique française (~15 % relatif) vient très probablement du volume réduit de parole
synthétique accentuée générée (400 contre un volume plus grand à l'origine, faute de temps — la synthèse Kokoro en
pleine précision sur CPU est le goulot d'étranglement, environ 20 à 30 énoncés/minute). La propriété la plus critique
pour l'usage pédagogique — ne jamais signaler à tort une bonne prononciation comme fausse — est intacte (0/40 les deux
fois). Recommandation : si cette version convient à l'usage, un ré-entraînement ultérieur avec plus de données
synthétiques (quelques heures de génération) devrait retrouver, voire dépasser, la précision de la 1.0.0 tout en
gardant la correction des formes faibles.

## 4bis. Déploiement Vercel (équipe `la-balme`)

L'équipe Vercel `la-balme` est bien connectée à votre compte GitHub. Le projet **`schwa`** a été créé dans cette équipe
(`vercel.com/la-balme/schwa`), configuré pour Vite (`npm run build`, sortie `dist/`).

**Ce qui bloque le premier déploiement complet :** relier le projet au dépôt GitHub `Brew-perso/Schwa` demande que
l'app GitHub de Vercel soit installée sur cet organisation ; ce n'est pas encore le cas (l'API renvoie
« you need to install the GitHub integration first »). Un envoi manuel des fichiers de build a été écarté : `dist/`
pèse 137 Mo pour plus de 9 000 fichiers (dont ~9 000 audios et les modèles ONNX du moteur), largement au-delà de ce
qu'un envoi fichier par fichier via l'API peut raisonnablement transporter.

**Pour terminer le déploiement :**

1. Installer l'app Vercel sur GitHub : <https://github.com/apps/vercel>, en l'autorisant pour l'organisation `Brew-perso`
   (ou au moins pour le dépôt `Schwa`).
2. Relier ensuite le dépôt au projet `schwa` déjà créé (Vercel Dashboard → Project Settings → Git, ou en relançant la
   même demande de déploiement) ; Vercel construira et déploiera automatiquement à chaque push.

Aucune donnée sensible n'est en jeu ici : c'est uniquement une autorisation GitHub ↔ Vercel côté organisation.

## 4ter. Vérification de l'interface

En attendant le déploiement, l'application a été testée en local (build de production + `vite preview`) avec le
parcours de bout en bout du dépôt (`tests/e2e/flow.mjs`, micro simulé) : accueil → onboarding → séance du jour →
carte du ciel → une cible complète (découvrir/entendre/produire/guidé/transfert) → carnet → réglages → espace
enseignant → à propos. Aucune erreur console, aucune régression visuelle relevée sur mobile (390 px) : palette,
typographie, illustrations et copy sont déjà cohérentes et soignées. Aucune retouche n'a donc été nécessaire lors de
cette session.

## 5. Prochaines étapes pédagogiques

- Enregistrements humains de référence pour les dialogues C1 (TTS moins convaincante pour les attitudes).
- Mode « classe » : projection d'un exercice au tableau, les élèves répondent sur leur téléphone (sans serveur, via un code de séance).
- Accessibilité : audit avec lecteur d'écran (NVDA / VoiceOver) et test avec des élèves dyslexiques (la police Atkinson est déjà en place).
- Variétés supplémentaires en écoute seulement (accents irlandais, écossais, indien, australien…) pour la compréhension.

## 6. Questions ouvertes pour vous

1. Hébergement : rester sur Vercel, ou préférer un hébergement éducatif européen ?
2. Faut-il un **nom de domaine** (ex. `schwa.<votre-domaine>`) ? Vercel fournit une URL gratuite en `.vercel.app`.
3. Voulez-vous une option « contribuer au corpus » dès la prochaine version, avec formulaire de consentement ?
4. Faut-il un mode **sans chiffres** strict (aucun point ni série) pour certains groupes ? Le réglage « masquer les scores » existe déjà.
5. Souhaitez-vous relire et ajuster les fiches de remédiation (`content/targets/*.yaml`, section `fiches`) ? Elles sont rédigées avec soin,
   mais votre voix d'enseignant·e les rendra plus justes.
