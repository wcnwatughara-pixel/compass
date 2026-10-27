/**
 * Default seed data for first-time users
 * Creates a sample weekday template so the app isn't empty on first launch
 */

/**
 * Generate a unique ID for template blocks
 * Uses timestamp + random suffix to avoid collisions
 */
export function generateBlockId() {
  return `blk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Sample weekday template with common time blocks
 * Users can customize or replace this entirely
 */
export const defaultWeekdayTemplate = {
  name: 'Weekday',
  type: 'weekday',
  blocks: [
    {
      id: generateBlockId(),
      name: 'Morning Routine',
      startTime: '06:00',
      durationMinutes: 60,
      category: 'personal',
      linkedGoalId: null,
    },
    {
      id: generateBlockId(),
      name: 'Deep Work',
      startTime: '07:00',
      durationMinutes: 120,
      category: 'work',
      linkedGoalId: null,
    },
    {
      id: generateBlockId(),
      name: 'Break',
      startTime: '09:00',
      durationMinutes: 30,
      category: 'personal',
      linkedGoalId: null,
    },
    {
      id: generateBlockId(),
      name: 'Focused Learning',
      startTime: '09:30',
      durationMinutes: 90,
      category: 'learning',
      linkedGoalId: null,
    },
    {
      id: generateBlockId(),
      name: 'Lunch',
      startTime: '12:00',
      durationMinutes: 60,
      category: 'personal',
      linkedGoalId: null,
    },
    {
      id: generateBlockId(),
      name: 'Afternoon Work',
      startTime: '13:00',
      durationMinutes: 180,
      category: 'work',
      linkedGoalId: null,
    },
    {
      id: generateBlockId(),
      name: 'Exercise',
      startTime: '17:00',
      durationMinutes: 60,
      category: 'health',
      linkedGoalId: null,
    },
    {
      id: generateBlockId(),
      name: 'Evening Review',
      startTime: '20:00',
      durationMinutes: 30,
      category: 'personal',
      linkedGoalId: null,
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}
