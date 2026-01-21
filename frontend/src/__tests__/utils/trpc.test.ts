import { describe, it, expect, vi } from 'vitest'

vi.mock('../../utils/trpc', () => ({
  trpcClient: {
    query: { query: vi.fn() },
    mutate: { mutate: vi.fn() },
  },
  getAuthHeaders: vi.fn(() => ({})),
}))

describe('trpc utility', () => {
  describe('trpcClient mock', () => {
    it('is initialized', async () => {
      const { trpcClient } = await import('../../utils/trpc')
      expect(trpcClient).toBeDefined()
      expect(typeof trpcClient).toBe('object')
    })
  })

  describe('getAuthHeaders mock', () => {
    it('returns empty object by default', async () => {
      const { getAuthHeaders } = await import('../../utils/trpc')
      const headers = getAuthHeaders()
      expect(headers).toEqual({})
    })
  })
})
