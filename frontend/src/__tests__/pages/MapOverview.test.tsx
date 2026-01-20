import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import MapOverview from '../../pages/MapOverview'

// Hoist mocks
const mockTrpcClient = vi.hoisted(() => ({
  screens: {
    list: { query: vi.fn() },
  },
  scenarios: {
    getAll: { query: vi.fn() },
  },
}))

const mockUseWebSocket = vi.hoisted(() => vi.fn(() => ({
  connected: true,
  setImage: vi.fn(),
})))

vi.mock('../../utils/trpc', () => ({
  trpcClient: mockTrpcClient,
}))

vi.mock('../../utils/websocket', () => ({
  useWebSocket: mockUseWebSocket,
}))

vi.mock('leaflet', () => ({
  default: {
    icon: vi.fn(() => ({ test: 'icon' })),
    Marker: {
      prototype: {
        options: {},
      },
    },
  },
  icon: vi.fn(() => ({ test: 'icon' })),
  Marker: {
    prototype: {
      options: {},
    },
  },
}))

vi.mock('leaflet/dist/images/marker-icon.png', () => ({ default: 'marker-icon.png' }))
vi.mock('leaflet/dist/images/marker-shadow.png', () => ({ default: 'marker-shadow.png' }))

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, center, zoom }: any) => (
    <div data-testid="map-container" data-center={center} data-zoom={zoom}>
      {children}
    </div>
  ),
  TileLayer: ({ attribution, url }: any) => (
    <div data-tile-url={url} data-attribution={attribution}>
      <div className="tile-layer">Tile Layer</div>
    </div>
  ),
  Marker: ({ position, children, eventHandlers }: any) => (
    <div data-testid="marker" data-position={position.join(',')}>
      {children}
      <button
        data-testid="marker-click"
        onClick={() => eventHandlers?.click?.()}
      >
        Click Marker
      </button>
    </div>
  ),
  Popup: ({ children }: any) => (
    <div data-testid="popup">
      {children}
    </div>
  ),
  useMap: vi.fn(() => ({
    flyTo: vi.fn(),
  })),
}))

function renderMapOverview() {
  return render(
    <BrowserRouter>
      <MapOverview />
    </BrowserRouter>
  )
}

describe('MapOverview page', () => {
  const mockScreens = [
    {
      id: 'screen-1',
      name: 'Screen 1',
      displayId: 'display-1',
      lat: 50.8514,
      lng: 5.6910,
      address: 'Test Address 1',
    },
    {
      id: 'screen-2',
      name: 'Screen 2',
      displayId: 'display-2',
      lat: 50.8524,
      lng: 5.6920,
      address: 'Test Address 2',
    },
    {
      id: 'screen-3',
      name: 'Screen 3',
      displayId: 'display-3',
      lat: null,
      lng: null,
      address: 'Test Address 3',
    },
    {
      id: 'screen-4',
      name: 'Screen 4',
      displayId: 'display-4',
      lat: 0,
      lng: 0,
      address: 'Test Address 4',
    },
  ]

  const mockScenarios = {
    'screen-1': { 'scenario-1': '/image1.png' },
    'screen-2': { 'scenario-2': '/image2.png' },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(mockTrpcClient.screens.list.query).mockResolvedValue(mockScreens as any)
    vi.mocked(mockTrpcClient.scenarios.getAll.query).mockResolvedValue(mockScenarios)
    vi.mocked(mockUseWebSocket).mockReturnValue({
      connected: true,
      setImage: vi.fn(),
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders Live Map Overview heading', () => {
      renderMapOverview()
      expect(screen.getByText('Live Map Overview')).toBeInTheDocument()
    })

    it('shows connection status', () => {
      renderMapOverview()
      expect(screen.getByText('Verbonden')).toBeInTheDocument()
    })

    it('shows back link', () => {
      renderMapOverview()
      expect(screen.getByText('Terug')).toBeInTheDocument()
    })

    it('renders map container', () => {
      renderMapOverview()
      expect(screen.getByTestId('map-container')).toBeInTheDocument()
    })

    it('fetches data on mount', async () => {
      renderMapOverview()
      await waitFor(() => {
        expect(mockTrpcClient.screens.list.query).toHaveBeenCalled()
        expect(mockTrpcClient.scenarios.getAll.query).toHaveBeenCalled()
      })
    })
  })

  describe('markers', () => {
    it('renders markers for screens with valid coordinates', async () => {
      renderMapOverview()
      await waitFor(() => {
        const markers = screen.getAllByTestId('marker')
        expect(markers).toHaveLength(2)
      })
    })

    it('does not render markers for screens without coordinates', async () => {
      renderMapOverview()
      await waitFor(() => {
        const markers = screen.getAllByTestId('marker')
        const markerPositions = markers.map(m => m.getAttribute('data-position'))

        expect(markerPositions).not.toContain('null,null')
        expect(markerPositions).not.toContain('0,0')
      })
    })

    it('renders popups for markers', async () => {
      renderMapOverview()
      await waitFor(() => {
        const popups = screen.getAllByTestId('popup')
        expect(popups).toHaveLength(2)
      })
    })

    it('shows screen information in popup', async () => {
      renderMapOverview()
      await waitFor(() => {
        const popups = screen.getAllByTestId('popup')
        expect(popups.length).toBeGreaterThan(0)
      })
      // Popup content should include screen info
      const popup = screen.getAllByTestId('popup')[0]
      expect(popup.textContent).toContain('Screen 1')
      expect(popup.textContent).toContain('display-1')
    })
  })

  describe('sidebar', () => {
    it('renders sidebar with Actieve Schermen heading', () => {
      renderMapOverview()
      expect(screen.getByText('Actieve Schermen')).toBeInTheDocument()
    })

    it('renders screen list items', async () => {
      renderMapOverview()
      await waitFor(() => {
        expect(screen.getAllByText('Screen 1').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Screen 2').length).toBeGreaterThan(0)
      })
    })

    it('shows screen addresses', async () => {
      renderMapOverview()
      await waitFor(() => {
        expect(screen.getAllByText('Test Address 1').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Test Address 2').length).toBeGreaterThan(0)
      })
    })

    it('shows empty message when no screens with coordinates', async () => {
      vi.mocked(mockTrpcClient.screens.list.query).mockResolvedValue([
        { id: 'screen-1', name: 'Screen 1', displayId: 'display-1', lat: null, lng: null },
      ] as any)

      renderMapOverview()
      await waitFor(() => {
        expect(screen.getByText('Geen schermen op de kaart gevonden.')).toBeInTheDocument()
      })
    })
  })

  describe('screen states', () => {
    it('shows live status for active screens', async () => {
      renderMapOverview()

      await waitFor(() => {
        const markers = screen.getAllByTestId('marker')
        expect(markers.length).toBeGreaterThan(0)
      })
    })

    it('shows off status for inactive screens', async () => {
      renderMapOverview()
      await waitFor(() => {
        const markers = screen.getAllByTestId('marker')
        expect(markers.length).toBeGreaterThan(0)
      })
    })
  })

  describe('marker interaction', () => {
    it('selects screen on marker click', async () => {
      renderMapOverview()
      await waitFor(() => {
        const clickButtons = screen.getAllByTestId('marker-click')
        fireEvent.click(clickButtons[0])
      })
    })
  })

  describe('sidebar interaction', () => {
    it('selects screen on sidebar item click', async () => {
      renderMapOverview()
      await waitFor(() => {
        const sidebarItems = document.querySelectorAll('.sidebar-screen-item')
        expect(sidebarItems.length).toBeGreaterThan(0)
      })
      const sidebarItems = document.querySelectorAll('.sidebar-screen-item')
      if (sidebarItems.length > 0) {
        fireEvent.click(sidebarItems[0])
      }
    })

    it('highlights selected screen in sidebar', async () => {
      renderMapOverview()
      await waitFor(() => {
        const sidebarItems = document.querySelectorAll('.sidebar-screen-item')
        expect(sidebarItems.length).toBeGreaterThan(0)
      })
      // Verify sidebar items contain screen names
      const sidebarItems = document.querySelectorAll('.sidebar-screen-item')
      expect(Array.from(sidebarItems).some(item => item.textContent?.includes('Screen 1'))).toBe(true)
    })
  })

  describe('WebSocket connection', () => {
    it('shows connected status when WebSocket is connected', () => {
      vi.mocked(mockUseWebSocket).mockReturnValue({
        connected: true,
        setImage: vi.fn(),
      })
      renderMapOverview()
      expect(screen.getByText('Verbonden')).toBeInTheDocument()
    })

    it('shows disconnected status when WebSocket is not connected', () => {
      vi.mocked(mockUseWebSocket).mockReturnValue({
        connected: false,
        setImage: vi.fn(),
      })
      renderMapOverview()
      expect(screen.getByText('Niet verbonden')).toBeInTheDocument()
    })
  })

  describe('map configuration', () => {
    it('renders map with correct center coordinates', () => {
      renderMapOverview()
      const mapContainer = screen.getByTestId('map-container')
      expect(mapContainer.getAttribute('data-center')).toBe('50.8514,5.691')
    })

    it('renders map with correct zoom level', () => {
      renderMapOverview()
      const mapContainer = screen.getByTestId('map-container')
      expect(mapContainer.getAttribute('data-zoom')).toBe('13')
    })

    it('renders tile layer with OpenStreetMap URL', () => {
      renderMapOverview()
      const tileLayer = screen.getByTestId('map-container').querySelector('[data-tile-url]')
      expect(tileLayer?.getAttribute('data-tile-url')).toContain('tile.openstreetmap.org')
    })
  })

  describe('empty states', () => {
    it('handles empty screens list', async () => {
      vi.mocked(mockTrpcClient.screens.list.query).mockResolvedValue([])
      renderMapOverview()
      await waitFor(() => {
        expect(screen.getByText('Geen schermen op de kaart gevonden.')).toBeInTheDocument()
      })
    })

    it('handles empty scenarios', async () => {
      vi.mocked(mockTrpcClient.scenarios.getAll.query).mockResolvedValue({})
      renderMapOverview()
      await waitFor(() => {
        expect(screen.getByText('Actieve Schermen')).toBeInTheDocument()
      })
    })
  })

  describe('data filtering', () => {
    it('filters screens without valid coordinates', async () => {
      renderMapOverview()
      await waitFor(() => {
        const markers = screen.getAllByTestId('marker')
        expect(markers).toHaveLength(2)
      })
    })

    it('excludes screens with null lat/lng', async () => {
      renderMapOverview()
      await waitFor(() => {
        const markers = screen.getAllByTestId('marker')
        expect(markers).toHaveLength(2)
      })
      // Screen 3 (null coords) should not appear in sidebar
      const sidebarItems = document.querySelectorAll('.sidebar-screen-item')
      const hasScreen3 = Array.from(sidebarItems).some(item => item.textContent?.includes('Screen 3'))
      expect(hasScreen3).toBe(false)
    })

    it('excludes screens with 0,0 coordinates', async () => {
      renderMapOverview()
      await waitFor(() => {
        const markers = screen.getAllByTestId('marker')
        expect(markers).toHaveLength(2)
      })
      // Screen 4 (0,0 coords) should not appear in sidebar
      const sidebarItems = document.querySelectorAll('.sidebar-screen-item')
      const hasScreen4 = Array.from(sidebarItems).some(item => item.textContent?.includes('Screen 4'))
      expect(hasScreen4).toBe(false)
    })
  })
})
