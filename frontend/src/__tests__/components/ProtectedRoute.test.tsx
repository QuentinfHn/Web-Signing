import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import ProtectedRoute from '../../components/ProtectedRoute'
import LoginModal from '../../components/LoginModal'
import { AuthProvider, useAuth } from '../../context/AuthContext'

vi.mock('../../context/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../context/AuthContext')>()
  return {
    ...actual,
    useAuth: vi.fn(),
  }
})

function renderWithProviders(component: React.ReactElement) {
  return render(
    <BrowserRouter>
      <AuthProvider>{component}</AuthProvider>
    </BrowserRouter>
  )
}

describe('ProtectedRoute', () => {
  const testChildren = <div>Protected Content</div>

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('loading state', () => {
    it('shows loading state when isLoading is true', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        authRequired: true,
        isLoading: true,
        login: vi.fn(),
        logout: vi.fn(),
      })

      renderWithProviders(<ProtectedRoute>{testChildren}</ProtectedRoute>)

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('renders loading spinner', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        authRequired: true,
        isLoading: true,
        login: vi.fn(),
        logout: vi.fn(),
      })

      renderWithProviders(<ProtectedRoute>{testChildren}</ProtectedRoute>)

      const loadingContainer = document.querySelector('.auth-loading')
      expect(loadingContainer).toBeInTheDocument()
    })
  })

  describe('no auth required', () => {
    it('renders children when auth is not required', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        authRequired: false,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
      })

      renderWithProviders(<ProtectedRoute>{testChildren}</ProtectedRoute>)

      expect(screen.getByText('Protected Content')).toBeInTheDocument()
    })

    it('does not show login modal when auth is not required', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        authRequired: false,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
      })

      renderWithProviders(<ProtectedRoute>{testChildren}</ProtectedRoute>)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('bypasses authentication check when authRequired is false', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        authRequired: false,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
      })

      renderWithProviders(<ProtectedRoute>{testChildren}</ProtectedRoute>)

      expect(screen.getByText('Protected Content')).toBeInTheDocument()
    })
  })

  describe('authenticated user', () => {
    it('renders children when user is authenticated', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        authRequired: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
      })

      renderWithProviders(<ProtectedRoute>{testChildren}</ProtectedRoute>)

      expect(screen.getByText('Protected Content')).toBeInTheDocument()
    })

    it('does not show login modal when user is authenticated', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        authRequired: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
      })

      renderWithProviders(<ProtectedRoute>{testChildren}</ProtectedRoute>)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('allows access to protected content', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        authRequired: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
      })

      renderWithProviders(
        <ProtectedRoute>
          <button>Admin Button</button>
        </ProtectedRoute>
      )

      expect(screen.getByRole('button', { name: 'Admin Button' })).toBeInTheDocument()
    })
  })

  describe('unauthenticated user', () => {
    it('shows login modal when user is not authenticated', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        authRequired: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
      })

      renderWithProviders(<ProtectedRoute>{testChildren}</ProtectedRoute>)

      expect(screen.getByRole('heading', { name: 'Inloggen' })).toBeInTheDocument()
    })

    it('does not render protected content when user is not authenticated', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        authRequired: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
      })

      renderWithProviders(<ProtectedRoute>{testChildren}</ProtectedRoute>)

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })

    it('renders LoginModal component', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        authRequired: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
      })

      renderWithProviders(<ProtectedRoute>{testChildren}</ProtectedRoute>)

      expect(screen.getByRole('heading', { name: 'Inloggen' })).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Voer wachtwoord in')).toBeInTheDocument()
    })
  })

  describe('multiple children', () => {
    it('renders all children when authenticated', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        authRequired: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
      })

      renderWithProviders(
        <ProtectedRoute>
          <div>Child 1</div>
          <div>Child 2</div>
          <div>Child 3</div>
        </ProtectedRoute>
      )

      expect(screen.getByText('Child 1')).toBeInTheDocument()
      expect(screen.getByText('Child 2')).toBeInTheDocument()
      expect(screen.getByText('Child 3')).toBeInTheDocument()
    })

    it('protects all children when unauthenticated', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        authRequired: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
      })

      renderWithProviders(
        <ProtectedRoute>
          <div>Child 1</div>
          <div>Child 2</div>
          <div>Child 3</div>
        </ProtectedRoute>
      )

      expect(screen.queryByText('Child 1')).not.toBeInTheDocument()
      expect(screen.queryByText('Child 2')).not.toBeInTheDocument()
      expect(screen.queryByText('Child 3')).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('handles empty children', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        authRequired: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
      })

      renderWithProviders(<ProtectedRoute>{null}</ProtectedRoute>)

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })

    it('handles complex children structures', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        authRequired: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
      })

      renderWithProviders(
        <ProtectedRoute>
          <div>
            <span>Nested</span>
            <button>Action</button>
          </div>
        </ProtectedRoute>
      )

      expect(screen.getByText('Nested')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
    })

    it('prioritizes loading over auth status', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        authRequired: true,
        isLoading: true,
        login: vi.fn(),
        logout: vi.fn(),
      })

      renderWithProviders(<ProtectedRoute>{testChildren}</ProtectedRoute>)

      const loadingContainer = document.querySelector('.auth-loading')
      expect(loadingContainer).toBeInTheDocument()
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })
  })
})
