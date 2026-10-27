import Dexie from 'dexie'

/**
 * Compass IndexedDB database via Dexie.js
 *
 * Tables (versioned):
 *
 * Stage 1 (version 1):
 * - scheduleTemplates: reusable schedule blueprints (weekday, weekend, etc.)
 * - dailySchedules: generated day instances from templates
 * - entries: timestamped activity log for time tracking
 * - settings: key-value store for app configuration
 *
 * Stage 2 (version 2):
 * - goals: goal definitions with target types, sequencing, and branching
 * - goalProgress: daily progress entries linked to goals
 *
 * Stage 3 (version 3):
 * - wikiPages: personal knowledge base pages with folders, tags, and goal linking
 * - wikiLinks: directional internal links between wiki pages ([[Page Name]] syntax)
 *
 * Indexes use Dexie syntax:
 *   ++id = auto-increment primary key
 *   &key = unique index
 *   *field = multi-entry index (for arrays like tags)
 *   [a+b] = compound index
 */

const db = new Dexie('CompassDB')

// Stage 1 schema -- keep for upgrade path so existing data migrates cleanly
db.version(1).stores({
  scheduleTemplates: '++id, name, type',
  dailySchedules: '++id, date, templateId',
  entries: '++id, date, type, goalId, blockId',
  settings: 'key',
})

// Stage 2 schema -- adds goals engine tables
// Dexie merges these with version(1); unchanged tables carry forward automatically
db.version(2).stores({
  // Goal definitions
  // Fields stored (not all indexed):
  //   id (auto), name, targetType ('hours'|'count'|'milestone'),
  //   targetValue (number), currentValue (number), status ('active'|'queued'|'complete'),
  //   sequenceParentId (id of the goal that must complete before this one activates),
  //   branchSiblingIds (array of goal ids -- alternative paths after parent completes),
  //   wikiPageId (reserved for Stage 3 wiki linking),
  //   completedAt, createdAt, updatedAt
  goals: '++id, status, sequenceParentId, wikiPageId',

  // Daily progress entries for goals
  // Each row records a chunk of progress on a specific date
  // Fields: id (auto), goalId, date (YYYY-MM-DD), amount (number),
  //   source ('timer'|'manual'|'schedule-block'), sourceBlockId, createdAt
  // Compound index [goalId+date] enables fast "progress for goal X on date Y" queries
  goalProgress: '++id, goalId, date, [goalId+date]',
})

// Stage 3 schema -- adds wiki/knowledge base tables
// Unchanged tables carry forward automatically from previous versions
db.version(3).stores({
  // Wiki page definitions
  // Fields stored (not all indexed):
  //   id (auto-increment), title (string), content (Markdown string),
  //   folder (string -- organizational grouping like 'Study', 'Work', 'Personal'),
  //   tags (string[] -- multi-entry indexed for tag-based filtering),
  //   linkedGoalId (nullable number -- FK to goals table for wiki-goal integration),
  //   createdAt (Unix timestamp), updatedAt (Unix timestamp)
  // *tags = multi-entry index: each tag value gets its own index entry,
  //   enabling queries like db.wikiPages.where('tags').equals('economics')
  wikiPages: '++id, title, folder, *tags, linkedGoalId',

  // Wiki internal links (for [[Page Name]] resolution and backlink queries)
  // Each row represents a directional link from one page to another
  // Fields: id (auto), sourcePageId (number), targetPageId (number)
  // Compound index [sourcePageId+targetPageId] enables fast duplicate-check
  //   and efficient "all links from page X" queries
  wikiLinks: '++id, sourcePageId, targetPageId, [sourcePageId+targetPageId]',
})

// Stage 4 schema -- adds sync metadata table for Google Drive sync
// Tracks last sync timestamp and stores conflict log entries
db.version(4).stores({
  // Sync metadata for Google Drive JSON sync
  // Fields stored:
  //   key (string PK) -- e.g. 'lastSyncTimestamp', 'driveFileId', 'syncEnabled'
  //   value (any) -- the stored value for this key
  // Also used for conflict log entries with key pattern 'conflict_<timestamp>':
  //   value: { localModified, driveModified, table, recordId, resolution, timestamp }
  syncMeta: 'key',
})

export default db
