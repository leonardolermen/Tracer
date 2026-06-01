package com.traceflow.sdk;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * TraceFlow SDK configuration properties.
 *
 * Add to your application.yml:
 * <pre>
 * traceflow:
 *   collector-url: http://localhost:4317
 *   api-key: tf_live_your_key   # the collector derives the workspace from it
 *   enabled: true
 * </pre>
 */
@ConfigurationProperties(prefix = "traceflow")
public class TraceFlowProperties {

    /** TraceFlow collector base URL. Default: http://localhost:4317 */
    private String collectorUrl = "http://localhost:4317";

    /** Your workspace api-key (tf_live_...). The collector derives the workspace from it. */
    private String apiKey;

    /** Workspace ID. Optional: only used in dev mode when no api-key is configured. */
    private String workspaceId;

    /** Service name override. Defaults to spring.application.name. */
    private String serviceName;

    /** Whether to automatically capture HTTP request/response bodies. */
    private boolean captureHttpBody = true;

    /** Whether to redact sensitive fields from logs. */
    private boolean redactSensitiveFields = true;

    /** Master switch. Set to false to disable all instrumentation. */
    private boolean enabled = true;

    public String getCollectorUrl()                    { return collectorUrl; }
    public void setCollectorUrl(String v)              { this.collectorUrl = v; }
    public String getApiKey()                          { return apiKey; }
    public void setApiKey(String v)                    { this.apiKey = v; }
    public String getWorkspaceId()                     { return workspaceId; }
    public void setWorkspaceId(String v)               { this.workspaceId = v; }
    public String getServiceName()                     { return serviceName; }
    public void setServiceName(String v)               { this.serviceName = v; }
    public boolean isCaptureHttpBody()                 { return captureHttpBody; }
    public void setCaptureHttpBody(boolean v)          { this.captureHttpBody = v; }
    public boolean isRedactSensitiveFields()           { return redactSensitiveFields; }
    public void setRedactSensitiveFields(boolean v)    { this.redactSensitiveFields = v; }
    public boolean isEnabled()                         { return enabled; }
    public void setEnabled(boolean v)                  { this.enabled = v; }
}
