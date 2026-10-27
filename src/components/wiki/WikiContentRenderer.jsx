import { renderContentWithLinks } from '../../utils/wiki.js'

/**
 * WikiContentRenderer - Renders wiki page content with [[internal links]]
 *
 * Takes raw Markdown-ish content, parses [[Page Name]] references,
 * and renders them as clickable blue links. Unresolved links
 * (pages that don't exist) are styled with a dashed underline in red.
 *
 * Also handles basic Markdown formatting:
 * - **bold** and *italic*
 * - ## headings
 * - bullet lists (- item)
 * - numbered lists (1. item)
 *
 * Props:
 * - content: raw Markdown string
 * - allPages: array of all wiki pages (for resolving [[links]])
 * - onNavigate: callback(pageId) when a resolved link is clicked
 */
export default function WikiContentRenderer({ content, allPages, onNavigate }) {
  if (!content) {
    return <p className="text-text-muted italic">Empty page. Click Edit to start writing.</p>
  }

  // Parse content into segments of plain text and internal links
  const segments = renderContentWithLinks(content, allPages)

  // Process each text segment through basic Markdown rendering
  // and render link segments as clickable buttons
  return (
    <div className="wiki-content">
      {segments.map((segment, i) => {
        if (segment.type === 'link') {
          return (
            <InternalLink
              key={i}
              name={segment.value}
              pageId={segment.pageId}
              resolved={segment.resolved}
              onNavigate={onNavigate}
            />
          )
        }

        // Plain text segment -- render with basic Markdown formatting
        return <FormattedText key={i} text={segment.value} />
      })}
    </div>
  )
}

/**
 * Renders a [[Page Name]] internal link
 * - Resolved links: blue text with underline, clickable
 * - Unresolved links: red text with dashed underline, not clickable
 */
function InternalLink({ name, pageId, resolved, onNavigate }) {
  if (resolved && pageId) {
    return (
      <button
        onClick={() => onNavigate(pageId)}
        className="text-accent underline hover:text-blue-700 transition-colors cursor-pointer"
        title={`Go to: ${name}`}
      >
        {name}
      </button>
    )
  }

  // Unresolved link: page doesn't exist yet
  return (
    <span
      className="text-danger underline decoration-dashed cursor-help"
      title={`Page not found: ${name}`}
    >
      {name}
    </span>
  )
}

/**
 * Renders plain text with basic inline Markdown formatting
 * Handles: **bold**, *italic*, headings (##), and list items
 *
 * This is intentionally simple -- not a full Markdown parser.
 * For a personal wiki, these basics cover 90% of use cases.
 */
function FormattedText({ text }) {
  // Split text into lines to handle block-level formatting (headings, lists)
  const lines = text.split('\n')

  return (
    <>
      {lines.map((line, lineIdx) => {
        // Heading detection: ## Heading
        const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
        if (headingMatch) {
          const level = headingMatch[1].length
          const headingText = headingMatch[2]
          const Tag = `h${level + 1}` // h2, h3, h4 (offset by 1 since h1 is page title)
          const sizeClass = level === 1 ? 'text-xl' : level === 2 ? 'text-lg' : 'text-base'
          return (
            <Tag key={lineIdx} className={`${sizeClass} font-semibold text-text-primary mt-4 mb-2`}>
              <InlineFormatted text={headingText} />
            </Tag>
          )
        }

        // Bullet list item: - item
        if (line.match(/^\s*[-*]\s+/)) {
          const itemText = line.replace(/^\s*[-*]\s+/, '')
          return (
            <div key={lineIdx} className="flex gap-2 ml-4">
              <span className="text-text-muted select-none">-</span>
              <span><InlineFormatted text={itemText} /></span>
            </div>
          )
        }

        // Numbered list: 1. item
        const numMatch = line.match(/^\s*(\d+)\.\s+(.+)/)
        if (numMatch) {
          return (
            <div key={lineIdx} className="flex gap-2 ml-4">
              <span className="text-text-muted select-none">{numMatch[1]}.</span>
              <span><InlineFormatted text={numMatch[2]} /></span>
            </div>
          )
        }

        // Empty line = paragraph break
        if (line.trim() === '') {
          return <div key={lineIdx} className="h-3" />
        }

        // Regular line with inline formatting
        return (
          <span key={lineIdx}>
            <InlineFormatted text={line} />
            {lineIdx < lines.length - 1 ? '\n' : ''}
          </span>
        )
      })}
    </>
  )
}

/**
 * Inline formatting: **bold** and *italic*
 */
function InlineFormatted({ text }) {
  // Process **bold** and *italic* patterns
  // Order matters: bold first (** before *)
  const parts = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Look for **bold**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    // Look for *italic*
    const italicMatch = remaining.match(/\*(.+?)\*/)

    // Find the earliest match
    const boldIdx = boldMatch ? remaining.indexOf(boldMatch[0]) : Infinity
    const italicIdx = italicMatch ? remaining.indexOf(italicMatch[0]) : Infinity

    if (boldIdx === Infinity && italicIdx === Infinity) {
      // No more formatting found
      parts.push(<span key={key++}>{remaining}</span>)
      break
    }

    if (boldIdx <= italicIdx) {
      // Bold match comes first
      if (boldIdx > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, boldIdx)}</span>)
      }
      parts.push(<strong key={key++}>{boldMatch[1]}</strong>)
      remaining = remaining.slice(boldIdx + boldMatch[0].length)
    } else {
      // Italic match comes first
      if (italicIdx > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, italicIdx)}</span>)
      }
      parts.push(<em key={key++}>{italicMatch[1]}</em>)
      remaining = remaining.slice(italicIdx + italicMatch[0].length)
    }
  }

  return <>{parts}</>
}
