package com.traceflow.sdk;

import java.time.Instant;
import java.util.*;

/**
 * Thread-local holder for the current active TraceFlow span.
 * Used by filters, interceptors and AOP aspects to share trace context
 * within a single request thread.
 */
public final class TraceContext {

    public static final String TRACE_ID_HEADER = "X-TraceFlow-Trace-Id";
    public static final String SPAN_ID_HEADER  = "X-TraceFlow-Span-Id";

    private static final ThreadLocal<SpanState> CURRENT = new ThreadLocal<>();

    private TraceContext() {}

    public static SpanState start(String traceId, String parentSpanId, String serviceName, String operation) {
        SpanState state = new SpanState();
        state.traceId      = traceId != null && !traceId.isBlank()
                ? traceId
                : UUID.randomUUID().toString().replace("-", "");
        state.spanId       = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        state.parentSpanId = parentSpanId;
        state.serviceName  = serviceName;
        state.operation    = operation;
        state.startedAt    = Instant.now();
        CURRENT.set(state);
        return state;
    }

    public static SpanState current() {
        return CURRENT.get();
    }

    public static void clear() {
        CURRENT.remove();
    }

    /** Accumulate a log entry into the active span (flushed at end of request). */
    public static void log(String message, Map<String, String> attributes, String level) {
        SpanState state = CURRENT.get();
        if (state == null) return;
        LogEntry entry = new LogEntry();
        entry.id         = UUID.randomUUID().toString();
        entry.message    = message;
        entry.level      = level != null ? level : "INFO";
        entry.attributes = attributes != null ? new LinkedHashMap<>(attributes) : Collections.emptyMap();
        entry.timestamp  = Instant.now().toString();
        state.logs.add(entry);
    }

    public static void log(String message, Map<String, String> attributes) {
        log(message, attributes, "INFO");
    }

    public static class SpanState {
        public String traceId;
        public String spanId;
        public String parentSpanId;
        public String serviceName;
        public String operation;
        public Instant startedAt;
        public String status = "ok";
        public final List<LogEntry> logs = new ArrayList<>();
    }

    public static class LogEntry {
        public String id;
        public String message;
        public String level;
        public Map<String, String> attributes;
        public String timestamp;
    }
}
