package io.sjodur.i18n;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Locale;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Plain unit test – no Spring context. Reads the catalogs copied by processResources. */
class MessagesTest {

    private final Messages messages = new Messages();

    @Test
    void translatesInBothLanguagesWithNamedPlaceholders() {
        assertThat(messages.get("problem.not_found", Locale.GERMAN, Map.of()))
                .isEqualTo("Der Eintrag wurde nicht gefunden.");
        assertThat(messages.get("problem.not_found", Locale.ENGLISH, Map.of()))
                .isEqualTo("The entry could not be found.");
        assertThat(messages.get("validation.size", Locale.ENGLISH, Map.of("min", 2, "max", 50)))
                .isEqualTo("Must be between 2 and 50 characters");
        assertThat(messages.get("problem.traceHint", Locale.GERMAN, Map.of("traceId", "abc")))
                .isEqualTo("Support-Kennung: abc");
    }

    @Test
    void fallsBackToDefaultLanguageAndThenToTheKey() {
        assertThat(messages.get("problem.generic", Locale.FRENCH, Map.of()))
                .isEqualTo(messages.get("problem.generic", Locale.GERMAN, Map.of()));
        assertThat(messages.get("does.not.exist", Locale.ENGLISH, Map.of())).isEqualTo("does.not.exist");
    }

    @Test
    void leavesUnknownPlaceholdersVisible() {
        assertThat(Messages.interpolate("Hello {name}, {missing}", Map.of("name", "Anna")))
                .isEqualTo("Hello Anna, {missing}");
    }

    @Test
    void mapsRegionalVariantsToSupportedLanguages() {
        assertThat(Messages.supported(Locale.forLanguageTag("de-AT"))).isEqualTo(Locale.GERMAN);
        assertThat(Messages.supported(Locale.forLanguageTag("en-US"))).isEqualTo(Locale.ENGLISH);
        assertThat(Messages.supported(Locale.JAPANESE)).isEqualTo(Locale.GERMAN);
    }
}
