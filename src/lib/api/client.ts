/**
 * Browser client for the FraudDetection App API, via the /api/fd proxy.
 * Errors follow RFC 9457 Problem Details with a stable `code`.
 */

export type Problem = {
  type?: string;
  title?: string;
  status: number;
  code?: string;
  detail?: string;
  request_id?: string;
  errors?: Array<{ field: string; message: string }>;
  [extra: string]: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly problem: Problem;

  constructor(problem: Problem) {
    super(problem.title ?? `Request failed (${problem.status})`);
    this.status = problem.status;
    this.code = problem.code;
    this.problem = problem;
  }
}

/** The request never reached the server (offline, VPN down, DNS). */
export class OfflineError extends Error {}

export async function apiFetch<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  if (typeof navigator !== "undefined" && !navigator.onLine) throw new OfflineError();

  let res: Response;
  try {
    res = await fetch(`/api/fd${path}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new OfflineError();
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError({ status: res.status, ...(data ?? {}) });
  return data as T;
}

export function isProblem(err: unknown, code: string): err is ApiError {
  return err instanceof ApiError && err.code === code;
}
