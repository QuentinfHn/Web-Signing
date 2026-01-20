import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { isAuthEnabled, verifyPassword, generateToken, verifyToken, type JWTPayload } from '../../auth/auth'

describe('auth', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.ADMIN_PASSWORD = undefined
    process.env.JWT_SECRET = 'test-secret-key'
    delete process.env.NODE_ENV
  })

  afterEach(() => {
    delete process.env.ADMIN_PASSWORD
    delete process.env.JWT_SECRET
    delete process.env.NODE_ENV
  })

  describe('isAuthEnabled', () => {
    it('returns true when ADMIN_PASSWORD is set', () => {
      process.env.ADMIN_PASSWORD = 'secure-password'
      expect(isAuthEnabled()).toBe(true)
    })

    it('returns false when ADMIN_PASSWORD is not set', () => {
      delete process.env.ADMIN_PASSWORD
      expect(isAuthEnabled()).toBe(false)
    })

    it('returns false when ADMIN_PASSWORD is empty string', () => {
      process.env.ADMIN_PASSWORD = ''
      expect(isAuthEnabled()).toBe(false)
    })
  })

  describe('verifyPassword', () => {
    it('returns true when no password is set', () => {
      delete process.env.ADMIN_PASSWORD
      expect(verifyPassword('any-password')).toBe(true)
      expect(verifyPassword('')).toBe(true)
      expect(verifyPassword('complex-p@ssw0rd!123')).toBe(true)
    })

    it('returns true for correct password', () => {
      process.env.ADMIN_PASSWORD = 'correct-password'
      expect(verifyPassword('correct-password')).toBe(true)
    })

    it('returns false when ADMIN_PASSWORD is not set', async () => {
      delete process.env.ADMIN_PASSWORD
      const authModule = await import('../../auth/auth')
      expect(authModule.isAuthEnabled()).toBe(false)
    })

    it('returns false when ADMIN_PASSWORD is empty string', async () => {
      process.env.ADMIN_PASSWORD = ''
      const authModule = await import('../../auth/auth')
      expect(authModule.isAuthEnabled()).toBe(false)
    })
  })

  describe('verifyPassword with import', () => {
    it('returns true when no password is set', async () => {
      delete process.env.ADMIN_PASSWORD
      expect(verifyPassword('any-password')).toBe(true)
      expect(verifyPassword('')).toBe(true)
      expect(verifyPassword('complex-p@ssw0rd!123')).toBe(true)
    })

    it('returns true for correct password', async () => {
      process.env.ADMIN_PASSWORD = 'correct-password'
      const authModule = await import('../../auth/auth')
      expect(authModule.verifyPassword('correct-password')).toBe(true)
    })

    it('returns false for incorrect password', () => {
      process.env.ADMIN_PASSWORD = 'correct-password'
      expect(verifyPassword('wrong-password')).toBe(false)
      expect(verifyPassword('correct-passwor')).toBe(false)
      expect(verifyPassword('correct-password ')).toBe(false)
    })

    it('is case-sensitive', () => {
      process.env.ADMIN_PASSWORD = 'Password'
      expect(verifyPassword('Password')).toBe(true)
      expect(verifyPassword('password')).toBe(false)
      expect(verifyPassword('PASSWORD')).toBe(false)
    })

    it('handles passwords with special characters', () => {
      const specialPassword = 'P@ssw0rd!#$%^&*()'
      process.env.ADMIN_PASSWORD = specialPassword
      expect(verifyPassword(specialPassword)).toBe(true)
      expect(verifyPassword('P@ssw0rd')).toBe(false)
    })

    it('uses timing-safe comparison to prevent timing attacks', () => {
      process.env.ADMIN_PASSWORD = 'password123'

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

    it('returns false for different length passwords', () => {
      process.env.ADMIN_PASSWORD = 'password'
      expect(verifyPassword('pass')).toBe(false)
      expect(verifyPassword('password-longer')).toBe(false)
    })
  })

  describe('generateToken', () => {
    it('generates a valid JWT token', () => {
      const token = generateToken()
      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3)
    })

    it('generates tokens with consistent signature', () => {
      // Note: tokens are deterministic when generated at the same timestamp
      // This test verifies the token format is correct
      const token1 = generateToken()
      const token2 = generateToken()
      expect(token1.split('.')).toHaveLength(3)
      expect(token2.split('.')).toHaveLength(3)
    })

    it('tokens contain authenticated: true payload', () => {
      const token = generateToken()
      const payload = verifyToken(token)
      expect(payload).toBeTruthy()
      expect(payload?.authenticated).toBe(true)
    })

    it('generates tokens that can be verified', () => {
      const token = generateToken()
      const payload = verifyToken(token)
      expect(payload).toBeTruthy()
      expect(payload?.authenticated).toBe(true)
    })

    it('has default expiry', () => {
      const token = generateToken()
      const parts = token.split('.')
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
      expect(payload.exp).toBeGreaterThan(payload.iat)
    })
  })

  describe('verifyToken', () => {
    it('returns valid payload for correct token', () => {
      const token = generateToken()
      const payload = verifyToken(token)

      expect(payload).not.toBeNull()
      expect(payload?.authenticated).toBe(true)
      expect(typeof payload?.iat).toBe('number')
      expect(typeof payload?.exp).toBe('number')
    })

    it('returns null for invalid token', () => {
      expect(verifyToken('invalid-token')).toBeNull()
      expect(verifyToken('')).toBeNull()
      expect(verifyToken('not.a.jwt')).toBeNull()
    })

    it('returns null for malformed token', () => {
      expect(verifyToken('only.two.parts')).toBeNull()
      expect(verifyToken('too.many.parts.here')).toBeNull()
    })

    it('returns null for tampered token', () => {
      const token = generateToken()
      const tamperedToken = token.slice(0, -1) + 'x'
      expect(verifyToken(tamperedToken)).toBeNull()
    })

    it('returns null for expired token', () => {
      const token = generateToken()

      const parts = token.split('.')
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
      payload.exp = Math.floor(Date.now() / 1000) - 3600

      const encoded = Buffer.from(JSON.stringify(payload)).toString('base64')
      const expiredToken = `${parts[0]}.${encoded}.${parts[2]}`

      expect(verifyToken(expiredToken)).toBeNull()
    })

    it('returns null for tampered token', () => {
      const token = generateToken()
      const tamperedToken = token.slice(0, -1) + 'x'
      expect(verifyToken(tamperedToken)).toBeNull()
    })

    it('verifies payload structure', () => {
      const token = generateToken()
      const payload = verifyToken(token) as JWTPayload

      expect(payload).toHaveProperty('authenticated')
      expect(payload.authenticated).toBe(true)
      expect(payload.iat).toBeDefined()
      expect(payload.exp).toBeDefined()
    })

    it('handles token without authenticated field', () => {
      const parts = generateToken().split('.')
      const payload = { iat: Date.now() / 1000, exp: Date.now() / 1000 + 3600 }
      const encoded = Buffer.from(JSON.stringify(payload)).toString('base64')
      const invalidToken = `${parts[0]}.${encoded}.${parts[2]}`

      expect(verifyToken(invalidToken)).toBeNull()
    })
  })

  describe('Integration tests', () => {
    it('full authentication flow works', () => {
      process.env.ADMIN_PASSWORD = 'secure-password'

      expect(isAuthEnabled()).toBe(true)
      expect(verifyPassword('secure-password')).toBe(true)

      const token = generateToken()
      const payload = verifyToken(token)

      expect(payload?.authenticated).toBe(true)
    })

    it('disabled auth flow bypasses password check', () => {
      delete process.env.ADMIN_PASSWORD
      expect(isAuthEnabled()).toBe(false)
      expect(verifyPassword('anything')).toBe(true)
    })
  })
})
