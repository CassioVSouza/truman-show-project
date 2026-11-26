import type { LiveFeed } from "@truman/contracts";
import type { FetchLike } from "../llm";
import type { SnapshotWriter } from "./index";

const CF_API = "https://api.cloudflare.com/client/v4";
const FEED_PATH = "/live.json";
const FEED_HEADERS = `${FEED_PATH}
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=30
`;
const PUBLISH_TIMEOUT_MS = 15_000;
const MAX_FEED_BYTES = 512 * 1024;

export interface PagesSnapshotEnv {
  SNAPSHOT_PAGES_ACCOUNT_ID?: string;
  SNAPSHOT_PAGES_PROJECT?: string;
  SNAPSHOT_PAGES_TOKEN?: string;
}

interface CloudflareResult {
  success: boolean;
  result?: unknown;
}

/** Direct Upload publishes one complete asset. Cloudflare retains earlier deployment URLs. */
export function makePagesSnapshotWriter(
  env: PagesSnapshotEnv,
  fetchFn: FetchLike = (url, init) => fetch(url, init),
): SnapshotWriter | undefined {
  const account = env.SNAPSHOT_PAGES_ACCOUNT_ID?.trim();
  const project = env.SNAPSHOT_PAGES_PROJECT?.trim();
  const token = env.SNAPSHOT_PAGES_TOKEN?.trim();
  if (!account && !project && !token) return undefined;

  return async (feed: LiveFeed) => {
    if (
      !account ||
      !/^[a-f0-9]{32}$/.test(account) ||
      !project ||
      !/^[a-z0-9][a-z0-9-]{0,62}$/.test(project) ||
      !token
    ) {
      throw new Error("invalid Pages snapshot publishing configuration");
    }
    const content = JSON.stringify(feed);
    const bytes = new TextEncoder().encode(content);
    if (bytes.length > MAX_FEED_BYTES) throw new Error("Pages snapshot exceeds the size limit");
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    const hash = Array.from(digest.subarray(0, 16), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    const projectPath = `/accounts/${account}/pages/projects/${project}`;
    const signal = AbortSignal.timeout(PUBLISH_TIMEOUT_MS);

    async function cf(
      path: string,
      auth: string,
      stage: string,
      init: RequestInit = {},
    ): Promise<unknown> {
      const headers = new Headers(init.headers);
      headers.set("authorization", `Bearer ${auth}`);
      let response: Response;
      try {
        response = await fetchFn(CF_API + path, { ...init, headers, signal, redirect: "error" });
      } catch {
        throw new Error(`Pages snapshot ${stage} request failed`);
      }
      if (!response.ok) throw new Error(`Pages snapshot ${stage} failed (HTTP ${response.status})`);
      const body = (await response.json().catch(() => undefined)) as CloudflareResult | undefined;
      if (body?.success !== true) throw new Error(`Pages snapshot ${stage} failed`);
      return body.result;
    }

    const upload = (await cf(`${projectPath}/upload-token`, token, "authorization")) as
      { jwt?: unknown } | undefined;
    if (typeof upload?.jwt !== "string" || !upload.jwt) {
      throw new Error("Pages snapshot authorization did not return an upload token");
    }

    const asset = {
      key: hash,
      value: content,
      metadata: { contentType: "application/json; charset=utf-8" },
      base64: false,
    };
    await cf("/pages/assets/upload", upload.jwt, "asset upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([asset]),
    });
    await cf("/pages/assets/upsert-hashes", upload.jwt, "asset registration", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hashes: [hash] }),
    });

    const deploy = new FormData();
    deploy.set("branch", "main");
    deploy.set("manifest", JSON.stringify({ [FEED_PATH]: hash }));
    deploy.set("_headers", new Blob([FEED_HEADERS]), "_headers");
    await cf(`${projectPath}/deployments`, token, "deployment", { method: "POST", body: deploy });
  };
}
