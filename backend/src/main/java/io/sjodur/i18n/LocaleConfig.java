package io.sjodur.i18n;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver;

/**
 * The request locale comes from Accept-Language. The web frontend sends the language the
 * user chose in the UI (frontend/lib/api.ts); browsers and the mobile app send their own.
 * Anything unsupported falls back to German.
 */
@Configuration
public class LocaleConfig {

    @Bean
    LocaleResolver localeResolver() {
        var resolver = new AcceptHeaderLocaleResolver();
        resolver.setSupportedLocales(Messages.SUPPORTED_LOCALES);
        resolver.setDefaultLocale(Messages.DEFAULT_LOCALE);
        return resolver;
    }
}
