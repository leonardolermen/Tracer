import { randomBytes } from 'crypto'

export function generateTraceId(): string {
  return 'trace_' + randomBytes(8).toString('hex')
}

export function generateSpanId(): string {
  return 'span_' + randomBytes(4).toString('hex')
}
