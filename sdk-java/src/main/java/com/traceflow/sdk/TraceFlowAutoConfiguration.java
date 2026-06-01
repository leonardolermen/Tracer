package com.traceflow.sdk;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.core.Ordered;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;

/**
 * TraceFlow Spring Boot Auto-Configuration.
 *
 * Activated automatically when traceflow-spring-boot-starter is on the classpath.
 * No @EnableTraceFlow annotation needed. No code changes required in the client.
 *
 * What gets registered automatically:
 *  - HTTP filter: captures request/response bodies, propagates trace context
 *  - Feign interceptor: propagates trace ID on outgoing HTTP calls (if Feign present)
 *  - Kafka BeanPostProcessor: injects trace ID into all outgoing Kafka messages and
 *    restores it on all incoming messages (if spring-kafka present)
 *
 * To disable: set traceflow.enabled=false in your application.yml.
 */
@AutoConfiguration
@ConditionalOnProperty(prefix = "traceflow", name = "enabled", havingValue = "true", matchIfMissing = true)
@EnableConfigurationProperties(TraceFlowProperties.class)
public class TraceFlowAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public TraceFlowClient traceFlowClient(TraceFlowProperties props) {
        // When an api-key is configured the collector derives the workspace from it,
        // so we don't send workspace_id. workspaceId is only a dev-mode fallback.
        boolean hasApiKey = props.getApiKey() != null && !props.getApiKey().isBlank();
        String workspaceId = hasApiKey ? null : props.getWorkspaceId();
        return new TraceFlowClient(props.getCollectorUrl(), workspaceId, props.getApiKey());
    }

    // ─── HTTP filter ──────────────────────────────────────────────────────────

    @Bean
    @ConditionalOnWebApplication
    public FilterRegistrationBean<TraceFlowFilter> traceFlowFilter(
            TraceFlowClient client,
            TraceFlowProperties props,
            @Value("${spring.application.name:unknown-service}") String appName) {

        String resolvedServiceName = props.getServiceName() != null
                ? props.getServiceName()
                : appName;

        FilterRegistrationBean<TraceFlowFilter> reg = new FilterRegistrationBean<>();
        reg.setFilter(new TraceFlowFilter(client, props, resolvedServiceName));
        reg.addUrlPatterns("/*");
        reg.setOrder(Ordered.HIGHEST_PRECEDENCE);
        reg.setName("traceFlowFilter");
        return reg;
    }

    // ─── Feign interceptor ────────────────────────────────────────────────────

    @Bean
    @ConditionalOnClass(name = "feign.RequestInterceptor")
    @ConditionalOnMissingBean
    public TraceFlowFeignInterceptor traceFlowFeignInterceptor() {
        return new TraceFlowFeignInterceptor();
    }

    // ─── Kafka trace propagation (zero client config required) ───────────────

    /**
     * Automatically instruments every DefaultKafkaProducerFactory and every
     * ConcurrentKafkaListenerContainerFactory in the application context.
     *
     * Activated only when spring-kafka is on the classpath.
     * The client does not need to modify their KafkaConfig or application.yml.
     */
    @Bean
    @ConditionalOnClass(ConcurrentKafkaListenerContainerFactory.class)
    @ConditionalOnMissingBean
    public TraceFlowKafkaBeanPostProcessor traceFlowKafkaBeanPostProcessor(
            TraceFlowClient client,
            TraceFlowProperties props,
            @Value("${spring.application.name:unknown-service}") String appName) {

        String resolvedServiceName = props.getServiceName() != null
                ? props.getServiceName()
                : appName;

        return new TraceFlowKafkaBeanPostProcessor(client, resolvedServiceName);
    }
}
