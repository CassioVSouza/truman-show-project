import { describe, expect, it, vi } from "vitest";
import { ViewerApiClient } from "./client";
import { DEMO_EVENTS, DEMO_SNAPSHOT, DEMO_STATUS } from "./demoData";
import { evaluateTimeline } from "../state/timeline";

const staticHost = "https://static.example.dev";
const workerHost = "https://worker.example.dev";

describe("ViewerApiClient", () => {
  it("falls back to offline demo data when no API base is configured", async () => {
    const client = new ViewerApiClient();
    const feed = await client.fetchSnapshotFeed();
    expect(feed.state).toBe("demo");
    expect(feed.snapshot?.v).toBe(1);
    expect(feed.events.length).toBeGreaterThan(0);

    const status = await client.getStatus();
    expect(status.demo).toBe(true);
    expect(status.data.status).toBe("running");

    const search = await client.search({ q: "hearth" });
    expect(search.demo).toBe(true);
    expect(search.data.results.length).toBeGreaterThan(0);

    const ctx = await client.getContext(102);
    expect(ctx.demo).toBe(true);
    expect(ctx.data?.entry.id).toBe(102);
  });

  it("loads one static bundle and renders a mid-action arrival", async () => {
    const calls: Array<{ url: string; method: string; cache?: RequestCache }> = [];
    const now = Date.now();
    const walk = DEMO_EVENTS.find((event) => event.kind === "walk")!;
    const snapshot = { ...DEMO_SNAPSHOT, generated_at: new Date(now - 5_000).toISOString() };
    const events = [
      {
        ...walk,
        t_start: new Date(now - 5_000).toISOString(),
        t_end: new Date(now + 5_000).toISOString(),
      },
    ];
    const fetchImpl: typeof fetch = vi.fn(async (input, init) => {
      const url = String(input);
      calls.push({ url, method: init?.method ?? "GET", cache: init?.cache });
      return Response.json({ snapshot, events, status: DEMO_STATUS });
    });

    const client = new ViewerApiClient({
      apiBase: workerHost,
      snapshotBase: `${staticHost}/`,
      fetchImpl,
    });
    const feed = await client.fetchSnapshotFeed();
    expect(feed.state).toBe("live");
    expect(feed.snapshot?.seq).toBe(snapshot.seq);
    expect(feed.status).toEqual(DEMO_STATUS);
    expect(calls).toEqual([{ url: `${staticHost}/live.json`, method: "GET", cache: "no-cache" }]);
    const frame = evaluateTimeline(feed.snapshot!, feed.events, now);
    expect(frame.midAction).toBe(true);
    expect(frame.poseAnim).toBe("walk");
    expect(frame.pose).not.toEqual(snapshot.resident.pose);
  });

  it("reports missing static data without querying the Worker or showing the demo", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response("missing", { status: 404 }));
    const client = new ViewerApiClient({
      apiBase: workerHost,
      snapshotBase: staticHost,
      fetchImpl,
    });

    await expect(client.fetchSnapshotFeed()).resolves.toMatchObject({
      state: "unavailable",
      snapshot: null,
      events: [],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${staticHost}/live.json`);
  });

  it("retains the complete last good bundle across corrupt and regressed CDN responses", async () => {
    const snapshot = { ...DEMO_SNAPSHOT, generated_at: new Date().toISOString() };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ snapshot, events: DEMO_EVENTS, status: DEMO_STATUS }))
      .mockResolvedValueOnce(
        Response.json({ snapshot, events: [{ kind: "invalid" }], status: DEMO_STATUS }),
      )
      .mockResolvedValueOnce(
        Response.json({
          snapshot: { ...snapshot, seq: snapshot.seq - 1 },
          events: [],
          status: DEMO_STATUS,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          snapshot: { ...snapshot, seq: snapshot.seq + 1 },
          events: [],
          status: DEMO_STATUS,
        }),
      );
    const client = new ViewerApiClient({
      apiBase: workerHost,
      snapshotBase: staticHost,
      fetchImpl,
    });

    expect((await client.fetchSnapshotFeed()).state).toBe("live");
    for (let count = 0; count < 2; count++) {
      const delayed = await client.fetchSnapshotFeed();
      expect(delayed.state).toBe("stale");
      expect(delayed.snapshot?.seq).toBe(snapshot.seq);
      expect(delayed.events).toEqual(DEMO_EVENTS);
    }
    const recovered = await client.fetchSnapshotFeed();
    expect(recovered.state).toBe("live");
    expect(recovered.snapshot?.seq).toBe(snapshot.seq + 1);
    expect(recovered.events).toEqual([]);
    expect(fetchImpl.mock.calls.every(([url]) => url === `${staticHost}/live.json`)).toBe(true);
  });

  it("flags an old live bundle as delayed and keeps an old terminal bundle replayable", async () => {
    const snapshot = {
      ...DEMO_SNAPSHOT,
      generated_at: new Date(Date.now() - 21 * 60_000).toISOString(),
    };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ snapshot, events: [], status: DEMO_STATUS }))
      .mockResolvedValueOnce(
        Response.json({
          snapshot: { ...snapshot, status: "dead" },
          events: [],
          status: { ...DEMO_STATUS, status: "dead" },
        }),
      )
      .mockRejectedValueOnce(new Error("network down"));
    const client = new ViewerApiClient({
      apiBase: workerHost,
      snapshotBase: staticHost,
      fetchImpl,
    });

    expect((await client.fetchSnapshotFeed()).state).toBe("stale");
    for (let count = 0; count < 2; count++) {
      const memorial = await client.fetchSnapshotFeed();
      expect(memorial.state).toBe("live");
      expect(memorial.snapshot?.status).toBe("dead");
    }
  });

  it("keeps missing live context unavailable", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response("not found", { status: 404 }));
    const client = new ViewerApiClient({
      apiBase: workerHost,
      snapshotBase: staticHost,
      fetchImpl,
    });
    expect(await client.getContext(102)).toEqual({ data: null, demo: false });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${workerHost}/api/context/102`);
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
    expect(feed.state).toBe("demo");
    expect(feed.snapshot?.v).toBe(1);
  });
});
