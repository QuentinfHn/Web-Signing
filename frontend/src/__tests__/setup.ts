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
      update: { mutate: vi.fn() },
    },
    screens: {
      list: { query: vi.fn() },
      getByDisplay: { query: vi.fn() },
      create: { mutate: vi.fn() },
      update: { mutate: vi.fn() },
      delete: { mutate: vi.fn() },
      exportAll: { query: vi.fn() },
      importScreens: { mutate: vi.fn() },
    },
    content: {
      getCategories: { query: vi.fn() },
      list: { query: vi.fn() },
      delete: { mutate: vi.fn() },
      rename: { mutate: vi.fn() },
      scan: { mutate: vi.fn() },
      toggleFavorite: { mutate: vi.fn() },
    },
    presets: {
      list: { query: vi.fn() },
      create: { mutate: vi.fn() },
      update: { mutate: vi.fn() },
      delete: { mutate: vi.fn() },
      activate: { mutate: vi.fn() },
    },
    scenarios: {
      create: { mutate: vi.fn() },
      update: { mutate: vi.fn() },
      delete: { mutate: vi.fn() },
      getAll: { query: vi.fn() },
      setSlideshow: { mutate: vi.fn() },
    },
    scenarioNames: {
      list: { query: vi.fn() },
      seedDefaults: { mutate: vi.fn() },
      rename: { mutate: vi.fn() },
    },
    state: {
      getAll: { query: vi.fn() },
    },
    vnnox: {
      isEnabled: { query: vi.fn() },
      getStatuses: { query: vi.fn() },
      listPlayers: { query: vi.fn() },
      linkPlayer: { mutate: vi.fn() },
      unlinkPlayer: { mutate: vi.fn() },
    },
    auth: {
      verify: { query: vi.fn() },
      login: { mutate: vi.fn() },
    },
  },
  getAuthHeaders: vi.fn(() => ({})),
}))
