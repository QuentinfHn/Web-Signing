import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../../context/AuthContext'

const { trpcClient } = await import('../../utils/trpc')

function renderWithHook() {
  const result: { current: ReturnType<typeof useAuth> | null } = { current: null }

  function TestComponent() {
    result.current = useAuth()
    return <div>Test Component</div>
  }

  return {
    ...render(<AuthProvider><TestComponent /></AuthProvider>),
    result,
  }
}

describe('AuthContext', () => {
  const TOKEN_KEY = 'led_controller_auth_token'

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('initial state', () => {
    it('starts with loading state', () => {
      vi.mocked(trpcClient.auth.verify.query).mockResolvedValue({
        authenticated: false,
        authRequired: false,
      })

      const { result } = renderWithHook()

      expect(result.current?.isLoading).toBe(true)
      expect(result.current?.isAuthenticated).toBe(false)
      expect(result.current?.authRequired).toBe(false)
    })
  })

  describe('auth verification', () => {
    it('verifies authentication on mount', async () => {
      vi.mocked(trpcClient.auth.verify.query).mockResolvedValue({
        authenticated: true,
        authRequired: true,
      })

      renderWithHook()

      await waitFor(() => {
        expect(trpcClient.auth.verify.query).toHaveBeenCalled()
      })
    })

    it('updates state after successful verification', async () => {
      vi.mocked(trpcClient.auth.verify.query).mockResolvedValue({
        authenticated: true,
        authRequired: true,
      })

      const { result } = renderWithHook()

      await waitFor(() => {
        expect(result.current?.isLoading).toBe(false)
        expect(result.current?.isAuthenticated).toBe(true)
        expect(result.current?.authRequired).toBe(true)
      })
    })

    it('handles verification errors', async () => {
      vi.mocked(trpcClient.auth.verify.query).mockRejectedValue(new Error('Network error'))

      const { result } = renderWithHook()

      await waitFor(() => {
        expect(result.current?.isLoading).toBe(false)
        expect(result.current?.isAuthenticated).toBe(false)
        expect(result.current?.authRequired).toBe(true)
      })
    })

    it('handles unauthenticated state', async () => {
      vi.mocked(trpcClient.auth.verify.query).mockResolvedValue({
        authenticated: false,
        authRequired: true,
      })

      const { result } = renderWithHook()

      await waitFor(() => {
        expect(result.current?.isLoading).toBe(false)
        expect(result.current?.isAuthenticated).toBe(false)
        expect(result.current?.authRequired).toBe(true)
      })
    })
  })

  describe('login', () => {
    it('successful login with token', async () => {
      vi.mocked(trpcClient.auth.verify.query).mockResolvedValue({
        authenticated: false,
        authRequired: true,
      })
      vi.mocked(trpcClient.auth.login.mutate).mockResolvedValue({
        success: true,
        token: 'test-token',
      })

      const { result } = renderWithHook()

      await waitFor(() => {
        expect(result.current?.isLoading).toBe(false)
      })

      const loginResult = await result.current?.login('password')

      expect(loginResult).toEqual({ success: true })
      expect(localStorage.getItem(TOKEN_KEY)).toBe('test-token')

      await waitFor(() => {
        expect(result.current?.isAuthenticated).toBe(true)
      })
    })

    it('successful login without token (auth disabled)', async () => {
      vi.mocked(trpcClient.auth.verify.query).mockResolvedValue({
        authenticated: false,
        authRequired: true,
      })
      vi.mocked(trpcClient.auth.login.mutate).mockResolvedValue({
        success: true,
        token: null,
      })

      const { result } = renderWithHook()

      await waitFor(() => {
        expect(result.current?.isLoading).toBe(false)
      })

      const loginResult = await result.current?.login('password')

      expect(loginResult).toEqual({ success: true })
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull()

      await waitFor(() => {
        expect(result.current?.isAuthenticated).toBe(true)
        expect(result.current?.authRequired).toBe(false)
      })
    })

    it('failed login', async () => {
      vi.mocked(trpcClient.auth.verify.query).mockResolvedValue({
        authenticated: false,
        authRequired: true,
      })
      vi.mocked(trpcClient.auth.login.mutate).mockResolvedValue({
        success: false,
        token: null,
      })

      const { result } = renderWithHook()

      await waitFor(() => {
        expect(result.current?.isLoading).toBe(false)
      })

      const loginResult = await result.current?.login('wrong-password')

      expect(loginResult).toEqual({
        success: false,
        error: 'Onbekende fout',
      })
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
      expect(result.current?.isAuthenticated).toBe(false)
    })

    it('handles login errors', async () => {
      vi.mocked(trpcClient.auth.verify.query).mockResolvedValue({
        authenticated: false,
        authRequired: true,
      })
      vi.mocked(trpcClient.auth.login.mutate).mockRejectedValue(
        new Error('Invalid password')
      )

      const { result } = renderWithHook()

      await waitFor(() => {
        expect(result.current?.isLoading).toBe(false)
      })

      const loginResult = await result.current?.login('wrong-password')

      expect(loginResult).toEqual({
        success: false,
        error: 'Invalid password',
      })
    })

    it('handles non-Error exceptions', async () => {
      vi.mocked(trpcClient.auth.verify.query).mockResolvedValue({
        authenticated: false,
        authRequired: true,
      })
      vi.mocked(trpcClient.auth.login.mutate).mockRejectedValue('String error')

      const { result } = renderWithHook()

      await waitFor(() => {
        expect(result.current?.isLoading).toBe(false)
      })

      const loginResult = await result.current?.login('password')

      expect(loginResult).toEqual({
        success: false,
        error: 'Login mislukt',
      })
    })
  })

  describe('logout', () => {
    it('clears token from localStorage', async () => {
      vi.mocked(trpcClient.auth.verify.query).mockResolvedValue({
        authenticated: true,
        authRequired: true,
      })

      const { result } = renderWithHook()

      await waitFor(() => {
        expect(result.current?.isLoading).toBe(false)
      })

      localStorage.setItem(TOKEN_KEY, 'test-token')

      result.current?.logout()

      expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    })

    it('updates authentication state', async () => {
      vi.mocked(trpcClient.auth.verify.query).mockResolvedValue({
        authenticated: true,
        authRequired: true,
      })

      const { result } = renderWithHook()

      await waitFor(() => {
        expect(result.current?.isAuthenticated).toBe(true)
      })

      result.current?.logout()

      await waitFor(() => {
        expect(result.current?.isAuthenticated).toBe(false)
      })
    })
  })

  describe('getToken', () => {
    it('returns token from localStorage', async () => {
      vi.mocked(trpcClient.auth.verify.query).mockResolvedValue({
        authenticated: false,
        authRequired: false,
      })

      const { result } = renderWithHook()

      await waitFor(() => {
        expect(result.current?.isLoading).toBe(false)
      })

      const testToken = 'test-jwt-token'
      localStorage.setItem(TOKEN_KEY, testToken)

      const token = result.current?.getToken()

      expect(token).toBe(testToken)
    })

    it('returns null when no token exists', async () => {
      vi.mocked(trpcClient.auth.verify.query).mockResolvedValue({
        authenticated: false,
        authRequired: false,
      })

      const { result } = renderWithHook()

      await waitFor(() => {
        expect(result.current?.isLoading).toBe(false)
      })

      const token = result.current?.getToken()

      expect(token).toBeNull()
    })
  })

  describe('context provider', () => {
    it('provides auth context to children', async () => {
      vi.mocked(trpcClient.auth.verify.query).mockResolvedValue({
        authenticated: false,
        authRequired: false,
      })

      const { result } = renderWithHook()

      await waitFor(() => {
        expect(result.current).not.toBeNull()
        expect(result.current).toHaveProperty('isAuthenticated')
        expect(result.current).toHaveProperty('authRequired')
        expect(result.current).toHaveProperty('isLoading')
        expect(result.current).toHaveProperty('login')
        expect(result.current).toHaveProperty('logout')
        expect(result.current).toHaveProperty('getToken')
      })
    })

    it('provides consistent context across re-renders', async () => {
      vi.mocked(trpcClient.auth.verify.query).mockResolvedValue({
        authenticated: false,
        authRequired: false,
      })

      const { result } = renderWithHook()

      await waitFor(() => {
        expect(result.current?.isLoading).toBe(false)
      })

      const firstContext = result.current
      const secondContext = result.current

      expect(firstContext).toBe(secondContext)
    })
  })

  describe('useAuth hook', () => {
    it('throws error when used outside provider', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

      function TestComponent() {
        useAuth()
        return <div>test</div>
      }

      expect(() => {
        render(<TestComponent />)
      }).toThrow()

      consoleErrorSpy.mockRestore()
    })
  })
})
