import { describe, expect, test } from "vitest";
import { SupabaseDb } from "../db/supabase";
import type { LlmProvider } from "../llm";
import { LogWriter } from "../log";
import { MemoryRows, runMindTick } from "../tick";
import { SimDb, makeAgent } from "../tick/testkit";
import { InMemoryLease } from "./modes";

const cfg = {
  supabaseUrl: "https://example.test",
  supabaseServiceKey: "test-key-not-real-service",
};

/** Simulates PostgREST atomic kv row locking for `key = 'lease'`. */
function makeKvFetch() {
  let row: { key: string; value: { holder: string | null; expires_at: string | null } } | null =
    null;
  const fetchFn = async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    if (url.includes("/rest/v1/kv") && method === "PATCH") {
      if (!row) return new Response(JSON.stringify([]), { status: 200 });
      // Release path: value->>holder=eq.<holder>
      const holderMatch = url.match(/value->>holder=eq\.([^&]+)/);
      if (holderMatch) {
        const expected = decodeURIComponent(holderMatch[1]!);
        if (row.value.holder === expected) {
          row = { key: "lease", value: body["value"] as { holder: null; expires_at: null } };
          return new Response(null, { status: 204 });
        }
        return new Response(null, { status: 204 });
      }
      // Acquire path: or=(value->>expires_at.is.null,value->>expires_at.lte.<nowIso>)
      const lteMatch = url.match(/expires_at\.lte\.([^)&]+)/);
      const nowIso = lteMatch ? decodeURIComponent(lteMatch[1]!) : "";
      const free = row.value.expires_at === null || row.value.expires_at <= nowIso;
      if (free) {
        row = { key: "lease", value: body["value"] as { holder: string; expires_at: string } };
        return new Response(JSON.stringify([row]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (url.includes("/rest/v1/kv") && method === "POST") {
      if (row) return new Response(JSON.stringify([]), { status: 200 });
      row = {
        key: String(body["key"]),
        value: body["value"] as { holder: string; expires_at: string },
      };
      return new Response(JSON.stringify([row]), { status: 201 });
    }
    return new Response("unexpected", { status: 404 });
  };
  return { fetchFn, getRow: () => row };
}

describe("SupabaseDb.createLease (atomic kv CAS)", () => {
  test("first acquire inserts, second overlapping acquire fails, release frees it, expired lease can be taken over", async () => {
    const { fetchFn, getRow } = makeKvFetch();
    const db1 = new SupabaseDb(cfg, fetchFn);
    const db2 = new SupabaseDb(cfg, fetchFn);
    const l1 = db1.createLease();
    const l2 = db2.createLease();
    const t0 = new Date("2026-11-26T12:00:00.000Z");

    expect(await l1.acquire("holder-1", t0, 60_000)).toBe(true);
    expect(getRow()?.value.holder).toBe("holder-1");

    // Overlapping acquire while TTL is active MUST fail
    expect(await l2.acquire("holder-2", new Date(t0.getTime() + 10_000), 60_000)).toBe(false);
    expect(getRow()?.value.holder).toBe("holder-1");

    // Wrong holder cannot release
    await l2.release("holder-2");
    expect(getRow()?.value.holder).toBe("holder-1");

    // Correct holder releases
    await l1.release("holder-1");
    expect(getRow()?.value.holder).toBeNull();

    // Now holder-2 can acquire in a single PATCH
    const before = db2.subrequests;
    expect(await l2.acquire("holder-2", new Date(t0.getTime() + 15_000), 60_000)).toBe(true);
    expect(db2.subrequests - before).toBe(1);

    // After expiry, holder-3 can take over without release
    expect(await l1.acquire("holder-3", new Date(t0.getTime() + 120_000), 60_000)).toBe(true);
    expect(getRow()?.value.holder).toBe("holder-3");
  });

  test("two overlapping runMindTick calls cannot both commit", async () => {
    const db = new SimDb();
    const lease = new InMemoryLease();
    let releaseSlow!: () => void;
    const slowGate = new Promise<void>((r) => {
      releaseSlow = r;
    });
    const inner = makeAgent(db);
    const slowProvider: LlmProvider = {
      id: "slow",
      model: "slow",
      complete: async (req) => {
        await slowGate;
        return inner.complete(req);
      },
    };
    const t0 = new Date("2026-11-26T12:00:00.000Z");

    const p1 = runMindTick({
      db,
      log: new LogWriter(),
      rows: new MemoryRows(),
      providers: [slowProvider],
      lease,
      now: () => t0,
    });
    // Wait a microtask so tick 1 holds the lease and is awaiting the LLM
    await new Promise((r) => setTimeout(r, 10));

    const r2 = await runMindTick({
      db,
      log: new LogWriter(),
      rows: new MemoryRows(),
      providers: [makeAgent(db)],
      lease,
      now: () => new Date(t0.getTime() + 5_000),
    });
    expect(r2.ran).toBe(false);
    expect(r2.reason).toBe("lease_held");
    expect(db.payloads).toHaveLength(0);

    releaseSlow();
    const r1 = await p1;
    expect(r1.ran).toBe(true);
    expect(db.payloads).toHaveLength(1);
    // Lease was released after tick 1 finished
    expect(lease.row).toBeNull();
  });

  test("a failing tick still releases the lease", async () => {
    const db = new SimDb();
    db.loadState = async () => {
      throw new Error("db down");
    };
    const lease = new InMemoryLease();
    await expect(
      runMindTick({
        db,
        log: new LogWriter(),
        rows: new MemoryRows(),
        providers: [],
        lease,
        now: () => new Date("2026-11-26T12:00:00.000Z"),
      }),
    ).rejects.toThrow("db down");
    expect(lease.row).toBeNull();
  });
});
