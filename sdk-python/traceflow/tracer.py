import uuid
import secrets
from .span import Span
from .transport import HttpTransport

def generate_trace_id():
    return secrets.token_hex(16)

def generate_span_id():
    return secrets.token_hex(8)

class Tracer:
    def __init__(self, service_name: str, api_key: str, collector_url: str):
        self.service_name = service_name
        self.transport = HttpTransport(collector_url, api_key)

    def start_span(self, operation_name: str, kind: str = "internal", trace_id: str = None, parent_id: str = None, tags: dict = None) -> Span:
        if not trace_id:
            trace_id = generate_trace_id()
            
        span = Span(
            tracer=self,
            id=generate_span_id(),
            trace_id=trace_id,
            parent_id=parent_id,
            service_name=self.service_name,
            operation_name=operation_name,
            kind=kind,
            tags=tags or {}
        )
        return span

    def _on_span_end(self, span: Span):
        self.transport.send_span(span)
