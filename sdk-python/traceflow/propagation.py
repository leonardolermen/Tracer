def extract_context(headers: dict):
    trace_id = None
    span_id = None
    
    # Try traceparent first (W3C)
    traceparent = headers.get("traceparent")
    if traceparent:
        parts = traceparent.split("-")
        if len(parts) == 4:
            trace_id = parts[1]
            span_id = parts[2]
            return {"traceId": trace_id, "spanId": span_id}
            
    # Try custom headers
    trace_id = headers.get("x-traceflow-trace-id") or headers.get("x-b3-traceid")
    span_id = headers.get("x-traceflow-span-id") or headers.get("x-b3-spanid")
    
    if trace_id:
        return {"traceId": trace_id, "spanId": span_id}
        
    return None

def inject_headers(span, headers: dict):
    headers["x-traceflow-trace-id"] = span.trace_id
    headers["x-traceflow-span-id"] = span.id
    headers["traceparent"] = f"00-{span.trace_id}-{span.id}-01"
