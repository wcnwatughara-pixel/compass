import db from '../db/db.js'

/**
 * Wiki utility functions
 *
 * Handles CRUD operations for wiki pages, internal link parsing/resolution,
 * backlink queries, and full-text search across the knowledge base (Stage 3).
 */

/**
 * Create a new wiki page and persist it to IndexedDB
 *
 * @param {Object} pageData - partial page fields from the creation form
 * @param {string} pageData.title - page title (must be unique for [[link]] resolution)
 * @param {string} [pageData.content] - Markdown content (defaults to empty)
 * @param {string} [pageData.folder] - organizational folder (e.g. 'Study', 'Work')
 * @param {string[]} [pageData.tags] - array of tag strings for categorization
 * @param {number|null} [pageData.linkedGoalId] - FK to goals table for integration
 * @returns {Promise<number>} the new page's auto-generated id
 */
export async function createWikiPage(pageData) {
  const now = Date.now()

  const page = {
    title: pageData.title.trim(),
    content: pageData.content || '',
    folder: pageData.folder?.trim() || 'Uncategorized',
    tags: pageData.tags || [],
    linkedGoalId: pageData.linkedGoalId || null,
    createdAt: now,
    updatedAt: now,
  }

  const id = await db.wikiPages.add(page)

  // Parse any [[links]] in the initial content and create wikiLinks entries
  if (page.content) {
    await syncPageLinks(id, page.content)
  }

  return id
}

/**
 * Update an existing wiki page's fields
 * If content changed, re-syncs internal links (wikiLinks table)
 *
 * @param {number} pageId
 * @param {Object} changes - partial fields to merge
 * @returns {Promise<void>}
 */
export async function updateWikiPage(pageId, changes) {
  const updates = {
    ...changes,
    updatedAt: Date.now(),
  }

  // If tags are provided, ensure they're cleaned up
  if (updates.tags) {
    updates.tags = updates.tags.map(t => t.trim()).filter(Boolean)
  }

  await db.wikiPages.update(pageId, updates)

  // If content was updated, re-sync internal links
  if (changes.content !== undefined) {
    await syncPageLinks(pageId, changes.content)
  }
}

/**
 * Delete a wiki page and clean up all related links
 * Removes both outgoing links (where this page is source)
 * and incoming links (where this page is target)
 *
 * @param {number} pageId
 * @returns {Promise<void>}
 */
export async function deleteWikiPage(pageId) {
  await db.transaction('rw', db.wikiPages, db.wikiLinks, async () => {
    // Remove all links where this page is the source
    await db.wikiLinks.where('sourcePageId').equals(pageId).delete()
    // Remove all links where this page is the target
    await db.wikiLinks.where('targetPageId').equals(pageId).delete()
    // Delete the page itself
    await db.wikiPages.delete(pageId)
  })
}

/**
 * Get a single wiki page by ID
 *
 * @param {number} pageId
 * @returns {Promise<Object|undefined>}
 */
export async function getWikiPage(pageId) {
  return db.wikiPages.get(pageId)
}

/**
 * Get all wiki pages, optionally filtered by folder or tag
 *
 * @param {Object} [filters]
 * @param {string} [filters.folder] - filter by folder name
 * @param {string} [filters.tag] - filter by tag
 * @returns {Promise<Array>} sorted by updatedAt descending (most recent first)
 */
export async function getWikiPages(filters = {}) {
  let collection

  if (filters.folder) {
    // Use the folder index for efficient filtering
    collection = db.wikiPages.where('folder').equals(filters.folder)
  } else if (filters.tag) {
    // Use the multi-entry *tags index for tag-based filtering
    collection = db.wikiPages.where('tags').equals(filters.tag)
  } else {
    collection = db.wikiPages.toCollection()
  }

  const pages = await collection.toArray()
  // Sort by most recently updated first
  return pages.sort((a, b) => b.updatedAt - a.updatedAt)
}

/**
 * Get all unique folder names from existing wiki pages
 * Used to populate the folder sidebar
 *
 * @returns {Promise<string[]>} sorted alphabetically
 */
export async function getWikiFolders() {
  const pages = await db.wikiPages.toArray()
  const folders = new Set(pages.map(p => p.folder).filter(Boolean))
  return [...folders].sort()
}

/**
 * Get all unique tags and their usage counts
 * Used to populate the tag cloud
 *
 * @returns {Promise<Array<{ tag: string, count: number }>>} sorted by count descending
 */
export async function getWikiTagCounts() {
  const pages = await db.wikiPages.toArray()
  const tagMap = new Map()

  for (const page of pages) {
    if (page.tags && Array.isArray(page.tags)) {
      for (const tag of page.tags) {
        tagMap.set(tag, (tagMap.get(tag) || 0) + 1)
      }
    }
  }

  return [...tagMap.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}

// ============================================================
// Internal linking: [[Page Name]] syntax
// ============================================================

/**
 * Parse [[Page Name]] references from Markdown content
 * Returns an array of page names found in double-bracket syntax
 *
 * @param {string} content - Markdown content to scan
 * @returns {string[]} array of referenced page names (may contain duplicates)
 */
export function parseInternalLinks(content) {
  if (!content) return []
  // Match [[anything]] but not [[]] (empty brackets)
  const regex = /\[\[([^\]]+)\]\]/g
  const links = []
  let match
  while ((match = regex.exec(content)) !== null) {
    links.push(match[1].trim())
  }
  return links
}

/**
 * Resolve a page name to its page ID
 * Case-insensitive match against page titles
 *
 * @param {string} pageName - the name from [[Page Name]] syntax
 * @returns {Promise<number|null>} page ID or null if no match
 */
export async function resolvePageLink(pageName) {
  // Dexie doesn't support case-insensitive queries directly,
  // so we fetch all pages and compare in JS
  // For a personal wiki this is fine -- not thousands of pages
  const pages = await db.wikiPages.toArray()
  const normalized = pageName.toLowerCase()
  const found = pages.find(p => p.title.toLowerCase() === normalized)
  return found ? found.id : null
}

/**
 * Sync the wikiLinks table to match the current [[links]] in a page's content
 * Deletes stale links and adds new ones in a single transaction
 *
 * @param {number} sourcePageId - the page whose content contains the links
 * @param {string} content - the page's current Markdown content
 * @returns {Promise<void>}
 */
export async function syncPageLinks(sourcePageId, content) {
  const linkNames = parseInternalLinks(content)
  // Deduplicate page names (case-insensitive)
  const uniqueNames = [...new Set(linkNames.map(n => n.toLowerCase()))]

  // Resolve all link names to page IDs (skip unresolved ones)
  const allPages = await db.wikiPages.toArray()
  const resolvedTargetIds = []
  for (const name of uniqueNames) {
    const target = allPages.find(p => p.title.toLowerCase() === name)
    if (target && target.id !== sourcePageId) {
      // Don't create self-links
      resolvedTargetIds.push(target.id)
    }
  }

  await db.transaction('rw', db.wikiLinks, async () => {
    // Remove all existing outgoing links from this page
    await db.wikiLinks.where('sourcePageId').equals(sourcePageId).delete()

    // Add new links for each resolved target
    for (const targetPageId of resolvedTargetIds) {
      await db.wikiLinks.add({ sourcePageId, targetPageId })
    }
  })
}

/**
 * Get all pages that link TO a given page (backlinks)
 * Returns full page objects for display in "Pages that link here" section
 *
 * @param {number} pageId - the target page
 * @returns {Promise<Array>} array of page objects that reference this page
 */
export async function getBacklinks(pageId) {
  // Find all wikiLinks where this page is the target
  const links = await db.wikiLinks.where('targetPageId').equals(pageId).toArray()
  const sourceIds = links.map(l => l.sourcePageId)

  if (sourceIds.length === 0) return []

  // Fetch the source page objects
  // bulkGet returns results in the same order as the input IDs
  const pages = await db.wikiPages.bulkGet(sourceIds)
  return pages.filter(Boolean) // filter out any deleted pages
}

// ============================================================
// Full-text search
// ============================================================

/**
 * Search across all wiki pages by title and content
 * Simple substring matching (case-insensitive) -- sufficient for a personal wiki
 *
 * @param {string} query - search string
 * @returns {Promise<Array>} matching pages sorted by relevance:
 *   title matches first, then content matches, each group sorted by updatedAt
 */
export async function searchWikiPages(query) {
  if (!query || !query.trim()) return []

  const normalizedQuery = query.trim().toLowerCase()
  const allPages = await db.wikiPages.toArray()

  // Separate into title matches (higher relevance) and content-only matches
  const titleMatches = []
  const contentMatches = []

  for (const page of allPages) {
    const titleMatch = page.title.toLowerCase().includes(normalizedQuery)
    const contentMatch = page.content?.toLowerCase().includes(normalizedQuery)

    if (titleMatch) {
      titleMatches.push(page)
    } else if (contentMatch) {
      contentMatches.push(page)
    }
  }

  // Sort each group by most recently updated
  titleMatches.sort((a, b) => b.updatedAt - a.updatedAt)
  contentMatches.sort((a, b) => b.updatedAt - a.updatedAt)

  // Title matches come first (more relevant), then content matches
  return [...titleMatches, ...contentMatches]
}

/**
 * Render wiki page content with [[links]] converted to clickable elements
 * Returns an array of segments: plain text and link objects
 * The UI component uses these to render text with embedded clickable links
 *
 * @param {string} content - raw Markdown content
 * @param {Array} allPages - all wiki pages (for resolving links)
 * @returns {Array<{ type: 'text' | 'link', value: string, pageId?: number, resolved: boolean }>}
 */
export function renderContentWithLinks(content, allPages) {
  if (!content) return [{ type: 'text', value: '' }]

  const segments = []
  const regex = /\[\[([^\]]+)\]\]/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(content)) !== null) {
    // Add text before this link
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: content.slice(lastIndex, match.index) })
    }

    // Resolve the link
    const pageName = match[1].trim()
    const normalizedName = pageName.toLowerCase()
    const targetPage = allPages.find(p => p.title.toLowerCase() === normalizedName)

    segments.push({
      type: 'link',
      value: pageName,
      pageId: targetPage?.id || null,
      resolved: !!targetPage,
    })

    lastIndex = match.index + match[0].length
  }

  // Add remaining text after last link
  if (lastIndex < content.length) {
    segments.push({ type: 'text', value: content.slice(lastIndex) })
  }

  return segments
}
