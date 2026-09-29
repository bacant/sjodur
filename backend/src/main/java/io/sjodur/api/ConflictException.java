package io.sjodur.api;

import java.util.Map;

/** Optimistic-locking or duplicate conflicts; becomes a 409 problem with code "conflict". */
public class ConflictException extends RuntimeException {

    private final Map<String, ?> params;

    public ConflictException(String message) {
        this(message, Map.of());
    }

    public ConflictException(String message, Map<String, ?> params) {
        super(message);
        this.params = params;
    }

    public Map<String, ?> params() {
        return params;
    }
}
