import { IconStateClear, IconStateRefine, IconStateRework, IconStateUnsure } from '../art/Icons'
import type { State } from '../engine/evaluate'
import { useT } from '../i18n'

export function StateIcon({ state, size = 18 }: { state: State; size?: number }) {
  const p = { width: size, height: size }
  if (state === 'clear') return <IconStateClear {...p} />
  if (state === 'refine') return <IconStateRefine {...p} />
  if (state === 'rework') return <IconStateRework {...p} />
  return <IconStateUnsure {...p} />
}

export function StateBadge({ state }: { state: State }) {
  const t = useT()
  const label = state === 'clear' ? t('st_clear') : state === 'refine' ? t('st_refine') : state === 'rework' ? t('st_rework') : t('st_unsure')
  return <span className={`badge-state ${state}`}><StateIcon state={state} /> {label}</span>
}

/** Permanent legend in words (colour is never the only cue). */
export function Legend() {
  const t = useT()
  return (
    <div className="row wrap small" style={{ gap: 14 }} aria-label={t('legend_title')}>
      <span className="st-clear" style={{ textDecorationThickness: 2 }}>{t('st_clear')}</span>
      <span className="st-refine" style={{ textDecorationThickness: 2 }}>{t('st_refine')}</span>
      <span className="st-rework" style={{ textDecorationThickness: 2 }}>{t('st_rework')}</span>
      <span className="st-unsure">{t('st_unsure')}</span>
    </div>
  )
}
