import { useSettings } from '../data/settings'
import { TopBar } from '../components/Nav'
import { Paper } from '../components/Paper'
import { Logo } from '../art/Logo'
import { Swallow } from '../art/Swallow'
import { reg } from '../i18n'

export default function About() {
  const s = useSettings((st) => st.s)
  const fr = s.instr !== 'en'
  const L = (a: string, b: string) => (fr ? reg(a, s.register) : b)
  return (
    <div className="main stack" style={{ ['--stack' as string]: '18px' }}>
      <TopBar back="/settings" />
      <div className="row" style={{ justifyContent: 'space-between' }}><Logo size={46} /><Swallow pose="perch" size={100} /></div>
      <p className="italic-display" style={{ fontSize: '1.3rem' }}>{L('Viser la clarté, pas l’accent natif.', 'Aim for clarity, not a native accent.')}</p>

      <Paper seed="a1" tape={L('La méthode', 'The method')}>
        <p>{L('Schwa suit un cadre didactique fondé sur la recherche : priorité à la compréhensibilité (Munro & Derwing), entraînement perceptif à voix multiples (HVPT), feedback explicite et ciblé, pratique courte et régulière, répétition espacée, et transfert vers la parole spontanée.', 'Schwa follows a research-based framework: comprehensibility first (Munro & Derwing), multi-voice perceptual training (HVPT), explicit targeted feedback, short regular practice, spaced repetition and transfer to spontaneous speech.')}</p>
        <p style={{ marginBottom: 0 }}>{L('Chaque cible suit cinq étapes : découvrir, entendre, produire, en contexte, parler librement — puis revient en révision espacée. Les points récompensent l’effort ; les niveaux de preuve (N1–N5) attestent la maîtrise.', 'Each target follows five steps: discover, hear, produce, in context, speak freely — then comes back in spaced review. Points reward effort; evidence levels (N1–N5) attest mastery.')}</p>
      </Paper>

      <Paper seed="a2" tone="kraft" tape={L('L’IA et ses limites', 'AI and its limits')} tapeTone="coral">
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>{L('Toutes les voix modèles sont des voix de synthèse (Kokoro). Les transcriptions sont contrôlées automatiquement ; si un mot [vous|te] semble mal prononcé, [signalez-le à votre|signale-le à ton] enseignant·e.', 'All model voices are synthetic (Kokoro). Transcriptions are checked automatically; if a word sounds wrong, tell your teacher.')}</li>
          <li>{L('L’analyse de [votre|ta] voix est faite par un modèle de reconnaissance phonétique qui tourne dans [votre|ton] navigateur. Il compare [votre|ton] essai à la cible et aux erreurs typiques des francophones.', 'Your voice is analysed by a phonetic recognition model running in your browser. It compares your attempt with the target and with typical errors of French speakers.')}</li>
          <li>{L('Il peut se tromper, surtout avec un micro de mauvaise qualité ou du bruit. Quand il doute, il le dit au lieu de [vous|te] sanctionner. Ses verdicts sont des indices, pas des notes.', 'It can be wrong, especially with a poor mic or noise. When unsure, it says so rather than penalising you. Its verdicts are hints, not grades.')}</li>
          <li>{L('Aucune émotion n’est jamais déduite de [votre|ta] voix, et [votre|ta] voix n’est jamais utilisée pour [vous|t’]identifier.', 'No emotion is ever inferred from your voice, and your voice is never used to identify you.')}</li>
          <li>{L('Les paliers de parole spontanée (N4) demandent un jugement humain : le vôtre à titre provisoire, puis celui d’un pair ou d’un enseignant.', 'Spontaneous-speech levels (N4) require human judgement: yours provisionally, then a peer or teacher.')}</li>
        </ul>
      </Paper>

      <Paper seed="a3" tape={L('Confidentialité', 'Privacy')} tapeTone="teal">
        <p style={{ marginBottom: 0 }}>{L('Schwa ne crée pas de compte et n’envoie aucun enregistrement : tout est stocké sur [votre|ton] appareil (IndexedDB). [Vous pouvez|Tu peux] exporter ou effacer [vos|tes] données à tout moment dans les réglages. Partager un bilan ou un enregistrement avec [votre|ton] enseignant·e se fait uniquement par un fichier que [vous choisissez|tu choisis] d’envoyer.', 'Schwa has no accounts and sends no recordings: everything is stored on your device (IndexedDB). You can export or erase your data at any time in settings. Sharing a report or recording with your teacher only happens through a file you choose to send.')}</p>
      </Paper>

      <Paper seed="a4" tone="kraft" tape={L('Licences et crédits', 'Licences & credits')} tapeTone="indigo">
        <ul className="small" style={{ margin: 0, paddingLeft: 20 }}>
          <li>{L('Contenus pédagogiques : CC BY-NC-SA 4.0 — usage pédagogique libre, non commercial.', 'Teaching content: CC BY-NC-SA 4.0 — free non-commercial educational use.')}</li>
          <li>{L('Code de l’application : EUPL 1.2 (licence libre européenne, valable en français).', 'App code: EUPL 1.2 (European free licence).')}</li>
          <li>Kokoro-82M (hexgrad) — Apache 2.0 · misaki G2P — Apache 2.0</li>
          <li>NVIDIA NeMo Conformer-CTC small (via sherpa-onnx) — CC BY 4.0 · {L('tête phonétique Schwa entraînée sur LibriSpeech (CC BY 4.0) et parole de synthèse', 'Schwa phone head trained on LibriSpeech (CC BY 4.0) and synthetic speech')}</li>
          <li>Silero VAD — MIT · ONNX Runtime Web — MIT</li>
          <li>Fraunces, Atkinson Hyperlegible Next, Charis SIL — SIL Open Font License</li>
          <li>{L('Cadre didactique : synthèse des travaux de Munro & Derwing, Levis, Darcy, Thomson, Celce-Murcia, Gilbert, anglistique française (Deschamps, Guierre, Gardelle, Chabert), rapports de jurys CAPES/agrégation.', 'Framework: synthesis of Munro & Derwing, Levis, Darcy, Thomson, Celce-Murcia, Gilbert, French anglistics, CAPES/agrégation examiners’ reports.')}</li>
        </ul>
      </Paper>
      <p className="small muted center">Schwa v1.0 · {L('Fait avec soin, de manière artisanale, pour mes apprenants.', 'Handcrafted with care for my learners.')}</p>
    </div>
  )
}
