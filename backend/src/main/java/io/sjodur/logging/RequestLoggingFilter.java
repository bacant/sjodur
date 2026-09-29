package io.sjodur.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
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

/**
 * One log line per API request (method, path, status, duration), plus the MDC values the
 * logback pattern shows on every line of the request: client.ip and user.id. The trace id
 * comes from Micrometer Tracing (MDC "traceId", set before this filter runs) and is echoed
 * as X-Trace-Id so the frontend and support can correlate.
 *
 * Runs after the security filter chain, so the authenticated user is known.
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE - 10)
public class RequestLoggingFilter extends OncePerRequestFilter {

    public static final String CLIENT_IP = "client.ip";
    public static final String USER_ID = "user.id";

    private static final Logger log = LoggerFactory.getLogger("http.request");

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long start = System.nanoTime();
        MDC.put(CLIENT_IP, clientIp(request));
        String userId = currentUserId();
        if (userId != null) {
            MDC.put(USER_ID, userId);
        }
        String traceId = MDC.get("traceId");
        if (traceId != null) {
            response.setHeader("X-Trace-Id", traceId);
        }
        try {
            chain.doFilter(request, response);
        } finally {
            long durationMs = (System.nanoTime() - start) / 1_000_000;
            int status = response.getStatus();
            Object[] args = {request.getMethod(), request.getRequestURI(), status, durationMs};
            if (status >= 500) {
                log.error("{} {} -> {} ({} ms)", args);
            } else if (status >= 400) {
                log.warn("{} {} -> {} ({} ms)", args);
            } else {
                log.info("{} {} -> {} ({} ms)", args);
            }
            MDC.remove(USER_ID);
            MDC.remove(CLIENT_IP);
        }
    }

    /** First hop of X-Forwarded-For (set by the frontend server / reverse proxy), else the socket address. */
    static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private static String currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication instanceof JwtAuthenticationToken jwt ? jwt.getToken().getSubject() : null;
    }
}
