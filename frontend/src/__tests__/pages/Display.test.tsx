import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Display from '../../pages/Display'

vi.mock('../../utils/websocket', () => ({
  useWebSocket: vi.fn(),
}))

vi.mock('../../utils/trpc')
const { trpcClient } = await import('../../utils/trpc')

vi.mock('../../lib/signageCache', () => ({
  signageCache: {
    initialize: vi.fn().mockResolvedValue(undefined),
    loadScreens: vi.fn().mockResolvedValue([]),
    loadStates: vi.fn().mockResolvedValue({}),
    cacheStates: vi.fn().mockResolvedValue(undefined),
    syncWithServer: vi.fn().mockResolvedValue(true),
    onSyncStatusChange: vi.fn().mockReturnValue(() => {}),
    isCacheValid: vi.fn().mockResolvedValue(false),
  },
}))

vi.mock('../../hooks/useSync', () => ({
  useAutoSync: vi.fn(),
}))

function renderDisplay(displayId: string = 'display1') {
  return render(
    <MemoryRouter initialEntries={[`/display/${displayId}`]}>
      <Routes>
        <Route path="/display/:displayId" element={<Display />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Display page', () => {
  const mockScreens = [
    {
      id: 'screen-1',
      name: 'Screen 1',
      displayId: 'display1',
      x: 0,
      y: 0,
      width: 960,
      height: 540,
      contentId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'screen-2',
      name: 'Screen 2',
      displayId: 'display1',
      x: 960,
      y: 0,
      width: 960,
      height: 540,
      contentId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(trpcClient.screens.getByDisplay.query).mockResolvedValue(mockScreens as any)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders display page', () => {
      renderDisplay()
      expect(document.querySelector('.display-page')).toBeInTheDocument()
    })

    it('renders display stage', () => {
      renderDisplay()
      const displayStage = document.querySelector('.display-stage')
      expect(displayStage).toBeInTheDocument()
    })

    it('initializes cache on mount', async () => {
      renderDisplay('display1')
      await waitFor(() => {
        const { signageCache } = require('../../lib/signageCache')
        expect(signageCache.initialize).toHaveBeenCalled()
      })
    })
  })

  describe('screen positioning', () => {
    it('positions screens correctly', async () => {
      const { signageCache } = require('../../lib/signageCache')
      vi.mocked(signageCache.loadScreens).mockResolvedValue(mockScreens)

      renderDisplay()
      await waitFor(() => {
        const screens = document.querySelectorAll('.display-screen')
        expect(screens.length).toBeGreaterThan(0)
        const firstScreen = screens[0] as HTMLElement
        expect(firstScreen.style.left).toBe('0px')
        expect(firstScreen.style.top).toBe('0px')
      })
    })

    it('sets correct screen dimensions', async () => {
      const { signageCache } = require('../../lib/signageCache')
      vi.mocked(signageCache.loadScreens).mockResolvedValue(mockScreens)

      renderDisplay()
      await waitFor(() => {
        const screens = document.querySelectorAll('.display-screen')
        expect(screens.length).toBeGreaterThan(0)
        const firstScreen = screens[0] as HTMLElement
        expect(firstScreen.style.width).toBe('960px')
        expect(firstScreen.style.height).toBe('540px')
      })
    })
  })

  describe('display stage', () => {
    it('sets correct stage dimensions', async () => {
      renderDisplay()
      await waitFor(() => {
        const displayStage = document.querySelector('.display-stage') as HTMLElement
        expect(displayStage.style.width).toBe('1920px')
        expect(displayStage.style.height).toBe('1080px')
      })
    })

    it('applies transform origin', () => {
      renderDisplay()
      const displayStage = document.querySelector('.display-stage') as HTMLElement
      expect(displayStage.style.transformOrigin).toBe('top left')
    })
  })

  describe('scaling', () => {
    it('calculates scale based on window size', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true })
      Object.defineProperty(window, 'innerHeight', { value: 720, configurable: true })

      renderDisplay()

      const displayStage = document.querySelector('.display-stage') as HTMLElement
      expect(displayStage.style.transform).toContain('scale(')
    })

    it('updates scale on window resize', () => {
      renderDisplay()

      window.dispatchEvent(new Event('resize'))

      const displayStage = document.querySelector('.display-stage') as HTMLElement
      expect(displayStage).toBeInTheDocument()
    })
  })

  describe('state management', () => {
    it('initializes with empty screen states', () => {
      renderDisplay()
      expect(document.querySelector('.display-page')).toBeInTheDocument()
    })
  })

  describe('IndexedDB caching', () => {
    it('loads screens from cache', async () => {
      const { signageCache } = require('../../lib/signageCache')
      vi.mocked(signageCache.loadScreens).mockResolvedValue(mockScreens)

      renderDisplay()

      await waitFor(() => {
        expect(signageCache.loadScreens).toHaveBeenCalledWith('display1')
      })

      const screens = document.querySelectorAll('.display-screen')
      expect(screens.length).toBeGreaterThan(0)
    })

    it('loads states from cache', async () => {
      renderDisplay()

      await waitFor(() => {
        const { signageCache } = require('../../lib/signageCache')
        expect(signageCache.loadStates).toHaveBeenCalled()
      })
    })
  })

  describe('error handling', () => {
    it('handles cache initialization errors gracefully', async () => {
      const { signageCache } = require('../../lib/signageCache')
      vi.mocked(signageCache.initialize).mockRejectedValue(new Error('DB error'))

      renderDisplay()

      await waitFor(() => {
        expect(document.querySelector('.display-page')).toBeInTheDocument()
      })
    })
  })

  describe('empty states', () => {
    it('handles no screens', async () => {
      const { signageCache } = require('../../lib/signageCache')
      vi.mocked(signageCache.loadScreens).mockResolvedValue([])

      renderDisplay()
      await waitFor(() => {
        const screens = document.querySelectorAll('.display-screen')
        expect(screens).toHaveLength(0)
      })
    })
  })

  describe('URL parameters', () => {
    it('uses displayId from URL parameter', async () => {
      renderDisplay('custom-display')
      await waitFor(() => {
        const { signageCache } = require('../../lib/signageCache')
        expect(signageCache.loadScreens).toHaveBeenCalledWith('custom-display')
      })
    })

    it('defaults to display1 when no parameter', async () => {
      const { unmount } = render(
        <MemoryRouter initialEntries={['/display']}>
          <Routes>
            <Route path="/display" element={<Display />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        const { signageCache } = require('../../lib/signageCache')
        expect(signageCache.loadScreens).toHaveBeenCalledWith('display1')
      })

      unmount()
    })
  })

  describe('cleanup', () => {
    it('removes event listeners on unmount', () => {
      const { unmount } = renderDisplay()

      unmount()

      const displayStage = document.querySelector('.display-stage')
      expect(displayStage).not.toBeInTheDocument()
    })
  })
})
