import os
from .tracer import Tracer

class TraceFlow:
    instance = None

    @classmethod
    def init(cls, service_name=None, api_key=None, collector_url=None):
        if cls.instance:
            return cls.instance

        service_name = service_name or os.environ.get("TRACEFLOW_SERVICE_NAME")
        api_key = api_key or os.environ.get("TRACEFLOW_API_KEY")
        collector_url = collector_url or os.environ.get("TRACEFLOW_COLLECTOR_URL", "http://localhost:4318")

        if not service_name:
            raise ValueError("TraceFlow requires a service_name")
        if not api_key:
            raise ValueError("TraceFlow requires an api_key")

        cls.instance = Tracer(service_name, api_key, collector_url)
        return cls.instance
