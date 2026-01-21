import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useDisplays } from '../../hooks/useDisplays'

vi.mock('../../utils/trpc')
const { trpcClient } = await import('../../utils/trpc')

describe('useDisplays hook', () => {
  const mockDisplays = [
    { id: 'display-1', name: 'Display 1', location: 'Room A', _count: { screens: 2 } },
    { id: 'display-2', name: 'Display 2', location: 'Room B', _count: { screens: 1 } },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(trpcClient.displays.list.query).mockResolvedValue(mockDisplays as any)
    vi.mocked(trpcClient.displays.create.mutate).mockResolvedValue({} as any)
    vi.mocked(trpcClient.displays.delete.mutate).mockResolvedValue({} as any)
    vi.mocked(trpcClient.displays.initFromScreens.mutate).mockResolvedValue({} as any)
  })

  it('loads displays on mount', async () => {
    const { result } = renderHook(() => useDisplays())

    await waitFor(() => {
      expect(trpcClient.displays.list.query).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(result.current.displays).toEqual(mockDisplays)
    })
  })

  it('sets loading state while loading', () => {
    vi.mocked(trpcClient.displays.list.query).mockImplementation(() => new Promise(() => { }))

    const { result } = renderHook(() => useDisplays())

    expect(result.current.isLoading).toBe(true)
  })

  it('sets loading to false after loading completes', async () => {
    const { result } = renderHook(() => useDisplays())

    await waitFor(() => {
      expect(trpcClient.displays.list.query).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('creates a new display', async () => {
    const { result } = renderHook(() => useDisplays())

    await waitFor(() => {
      expect(result.current.displays).toEqual(mockDisplays)
    })

    const success = await result.current.createDisplay('New Display')

    expect(trpcClient.displays.create.mutate).toHaveBeenCalledWith({ name: 'New Display' })
    expect(trpcClient.displays.list.query).toHaveBeenCalledTimes(2)
    expect(success).toBe(true)
  })

  it('does not create display with empty name', async () => {
    const { result } = renderHook(() => useDisplays())

    const success = await result.current.createDisplay('   ')

    expect(trpcClient.displays.create.mutate).not.toHaveBeenCalled()
    expect(success).toBe(false)
  })

  it('returns false on create error', async () => {
    vi.mocked(trpcClient.displays.create.mutate).mockRejectedValue(new Error('Already exists'))

    const { result } = renderHook(() => useDisplays())

    await waitFor(() => {
      expect(result.current.displays).toEqual(mockDisplays)
    })

    const success = await result.current.createDisplay('Duplicate Display')

    expect(success).toBe(false)
    expect(success).toBe(false)
    await waitFor(() => {
      expect(result.current.error).toBe('Already exists')
    })
  })

  it('deletes a display', async () => {
    const { result } = renderHook(() => useDisplays())

    await waitFor(() => {
      expect(result.current.displays).toEqual(mockDisplays)
    })

    const success = await result.current.deleteDisplay('display-1')

    expect(trpcClient.displays.delete.mutate).toHaveBeenCalledWith({ id: 'display-1' })
    expect(trpcClient.displays.list.query).toHaveBeenCalledTimes(2)
    expect(success).toBe(true)
  })

  it('returns false on delete error', async () => {
    vi.mocked(trpcClient.displays.delete.mutate).mockRejectedValue(new Error('Not found'))

    const { result } = renderHook(() => useDisplays())

    await waitFor(() => {
      expect(result.current.displays).toEqual(mockDisplays)
    })

    const success = await result.current.deleteDisplay('display-1')

    expect(success).toBe(false)
    expect(success).toBe(false)
    await waitFor(() => {
      expect(result.current.error).toBe('Not found')
    })
  })

  it('loads displays manually', async () => {
    const { result } = renderHook(() => useDisplays())

    await waitFor(() => {
      expect(result.current.displays).toEqual(mockDisplays)
    })

    await result.current.loadDisplays()

    expect(trpcClient.displays.list.query).toHaveBeenCalledTimes(2)
  })

  it('handles load error', async () => {
    vi.mocked(trpcClient.displays.list.query).mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useDisplays())

    await waitFor(() => {
      expect(trpcClient.displays.list.query).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(result.current.error).toBe('Network error')
    })
  })
})
