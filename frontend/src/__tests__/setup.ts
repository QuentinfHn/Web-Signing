import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock tRPC client globally
vi.mock('../utils/trpc', () => ({
  trpcClient: {
    displays: {
      list: { query: vi.fn() },
      create: { mutate: vi.fn() },
      delete: { mutate: vi.fn() },
      initFromScreens: { mutate: vi.fn() },
    },
    screens: {
      list: { query: vi.fn() },
      getByDisplay: { query: vi.fn() },
      create: { mutate: vi.fn() },
      update: { mutate: vi.fn() },
      delete: { mutate: vi.fn() },
    },
    content: {
      getCategories: { query: vi.fn() },
      list: { query: vi.fn() },
      delete: { mutate: vi.fn() },
      rename: { mutate: vi.fn() },
    },
    presets: {
      list: { query: vi.fn() },
      create: { mutate: vi.fn() },
      update: { mutate: vi.fn() },
      delete: { mutate: vi.fn() },
    },
    scenarios: {
      names: { query: vi.fn() },
      content: { query: vi.fn() },
      create: { mutate: vi.fn() },
      update: { mutate: vi.fn() },
      delete: { mutate: vi.fn() },
    },
    auth: {
      verify: { query: vi.fn() },
      login: { mutate: vi.fn() },
    },
  },
  getAuthHeaders: vi.fn(() => ({})),
}))
