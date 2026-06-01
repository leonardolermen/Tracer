from flask import request, g
from .. import TraceFlow
from ..propagation import extract_context
from ..sanitize import sanitize

def TraceFlowFlask(app):
    @app.before_request
    def before_request():
        tracer = TraceFlow.instance
        if not tracer:
            return

        headers = dict(request.headers)
        incoming = extract_context(headers)
        
        trace_id = incoming.get("traceId") if incoming else None
        parent_id = incoming.get("spanId") if incoming else None
        
        operation_name = f"{request.method} {request.path}"
        
        span = tracer.start_span(
            operation_name=operation_name,
            kind="server",
            trace_id=trace_id,
            parent_id=parent_id,
            tags={
                "http.method": request.method,
                "http.url": request.url,
                "http.path": request.path,
            }
        )
        
        g.traceflow_span = span
        
        req_attrs = {
            "method": request.method,
            "url": request.url,
            "user-agent": request.headers.get("User-Agent", ""),
            "content-type": request.content_type or ""
        }
        
        if request.is_json:
            try:
                body = request.get_json(silent=True)
                if body:
                    sanitized = sanitize(body)
                    for k, v in sanitized.items():
                        req_attrs[f"body.{k}"] = v
            except Exception:
                pass
                
        if request.args:
            for k, v in request.args.items():
                req_attrs[f"param.{k}"] = v
                
        span.log("http.request", req_attrs, "INFO")

    @app.after_request
    def after_request(response):
        span = getattr(g, "traceflow_span", None)
        if not span:
            return response
            
        status = response.status_code
        span.set_tag("http.status_code", str(status))
        
        response.headers["x-traceflow-trace-id"] = span.trace_id
        
        res_attrs = {"status_code": str(status)}
        
        if response.is_json:
            try:
                body = response.get_json(silent=True)
                if body:
                    sanitized = sanitize(body)
                    for k, v in sanitized.items():
                        res_attrs[f"body.{k}"] = v
            except Exception:
                pass

        if status >= 500:
            span.set_error(Exception(f"HTTP {status}"))
            span.log("http.response", res_attrs, "ERROR")
            span.end("error")
        elif status >= 400:
            span.log("http.response", res_attrs, "WARN")
            span.end("ok")
        else:
            span.log("http.response", res_attrs, "INFO")
            span.end("ok")
            
        return response

    @app.teardown_request
    def teardown_request(exception):
        span = getattr(g, "traceflow_span", None)
        if span and exception:
            span.set_error(exception)
            span.log("http.response", {"error": str(exception)}, "ERROR")
            span.end("error")
