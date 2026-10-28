import { mockAlertStream, mockFixture } from "@/lib/api/mock-fixtures";
import { mockRoute, mockSyntheticResponse, mockWant } from "@/lib/api/mock-scenarios";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Backend-for-frontend proxy to the FraudDetection App API.
 *
 * The browser calls /api/fd/<path>; this forwards to FD_API_BASE_URL/<path>.
 * Tokens never reach client JavaScript: responses that carry them are
 * stripped and the tokens are kept in httpOnly cookies. Requests get the
 * bearer token attached, and an expired 15-minute access token is refreshed
 * with the shift-long refresh token before forwarding.
 */

const BASE_URL = process.env.FD_API_BASE_URL;
const MOCK = process.env.FD_API_MOCK === "1";

const ACCESS_COOKIE = "fd_at";
const REFRESH_COOKIE = "fd_rt";
const TOKEN_FIELDS = ["access_token", "refresh_token", "token_type", "expires_in", "refresh_expires_in"];

type TokenSet = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_expires_in?: number;
};

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

function setTokens(res: NextResponse, tokens: TokenSet) {
  res.cookies.set(ACCESS_COOKIE, tokens.access_token, { ...cookieBase, maxAge: tokens.expires_in });
  if (tokens.refresh_token) {
    res.cookies.set(REFRESH_COOKIE, tokens.refresh_token, {
      ...cookieBase,
      maxAge: tokens.refresh_expires_in,
    });
  }
}

function clearTokens(res: NextResponse) {
  res.cookies.delete(ACCESS_COOKIE);
  res.cookies.delete(REFRESH_COOKIE);
}

/** Text fields of a multipart body (for the mock’s demo state; files are not read). */
async function formFields(body: ArrayBuffer, contentType: string) {
  try {
    const form = await new Response(body, { headers: { "content-type": contentType } }).formData();
    return Object.fromEntries(
      Array.from(form.entries()).map(([k, v]) => [k, typeof v === "string" ? v : { name: v.name, size: v.size }]),
    );
  } catch {
    return null;
  }
}

function parseJson(text: string): Record<string, unknown> | null {
  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function upstream(
  method: string,
  path: string,
  init: { body?: string | ArrayBuffer; contentType?: string; token?: string; extra?: HeadersInit; search?: string },
) {
  const headers = new Headers({ accept: "application/json", ...init.extra });
  if (init.body) headers.set("content-type", init.contentType ?? "application/json");
  if (init.token) headers.set("authorization", `Bearer ${init.token}`);
  return fetch(`${BASE_URL}/${path}${init.search ?? ""}`, {
    method,
    headers,
    body: init.body,
    cache: "no-store",
  });
}

/**
 * Mock only: the mock stream sends its example events and closes, which
 * would make EventSource reconnect every few seconds (and hit the mock’s rate
 * limit). Relay the events, then keep the connection open with heartbeats.
 */
function holdOpenAfter(body: ReadableStream<Uint8Array>, signal: AbortSignal) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        controller.enqueue(value);
      }
      controller.enqueue(encoder.encode("\n"));
      const heartbeat = setInterval(() => controller.enqueue(encoder.encode(": keep-alive\n\n")), 15_000);
      signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        controller.close();
      });
    },
  });
}

async function handle(req: NextRequest, ctx: RouteContext<"/api/fd/[...path]">) {
  if (!BASE_URL) {
    return NextResponse.json(
      { status: 500, code: "not_configured", title: "FD_API_BASE_URL is not set" },
      { status: 500 },
    );
  }

  const path = (await ctx.params).path.join("/");
  const method = req.method;
  const cookieOps: Array<(res: NextResponse) => void> = [];
  let access = req.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;

  // File uploads (multipart) pass through untouched; everything else is JSON.
  const contentType = req.headers.get("content-type") ?? "";
  const multipart = contentType.startsWith("multipart/form-data");
  let body: string | ArrayBuffer | undefined =
    method === "GET" || method === "HEAD" ? undefined : multipart ? await req.arrayBuffer() : await req.text();
  const parsedBody = typeof body === "string" ? parseJson(body) : multipart && body ? await formFields(body, contentType) : null;

  // The refresh token lives in a cookie; the client never sends it.
  if (path === "auth/refresh") body = JSON.stringify({ refresh_token: refresh ?? "" });

  // Access token expired but the shift session is still alive: refresh first.
  if (!access && refresh && !path.startsWith("auth/")) {
    const r = await upstream("POST", "auth/refresh", {
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (r.ok) {
      const tokens = (await r.json()) as TokenSet;
      access = tokens.access_token;
      cookieOps.push((res) => setTokens(res, tokens));
    } else {
      cookieOps.push(clearTokens);
    }
  }

  const mockStream = MOCK ? mockAlertStream(method, path) : undefined;
  if (mockStream !== undefined) {
    return new NextResponse(holdOpenAfter(new Response(mockStream).body!, req.signal), {
      headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform" },
    });
  }

  let status: number;
  let data: Record<string, unknown> | null;

  const synthetic = MOCK ? (mockSyntheticResponse(method, path, parsedBody) ?? mockFixture(method, path, parsedBody, req.nextUrl.searchParams)) : undefined;
  if (synthetic) {
    status = synthetic.status;
    data = synthetic.body as Record<string, unknown>;
  } else {
    const route = MOCK ? mockRoute(method, path, req.nextUrl.searchParams, mockWant(method, path, parsedBody)) : undefined;
    const mockHeaders: Record<string, string> = {};
    if (route?.code) mockHeaders["x-mock-response-code"] = String(route.code);
    if (route?.name) mockHeaders["x-mock-response-name"] = route.name;
    let res: Response;
    try {
      res = await upstream(method, route?.path ?? path, {
        body,
        contentType: multipart ? contentType : undefined,
        token: access,
        search: route?.search ?? req.nextUrl.search,
        extra: mockHeaders,
      });
    } catch {
      return NextResponse.json(
        { status: 502, code: "upstream_unreachable", title: "We couldn’t reach FraudDetection" },
        { status: 502 },
      );
    }
    if (res.ok && res.headers.get("content-type")?.includes("text/event-stream")) {
      const stream = MOCK && res.body ? holdOpenAfter(res.body, req.signal) : res.body;
      const response = new NextResponse(stream, {
        status: res.status,
        headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform" },
      });
      cookieOps.forEach((op) => op(response));
      return response;
    }
    status = res.status;
    data = parseJson(await res.text());
  }

  if (status >= 200 && status < 300 && data && typeof data.access_token === "string") {
    const tokens = data as unknown as TokenSet;
    cookieOps.push((res) => setTokens(res, tokens));
    data = Object.fromEntries(Object.entries(data).filter(([k]) => !TOKEN_FIELDS.includes(k)));
  }
  if (path === "auth/logout" || (status === 401 && data?.code === "session_expired")) {
    cookieOps.push(clearTokens);
  }

  const response =
    status === 204 || data === null
      ? new NextResponse(null, { status })
      : NextResponse.json(data, { status });
  cookieOps.forEach((op) => op(response));
  return response;
}

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
