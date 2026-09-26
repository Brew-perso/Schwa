import { useSettings } from '../data/settings'
import type { Bi } from '../content/types'
import { STRINGS, type StringKey } from './strings'

/** Resolve the [vous|tu] register syntax used in French texts. */
export function reg(text: string, register: 'vous' | 'tu'): string {
  return frTypo(text.replace(/\[([^|\]]*)\|([^\]]*)\]/g, (_, v: string, t: string) => (register === 'tu' ? t : v)))
}

/** French typography: no line break inside « guillemets » nor before : ; ! ? (non-breaking spaces). */
export function frTypo(text: string): string {
  return text.replace(/« /g, '«\u00a0').replace(/ »/g, '\u00a0»').replace(/ ([:;!?])(?=\s|$)/g, '\u00a0$1')
}

export function fill(text: string, vars?: Record<string, string | number | undefined>) {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m))
}

export type Lang = 'fr' | 'en'

/** UI chrome language: French unless the learner chose full English. */
export function useUiLang(): Lang {
  const instr = useSettings((st) => st.s.instr)
  return instr === 'en' ? 'en' : 'fr'
}

export function useT() {
  const register = useSettings((st) => st.s.register)
  const lang = useUiLang()
  return (key: StringKey, vars?: Record<string, string | number | undefined>) => {
    const e = STRINGS[key]
    const raw = lang === 'en' ? e.en : e.fr
    return fill(reg(raw, register), vars)
  }
}

/** Pick a bilingual content text for the given instruction mode. */
export function pickBi(bi: Bi | undefined, lang: Lang, register: 'vous' | 'tu', vars?: Record<string, string | number | undefined>) {
  if (!bi) return ''
  const raw = lang === 'en' ? bi.en || bi.fr : bi.fr || bi.en
  return fill(reg(raw, register), vars)
}
