import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import type { JWTPayload } from '../../auth/auth'

const AUTH_MODULE_PATH = '../../auth/auth'

async function importAuthModule() {
  vi.resetModules()
  return import(AUTH_MODULE_PATH)
}

describe('auth', () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = 'test-admin-password'
    process.env.JWT_SECRET = 'test-secret-key'
    delete process.env.NODE_ENV
    vi.restoreAllMocks()
  })

  afterEach(() => {
    delete process.env.ADMIN_PASSWORD
    delete process.env.JWT_SECRET
    delete process.env.NODE_ENV
    vi.restoreAllMocks()
  })

  describe('module initialization', () => {
    it('loads when ADMIN_PASSWORD is set', async () => {
      await expect(importAuthModule()).resolves.toBeDefined()
    })

    it('throws when ADMIN_PASSWORD is not set', async () => {
      delete process.env.ADMIN_PASSWORD
      await expect(importAuthModule()).rejects.toThrow('ADMIN_PASSWORD is required')
    })

    it('throws when ADMIN_PASSWORD is empty string', async () => {
      process.env.ADMIN_PASSWORD = ''
      await expect(importAuthModule()).rejects.toThrow('ADMIN_PASSWORD is required')
    })

    it('throws in production when JWT_SECRET is missing', async () => {
      delete process.env.JWT_SECRET
      process.env.NODE_ENV = 'production'
      await expect(importAuthModule()).rejects.toThrow('JWT_SECRET is required in production')
    })

    it('warns in development when JWT_SECRET is missing', async () => {
      delete process.env.JWT_SECRET
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      await expect(importAuthModule()).resolves.toBeDefined()
      expect(warnSpy).toHaveBeenCalledOnce()
    })
  })

  describe('isAuthEnabled', () => {
    it('always returns true after successful startup', async () => {
      const { isAuthEnabled } = await importAuthModule()
      expect(isAuthEnabled()).toBe(true)
    })
  })

  describe('verifyPassword', () => {
    it('returns true for correct password', async () => {
      process.env.ADMIN_PASSWORD = 'correct-password'
      const { verifyPassword } = await importAuthModule()
      expect(verifyPassword('correct-password')).toBe(true)
    })

    it('returns false for incorrect password', async () => {
      process.env.ADMIN_PASSWORD = 'correct-password'
      const { verifyPassword } = await importAuthModule()
      expect(verifyPassword('wrong-password')).toBe(false)
      expect(verifyPassword('correct-passwor')).toBe(false)
      expect(verifyPassword('correct-password ')).toBe(false)
    })

    it('is case-sensitive', async () => {
      process.env.ADMIN_PASSWORD = 'Password'
      const { verifyPassword } = await importAuthModule()
      expect(verifyPassword('Password')).toBe(true)
      expect(verifyPassword('password')).toBe(false)
      expect(verifyPassword('PASSWORD')).toBe(false)
    })

    it('handles passwords with special characters', async () => {
      const specialPassword = 'P@ssw0rd!#$%^&*()'
      process.env.ADMIN_PASSWORD = specialPassword
      const { verifyPassword } = await importAuthModule()
      expect(verifyPassword(specialPassword)).toBe(true)
      expect(verifyPassword('P@ssw0rd')).toBe(false)
    })

    it('uses timing-safe comparison to prevent obvious timing differences', async () => {
      process.env.ADMIN_PASSWORD = 'password123'
      const { verifyPassword } = await importAuthModule()

      const start = Date.now()
      for (let i = 0; i < 1000; i++) {
        verifyPassword('password123')
      }
      const correctTime = Date.now() - start

      const startWrong = Date.now()
      for (let i = 0; i < 1000; i++) {
        verifyPassword('wrongpassword')
      }
      const wrongTime = Date.now() - startWrong

      expect(Math.abs(correctTime - wrongTime)).toBeLessThan(100)
    })

    it('returns false for different length passwords', async () => {
      process.env.ADMIN_PASSWORD = 'password'
      const { verifyPassword } = await importAuthModule()
      expect(verifyPassword('pass')).toBe(false)
      expect(verifyPassword('password-longer')).toBe(false)
    })

    it('returns false if ADMIN_PASSWORD is removed after startup', async () => {
      const { verifyPassword } = await importAuthModule()
      delete process.env.ADMIN_PASSWORD
      expect(verifyPassword('anything')).toBe(false)
    })

    it('returns false if ADMIN_PASSWORD becomes empty after startup', async () => {
      const { verifyPassword } = await importAuthModule()
      process.env.ADMIN_PASSWORD = ''
      expect(verifyPassword('anything')).toBe(false)
    })
  })

  describe('generateToken', () => {
    it('generates a valid JWT token', async () => {
      const { generateToken } = await importAuthModule()
      const token = generateToken()
      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3)
    })

    it('tokens contain authenticated: true payload', async () => {
      const { generateToken, verifyToken } = await importAuthModule()
      const token = generateToken()
      const payload = verifyToken(token)
      expect(payload).toBeTruthy()
      expect(payload?.authenticated).toBe(true)
    })

    it('has default expiry', async () => {
      const { generateToken } = await importAuthModule()
      const token = generateToken()
      const parts = token.split('.')
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
      expect(payload.exp).toBeGreaterThan(payload.iat)
    })
  })

  describe('verifyToken', () => {
    it('returns valid payload for correct token', async () => {
      const { generateToken, verifyToken } = await importAuthModule()
      const token = generateToken()
      const payload = verifyToken(token)

      expect(payload).not.toBeNull()
      expect(payload?.authenticated).toBe(true)
      expect(typeof payload?.iat).toBe('number')
      expect(typeof payload?.exp).toBe('number')
    })

    it('returns null for invalid token', async () => {
      const { verifyToken } = await importAuthModule()
      expect(verifyToken('invalid-token')).toBeNull()
      expect(verifyToken('')).toBeNull()
      expect(verifyToken('not.a.jwt')).toBeNull()
    })

    it('returns null for malformed token', async () => {
      const { verifyToken } = await importAuthModule()
      expect(verifyToken('only.two.parts')).toBeNull()
      expect(verifyToken('too.many.parts.here')).toBeNull()
    })

    it('returns null for tampered token', async () => {
      const { generateToken, verifyToken } = await importAuthModule()
      const token = generateToken()
      const tamperedToken = token.slice(0, -1) + 'x'
      expect(verifyToken(tamperedToken)).toBeNull()
    })

    it('returns null for expired token', async () => {
      const { verifyToken } = await importAuthModule()
      const secret = process.env.JWT_SECRET || 'default-dev-secret-change-in-production'
      const expiredToken = jwt.sign({ authenticated: true }, secret, { expiresIn: -1 })
      expect(verifyToken(expiredToken)).toBeNull()
    })

    it('verifies payload structure', async () => {
      const { generateToken, verifyToken } = await importAuthModule()
      const token = generateToken()
      const payload = verifyToken(token) as JWTPayload

      expect(payload).toHaveProperty('authenticated')
      expect(payload.authenticated).toBe(true)
      expect(payload.iat).toBeDefined()
      expect(payload.exp).toBeDefined()
    })

    it('handles token without authenticated field', async () => {
      const { verifyToken } = await importAuthModule()
      const secret = process.env.JWT_SECRET || 'default-dev-secret-change-in-production'
      const invalidToken = jwt.sign({ role: 'admin' }, secret, { expiresIn: '7d' })
      expect(verifyToken(invalidToken)).toBeNull()
    })

    it('returns null for token with authenticated: false', async () => {
      const { verifyToken } = await importAuthModule()
      const secret = process.env.JWT_SECRET || 'default-dev-secret-change-in-production'
      const token = jwt.sign({ authenticated: false }, secret, { expiresIn: '7d' })
      expect(verifyToken(token)).toBeNull()
    })

    it('returns null for token with authenticated: 1 (non-boolean truthy)', async () => {
      const { verifyToken } = await importAuthModule()
      const secret = process.env.JWT_SECRET || 'default-dev-secret-change-in-production'
      const token = jwt.sign({ authenticated: 1 }, secret, { expiresIn: '7d' })
      expect(verifyToken(token)).toBeNull()
    })
  })

  describe('integration', () => {
    it('full authentication flow works', async () => {
      process.env.ADMIN_PASSWORD = 'secure-password'
      const { isAuthEnabled, verifyPassword, generateToken, verifyToken } = await importAuthModule()

      expect(isAuthEnabled()).toBe(true)
      expect(verifyPassword('secure-password')).toBe(true)

      const token = generateToken()
      const payload = verifyToken(token)
      expect(payload?.authenticated).toBe(true)
    })
  })
})
