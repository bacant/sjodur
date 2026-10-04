package io.sjodur.security;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import io.sjodur.TestcontainersConfiguration;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.Date;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * Exercises the real security filter chain with tokens signed by a key generated for this test.
 * The auto-configured decoder (which would call Keycloak) backs off because a JwtDecoder bean
 * is provided here. TestcontainersConfiguration is the class Spring Initializr generated
 * (PostgreSQL for JPA); it needs Docker, like the rest of the integration tests.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class SecurityConfigTest {

    private static final String AUDIENCE = "sjodur-api";
    private static final RSAKey KEY = generateKey();

    @TestConfiguration(proxyBeanMethods = false)
    static class TestJwtDecoderConfiguration {
        @Bean
        JwtDecoder jwtDecoder() throws JOSEException {
            NimbusJwtDecoder decoder =
                    NimbusJwtDecoder.withPublicKey(KEY.toRSAPublicKey()).build();
            decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                    JwtValidators.createDefault(),
                    new JwtClaimValidator<Collection<String>>(
                            JwtClaimNames.AUD, aud -> aud != null && aud.contains(AUDIENCE))));
            return decoder;
        }
    }

    @Autowired
    private WebApplicationContext context;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();
    }

    @Test
    void anonymousRequestsAreRejected() throws Exception {
        mvc.perform(get("/api/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void publicEndpointsNeedNoToken() throws Exception {
        mvc.perform(get("/api/public/ping")).andExpect(status().isOk());
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }

    @Test
    void validTokenIsAcceptedAndRolesAreMapped() throws Exception {
        mvc.perform(get("/api/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(List.of("user"), AUDIENCE, Duration.ofMinutes(5))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sub").value("anna"))
                .andExpect(jsonPath("$.email").value("anna@example.com"))
                .andExpect(jsonPath("$.roles[0]").value("ROLE_USER"));
    }

    @Test
    void tokenForAnotherAudienceIsRejected() throws Exception {
        mvc.perform(get("/api/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(List.of("user"), "other-app", Duration.ofMinutes(5))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void expiredTokenIsRejected() throws Exception {
        mvc.perform(get("/api/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(List.of("user"), AUDIENCE, Duration.ofMinutes(-5))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void adminEndpointRequiresAdminRole() throws Exception {
        mvc.perform(get("/api/admin/ping")
                        .header(HttpHeaders.AUTHORIZATION, bearer(List.of("user"), AUDIENCE, Duration.ofMinutes(5))))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/ping")
                        .header(
                                HttpHeaders.AUTHORIZATION,
                                bearer(List.of("user", "admin"), AUDIENCE, Duration.ofMinutes(5))))
                .andExpect(status().isOk());
    }

    @Test
    void tokenWithWrongSignatureIsRejected() throws Exception {
        String forged = bearer(List.of("admin"), AUDIENCE, Duration.ofMinutes(5), generateKey());
        mvc.perform(get("/api/me").header(HttpHeaders.AUTHORIZATION, forged)).andExpect(status().isUnauthorized());
    }

    private static String bearer(List<String> roles, String audience, Duration validFor) throws JOSEException {
        return bearer(roles, audience, validFor, KEY);
    }

    /** Builds a token shaped like Keycloak's: realm roles under realm_access.roles, profile claims, audience. */
    private static String bearer(List<String> roles, String audience, Duration validFor, RSAKey key)
            throws JOSEException {
        Instant now = Instant.now();
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject("anna")
                .issuer("https://test-issuer.invalid/realms/sjodur")
                .audience(audience)
                .issueTime(Date.from(now.minusSeconds(1)))
                .expirationTime(Date.from(now.plus(validFor)))
                .claim("name", "Anna Beispiel")
                .claim("email", "anna@example.com")
                .claim("realm_access", Map.of("roles", roles))
                .build();
        SignedJWT jwt = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.getKeyID()).build(), claims);
        jwt.sign(new RSASSASigner(key));
        return "Bearer " + jwt.serialize();
    }

    private static RSAKey generateKey() {
        try {
            return new RSAKeyGenerator(2048).keyID("test-" + System.nanoTime()).generate();
        } catch (JOSEException e) {
            throw new IllegalStateException(e);
        }
    }
}
