import { LiveFeed } from "@truman/contracts";
import { describe, expect, test } from "vitest";
import type { FetchLike } from "../llm";
import { genesis } from "../tick";
import { createSnapshotPublisher } from "./index";
import { makePagesSnapshotWriter, type PagesSnapshotEnv } from "./pages";

const ACCOUNT = "0123456789abcdef0123456789abcdef";
const PROJECT = "truman-live-feed";
const TOKEN = "cf-test-token-not-real-123456";
const JWT = "eyJhbGciOiJIUzI1NiJ9.test-upload-jwt-not-real.sig";

const pagesEnv: PagesSnapshotEnv = {
  SNAPSHOT_PAGES_ACCOUNT_ID: ACCOUNT,
  SNAPSHOT_PAGES_PROJECT: PROJECT,
  SNAPSHOT_PAGES_TOKEN: TOKEN,
};

async function sampleFeed(): Promise<LiveFeed> {
  const started = new Date("2026-11-26T12:00:00.000Z");
  let captured: LiveFeed | undefined;
  await createSnapshotPublisher(
    async () => [],
    async (feed) => {
      captured = LiveFeed.parse(feed);
    },
  )({
    started,
    tickMinutes: 10,
    tickId: 110,
    mind: genesis(17, started.getTime() - 60_000),
    mode: "normal",
    status: "running",
    phase: "unaware",
    lastTickAt: started.toISOString(),
  });
  return captured!;
}

/** Wraps a mock fetch to enforce Cloudflare Workers (workerd) redirect constraints. */
function workerdFetch(handler: FetchLike): FetchLike {
  return async (url, init) => {
    if (init?.redirect === "error") {
      throw new TypeError(
        'The "redirect" field on "RequestInitializerDict" cannot be set to "error".',
      );
    }
    return handler(url, init);
  };
}

describe("makePagesSnapshotWriter", () => {
  test("returns undefined when Pages snapshot env vars are all absent", () => {
    expect(makePagesSnapshotWriter({})).toBeUndefined();
  });

  test("rejects partial or malformed Pages snapshot configuration", async () => {
    const writer = makePagesSnapshotWriter({ SNAPSHOT_PAGES_ACCOUNT_ID: "bad" });
    expect(writer).toBeDefined();
    await expect(writer!(await sampleFeed())).rejects.toThrow(
      "invalid Pages snapshot publishing configuration",
    );
  });

  test("publishes via Direct Upload using redirect: manual and base64: true", async () => {
    const calls: Array<{ url: string; method: string; auth: string | null; redirect?: string }> =
      [];
    let uploadedKey = "";
    let uploadedValue = "";
    let uploadedBase64: unknown;
    let uploadedContentType: unknown;
    let upsertedHashes: unknown;
    let deployForm: FormData | undefined;

    const fetchFn = workerdFetch(async (url, init) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url,
        method: init?.method ?? "GET",
        auth: headers.get("authorization"),
        redirect: init?.redirect,
      });

      if (url.endsWith(`/accounts/${ACCOUNT}/pages/projects/${PROJECT}/upload-token`)) {
        return Response.json({ success: true, result: { jwt: JWT } });
      }
      if (url.endsWith("/pages/assets/upload")) {
        const body = JSON.parse(String(init?.body)) as Array<Record<string, unknown>>;
        expect(body).toHaveLength(1);
        uploadedKey = String(body[0]?.["key"]);
        uploadedValue = String(body[0]?.["value"]);
        uploadedBase64 = body[0]?.["base64"];
        uploadedContentType = (body[0]?.["metadata"] as Record<string, unknown>)?.["contentType"];
        return Response.json({ success: true, result: null });
      }
      if (url.endsWith("/pages/assets/upsert-hashes")) {
        upsertedHashes = JSON.parse(String(init?.body));
        return Response.json({ success: true, result: true });
      }
      if (url.endsWith(`/accounts/${ACCOUNT}/pages/projects/${PROJECT}/deployments`)) {
        deployForm = init?.body as FormData;
        return Response.json({ success: true, result: { id: "dep-1" } });
      }
      throw new Error(`unexpected url: ${url}`);
    });

    const writer = makePagesSnapshotWriter(pagesEnv, fetchFn);
    expect(writer).toBeDefined();
    const feed = await sampleFeed();
    await writer!(feed);

    expect(calls).toEqual([
      {
        url: `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/pages/projects/${PROJECT}/upload-token`,
        method: "GET",
        auth: `Bearer ${TOKEN}`,
        redirect: "manual",
      },
      {
        url: "https://api.cloudflare.com/client/v4/pages/assets/upload",
        method: "POST",
        auth: `Bearer ${JWT}`,
        redirect: "manual",
      },
      {
        url: "https://api.cloudflare.com/client/v4/pages/assets/upsert-hashes",
        method: "POST",
        auth: `Bearer ${JWT}`,
        redirect: "manual",
      },
      {
        url: `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/pages/projects/${PROJECT}/deployments`,
        method: "POST",
        auth: `Bearer ${TOKEN}`,
        redirect: "manual",
      },
    ]);

    expect(uploadedKey).toMatch(/^[a-f0-9]{32}$/);
    expect(uploadedBase64).toBe(true);
    expect(uploadedContentType).toBe("application/json");
    const decoded = Buffer.from(uploadedValue, "base64").toString("utf8");
    expect(decoded).toBe(JSON.stringify(feed));
    expect(upsertedHashes).toEqual({ hashes: [uploadedKey] });

    expect(deployForm).toBeInstanceOf(FormData);
    expect(deployForm!.get("branch")).toBe("main");
    expect(deployForm!.get("manifest")).toBe(JSON.stringify({ "/live.json": uploadedKey }));
    const headersEntry = deployForm!.get("_headers");
    expect(headersEntry).toBeInstanceOf(Blob);
    expect(await (headersEntry as unknown as Blob).text()).toContain(
      "Access-Control-Allow-Origin: *",
    );
  });

  test("fails cleanly on 3xx redirect responses without following", async () => {
    const fetchFn = workerdFetch(async () => new Response(null, { status: 302 }));
    const writer = makePagesSnapshotWriter(pagesEnv, fetchFn)!;
    await expect(writer(await sampleFeed())).rejects.toThrow(
      "Pages snapshot authorization failed (unexpected redirect HTTP 302)",
    );
  });

  test("includes Cloudflare error code and message on non-OK API responses and redacts auth", async () => {
    const fetchFn = workerdFetch(async () =>
      Response.json(
        {
          success: false,
          errors: [{ code: 10000, message: `Authentication error for ${TOKEN}` }],
        },
        { status: 403 },
      ),
    );
    const writer = makePagesSnapshotWriter(pagesEnv, fetchFn)!;
    const err = await writer(await sampleFeed()).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe(
      "Pages snapshot authorization failed (HTTP 403): code 10000 Authentication error for [redacted]",
    );
    expect((err as Error).message).not.toContain(TOKEN);
  });

  test("includes Cloudflare error details when HTTP 200 returns success: false", async () => {
    const fetchFn = workerdFetch(async (url) => {
      if (url.endsWith("/upload-token")) {
        return Response.json({ success: true, result: { jwt: JWT } });
      }
      return Response.json({
        success: false,
        errors: [{ code: 8000013, message: `JWT rejected: ${JWT}` }],
      });
    });
    const writer = makePagesSnapshotWriter(pagesEnv, fetchFn)!;
    const err = await writer(await sampleFeed()).catch((e: Error) => e);
    expect((err as Error).message).toBe(
      "Pages snapshot asset upload failed: code 8000013 JWT rejected: [redacted]",
    );
    expect((err as Error).message).not.toContain(JWT);
  });

  test("includes error name and message when fetch throws, redacting auth", async () => {
    const fetchFn = workerdFetch(async () => {
      throw new TypeError(`network down for ${TOKEN}`);
    });
    const writer = makePagesSnapshotWriter(pagesEnv, fetchFn)!;
    const err = await writer(await sampleFeed()).catch((e: Error) => e);
    expect((err as Error).message).toBe(
      "Pages snapshot authorization request failed (TypeError: network down for [redacted])",
    );
    expect((err as Error).message).not.toContain(TOKEN);
  });
});
