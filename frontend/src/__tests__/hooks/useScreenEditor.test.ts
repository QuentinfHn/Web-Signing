import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useScreenEditor } from '../../hooks/useScreenEditor'
import { Screen } from '../../utils/trpc'

describe('useScreenEditor hook', () => {
  it('initializes with default values', () => {
    const { result } = renderHook(() => useScreenEditor())

    expect(result.current.editingId).toBeNull()
    expect(result.current.formData).toEqual({})
    expect(result.current.isCreating).toBe(false)
    expect(result.current.newScreenData).toEqual({
      displayId: '',
      x: 0,
      y: 0,
      width: 512,
      height: 512,
      name: '',
      lat: 0,
      lng: 0,
      address: '',
      postcode: '',
      huisnummer: '',
    })
    expect(result.current.editPostcode).toBe('')
    expect(result.current.editHuisnummer).toBe('')
    expect(result.current.newScreenLocationMode).toBe('address')
    expect(result.current.editLocationMode).toBe('address')
  })

  it('initializes with default displayId', () => {
    const { result } = renderHook(() => useScreenEditor('display-123'))

    expect(result.current.newScreenData.displayId).toBe('display-123')
  })

  it('starts editing a screen', () => {
    const { result } = renderHook(() => useScreenEditor())
    const mockScreen: Screen = {
      id: 'screen-1',
      displayId: 'display-1',
      x: 100,
      y: 100,
      width: 512,
      height: 512,
      name: 'Test Screen',
      lat: 50.8514,
      lng: 5.6910,
      address: 'Test Address',
      vnnoxPlayerId: null,
      vnnoxPlayerName: null,
      vnnoxOnlineStatus: null,
      vnnoxLastSeen: null,
    }

    act(() => {
      result.current.startEdit(mockScreen)
    })

    expect(result.current.editingId).toBe('screen-1')
    expect(result.current.formData).toEqual(mockScreen)
    expect(result.current.editPostcode).toBe('')
    expect(result.current.editHuisnummer).toBe('')
    expect(result.current.isCreating).toBe(false)
  })

  it('cancels editing', () => {
    const { result } = renderHook(() => useScreenEditor())

    act(() => {
      result.current.setEditingId('screen-1')
      result.current.setFormData({ id: 'screen-1' } as Partial<Screen>)
      result.current.cancelEdit()
    })

    expect(result.current.editingId).toBeNull()
    expect(result.current.formData).toEqual({})
  })

  it('starts creating a screen', () => {
    const { result } = renderHook(() => useScreenEditor())

    act(() => {
      result.current.startCreate('display-123')
    })

    expect(result.current.isCreating).toBe(true)
    expect(result.current.newScreenData.displayId).toBe('display-123')
    expect(result.current.editingId).toBeNull()
  })

  it('cancels creating', () => {
    const { result } = renderHook(() => useScreenEditor())

    act(() => {
      result.current.setIsCreating(true)
      result.current.cancelCreate()
    })

    expect(result.current.isCreating).toBe(false)
    expect(result.current.newScreenData.displayId).toBe('')
  })

  it('updates new screen data', () => {
    const { result } = renderHook(() => useScreenEditor())

    act(() => {
      result.current.updateNewScreenData('name', 'Test Name')
      result.current.updateNewScreenData('x', 100)
      result.current.updateNewScreenData('y', 200)
    })

    expect(result.current.newScreenData.name).toBe('Test Name')
    expect(result.current.newScreenData.x).toBe(100)
    expect(result.current.newScreenData.y).toBe(200)
  })

  it('updates form data', () => {
    const { result } = renderHook(() => useScreenEditor())

    act(() => {
      result.current.updateFormData('name', 'Updated Name')
      result.current.updateFormData('x', 150)
      result.current.updateFormData('lat', 51.0)
    })

    expect(result.current.formData.name).toBe('Updated Name')
    expect(result.current.formData.x).toBe(150)
    expect(result.current.formData.lat).toBe(51.0)
  })

  it('resets new screen data', () => {
    const { result } = renderHook(() => useScreenEditor())

    act(() => {
      result.current.updateNewScreenData('name', 'Test')
      result.current.updateNewScreenData('x', 100)
      result.current.resetNewScreenData('display-456')
    })

    expect(result.current.newScreenData).toEqual({
      displayId: 'display-456',
      x: 0,
      y: 0,
      width: 512,
      height: 512,
      name: '',
      lat: 0,
      lng: 0,
      address: '',
      postcode: '',
      huisnummer: '',
    })
  })

  it('sets edit postcode and huisnummer', () => {
    const { result } = renderHook(() => useScreenEditor())

    act(() => {
      result.current.setEditPostcode('2811GN')
      result.current.setEditHuisnummer('18')
    })

    expect(result.current.editPostcode).toBe('2811GN')
    expect(result.current.editHuisnummer).toBe('18')
  })

  it('sets location modes', () => {
    const { result } = renderHook(() => useScreenEditor())

    act(() => {
      result.current.setNewScreenLocationMode('coordinates')
      result.current.setEditLocationMode('coordinates')
    })

    expect(result.current.newScreenLocationMode).toBe('coordinates')
    expect(result.current.editLocationMode).toBe('coordinates')
  })

  it('can toggle between creating and editing', () => {
    const { result } = renderHook(() => useScreenEditor())
    const mockScreen: Screen = {
      id: 'screen-1',
      displayId: 'display-1',
      x: 100,
      y: 100,
      width: 512,
      height: 512,
      name: 'Test Screen',
      lat: 50.8514,
      lng: 5.6910,
      address: 'Test Address',
      vnnoxPlayerId: null,
      vnnoxPlayerName: null,
      vnnoxOnlineStatus: null,
      vnnoxLastSeen: null,
    }

    act(() => {
      result.current.startEdit(mockScreen)
    })

    expect(result.current.editingId).toBe('screen-1')
    expect(result.current.isCreating).toBe(false)

    act(() => {
      result.current.startCreate('display-123')
    })

    expect(result.current.isCreating).toBe(true)
    expect(result.current.editingId).toBeNull()
  })
})
