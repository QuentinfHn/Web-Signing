import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'

const mockPrisma = vi.hoisted(() => ({
  display: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  screen: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  scenario: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  preset: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  scenarioAssignment: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  screenState: {
    upsert: vi.fn(),
  },
  $transaction: vi.fn(),
}))

// Mock both extensionless and .js paths because runtime imports use .js specifiers.
vi.mock('../../prisma/client.js', () => ({
  prisma: mockPrisma,
}))
vi.mock('../../prisma/client', () => ({
  prisma: mockPrisma,
}))
vi.mock('../../services/screenState.js', () => ({
  broadcastState: vi.fn(),
}))
vi.mock('../../services/screenState', () => ({
  broadcastState: vi.fn(),
}))
vi.mock('../../services/cache.js', () => ({
  invalidateStateCache: vi.fn(),
}))
vi.mock('../../services/cache', () => ({
  invalidateStateCache: vi.fn(),
}))
vi.mock('../../auth/auth.js', () => ({
  verifyToken: vi.fn(() => ({ authenticated: true })),
  verifyPassword: vi.fn(() => true),
  isAuthEnabled: vi.fn(() => false),
  generateToken: vi.fn(() => 'mock-token'),
}))
vi.mock('../../auth/auth', () => ({
  verifyToken: vi.fn(() => ({ authenticated: true })),
  verifyPassword: vi.fn(() => true),
  isAuthEnabled: vi.fn(() => false),
  generateToken: vi.fn(() => 'mock-token'),
}))
vi.mock('../../middleware/rateLimit.js', () => ({
  companionRateLimiter: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}))
vi.mock('../../middleware/rateLimit', () => ({
  companionRateLimiter: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}))
vi.mock('../../services/vnnox.js', () => ({
  isVnnoxEnabled: vi.fn(() => false),
}))
vi.mock('../../services/vnnox', () => ({
  isVnnoxEnabled: vi.fn(() => false),
}))
vi.mock('../../utils/logger.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))
vi.mock('../../utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import companionRouter from '../../routers/companion'
import { broadcastState } from '../../services/screenState'

describe('companion router', () => {
  let app: express.Application

  beforeEach(() => {
    process.env.ADMIN_PASSWORD = 'test-password'
    app = express()
    app.use(express.json())
    app.use((req, _res, next) => {
      req.headers['x-api-key'] = 'test-password'
      next()
    })
    app.use('/companion', companionRouter)
    vi.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.ADMIN_PASSWORD
    vi.resetAllMocks()
  })

  describe('GET /companion/displays', () => {
    it('returns list of displays', async () => {
      const mockDisplays = [
        { id: '1', name: 'Display 1', location: 'Room A', _count: { screens: 3 } },
        { id: '2', name: 'Display 2', location: 'Room B', _count: { screens: 2 } },
      ]

      vi.mocked(mockPrisma.display.findMany).mockResolvedValue(mockDisplays as unknown)

      const response = await request(app).get('/companion/displays')

      expect(response.status).toBe(200)
      expect(response.body).toEqual(mockDisplays)
      expect(mockPrisma.display.findMany).toHaveBeenCalledWith({
        orderBy: { id: 'asc' },
        include: { _count: { select: { screens: true } } },
      })
    })

    it('returns empty array when no displays exist', async () => {
      vi.mocked(mockPrisma.display.findMany).mockResolvedValue([])

      const response = await request(app).get('/companion/displays')

      expect(response.status).toBe(200)
      expect(response.body).toEqual([])
    })

    it('handles database errors', async () => {
      vi.mocked(mockPrisma.display.findMany).mockRejectedValue(new Error('Database error'))

      const response = await request(app).get('/companion/displays')

      expect(response.status).toBe(500)
      expect(response.body).toEqual({ error: 'Failed to fetch displays' })
    })
  })

  describe('GET /companion/screens', () => {
    it('returns list of screens', async () => {
      const mockScreens = [
        { id: '1', name: 'Screen 1', displayId: 'display-1' },
        { id: '2', name: 'Screen 2', displayId: 'display-1' },
      ]

      vi.mocked(mockPrisma.screen.findMany).mockResolvedValue(mockScreens as unknown)

      const response = await request(app).get('/companion/screens')

      expect(response.status).toBe(200)
      expect(response.body).toEqual(mockScreens)
      expect(mockPrisma.screen.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, displayId: true },
      })
    })

    it('handles database errors', async () => {
      vi.mocked(mockPrisma.screen.findMany).mockRejectedValue(new Error('Database error'))

      const response = await request(app).get('/companion/screens')

      expect(response.status).toBe(500)
      expect(response.body).toEqual({ error: 'Failed to fetch screens' })
    })
  })

  describe('GET /companion/scenarios', () => {
    it('returns list of scenarios with assignment info', async () => {
      const mockScenarios = [
        { id: '1', name: 'Scenario 1', displayOrder: 1 },
        { id: '2', name: 'Scenario 2', displayOrder: 2 },
      ]
      const mockAssignments = [
        { screenId: 'screen-1', scenario: 'Scenario 1' },
        { screenId: 'screen-2', scenario: 'Scenario 1' },
      ]

      vi.mocked(mockPrisma.scenario.findMany).mockResolvedValue(mockScenarios as unknown)
      vi.mocked(mockPrisma.scenarioAssignment.findMany).mockResolvedValue(mockAssignments as unknown)

      const response = await request(app).get('/companion/scenarios')

      expect(response.status).toBe(200)
      expect(response.body).toEqual([
        { id: '1', name: 'Scenario 1', hasAssignments: true, assignedScreenIds: ['screen-1', 'screen-2'] },
        { id: '2', name: 'Scenario 2', hasAssignments: false, assignedScreenIds: [] },
      ])
    })

    it('filters to configured only when ?configured=true', async () => {
      const mockScenarios = [
        { id: '1', name: 'Scenario 1', displayOrder: 1 },
        { id: '2', name: 'Scenario 2', displayOrder: 2 },
      ]
      const mockAssignments = [
        { screenId: 'screen-1', scenario: 'Scenario 1' },
      ]

      vi.mocked(mockPrisma.scenario.findMany).mockResolvedValue(mockScenarios as unknown)
      vi.mocked(mockPrisma.scenarioAssignment.findMany).mockResolvedValue(mockAssignments as unknown)

      const response = await request(app).get('/companion/scenarios?configured=true')

      expect(response.status).toBe(200)
      expect(response.body).toEqual([
        { id: '1', name: 'Scenario 1', hasAssignments: true, assignedScreenIds: ['screen-1'] },
      ])
    })

    it('handles database errors', async () => {
      vi.mocked(mockPrisma.scenario.findMany).mockRejectedValue(new Error('Database error'))

      const response = await request(app).get('/companion/scenarios')

      expect(response.status).toBe(500)
      expect(response.body).toEqual({ error: 'Failed to fetch scenarios' })
    })
  })

  describe('GET /companion/presets', () => {
    it('returns list of presets with parsed scenarios', async () => {
      const mockPresets = [
        { id: '1', name: 'Preset 1', scenarios: '{"screen-1":"scenario-1","screen-2":"scenario-2"}', createdAt: new Date() },
        { id: '2', name: 'Preset 2', scenarios: '{}', createdAt: new Date() },
      ]

      vi.mocked(mockPrisma.preset.findMany).mockResolvedValue(mockPresets as unknown)

      const response = await request(app).get('/companion/presets')

      expect(response.status).toBe(200)
      expect(response.body[0]).toEqual({
        id: '1',
        name: 'Preset 1',
        scenarios: { 'screen-1': 'scenario-1', 'screen-2': 'scenario-2' },
      })
      expect(response.body[1]).toEqual({
        id: '2',
        name: 'Preset 2',
        scenarios: {},
      })
    })

    it('handles invalid JSON in scenarios', async () => {
      const mockPresets = [
        { id: '1', name: 'Preset 1', scenarios: 'invalid json', createdAt: new Date() },
      ]

      vi.mocked(mockPrisma.preset.findMany).mockResolvedValue(mockPresets as unknown)

      const response = await request(app).get('/companion/presets')

      expect(response.status).toBe(500)
      expect(response.body).toEqual({ error: 'Failed to fetch presets' })
    })

    it('handles database errors', async () => {
      vi.mocked(mockPrisma.preset.findMany).mockRejectedValue(new Error('Database error'))

      const response = await request(app).get('/companion/presets')

      expect(response.status).toBe(500)
      expect(response.body).toEqual({ error: 'Failed to fetch presets' })
    })
  })

  describe('POST /companion/presets', () => {
    it('creates a new preset', async () => {
      const newPreset = { id: '1', name: 'Test Preset', scenarios: {} }

      vi.mocked(mockPrisma.preset.create).mockResolvedValue({
        ...newPreset,
        scenarios: '{}',
        createdAt: new Date(),
      } as unknown)

      const response = await request(app)
        .post('/companion/presets')
        .send({ name: 'Test Preset', scenarios: {} })

      expect(response.status).toBe(201)
      expect(response.body).toEqual(newPreset)
      expect(mockPrisma.preset.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Preset',
          scenarios: JSON.stringify({}),
        },
      })
    })

    it('trims whitespace from name', async () => {
      vi.mocked(mockPrisma.preset.create).mockResolvedValue({
        id: '1',
        name: 'Preset',
        scenarios: '{}',
        createdAt: new Date(),
      } as unknown)

      await request(app)
        .post('/companion/presets')
        .send({ name: '  Test Preset  ', scenarios: {} })

      expect(mockPrisma.preset.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Preset',
          scenarios: JSON.stringify({}),
        },
      })
    })

    it('returns 400 when name is missing', async () => {
      const response = await request(app).post('/companion/presets').send({ scenarios: {} })

      expect(response.status).toBe(400)
      expect(response.body).toEqual({ error: 'name is required' })
    })

    it('returns 400 when name is empty string', async () => {
      const response = await request(app)
        .post('/companion/presets')
        .send({ name: '   ', scenarios: {} })

      expect(response.status).toBe(400)
      expect(response.body).toEqual({ error: 'name is required' })
    })

    it('returns 400 when scenarios is missing', async () => {
      const response = await request(app).post('/companion/presets').send({ name: 'Test' })

      expect(response.status).toBe(400)
      expect(response.body).toEqual({ error: 'scenarios object is required' })
    })

    it('returns 400 when scenarios is null', async () => {
      const response = await request(app)
        .post('/companion/presets')
        .send({ name: 'Test', scenarios: null })

      expect(response.status).toBe(400)
      expect(response.body).toEqual({ error: 'scenarios object is required' })
    })

    it('returns 400 when scenario references invalid screenId', async () => {
      vi.mocked(mockPrisma.screen.findMany).mockResolvedValue([])

      const response = await request(app)
        .post('/companion/presets')
        .send({ name: 'Test', scenarios: { 'nonexistent-screen': 'scenario-1' } })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Invalid screen IDs')
      expect(response.body.error).toContain('nonexistent-screen')
    })

    it('returns 400 when scenario references invalid scenarioName', async () => {
      vi.mocked(mockPrisma.screen.findMany).mockResolvedValue([{ id: 'screen-1' }] as unknown)
      vi.mocked(mockPrisma.scenario.findMany).mockResolvedValue([])

      const response = await request(app)
        .post('/companion/presets')
        .send({ name: 'Test', scenarios: { 'screen-1': 'nonexistent-scenario' } })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Invalid scenario names')
      expect(response.body.error).toContain('nonexistent-scenario')
    })

    it('allows empty scenarios object', async () => {
      vi.mocked(mockPrisma.preset.create).mockResolvedValue({
        id: '1',
        name: 'Test',
        scenarios: '{}',
        createdAt: new Date(),
      } as unknown)

      const response = await request(app)
        .post('/companion/presets')
        .send({ name: 'Test', scenarios: {} })

      expect(response.status).toBe(201)
    })

    it('handles database errors', async () => {
      vi.mocked(mockPrisma.preset.create).mockRejectedValue(new Error('Database error'))

      const response = await request(app)
        .post('/companion/presets')
        .send({ name: 'Test', scenarios: {} })

      expect(response.status).toBe(500)
      expect(response.body).toEqual({ error: 'Failed to create preset' })
    })
  })

  describe('PUT /companion/presets/:id', () => {
    it('updates an existing preset', async () => {
      const existingPreset = { id: '1', name: 'Old Name', scenarios: '{}' }
      const updatedPreset = { id: '1', name: 'New Name', scenarios: {} }

      vi.mocked(mockPrisma.preset.findUnique).mockResolvedValue(existingPreset as unknown)
      vi.mocked(mockPrisma.preset.update).mockResolvedValue({
        ...updatedPreset,
        scenarios: '{}',
        createdAt: new Date(),
      } as unknown)

      const response = await request(app)
        .put('/companion/presets/1')
        .send({ name: 'New Name', scenarios: {} })

      expect(response.status).toBe(200)
      expect(response.body).toEqual(updatedPreset)
    })

    it('returns 404 when preset not found', async () => {
      vi.mocked(mockPrisma.preset.findUnique).mockResolvedValue(null)

      const response = await request(app)
        .put('/companion/presets/999')
        .send({ name: 'New Name', scenarios: {} })

      expect(response.status).toBe(404)
      expect(response.body).toEqual({ error: 'Preset not found' })
    })

    it('updates only name when scenarios not provided', async () => {
      const existingPreset = { id: '1', name: 'Old Name', scenarios: '{}' }

      vi.mocked(mockPrisma.preset.findUnique).mockResolvedValue(existingPreset as unknown)
      vi.mocked(mockPrisma.preset.update).mockResolvedValue({
        ...existingPreset,
        name: 'New Name',
        createdAt: new Date(),
      } as unknown)

      await request(app).put('/companion/presets/1').send({ name: 'New Name' })

      expect(mockPrisma.preset.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { name: 'New Name' },
      })
    })

    it('updates only scenarios when name not provided', async () => {
      const existingPreset = { id: '1', name: 'Test', scenarios: '{}' }

      vi.mocked(mockPrisma.preset.findUnique).mockResolvedValue(existingPreset as unknown)
      vi.mocked(mockPrisma.screen.findMany).mockResolvedValue([{ id: 'screen-1' }] as unknown)
      vi.mocked(mockPrisma.scenario.findMany).mockResolvedValue([{ name: 'scenario-1' }] as unknown)
      vi.mocked(mockPrisma.preset.update).mockResolvedValue(existingPreset as unknown)

      await request(app)
        .put('/companion/presets/1')
        .send({ scenarios: { 'screen-1': 'scenario-1' } })

      expect(mockPrisma.preset.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { scenarios: JSON.stringify({ 'screen-1': 'scenario-1' }) },
      })
    })

    it('returns 400 when name is empty string', async () => {
      vi.mocked(mockPrisma.preset.findUnique).mockResolvedValue({ id: '1', name: 'Test', scenarios: '{}' } as unknown)

      const response = await request(app)
        .put('/companion/presets/1')
        .send({ name: '   ', scenarios: {} })

      expect(response.status).toBe(400)
      expect(response.body).toEqual({ error: 'name must be a non-empty string' })
    })

    it('returns 400 when scenarios is not an object', async () => {
      vi.mocked(mockPrisma.preset.findUnique).mockResolvedValue({ id: '1', name: 'Test', scenarios: '{}' } as unknown)

      const response = await request(app)
        .put('/companion/presets/1')
        .send({ name: 'Test', scenarios: 'invalid' })

      expect(response.status).toBe(400)
      expect(response.body).toEqual({ error: 'scenarios must be an object' })
    })

    it('handles database errors', async () => {
      vi.mocked(mockPrisma.preset.findUnique).mockRejectedValue(new Error('Database error'))

      const response = await request(app)
        .put('/companion/presets/1')
        .send({ name: 'New Name', scenarios: {} })

      expect(response.status).toBe(500)
      expect(response.body).toEqual({ error: 'Failed to update preset' })
    })
  })

  describe('DELETE /companion/presets/:id', () => {
    it('deletes an existing preset', async () => {
      vi.mocked(mockPrisma.preset.findUnique).mockResolvedValue({ id: '1', name: 'Test', scenarios: '{}' } as unknown)
      vi.mocked(mockPrisma.preset.delete).mockResolvedValue({ id: '1', name: 'Test', scenarios: '{}' } as unknown)

      const response = await request(app).delete('/companion/presets/1')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ success: true })
      expect(mockPrisma.preset.delete).toHaveBeenCalledWith({ where: { id: '1' } })
    })

    it('returns 404 when preset not found', async () => {
      vi.mocked(mockPrisma.preset.findUnique).mockResolvedValue(null)

      const response = await request(app).delete('/companion/presets/999')

      expect(response.status).toBe(404)
      expect(response.body).toEqual({ error: 'Preset not found' })
    })

    it('handles database errors', async () => {
      vi.mocked(mockPrisma.preset.findUnique).mockRejectedValue(new Error('Database error'))

      const response = await request(app).delete('/companion/presets/1')

      expect(response.status).toBe(500)
      expect(response.body).toEqual({ error: 'Failed to delete preset' })
    })
  })

  describe('POST /companion/screens/:id/content', () => {
    it('updates screen content', async () => {
      vi.mocked(mockPrisma.screen.findUnique).mockResolvedValue({ id: 'screen-1', name: 'Screen 1', displayId: 'display-1' } as unknown)
      vi.mocked(mockPrisma.screenState.upsert).mockResolvedValue({} as unknown)
      vi.mocked(broadcastState).mockResolvedValue(undefined)

      const response = await request(app)
        .post('/companion/screens/screen-1/content')
        .send({ imageSrc: '/images/test.png' })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ success: true })
      expect(mockPrisma.screenState.upsert).toHaveBeenCalledWith({
        where: { screenId: 'screen-1' },
        update: { imageSrc: '/images/test.png', scenario: null },
        create: { screenId: 'screen-1', imageSrc: '/images/test.png', scenario: null },
      })
      expect(broadcastState).toHaveBeenCalled()
    })

    it('returns 400 when imageSrc is missing', async () => {
      const response = await request(app).post('/companion/screens/screen-1/content').send({})

      expect(response.status).toBe(400)
      expect(response.body).toEqual({ error: 'imageSrc is required' })
    })

    it('returns 400 when imageSrc is not a string', async () => {
      const response = await request(app)
        .post('/companion/screens/screen-1/content')
        .send({ imageSrc: 123 })

      expect(response.status).toBe(400)
      expect(response.body).toEqual({ error: 'imageSrc is required' })
    })

    it('returns 404 when screen not found', async () => {
      vi.mocked(mockPrisma.screen.findUnique).mockResolvedValue(null)

      const response = await request(app)
        .post('/companion/screens/screen-1/content')
        .send({ imageSrc: '/images/test.png' })

      expect(response.status).toBe(404)
      expect(response.body).toEqual({ error: 'Screen not found' })
    })

    it('handles database errors', async () => {
      vi.mocked(mockPrisma.screen.findUnique).mockRejectedValue(new Error('Database error'))

      const response = await request(app)
        .post('/companion/screens/screen-1/content')
        .send({ imageSrc: '/images/test.png' })

      expect(response.status).toBe(500)
      expect(response.body).toEqual({ error: 'Failed to set screen content' })
    })
  })

  describe('POST /companion/screens/:id/off', () => {
    it('turns off a screen', async () => {
      vi.mocked(mockPrisma.screen.findUnique).mockResolvedValue({ id: 'screen-1', name: 'Screen 1', displayId: 'display-1' } as unknown)
      vi.mocked(mockPrisma.screenState.upsert).mockResolvedValue({} as unknown)
      vi.mocked(broadcastState).mockResolvedValue(undefined)

      const response = await request(app).post('/companion/screens/screen-1/off').send({})

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ success: true })
      expect(mockPrisma.screenState.upsert).toHaveBeenCalledWith({
        where: { screenId: 'screen-1' },
        update: { imageSrc: null, scenario: null },
        create: { screenId: 'screen-1', imageSrc: null, scenario: null },
      })
      expect(broadcastState).toHaveBeenCalled()
    })

    it('returns 404 when screen not found', async () => {
      vi.mocked(mockPrisma.screen.findUnique).mockResolvedValue(null)

      const response = await request(app).post('/companion/screens/screen-1/off').send({})

      expect(response.status).toBe(404)
      expect(response.body).toEqual({ error: 'Screen not found' })
    })

    it('handles database errors', async () => {
      vi.mocked(mockPrisma.screen.findUnique).mockRejectedValue(new Error('Database error'))

      const response = await request(app).post('/companion/screens/screen-1/off').send({})

      expect(response.status).toBe(500)
      expect(response.body).toEqual({ error: 'Failed to turn off screen' })
    })
  })

  describe('POST /companion/scenarios/trigger', () => {
    it('triggers a scenario for a screen', async () => {
      vi.mocked(mockPrisma.scenarioAssignment.findUnique).mockResolvedValue({
        id: '1',
        screenId: 'screen-1',
        scenario: 'scenario-1',
        imagePath: '/images/triggered.png',
      } as unknown)
      vi.mocked(mockPrisma.screenState.upsert).mockResolvedValue({} as unknown)
      vi.mocked(broadcastState).mockResolvedValue(undefined)

      const response = await request(app)
        .post('/companion/scenarios/trigger')
        .send({ screenId: 'screen-1', scenarioName: 'scenario-1' })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ success: true })
      expect(mockPrisma.screenState.upsert).toHaveBeenCalledWith({
        where: { screenId: 'screen-1' },
        update: { imageSrc: '/images/triggered.png', scenario: 'scenario-1' },
        create: { screenId: 'screen-1', imageSrc: '/images/triggered.png', scenario: 'scenario-1' },
      })
      expect(broadcastState).toHaveBeenCalled()
    })

    it('returns 400 when screenId is missing', async () => {
      const response = await request(app)
        .post('/companion/scenarios/trigger')
        .send({ scenarioName: 'scenario-1' })

      expect(response.status).toBe(400)
      expect(response.body).toEqual({ error: 'screenId and scenarioName are required' })
    })

    it('returns 400 when scenarioName is missing', async () => {
      const response = await request(app)
        .post('/companion/scenarios/trigger')
        .send({ screenId: 'screen-1' })

      expect(response.status).toBe(400)
      expect(response.body).toEqual({ error: 'screenId and scenarioName are required' })
    })

    it('returns 400 when parameters are not strings', async () => {
      const response = await request(app)
        .post('/companion/scenarios/trigger')
        .send({ screenId: 123, scenarioName: 456 })

      expect(response.status).toBe(400)
      expect(response.body).toEqual({ error: 'screenId and scenarioName are required' })
    })

    it('returns 404 when scenario assignment not found', async () => {
      vi.mocked(mockPrisma.scenarioAssignment.findUnique).mockResolvedValue(null)

      const response = await request(app)
        .post('/companion/scenarios/trigger')
        .send({ screenId: 'screen-1', scenarioName: 'scenario-1' })

      expect(response.status).toBe(404)
      expect(response.body).toEqual({ error: 'Scenario assignment not found for this screen' })
    })

    it('handles database errors', async () => {
      vi.mocked(mockPrisma.scenarioAssignment.findUnique).mockRejectedValue(new Error('Database error'))

      const response = await request(app)
        .post('/companion/scenarios/trigger')
        .send({ screenId: 'screen-1', scenarioName: 'scenario-1' })

      expect(response.status).toBe(500)
      expect(response.body).toEqual({ error: 'Failed to trigger scenario' })
    })
  })

  describe('POST /companion/presets/trigger', () => {
    it('triggers a preset for multiple screens', async () => {
      const preset = { id: 'preset-1', name: 'Test Preset', scenarios: JSON.stringify({ 'screen-1': 'scenario-1', 'screen-2': 'scenario-2' }) }

      vi.mocked(mockPrisma.preset.findUnique).mockResolvedValue(preset as unknown)
      vi.mocked(mockPrisma.scenarioAssignment.findUnique)
        .mockResolvedValueOnce({
          id: '1',
          screenId: 'screen-1',
          scenario: 'scenario-1',
          imagePath: '/images/s1.png',
        } as unknown)
        .mockResolvedValueOnce({
          id: '2',
          screenId: 'screen-2',
          scenario: 'scenario-2',
          imagePath: '/images/s2.png',
        } as unknown)
      vi.mocked(mockPrisma.screenState.upsert).mockResolvedValue({} as unknown)
      vi.mocked(mockPrisma.$transaction).mockImplementation((fns: Promise<unknown>[]) => Promise.all(fns))
      vi.mocked(broadcastState).mockResolvedValue(undefined)

      const response = await request(app)
        .post('/companion/presets/trigger')
        .send({ presetId: 'preset-1' })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ success: true, activated: 2, skipped: 0 })
      expect(mockPrisma.$transaction).toHaveBeenCalled()
      expect(broadcastState).toHaveBeenCalled()
    })

    it('returns 400 when presetId is missing', async () => {
      const response = await request(app).post('/companion/presets/trigger').send({})

      expect(response.status).toBe(400)
      expect(response.body).toEqual({ error: 'presetId is required' })
    })

    it('returns 400 when presetId is not a string', async () => {
      const response = await request(app).post('/companion/presets/trigger').send({ presetId: 123 })

      expect(response.status).toBe(400)
      expect(response.body).toEqual({ error: 'presetId is required' })
    })

    it('returns 404 when preset not found', async () => {
      vi.mocked(mockPrisma.preset.findUnique).mockResolvedValue(null)

      const response = await request(app)
        .post('/companion/presets/trigger')
        .send({ presetId: 'preset-1' })

      expect(response.status).toBe(404)
      expect(response.body).toEqual({ error: 'Preset not found' })
    })

    it('returns 500 when preset scenarios JSON is invalid', async () => {
      vi.mocked(mockPrisma.preset.findUnique).mockResolvedValue({
        id: 'preset-1',
        name: 'Test',
        scenarios: 'invalid json',
      } as unknown)

      const response = await request(app)
        .post('/companion/presets/trigger')
        .send({ presetId: 'preset-1' })

      expect(response.status).toBe(500)
      expect(response.body).toEqual({ error: 'Invalid preset data' })
    })

    it('handles missing scenario assignments gracefully', async () => {
      const preset = { id: 'preset-1', name: 'Test Preset', scenarios: JSON.stringify({ 'screen-1': 'scenario-1', 'screen-2': 'scenario-2' }) }

      vi.mocked(mockPrisma.preset.findUnique).mockResolvedValue(preset as unknown)
      vi.mocked(mockPrisma.scenarioAssignment.findUnique).mockResolvedValueOnce({
        id: '1',
        screenId: 'screen-1',
        scenario: 'scenario-1',
        imagePath: '/images/s1.png',
      } as unknown).mockResolvedValueOnce(null)
      vi.mocked(mockPrisma.screenState.upsert).mockResolvedValue({} as unknown)
      vi.mocked(mockPrisma.$transaction).mockImplementation((fns: Promise<unknown>[]) => Promise.all(fns))
      vi.mocked(broadcastState).mockResolvedValue(undefined)

      const response = await request(app)
        .post('/companion/presets/trigger')
        .send({ presetId: 'preset-1' })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ success: true, activated: 1, skipped: 1 })
    })

    it('uses $transaction for atomic upserts', async () => {
      const preset = { id: 'preset-1', name: 'Test Preset', scenarios: JSON.stringify({ 'screen-1': 'scenario-1' }) }

      vi.mocked(mockPrisma.preset.findUnique).mockResolvedValue(preset as unknown)
      vi.mocked(mockPrisma.scenarioAssignment.findUnique).mockResolvedValue({
        id: '1',
        screenId: 'screen-1',
        scenario: 'scenario-1',
        imagePath: '/images/s1.png',
      } as unknown)
      vi.mocked(mockPrisma.screenState.upsert).mockResolvedValue({} as unknown)
      vi.mocked(mockPrisma.$transaction).mockImplementation((fns: Promise<unknown>[]) => Promise.all(fns))
      vi.mocked(broadcastState).mockResolvedValue(undefined)

      await request(app)
        .post('/companion/presets/trigger')
        .send({ presetId: 'preset-1' })

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
      const [txCalls] = vi.mocked(mockPrisma.$transaction).mock.calls[0]
      expect(Array.isArray(txCalls)).toBe(true)
      expect(txCalls.length).toBeGreaterThan(0)
    })

    it('handles database errors', async () => {
      vi.mocked(mockPrisma.preset.findUnique).mockRejectedValue(new Error('Database error'))

      const response = await request(app)
        .post('/companion/presets/trigger')
        .send({ presetId: 'preset-1' })

      expect(response.status).toBe(500)
      expect(response.body).toEqual({ error: 'Failed to trigger preset' })
    })
  })
})
