import { NavLink } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'

/**
 * Bottom navigation bar for mobile layout
 * Shows 5 tabs: Today, Templates, Timer, Goals (Stage 2), Settings
 *
 * Active tab gets the accent color, inactive tabs are muted
 * Timer tab shows a pulsing indicator when timer is running
 */

// SVG icon components (inline to avoid external dependencies)
// Each icon is 24x24, stroke-based for clean scaling

function TodayIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Calendar icon */}
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
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Grid/template icon */}
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function TimerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Clock/timer icon */}
      <circle cx="12" cy="13" r="9" />
      <polyline points="12,9 12,13 15,15" />
      <line x1="12" y1="1" x2="12" y2="4" />
      <line x1="9" y1="2" x2="15" y2="2" />
    </svg>
  )
}

function GoalsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Target/goal icon */}
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}

function WikiIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Book/wiki icon */}
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      <line x1="9" y1="7" x2="17" y2="7" />
      <line x1="9" y1="11" x2="15" y2="11" />
    </svg>
  )
}

function StatsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Bar chart icon */}
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Gear/settings icon */}
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

// Navigation items configuration
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

export default function BottomNav() {
  const { timerState } = useApp()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-bg-primary border-t border-border z-50 md:hidden safe-bottom">
      <div className="flex items-center justify-around h-14 px-1">
        {navItems.map((item) => {
          const Icon = item.icon

          // Disabled items (Goals until Stage 2) render as plain divs
          if (item.disabled) {
            return (
              <div
                key={item.to}
                className="flex flex-col items-center justify-center gap-0.5 py-1 px-1.5 text-text-muted opacity-40 cursor-not-allowed"
              >
                <Icon />
                <span className="text-[10px] font-medium">{item.label}</span>
              </div>
            )
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-1 px-1.5 transition-colors relative ${
                  isActive ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
                }`
              }
            >
              <div className="relative">
                <Icon />
                {/* Pulsing dot on Timer tab when timer is running */}
                {item.to === '/timer' && timerState.isRunning && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-accent rounded-full animate-pulse" />
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
