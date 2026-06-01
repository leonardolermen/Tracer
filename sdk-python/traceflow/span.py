import time
import datetime

class Span:
    def __init__(self, tracer, id: str, trace_id: str, parent_id: str, service_name: str, operation_name: str, kind: str, tags: dict):
        self._tracer = tracer
        self.id = id
        self.trace_id = trace_id
        self.parent_id = parent_id
        self.service_name = service_name
        self.operation_name = operation_name
        self.kind = kind
        self.tags = tags
        self.status = "in_progress"
        self._start_time = time.time()
        self.started_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        self.duration_ms = 0
        self.error_details = None

    def set_tag(self, key: str, value: str):
        self.tags[key] = str(value)

    def log(self, name: str, attrs: dict = None, severity: str = "INFO"):
        log_entry = {
            "trace_id": self.trace_id,
            "span_id": self.id,
            "service_name": self.service_name,
            "severity": severity,
            "message": name,
            "attributes": attrs or {},
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        self._tracer.transport.send_log(log_entry)

    def set_error(self, error: Exception):
        self.error_details = {"type": type(error).__name__, "message": str(error)}

    def end(self, status: str = "ok"):
        self.status = status
        self.duration_ms = int((time.time() - self._start_time) * 1000)
        self._tracer._on_span_end(self)

    def to_dict(self):
        d = {
            "id": self.id,
            "trace_id": self.trace_id,
            "parent_id": self.parent_id,
            "service_name": self.service_name,
            "operation_name": self.operation_name,
            "kind": self.kind,
            "started_at": self.started_at,
            "duration_ms": self.duration_ms,
            "status": self.status,
            "tags": self.tags,
        }
        if self.error_details:
            d["error_details"] = self.error_details
        return d
