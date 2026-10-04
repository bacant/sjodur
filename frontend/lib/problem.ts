import { useI18n } from "vue-i18n";

/**
 * RFC 9457 problem details as the Spring backend sends them (see backend ApiExceptionHandler):
 * `code` and `params` are the machine-readable part the clients translate; `detail` is a
 * human-readable fallback in the language negotiated via Accept-Language.
 */
export interface Problem {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  instance?: string;
  /** Message key without the "problem." prefix, e.g. "not_found", "validation_failed". */
  code?: string;
  params?: Record<string, string | number>;
  /** Field errors for validation_failed: code without the "validation." prefix. */
  errors?: Array<{ field: string; code: string; params?: Record<string, string | number> }>;
  traceId?: string;
}

export async function readProblem(response: Response): Promise<Problem> {
  const traceId = response.headers.get("x-trace-id") ?? undefined;
  try {
    const body = (await response.json()) as Partial<Problem>;
    return { status: response.status, ...body, traceId: body.traceId ?? traceId };
  } catch {
    return { status: response.status, traceId };
  }
}

/** Translates problems and field errors with the shared catalog, falling back to the backend's text. */
export function useProblemText() {
  const { t, te } = useI18n();

  function messageFor(problem: Problem): string {
    const key = problem.code ? `problem.${problem.code}` : "";
    if (key && te(key)) return t(key, problem.params ?? {});
    if (problem.detail) return problem.detail;
    return t("problem.generic");
  }

  function fieldMessageFor(error: NonNullable<Problem["errors"]>[number]): string {
    const key = `validation.${error.code}`;
    return te(key) ? t(key, error.params ?? {}) : error.code;
  }

  function traceHintFor(problem: Problem): string | null {
    return problem.traceId ? t("problem.traceHint", { traceId: problem.traceId }) : null;
  }

  return { messageFor, fieldMessageFor, traceHintFor };
}
