package com.traceflow.sdk;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Lightweight HTTP client for sending log events to the TraceFlow collector.
 * Uses Java 11 HttpClient — zero extra dependencies.
 * All sends are async/fire-and-forget so they never block request threads.
 */
public class TraceFlowClient {

    private static final Logger log = LoggerFactory.getLogger(TraceFlowClient.class);

    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2))
            .build();

    private final String logsEndpoint;
    private final String workspaceId;

    public TraceFlowClient(String collectorUrl, String workspaceId) {
        String base = collectorUrl.endsWith("/")
                ? collectorUrl.substring(0, collectorUrl.length() - 1)
                : collectorUrl;
        this.logsEndpoint = base + "/v1/logs";
        this.workspaceId  = workspaceId;
    }

    /** Sends a single log entry asynchronously. Never throws. */
    public void sendLog(String traceId, String serviceName, String level,
                        String message, Map<String, String> attributes) {
        String json = toJson(traceId, serviceName, level, message, attributes);
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(logsEndpoint))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .timeout(Duration.ofSeconds(3))
                .build();

        HTTP.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .thenAccept(res -> {
                    if (res.statusCode() >= 400) {
                        log.error("[TraceFlow] log send failed with status: {} body: {}", res.statusCode(), res.body());
                    }
                })
                .exceptionally(ex -> {
                    log.error("[TraceFlow] log send exception: {}", ex.getMessage());
                    return null;
                });
    }

    /** Flushes all buffered logs from a SpanState asynchronously. */
    public void flushLogs(TraceContext.SpanState state) {
        if (state == null || state.logs.isEmpty()) return;
        for (TraceContext.LogEntry entry : state.logs) {
            sendLog(state.traceId, state.serviceName, entry.level, entry.message, entry.attributes);
        }
    }

    // ─── JSON builder (no Jackson dep needed) ────────────────────────────────

    private String toJson(String traceId, String serviceName, String level,
                          String message, Map<String, String> attributes) {
        StringBuilder sb = new StringBuilder(256);
        sb.append("{");
        appendStr(sb, "id",           UUID.randomUUID().toString()); sb.append(",");
        appendStr(sb, "trace_id",     traceId);                      sb.append(",");
        appendStr(sb, "service_name", serviceName);                  sb.append(",");
        appendStr(sb, "level",        level != null ? level : "INFO"); sb.append(",");
        appendStr(sb, "message",      message);                      sb.append(",");
        appendStr(sb, "workspace_id", workspaceId);                  sb.append(",");
        appendStr(sb, "timestamp",    Instant.now().toString());     sb.append(",");

        sb.append("\"attributes\":{");
        if (attributes != null && !attributes.isEmpty()) {
            boolean first = true;
            for (Map.Entry<String, String> e : attributes.entrySet()) {
                if (!first) sb.append(",");
                appendStr(sb, e.getKey(), e.getValue());
                first = false;
            }
        }
        sb.append("}}");
        return sb.toString();
    }

    private void appendStr(StringBuilder sb, String key, String value) {
        sb.append("\"").append(escape(key)).append("\":\"").append(escape(value)).append("\"");
    }

    private String escape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }
}
