import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useGeocode } from '../../hooks/useGeocode'

describe('useGeocode hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('geocodes an address successfully', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        response: {
          docs: [
            {
              centroide_ll: 'POINT(5.6910 50.8514)',
              weergavenaam: 'Test Address',
            },
          ],
        },
      }),
    } as Response)

    const { result } = renderHook(() => useGeocode())

    const geocodeResult = await result.current.geocode('2811GN 18')

    expect(geocodeResult).toEqual({
      lat: 50.8514,
      lng: 5.6910,
      address: 'Test Address',
    })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('returns null when address is empty', async () => {
    const { result } = renderHook(() => useGeocode())

    const geocodeResult = await result.current.geocode('')

    expect(geocodeResult).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('returns null when address not found', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        response: {
          docs: [],
        },
      }),
    } as Response)

    const { result } = renderHook(() => useGeocode())

    const geocodeResult = await result.current.geocode('Invalid Address')

    expect(geocodeResult).toBeNull()
    await waitFor(() => {
      expect(result.current.error).toBe('Adres niet gevonden')
    })
  })

  it('handles network errors', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useGeocode())

    const geocodeResult = await result.current.geocode('2811GN 18')

    expect(geocodeResult).toBeNull()
    await waitFor(() => {
      expect(result.current.error).toBe('Network error')
    })
    expect(result.current.isLoading).toBe(false)
  })

  it('handles invalid coordinate format', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        response: {
          docs: [
            {
              centroide_ll: 'INVALID_FORMAT',
              weergavenaam: 'Test Address',
            },
          ],
        },
      }),
    } as Response)

    const { result } = renderHook(() => useGeocode())

    const geocodeResult = await result.current.geocode('2811GN 18')

    expect(geocodeResult).toBeNull()
    await waitFor(() => {
      expect(result.current.error).toBe('Adres niet gevonden (geen coördinaten)')
    })
  })

  it('sets loading state during geocoding', async () => {
    let resolvePromise: (value: any) => void
    vi.mocked(global.fetch).mockImplementation(() => {
      return new Promise((resolve) => {
        resolvePromise = resolve
      })
    })

    const { result } = renderHook(() => useGeocode())

    const geocodePromise = result.current.geocode('2811GN 18')

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true)
    })

    resolvePromise!({
      ok: true,
      json: async () => ({
        response: {
          docs: [
            {
              centroide_ll: 'POINT(5.6910 50.8514)',
              weergavenaam: 'Test Address',
            },
          ],
        },
      }),
    } as Response)

    await geocodePromise

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('uses default display name when weergavenaem is missing', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        response: {
          docs: [
            {
              centroide_ll: 'POINT(5.6910 50.8514)',
            },
          ],
        },
      }),
    } as Response)

    const { result } = renderHook(() => useGeocode())

    const geocodeResult = await result.current.geocode('2811GN 18')

    expect(geocodeResult).toEqual({
      lat: 50.8514,
      lng: 5.6910,
      address: '2811GN 18',
    })
  })
})
