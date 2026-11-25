# 05 - Free-Tier Budget and Degradation

> Free-tier numbers change often. Figures are **planning estimates from memory; verify each on the provider's pricing page before building** (Task 0). All limits are config.

## Services
| Need | Service | Notes |
|---|---|---|
| Compute + cron + API | Cloudflare Workers + Cron Triggers | Free CPU time per invocation is small; waiting on `fetch` is not CPU. Subrequest cap per invocation, so batch DB writes |
| Database | **Supabase** Postgres (free project) | ~500 MB DB, limited egress, **pauses after ~7 days of inactivity** (the 10-min ticks keep it active). FTS, pg_trgm, pgvector included. Connect from Workers via supabase-js (HTTPS) or Hyperdrive + postgres driver |
| Viewer | Cloudflare Pages | Free CDN |
| LLM | Gemini API free tier (primary), Groq free tier, Cloudflare Workers AI daily allowance | Model names and limits change; Provider adapter + fallback |
| Search / read | Tavily free credits (monthly), Wikipedia API, Jina Reader (rate limited without key) | Ration Tavily |
| Archive | **GitHub Releases** (decided) | Old LLM traces and monthly full export as compressed JSONL assets uploaded by a scheduled GitHub Action; keep each asset under the per-file release limit (~2 GB), split by month |
| Translation | Chrome on-device Translator API, Workers AI translation, MyMemory | Cached per entry |
| CI | GitHub Actions on a public repo | |

## Per-day plan (144 ticks)
- About half of ticks are rest/idle/journal. Active ticks use 1-2 LLM calls (Resident always, Interpreter only when meaningful).
- Target <= ~200 LLM calls/day total, <= ~40 searches, <= ~100 page fetches. Config: `MAX_LLM_CALLS_DAY`, `MAX_SEARCH_DAY`, `MAX_FETCH_DAY`, `TICK_MINUTES`.
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
Public data is edge-cached for seconds to a minute; the viewer polls events ~every 4 s and interpolates. Search is the only uncached-ish route (cached per normalized query, rate-limited at the edge) to protect Supabase egress.

## Things that would break "$0"
Paid LLM keys, always-on VMs, WebSocket-heavy Durable Objects, image/TTS generation APIs, direct browser access to Supabase from every spectator.
