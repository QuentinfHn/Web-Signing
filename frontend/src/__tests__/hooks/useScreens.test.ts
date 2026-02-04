import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useScreens } from '../../hooks/useScreens'
import { Screen } from '../../utils/trpc'
import { ConflictMode } from '../../types/screen'

vi.mock('../../utils/trpc')
const { trpcClient } = await import('../../utils/trpc')

describe('useScreens hook', () => {
  const mockScreens: Screen[] = [
    {
      id: 'screen-1',
      displayId: 'display-1',
      x: 0,
      y: 0,
      width: 512,
      height: 512,
      name: 'Screen 1',
      lat: 50.8514,
      lng: 5.6910,
      address: 'Test Address 1',
      vnnoxPlayerId: null,
      vnnoxPlayerName: null,
      vnnoxOnlineStatus: null,
      vnnoxLastSeen: null,
    },
    {
      id: 'screen-2',
      displayId: 'display-1',
      x: 512,
      y: 0,
      width: 512,
      height: 512,
      name: 'Screen 2',
      lat: 50.8524,
      lng: 5.6920,
      address: 'Test Address 2',
      vnnoxPlayerId: null,
      vnnoxPlayerName: null,
      vnnoxOnlineStatus: null,
      vnnoxLastSeen: null,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(trpcClient.screens.list.query).mockResolvedValue(mockScreens)
    vi.mocked(trpcClient.screens.update.mutate).mockResolvedValue({} as any)
    vi.mocked(trpcClient.screens.delete.mutate).mockResolvedValue({} as any)
    vi.mocked(trpcClient.screens.create.mutate).mockResolvedValue({} as any)
    vi.mocked(trpcClient.screens.exportAll.query).mockResolvedValue({
      screens: mockScreens,
      version: '1.0',
      exportedAt: new Date().toISOString()
    })
    vi.mocked(trpcClient.screens.importScreens.mutate).mockResolvedValue({
      created: 1,
      updated: 0,
      skipped: 0,
      errors: [],
    })
  })

  it('loads screens on mount', async () => {
    const { result } = renderHook(() => useScreens())

    await waitFor(() => {
      expect(trpcClient.screens.list.query).toHaveBeenCalled()
    })

    expect(result.current.screens).toEqual(mockScreens)
  })

  it('sets loading state while loading', () => {
    vi.mocked(trpcClient.screens.list.query).mockImplementation(() => new Promise(() => { }))

    const { result } = renderHook(() => useScreens())

    expect(result.current.isLoading).toBe(true)
  })

  it('updates a screen', async () => {
    const { result } = renderHook(() => useScreens())

    await waitFor(() => {
      expect(result.current.screens).toEqual(mockScreens)
    })

    const success = await result.current.updateScreen('screen-1', {
      name: 'Updated Screen',
      x: 100,
      y: 200,
      width: 1024,
      height: 768,
      displayId: 'display-1',
      lat: 51.0,
      lng: 6.0,
      address: 'Updated Address',
    })

    expect(trpcClient.screens.update.mutate).toHaveBeenCalledWith({
      id: 'screen-1',
      name: 'Updated Screen',
      x: 100,
      y: 200,
      width: 1024,
      height: 768,
      displayId: 'display-1',
      lat: 51.0,
      lng: 6.0,
      address: 'Updated Address',
    })
    expect(success).toBe(true)
  })

  it('deletes a screen', async () => {
    const { result } = renderHook(() => useScreens())

    await waitFor(() => {
      expect(result.current.screens).toEqual(mockScreens)
    })

    const success = await result.current.deleteScreen('screen-1')

    expect(trpcClient.screens.delete.mutate).toHaveBeenCalledWith({ id: 'screen-1' })
    expect(success).toBe(true)
  })

  it('creates a new screen', async () => {
    const { result } = renderHook(() => useScreens())

    await waitFor(() => {
      expect(result.current.screens).toEqual(mockScreens)
    })

    const success = await result.current.createScreen({
      displayId: 'display-1',
      x: 0,
      y: 0,
      width: 512,
      height: 512,
      name: 'New Screen',
      lat: 50.8514,
      lng: 5.6910,
      address: 'New Address',
    })

    expect(trpcClient.screens.create.mutate).toHaveBeenCalledWith({
      displayId: 'display-1',
      x: 0,
      y: 0,
      width: 512,
      height: 512,
      name: 'New Screen',
      lat: 50.8514,
      lng: 5.6910,
      address: 'New Address',
    })
    expect(success).toBe(true)
  })

  it('exports screens', async () => {
    const { result } = renderHook(() => useScreens())

    await waitFor(() => {
      expect(result.current.screens).toEqual(mockScreens)
    })

    const exportData = await result.current.exportScreens()

    expect(trpcClient.screens.exportAll.query).toHaveBeenCalled()
    expect(exportData?.screens).toEqual(mockScreens)
  })

  it('imports screens', async () => {
    const { result } = renderHook(() => useScreens())

    await waitFor(() => {
      expect(result.current.screens).toEqual(mockScreens)
    })

    const importResult = await result.current.importScreens(mockScreens, 'update' as ConflictMode)

    expect(trpcClient.screens.importScreens.mutate).toHaveBeenCalledWith({
      screens: mockScreens,
      conflictMode: 'update',
    })
    expect(importResult).toEqual({
      created: 1,
      updated: 0,
      skipped: 0,
      errors: [],
    })
  })

  it('handles import error', async () => {
    vi.mocked(trpcClient.screens.importScreens.mutate).mockRejectedValue(new Error('Import failed'))

    const { result } = renderHook(() => useScreens())

    await waitFor(() => {
      expect(result.current.screens).toEqual(mockScreens)
    })

    const importResult = await result.current.importScreens(mockScreens, 'update' as ConflictMode)

    expect(importResult).toEqual({
      created: 0,
      updated: 0,
      skipped: 0,
      errors: ['Import failed'],
    })
  })

  it('returns false on update error', async () => {
    vi.mocked(trpcClient.screens.update.mutate).mockRejectedValue(new Error('Update failed'))

    const { result } = renderHook(() => useScreens())

    await waitFor(() => {
      expect(result.current.screens).toEqual(mockScreens)
    })

    const success = await result.current.updateScreen('screen-1', { name: 'Updated' })

    expect(success).toBe(false)
    expect(success).toBe(false)
    await waitFor(() => {
      expect(result.current.error).toBe('Update failed')
    })
  })

  it('returns false on delete error', async () => {
    vi.mocked(trpcClient.screens.delete.mutate).mockRejectedValue(new Error('Delete failed'))

    const { result } = renderHook(() => useScreens())

    await waitFor(() => {
      expect(result.current.screens).toEqual(mockScreens)
    })

    const success = await result.current.deleteScreen('screen-1')

    expect(success).toBe(false)
    expect(success).toBe(false)
    await waitFor(() => {
      expect(result.current.error).toBe('Delete failed')
    })
  })

  it('returns false on create error', async () => {
    vi.mocked(trpcClient.screens.create.mutate).mockRejectedValue(new Error('Create failed'))

    const { result } = renderHook(() => useScreens())

    await waitFor(() => {
      expect(result.current.screens).toEqual(mockScreens)
    })

    const success = await result.current.createScreen({
      displayId: 'display-1',
      x: 0,
      y: 0,
      width: 512,
      height: 512,
    })

    expect(success).toBe(false)
    expect(success).toBe(false)
    await waitFor(() => {
      expect(result.current.error).toBe('Create failed')
    })
  })

  it('returns null on export error', async () => {
    vi.mocked(trpcClient.screens.exportAll.query).mockRejectedValue(new Error('Export failed'))

    const { result } = renderHook(() => useScreens())

    await waitFor(() => {
      expect(result.current.screens).toEqual(mockScreens)
    })

    const exportData = await result.current.exportScreens()

    expect(exportData).toBeNull()
    expect(exportData).toBeNull()
    await waitFor(() => {
      expect(result.current.error).toBe('Export failed')
    })
  })

  it('loads screens manually', async () => {
    const { result } = renderHook(() => useScreens())

    await waitFor(() => {
      expect(result.current.screens).toEqual(mockScreens)
    })

    await result.current.loadScreens()

    expect(trpcClient.screens.list.query).toHaveBeenCalledTimes(2)
  })

  it('handles load error', async () => {
    vi.mocked(trpcClient.screens.list.query).mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useScreens())

    await waitFor(() => {
      expect(trpcClient.screens.list.query).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(result.current.error).toBe('Network error')
    })
  })
})
