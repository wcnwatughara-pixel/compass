import { NavLink } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'

/**
 * Desktop sidebar navigation
 * Narrow 56px icon-only sidebar on the left side
 * Hidden on mobile (bottom nav takes over)
 *
 * Uses the same icon set as BottomNav for consistency
 */

function TodayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <circle cx="12" cy="16" r="1.5" fill="currentColor" />
    </svg>
  )
}

function TemplatesIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function TimerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13" r="9" />
      <polyline points="12,9 12,13 15,15" />
      <line x1="12" y1="1" x2="12" y2="4" />
      <line x1="9" y1="2" x2="15" y2="2" />
    </svg>
  )
}

function GoalsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}

function WikiIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      <line x1="9" y1="7" x2="17" y2="7" />
      <line x1="9" y1="11" x2="15" y2="11" />
    </svg>
  )
}

function StatsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

// Navigation items -- Wiki and Stats tabs added in Stage 3
const navItems = [
  { to: '/', icon: TodayIcon, label: 'Today' },
  { to: '/templates', icon: TemplatesIcon, label: 'Templates' },
  { to: '/timer', icon: TimerIcon, label: 'Timer' },
  { to: '/goals', icon: GoalsIcon, label: 'Goals' },
  { to: '/wiki', icon: WikiIcon, label: 'Wiki' },
  { to: '/stats', icon: StatsIcon, label: 'Stats' },
  { to: '/settings', icon: SettingsIcon, label: 'Settings' },
]

export default function Sidebar() {
  const { timerState } = useApp()

  return (
    <aside className="hidden md:flex flex-col items-center w-14 min-h-screen bg-bg-primary border-r border-border py-4 fixed left-0 top-0 z-50">
      {/* App logo/icon at the top */}
      <div className="mb-6 text-accent font-bold text-lg">C</div>

      <div className="flex flex-col items-center gap-1 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon

          if (item.disabled) {
            return (
              <div
                key={item.to}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-text-muted opacity-40 cursor-not-allowed"
                title={`${item.label} (Stage 2)`}
              >
                <Icon />
              </div>
            )
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `w-10 h-10 flex items-center justify-center rounded-lg transition-colors relative ${
                  isActive
                    ? 'bg-accent-light text-accent'
                    : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                }`
              }
              title={item.label}
            >
              <Icon />
              {/* Pulsing dot on Timer when active */}
              {item.to === '/timer' && timerState.isRunning && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full animate-pulse" />
              )}
            </NavLink>
          )
        })}
      </div>
    </aside>
  )
}
