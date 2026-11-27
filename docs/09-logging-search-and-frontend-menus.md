# 09 - Logging, Search and Front-end Menus

## Logging principle
**Everything is logged, append-only, with provenance.** Every action, thought, idea, perception, sensation text, appraisal, organism-state sample, memory write/recall, tool call, LLM prompt/response, error and governor decision gets a `log_entries` row (plus structured rows in specialised tables). Nothing is edited in place. Admin "hide" flags an entry; it never deletes.

Each entry carries: `id`, `seq`, `ts`, `tick_id`, `kind`, `category` (`life` | `lab`), `text` (searchable), `data` (jsonb), `caused_by` (entry id), `lang` (en), `hidden` (default false).

### Kinds
| Category | Kinds |
|---|---|
| life | `thought`, `idea`, `action` (with intent + expectation), `outcome_review`, `lesson`, `journal`, `dream`, `memory_write`, `memory_recall`, `discovery` (page read), `question`, `belief`, `goal`, `feeling_description` (Resident's own words), `perception` (what it saw/heard), `sensation` (body text it received) |
| lab | `organism_sample`, `physiology`, `appraisal`, `emotion_label`, `causal_link`, `llm_trace`, `tool_call`, `governor`, `error`, `system`, `translation` |

## Search
- Single global search over all kinds using Postgres full-text (`tsvector`, `english` config) + `pg_trgm` for fuzzy/partial match; Portuguese search runs against the `translations` table (`portuguese` config).
- Filters: kind(s), category, date range, mood/emotion label (lab), tool/domain, text in intent/lesson/cause, "caused by" chain.
- Every result opens a **context view**: the full chain around it (what led to it, what followed, body state at the time, the prompt that produced it if in Lab).
- Sort: relevance or time. Pagination by keyset (`seq`).
- Served by `GET /api/search`, rate-limited at the edge, cached by normalized query for 60 s.

## Front-end menus
Technical content is isolated from life content. The Lab is a separate section (`/lab/*`), reachable from a clearly marked toggle.

### Life (default experience)
- The **Live** view shows the 3D world, thought bubble, heartbeat and breath, current action, and a countdown to the next eligible decision slot when available. Outdoor campfires render at their logged locations alongside the cabin hearth.
- **Journal**: entries in own words (EN/PT).
- **Thoughts**: stream of thoughts with intent and what it expected.
- **Ideas**: ideas and questions it generated, with status (explored / open).
- **Dreams**: dream log and what question each spawned.
- **Memories**: what it knows, with source URL and the body state it had when learning it.
- **Discoveries**: pages visited, searches made.
- **Self**: beliefs about itself over time; the `phase` label.
- The **Timeline** lets spectators scrub through recent actions and return to live playback. On desktop, it stays visible at the bottom of the browser viewport. Search covers the longer log history.
- **Search** (global bar, always visible).

### Lab (technical)
- **Vitals & Survival**: life bar, hunger, thirst, temperature, stamina, wounds, illness, inventory, skills, fires, shelter; death report if any.
- **World & Resources**: season, weather, resource nodes and regrowth, depletion history.
- **Body & Organism**: physiology time-series, hidden state groups, approximate emotion atlas label.
- **Appraisals**: dimension vectors per stimulus.
- **Decisions**: each action with intent, expectation, outcome, prediction error.
- **Causal chains**: graph/tree from any entry back to its causes and forward to consequences.
- **LLM traces**: provider, model, tokens, latency, full prompt and response.
- **Tool calls**: searches, fetches, status codes, sizes, SSRF-guard decisions.
- **Governor & budget**: daily usage per provider/tool, current mode.
- **System & errors**: ticks, leases, failures, fallbacks, refusals.
- **Raw events**: the event stream the viewer consumes, published in `live.json` after each successful tick (decision 22).
- **Export**: download any filtered result as JSON/CSV.

Language: whole UI toggles EN/PT-BR (doc 02, translation layer). Lab content stays English except UI labels.

## Public API additions
`GET /api/search`, `GET /api/log?kind=&category=&after=`, `GET /api/context/:entryId`, `GET /api/lab/organism?from=&to=`, `GET /api/lab/traces?...`, plus `POST /api/viewers/beat` (anonymous live viewers count, see doc 03). These routes run through the Worker and use the edge cache. The viewer polls the independent Pages host for `live.json` and interpolates the timeline locally. The bundle contains event timing, public display data and log IDs. Thoughts, journal text and web content are fetched on demand through the Worker so hide flags apply to future reads.

## Storage plan (so "log everything" survives the free tier)
Rough sizing: ~288 LLM calls/day x ~10 KB prompt+response ~ 3 MB/day ~ 90 MB/month for traces alone, against a ~500 MB free database. Therefore:
- `llm_traces` keep full text for 14 days in Postgres, then move to compressed JSONL assets in a **GitHub Release** (scheduled Action) and keep only a stub row (hash, tokens, release asset URL). Stub rows keep search for traces by metadata; full text is fetched from the release on demand.
- `organism_sample` stored per tick (not per second); older than 30 days downsampled to hourly.
- Life-category entries (thoughts, journal, etc.) are small and kept forever.
- A monthly archive of everything to a GitHub Release guarantees a complete replayable record.
