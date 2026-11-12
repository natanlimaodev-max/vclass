import { NextRequest, NextResponse } from "next/server";
import { ValidationError } from "./shared";
import { UpstreamError } from "./openrouter";

export class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

// ── Rate limiting ────────────────────────────────────────────────
// Fixed one-minute window per client IP, kept in memory. Good enough for a
// single self-hosted instance; use a shared store (e.g. Redis) if you scale out.
const WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; reset: number }>();

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

export function rateLimit(req: NextRequest): void {
  const limit = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 60);
  if (!Number.isFinite(limit) || limit <= 0) return; // 0 disables it

  const now = Date.now();
  if (hits.size > 10_000) {
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }
  const key = clientIp(req);
  const entry = hits.get(key);
  if (!entry || entry.reset <= now) {
    hits.set(key, { count: 1, reset: now + WINDOW_MS });
    return;
  }
  entry.count++;
  if (entry.count > limit) throw new HttpError("Too many requests, slow down a little", 429);
}

// ── Input helpers ────────────────────────────────────────────────
export async function readJson<T = Record<string, unknown>>(req: NextRequest): Promise<T> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object") throw new Error();
    return body as T;
  } catch {
    throw new HttpError("Invalid JSON body", 400);
  }
}

export function requireText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim()) throw new HttpError(`'${field}' is required`, 400);
  if (value.length > maxLength) throw new HttpError(`'${field}' is too long (max ${maxLength})`, 400);
  return value;
}

/** Wrap a route handler: applies the rate limit and turns thrown errors into JSON responses. */
export function apiRoute(handler: (req: NextRequest) => Promise<Response>) {
  return async (req: NextRequest): Promise<Response> => {
    try {
      rateLimit(req);
      return await handler(req);
    } catch (err) {
      if (err instanceof HttpError || err instanceof UpstreamError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof ValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      console.error("Unhandled API error:", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
