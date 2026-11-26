# 03 - Contracts

Source of truth is code: `packages/contracts/src/index.ts` (zod). Every contract carries `v`; breaking changes bump it.

## Two layers, strictly separated
| Layer | Contracts | Seen by the Resident? |
|---|---|---|
| **Resident-facing** | `Action`, `OutcomeReview`, `DecideOutput`, sensation text, perception text, memories, lessons | Yes |
| **Hidden** | `Appraisal`, `InterpreterOutput`, `OrganismState`, `Physiology` (numbers), `Temperament`, `EmotionLabel` | **Never** (only rendered to sensation text) |

A unit test enforces it: prompts are built by one function that takes only Resident-facing types; any hidden field name or emotion-atlas label appearing in a built prompt fails CI.

## 1. Action (Resident -> engine)
`type` in `think | move_to | web_search | read_page | write_journal | rest | look_at`. **Every action requires** `thought`, `intent` (why now) and `expectation` (what I think will happen); optional `ideas[]`. Phase 3+: `gather`, `craft`, `play_instrument`, `draw`. There is no `mood` field: the Resident describes feelings in its own words in the next review.

Survival actions (doc 10) are macro-actions with durations: `eat`, `drink`, `gather`, `make_fire`, `tend_fire`, `cook`, `boil_water`, `wear`, `treat_wound`, `use_item`, `repair_shelter`, `fish`, `chop`. Additional hidden contracts: `BodyState` (health, satiety, hydration, core_temp, stamina, wounds, illness...), `Skills`, `Inventory`; public Snapshot exposes `vitals` (life bar and needs) for spectators only. They are never serialised into Resident prompts (leak test covers them).

## 2. DecideOutput = { review?, action }
`review` (omitted on the very first tick) is the **OutcomeReview** of the previous action: `what_happened`, `cause`, `expectation_met`, `lesson?`, `feeling_description` (own words), `new_questions`, `goal_update?`, `belief_update?`, `citations[]`. Facts in the review need a citation (URL or `memory:<id>`), others are dropped. One call produces review + next action.

## 3. Interpreter (hidden LLM call, never sees the persona)
Input: stimulus, the action with its `expectation`, factual outcome. Output: `appraisal` (14 dimensions), `consequences[]` (facts), `prediction_error`. Skipped for mundane events (rule tables).

## 4. Organism, physiology, temperament
See doc 08. `OrganismState` (18 hidden variables), `Physiology` (21 channels), `Temperament` (seeded constants). The only bridge to the Resident is deterministic sensation templating.

## 5. LogEntry (canonical, append-only)
`id, ts, tick_id, kind, category(life|lab), text, data, caused_by, lang, hidden`. Kinds listed in doc 09. `caused_by` links consequences to causes and powers the causal-chain view.

## 6. Event (engine -> viewer)
`walk, anim, thought, web_visit, journal, body (heart_rate, breath_rate, posture, heaviness, tension), sleep_start, sleep_end, dream, world, status`, each with `t_start, t_end, seq, log_id`. The viewer is a pure function of snapshot + timeline.

## 7. Public API (read-only, GET, JSON, via Worker, edge-cached)

The static Pages host serves `GET /live.json`, a single JSON object with `snapshot`, `events` and `status`. The bundle contains public world and Resident display state, event timing and movement, and log references. Read Resident-authored text through the dynamic routes below so that hide flags apply.

| Route | Returns | Cache |
|---|---|---|
| `/api/search?q=&kinds=&category=&from=&to=&lang=&before_id=` | SearchResponse | 60 s |
| `/api/log?kind=&category=&after=` | LogEntry[] | 15 s |
| `/api/context/:entryId` | entry + causes chain + consequences chain + body state + trace refs | 60 s |
| `/api/journal`, `/api/dreams`, `/api/beliefs`, `/api/memories`, `/api/ideas` (`lang=en|pt`) | life lists | 60 s |
| `/api/lab/organism?from=&to=` | organism + physiology + emotion label series | 30 s |
| `/api/lab/appraisals`, `/api/lab/decisions`, `/api/lab/traces`, `/api/lab/tools`, `/api/lab/governor`, `/api/lab/errors` | lab lists | 30 s |
| `/api/lab/traces/:id` | one full LLM trace | 300 s |
| `/api/translate?entity=&id=&lang=pt` | server-side translation fallback, cached forever per entity+id+lang (daily cap) | 24 h |
| `/api/status` | status, day count, mode | 15 s |

Search extras: `sort=relevance|time`, keyset cursor `before_id` (+ `before_rank` for relevance), `lang=pt` searches cached translations. List routes take `before=` (keyset) and `limit<=100`. Hidden entries never appear in any route. Unknown query params are ignored and never part of the cache key.

No public write routes. Lab and life are the same API, separated by `category` and route prefix.

## 8. Admin (bearer `ADMIN_TOKEN`)
`POST /admin/start | pause | resume | kill | tick | hide/:logId | unhide/:logId`, `GET /admin/export`. Send `start` with an empty body. It creates the first Resident and its world state atomically and returns `201`. It returns `409` while a tick holds the lease or when the Resident already exists. `hide` only flips the `hidden` flag (takedown lever, not a filter).

## 9. LLMProvider (internal)
`generate({role, system, messages, schema, temperature, maxOutputTokens, images?})` -> `{data, usage, trace_id}`. Errors: `RateLimited | QuotaExhausted | InvalidJson | Refused | Unavailable`. `Refused` (provider safety refusal) triggers fallback to the next provider, is logged, and is never rewritten or softened by us. Every call writes an `llm_traces` row.

## 10. Prompt section order (Resident)
`[WHO YOU ARE] [YOUR BODY RIGHT NOW (sensations + urges)] [WHAT YOU SEE/HEAR] [WHAT YOU DID AND WHAT FOLLOWED] [YOUR PLAN AND LESSONS] [MEMORIES RECALLED] [LAST RESULT (UNTRUSTED)] [WHAT YOU CAN DO]`. Persona text is yours to supply (pending).
