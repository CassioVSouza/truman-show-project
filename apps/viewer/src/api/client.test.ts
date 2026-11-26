import { describe, expect, it, vi } from "vitest";
import { ViewerApiClient } from "./client";
import { DEMO_EVENTS, DEMO_SNAPSHOT } from "./demoData";

describe("ViewerApiClient", () => {
  it("falls back to offline demo data when no API base is configured", async () => {
    const client = new ViewerApiClient();
    const feed = await client.fetchSnapshotFeed();
    expect(feed.demo).toBe(true);
    expect(feed.snapshot.v).toBe(1);
    expect(feed.events.length).toBeGreaterThan(0);

    const status = await client.getStatus();
    expect(status.demo).toBe(true);
    expect(status.data.status).toBe("running");

    const search = await client.search({ q: "hearth" });
    expect(search.demo).toBe(true);
    expect(search.data.results.length).toBeGreaterThan(0);

    const ctx = await client.getContext(102);
    expect(ctx.demo).toBe(true);
    expect(ctx.data.entry.id).toBe(102);
  });

  it("prefers static snapshot host when snapshotBase is configured (GET only)", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const fetchImpl: typeof fetch = vi.fn(async (input, init) => {
      const url = String(input);
      calls.push({ url, method: init?.method ?? "GET" });
      if (url.endsWith("/snapshot.json")) {
        return new Response(JSON.stringify(DEMO_SNAPSHOT), { status: 200 });
      }
      if (url.endsWith("/events.json")) {
        return new Response(JSON.stringify(DEMO_EVENTS), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    });

    const client = new ViewerApiClient({
      apiBase: "https://worker.example.dev",
      snapshotBase: "https://static.example.dev/",
      fetchImpl,
    });
    const feed = await client.fetchSnapshotFeed();
    expect(feed.demo).toBe(false);
    expect(feed.snapshot.seq).toBe(DEMO_SNAPSHOT.seq);
    expect(calls.every((c) => c.method === "GET")).toBe(true);
    expect(calls.map((c) => c.url)).toEqual([
      "https://static.example.dev/snapshot.json",
      "https://static.example.dev/events.json",
    ]);
  });

  it("queries Worker search, context, lab list, and translate endpoints with GET", async () => {
    const urls: string[] = [];
    const fetchImpl: typeof fetch = vi.fn(async (input, init) => {
      expect(init?.method).toBe("GET");
      const url = String(input);
      urls.push(url);
      if (url.includes("/api/search")) {
        return new Response(
          JSON.stringify({ results: [], next_before_id: null, next_before_rank: null }),
          { status: 200 },
        );
      }
      if (url.includes("/api/lab/organism")) {
        return new Response(JSON.stringify({ items: [{ id: 1 }], next_before: null }), {
          status: 200,
        });
      }
      if (url.includes("/api/translate")) {
        return new Response(
          JSON.stringify({
            entity: "journal",
            id: 5,
            lang: "pt",
            text: "Texto traduzido",
            engine: "cache",
            cached: true,
          }),
          { status: 200 },
        );
      }
      return new Response("not found", { status: 404 });
    });

    const client = new ViewerApiClient({ apiBase: "https://worker.example.dev/", fetchImpl });
    const searchRes = await client.search({ q: "river", category: "life", lang: "pt" });
    expect(searchRes.demo).toBe(false);

    const orgRes = await client.getList("organism", { lab: true, limit: 5 });
    expect(orgRes.demo).toBe(false);
    expect(orgRes.data.items).toHaveLength(1);

    const translated = await client.translateEntity("journal", 5);
    expect(translated).toBe("Texto traduzido");

    expect(urls[0]).toBe("https://worker.example.dev/api/search?q=river&category=life&lang=pt");
    expect(urls[1]).toBe("https://worker.example.dev/api/lab/organism?limit=5");
    expect(urls[2]).toBe("https://worker.example.dev/api/translate?entity=journal&id=5&lang=pt");
  });

  it("gracefully falls back to demo data if network fails", async () => {
    const fetchImpl: typeof fetch = vi.fn(async () => {
      throw new Error("network down");
    });
    const client = new ViewerApiClient({ apiBase: "https://offline.example.dev", fetchImpl });
    const feed = await client.fetchSnapshotFeed();
    expect(feed.demo).toBe(true);
    expect(feed.snapshot.v).toBe(1);
  });
});
