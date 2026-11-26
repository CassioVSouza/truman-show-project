import { describe, expect, it, vi } from "vitest";
import { ViewerBeat, getViewerToken } from "./viewerBeat";

const mk = (over: Partial<ConstructorParameters<typeof ViewerBeat>[0]> = {}) => {
  const onCount = vi.fn();
  return {
    onCount,
    deps: {
      apiBase: "https://w.dev",
      token: "a".repeat(32),
      isVisible: () => true,
      onCount,
      ...over,
    },
  };
};

describe("viewer token", () => {
  it("is stable and matches the contract", () => {
    const m = new Map<string, string>();
    const store = {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
    };
    const a = getViewerToken(store);
    expect(a).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
    expect(getViewerToken(store)).toBe(a);
  });
});

describe("ViewerBeat", () => {
  it("posts the token as text/plain and reports the count", async () => {
    const fetchFn = vi.fn(
      async () => new Response(JSON.stringify({ viewers: 3 }), { status: 200 }),
    );
    const { deps, onCount } = mk({ fetchFn: fetchFn as unknown as typeof fetch });
    await new ViewerBeat(deps).beat();
    const call = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe("https://w.dev/api/viewers/beat");
    expect(call[1].body).toBe("a".repeat(32));
    expect(onCount).toHaveBeenCalledWith(3);
  });
  it("skips when hidden or in demo mode", async () => {
    const fetchFn = vi.fn();
    await new ViewerBeat(mk({ isVisible: () => false, fetchFn: fetchFn as never }).deps).beat();
    await new ViewerBeat(mk({ apiBase: "", fetchFn: fetchFn as never }).deps).beat();
    expect(fetchFn).not.toHaveBeenCalled();
  });
  it("honours retry-after on 429 and swallows errors", async () => {
    let t = 0;
    const fetchFn = vi.fn(
      async () => new Response("", { status: 429, headers: { "retry-after": "120" } }),
    );
    const b = new ViewerBeat(mk({ fetchFn: fetchFn as never, now: () => t }).deps);
    await b.beat();
    t = 60_000;
    await b.beat();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    t = 121_000;
    await b.beat();
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const boom = vi.fn(async () => {
      throw new Error("x");
    });
    await expect(
      new ViewerBeat(mk({ fetchFn: boom as never }).deps).beat(),
    ).resolves.toBeUndefined();
  });
});
