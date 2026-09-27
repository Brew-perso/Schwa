import { NavLink, useNavigate } from 'react-router'
import { IconArrowLeft, IconJournal, IconMap, IconMore, IconSun } from '../art/Icons'
import { useT } from '../i18n'
import type { ReactNode } from 'react'
import { IpaSafe } from './IpaSafe'

export function BottomNav() {
  const t = useT()
  const items = [
    { to: '/', label: t('nav_today'), icon: <IconSun />, end: true },
    { to: '/map', label: t('nav_map'), icon: <IconMap /> },
    { to: '/journal', label: t('nav_journal'), icon: <IconJournal /> },
    { to: '/settings', label: t('nav_more'), icon: <IconMore /> },
  ]
  return (
    <nav className="nav" aria-label={t('main_nav')}>
      <div className="nav-inner">
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            {i.icon}
            <span>{i.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export function TopBar({ title, back = true, right, onBack }: { title?: ReactNode; back?: boolean | string; right?: ReactNode; onBack?: () => void }) {
  const nav = useNavigate()
  const t = useT()
  return (
    <div className="topbar">
      {back ? (
        <button className="back btn ghost small" style={{ border: 0 }} onClick={() => (onBack ? onBack() : typeof back === 'string' ? nav(back) : nav(-1))}>
          <IconArrowLeft width={20} height={20} /> {t('back')}
        </button>
      ) : <span />}
      {title && <div className="label" style={{ textAlign: 'center', flex: 1 }}>{typeof title === 'string' ? <IpaSafe text={title} /> : title}</div>}
      <div style={{ minWidth: 44, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
    </div>
  )
}
