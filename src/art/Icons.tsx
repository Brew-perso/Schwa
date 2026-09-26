import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { title?: string }

function Base({ title, children, ...p }: P & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} {...p}>
      {title && <title>{title}</title>}
      {children}
    </svg>
  )
}

export const IconSun = (p: P) => <Base {...p}><circle cx="12" cy="12" r="4.2" /><path d="M12 2.6v2.2M12 19.2v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" /></Base>
export const IconMap = (p: P) => <Base {...p}><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(-20 12 12)" /><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" /><circle cx="18.6" cy="8.4" r="1.2" fill="currentColor" stroke="none" /></Base>
export const IconJournal = (p: P) => <Base {...p}><path d="M5 3.8h11.5a2 2 0 0 1 2 2V20.2H7a2 2 0 0 1-2-2z" /><path d="M5 18.2a2 2 0 0 1 2-2h11.5" /><path d="M9 7.5h6M9 10.5h4" /></Base>
export const IconMore = (p: P) => <Base {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3 5.5 5.5" /></Base>
export const IconMic = (p: P) => <Base {...p}><rect x="8.6" y="2.8" width="6.8" height="11.6" rx="3.4" /><path d="M5.2 11.2a6.8 6.8 0 0 0 13.6 0M12 18v3.2M8.6 21.2h6.8" /></Base>
export const IconPlay = (p: P) => <Base {...p}><path d="M7.5 4.8v14.4l11.6-7.2z" fill="currentColor" stroke="currentColor" /></Base>
export const IconPause = (p: P) => <Base {...p}><rect x="6.5" y="5" width="3.8" height="14" rx="1" fill="currentColor" /><rect x="13.7" y="5" width="3.8" height="14" rx="1" fill="currentColor" /></Base>
export const IconStop = (p: P) => <Base {...p}><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></Base>
export const IconSlow = (p: P) => <Base {...p}><path d="M3.5 15.5c0-4 3.2-7.2 7.2-7.2 3.4 0 5.8 2.3 6.3 5.1l2.6-.6c.9-.2 1.6.9 1 1.6l-1.2 1.4" /><path d="M3.5 15.5h14" /><path d="M6.5 15.5v2.5M14.5 15.5v2.5" /><circle cx="10.7" cy="12.1" r="1.6" /></Base>
export const IconAB = (p: P) => <Base {...p}><path d="M4 17.5 7.2 7h.6l3.2 10.5M5 14.2h5" /><path d="M13.5 7h3.4a2.4 2.4 0 0 1 0 4.8h-3.4zM13.5 11.8h4a2.8 2.8 0 0 1 0 5.7h-4z" /></Base>
export const IconRepeat = (p: P) => <Base {...p}><path d="M4 11a7 7 0 0 1 12.2-4.7L18.5 8.5" /><path d="M18.8 4v4.6h-4.6" /><path d="M20 13a7 7 0 0 1-12.2 4.7L5.5 15.5" /><path d="M5.2 20v-4.6h4.6" /></Base>
export const IconCheck = (p: P) => <Base {...p}><path d="M4.5 12.8l4.6 4.4L19.5 6.8" /></Base>
export const IconTarget = (p: P) => <Base {...p}><circle cx="12" cy="12" r="8.6" /><circle cx="12" cy="12" r="4.8" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /></Base>
export const IconCurve = (p: P) => <Base {...p}><path d="M4 16.5c3.5-9 10-10.5 15.5-6" /><path d="M19.8 5.6v4.8H15" /></Base>
export const IconQuestion = (p: P) => <Base {...p}><circle cx="12" cy="12" r="9" /><path d="M9.4 9.4a2.7 2.7 0 1 1 3.9 2.4c-.8.4-1.3 1-1.3 1.9v.5" /><circle cx="12" cy="17" r=".9" fill="currentColor" /></Base>
export const IconEar = (p: P) => <Base {...p}><path d="M7 9.2a5.2 5.2 0 1 1 10.4 0c0 3-2.4 3.8-3.2 5.6-.6 1.4-.4 2.4-1.6 3.6a2.6 2.6 0 0 1-4.2-1" /><path d="M10 9.4a2.2 2.2 0 0 1 4.4 0c0 1.2-1.2 1.6-1.2 2.8" /></Base>
export const IconSpeech = (p: P) => <Base {...p}><path d="M4 6.5a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5z" /><path d="M8.5 9.8h7M8.5 12.6h4.5" /></Base>
export const IconBook = (p: P) => <Base {...p}><path d="M3.5 5.5c3-1 5.8-.8 8.5 1 2.7-1.8 5.5-2 8.5-1v13c-3-1-5.8-.8-8.5 1-2.7-1.8-5.5-2-8.5-1z" /><path d="M12 6.5v13" /></Base>
export const IconLock = (p: P) => <Base {...p}><rect x="5.5" y="10.5" width="13" height="9.5" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></Base>
export const IconStar = (p: P) => <Base {...p}><path d="M12 3.2l2.5 5.6 6.1.6-4.6 4.1 1.3 6-5.3-3.1-5.3 3.1 1.3-6-4.6-4.1 6.1-.6z" /></Base>
export const IconArrowRight = (p: P) => <Base {...p}><path d="M4.5 12h14.5M13.5 6.5 19 12l-5.5 5.5" /></Base>
export const IconArrowLeft = (p: P) => <Base {...p}><path d="M19.5 12H5M10.5 6.5 5 12l5.5 5.5" /></Base>
export const IconClose = (p: P) => <Base {...p}><path d="M6 6l12 12M18 6 6 18" /></Base>
export const IconInfo = (p: P) => <Base {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5" /><circle cx="12" cy="7.8" r=".9" fill="currentColor" /></Base>
export const IconHeadphones = (p: P) => <Base {...p}><path d="M4 15v-2.5a8 8 0 0 1 16 0V15" /><rect x="3.5" y="14" width="4.5" height="6.5" rx="1.6" /><rect x="16" y="14" width="4.5" height="6.5" rx="1.6" /></Base>
export const IconHand = (p: P) => <Base {...p}><path d="M8 12.5V5.8a1.5 1.5 0 0 1 3 0v5.7M11 11.5V4.5a1.5 1.5 0 0 1 3 0v7M14 11.5V6a1.5 1.5 0 0 1 3 0v8.5c0 3.7-2.6 6.5-6 6.5-2.5 0-3.9-1.2-5.1-3.2l-2-3.4a1.4 1.4 0 0 1 2.3-1.6L8 14" /></Base>
export const IconEye = (p: P) => <Base {...p}><path d="M2.8 12s3.4-6.4 9.2-6.4 9.2 6.4 9.2 6.4-3.4 6.4-9.2 6.4S2.8 12 2.8 12z" /><circle cx="12" cy="12" r="2.8" /></Base>
export const IconTeacher = (p: P) => <Base {...p}><path d="M3 9.5 12 5l9 4.5-9 4.5z" /><path d="M7 11.5v4c1.2 1.4 3 2.1 5 2.1s3.8-.7 5-2.1v-4" /><path d="M21 9.5v5" /></Base>
export const IconDownload = (p: P) => <Base {...p}><path d="M12 4v11M7 10.5l5 5 5-5M4.5 19.5h15" /></Base>
export const IconUpload = (p: P) => <Base {...p}><path d="M12 15.5v-11M7 9l5-5 5 5M4.5 19.5h15" /></Base>
export const IconTrash = (p: P) => <Base {...p}><path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 13h9l1-13" /></Base>
export const IconSparkle = (p: P) => <Base {...p}><path d="M12 3.5c.6 4 2.5 6 6.5 6.5-4 .6-5.9 2.5-6.5 6.5-.6-4-2.5-5.9-6.5-6.5 4-.5 5.9-2.5 6.5-6.5z" /><path d="M19 15.5c.3 1.6 1 2.3 2.5 2.5-1.5.3-2.2 1-2.5 2.5-.3-1.5-1-2.2-2.5-2.5 1.5-.2 2.2-.9 2.5-2.5z" /></Base>
export const IconWave = (p: P) => <Base {...p}><path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10M21 12h0" /></Base>
export const IconVolume = (p: P) => <Base {...p}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" /></Base>
export const IconClock = (p: P) => <Base {...p}><circle cx="12" cy="12" r="8.8" /><path d="M12 7v5.2l3.4 2" /></Base>
export const IconFlame = (p: P) => <Base {...p}><path d="M12 21c-3.6 0-6-2.5-6-5.8 0-3.5 2.6-5.2 3.3-8.7 2 1.3 3 3 3.2 4.7.7-.6 1.2-1.7 1.3-3 2.2 1.8 4.2 4.3 4.2 7 0 3.3-2.4 5.8-6 5.8z" /></Base>
export const IconCompass = (p: P) => <Base {...p}><circle cx="12" cy="12" r="9" /><path d="M15.8 8.2l-2.3 5.3-5.3 2.3 2.3-5.3z" /></Base>

/** State icons — doubled coding of the three feedback states (charte §3.1). */
export const IconStateClear = (p: P) => <Base {...p}><circle cx="12" cy="12" r="9" /><path d="M7.8 12.4l2.8 2.7 5.6-6" /></Base>
export const IconStateRefine = (p: P) => <Base {...p}><path d="M4 16c3.2-8 9.5-9.4 15-5.4" /><path d="M19.4 6.4v4.4H15" /></Base>
export const IconStateRework = (p: P) => <Base {...p}><circle cx="12" cy="12" r="8.6" /><circle cx="12" cy="12" r="4.4" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /></Base>
export const IconStateUnsure = (p: P) => <Base {...p}><circle cx="12" cy="12" r="9" strokeDasharray="3 3" /><path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.2.9-1.2 1.7" /><circle cx="12" cy="16.6" r=".9" fill="currentColor" /></Base>
