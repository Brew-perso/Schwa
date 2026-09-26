/* UI strings. French uses [vous|tu] for the register option. */
export const STRINGS = {
  nav_today: { fr: "Aujourd'hui", en: 'Today' },
  nav_map: { fr: 'Carte du ciel', en: 'Sky map' },
  nav_journal: { fr: 'Carnet', en: 'Logbook' },
  nav_more: { fr: 'Réglages', en: 'Settings' },
  back: { fr: 'Retour', en: 'Back' },
  next: { fr: 'Suivant', en: 'Next' },
  continue: { fr: 'Continuer', en: 'Continue' },
  start: { fr: 'Commencer', en: 'Start' },
  finish: { fr: 'Terminer', en: 'Finish' },
  skip: { fr: 'Passer', en: 'Skip' },
  close: { fr: 'Fermer', en: 'Close' },
  retry: { fr: 'Réessayer', en: 'Try again' },
  listen: { fr: 'Écouter', en: 'Listen' },
  listen_model: { fr: 'Écouter le modèle', en: 'Listen to the model' },
  listen_me: { fr: 'Me réécouter', en: 'Play me back' },
  slow: { fr: 'Ralenti', en: 'Slow' },
  ab: { fr: 'Modèle → moi → modèle', en: 'Model → me → model' },
  synthetic_voice: { fr: 'Voix de synthèse', en: 'Synthetic voice' },
  loading: { fr: 'Chargement…', en: 'Loading…' },

  st_clear: { fr: 'Clair', en: 'Clear' },
  st_refine: { fr: 'À affiner', en: 'To refine' },
  st_rework: { fr: 'À retravailler', en: 'To rework' },
  st_unsure: { fr: 'Pas bien entendu', en: 'Not heard well' },

  rec_tap: { fr: '[Touchez|Touche] pour parler', en: 'Tap to speak' },
  rec_listening: { fr: "J'écoute…", en: "I'm listening…" },
  rec_speaking: { fr: "Je [vous|t'] entends", en: 'I can hear you' },
  rec_processing: { fr: 'Analyse…', en: 'Analysing…' },
  rec_hold: { fr: 'Maintenir pour parler', en: 'Hold to talk' },
  rec_nothing: { fr: "Je n'ai rien entendu. [Vérifiez|Vérifie] le micro et [réessayez|réessaie].", en: "I didn't hear anything. Check your mic and try again." },
  rec_denied: { fr: "Le micro n'est pas autorisé. [Autorisez-le|Autorise-le] dans les réglages du navigateur pour [vous |t']entraîner à l'oral.", en: 'Microphone access is blocked. Allow it in your browser settings to practise speaking.' },

  qc_too_short: { fr: "C'était très court — [réessayez|réessaie] en disant tout l'énoncé.", en: 'That was very short — try again, saying the whole thing.' },
  qc_too_quiet: { fr: "Je n'ai pas bien entendu : [rapprochez-vous|rapproche-toi] du micro et [réessayez|réessaie].", en: "I didn't hear you well: move closer to the mic and try again." },
  qc_clipped: { fr: 'Le son sature : [éloignez|éloigne] un peu le micro.', en: 'The sound is clipping: move the mic a little further away.' },
  qc_mismatch: { fr: "Je n'ai pas bien reconnu la phrase attendue. [Écoutez|Écoute] le modèle, puis [réessayez|réessaie] — c'est peut-être aussi un bruit de fond.", en: "I couldn't match what I heard with the expected sentence. Listen to the model and try again — background noise can also be the cause." },
  unsure_msg: { fr: "Je n'ai pas assez d'indices pour trancher : [écoutez|écoute] et [comparez|compare] vous-même.", en: "I don't have enough evidence to decide: listen and compare for yourself." },

  predict_q: { fr: 'Avant d’essayer : comment [pensez-vous|penses-tu] que ça va sonner ?', en: 'Before you try: how do you think it will sound?' },
  predict_1: { fr: 'Pas encore', en: 'Not yet' },
  predict_2: { fr: 'Presque', en: 'Nearly' },
  predict_3: { fr: 'Clair', en: 'Clear' },

  heard_as: { fr: 'On a entendu', en: 'I heard' },
  aimed_at: { fr: '[Vous visiez|Tu visais]', en: 'You were aiming for' },
  machine_understood: { fr: 'Ce que la machine a compris', en: 'What the machine understood' },
  understood_pair: { fr: "J'ai compris :", en: 'I understood:' },

  legend_title: { fr: 'Légende', en: 'Key' },
  xp: { fr: 'points d’effort', en: 'effort points' },
  week_goal: { fr: 'Objectif de la semaine', en: 'Weekly goal' },
  sessions: { fr: 'séances', en: 'sessions' },
} as const

export type StringKey = keyof typeof STRINGS
