export { Tracer } from './tracer'
export { Span } from './span'
export { injectHeaders, extractContext } from './propagation'
export { traceflowMiddleware } from './integrations/express'
export { patchFetch } from './integrations/fetch'
export type {
  TraceFlowConfig,
  SpanOptions,
  SpanKind,
  SpanStatus,
  SpanEvent,
  SpanError,
  Transport,
} from './types'

import { Tracer } from './tracer'
import { TraceFlowConfig } from './types'

let _instance: Tracer | null = null

export const TraceFlow = {
  init(config: TraceFlowConfig): Tracer {
    _instance = new Tracer(config)
    return _instance
  },

  get instance(): Tracer {
    if (!_instance) throw new Error('[traceflow] Call TraceFlow.init() before using the SDK')
    return _instance
  },
}
