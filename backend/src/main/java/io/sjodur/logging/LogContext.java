package io.sjodur.logging;

import java.util.ArrayList;
import java.util.List;
import org.slf4j.MDC;

/**
 * Scoped MDC values that show up in every log line of the block, matching the pattern in
 * logback-spring.xml:
 *
 * <pre>
 *   try (var ignored = LogContext.entity("Transaction", transaction.id())) {
 *       log.info("booked");            // ... [Transaction|8f1c...] TransactionService : booked
 *   }
 *
 *   try (var ignored = LogContext.file("import-" + importId)) {
 *       runImport();                   // additionally written to logs/sjodur.import-42.log
 *   }
 * </pre>
 *
 * Values are removed again on close, also when the block throws. Keys previously present
 * are restored, so nested scopes behave.
 */
public final class LogContext implements AutoCloseable {

    public static final String ENTITY = "entity";
    public static final String ENTITY_ID = "entity.id";
    public static final String LOG_FILE = "logfile";

    private final List<Runnable> restores = new ArrayList<>(2);

    private LogContext() {
    }

    public static LogContext entity(String type, Object id) {
        return new LogContext().put(ENTITY, type).put(ENTITY_ID, id == null ? null : String.valueOf(id));
    }

    /** Routes the block's log lines into an extra file named after {@code name} (letters, digits, '-' and '_' only). */
    public static LogContext file(String name) {
        if (!name.matches("[A-Za-z0-9_-]{1,80}")) {
            throw new IllegalArgumentException("log file name must match [A-Za-z0-9_-]{1,80}: " + name);
        }
        return new LogContext().put(LOG_FILE, name);
    }

    public LogContext put(String key, String value) {
        String previous = MDC.get(key);
        if (value == null) {
            MDC.remove(key);
        } else {
            MDC.put(key, value);
        }
        restores.add(0, () -> {
            if (previous == null) {
                MDC.remove(key);
            } else {
                MDC.put(key, previous);
            }
        });
        return this;
    }

    @Override
    public void close() {
        restores.forEach(Runnable::run);
        restores.clear();
    }
}
