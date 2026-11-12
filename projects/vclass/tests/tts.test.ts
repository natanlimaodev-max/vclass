import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

function ttsRequest() {
  return new NextRequest("http://localhost/api/tts", {
    method: "POST",
    body: JSON.stringify({ text: "こんにちは" }),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/tts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("falls back to a premade voice when the configured one needs a paid plan", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "sk_test");
    vi.stubEnv("ELEVENLABS_VOICE_ID", "library-voice");
    vi.stubEnv("RATE_LIMIT_PER_MINUTE", "0");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      calls.push(url);
      if (url.endsWith("/text-to-speech/library-voice")) {
        return new Response(JSON.stringify({ detail: { code: "paid_plan_required" } }), { status: 402 });
      }
      if (url.endsWith("/voices")) {
        return Response.json({ voices: [
          { voice_id: "library-voice", category: "professional" },
          { voice_id: "premade-1", name: "Sarah", category: "premade" },
        ] });
      }
      if (url.endsWith("/text-to-speech/premade-1")) return new Response(new Uint8Array([1, 2, 3]));
      return new Response("unexpected", { status: 500 });
    }));

    const { POST } = await import("@/app/api/tts/route");
    const res = await POST(ttsRequest());
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));

    // The chosen voice is reused without asking again.
    await POST(ttsRequest());
    expect(calls.filter((u) => u.endsWith("/voices"))).toHaveLength(1);
    expect(calls.at(-1)).toMatch(/premade-1$/);
  });

  it("explains the problem when no premade voice is available", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "sk_test");
    vi.stubEnv("RATE_LIMIT_PER_MINUTE", "0");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      url.endsWith("/voices")
        ? new Response("forbidden", { status: 401 })
        : new Response('{"detail":{"code":"paid_plan_required"}}', { status: 402 })
    ));

    const { POST } = await import("@/app/api/tts/route");
    const res = await POST(ttsRequest());
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/paid ElevenLabs plan/);
  });
});
