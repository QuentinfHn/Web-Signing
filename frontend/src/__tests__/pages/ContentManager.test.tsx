import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import ContentManager from '../../pages/ContentManager'

vi.mock('../../utils/trpc')
const { trpcClient } = await import('../../utils/trpc')

function renderContentManager() {
  return render(
    <BrowserRouter>
      <ContentManager />
    </BrowserRouter>
  )
}

describe('ContentManager page', () => {
  const mockContents = [
    {
      id: 'content-1',
      filename: 'image1.png',
      path: '/uploads/image1.png',
      mimeType: 'image/png',
      category: 'Algemeen',
      size: 1024,
      createdAt: new Date(),
    },
    {
      id: 'content-2',
      filename: 'video1.mp4',
      path: '/uploads/video1.mp4',
      mimeType: 'video/mp4',
      category: 'Algemeen',
      size: 2048,
      createdAt: new Date(),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(trpcClient.content.getCategories.query).mockResolvedValue(['Algemeen', 'Categorie 2'])
    vi.mocked(trpcClient.content.list.query).mockResolvedValue(mockContents)
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders content manager page', () => {
      renderContentManager()
      expect(screen.getByText('📁 Content Manager')).toBeInTheDocument()
    })

    it('fetches categories on mount', async () => {
      renderContentManager()
      await waitFor(() => {
        expect(trpcClient.content.getCategories.query).toHaveBeenCalled()
      })
    })

    it('fetches content on mount', async () => {
      renderContentManager()
      await waitFor(() => {
        expect(trpcClient.content.list.query).toHaveBeenCalled()
      })
    })

    it('shows back link', () => {
      renderContentManager()
      expect(screen.getByText('← Terug')).toBeInTheDocument()
    })
  })

  describe('category selector', () => {
    it('renders category dropdown', async () => {
      renderContentManager()
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument()
      })
    })

    it('shows all categories', async () => {
      renderContentManager()
      await waitFor(() => {
        expect(screen.getByText('Algemeen')).toBeInTheDocument()
        expect(screen.getByText('Categorie 2')).toBeInTheDocument()
      })
    })

    it('allows creating new category', async () => {
      renderContentManager()
      const input = screen.getByPlaceholderText('Nieuwe categorie...')
      fireEvent.change(input, { target: { value: 'Nieuwe Categorie' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(screen.getByText('Nieuwe Categorie')).toBeInTheDocument()
    })
  })

  describe('upload zone', () => {
    it('renders upload zone', () => {
      renderContentManager()
      expect(screen.getByText('📤 Sleep bestanden hierheen of')).toBeInTheDocument()
    })

    it('shows file upload button', () => {
      renderContentManager()
      expect(screen.getByText('Kies bestand')).toBeInTheDocument()
    })

    it('handles file selection', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      })

      renderContentManager()
      const fileInput = screen.getByLabelText('Kies bestand')

      const file = new File(['test'], 'test.png', { type: 'image/png' })
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      })

      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })
    })

    it('handles drag over', () => {
      renderContentManager()
      const uploadZone = screen.getByText('📤 Sleep bestanden hierheen of').closest('.upload-zone')
      expect(uploadZone).toBeInTheDocument()
    })

    it('handles drop', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      })

      renderContentManager()
      const uploadZone = screen.getByText('📤 Sleep bestanden hierheen of').closest('.upload-zone')

      if (uploadZone) {
        fireEvent.drop(uploadZone, {
          dataTransfer: {
            files: [new File(['test'], 'test.png', { type: 'image/png' })],
          },
        } as any)
      }

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })
    })
  })

  describe('content grid', () => {
    it('renders content cards', async () => {
      renderContentManager()
      await waitFor(() => {
        expect(screen.getByText('image1.png')).toBeInTheDocument()
        expect(screen.getByText('video1.mp4')).toBeInTheDocument()
      })
    })

    it('renders image content', async () => {
      renderContentManager()
      await waitFor(() => {
        const images = screen.getAllByAltText('image1.png')
        expect(images.length).toBeGreaterThan(0)
      })
    })

    it('renders video content', async () => {
      renderContentManager()
      await waitFor(() => {
        const videos = document.querySelectorAll('video')
        expect(videos.length).toBeGreaterThan(0)
      })
    })

    it('shows empty message when no content', async () => {
      vi.mocked(trpcClient.content.list.query).mockResolvedValue([])
      renderContentManager()
      await waitFor(() => {
        expect(screen.getByText('Geen content in deze categorie')).toBeInTheDocument()
      })
    })
  })

  describe('content actions', () => {
    it('shows rename button for content', async () => {
      renderContentManager()
      await waitFor(() => {
        const renameButtons = screen.getAllByTitle('Hernoemen')
        expect(renameButtons.length).toBeGreaterThan(0)
      })
    })

    it('shows delete button for content', async () => {
      renderContentManager()
      await waitFor(() => {
        const deleteButtons = screen.getAllByTitle('Verwijderen')
        expect(deleteButtons.length).toBeGreaterThan(0)
      })
    })

    it('opens rename modal', async () => {
      renderContentManager()
      await waitFor(() => {
        const renameButtons = screen.getAllByTitle('Hernoemen')
        if (renameButtons.length > 0) {
          fireEvent.click(renameButtons[0])
        }
      })
    })
  })

  describe('delete functionality', () => {
    it('deletes content with confirmation', async () => {
      vi.mocked(trpcClient.content.delete.mutate).mockResolvedValue({} as any)
      vi.spyOn(window, 'confirm').mockReturnValue(true)

      renderContentManager()
      await waitFor(() => {
        const deleteButtons = screen.getAllByTitle('Verwijderen')
        if (deleteButtons.length > 0) {
          fireEvent.click(deleteButtons[0])
        }
      })

      await waitFor(() => {
        expect(trpcClient.content.delete.mutate).toHaveBeenCalled()
      })
    })

    it('does not delete when cancelled', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)

      renderContentManager()
      await waitFor(() => {
        const deleteButtons = screen.getAllByTitle('Verwijderen')
        if (deleteButtons.length > 0) {
          fireEvent.click(deleteButtons[0])
        }
      })

      expect(trpcClient.content.delete.mutate).not.toHaveBeenCalled()
    })
  })

  describe('rename functionality', () => {
    it('submits new name in rename modal', async () => {
      vi.mocked(trpcClient.content.rename.mutate).mockResolvedValue({} as any)

      renderContentManager()
      await waitFor(() => {
        const renameButtons = screen.getAllByTitle('Hernoemen')
        if (renameButtons.length > 0) {
          fireEvent.click(renameButtons[0])
        }
      })

      const newName = screen.getByDisplayValue('image1')
      if (newName) {
        fireEvent.change(newName, { target: { value: 'renamed-image' } })
        const saveButton = screen.getByText('Hernoemen')
        fireEvent.click(saveButton)
      }

      await waitFor(() => {
        expect(trpcClient.content.rename.mutate).toHaveBeenCalled()
      })
    })

    it('closes rename modal on cancel', async () => {
      renderContentManager()
      await waitFor(() => {
        const renameButtons = screen.getAllByTitle('Hernoemen')
        if (renameButtons.length > 0) {
          fireEvent.click(renameButtons[0])
        }
      })

      const cancelButton = screen.getByText('Annuleren')
      fireEvent.click(cancelButton)

      expect(screen.queryByDisplayValue('image1')).not.toBeInTheDocument()
    })
  })

  describe('upload functionality', () => {
    it('handles upload success', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      })

      renderContentManager()
      const fileInput = screen.getByLabelText('Kies bestand')

      const file = new File(['test'], 'test.png', { type: 'image/png' })
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      })

      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })
    })

    it('handles upload failure', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        json: async () => ({}),
      })
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { })

      renderContentManager()
      const fileInput = screen.getByLabelText('Kies bestand')

      const file = new File(['test'], 'test.png', { type: 'image/png' })
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      })

      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Upload mislukt')
      })

      alertSpy.mockRestore()
    })

    it('shows uploading state', () => {
      renderContentManager()
      expect(screen.getByText('📤 Sleep bestanden hierheen of')).toBeInTheDocument()
    })
  })

  describe('category filtering', () => {
    it('filters content by category', async () => {
      renderContentManager()

      // Wait for initial load
      await waitFor(() => {
        expect(trpcClient.content.list.query).toHaveBeenCalled()
      })

      // Clear mocks to track only the category change call
      vi.clearAllMocks()
      vi.mocked(trpcClient.content.list.query).mockResolvedValue([])
      vi.mocked(trpcClient.content.getCategories.query).mockResolvedValue(['Algemeen', 'Categorie 2'])

      const select = screen.getByRole('combobox')
      fireEvent.change(select, { target: { value: 'Categorie 2' } })

      await waitFor(() => {
        expect(trpcClient.content.list.query).toHaveBeenCalledWith({ category: 'Categorie 2' })
      })
    })
  })

  describe('error handling', () => {
    it('handles load categories error', async () => {
      vi.mocked(trpcClient.content.getCategories.query).mockRejectedValue(new Error('Network error'))

      renderContentManager()
      await waitFor(() => {
        expect(trpcClient.content.getCategories.query).toHaveBeenCalled()
      })
    })

    it('handles load content error', async () => {
      vi.mocked(trpcClient.content.list.query).mockRejectedValue(new Error('Network error'))

      renderContentManager()
      await waitFor(() => {
        expect(trpcClient.content.list.query).toHaveBeenCalled()
      })
    })

    it('handles delete error', async () => {
      vi.mocked(trpcClient.content.delete.mutate).mockRejectedValue(new Error('Delete failed'))
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { })

      renderContentManager()
      await waitFor(() => {
        const deleteButtons = screen.getAllByTitle('Verwijderen')
        if (deleteButtons.length > 0) {
          fireEvent.click(deleteButtons[0])
        }
      })

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Verwijderen mislukt')
      })

      alertSpy.mockRestore()
    })

    it('handles rename error', async () => {
      vi.mocked(trpcClient.content.rename.mutate).mockRejectedValue(new Error('Rename failed'))
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { })

      renderContentManager()
      await waitFor(() => {
        expect(screen.getAllByTitle('Hernoemen').length).toBeGreaterThan(0)
      })

      const renameButtons = screen.getAllByTitle('Hernoemen')
      fireEvent.click(renameButtons[0])

      // Wait for modal to appear
      await waitFor(() => {
        expect(screen.getByDisplayValue('image1')).toBeInTheDocument()
      })

      const newName = screen.getByDisplayValue('image1')
      fireEvent.change(newName, { target: { value: 'renamed-image' } })

      // The button in the rename modal is 'Hernoemen', not 'Opslaan'
      const saveButton = screen.getAllByText('Hernoemen').find(el => el.tagName === 'BUTTON')
      if (saveButton) {
        fireEvent.click(saveButton)
      }

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalled()
      })

      alertSpy.mockRestore()
    })
  })
})
