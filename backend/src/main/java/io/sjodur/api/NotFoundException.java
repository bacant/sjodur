package io.sjodur.api;

import java.util.Map;

/** Thrown by services when an entity does not exist; becomes a 404 problem with code "not_found". */
public class NotFoundException extends RuntimeException {

    private final Map<String, ?> params;

    public NotFoundException(String what, Object id) {
        super(what + " " + id + " not found");
        this.params = Map.of("what", what, "id", String.valueOf(id));
    }

    public Map<String, ?> params() {
        return params;
    }
}
