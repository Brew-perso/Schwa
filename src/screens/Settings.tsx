import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useSettings, type Settings as S } from '../data/settings'
import { reg } from '../i18n'
import { Paper } from '../components/Paper'
import { buildReport, downloadJson, exportAll } from '../learning/report'
import { wipeAll } from '../data/db'
import { IconDownload, IconTeacher, IconTrash, IconInfo, IconArrowRight, IconCompass } from '../art/Icons'
import { sfx } from '../audio/sfx'
import { Logo } from '../art/Logo'

function Choice<T extends string | number>({ value, options, onChange, label }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="row wrap" role="radiogroup" aria-label={label} style={{ gap: 6 }}>
      {options.map((o) => (
        <button key={String(o.v)} role="radio" aria-checked={value === o.v} className={`chip ${value === o.v ? 'on' : ''}`} onClick={() => onChange(o.v)}>{o.l}</button>
      ))}
    </div>
  )
}

export default function Settings() {
  const { s, set } = useSettings()
  const nav = useNavigate()
  const fr = s.instr !== 'en'
  const L = (a: string, b: string) => (fr ? reg(a, s.register) : b)
  const [exporting, setExporting] = useState(false)
  const up = (p: Partial<S>) => { set(p); sfx('tick') }
  return (
    <div className="main stack" style={{ ['--stack' as string]: '18px' }}>
      <div className="spread"><h1 style={{ margin: 0 }}>{L('Réglages', 'Settings')}</h1><Logo size={30} withWord={false} /></div>

      <Paper seed="set-learning" tape={L('Mon apprentissage', 'My learning')}>
        <div className="setting">
          <div><div className="s-title">{L('Modèle de référence', 'Reference accent')}</div><div className="s-sub">{L('Américain général (GA) ou britannique standard (SBE). Toute variété cohérente est légitime ; changer ne perd rien de vos acquis.', 'General American (GA) or Standard British (SBE). Any consistent variety is legitimate; switching keeps your progress.')}</div></div>
          <Choice label="variety" value={s.variety} onChange={(v) => up({ variety: v })} options={[{ v: 'GA', l: 'GA 🇺🇸' }, { v: 'SBE', l: 'SBE 🇬🇧' }]} />
        </div>
        <div className="setting">
          <div><div className="s-title">{L('Objectif', 'Goal')}</div><div className="s-sub">{L('« Être compris facilement » (par défaut) ou « Sonner proche du modèle » (mode authenticité, plus exigeant).', '"Be understood easily" (default) or "Sound close to the model" (authenticity mode, stricter).')}</div></div>
          <Choice label="goal" value={s.goal} onChange={(v) => up({ goal: v })} options={[{ v: 'intelligibility', l: L('Clarté', 'Clarity') }, { v: 'authenticity', l: L('Authenticité', 'Authenticity') }]} />
        </div>
        <div className="setting">
          <div><div className="s-title">{L('Mon niveau d’anglais', 'My English level')}</div><div className="s-sub">{L('Sert à choisir les cibles et leur ordre. Le profil de prononciation, lui, se met à jour tout seul.', 'Used to pick targets and their order. The pronunciation profile updates itself.')}</div></div>
          <Choice label="level" value={s.level} onChange={(v) => up({ level: v })} options={[{ v: 'A2', l: 'A2' }, { v: 'B1', l: 'B1' }, { v: 'B2', l: 'B2' }, { v: 'C1', l: 'C1' }]} />
        </div>
        <div className="setting">
          <div><div className="s-title">{L('Séances par semaine', 'Sessions per week')}</div><div className="s-sub">{L('Un objectif hebdomadaire, pas quotidien : les jours de repos comptent.', 'A weekly goal, not a daily one: rest days count.')}</div></div>
          <Choice label="weekly" value={s.weeklyGoal} onChange={(v) => up({ weeklyGoal: v })} options={[2, 3, 4, 5, 6].map((n) => ({ v: n, l: String(n) }))} />
        </div>
      </Paper>

      <Paper seed="set-lang" tone="kraft" tape={L('Langue et affichage', 'Language & display')} tapeTone="teal">
        <div className="setting">
          <div><div className="s-title">{L('Langue des consignes', 'Instruction language')}</div><div className="s-sub">{L('Automatique : français en A2–B1, bilingue en B2, anglais en C1 (avec traduction à la demande).', 'Automatic: French at A2–B1, bilingual at B2, English at C1 (translation on demand).')}</div></div>
          <Choice label="instr" value={s.instr} onChange={(v) => up({ instr: v })} options={[{ v: 'auto', l: 'Auto' }, { v: 'fr', l: 'FR' }, { v: 'mixed', l: 'FR+EN' }, { v: 'en', l: 'EN' }]} />
        </div>
        <div className="setting">
          <div><div className="s-title">{L('Adresse', 'Address')}</div><div className="s-sub">{L('Vouvoiement ou tutoiement dans les consignes.', 'Formal or informal French.')}</div></div>
          <Choice label="register" value={s.register} onChange={(v) => up({ register: v })} options={[{ v: 'vous', l: 'Vous' }, { v: 'tu', l: 'Tu' }]} />
        </div>
        <div className="setting">
          <div><div className="s-title">{L('Symboles phonétiques (API)', 'Phonetic symbols (IPA)')}</div><div className="s-sub">{L('1 : le geste et le mot · 2 : les symboles des sons travaillés · 3 : transcription complète (anglicistes).', '1: gesture & word · 2: symbols for target sounds · 3: full transcription.')}</div></div>
          <Choice label="ipa" value={s.ipa} onChange={(v) => up({ ipa: v })} options={[{ v: 'auto', l: 'Auto' }, { v: 1, l: '1' }, { v: 2, l: '2' }, { v: 3, l: '3' }]} />
        </div>
        <div className="setting">
          <div><div className="s-title">{L('Thème', 'Theme')}</div></div>
          <Choice label="theme" value={s.theme} onChange={(v) => up({ theme: v })} options={[{ v: 'auto', l: 'Auto' }, { v: 'light', l: L('Papier', 'Paper') }, { v: 'dark', l: L('Nuit', 'Night') }]} />
        </div>
        <div className="setting">
          <div><div className="s-title">{L('Taille du texte', 'Text size')}</div></div>
          <Choice label="font" value={s.font} onChange={(v) => up({ font: v })} options={[{ v: 'normal', l: 'A' }, { v: 'large', l: 'A+' }, { v: 'xlarge', l: 'A++' }]} />
        </div>
        <label className="setting switch">
          <div><div className="s-title">{L('Réduire les animations', 'Reduce motion')}</div></div>
          <input type="checkbox" checked={s.motion === 'reduce'} onChange={(e) => up({ motion: e.target.checked ? 'reduce' : 'auto' })} />
        </label>
        <label className="setting switch">
          <div><div className="s-title">{L('Contraste renforcé', 'Higher contrast')}</div></div>
          <input type="checkbox" checked={s.contrast === 'high'} onChange={(e) => up({ contrast: e.target.checked ? 'high' : 'normal' })} />
        </label>
      </Paper>

      <Paper seed="set-audio" tape={L('Micro et sons', 'Microphone & sounds')} tapeTone="coral">
        <div className="setting">
          <div><div className="s-title">{L('Fin de parole après…', 'End of speech after…')}</div><div className="s-sub">{L('Silence avant que l’enregistrement s’arrête seul. Plus long si [vous prenez|tu prends] le temps de chercher.', 'Silence before recording stops by itself. Longer if you like to take your time.')}</div></div>
          <Choice label="silence" value={s.silenceMs} onChange={(v) => up({ silenceMs: v })} options={[{ v: 600, l: '0,6 s' }, { v: 750, l: '0,75 s' }, { v: 1000, l: '1 s' }, { v: 1400, l: '1,4 s' }]} />
        </div>
        <label className="setting switch">
          <div><div className="s-title">{L('Maintenir pour parler', 'Hold to talk')}</div><div className="s-sub">{L('Pour les pièces bruyantes où la détection automatique se trompe.', 'For noisy rooms where automatic detection struggles.')}</div></div>
          <input type="checkbox" checked={s.holdToTalk} onChange={(e) => up({ holdToTalk: e.target.checked })} />
        </label>
        <div className="setting">
          <div><div className="s-title">{L('Sons de l’interface', 'Interface sounds')}</div></div>
          <input type="range" min={0} max={1} step={0.1} value={s.sfx} onChange={(e) => set({ sfx: Number(e.target.value) })} style={{ maxWidth: 180 }} aria-label="volume" />
        </div>
        <label className="setting switch">
          <div><div className="s-title">{L('Prédire avant d’essayer', 'Predict before trying')}</div><div className="s-sub">{L('Estimer son essai avant le retour aide à mieux s’entendre.', 'Estimating your attempt before feedback helps you hear yourself.')}</div></div>
          <input type="checkbox" checked={s.predict} onChange={(e) => up({ predict: e.target.checked })} />
        </label>
        <label className="setting switch">
          <div><div className="s-title">{L('Masquer les verdicts', 'Hide verdicts')}</div><div className="s-sub">{L('Mode brouillon : seulement les consignes et l’écoute comparée.', 'Draft mode: only instructions and compared listening.')}</div></div>
          <input type="checkbox" checked={s.hideScores} onChange={(e) => up({ hideScores: e.target.checked })} />
        </label>
        <div className="setting">
          <div><div className="s-title">{L('Recalibrer ma voix', 'Recalibrate my voice')}</div><div className="s-sub">{L('Micro, bruit ambiant et espace vocalique (30 s).', 'Mic, background noise and vowel space (30 s).')}</div></div>
          <Link className="btn small" to="/welcome/calibration">{L('Lancer', 'Start')}</Link>
        </div>
        <div className="setting">
          <div><div className="s-title">{L('Refaire le diagnostic', 'Redo the diagnostic')}</div><div className="s-sub">{L('Pour mettre à jour vos priorités (conseillé à chaque changement d’orbite).', 'To update your priorities (recommended at each new orbit).')}</div></div>
          <Link className="btn small" to="/welcome/diagnostic">{L('Lancer', 'Start')}</Link>
        </div>
      </Paper>

      <Paper seed="set-class" tone="kraft" tape={L('Classe et enseignant', 'Class & teacher')} tapeTone="indigo">
        <div className="setting">
          <div><div className="s-title">{L('Prénom (facultatif)', 'First name (optional)')}</div></div>
          <input type="text" style={{ maxWidth: 200 }} value={s.name} onChange={(e) => set({ name: e.target.value.slice(0, 40) })} />
        </div>
        <div className="setting">
          <div><div className="s-title">{L('Code de classe', 'Class code')}</div><div className="s-sub">{L('Donné par [votre|ton] enseignant, pour regrouper les bilans.', 'Given by your teacher, to group reports.')}</div></div>
          <input type="text" style={{ maxWidth: 140 }} value={s.classCode} onChange={(e) => set({ classCode: e.target.value.toUpperCase().slice(0, 12) })} />
        </div>
        <div className="setting">
          <div><div className="s-title">{L('Envoyer mon bilan', 'Send my report')}</div><div className="s-sub">{L('Un fichier avec vos niveaux par cible et votre régularité — sans enregistrement. Rien n’est envoyé automatiquement.', 'A file with your levels per target and regularity — no recordings. Nothing is sent automatically.')}</div></div>
          <button className="btn small" disabled={exporting} onClick={async () => { setExporting(true); downloadJson(await buildReport(s), `schwa-bilan-${(s.name || 'anonyme').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`); setExporting(false) }}><IconDownload width={18} height={18} /> {L('Exporter', 'Export')}</button>
        </div>
        <div className="setting">
          <div><div className="s-title">{L('Espace enseignant', 'Teacher space')}</div><div className="s-sub">{L('L’Observatoire : importer les bilans d’un groupe et voir où il bloque.', 'The Observatory: import a group’s reports and see where it gets stuck.')}</div></div>
          <Link className="btn small" to="/teacher"><IconTeacher width={18} height={18} /> {L('Ouvrir', 'Open')}</Link>
        </div>
      </Paper>

      <Paper seed="set-data" tape={L('Mes données', 'My data')}>
        <div className="setting">
          <div><div className="s-title">{L('Où sont mes enregistrements ?', 'Where are my recordings?')}</div><div className="s-sub">{L('Uniquement sur cet appareil. L’analyse de la voix se fait dans le navigateur : aucun son n’est envoyé à un serveur.', 'Only on this device. Voice analysis runs in the browser: no audio is ever sent to a server.')}</div></div>
          <IconInfo width={24} height={24} />
        </div>
        <label className="setting switch">
          <div><div className="s-title">{L('Garder mes essais pour la réécoute', 'Keep my attempts for replay')}</div><div className="s-sub">{L('Les 5 derniers essais par item, sur cet appareil.', 'Last 5 attempts per item, on this device.')}</div></div>
          <input type="checkbox" checked={s.consent.storeAudio} onChange={(e) => up({ consent: { ...s.consent, storeAudio: e.target.checked } })} />
        </label>
        <div className="setting">
          <div><div className="s-title">{L('Exporter toutes mes données', 'Export all my data')}</div></div>
          <button className="btn small" onClick={async () => downloadJson(await exportAll(), `schwa-donnees-${new Date().toISOString().slice(0, 10)}.json`)}><IconDownload width={18} height={18} /> JSON</button>
        </div>
        <div className="setting">
          <div><div className="s-title">{L('Tout effacer', 'Erase everything')}</div><div className="s-sub">{L('Supprime définitivement progression, réglages et enregistrements de cet appareil.', 'Permanently deletes progress, settings and recordings from this device.')}</div></div>
          <button className="btn small ghost" style={{ color: 'var(--rework)' }} onClick={async () => {
            if (confirm(L('Tout effacer définitivement ?', 'Erase everything permanently?'))) { await wipeAll(); localStorage.clear(); location.href = '/' }
          }}><IconTrash width={18} height={18} /> {L('Effacer', 'Erase')}</button>
        </div>
      </Paper>

      <button className="step-row" onClick={() => nav('/about')}>
        <span className="num"><IconCompass width={22} height={22} /></span>
        <span><span style={{ display: 'block', fontWeight: 700 }}>{L('À propos de Schwa', 'About Schwa')}</span><span className="small muted">{L('Méthode, IA et limites, confidentialité, licences, crédits', 'Method, AI and its limits, privacy, licences, credits')}</span></span>
        <IconArrowRight width={20} height={20} />
      </button>
    </div>
  )
}
