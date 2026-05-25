import { generateTraceId, generateSpanId } from '../id'

describe('id', () => {
  describe('generateTraceId', () => {
    it('starts with trace_ prefix', () => {
      expect(generateTraceId()).toMatch(/^trace_/)
    })

    it('generates unique ids', () => {
      const ids = new Set(Array.from({ length: 1000 }, generateTraceId))
      expect(ids.size).toBe(1000)
    })

    it('has correct format (trace_ + 16 hex chars)', () => {
      expect(generateTraceId()).toMatch(/^trace_[0-9a-f]{16}$/)
    })
  })

  describe('generateSpanId', () => {
    it('starts with span_ prefix', () => {
      expect(generateSpanId()).toMatch(/^span_/)
    })

    it('generates unique ids', () => {
      const ids = new Set(Array.from({ length: 1000 }, generateSpanId))
      expect(ids.size).toBe(1000)
    })

    it('has correct format (span_ + 8 hex chars)', () => {
      expect(generateSpanId()).toMatch(/^span_[0-9a-f]{8}$/)
    })
  })
})
