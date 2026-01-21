// Test setup helpers for Vitest
import { vi } from 'vitest'

export const TEST_API_URL = 'http://localhost:8080/trpc'

// Mock storage for auth token
let mockAuthToken: string | null = null

export const getMockAuthToken = () => mockAuthToken
export const setMockAuthToken = (token: string | null) => {
  mockAuthToken = token
}

// Mock localStorage for tests
export const mockLocalStorage = () => {
  const localStorageMock = {
    getItem: vi.fn((key: string) => {
      if (key === 'led_controller_auth_token') {
        return mockAuthToken
      }
      return null
    }),
    setItem: vi.fn((key: string, value: string) => {
      if (key === 'led_controller_auth_token') {
        mockAuthToken = value
      }
    }),
    removeItem: vi.fn((key: string) => {
      if (key === 'led_controller_auth_token') {
        mockAuthToken = null
      }
    }),
    clear: vi.fn(() => {
      mockAuthToken = null
    }),
  }
  
  // Replace global localStorage
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
  })
}

export const restoreLocalStorage = () => {
  Object.defineProperty(window, 'localStorage', {
    value: globalThis.localStorage,
    writable: true,
    configurable: true,
  })
}
