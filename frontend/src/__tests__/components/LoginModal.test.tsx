import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import LoginModal from '../../components/LoginModal'

// Mock tRPC
const mockLogin = vi.fn().mockResolvedValue({ success: true })
const mockLogout = vi.fn()
const mockGetToken = vi.fn()

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    login: mockLogin,
    isAuthenticated: false,
    authRequired: true,
    isLoading: false,
    logout: mockLogout,
    getToken: mockGetToken,
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function renderWithProviders(component: React.ReactElement) {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('LoginModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('renders login form correctly', () => {
      renderWithProviders(<LoginModal />)

      expect(screen.getByRole('heading', { name: 'Inloggen' })).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Voer wachtwoord in')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Inloggen' })).toBeInTheDocument()
    })

    it('disables button when password is empty', async () => {
      renderWithProviders(<LoginModal />)

      const button = screen.getByRole('button', { name: 'Inloggen' })
      expect(button).toBeDisabled()
    })

    it('enables button when password is entered', async () => {
      const user = userEvent.setup()
      renderWithProviders(<LoginModal />)

      const input = screen.getByPlaceholderText('Voer wachtwoord in')
      const button = screen.getByRole('button', { name: 'Inloggen' })

      await user.type(input, 'test123')

      await waitFor(() => {
        expect(button).not.toBeDisabled()
      })
    })

    it('shows error message on failed login', async () => {
      const user = userEvent.setup()
      mockLogin.mockResolvedValueOnce({ success: false, error: 'Invalid password' })

      renderWithProviders(<LoginModal />)

      const input = screen.getByPlaceholderText('Voer wachtwoord in')
      const button = screen.getByRole('button', { name: 'Inloggen' })

      await user.type(input, 'wrongpass')
      await user.click(button)

      await waitFor(() => {
        expect(screen.getByText('Invalid password')).toBeInTheDocument()
      })
    })
  })

  describe('form validation', () => {
    it('validates password input', async () => {
      const user = userEvent.setup()
      renderWithProviders(<LoginModal />)

      const input = screen.getByPlaceholderText('Voer wachtwoord in')
      const button = screen.getByRole('button', { name: 'Inloggen' })

      expect(button).toBeDisabled()

      await user.type(input, 'test')

      await waitFor(() => {
        expect(button).not.toBeDisabled()
      })
    })
  })
})
