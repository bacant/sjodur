package io.sjodur.i18n;

import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * Reads the shared message catalogs (frontend/locales/*.json, copied into the jar as
 * i18n/*.json by build.gradle) so backend and frontend translate from one source.
 *
 * Conventions (docs/i18n.md): dotted keys, named placeholders like {name}, plural forms as
 * separate keys. Missing keys fall back to the default locale, then to the key itself –
 * a visible marker instead of an exception in production.
 */
@Component
public class Messages {

    public static final Locale DEFAULT_LOCALE = Locale.GERMAN;
    public static final List<Locale> SUPPORTED_LOCALES = List.of(Locale.GERMAN, Locale.ENGLISH);

    private static final Pattern PLACEHOLDER = Pattern.compile("\\{([a-zA-Z0-9_]+)}");

    private final Map<String, Map<String, String>> catalogs = new HashMap<>();

    public Messages() {
        this(new JsonMapper());
    }

    Messages(JsonMapper mapper) {
        for (Locale locale : SUPPORTED_LOCALES) {
            catalogs.put(locale.getLanguage(), load(mapper, locale.getLanguage()));
        }
    }

    /** Translation for the current request's locale (Accept-Language, see LocaleConfig). */
    public String get(String key) {
        return get(key, Map.of());
    }

    public String get(String key, Map<String, ?> params) {
        return get(key, LocaleContextHolder.getLocale(), params);
    }

    public String get(String key, Locale locale, Map<String, ?> params) {
        String template = lookup(key, locale);
        return interpolate(template, params);
    }

    public boolean has(String key, Locale locale) {
        return catalogs.getOrDefault(supported(locale).getLanguage(), Map.of()).containsKey(key);
    }

    /** Maps any requested locale onto a supported one; unknown languages get the default. */
    public static Locale supported(Locale requested) {
        if (requested == null) return DEFAULT_LOCALE;
        return SUPPORTED_LOCALES.stream()
                .filter(l -> l.getLanguage().equals(requested.getLanguage()))
                .findFirst()
                .orElse(DEFAULT_LOCALE);
    }

    private String lookup(String key, Locale locale) {
        String language = supported(locale).getLanguage();
        String value = catalogs.getOrDefault(language, Map.of()).get(key);
        if (value == null) value = catalogs.getOrDefault(DEFAULT_LOCALE.getLanguage(), Map.of()).get(key);
        return value != null ? value : key;
    }

    static String interpolate(String template, Map<String, ?> params) {
        if (params == null || params.isEmpty() || template.indexOf('{') < 0) return template;
        Matcher matcher = PLACEHOLDER.matcher(template);
        StringBuilder out = new StringBuilder();
        while (matcher.find()) {
            Object value = params.get(matcher.group(1));
            matcher.appendReplacement(out, Matcher.quoteReplacement(value != null ? String.valueOf(value) : matcher.group()));
        }
        matcher.appendTail(out);
        return out.toString();
    }

    private static Map<String, String> load(JsonMapper mapper, String language) {
        ClassPathResource resource = new ClassPathResource("i18n/" + language + ".json");
        if (!resource.exists()) {
            throw new IllegalStateException("Message catalog i18n/" + language + ".json is missing – "
                    + "it is copied from frontend/locales by build.gradle (processResources)");
        }
        try (InputStream in = resource.getInputStream()) {
            @SuppressWarnings("unchecked")
            Map<String, Object> tree = mapper.readValue(in, Map.class);
            Map<String, String> flat = new LinkedHashMap<>();
            flatten("", tree, flat);
            return Collections.unmodifiableMap(flat);
        } catch (IOException e) {
            throw new IllegalStateException("Cannot read message catalog for " + language, e);
        }
    }

    private static void flatten(String prefix, Map<String, Object> node, Map<String, String> out) {
        for (Map.Entry<String, Object> entry : node.entrySet()) {
            String key = prefix.isEmpty() ? entry.getKey() : prefix + "." + entry.getKey();
            if (entry.getValue() instanceof Map<?, ?> child) {
                @SuppressWarnings("unchecked")
                Map<String, Object> typed = (Map<String, Object>) child;
                flatten(key, typed, out);
            } else {
                out.put(key, String.valueOf(entry.getValue()));
            }
        }
    }
}
