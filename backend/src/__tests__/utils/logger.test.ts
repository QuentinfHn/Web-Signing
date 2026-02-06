import { describe, it, expect, beforeEach, vi } from 'vitest'
import { logger } from '../../utils/logger'

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('should log info messages', () => {
    logger.info('test message')
    expect(console.log).toHaveBeenCalled()
    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/.+/),
      '[INFO]',
      'test message'
    )
  })

  it('should log error messages', () => {
    logger.error('test error')
    expect(console.error).toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/.+/),
      '[ERROR]',
      'test error'
    )
  })

  it('should log warning messages', () => {
    logger.warn('test warning')
    expect(console.warn).toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(/.+/),
      '[WARN]',
      'test warning'
    )
  })

  it('should support multiple arguments', () => {
    logger.info('message', { data: 'test' }, 123)
    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/.+/),
      '[INFO]',
      'message',
      { data: 'test' },
      123
    )
  })
})
