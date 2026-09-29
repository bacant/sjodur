package io.sjodur.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * One log line per API request (method, path, status, duration) with the user id in the MDC,
 * and the trace id echoed as X-Trace-Id so the frontend and support can correlate.
 *
 * Runs after the security filter chain (order 0 > -100), so the authenticated user is known.
 * Trace ids themselves come from Micrometer Tracing: it continues the W3C traceparent the
 * frontend server sends and puts traceId/spanId into the MDC for every log line.
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE - 10)
public class RequestLoggingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger("http.request");

    public RequestLoggingFilter() {
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long start = System.nanoTime();
        String userId = currentUserId();
        if (userId != null) MDC.put("user.id", userId);
        String traceId = currentTraceId();
        if (traceId != null) response.setHeader("X-Trace-Id", traceId);
        try {
            chain.doFilter(request, response);
        } finally {
            long durationMs = (System.nanoTime() - start) / 1_000_000;
            int status = response.getStatus();
            String line = "{} {} -> {} ({} ms)";
            Object[] args = {request.getMethod(), request.getRequestURI(), status, durationMs};
            if (status >= 500) log.error(line, args);
            else if (status >= 400) log.warn(line, args);
            else log.info(line, args);
            MDC.remove("user.id");
        }
    }

    private static String currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication instanceof JwtAuthenticationToken jwt ? jwt.getToken().getSubject() : null;
    }

    private static String currentTraceId() {
        return MDC.get("traceId");
    }
}
