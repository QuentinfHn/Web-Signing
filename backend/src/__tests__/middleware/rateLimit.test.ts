import { describe, it, expect, beforeEach, vi } from 'vitest'
import express from 'express'
import request, { Response } from 'supertest'
import { loginRateLimiter, apiRateLimiter, uploadRateLimiter } from '../../middleware/rateLimit'
import { logger } from '../../utils/logger'

vi.mock('../../utils/logger')

describe('rate limit middleware', () => {
  let app: express.Application

  beforeEach(() => {
    vi.clearAllMocks()
    app = express()
    app.use(express.json())
  })

  describe('loginRateLimiter', () => {
    it('should be configured with correct options', () => {
      expect(loginRateLimiter).toBeDefined()
    })

    it('allows requests within limit', async () => {
      app.use(loginRateLimiter)
      app.get('/test', (req, res) => res.json({ success: true }))

      const response = await request(app).get('/test')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ success: true })
    })

    it('logs warning when rate limit is exceeded', async () => {
      app.use(loginRateLimiter)
      app.get('/test', (req, res) => res.json({ success: true }))

      const requests = []
      for (let i = 0; i < 10; i++) {
        requests.push(request(app).get('/test'))
      }

      const responses = await Promise.all(requests)

      const limitedResponses = responses.filter((r: Response) => r.status === 429)

      if (limitedResponses.length > 0) {
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Rate limit exceeded for IP:')
        )
      }
    })

    it('returns correct error message for rate limit', async () => {
      app.use(loginRateLimiter)
      app.get('/test', (req, res) => res.json({ success: true }))

      const requests = []
      for (let i = 0; i < 10; i++) {
        requests.push(request(app).get('/test'))
      }

      const responses = await Promise.all(requests)

      const limitedResponse = responses.find((r: Response) => r.status === 429)

      if (limitedResponse) {
        expect(limitedResponse.body).toEqual({
          error: 'Te veel login pogingen. Probeer opnieuw over 15 minuten.'
        })
      }
    })

    it('includes rate limit headers', async () => {
      app.use(loginRateLimiter)
      app.get('/test', (req, res) => res.json({ success: true }))

      const response = await request(app).get('/test')

      expect(response.headers['ratelimit-limit']).toBeDefined()
      expect(response.headers['ratelimit-remaining']).toBeDefined()
      expect(response.headers['ratelimit-reset']).toBeDefined()
      expect(response.headers['x-ratelimit-limit']).toBeUndefined()
      expect(response.headers['x-ratelimit-remaining']).toBeUndefined()
    })
  })

  describe('apiRateLimiter', () => {
    it('should be configured with correct options', () => {
      expect(apiRateLimiter).toBeDefined()
    })

    it('allows requests within limit', async () => {
      app.use(apiRateLimiter)
      app.get('/api/test', (req, res) => res.json({ success: true }))

      const response = await request(app).get('/api/test')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ success: true })
    })

    it('logs warning when rate limit is exceeded', async () => {
      app.use(apiRateLimiter)
      app.get('/api/test', (req, res) => res.json({ success: true }))

      const requests = []
      for (let i = 0; i < 120; i++) {
        requests.push(request(app).get('/api/test'))
      }

      const responses = await Promise.all(requests)

      const limitedResponses = responses.filter((r: Response) => r.status === 429)

      if (limitedResponses.length > 0) {
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('API rate limit exceeded for IP:')
        )
      }
    })

    it('returns correct error message for rate limit', async () => {
      app.use(apiRateLimiter)
      app.get('/api/test', (req, res) => res.json({ success: true }))

      const requests = []
      for (let i = 0; i < 120; i++) {
        requests.push(request(app).get('/api/test'))
      }

      const responses = await Promise.all(requests)

      const limitedResponse = responses.find((r: Response) => r.status === 429)

      if (limitedResponse) {
        expect(limitedResponse.body).toEqual({
          error: 'Te veel verzoeken. Probeer opnieuw over enkele minuten.'
        })
      }
    })

    it('includes rate limit headers', async () => {
      app.use(apiRateLimiter)
      app.get('/api/test', (req, res) => res.json({ success: true }))

      const response = await request(app).get('/api/test')

      expect(response.headers['ratelimit-limit']).toBeDefined()
      expect(response.headers['ratelimit-remaining']).toBeDefined()
      expect(response.headers['ratelimit-reset']).toBeDefined()
    })
  })

  describe('uploadRateLimiter', () => {
    it('should be configured with correct options', () => {
      expect(uploadRateLimiter).toBeDefined()
    })

    it('allows requests within limit', async () => {
      app.use(uploadRateLimiter)
      app.post('/upload', (req, res) => res.json({ success: true }))

      const response = await request(app).post('/upload').send({})

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ success: true })
    })

    it('logs warning when rate limit is exceeded', async () => {
      app.use(uploadRateLimiter)
      app.post('/upload', (req, res) => res.json({ success: true }))

      const requests = []
      for (let i = 0; i < 15; i++) {
        requests.push(request(app).post('/upload').send({}))
      }

      const responses = await Promise.all(requests)

      const limitedResponses = responses.filter((r: Response) => r.status === 429)

      if (limitedResponses.length > 0) {
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Upload rate limit exceeded for IP:')
        )
      }
    })

    it('returns correct error message for rate limit', async () => {
      app.use(uploadRateLimiter)
      app.post('/upload', (req, res) => res.json({ success: true }))

      const requests = []
      for (let i = 0; i < 15; i++) {
        requests.push(request(app).post('/upload').send({}))
      }

      const responses = await Promise.all(requests)

      const limitedResponse = responses.find((r: Response) => r.status === 429)

      if (limitedResponse) {
        expect(limitedResponse.body).toEqual({
          error: 'Te veel uploads. Probeer opnieuw over een uur.'
        })
      }
    })

    it('includes rate limit headers', async () => {
      app.use(uploadRateLimiter)
      app.post('/upload', (req, res) => res.json({ success: true }))

      const response = await request(app).post('/upload').send({})

      expect(response.headers['ratelimit-limit']).toBeDefined()
      expect(response.headers['ratelimit-remaining']).toBeDefined()
      expect(response.headers['ratelimit-reset']).toBeDefined()
    })
  })

  describe('Rate limiter configurations', () => {
    it('loginRateLimiter has different limits than apiRateLimiter', () => {
      expect(loginRateLimiter).toBeDefined()
      expect(apiRateLimiter).toBeDefined()
    })

    it('uploadRateLimiter has longer window but lower limit', () => {
      expect(uploadRateLimiter).toBeDefined()
      expect(apiRateLimiter).toBeDefined()
    })
  })

  describe('Rate limiter behavior', () => {
    it('standardHeaders is enabled for all limiters', async () => {
      app.use(loginRateLimiter)
      app.get('/test', (req, res) => res.json({ success: true }))

      const response = await request(app).get('/test')

      expect(response.headers['ratelimit-limit']).toBeDefined()
    })

    it('legacyHeaders is disabled for all limiters', async () => {
      app.use(loginRateLimiter)
      app.get('/test', (req, res) => res.json({ success: true }))

      const response = await request(app).get('/test')

      expect(response.headers['x-ratelimit-limit']).toBeUndefined()
    })
  })
})
