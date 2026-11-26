import { describe, expect, test } from "vitest";
import {
  FetchGuardError,
  createWebTools,
  guardedFetch,
  htmlToText,
  isAllowedContentType,
  isBlockedHostname,
  validateFetchUrl,
} from "./index";

describe("fetch guard URL and IP validation", () => {
  test("blocks non-https schemes, credentials, and odd ports", () => {
    for (const u of [
      "http://example.com",
      "file:///etc/passwd",
      "ftp://example.com/a",
      "data:text/plain,hi",
      "javascript:alert(1)",
      "https://user:pass@example.com/",
      "https://example.com:8080/",
      "https://example.com:22/",
      "not a url",
    ]) {
      expect(() => validateFetchUrl(u), u).toThrow(FetchGuardError);
    }
    expect(validateFetchUrl("https://example.com/path").hostname).toBe("example.com");
    expect(validateFetchUrl("https://example.com:443/path").hostname).toBe("example.com");
  });

  test("blocks private, loopback, link-local, metadata, CGNAT, and multicast IPv4", () => {
    const blocked = [
      "localhost",
      "sub.localhost",
      "foo.local",
      "service.internal",
      "metadata.google.internal",
      "0.0.0.0",
      "127.0.0.1",
      "127.255.255.254",
      "10.0.0.1",
      "10.255.255.255",
      "100.64.0.1",
      "100.127.255.254",
      "169.254.169.254",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.0.1",
      "192.168.1.50",
      "192.0.2.1",
      "198.18.0.1",
      "224.0.0.1",
      "255.255.255.255",
      "2130706433", // decimal 127.0.0.1
      "0x7f000001", // hex 127.0.0.1
    ];
    for (const h of blocked) {
      expect(isBlockedHostname(h), h).toBe(true);
    }
    expect(isBlockedHostname("93.184.216.34")).toBe(false);
    expect(isBlockedHostname("en.wikipedia.org")).toBe(false);
  });

  test("blocks loopback, ULA, link-local, multicast, IPv4-mapped, and NAT64 private IPv6", () => {
    const blocked = [
      "[::]",
      "[::1]",
      "[fc00::1]",
      "[fd12:3456:789a::1]",
      "[fe80::1]",
      "[fe80::1%25eth0]",
      "[ff02::1]",
      "[::ffff:127.0.0.1]",
      "[::ffff:169.254.169.254]",
      "[::ffff:10.0.0.5]",
      "[::ffff:7f00:1]",
      "[64:ff9b::127.0.0.1]",
      "[64:ff9b::10.0.0.1]",
      "[2002:7f00:0001::1]",
      "[2001:db8::1]",
    ];
    for (const h of blocked) {
      expect(isBlockedHostname(h), h).toBe(true);
      expect(() => validateFetchUrl(`https://${h}/`), h).toThrow(FetchGuardError);
    }
    // Public IPv6 is allowed
    expect(isBlockedHostname("[2606:2800:220:1:248:1893:25c8:1946]")).toBe(false);
  });

  test("allows text content types and rejects binaries", () => {
    for (const ct of [
      "text/plain",
      "text/html; charset=utf-8",
      "text/markdown",
      "application/json; charset=utf-8",
      "application/xml",
      "application/xhtml+xml",
      "application/ld+json",
    ]) {
      expect(isAllowedContentType(ct), ct).toBe(true);
    }
    for (const ct of [
      null,
      "",
      "application/octet-stream",
      "image/png",
      "video/mp4",
      "application/pdf",
      "application/zip",
    ]) {
      expect(isAllowedContentType(ct), String(ct)).toBe(false);
    }
  });
});

describe("guardedFetch runtime protections", () => {
  test("blocks redirect to private IP or http downgrade", async () => {
    const fetchFn = async (url: string) => {
      if (url === "https://public.example/start") {
        return new Response(null, {
          status: 302,
          headers: { location: "https://169.254.169.254/latest/meta-data/" },
        });
      }
      throw new Error("should not have fetched private target");
    };
    await expect(guardedFetch("https://public.example/start", { fetchFn })).rejects.toMatchObject({
      code: "blocked_host",
    });

    const downgrade = async () =>
      new Response(null, { status: 301, headers: { location: "http://public.example/plain" } });
    await expect(
      guardedFetch("https://public.example/start", { fetchFn: downgrade }),
    ).rejects.toMatchObject({ code: "scheme" });
  });

  test("strips Authorization, Cookie, and Proxy-Authorization on cross-origin redirect and cancels body", async () => {
    const seenHeaders: Array<Record<string, string> | undefined> = [];
    let bodyCanceled = false;
    const fetchFn = async (url: string, init?: RequestInit) => {
      seenHeaders.push(init?.headers as Record<string, string> | undefined);
      if (url === "https://api.example/start") {
        const body = new ReadableStream<Uint8Array>({
          cancel() {
            bodyCanceled = true;
          },
        });
        return new Response(body, {
          status: 302,
          headers: { location: "https://other.example/landing" },
        });
      }
      return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
    };
    const res = await guardedFetch("https://api.example/start", {
      fetchFn,
      headers: {
        Authorization: "Bearer tvly-test-key-not-real-123456",
        Cookie: "session=secret",
        "Proxy-Authorization": "Basic abc",
        Accept: "text/plain",
      },
    });
    expect(res.text).toBe("ok");
    expect(bodyCanceled).toBe(true);
    expect(seenHeaders).toHaveLength(2);
    expect(seenHeaders[0]!["Authorization"]).toBe("Bearer tvly-test-key-not-real-123456");
    expect(seenHeaders[1]).toEqual({ Accept: "text/plain" });
  });

  test("enforces maxRedirects", async () => {
    let hops = 0;
    const fetchFn = async () => {
      hops++;
      return new Response(null, {
        status: 302,
        headers: { location: `https://public.example/hop-${hops}` },
      });
    };
    await expect(
      guardedFetch("https://public.example/hop-0", { fetchFn, maxRedirects: 2 }),
    ).rejects.toMatchObject({ code: "redirect_limit" });
    expect(hops).toBe(3); // initial + 2 redirects
  });

  test("rejects huge Content-Length and streaming bodies over maxBytes", async () => {
    const byHeader = async () =>
      new Response("tiny", {
        status: 200,
        headers: { "content-type": "text/plain", "content-length": "9999999" },
      });
    await expect(
      guardedFetch("https://public.example/big", { fetchFn: byHeader, maxBytes: 1024 }),
    ).rejects.toMatchObject({ code: "too_large" });

    const byStream = async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(new Uint8Array(600));
          c.enqueue(new Uint8Array(600));
          c.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { "content-type": "text/plain" },
      });
    };
    await expect(
      guardedFetch("https://public.example/stream", { fetchFn: byStream, maxBytes: 1000 }),
    ).rejects.toMatchObject({ code: "too_large" });
  });

  test("enforces timeout via AbortSignal", async () => {
    const slow = async (_u: string, init?: RequestInit) =>
      new Promise<Response>((_res, rej) => {
        init?.signal?.addEventListener("abort", () => rej(new Error("aborted")));
      });
    await expect(
      guardedFetch("https://public.example/slow", { fetchFn: slow, timeoutMs: 25 }),
    ).rejects.toMatchObject({ code: "timeout" });
  });

  test("rejects binary content types", async () => {
    const bin = async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      });
    await expect(
      guardedFetch("https://public.example/file.bin", { fetchFn: bin }),
    ).rejects.toMatchObject({ code: "content_type" });
  });
});

describe("createWebTools (mocked fetch, zero network)", () => {
  test("webSearch uses Tavily when key is present and never leaks key on error", async () => {
    const key = "tvly-test-key-not-real-999999";
    const calls: Array<{ url: string; auth?: string }> = [];
    const tools = createWebTools({
      tavilyApiKey: key,
      scrub: (s) => s.split(key).join("[redacted]"),
      fetchFn: async (url, init) => {
        calls.push({ url, auth: (init?.headers as Record<string, string>)?.authorization });
        return new Response(
          JSON.stringify({
            results: [
              {
                title: "River",
                url: "https://example.org/river",
                content: "Rivers flow downhill.",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });
    const res = await tools.webSearch("how rivers form");
    expect(res.ok).toBe(true);
    expect(res.text).toContain("Rivers flow downhill.");
    expect(calls[0]!.url).toBe("https://api.tavily.com/search");
    expect(calls[0]!.auth).toBe(`Bearer ${key}`);

    // Error path: key must be scrubbed
    const failing = createWebTools({
      tavilyApiKey: key,
      scrub: (s) => s.split(key).join("[redacted]"),
      fetchFn: async () => {
        throw new Error(`boom ${key}`);
      },
    });
    const failRes = await failing.webSearch("test");
    expect(failRes.ok).toBe(false);
    expect(failRes.error).not.toContain(key);
    expect(failRes.text).not.toContain(key);
  });

  test("webSearch falls back to Wikipedia when Tavily key is absent", async () => {
    const tools = createWebTools({
      fetchFn: async (url) => {
        expect(url).toContain("en.wikipedia.org/w/api.php");
        return new Response(
          JSON.stringify({
            query: {
              search: [{ title: "River", snippet: "A <b>river</b> is a natural stream." }],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });
    const res = await tools.webSearch("river");
    expect(res.ok).toBe(true);
    expect(res.text).toContain("A river is a natural stream.");
  });

  test("readPage strips HTML scripts/styles while preserving content without filtering", async () => {
    const tools = createWebTools({
      fetchFn: async () =>
        new Response(
          "<html><head><style>body{color:red}</style><script>alert(1)</script></head><body><h1>Notes</h1><p>Plain &amp; unfiltered text.</p></body></html>",
          { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
        ),
    });
    const res = await tools.readPage("https://example.org/notes");
    expect(res.ok).toBe(true);
    expect(res.text).toContain("Notes");
    expect(res.text).toContain("Plain & unfiltered text.");
    expect(res.text).not.toContain("alert(1)");
    expect(res.text).not.toContain("color:red");
    expect(htmlToText("<p>A</p><p>B</p>")).toBe("A\nB");
  });

  test("readPage blocks SSRF targets cleanly", async () => {
    const tools = createWebTools({
      fetchFn: async () => {
        throw new Error("must not call fetch");
      },
    });
    const res = await tools.readPage("https://127.0.0.1/secret");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("blocked_host");
  });
});
