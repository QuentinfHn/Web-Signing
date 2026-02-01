import { vi } from 'vitest'

// Global mock for tRPC client - all methods are vi.fn() by default
export const trpcClient = {
    auth: {
        verify: { query: vi.fn() },
        login: { mutate: vi.fn() },
    },
    displays: {
        list: { query: vi.fn() },
        create: { mutate: vi.fn() },
        update: { mutate: vi.fn() },
        delete: { mutate: vi.fn() },
        initFromScreens: { mutate: vi.fn() },
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
        list: { query: vi.fn() },
        getCategories: { query: vi.fn() },
        delete: { mutate: vi.fn() },
        rename: { mutate: vi.fn() },
    },
    presets: {
        list: { query: vi.fn() },
        activate: { mutate: vi.fn() },
        create: { mutate: vi.fn() },
        update: { mutate: vi.fn() },
        delete: { mutate: vi.fn() },
    },
    scenarios: {
        getAll: { query: vi.fn() },
        set: { mutate: vi.fn() },
    },
    scenarioNames: {
        list: { query: vi.fn() },
        seedDefaults: { mutate: vi.fn() },
        rename: { mutate: vi.fn() },
    },
}

export const getAuthHeaders = vi.fn(() => ({}))
