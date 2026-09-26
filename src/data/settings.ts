import { create } from 'zustand'
import { kvGet, kvSet } from './db'
import type { Level, Variety } from '../content/types'

export type Instr = 'auto' | 'fr' | 'mixed' | 'en'
export interface Calibration {
  ts: number
  f0med: number
  f0lo: number
  f0hi: number
  noiseDb: number
  /** Lobanov normalisation params from calibration vowels */
  f1: { m: number; s: number }
  f2: { m: number; s: number }
  vowels: Record<string, [number, number]>
}

export interface Settings {
  onboarded: boolean
  name: string
  variety: Variety
  goal: 'intelligibility' | 'authenticity'
  audience: 'general' | 'student' | 'cpge' | 'anglicist' | 'pro'
  register: 'vous' | 'tu'
  level: Level
  instr: Instr
  ipa: 'auto' | 1 | 2 | 3
  theme: 'auto' | 'light' | 'dark'
  font: 'normal' | 'large' | 'xlarge'
  motion: 'auto' | 'reduce'
  contrast: 'normal' | 'high'
  sfx: number
  silenceMs: number
  holdToTalk: boolean
  hideScores: boolean
  predict: boolean
  weeklyGoal: number
  affect: Record<string, number>
  consent: { storeAudio: boolean; research: boolean; askedAt?: number }
  priorities: string[]
  phono: Record<string, number>   // per-domain estimate 0..1 from diagnostic + practice
  calibration?: Calibration
  classCode: string
  createdAt: number
}

export const DEFAULTS: Settings = {
  onboarded: false,
  name: '',
  variety: 'GA',
  goal: 'intelligibility',
  audience: 'general',
  register: 'vous',
  level: 'B1',
  instr: 'auto',
  ipa: 'auto',
  theme: 'auto',
  font: 'normal',
  motion: 'auto',
  contrast: 'normal',
  sfx: 0.6,
  silenceMs: 750,
  holdToTalk: false,
  hideScores: false,
  predict: true,
  weeklyGoal: 4,
  affect: {},
  consent: { storeAudio: true, research: false },
  priorities: [],
  phono: {},
  classCode: '',
  createdAt: Date.now(),
}

interface Store {
  s: Settings
  ready: boolean
  hydrate: () => Promise<void>
  set: (patch: Partial<Settings>) => void
}

export const useSettings = create<Store>((set, get) => ({
  s: DEFAULTS,
  ready: false,
  hydrate: async () => {
    const saved = await kvGet<Partial<Settings>>('settings', {})
    const s = { ...DEFAULTS, ...saved }
    set({ s, ready: true })
    applyDocumentSettings(s)
  },
  set: (patch) => {
    const s = { ...get().s, ...patch }
    set({ s })
    applyDocumentSettings(s)
    void kvSet('settings', s)
  },
}))

export function applyDocumentSettings(s: Settings) {
  const r = document.documentElement
  if (s.theme === 'auto') r.removeAttribute('data-theme')
  else r.setAttribute('data-theme', s.theme)
  r.setAttribute('data-font', s.font)
  if (s.motion === 'reduce') r.setAttribute('data-motion', 'reduce')
  else r.removeAttribute('data-motion')
  r.setAttribute('data-contrast', s.contrast)
}

/** Instruction language for a given content level (progressive switch FR → EN), unless overridden. */
export function instrFor(s: Settings, contentLevel: Level): 'fr' | 'mixed' | 'en' {
  if (s.instr !== 'auto') return s.instr
  if (contentLevel === 'A2' || contentLevel === 'B1') return 'fr'
  if (contentLevel === 'B2') return 'mixed'
  return 'en'
}

/** Progressive IPA disclosure (charte §2.2): gesture & word → symbol hints → full transcription. */
export function ipaFor(s: Settings, contentLevel: Level): 1 | 2 | 3 {
  if (s.ipa !== 'auto') return s.ipa
  if (s.audience === 'anglicist') return 3
  if (contentLevel === 'A2') return 1
  if (contentLevel === 'B1' || contentLevel === 'B2') return 2
  return 3
}
