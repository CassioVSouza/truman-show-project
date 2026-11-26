# 05 - Free-Tier Budget and Degradation

> Free-tier numbers change often. Task 0 and its follow-up verified the figures below on **2026-11-25** by reading the official pages (Markdown versions of the docs pages) where marked VERIFIED. Items marked UNVERIFIED could not be confirmed from an official page. Re-check before relying on any single number. All limits are config.

## Verified limits (2026-11-25)
| Service | Verified free limit | Source |
|---|---|---|
| Workers requests | 100,000/day (resets 00:00 UTC; shared with Pages Functions); static asset requests free and unlimited | https://developers.cloudflare.com/workers/platform/limits/ |
| Workers CPU | VERIFIED again 2026-11-25: **10 ms per HTTP request and 10 ms per Cron Trigger**; waiting on network I/O is not CPU; 128 MB memory; 3 MB script | https://developers.cloudflare.com/workers/platform/limits/ |
| Workers subrequests | VERIFIED again 2026-11-25: **50 external per invocation** (+1,000 to Cloudflare services); every Supabase/LLM/search call counts | https://developers.cloudflare.com/workers/platform/limits/ , https://developers.cloudflare.com/changelog/post/2026-02-11-subrequests-limit/ |
| Cron Triggers | 5 per account; scheduled wall time up to 15 min | https://developers.cloudflare.com/workers/platform/limits/ |
| Pages | 500 Git builds/month, 1 concurrent, 20,000 files/site, 25 MiB/file. Static requests are free. See the Direct Upload probe below. | https://developers.cloudflare.com/pages/platform/limits/ |
| Workers AI | VERIFIED: 10,000 Neurons/day free on Workers Free. `@cf/meta/m2m100-1.2b` is listed at 31,050 neurons per M input and per M output tokens (roughly 150-300k tokens/day within the free allowance). VERIFIED: m2m100 is NOT in the 2026-11-20 deprecation batch (24 models, including llama-3.1-8b-instruct-fp8 and llama-3.2-1b/3b, now return 410). UNVERIFIED: that m2m100 is callable on the Free plan (a model catalog page once showed "Model not available"; test in Phase 0). Do not use deprecated LLMs as the Workers AI fallback; Cloudflare names `@cf/google/gemma-4-26b-a4b-it` and `@cf/qwen/qwen3.8-27b` as smaller-model replacements (neuron cost and Free access UNVERIFIED) | https://developers.cloudflare.com/workers-ai/platform/pricing/ , https://developers.cloudflare.com/changelog/post/2026-11-05-planned-model-deprecations/ , https://developers.cloudflare.com/workers-ai/models/m2m100-1.2b/ |
| Supabase Free | 500 MB DB; 5 GB egress (+5 GB cached); 60 direct connections, 200 pooler clients (Nano); pauses after 1 week of low activity, restore manual, data kept; real requests/DB activity count; no automatic backups | https://supabase.com/pricing , https://supabase.com/docs/guides/platform/compute-and-disk , https://supabase.com/kb/faqs/platform/free-project-pausing |
| Supabase egress counting | VERIFIED: egress is any data leaving the platform to a client, across Data API (PostgREST, shown as "Database Egress"), Storage, Realtime, Auth, Edge Functions and Supavisor. Worker reads through supabase-js/PostgREST count against the 5 GB uncached quota (Worker traffic is not exempt). Through the Supavisor pooler only pooler egress is counted (no double count). Over quota on Free: notice plus grace period under the Fair Use Policy | https://supabase.com/docs/guides/platform/manage-your-usage/egress |
| pgvector on Free | VERIFIED (docs): documented for all projects, enabled with `create extension vector with schema extensions`; docs state no plan restriction. Not yet tested on our project (Phase 0). PostgREST has no similarity operators: query through an SQL function called with `rpc()` | https://supabase.com/docs/guides/database/extensions/pgvector |
| Gemini API free | VERIFIED: the pricing page lists a "Free of charge" tier for Gemini 3.8 Flash, 3.6 Flash, 3.5 Flash-Lite, 3.1 Flash-Lite, 3 Flash Preview, 2.5 Flash, 2.5 Flash-Lite, 2.5 Pro and Gemma 4, among others. VERIFIED: limits are per project, RPD resets midnight Pacific, "not guaranteed", and the official docs publish NO per-model free RPM/RPD; they are only shown in AI Studio (https://aistudio.google.com/rate-limit). UNVERIFIED: exact free RPM/RPD per model (forum reports range from 20 to 1,000 RPD and changed repeatedly; treat as unknown, read AI Studio at setup, and let the governor adapt to 429s). **Free-tier content IS used to improve Google products; paid tier is not** (VERIFIED on the pricing page; accepted by owner, decision 22) | https://ai.google.dev/gemini-api/docs/rate-limits , https://ai.google.dev/gemini-api/docs/pricing |
| Groq free | VERIFIED: `llama-3.1-8b-instant` and `llama-3.3-70b-versatile` were shut down on 2026-08-16 for free and developer tiers (replacements `openai/gpt-oss-20b`, `openai/gpt-oss-120b`; `qwen/qwen3.6-27b` was itself deprecated 2026-09-14 for `qwen/qwen3.8-27b`). VERIFIED live table (base limits): `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b` each 30 RPM / 1K RPD / 8K TPM / 200K TPD; `openai/gpt-oss-safeguard-20b` 3 RPM / 1K RPD / 2K TPM / 200K TPD. The 8K TPM cap means prompts must stay small or fall through to another provider. Limits are org-level (exact values at console.groq.com/settings/limits). Groq retires models every few months: keep model IDs in config | https://console.groq.com/docs/rate-limits |
| Tavily | 1,000 credits/month, no card; basic search 1 credit, advanced 2; resets 1st of month; dev-rate limit on free | https://docs.tavily.com/documentation/api-credits , https://www.tavily.com/pricing |
| Jina Reader | VERIFIED (rate-limit page): `r.jina.ai` 20 RPM without key, 500 RPM with a free key; limits are tracked per key when a key is sent, so shared Worker IPs stop mattering. VERIFIED (Reader page and FAQ): every new key is auto-generated with 10M free tokens, no card stated; purchases (Stripe) only after the tokens are used up. Search endpoint `s.jina.ai` needs a key (100 RPM, 10,000 tokens per request). UNVERIFIED: whether the free tier is restricted to non-commercial use (reported; check terms). Fallback when tokens run out: keyless 20 RPM | https://jina.ai/api-dashboard/rate-limit , https://jina.ai/reader/ |
| MyMemory | 5,000 chars/day anonymous (per IP); 50,000/day with a valid `de` email; 500 bytes per request; shared Cloudflare IPs often exhausted | https://mymemory.translated.net/doc/usagelimits.php |
| GitHub Actions | Standard runners free and unlimited on public repos; 6 h per job; cache 10 GB; **scheduled workflows auto-disable after 60 days without repo activity**; min schedule 5 min, may be delayed or dropped | https://docs.github.com/en/actions/reference/limits , https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows |
| GitHub Releases | Each asset < 2 GiB, up to 1,000 assets per release, no total size or bandwidth limit | https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases |

### Design impacts found
1. **Workers Free CPU is 10 ms per cron tick.** Organism catch-up, perception, prompt building and JSON parsing must fit in 10 ms CPU or the tick fails (Error 1102). Needs a measured spike in Phase 0; fallback is moving heavy compute to a GitHub Actions cron (5 min minimum) that calls the DB directly.
2. **50 subrequests per invocation.** Every DB call, LLM call and search/fetch is one. Batch writes (one RPC per tick), cap calls per tick.
3. **Spectators vs 100,000 Worker requests/day.** Live viewers count (decision 42): one `POST /api/viewers/beat` per open visible tab every 60 s = 1,440 requests/day per tab held open 24 h (typical session of 30 min: 30). 10 concurrent viewers all day = 14,400/day (14% of quota); the viewer must stop beating when the tab is hidden and the Worker may answer `429`. DB cost: 1 RPC (1 subrequest) per beat, ~100 bytes egress, table holds one ~100-byte row per active viewer (UNLOGGED, pruned after 10 min), so rows/size stay negligible. If quota pressure appears, lengthen the interval (config, not code). Earlier note: Polling every ~4 s is about 21,600 requests/day per open viewer; ~5 viewers exhaust the quota and also stop the cron. Resolved by decision 22: public live state is served as static snapshot files (see Spectator and search scaling); do not route every poll through the Worker.
4. **Gemini free tier trains on prompts/outputs.** Accepted by the owner (decision 22): Resident text is public anyway. Groq and Workers AI remain fallbacks.
5. **Tavily 1,000/month is about 33/day**, below the old 40/day.
6. **GitHub scheduled workflows stop after 60 days idle**; keep commits flowing or add a keepalive.
7. **Supabase pause**: DB-touching ticks count as activity (stated as real requests); verify in the first week.
8. **Groq Llama 3.x are gone** (shut down 2026-08-16). Groq free is now about 1,000 RPD with an 8K TPM cap on gpt-oss/qwen models, and Gemini per-model free quotas are not published in the docs. The 200 LLM calls/day default is kept but is not proven; set it at setup from AI Studio and the Groq limits page.
9. **Workers AI deprecations (2026-11-20)** removed several LLMs; the fallback model must be a current one.
10. **Supabase egress**: Worker reads count against the 5 GB uncached quota. Keep tick reads small and cache public responses.

## Services
| Need | Service | Notes |
|---|---|---|
| Compute + cron + API | Cloudflare Workers + Cron Triggers | Free CPU is 10 ms per invocation (waiting on `fetch` is not CPU). 50 subrequests per invocation, so the tick commits **batched writes: one RPC per tick**. CPU is measured in Phase 0; **fallback: run heavy compute (organism/body catch-up) in a GitHub Actions cron** (5 min minimum, may be delayed) that talks to the DB directly |
| Database | **Supabase** Postgres (free project) | ~500 MB DB, limited egress, **pauses after ~7 days of inactivity** (the 10-min ticks keep it active). FTS, pg_trgm, pgvector included. Connect from Workers via supabase-js (HTTPS) or Hyperdrive + postgres driver |
| Viewer | Cloudflare Pages | Free CDN; live state comes from published static snapshot files, not the Worker |
| LLM | Gemini API free tier (primary; owner accepts that free-tier prompts/outputs may be used by Google, decision 22), Groq free tier and Cloudflare Workers AI allowance as fallbacks | Model names and limits change; Provider adapter + fallback |
| Search / read | Tavily free credits (monthly), Wikipedia API, Jina Reader (rate limited without key) | Ration Tavily |
| Archive | **GitHub Releases** (decided) | Old LLM traces and monthly full export as compressed JSONL assets uploaded by a scheduled GitHub Action; keep each asset under the per-file release limit (~2 GB), split by month |
| Translation | Chrome on-device Translator API, Workers AI translation, MyMemory | Cached per entry |
| CI | GitHub Actions on a public repo | |

## Per-day plan (144 ticks)
- About half of ticks are rest/idle/journal. Active ticks use 1-2 LLM calls (Resident always, Interpreter only when meaningful).
- Target <= ~200 LLM calls/day total, <= ~30 searches (Tavily 1,000/month), <= ~100 page fetches. Config defaults: `MAX_LLM_CALLS_DAY=200` (split across providers; Gemini Flash-Lite and Groq 8B each allow more per day than this, but per-model caps are unverified), `MAX_SEARCH_DAY=30`, `MAX_FETCH_DAY=100` (Jina keyless 20 RPM, spread over ticks), `TICK_MINUTES=10`, `MAX_EARLY_TICKS_DAY=12`.
- Organism step, sensation templating, atlas labeling, perception and logging are plain code: zero API cost.

## Survival adds ticks and calls
- Body/world catch-up is pure code at minute resolution (no API cost, but CPU: batch it, loops over elapsed minutes must stay within Worker CPU limits; long gaps use closed-form or coarse steps).
- **Early-wake ticks** for emergencies add calls: cap with `MAX_EARLY_TICKS_DAY` (default 12). Past the cap, reflexes and safe macro-action continuation handle the emergency.
- Long macro-actions (rest 4 h, gather 30 min) mean several 10-minute slots need no LLM call; actual decision rate is lower than 144/day.
- Because survival actions are frequent, the Interpreter call is skipped for routine ones (eating, drinking, tending fire) via rule tables.

## Governor modes (picked each tick)
| Mode | Trigger | Behaviour |
|---|---|---|
| `normal` | < 70% of any budget | Full pipeline |
| `thrifty` | 70-90% | Interval x2, Interpreter replaced by rule tables, no extra dream call |
| `reading_only` | search budget out | No `web_search`; re-read known pages, think, write |
| `idle` | LLM budget out or all providers failing | Engine-only life (pacing, sleeping); body still evolves; `status: degraded` |
| `hibernating` | admin kill / hard failures | Resident in bed, banner shown |
The 10-minute pace is kept whenever the budget allows; slowing happens only under quota pressure.

## Database growth ("log everything" vs 500 MB)
- LLM traces ~3 MB/day: keep 14 days full in Postgres, then archive to a GitHub Release as compressed JSONL, leaving a stub row (hash, tokens, `archived_ref` = release asset URL). A scheduled GitHub Action pulls data via a read-only DB role, uploads, then calls the Worker to confirm and prune.
- `organism_samples`: per tick; older than 30 days downsampled to hourly.
- Life entries (thoughts, journal, ideas...) are small, kept forever.
- Monthly full export to a GitHub Release so the story is always replayable.
- Governor watches DB size; at 80% it runs an early archive pass, at 90% it reports `degraded` rather than failing writes.

## Spectator and search scaling
Decisions 22, 23 and 36 place `live.json` on a dedicated Cloudflare Pages Direct Upload project. The viewer fetches the bundle and interpolates the timeline locally. Search, log pages, context and Lab stay on the Worker with edge caching and rate limits.

Cloudflare documents 500 Git builds per month on Free and treats Direct Upload as deployment of prebuilt assets. The Pages limits document deployment retention separately. See [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) and [Pages limits](https://developers.cloudflare.com/pages/platform/limits/).

Two synthetic Direct Uploads succeeded on 2026-11-26. The second replaced the first at the stable public URL, with cross-origin reads and a 30-second cache lifetime. Each upload used four Cloudflare API calls. A sustained run at 144 scheduled updates per day has yet to be verified. Track publication errors and CDN freshness during the 72 h soak. GitHub-hosted files remain the fallback (decision 23).

## Measured on Cloudflare (2026-11-26, real crons)
Worker `truman-worker`, Free plan, cron `*/10 * * * *`, version d573ce03 (preview_urls=false). Source: `wrangler tail --format json` plus `ticks` rows read via `supabase db query --read-only`.
- Earlier tick (00:10 UTC, version aaf5e74e): CPU 3 ms, wall 893 ms, 1 subrequest; failed with Supabase 403 (service_role lacked GRANT). Superseded by schema 0004.
- Successful tick (00:30 UTC, version d573ce03): CPU **2 ms** (Free limit 10 ms), wall **1016 ms**, outcome ok. `ticks` id 2, mode `skipped`, ok true, error `no_resident` (resident table is empty; the tick commits a logged skipped row). Tick id 1 (00:20 UTC) is the same.
- Phase 0 close-out tick (00:40 UTC, version 05b36757, first with the per-tick `log_entries` write): CPU **1 ms**, wall **1258 ms**, outcome ok. `ticks` id 3 (`skipped`, ok true, `no_resident`) and `log_entries` id 1 (kind `tick`, tick_id 3) were committed together. Confirmed on project ref suadfgpoprtormoomqyw.
- Redeploy with zod 4 + contracts fix (main 8b97de7, version 1fb3a16f, 2026-11-26 01:20 UTC cron): CPU **2 ms**, wall **1261 ms**, outcome ok, no exceptions. `ticks` id 7 (`skipped`, ok true, `no_resident`) and `log_entries` id 5 (kind `tick`, tick_id 7) committed. Confirmed on project ref suadfgpoprtormoomqyw.
- Subrequests: **3** by code inspection (`loadState` = GET resident + GET kv in parallel, `commitTick` = 1 RPC `tick_commit`); the tail JSON does not report a subrequest count. Limit 50.
- Caveat: this is the empty/skipped path (no LLM, search or fetch calls). A tick with a living resident adds provider calls and larger JSON, so re-measure once a resident exists.

## Things that would break "$0"
Paid LLM keys, always-on VMs, WebSocket-heavy Durable Objects, image/TTS generation APIs, direct browser access to Supabase from every spectator.
