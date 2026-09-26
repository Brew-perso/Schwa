/* Types mirroring public/content/*.json produced by tools/build_content.py */

export type Variety = 'GA' | 'SBE'
export type Level = 'A2' | 'B1' | 'B2' | 'C1'
export type Domain = 'percevoir' | 'articuler' | 'prosodie' | 'aisance'
export type Bi = { fr: string; en: string }

export interface AudioRef {
  f: string          // file key (public/audio/<f>.mp3)
  d?: number         // duration (s)
  wt?: ([number, number] | null)[]   // word timings
  ut?: ([number, number] | null)[]   // unit timings
  f0?: (number | null)[]              // semitones re. median, 50 Hz
  pr?: [number, number, number][][]   // per word, per syllable: [dur, intensity dB, f0 max st]
}

export interface Syl { n: number; s: 0 | 1 | 2; l: string }
export interface RefWord { w: string; ipa: string; u: number[]; syl: Syl[]; st: number | null }
export interface Ref { text: string; ipa: string; words: RefWord[] }
export type Refs = Record<Variety, Ref>

export interface ModelAudio { m: AudioRef[]; s?: AudioRef }
export type ModelAudioV = Record<Variety, ModelAudio>
export type HvptAudio = Record<Variety, AudioRef[]>

export interface CheckAlt { r: string; seq: number[]; f: string; wt: number }
export interface Check { w: number; p: number; t: number; ins?: boolean; word?: boolean; mode?: 'weak' | 'strong'; alts: CheckAlt[]; target?: string }

export interface LessonBlock {
  type: 'text' | 'listen' | 'contrast' | 'gesture' | 'rule' | 'quiz'
  fr?: string; en?: string
  art?: string
  items?: { text: string; ref: Refs; audio: ModelAudioV }[]
  focus?: number[]
  french?: string; english?: string
  audio?: { fr?: AudioRef | null; en?: ModelAudioV }
  ref?: Refs
  q?: Bi; options?: string[]; answer?: number; explain?: Bi
}

export interface PerceptionOption { text: string; ref: Refs; audio: HvptAudio }
export interface PerceptionItem {
  id: string
  type: 'identify' | 'letters' | 'stress' | 'count' | 'schwa' | 'endings' | 'nucleus' | 'tone' | 'chunks' | 'focus' | 'dictation' | 'stress-phrase'
  options?: PerceptionOption[] | string[]
  say?: string
  text?: string
  ref?: Refs
  audio?: HvptAudio
  stress?: number
  weak?: number[]
  ending?: string
  nucleus?: string
  tone?: 'fall' | 'rise' | 'fall-rise'
  chunks?: string[]
  focus?: number
  question?: Bi
  blanks?: string[]
  words?: string[]
  focus_word?: number
  word?: string
  count?: Record<Variety, number>
  variant?: Variety
}

export interface ProductionItem {
  id: string
  type: 'say' | 'pair' | 'letters' | 'guided'
  text?: string
  ref?: Refs
  audio?: ModelAudioV
  pair?: { text: string; ref: Refs; audio: ModelAudioV }[]
  stress?: number
  stress_words?: Record<string, number | number[]>
  weak?: string[]
  strong?: string[]
  nucleus?: string
  tone?: 'fall' | 'rise' | 'fall-rise'
  chunks?: string[]
  focus?: number
  focus_word?: number
  links?: string[]
  word?: string
  checks?: Record<Variety, Check[]>
  fr?: string; en?: string
  alt?: { text: string; ref: Refs }
}

export interface ErrorRule { target: string; realized: string; fiche: string; weight?: number; where?: string; word?: string }

export interface TargetSummary {
  id: string
  level: Level
  order: number
  domain: Domain
  kind: string
  planet: { color: string; motif: string }
  title: Bi
  tagline: Bi
  why: Bi
  criterion: Bi
  phones: string[]
  counts: { perception: number; production: number; guided: number }
}

export interface Target extends Omit<TargetSummary, 'counts'> {
  errors: ErrorRule[]
  lesson: LessonBlock[]
  perception: { task: string; items: PerceptionItem[] }
  production: ProductionItem[]
  guided: ProductionItem[]
  transfer: { fr: string; en: string; hint_words?: string[] }[]
  fiches: Record<string, Bi>
}

export interface LevelInfo { id: Level; name: Bi; blurb: Bi; can_do: Bi; instructions: 'fr' | 'mixed' | 'en' }

export interface Course {
  version: string
  units: string[]
  levels: LevelInfo[]
  voices: Record<string, unknown>
  messages: Bi[]
  calibration: { text: string; vowel: string; ref: Refs; audio: ModelAudioV }[]
  diagnostic: {
    perception: { target: string; options: PerceptionOption[] }[]
    stress: { target: string; word: string; stress: number; options: number; ref: Refs; audio: HvptAudio }[]
    reading: { text: string; checks_targets: string[]; ref: Refs; audio: ModelAudioV; checks: Record<Variety, Check[]> }[]
    free: { prompt: Bi }
  }
  targets: TargetSummary[]
}
