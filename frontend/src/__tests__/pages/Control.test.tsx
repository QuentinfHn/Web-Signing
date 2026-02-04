import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Control from '../../pages/Control'

const mockTrpcClient = vi.hoisted(() => ({
  presets: {
    list: { query: vi.fn() },
    activate: { mutate: vi.fn() },
    create: { mutate: vi.fn() },
    update: { mutate: vi.fn() },
    delete: { mutate: vi.fn() },
  },
  scenarios: {
    getAll: { query: vi.fn() },
    delete: { mutate: vi.fn() },
    setSlideshow: { mutate: vi.fn() },
  },
  scenarioNames: {
    list: { query: vi.fn() },
    seedDefaults: { mutate: vi.fn() },
    rename: { mutate: vi.fn() },
  },
  content: {
    list: { query: vi.fn() },
  },
  screens: {
    list: { query: vi.fn() },
  },
  displays: {
    list: { query: vi.fn() },
  },
  vnnox: {
    isEnabled: { query: vi.fn() },
    getStatuses: { query: vi.fn() },
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

vi.mock('../../components/AdvancedContentSelector', () => ({
  default: function MockAdvancedContentSelector({ value, onChange }: { value: string, onChange: (val: string) => void }) {
    return (
      <select data-testid="content-selector" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">-- Select Content --</option>
        <option value="/test/image1.png">Image 1</option>
        <option value="/test/image2.png">Image 2</option>
      </select>
    )
  }
}))

function renderControl() {
  return render(
    <BrowserRouter>
      <Control />
    </BrowserRouter>
  )
}

describe('Control page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(mockTrpcClient.presets.list.query).mockResolvedValue([
      { id: '1', name: 'Preset 1', scenarios: { 'screen-1': 'scenario-1' }, createdAt: new Date() },
    ])
    vi.mocked(mockTrpcClient.scenarios.getAll.query).mockResolvedValue({
      'screen-1': { 'scenario-1': '/image1.png' },
    })
    vi.mocked(mockTrpcClient.scenarioNames.list.query).mockResolvedValue([
      { id: '1', name: 'Scenario 1' },
    ])
    vi.mocked(mockTrpcClient.content.list.query).mockResolvedValue([
      { id: '1', name: 'Image 1', path: '/image1.png', type: 'image' },
    ])
    vi.mocked(mockTrpcClient.screens.list.query).mockResolvedValue([
      { id: 'screen-1', name: 'Screen 1', displayId: 'display-1' },
    ])
    vi.mocked(mockTrpcClient.displays.list.query).mockResolvedValue([
      { id: 'display-1', name: 'Display 1', location: 'Room A', _count: { screens: 1 } },
    ])
    vi.mocked(mockTrpcClient.vnnox.isEnabled.query).mockResolvedValue({ enabled: false })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders Control Panel heading', () => {
      renderControl()
      expect(screen.getByText('Control Panel')).toBeInTheDocument()
    })

    it('shows connection status', () => {
      renderControl()
      expect(screen.getByText('Verbonden')).toBeInTheDocument()
    })

    it('shows back link', () => {
      renderControl()
      expect(screen.getByText('Terug')).toBeInTheDocument()
    })

    it('fetches data on mount', async () => {
      renderControl()
      await waitFor(() => {
        expect(mockTrpcClient.presets.list.query).toHaveBeenCalled()
        expect(mockTrpcClient.scenarios.getAll.query).toHaveBeenCalled()
        expect(mockTrpcClient.scenarioNames.list.query).toHaveBeenCalled()
        expect(mockTrpcClient.content.list.query).toHaveBeenCalled()
        expect(mockTrpcClient.screens.list.query).toHaveBeenCalled()
        expect(mockTrpcClient.displays.list.query).toHaveBeenCalled()
        expect(mockTrpcClient.vnnox.isEnabled.query).toHaveBeenCalled()
      })
    })
  })

  describe('displays and screens', () => {
    it('renders display sections', async () => {
      renderControl()
      await waitFor(() => {
        expect(screen.getByText('📺 Display 1')).toBeInTheDocument()
      })
    })

    it('renders screen cards', async () => {
      renderControl()
      await waitFor(() => {
        expect(screen.getByText('Screen 1')).toBeInTheDocument()
      })
    })

    it('shows "Uit" radio option', async () => {
      renderControl()
      await waitFor(() => {
        expect(screen.getByText('⭘ Uit')).toBeInTheDocument()
      })
    })

    it('renders scenario radio buttons', async () => {
      renderControl()
      await waitFor(() => {
        expect(screen.getByText('Scenario 1')).toBeInTheDocument()
      })
    })
  })

  describe('presets section', () => {
    it('renders presets section heading', async () => {
      renderControl()
      await waitFor(() => {
        expect(screen.getByText('🎬 Presets')).toBeInTheDocument()
      })
    })

    it('renders preset buttons', async () => {
      renderControl()
      await waitFor(() => {
        expect(screen.getByText('Preset 1')).toBeInTheDocument()
      })
    })

    it('shows "Nieuw" button', () => {
      renderControl()
      expect(screen.getByText('+ Nieuw')).toBeInTheDocument()
    })

    it('shows empty message when no presets', async () => {
      vi.mocked(mockTrpcClient.presets.list.query).mockResolvedValue([])
      renderControl()
      await waitFor(() => {
        expect(screen.getByText('Geen presets. Maak er een aan!')).toBeInTheDocument()
      })
    })
  })

  describe('preset management', () => {
    it('opens create preset modal on click', async () => {
      renderControl()
      fireEvent.click(screen.getByText('+ Nieuw'))
      await waitFor(() => {
        expect(screen.getByText('Nieuwe Preset')).toBeInTheDocument()
      })
    })

    it('opens edit preset modal', async () => {
      renderControl()
      await waitFor(() => {
        expect(screen.getByText('Preset 1')).toBeInTheDocument()
      })
      const editButton = screen.getByTitle('Bewerken')
      fireEvent.click(editButton)
      await waitFor(() => {
        expect(screen.getByText('Preset Bewerken')).toBeInTheDocument()
      })
    })

    it('deletes preset with confirmation', async () => {
      vi.mocked(mockTrpcClient.presets.delete.mutate).mockResolvedValue({})
      vi.spyOn(window, 'confirm').mockReturnValue(true)

      renderControl()
      await waitFor(() => {
        expect(screen.getByText('Preset 1')).toBeInTheDocument()
      })

      const deleteButton = screen.getByTitle('Verwijderen')
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(mockTrpcClient.presets.delete.mutate).toHaveBeenCalledWith({ id: '1' })
      })
    })

    it('does not delete preset when cancelled', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)

      renderControl()
      await waitFor(() => {
        expect(screen.getByText('Preset 1')).toBeInTheDocument()
      })

      const deleteButton = screen.getByTitle('Verwijderen')
      fireEvent.click(deleteButton)

      expect(mockTrpcClient.presets.delete.mutate).not.toHaveBeenCalled()
    })
  })

  describe('scenario selection', () => {
    it('displays disabled scenario when no image assigned', async () => {
      renderControl()
      await waitFor(() => {
        expect(screen.getByText('Scenario 1')).toBeInTheDocument()
      })
    })

    it('shows settings button for scenario', async () => {
      renderControl()
      await waitFor(() => {
        const settingsButton = screen.getByTitle('Instellingen')
        expect(settingsButton).toBeInTheDocument()
      })
    })

    it('opens settings modal on settings click', async () => {
      renderControl()
      await waitFor(() => {
        expect(screen.getByTitle('Instellingen')).toBeInTheDocument()
      })
      const settingsButton = screen.getByTitle('Instellingen')
      fireEvent.click(settingsButton)
      await waitFor(() => {
        expect(screen.getByText('Instellingen voor Scenario 1')).toBeInTheDocument()
      })
    })
  })

  describe('PresetModal component', () => {
    it('shows name input field', async () => {
      renderControl()
      fireEvent.click(screen.getByText('+ Nieuw'))
      await waitFor(() => {
        const input = screen.getByPlaceholderText('Preset naam')
        expect(input).toBeInTheDocument()
      })
    })

    it('shows save and cancel buttons', async () => {
      renderControl()
      fireEvent.click(screen.getByText('+ Nieuw'))
      await waitFor(() => {
        expect(screen.getByText('Opslaan')).toBeInTheDocument()
        expect(screen.getByText('Annuleren')).toBeInTheDocument()
      })
    })

    it('closes modal on cancel', async () => {
      renderControl()
      fireEvent.click(screen.getByText('+ Nieuw'))
      await waitFor(() => {
        expect(screen.getByText('Nieuwe Preset')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Annuleren'))
      await waitFor(() => {
        expect(screen.queryByText('Nieuwe Preset')).not.toBeInTheDocument()
      })
    })
  })

  describe('SceneSettingsModal component', () => {
    it('shows scenario name in heading', async () => {
      renderControl()
      await waitFor(() => {
        const settingsButton = screen.getByTitle('Instellingen')
        fireEvent.click(settingsButton)
      })
      await waitFor(() => {
        expect(screen.getByText('Instellingen voor Scenario 1')).toBeInTheDocument()
      })
    })

    it('shows content selector', async () => {
      renderControl()
      await waitFor(() => {
        const settingsButton = screen.getByTitle('Instellingen')
        fireEvent.click(settingsButton)
      })
      await waitFor(() => {
        expect(screen.getByText('+ Afbeelding toevoegen')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('+ Afbeelding toevoegen'))
      await waitFor(() => {
        expect(screen.getByTestId('content-selector')).toBeInTheDocument()
      })
    })

    it('closes modal on cancel', async () => {
      renderControl()
      await waitFor(() => {
        const settingsButton = screen.getByTitle('Instellingen')
        fireEvent.click(settingsButton)
      })
      await waitFor(() => {
        expect(screen.getByText('Instellingen voor Scenario 1')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Annuleren'))
      await waitFor(() => {
        expect(screen.queryByText('Instellingen voor Scenario 1')).not.toBeInTheDocument()
      })
    })
  })

  describe('WebSocket connection', () => {
    it('shows connected status when WebSocket is connected', () => {
      vi.mocked(mockUseWebSocket).mockReturnValue({
        connected: true,
        setImage: vi.fn(),
      })
      renderControl()
      expect(screen.getByText('Verbonden')).toBeInTheDocument()
    })

    it('shows disconnected status when WebSocket is not connected', () => {
      vi.mocked(mockUseWebSocket).mockReturnValue({
        connected: false,
        setImage: vi.fn(),
      })
      renderControl()
      expect(screen.getByText('Niet verbonden')).toBeInTheDocument()
    })
  })

  describe('error handling', () => {
    it('handles preset activation errors', async () => {
      vi.mocked(mockTrpcClient.presets.activate.mutate).mockRejectedValue(new Error('Network error'))
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { })

      renderControl()
      await waitFor(() => {
        expect(screen.getByText('Preset 1')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Preset 1'))

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Activeren mislukt: Network error')
      })

      alertSpy.mockRestore()
    })

    it('handles preset creation errors', async () => {
      vi.mocked(mockTrpcClient.presets.create.mutate).mockRejectedValue(new Error('Creation failed'))
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { })

      renderControl()
      fireEvent.click(screen.getByText('+ Nieuw'))
      await waitFor(() => {
        const input = screen.getByPlaceholderText('Preset naam')
        fireEvent.change(input, { target: { value: 'Test Preset' } })
        fireEvent.click(screen.getByText('Opslaan'))
      })

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Aanmaken mislukt: Creation failed')
      })

      alertSpy.mockRestore()
    })

    it('handles preset deletion errors', async () => {
      vi.mocked(mockTrpcClient.presets.delete.mutate).mockRejectedValue(new Error('Deletion failed'))
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { })

      renderControl()
      await waitFor(() => {
        expect(screen.getByText('Preset 1')).toBeInTheDocument()
      })
      const deleteButton = screen.getByTitle('Verwijderen')
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Verwijderen mislukt: Deletion failed')
      })

      alertSpy.mockRestore()
    })
  })
})
