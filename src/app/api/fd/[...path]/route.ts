import { mockResponseCode, mockSyntheticResponse, mockUpstreamPath } from "@/lib/api/mock-scenarios";
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

function parseJson(text: string): Record<string, unknown> | null {
  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function upstream(method: string, path: string, init: { body?: string; token?: string; extra?: HeadersInit; search?: string }) {
  const headers = new Headers({ accept: "application/json", ...init.extra });
  if (init.body) headers.set("content-type", "application/json");
  if (init.token) headers.set("authorization", `Bearer ${init.token}`);
  return fetch(`${BASE_URL}/${path}${init.search ?? ""}`, {
    method,
    headers,
    body: init.body,
    cache: "no-store",
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

  let body = method === "GET" || method === "HEAD" ? undefined : await req.text();
  const parsedBody = body ? parseJson(body) : null;

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

  let status: number;
  let data: Record<string, unknown> | null;

  const synthetic = MOCK ? mockSyntheticResponse(method, path, parsedBody) : undefined;
  if (synthetic) {
    status = synthetic.status;
    data = synthetic.body as Record<string, unknown>;
  } else {
    const mockCode = MOCK ? mockResponseCode(method, path, parsedBody) : undefined;
    let res: Response;
    try {
      res = await upstream(method, MOCK ? mockUpstreamPath(path) : path, {
        body,
        token: access,
        search: req.nextUrl.search,
        extra: mockCode ? { "x-mock-response-code": String(mockCode) } : undefined,
      });
    } catch {
      return NextResponse.json(
        { status: 502, code: "upstream_unreachable", title: "We couldn’t reach FraudDetection" },
        { status: 502 },
      );
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
