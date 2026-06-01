import json
from .. import TraceFlow
from ..propagation import extract_context
from ..sanitize import sanitize

class TraceFlowMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        tracer = TraceFlow.instance
        if not tracer:
            return self.get_response(request)

        headers = {k[5:].lower().replace('_', '-'): v for k, v in request.META.items() if k.startswith('HTTP_')}
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
                "http.url": request.build_absolute_uri(),
                "http.path": request.path,
            }
        )
        
        request.traceflow_span = span
        
        req_attrs = {
            "method": request.method,
            "url": request.build_absolute_uri(),
            "user-agent": request.META.get("HTTP_USER_AGENT", ""),
            "content-type": request.META.get("CONTENT_TYPE", "")
        }
        
        if request.GET:
            for k, v in request.GET.items():
                req_attrs[f"param.{k}"] = v
                
        span.log("http.request", req_attrs, "INFO")
        
        try:
            response = self.get_response(request)
            
            status = response.status_code
            span.set_tag("http.status_code", str(status))
            
            response["x-traceflow-trace-id"] = span.trace_id
            
            res_attrs = {"status_code": str(status)}
            
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
            
        except Exception as e:
            span.set_error(e)
            span.log("http.response", {"error": str(e)}, "ERROR")
            span.end("error")
            raise e
