import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WebSocketServer, WebSocket } from 'ws'

const mockPrisma = vi.hoisted(() => ({
  screenState: {
    findMany: vi.fn(),
  },
}))

vi.mock('ws')
vi.mock('../../prisma/client', () => ({
  prisma: mockPrisma,
}))

import { setWebSocketServer, broadcastState, type ScreenStateMap } from '../../services/screenState'

describe('screenState service', () => {
  let mockWss: WebSocketServer
  let mockClient: WebSocket

  beforeEach(() => {
    vi.clearAllMocks()

    mockWss = new WebSocketServer({ port: 0 })
    mockClient = new WebSocket('ws://localhost:0')

    mockWss.clients = new Set([mockClient])
    Object.defineProperty(mockClient, 'readyState', { value: WebSocket.OPEN, writable: true })

    setWebSocketServer(mockWss)
  })

  afterEach(() => {
    // Reset WebSocket server in case tests set it to null
    setWebSocketServer(mockWss)
    mockWss.close()
    mockClient.close()
  })

  describe('setWebSocketServer', () => {
    it('sets the WebSocket server instance', () => {
      const newWss = new WebSocketServer({ port: 0 })
      setWebSocketServer(newWss)

      broadcastState()

      newWss.close()
    })

    it('can be called multiple times', () => {
      const wss1 = new WebSocketServer({ port: 0 })
      const wss2 = new WebSocketServer({ port: 0 })

      setWebSocketServer(wss1)
      setWebSocketServer(wss2)

      broadcastState()

      wss1.close()
      wss2.close()
    })
  })

  describe('broadcastState', () => {
    beforeEach(() => {
      vi.mocked(mockPrisma.screenState.findMany).mockResolvedValue([])
      vi.spyOn(mockClient, 'send').mockImplementation(() => { })
    })

    it('broadcasts state when WebSocket server is initialized', async () => {
      await broadcastState()

      expect(mockClient.send).toHaveBeenCalled()
    })

    it('sends correct payload structure', async () => {
      vi.mocked(mockPrisma.screenState.findMany).mockResolvedValue([
        {
          id: '1',
          screenId: 'screen-1',
          imageSrc: '/images/test.png',
          scenario: 'scenario-1',
          updatedAt: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
        },
      ])

      await broadcastState()

      const sentData = vi.mocked(mockClient.send).mock.calls[0][0]
      const parsed = JSON.parse(sentData as string)

      expect(parsed.type).toBe('state')
      expect(parsed.screens).toBeDefined()
      expect(parsed.screens['screen-1']).toBeDefined()
    })

    it('creates correct ScreenStateMap from database', async () => {
      const mockDate = new Date('2024-01-01T00:00:00.000Z')

      vi.mocked(mockPrisma.screenState.findMany).mockResolvedValue([
        {
          id: '1',
          screenId: 'screen-1',
          imageSrc: '/images/screen1.png',
          scenario: 'scenario-a',
          updatedAt: mockDate,
          createdAt: mockDate,
        },
        {
          id: '2',
          screenId: 'screen-2',
          imageSrc: '/images/screen2.png',
          scenario: 'scenario-b',
          updatedAt: mockDate,
          createdAt: mockDate,
        },
      ])

      await broadcastState()

      const sentData = vi.mocked(mockClient.send).mock.calls[0][0]
      const parsed = JSON.parse(sentData as string)
      const screens: ScreenStateMap = parsed.screens

      expect(screens['screen-1']).toEqual({
        src: '/images/screen1.png',
        scenario: 'scenario-a',
        updated: mockDate.toISOString(),
      })

      expect(screens['screen-2']).toEqual({
        src: '/images/screen2.png',
        scenario: 'scenario-b',
        updated: mockDate.toISOString(),
      })
    })

    it('handles null imageSrc and scenario', async () => {
      vi.mocked(mockPrisma.screenState.findMany).mockResolvedValue([
        {
          id: '1',
          screenId: 'screen-1',
          imageSrc: null,
          scenario: null,
          updatedAt: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
        },
      ])

      await broadcastState()

      const sentData = vi.mocked(mockClient.send).mock.calls[0][0]
      const parsed = JSON.parse(sentData as string)
      const screens: ScreenStateMap = parsed.screens

      expect(screens['screen-1']).toEqual({
        src: null,
        scenario: null,
        updated: expect.any(String),
      })
    })

    it('broadcasts to all connected clients', async () => {
      const client2 = new WebSocket('ws://localhost:0')
      const client3 = new WebSocket('ws://localhost:0')

      Object.defineProperty(client2, 'readyState', { value: WebSocket.OPEN, writable: true })
      Object.defineProperty(client3, 'readyState', { value: WebSocket.OPEN, writable: true })

      vi.spyOn(client2, 'send').mockImplementation(() => { })
      vi.spyOn(client3, 'send').mockImplementation(() => { })

      mockWss.clients = new Set([mockClient, client2, client3])

      await broadcastState()

      expect(mockClient.send).toHaveBeenCalled()
      expect(client2.send).toHaveBeenCalled()
      expect(client3.send).toHaveBeenCalled()

      client2.close()
      client3.close()
    })

    it('skips clients that are not ready', async () => {
      const closedClient = new WebSocket('ws://localhost:0')
      Object.defineProperty(closedClient, 'readyState', { value: WebSocket.CLOSED, writable: true })

      vi.spyOn(closedClient, 'send').mockImplementation(() => { })

      mockWss.clients = new Set([mockClient, closedClient])

      await broadcastState()

      expect(mockClient.send).toHaveBeenCalled()
      expect(closedClient.send).not.toHaveBeenCalled()

      closedClient.close()
    })

    it('handles empty state list', async () => {
      vi.mocked(mockPrisma.screenState.findMany).mockResolvedValue([])

      await broadcastState()

      const sentData = vi.mocked(mockClient.send).mock.calls[0][0]
      const parsed = JSON.parse(sentData as string)

      expect(parsed.screens).toEqual({})
    })

    it('logs warning when WebSocket server is not initialized', async () => {
      setWebSocketServer(null as any)

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

      await broadcastState()

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'WebSocket server not initialized, broadcast skipped'
      )

      consoleWarnSpy.mockRestore()
    })

    it('does not send when server is not initialized', async () => {
      setWebSocketServer(null as any)

      vi.mocked(mockClient.send).mockClear()

      await broadcastState()

      expect(mockClient.send).not.toHaveBeenCalled()
    })

    it('sends JSON-serializable payload', async () => {
      vi.mocked(mockPrisma.screenState.findMany).mockResolvedValue([])

      await broadcastState()

      const sentData = vi.mocked(mockClient.send).mock.calls[0][0]

      expect(() => JSON.parse(sentData as string)).not.toThrow()
    })

    it('includes all required fields in state map', async () => {
      const mockDate = new Date('2024-01-01T00:00:00.000Z')

      vi.mocked(mockPrisma.screenState.findMany).mockResolvedValue([
        {
          id: '1',
          screenId: 'screen-1',
          imageSrc: '/test.png',
          scenario: 'test-scenario',
          updatedAt: mockDate,
          createdAt: mockDate,
        },
      ])

      await broadcastState()

      const sentData = vi.mocked(mockClient.send).mock.calls[0][0]
      const parsed = JSON.parse(sentData as string)
      const screenState = parsed.screens['screen-1']

      expect(screenState).toHaveProperty('src')
      expect(screenState).toHaveProperty('scenario')
      expect(screenState).toHaveProperty('updated')
    })

    it('handles database errors gracefully', async () => {
      vi.mocked(mockPrisma.screenState.findMany).mockRejectedValue(new Error('Database error'))

      await expect(broadcastState()).rejects.toThrow('Database error')
    })
  })

  describe('ScreenStateMap interface', () => {
    it('accepts valid ScreenStateMap structure', () => {
      const stateMap: ScreenStateMap = {
        'screen-1': {
          src: '/image.png',
          scenario: 'scenario-1',
          updated: new Date(),
        },
      }

      expect(stateMap['screen-1']).toBeDefined()
      expect(stateMap['screen-1'].src).toBe('/image.png')
    })

    it('allows null values for src and scenario', () => {
      const stateMap: ScreenStateMap = {
        'screen-1': {
          src: null,
          scenario: null,
          updated: new Date(),
        },
      }

      expect(stateMap['screen-1'].src).toBeNull()
      expect(stateMap['screen-1'].scenario).toBeNull()
    })

    it('supports multiple screens', () => {
      const stateMap: ScreenStateMap = {
        'screen-1': {
          src: '/image1.png',
          scenario: 'scenario-1',
          updated: new Date(),
        },
        'screen-2': {
          src: '/image2.png',
          scenario: 'scenario-2',
          updated: new Date(),
        },
        'screen-3': {
          src: '/image3.png',
          scenario: 'scenario-3',
          updated: new Date(),
        },
      }

      expect(Object.keys(stateMap)).toHaveLength(3)
    })
  })
})
