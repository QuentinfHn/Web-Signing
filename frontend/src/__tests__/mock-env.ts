import { vi } from 'vitest'

// Mock environment variables for frontend tests
export function mockApiEnv() {
  vi.stubEnv('VITE_API_URL', 'http://localhost:8080')
}

export function restoreApiEnv() {
  vi.unstubAllEnvs()
}
