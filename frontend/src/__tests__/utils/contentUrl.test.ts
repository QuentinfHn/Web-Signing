import { describe, it, expect } from 'vitest'
import { withContentVersion, buildContentUrl } from '../../utils/contentUrl'

describe('contentUrl utilities', () => {
  it('appends version to /content paths', () => {
    const updated = new Date('2024-01-01T00:00:00.000Z')
    const result = withContentVersion('/content/foo.png', updated)
    expect(result).toBe(`/content/foo.png?v=${updated.getTime()}`)
  })

  it('preserves existing query params', () => {
    const result = withContentVersion('/content/foo.png?x=1', 1700000000000)
    expect(result).toBe('/content/foo.png?x=1&v=1700000000000')
  })

  it('ignores non-content paths', () => {
    const result = withContentVersion('/assets/foo.png', 1700000000000)
    expect(result).toBe('/assets/foo.png')
  })

  it('adds version to absolute content URLs', () => {
    const result = withContentVersion('https://example.com/content/foo.png', 1700000000000)
    expect(result).toBe('https://example.com/content/foo.png?v=1700000000000')
  })

  it('builds full content URLs when baseUrl is provided', () => {
    const updated = new Date('2024-01-01T00:00:00.000Z')
    const result = buildContentUrl('/content/foo.png', updated, 'https://api.example.com/')
    expect(result).toBe(`https://api.example.com/content/foo.png?v=${updated.getTime()}`)
  })

  it('returns null when src is null', () => {
    const result = buildContentUrl(null, 1700000000000, 'https://api.example.com')
    expect(result).toBeNull()
  })

  it('leaves URL unchanged when updated is invalid', () => {
    const result = withContentVersion('/content/foo.png', 'not-a-date')
    expect(result).toBe('/content/foo.png')
  })
})
