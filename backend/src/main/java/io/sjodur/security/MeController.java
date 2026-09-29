package io.sjodur.security;

import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Small endpoints that make the security setup observable:
 * /api/me shows what the API knows about the caller, /api/public/ping needs no token,
 * /api/admin/ping needs the admin role.
 */
@RestController
@RequestMapping("/api")
class MeController {

    public record Me(String sub, String name, String email, List<String> roles) {}

    @GetMapping("/me")
    Me me(JwtAuthenticationToken authentication) {
        Jwt jwt = authentication.getToken();
        return new Me(
                jwt.getSubject(),
                jwt.getClaimAsString("name"),
                jwt.getClaimAsString("email"),
                authentication.getAuthorities().stream().map(GrantedAuthority::getAuthority).toList());
    }

    @GetMapping("/public/ping")
    Map<String, String> ping() {
        return Map.of("status", "ok");
    }

    @GetMapping("/admin/ping")
    @PreAuthorize("hasRole('ADMIN')")
    Map<String, String> adminPing() {
        return Map.of("status", "ok", "scope", "admin");
    }
}
