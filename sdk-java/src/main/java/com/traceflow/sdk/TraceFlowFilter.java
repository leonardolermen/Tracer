package com.traceflow.sdk;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Servlet filter that automatically captures HTTP request and response
 * bodies, propagates trace context, and flushes all accumulated logs
 * at the end of each request.
 *
 * Auto-registered by TraceFlowAutoConfiguration with HIGHEST_PRECEDENCE.
 * Zero configuration required from the application.
 */
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TraceFlowFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(TraceFlowFilter.class);
    private static final int MAX_BODY_BYTES = 8192;

    private final TraceFlowClient client;
    private final TraceFlowProperties props;
    private final String serviceName;

    public TraceFlowFilter(TraceFlowClient client, TraceFlowProperties props, String serviceName) {
        this.client      = client;
        this.props       = props;
        this.serviceName = serviceName;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/actuator") || path.equals("/health") || path.startsWith("/favicon");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        // Extract incoming trace context (from upstream service via Feign or Traceparent)
        String incomingTraceId = request.getHeader("traceparent");
        String parentSpanId = null;
        if (incomingTraceId != null && incomingTraceId.length() >= 55) {
            parentSpanId = incomingTraceId.substring(36, 52);
            incomingTraceId = incomingTraceId.substring(3, 35);
        } else if (request.getHeader("b3") != null) {
            String[] parts = request.getHeader("b3").split("-");
            incomingTraceId = parts[0];
            if (parts.length > 1) parentSpanId = parts[1];
        } else {
            incomingTraceId = request.getHeader(TraceContext.TRACE_ID_HEADER);
            parentSpanId = request.getHeader(TraceContext.SPAN_ID_HEADER);
        }

        String operation = request.getMethod() + " " + request.getRequestURI();
        TraceContext.SpanState span = TraceContext.start(incomingTraceId, parentSpanId, serviceName, operation);

        ContentCachingRequestWrapper wrappedReq = new ContentCachingRequestWrapper(request, MAX_BODY_BYTES) {
            @Override
            public String getHeader(String name) {
                if ("traceparent".equalsIgnoreCase(name)) {
                    String tp = super.getHeader(name);
                    if (tp == null && span != null && span.traceId != null) {
                        return "00-" + span.traceId + "-" + span.spanId + "-01";
                    }
                    return tp;
                }
                return super.getHeader(name);
            }

            @Override
            public java.util.Enumeration<String> getHeaders(String name) {
                if ("traceparent".equalsIgnoreCase(name)) {
                    String tp = getHeader(name);
                    if (tp != null) {
                        return java.util.Collections.enumeration(java.util.Collections.singletonList(tp));
                    }
                }
                return super.getHeaders(name);
            }

            @Override
            public java.util.Enumeration<String> getHeaderNames() {
                java.util.List<String> names = java.util.Collections.list(super.getHeaderNames());
                boolean hasTraceparent = false;
                for (String n : names) {
                    if ("traceparent".equalsIgnoreCase(n)) hasTraceparent = true;
                }
                if (!hasTraceparent) {
                    names.add("traceparent");
                }
                return java.util.Collections.enumeration(names);
            }
        };
        ContentCachingResponseWrapper wrappedRes = new ContentCachingResponseWrapper(response);

        // Expose trace ID in the response headers (allows client to see it)
        response.setHeader(TraceContext.TRACE_ID_HEADER, span.traceId);
        response.setHeader(TraceContext.SPAN_ID_HEADER,  span.spanId);
        // Make span available to controllers via request attribute
        request.setAttribute("traceflow.span", span);

        try {
            chain.doFilter(wrappedReq, wrappedRes);
        } finally {
            try {
                int status = wrappedRes.getStatus();

                if (props.isCaptureHttpBody()) {
                    // Log HTTP request
                    byte[] reqBody = wrappedReq.getContentAsByteArray();
                    if (reqBody.length > 0) {
                        Map<String, String> attrs = new LinkedHashMap<>();
                        attrs.put("http.method",       request.getMethod());
                        attrs.put("http.url",          request.getRequestURI());
                        attrs.put("http.content_type", Objects.toString(request.getContentType(), ""));
                        String rawBody = truncate(new String(reqBody, StandardCharsets.UTF_8));
                        attrs.put("http.body", props.isRedactSensitiveFields() ? redactSensitive(rawBody) : rawBody);
                        client.sendLog(span.traceId, serviceName, "INFO", "http.request", attrs);
                    }

                    // Log HTTP response
                    byte[] resBody = wrappedRes.getContentAsByteArray();
                    if (resBody.length > 0) {
                        String level = status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "INFO";
                        Map<String, String> attrs = new LinkedHashMap<>();
                        attrs.put("http.status", String.valueOf(status));
                        String rawRes = truncate(new String(resBody, StandardCharsets.UTF_8));
                        attrs.put("http.body", props.isRedactSensitiveFields() ? redactSensitive(rawRes) : rawRes);
                        client.sendLog(span.traceId, serviceName, level, "http.response", attrs);
                    }
                }

                // Flush all business event logs accumulated by AOP aspects
                client.flushLogs(span);

            } catch (Exception ex) {
                log.debug("[TraceFlow] Error during log flush: {}", ex.getMessage());
            } finally {
                wrappedRes.copyBodyToResponse();
                TraceContext.clear();
            }
        }
    }

    private String truncate(String s) {
        if (s == null) return "";
        return s.length() > 2000 ? s.substring(0, 1997) + "..." : s;
    }

    // ── Sensitive-field redaction ─────────────────────────────────────────────

    private static final Set<String> SENSITIVE_KEYS = new HashSet<>(Arrays.asList(
        "password", "confirmpassword", "confirm_password",
        "secret", "token", "accesstoken", "access_token",
        "refreshtoken", "refresh_token", "apikey", "api_key",
        "authorization", "cvv", "cardnumber", "card_number",
        "ssn", "cpf", "pin"
    ));

    // Regex: matches "key": "value" or "key": 12345 in JSON
    private static final Pattern JSON_STRING_VALUE = Pattern.compile(
        "(\\\")(" + buildKeyPattern() + ")(\\\"\\s*:\\s*\\\")[^\"]*(\\\")" ,
        Pattern.CASE_INSENSITIVE);
    private static final Pattern JSON_NUMBER_VALUE = Pattern.compile(
        "(\\\")(" + buildKeyPattern() + ")(\\\"\\s*:\\s*)([0-9]+(?:\\.[0-9]+)?)" ,
        Pattern.CASE_INSENSITIVE);

    private static String buildKeyPattern() {
        return String.join("|", SENSITIVE_KEYS);
    }

    private String redactSensitive(String body) {
        if (body == null || body.isBlank()) return body;
        String result = JSON_STRING_VALUE.matcher(body).replaceAll("$1$2$3***REDACTED***$4");
        result        = JSON_NUMBER_VALUE.matcher(result).replaceAll("$1$2$3\"***REDACTED***\"");
        return result;
    }
}
