import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from './context/AppContext.jsx'
import AppLayout from './components/layout/AppLayout.jsx'
import TodayScreen from './components/today/TodayScreen.jsx'
import TemplateEditor from './components/templates/TemplateEditor.jsx'
import TimerScreen from './components/timer/TimerScreen.jsx'
import GoalsScreen from './components/goals/GoalsScreen.jsx'
import WikiScreen from './components/wiki/WikiScreen.jsx'
import StatsScreen from './components/stats/StatsScreen.jsx'
import SettingsScreen from './components/settings/SettingsScreen.jsx'

/**
 * Compass App - Root component
 *
 * Sets up:
 * - BrowserRouter for client-side routing
 * - AppProvider for global state (wraps everything)
 * - Route definitions for each screen
 *
 * Route structure:
 *   /           -> TodayScreen (daily schedule view)
 *   /templates  -> TemplateEditor (create/edit schedule templates)
 *   /timer      -> TimerScreen (stopwatch + manual logging)
 *   /goals      -> GoalsScreen (Stage 2: goal board, chains, vision/mission)
 *   /wiki       -> WikiScreen (Stage 3: personal knowledge base)
 *   /stats      -> StatsScreen (Stage 3: completion rates and historical stats)
 *   /settings   -> SettingsScreen (config + data management)
 */
function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<TodayScreen />} />
            <Route path="/templates" element={<TemplateEditor />} />
            <Route path="/timer" element={<TimerScreen />} />
            <Route path="/goals" element={<GoalsScreen />} />
            <Route path="/wiki" element={<WikiScreen />} />
            <Route path="/stats" element={<StatsScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
          </Route>
        </Routes>
      </AppProvider>
    </BrowserRouter>
  )
}

export default App
