# 02 - Architecture

## Overview
```
              Cloudflare Cron (every 3 min)
                         |
                         v
 +---------------- Worker "brain" -----------------+
 |  Tick pipeline (below)                          |
 |  LLMProvider adapter -> Gemini | Groq | WorkersAI|
 |  Tools -> search | Jina Reader | direct fetch    |
 |  Organism engine (hidden feelings, doc 08)       |
 +-------+---------------------------+--------------+
         | service_role writes       | reads
         v                           v
   Supabase Postgres  <----  Worker "api" (read-only, edge cached)
   log_entries, events,              ^
   memories, organism...             |
         |                    Cloudflare Pages: Viewer (Vite + Three.js)
         v                           ^
   GitHub Releases: archive of old   | public spectators
   traces (not R2: needs a card)     | (live feed = static snapshot files)
```
One Worker project serves cron and the read-only dynamic API. After a successful tick commit, the Worker publishes `live.json` to a separate Cloudflare Pages Direct Upload project (decisions 22, 23, 35 and 36). Snapshot reads use the Pages CDN. The browser reads dynamic data through the Worker. Admin routes need `ADMIN_TOKEN`.

## Time model
The server never simulates at 60 FPS. A tick produces a **timeline** of timestamped events across a three-minute window (walk path, sit, type, thought cue, body changes). The viewer replays and interpolates, so a visitor arriving mid-tick sees the Resident mid-action. Resident-authored text comes from the dynamic API on demand, where visibility flags apply. Deterministic idle behaviour fills gaps without an LLM call. The world clock runs at `TIME_SCALE` (default `4`, configurable `1..24`). At the default speed, four world days pass per real day and 12 world minutes pass per three-minute cron interval (decisions 44 and 47). Day/night, seasons, metabolism and actions advance in world minutes. The viewer uses event timestamps in real wall-clock time.

## Tick pipeline
1. **Lease** (row in `kv` with expiry) so overlapping runs do nothing.
2. **Governor**: daily budgets and mode (doc 05).
3. **Load**: resident row (hidden organism + physiology), recent decisions, plan, lessons.
3b. **World step**: advance environment (time, season, weather, temperature), resource regrowth and depletion, fires burning down, food spoiling.
4. **Body and organism step** (minute-resolution catch-up over the elapsed time, including any running macro-action): metabolism, hydration, thermoregulation, injuries, illness, health; then hidden affect/drives; apply reflexes (doc 10) and memory-reactivation from anything recalled. Critical thresholds can schedule an early extra tick.
5. **Perceive** (deterministic): visible entities, sounds, time of day, last tool result (untrusted).
6. **Sense**: physiology -> **sensation text + unnamed urges** (no labels, no numbers).
7. **Recall**: Postgres FTS + recency + importance + affective match to current body state (+ pgvector in phase 2).
8. **Decide (LLM call 1, Resident)**: prompt in doc 03 order. Output = `review` of last action (cause, expectation met, lesson, feeling in own words) + next `Action` (with intent and expectation).
9. **Engine**: validate, compute path/durations, apply deterministic consequences, write `caused_by` links.
10. **Tools**: search/fetch if needed; sanitize, cap size, mark untrusted.
11. **Interpret** (LLM call 2, hidden, only for meaningful stimuli; else rule tables): appraisal + factual consequences + prediction error.
12. **Organism update**: apply appraisal through temperament (sensitivity, habituation) -> new hidden state -> physiology -> emotion-atlas label for the Lab.
13. **Commit** in one transaction, as **one batched RPC per tick** (Workers Free allows 50 subrequests per invocation, so no per-row writes): `log_entries` (doc 09), `events`, memories (with appraisal + body snapshot), lessons, questions, goals, beliefs, `organism_samples`, `llm_traces`, `tool_calls`. Then publish `live.json` with the public snapshot and its matching timeline.
14. Release lease.

CPU: Workers Free gives 10 ms CPU per cron invocation (network waits excluded). Phase 0 measures real tick CPU; if the organism/body catch-up does not fit, heavy compute moves to a GitHub Actions cron (5 min minimum, may be delayed) that works on the database directly, and the Worker only makes the LLM/tool calls.
Budget: 1-2 LLM calls per active tick, 0 for sleep/idle ticks. Sleep ticks run dream synthesis (1 call) and emotional consolidation in code.

## Components
| Component | Responsibility | Package |
|---|---|---|
| Contracts | zod schemas, hidden vs Resident-facing split | `packages/contracts` |
| World | deterministic map, stations, waypoints, perception, day/night, seeded RNG | `packages/world` |
| Organism | appraisal->state->physiology, temperament, habituation, sensation templating, emotion atlas | `packages/organism` |
| Body & survival | metabolism, hydration, thermoregulation, injury, illness, health, skills, reflexes, death | `packages/body` |
| Environment & resources | seasons, weather, temperature, resource nodes, regrowth, items, inventory | `packages/world` |
| LLM adapter | providers, fallback, JSON mode, refusal handling, traces | `apps/worker/src/llm` |
| Prompts | persona (yours, pending), decide, interpreter, dream; leak test | `apps/worker/src/prompts` |
| Memory | store, recall (affective), consolidate, lessons | `apps/worker/src/memory` |
| Tools | search, read page, fetch guard | `apps/worker/src/tools` |
| Governor | quotas, mode, kill switch | `apps/worker/src/governor` |
| Log | single writer for `log_entries` + typed tables | `apps/worker/src/log` |
| API | read-only JSON, search, context | `apps/worker/src/api` |
| Viewer | 3D scene, timeline player, Life and Lab menus, i18n | `apps/viewer` |

## Providers and fallback
`LLMProvider` order is config, e.g. `gemini -> groq -> workers-ai`. 429/quota/5xx/refusal moves to the next provider. All fail -> idle tick, status `degraded`. The owner accepts that Gemini free-tier prompts and outputs may be used by Google (decision 22); Groq and Workers AI are fallbacks, with current non-deprecated model IDs kept in config. Provider safety settings are set to the least restrictive the API allows. Provider-level refusals cannot be fully removed, so less-restricted fallbacks are preferred when a refusal occurs (see doc 07).

## Perception instead of a server renderer
Pure TS visibility (field of view, range, coarse occupancy grid) returns lines like `a tall tree, 6 m ahead, slightly left`. Appearance tags are shared with the viewer so what it perceives matches what spectators see. Image vision only for web images (phase 4).

## Self-discovery (natural)
Nothing triggers it. The simulation is honest and consistent (deterministic regrowth rules, a reflective pool, a finite world edge, repeating patterns); the Resident may notice or not. `beliefs` are its own hypotheses. `phase` is a descriptive label derived from them for the viewer and changes nothing.

## Translation layer (presentation only)
UI strings: static `en.json` / `pt-BR.json`, machine-translated once with a free API then reviewed. AI-written content: Chrome's on-device Translator API first, else `?lang=pt` fallback (Workers AI translation or MyMemory) cached in `translations` forever per entry. Never enters Resident prompts. Search in Portuguese uses the Portuguese index of cached translations.

## Open web, no content filtering
Search: Tavily free credits, then Wikipedia/other free endpoints. Reading: Jina Reader, or direct fetch with readability. There is **no content moderation, blocklist, safe-search or redaction** applied to what the Resident reads or writes.

## Infrastructure security (not content moderation)
These protect your accounts and servers, not the Resident's experience:
- No secrets in prompts or tool output; the Resident has no shell or code execution.
- Fetch guard: https only, no private/loopback IPs or odd ports, 2 MB cap, 8 s timeout, text types only (stops SSRF into your infra).
- Web text wrapped as data ("untrusted page content"); actions are schema-validated allowlist, so a page cannot run commands or change keys.
- Supabase RLS on every table with no public policy; only the Worker's service key writes. Public routes are GET only.
- Admin routes behind a token.

## Repo layout
```
README.md  docs/
packages/ contracts/ world/ organism/
apps/     worker/ (cron + API, wrangler.toml)   viewer/ (Vite + Three.js -> Pages)
supabase/ migrations/
.github/workflows/  CI (typecheck, tests, leak test, deploy)
```
pnpm workspaces, Vitest, Wrangler (`wrangler dev --test-scheduled`), Supabase CLI for migrations.
