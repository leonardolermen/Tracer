package com.traceflow.sdk;

import java.util.Map;

/**
 * TraceFlow public static API.
 *
 * Use this anywhere in your application to log structured business events
 * that will appear in the TraceFlow Dashboard → Logs tab.
 *
 * <pre>
 * // Log a business event
 * TraceFlow.log("payment.created", Map.of("amount", "100.00", "currency", "BRL"));
 *
 * // Log a warning
 * TraceFlow.warn("fraud.score.elevated", Map.of("score", "45", "rule", "HIGH_VALUE"));
 *
 * // Log an error
 * TraceFlow.error("payment.failed", Map.of("reason", ex.getMessage()));
 *
 * // Include trace ID in your API response
 * response.setHeader("X-Trace-Id", TraceFlow.currentTraceId());
 * </pre>
 */
public final class TraceFlow {

    private TraceFlow() {}

    /** Logs an INFO-level business event. */
    public static void log(String event, Map<String, String> attrs) {
        TraceContext.log(event, attrs, "INFO");
    }

    /** Logs a DEBUG-level event (low-noise details). */
    public static void debug(String event, Map<String, String> attrs) {
        TraceContext.log(event, attrs, "DEBUG");
    }

    /** Logs a WARN-level event (suspicious but not critical). */
    public static void warn(String event, Map<String, String> attrs) {
        TraceContext.log(event, attrs, "WARN");
    }

    /** Logs an ERROR-level event (failures, exceptions). */
    public static void error(String event, Map<String, String> attrs) {
        TraceContext.log(event, attrs, "ERROR");
    }

    /**
     * Logs any object's fields as attributes using reflection + sanitization.
     * Sensitive fields (password, cpf, token, etc.) are automatically redacted.
     */
    public static void logObject(String event, Object obj) {
        TraceContext.log(event, SensitiveFieldFilter.fromObject(obj), "INFO");
    }

    /** Returns the current request's trace ID, useful for including in API responses. */
    public static String currentTraceId() {
        TraceContext.SpanState state = TraceContext.current();
        return state != null ? state.traceId : null;
    }
}
