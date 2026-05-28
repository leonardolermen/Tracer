package com.traceflow.sdk;

import feign.RequestInterceptor;
import feign.RequestTemplate;

/**
 * Feign interceptor that propagates TraceFlow trace context headers
 * to all outgoing inter-service HTTP calls automatically.
 *
 * This ensures that trace_id is shared across core-service → fraud-service
 * so both services appear in the same trace in the dashboard.
 *
 * Auto-registered by TraceFlowAutoConfiguration when Feign is on the classpath.
 */
public class TraceFlowFeignInterceptor implements RequestInterceptor {

    @Override
    public void apply(RequestTemplate template) {
        TraceContext.SpanState state = TraceContext.current();
        if (state != null) {
            template.header(TraceContext.TRACE_ID_HEADER, state.traceId);
            template.header(TraceContext.SPAN_ID_HEADER,  state.spanId);
        }
    }
}
