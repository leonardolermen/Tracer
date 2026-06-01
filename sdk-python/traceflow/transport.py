import requests
import threading
import queue

class HttpTransport:
    def __init__(self, url: str, api_key: str):
        self.url = url.rstrip('/')
        self.api_key = api_key
        self.span_queue = queue.Queue(maxsize=1000)
        self.log_queue = queue.Queue(maxsize=1000)
        
        self.worker = threading.Thread(target=self._process_queue, daemon=True)
        self.worker.start()

    def send_span(self, span):
        try:
            self.span_queue.put_nowait(span.to_dict())
        except queue.Full:
            pass # Drop if full

    def send_log(self, log_entry):
        try:
            self.log_queue.put_nowait(log_entry)
        except queue.Full:
            pass

    def _process_queue(self):
        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key
        }
        
        while True:
            try:
                span_data = self.span_queue.get(timeout=0.1)
                try:
                    requests.post(f"{self.url}/v1/spans", json=span_data, headers=headers, timeout=2)
                except Exception:
                    pass # Ignore delivery errors in background worker
                self.span_queue.task_done()
            except queue.Empty:
                pass
                
            try:
                log_data = self.log_queue.get(timeout=0.1)
                try:
                    requests.post(f"{self.url}/v1/logs", json=[log_data], headers=headers, timeout=2)
                except Exception:
                    pass
                self.log_queue.task_done()
            except queue.Empty:
                pass
