# Feuille de route et options pour les versions suivantes

Ce document répond à la demande de rapport sur les options complexes : RGPD, options payantes, corpus construit par des humains.
Il liste aussi les questions qui restent à trancher.

## 1. RGPD : où en est la v2 ?

**Conception actuelle : minimisation maximale.**

- Pas de compte, pas de serveur applicatif, pas de cookie, pas de mesure d'audience, pas de police ni de CDN tiers : tout est auto-hébergé.
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
| **Génération d'images** (Hugging Face Spaces / ZeroGPU) | Illustrations collage plus riches | Gratuit avec quota, via jeton | Le connecteur n'autorisait pas l'appel des Spaces dans cette session. Voir 4. |

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

Les illustrations actuelles sont des SVG faits main : hirondelle, planètes en trame demi-teinte, cartes du ciel, papier découpé.
Elles sont légères et ne dépendent d'aucun service. Pour des collages plus riches dans l'esprit de la maquette (liège, gravures anciennes) :

- lancer dans **une nouvelle session** (le jeton `HF_TOKEN` n'est visible que dans les sessions créées après son ajout) un script de génération
  via un Space FLUX / SDXL, puis vectoriser et posteriser les images pour garder l'unité graphique ;
- ou utiliser des **gravures du domaine public** (Wikimedia Commons, Gallica, BHL : oiseaux, planches astronomiques du XIXᵉ), détourées. C'est gratuit,
  cohérent avec le style collage et juridiquement sûr.

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
