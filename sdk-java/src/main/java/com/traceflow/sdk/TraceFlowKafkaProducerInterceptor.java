package com.traceflow.sdk;

import org.apache.kafka.clients.producer.ProducerInterceptor;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.apache.kafka.common.header.Headers;

import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Kafka Producer Interceptor that automatically injects the current TraceFlow
 * trace ID into every outgoing Kafka message header.
 *
 * This allows downstream consumers to extract the same trace ID and continue
 * logging under the same trace, enabling end-to-end visibility across
 * asynchronous service boundaries.
 *
 * Registered via spring.kafka.producer.properties in TraceFlowAutoConfiguration.
 */
public class TraceFlowKafkaProducerInterceptor implements ProducerInterceptor<Object, Object> {

    static final String TRACE_ID_HEADER = "X-TraceFlow-Trace-Id";

    @Override
    public ProducerRecord<Object, Object> onSend(ProducerRecord<Object, Object> record) {
        TraceContext.SpanState state = TraceContext.current();
        if (state != null && state.traceId != null) {
            Headers headers = record.headers();
            // Only inject if not already present (avoid overwriting on re-sends)
            if (headers.lastHeader(TRACE_ID_HEADER) == null) {
                headers.add(TRACE_ID_HEADER, state.traceId.getBytes(StandardCharsets.UTF_8));
            }
        }
        return record;
    }

    @Override
    public void onAcknowledgement(RecordMetadata metadata, Exception exception) {}

    @Override
    public void close() {}

    @Override
    public void configure(Map<String, ?> configs) {}
}
