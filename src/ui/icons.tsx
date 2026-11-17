import type { ReactNode } from 'react'

// Basit çizgi ikonlar (özgün). currentColor ile temaya uyar.
const I = ({ children, label }: { children: ReactNode; label?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>
    {children}
  </svg>
)

export const Icon = {
  today: () => <I><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></I>,
  learn: () => <I><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20" /><path d="M9 8h7M9 12h5" /></I>,
  industry: () => <I><path d="M6 4h12M6 20h12M8 4v16M16 4v16" /><path d="M8 8c3 1 5 1 8 0M8 12c3 1 5 1 8 0M8 16c3 1 5 1 8 0" /></I>,
  words: () => <I><rect x="3" y="6" width="14" height="14" rx="3" /><path d="M7 3h11a3 3 0 0 1 3 3v11" /><path d="M7 11h6M7 15h4" /></I>,
  me: () => <I><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></I>,
  play: () => <I><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></I>,
  close: () => <I><path d="M6 6l12 12M18 6 6 18" /></I>,
  back: () => <I><path d="M15 5l-7 7 7 7" /></I>,
  check: () => <I><path d="M5 12.5l4.5 4.5L19 7.5" /></I>,
  pen: () => <I><path d="M4 20l4-1 11-11-3-3L5 16z" /><path d="M14 6l3 3" /></I>,
  keyboard: () => <I><rect x="2.5" y="6" width="19" height="12" rx="2.5" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" /></I>,
  plus: () => <I><path d="M12 5v14M5 12h14" /></I>,
  flame: () => <I><path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 1.5 1 2.5 2 3 3z" /></I>,
  refresh: () => <I><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 5v6h-6" /></I>,
  clock: () => <I><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></I>,
  sparkle: () => <I><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></I>,
  hint: () => <I><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z" /></I>,
  download: () => <I><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></I>,
  upload: () => <I><path d="M12 20V9M7 14l5-5 5 5M5 4h14" /></I>,
  users: () => <I><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14c2.3 0 4 1.2 4.7 3.5" /></I>,
  trash: () => <I><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></I>,
}

/** Filiz işareti: iki yapraklı filiz (özgün, baykuş değil) */
export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="var(--accent)" />
      <path d="M32 50V30" stroke="var(--accent-ink)" strokeWidth="4" strokeLinecap="round" />
      <path d="M32 33c-2-9-9-13-17-12 0 8 7 14 17 12z" fill="var(--accent-ink)" />
      <path d="M32 29c2-8 8-12 16-11 0 8-7 13-16 11z" fill="var(--accent-ink)" opacity="0.8" />
    </svg>
  )
}
