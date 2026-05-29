package com.traceflow.sdk;

import org.apache.kafka.clients.producer.ProducerConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;

import java.util.Map;

/**
 * BeanPostProcessor that automatically instruments all Kafka beans in the
 * application context with TraceFlow trace propagation. Zero configuration
 * required from the client — works exactly like the HTTP filter.
 *
 * What it does:
 *
 * 1. Every {@link DefaultKafkaProducerFactory} found in the context gets the
 *    {@link TraceFlowKafkaProducerInterceptor} registered, so every outgoing
 *    Kafka message automatically carries the current X-TraceFlow-Trace-Id header.
 *
 * 2. Every {@link ConcurrentKafkaListenerContainerFactory} found in the context
 *    gets a RecordInterceptor that reads the trace ID from the incoming message
 *    header and seeds the thread-local TraceContext before the listener runs,
 *    then flushes all accumulated logs after it finishes.
 *
 * Registered automatically by {@link TraceFlowAutoConfiguration} when
 * spring-kafka is on the classpath. No changes needed in client KafkaConfig.
 */
public class TraceFlowKafkaBeanPostProcessor implements BeanPostProcessor, Ordered {

    private static final Logger log = LoggerFactory.getLogger(TraceFlowKafkaBeanPostProcessor.class);

    private final TraceFlowClient client;
    private final String serviceName;

    public TraceFlowKafkaBeanPostProcessor(TraceFlowClient client, String serviceName) {
        this.client      = client;
        this.serviceName = serviceName;
    }

    @Override
    public int getOrder() {
        // Run after other post-processors so factories are fully initialized
        return Ordered.LOWEST_PRECEDENCE - 10;
    }

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {

        // ── Producer: inject trace ID header into every outgoing message ──────
        if (bean instanceof DefaultKafkaProducerFactory<?, ?> factory) {
            try {
                factory.updateConfigs(Map.of(
                        ProducerConfig.INTERCEPTOR_CLASSES_CONFIG,
                        TraceFlowKafkaProducerInterceptor.class.getName()
                ));
                log.debug("[TraceFlow] Registered producer interceptor on factory '{}'", beanName);
            } catch (Exception ex) {
                log.warn("[TraceFlow] Could not register producer interceptor on '{}': {}", beanName, ex.getMessage());
            }
        }

        // ── Consumer: restore trace context from header before listener runs ──
        if (bean instanceof ConcurrentKafkaListenerContainerFactory<?, ?> factory) {
            try {
                factory.setRecordInterceptor(buildRecordInterceptor());
                log.debug("[TraceFlow] Registered record interceptor on factory '{}'", beanName);
            } catch (Exception ex) {
                log.warn("[TraceFlow] Could not register record interceptor on '{}': {}", beanName, ex.getMessage());
            }
        }

        return bean;
    }

    @SuppressWarnings("unchecked")
    private <K, V> org.springframework.kafka.listener.RecordInterceptor<K, V> buildRecordInterceptor() {
        return new org.springframework.kafka.listener.RecordInterceptor<>() {

            @Override
            public org.apache.kafka.clients.consumer.ConsumerRecord<K, V> intercept(
                    org.apache.kafka.clients.consumer.ConsumerRecord<K, V> record,
                    org.apache.kafka.clients.consumer.Consumer<K, V> consumer) {

                String traceId = extractTraceId(record);
                String operation = "kafka.consume " + record.topic();
                TraceContext.start(traceId, null, serviceName, operation);
                return record;
            }

            @Override
            public void afterRecord(
                    org.apache.kafka.clients.consumer.ConsumerRecord<K, V> record,
                    org.apache.kafka.clients.consumer.Consumer<K, V> consumer) {

                TraceContext.SpanState span = TraceContext.current();
                if (span != null) {
                    try {
                        client.flushLogs(span);
                    } catch (Exception ex) {
                        log.debug("[TraceFlow] Error flushing Kafka consumer logs: {}", ex.getMessage());
                    } finally {
                        TraceContext.clear();
                    }
                }
            }
        };
    }

    private String extractTraceId(org.apache.kafka.clients.consumer.ConsumerRecord<?, ?> record) {
        org.apache.kafka.common.header.Header header =
                record.headers().lastHeader(TraceFlowKafkaProducerInterceptor.TRACE_ID_HEADER);
        if (header != null && header.value() != null) {
            return new String(header.value(), java.nio.charset.StandardCharsets.UTF_8);
        }
        return null; // TraceContext.start() auto-generates a new ID when null
    }
}
