package io.sjodur.api;

import io.sjodur.i18n.Messages;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Turns exceptions into RFC 9457 problem details with two layers:
 *  - machine-readable: "code" (+ "params", field "errors") – the message key without the
 *    "problem." / "validation." prefix, which every client translates with the shared catalog
 *  - human-readable: "title" and "detail" in the negotiated language, for clients that
 *    do not translate themselves (curl, integrations, error pages)
 * Plus the trace id so support can find the request in the logs.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    private final Messages messages;

    public ApiExceptionHandler(Messages messages) {
        this.messages = messages;
    }

    @ExceptionHandler(NotFoundException.class)
    ProblemDetail notFound(NotFoundException e) {
        return problem(HttpStatus.NOT_FOUND, "not_found", e.params());
    }

    @ExceptionHandler(ConflictException.class)
    ProblemDetail conflict(ConflictException e) {
        return problem(HttpStatus.CONFLICT, "conflict", e.params());
    }

    @ExceptionHandler(AccessDeniedException.class)
    ProblemDetail forbidden(AccessDeniedException e) {
        return problem(HttpStatus.FORBIDDEN, "forbidden", Map.of());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail validation(MethodArgumentNotValidException e) {
        List<Map<String, Object>> errors = e.getBindingResult().getFieldErrors().stream()
                .map(this::fieldError)
                .toList();
        ProblemDetail problem = problem(HttpStatus.BAD_REQUEST, "validation_failed", Map.of());
        problem.setProperty("errors", errors);
        return problem;
    }

    @ExceptionHandler(Exception.class)
    ProblemDetail unexpected(Exception e) {
        log.error("Unhandled exception", e);
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "generic", Map.of());
    }

    private ProblemDetail problem(HttpStatus status, String code, Map<String, ?> params) {
        ProblemDetail problem = ProblemDetail.forStatus(status);
        problem.setTitle(messages.get("problem.title"));
        problem.setDetail(messages.get("problem." + code, params));
        problem.setProperty("code", code);
        if (!params.isEmpty()) problem.setProperty("params", params);
        String traceId = MDC.get("traceId");
        if (traceId != null) problem.setProperty("traceId", traceId);
        return problem;
    }

    /** Bean Validation annotation → catalog key: @NotBlank → validation.required, @Size → validation.size … */
    private Map<String, Object> fieldError(FieldError error) {
        String constraint = error.getCode() == null ? "invalid" : error.getCode();
        String code = switch (constraint) {
            case "NotNull", "NotBlank", "NotEmpty" -> "required";
            case "Size", "Length" -> "size";
            case "Min", "DecimalMin", "Positive", "PositiveOrZero" -> "min";
            case "Max", "DecimalMax", "Negative", "NegativeOrZero" -> "max";
            case "Email" -> "email";
            default -> constraint.toLowerCase();
        };
        Map<String, Object> params = constraintParams(error);
        return Map.of(
                "field", error.getField(),
                "code", code,
                "params", params,
                "message", messages.get("validation." + code, params));
    }

    /** Extracts {min}, {max}, {value} from the constraint's arguments the way Bean Validation orders them. */
    private static Map<String, Object> constraintParams(FieldError error) {
        Object[] args = error.getArguments();
        if (args == null) return Map.of();
        return switch (error.getCode() == null ? "" : error.getCode()) {
            case "Size", "Length" -> args.length >= 3 ? Map.of("max", args[1], "min", args[2]) : Map.of();
            case "Min", "Max", "DecimalMin", "DecimalMax" -> args.length >= 2 ? Map.of("value", args[1]) : Map.of();
            default -> Map.of();
        };
    }
}
