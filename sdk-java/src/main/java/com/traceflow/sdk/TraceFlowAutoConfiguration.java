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

/**
 * TraceFlow Spring Boot Auto-Configuration.
 *
 * Activated automatically when traceflow-spring-boot-starter is on the classpath.
 * No @EnableTraceFlow annotation needed.
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
        return new TraceFlowClient(props.getCollectorUrl(), props.getWorkspaceId());
    }

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

    /**
     * Feign interceptor — only registered when Spring Cloud OpenFeign is present.
     * Propagates X-TraceFlow-Trace-Id across service boundaries automatically.
     */
    @Bean
    @ConditionalOnClass(name = "feign.RequestInterceptor")
    @ConditionalOnMissingBean
    public TraceFlowFeignInterceptor traceFlowFeignInterceptor() {
        return new TraceFlowFeignInterceptor();
    }
}
