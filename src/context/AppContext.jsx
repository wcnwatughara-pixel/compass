import { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import db from '../db/db.js'
import { defaultWeekdayTemplate } from '../db/seedData.js'
import { getOrCreateTodaySchedule } from '../utils/schedule.js'

/**
 * AppContext provides global state for the Compass app
 *
 * State shape:
 * - todaySchedule: the current day's schedule (or null)
 * - templates: array of all schedule templates
 * - settings: object of key-value settings
 * - goals: array of all goal records from IndexedDB
 * - wikiPages: array of all wiki page records from IndexedDB (Stage 3)
 * - timerState: { isRunning, seconds, blockId, goalId }
 * - isLoading: initial data load flag
 */

const AppContext = createContext(null)

// Action types for the reducer
const ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_TODAY_SCHEDULE: 'SET_TODAY_SCHEDULE',
  SET_TEMPLATES: 'SET_TEMPLATES',
  SET_SETTINGS: 'SET_SETTINGS',
  SET_GOALS: 'SET_GOALS',
  SET_WIKI_PAGES: 'SET_WIKI_PAGES',
  UPDATE_TIMER: 'UPDATE_TIMER',
}

const initialState = {
  todaySchedule: null,
  templates: [],
  settings: {},
  goals: [],
  wikiPages: [],
  timerState: {
    isRunning: false,
    seconds: 0,
    blockId: null,
    goalId: null,
  },
  isLoading: true,
}

function appReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_LOADING:
      return { ...state, isLoading: action.payload }

    case ACTIONS.SET_TODAY_SCHEDULE:
      return { ...state, todaySchedule: action.payload }

    case ACTIONS.SET_TEMPLATES:
      return { ...state, templates: action.payload }

    case ACTIONS.SET_SETTINGS:
      return { ...state, settings: { ...state.settings, ...action.payload } }

    case ACTIONS.SET_GOALS:
      return { ...state, goals: action.payload }

    case ACTIONS.SET_WIKI_PAGES:
      return { ...state, wikiPages: action.payload }

    case ACTIONS.UPDATE_TIMER:
      return { ...state, timerState: { ...state.timerState, ...action.payload } }

    default:
      return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState)

  // Initial data load on mount
  // Seeds default template if database is empty (first launch)
  useEffect(() => {
    async function initializeApp() {
      try {
        // Check if this is a fresh database (no templates exist)
        const templateCount = await db.scheduleTemplates.count()

        if (templateCount === 0) {
          // First launch: seed with default weekday template
          const templateId = await db.scheduleTemplates.add(defaultWeekdayTemplate)
          // Set it as the active template
          await db.settings.put({ key: 'activeTemplateId', value: templateId })
        }

        // Load all templates
        const templates = await db.scheduleTemplates.toArray()
        dispatch({ type: ACTIONS.SET_TEMPLATES, payload: templates })

        // Load settings into a flat object { key: value }
        const settingsArray = await db.settings.toArray()
        const settingsObj = {}
        settingsArray.forEach((s) => {
          settingsObj[s.key] = s.value
        })
        dispatch({ type: ACTIONS.SET_SETTINGS, payload: settingsObj })

        // Load all goals (Stage 2)
        const goals = await db.goals.toArray()
        dispatch({ type: ACTIONS.SET_GOALS, payload: goals })

        // Load all wiki pages (Stage 3)
        const wikiPages = await db.wikiPages.toArray()
        dispatch({ type: ACTIONS.SET_WIKI_PAGES, payload: wikiPages })

        // Generate or fetch today's schedule
        const todaySchedule = await getOrCreateTodaySchedule()
        dispatch({ type: ACTIONS.SET_TODAY_SCHEDULE, payload: todaySchedule })

        dispatch({ type: ACTIONS.SET_LOADING, payload: false })
      } catch (error) {
        console.error('Failed to initialize Compass:', error)
        dispatch({ type: ACTIONS.SET_LOADING, payload: false })
      }
    }

    initializeApp()
  }, [])

  // Refresh today's schedule from the database
  const refreshTodaySchedule = useCallback(async () => {
    const schedule = await getOrCreateTodaySchedule()
    dispatch({ type: ACTIONS.SET_TODAY_SCHEDULE, payload: schedule })
  }, [])

  // Refresh templates list from the database
  const refreshTemplates = useCallback(async () => {
    const templates = await db.scheduleTemplates.toArray()
    dispatch({ type: ACTIONS.SET_TEMPLATES, payload: templates })
  }, [])

  // Refresh goals list from the database
  const refreshGoals = useCallback(async () => {
    const goals = await db.goals.toArray()
    dispatch({ type: ACTIONS.SET_GOALS, payload: goals })
  }, [])

  // Refresh wiki pages list from the database (Stage 3)
  const refreshWikiPages = useCallback(async () => {
    const wikiPages = await db.wikiPages.toArray()
    dispatch({ type: ACTIONS.SET_WIKI_PAGES, payload: wikiPages })
  }, [])

  // Update a setting in both state and database
  const updateSetting = useCallback(async (key, value) => {
    await db.settings.put({ key, value })
    dispatch({ type: ACTIONS.SET_SETTINGS, payload: { [key]: value } })
  }, [])

  // Timer state updates (used by the timer component and web worker)
  const updateTimer = useCallback((updates) => {
    dispatch({ type: ACTIONS.UPDATE_TIMER, payload: updates })
  }, [])

  const contextValue = {
    ...state,
    dispatch,
    refreshTodaySchedule,
    refreshTemplates,
    refreshGoals,
    refreshWikiPages,
    updateSetting,
    updateTimer,
  }

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  )
}

/**
 * Hook to access app context
 * Must be used within an AppProvider
 */
export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}
