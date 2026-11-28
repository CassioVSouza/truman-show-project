# Graph Report - TrumanShowProject  (2026-11-28)

## Corpus Check
- 227 files · ~164,559 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 18 file(s) not represented in the graph (top: .toml 11, (none) 5, .example 1)

## Summary
- 1950 nodes · 5106 edges · 113 communities (92 shown, 21 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 61 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `672bf701`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Data Model Schema
- world/src/index.ts
- Hidden-layer leak test
- Worker Brain & Infrastructure
- Body & Organism Design
- Log everything, append-only
- leak-scan.ts
- Contracts Package Config
- Action & Decision Contract
- Self-Discovery Phases
- Survival Macro-Actions
- Innate Survival Skills
- MVP Scope
- Server Truth
- Later Roadmap Phases
- hudHelpers.ts
- package.json
- 0001_schema.sql
- 0005_read_api.sql
- worker/package.json
- ci.yml
- compilerOptions
- env
- 12 - Security and Secrets (open-source edition)
- worker/tsconfig.json
- Decisions Log
- pipeline.ts
- world/src/actions.ts
- api/index.ts
- updates
- body/tsconfig.json
- contracts/tsconfig.json
- organism/tsconfig.json
- shared/tsconfig.json
- world/tsconfig.json
- Code of Conduct
- Contributing
- body/package.json
- organism/package.json
- shared/package.json
- world/package.json
- Security Policy
- Supabase: applying the migrations
- allowBuilds
- WorldScene
- run.sh
- .prettierrc.json
- tsconfig.json
- viewer/README.md
- testkit.ts
- body/src/index.test.ts
- organism.ts
- perception.ts
- log/index.ts
- llm/index.ts
- Lab menus (technical)
- worker/src/index.ts
- pg_temp.assert
- body-organism-engineer agent
- translate.ts
- tools/index.ts
- climate.ts
- modes.ts
- world.ts
- testkit.ts
- worldScene.ts
- prompts/index.ts
- viewer/package.json
- llm.test.ts
- newBody
- i18n/index.ts
- memory/index.ts
- el
- tick/index.ts
- ViewerApp
- Task 0 (verify free-tier limits)
- api/client.ts
- dist
- worker/src/index.test.ts
- snapshot/index.ts
- compilerOptions
- Hard Rules (9)
- liaison.md
- body/src/actions.ts
- ops-budget.md
- body-organism-engineer.md
- data-api-engineer.md
- qa-guardian.md
- viewer-engineer.md
- world-engineer.md
- Truman Show Project (Antigravity)
- ASSETS.md
- ViewerBeat
- body.ts
- api.test.ts
- shared/src/index.test.ts
- body/src/types.ts
- body/src/config.ts
- main.ts
- 0007_viewer_presence.sql
- brain-engineer.md
- log_entries
- api_list
- 0002_security_and_functions.sql
- pages.ts
- api_context
- Rpc
- Fake

## God Nodes (most connected - your core abstractions)
1. `vitest` - 48 edges
2. `ViewerApp` - 47 edges
3. `dist()` - 45 edges
4. `inner()` - 43 edges
5. `el()` - 38 edges
6. `t()` - 34 edges
7. `WorldScene` - 34 edges
8. `environmentAt()` - 27 edges
9. `MindState` - 25 edges
10. `Plan` - 24 edges

## Surprising Connections (you probably didn't know these)
- `Rules` --references--> `FakeProvider`  [INFERRED]
  .agents/agents/brain-engineer.md → apps/worker/src/llm/fake.ts
- `Responsibilities` --references--> `LLMProvider`  [INFERRED]
  .agents/agents/brain-engineer.md → packages/contracts/src/index.ts
- `Decisions Summary Table` --references--> `Decisions Log`  [INFERRED]
  README.md → docs/DECISIONS.md
- `Truman Show Project` --references--> `Tick pipeline`  [INFERRED]
  README.md → docs/02-architecture.md
- `Hard Rules (9)` --conceptually_related_to--> `Read-only public`  [EXTRACTED]
  CLAUDE.md → docs/01-vision-and-principles.md

## Import Cycles
- 2-file cycle: `apps/worker/src/tools/index.ts -> apps/worker/src/tools/web.ts -> apps/worker/src/tools/index.ts`

## Hyperedges (group relationships)
- **Hidden state to Resident sensation pipeline** — docs_08_embodied_feelings_and_understanding_appraisal, docs_08_embodied_feelings_and_understanding_organism_state, docs_08_embodied_feelings_and_understanding_physiology_vector, docs_08_embodied_feelings_and_understanding_sensation_text, docs_08_embodied_feelings_and_understanding_emotion_atlas [EXTRACTED 1.00]
- **Free-tier cost control and degradation** — docs_05_free_tier_budget_governor_modes, docs_05_free_tier_budget_per_day_plan, docs_05_free_tier_budget_db_growth, docs_05_free_tier_budget_early_ticks, docs_05_free_tier_budget_task_0 [INFERRED 0.85]
- **Hidden-layer protection (contracts, leak test, QA, persona)** — docs_03_contracts_two_layers, docs_03_contracts_leak_test, docs_11_persona_and_behaviour_persona_prompt, _claude_agents_qa_guardian_qa_guardian, _claude_agents_brain_engineer_brain_engineer [INFERRED 0.85]

## Communities (113 total, 21 thin omitted)

### Community 0 - "Data Model Schema"
Cohesion: 0.07
Nodes (38): appraisals, beliefs, blueprints, deaths, decisions, dreams, environment, events (+30 more)

### Community 1 - "world/src/index.ts"
Cohesion: 0.13
Nodes (24): Weather, DEF(), ITEM_DEFS, ItemDef, NODE_DEFS, NodeDef, PerSeason, ps() (+16 more)

### Community 2 - "Hidden-layer leak test"
Cohesion: 0.24
Nodes (10): qa-guardian agent, Unnamed and ungendered; English inside, Portuguese outside, Hidden-layer leak test, Prompt section order, Phase 1A Living body, Testing strategy, Tuning knobs (config, not story), Starting tuning and 14-day calibration run (+2 more)

### Community 3 - "Worker Brain & Infrastructure"
Cohesion: 0.20
Nodes (11): brain-engineer agent, Never exceed the free tier, Fetch guard, Interpreter (hidden LLM call 2), LLMProvider adapter and fallback, Tick pipeline, LLMProvider interface and errors, Governor modes (+3 more)

### Community 4 - "Body & Organism Design"
Cohesion: 0.25
Nodes (8): Feel, don't read, Components and packages, Resident-facing vs Hidden layers, Appraisal (14 dimensions), Feel a body, never a number, Memory coupling and sleep consolidation, Organism state (hidden), Mind systems

### Community 5 - "Log everything, append-only"
Cohesion: 0.17
Nodes (13): data-api-engineer agent, Read-only public, Everything is replayable, Translation layer, Admin routes (ADMIN_TOKEN), LogEntry (canonical, append-only), Public API (GET, edge-cached), Database growth and archiving (+5 more)

### Community 6 - "leak-scan.ts"
Cohesion: 0.09
Nodes (24): FakeProvider, MEMORY_CAP, UNTRUSTED_CLOSE, FAKE_APPRAISAL, FAKE_BODY, FAKE_EMOTION_TOP3, FAKE_ORGANISM, FAKE_PHYSIOLOGY (+16 more)

### Community 7 - "Contracts Package Config"
Cohesion: 0.25
Nodes (8): dependencies, zod@^4.6.7, zod, main, name, private, type, version

### Community 8 - "Action & Decision Contract"
Cohesion: 0.33
Nodes (6): LLM proposes, code disposes, Action contract, DecideOutput { review?, action }, OutcomeReview, Intent, expectation, outcome review, lessons, Output discipline and model settings

### Community 15 - "hudHelpers.ts"
Cohesion: 0.10
Nodes (31): TimeOfDay, formatTime(), computeVitalTrends(), CountdownBadge, CountdownInput, DECISION_CADENCE_MS, describeEvent(), diffTrend() (+23 more)

### Community 16 - "package.json"
Cohesion: 0.10
Nodes (24): devDependencies, eslint@^10.15.0, @eslint/js@^10.0.1, prettier@^3.3.0, typescript@^6.0.3, typescript-eslint@^8.0.0, vitest@^4.1.11, engines (+16 more)

### Community 17 - "0001_schema.sql"
Cohesion: 0.07
Nodes (38): appraisals, beliefs, blueprints, deaths, decisions, dreams, environment, events (+30 more)

### Community 18 - "0005_read_api.sql"
Cohesion: 0.15
Nodes (8): admin_export(), admin_set_flag(), api_governor(), api_log(), api_status(), api_trace(), traces_tick_idx, usage_try()

### Community 19 - "worker/package.json"
Cohesion: 0.10
Nodes (26): dependencies, @truman/body@workspace:*, @truman/contracts@workspace:*, @truman/organism@workspace:*, @truman/shared@workspace:*, @truman/world@workspace:*, zod@^4.6.7, devDependencies (+18 more)

### Community 20 - "ci.yml"
Cohesion: 0.11
Nodes (17): runs-on, steps, timeout-minutes, jobs, check, name, on, pull_request (+9 more)

### Community 21 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, composite, declaration, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules, lib (+8 more)

### Community 22 - "env"
Cohesion: 0.05
Nodes (38): concurrency, cancel-in-progress, group, environment, if, runs-on, steps, timeout-minutes (+30 more)

### Community 23 - "12 - Security and Secrets (open-source edition)"
Cohesion: 0.17
Nodes (12): 10. Reporting vulnerabilities, 11. Owner checklist before the first public push, 12 - Security and Secrets (open-source edition), 1. Threat model, 2. Secret inventory, 3. Rules (hard), 4. Preventing leaks in the repo, 5. CI/CD safety (+4 more)

### Community 24 - "worker/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, lib, outDir, rootDir, types, extends, include, ../../tsconfig.base.json (+1 more)

### Community 25 - "Decisions Log"
Cohesion: 0.21
Nodes (10): liaison agent, Codex team, Truman Show Project, Team and Workflow, The Resident, Body systems (health, nutrition, hydration, thermo, injury, illness), Decisions Log, Decisions Summary Table (+2 more)

### Community 26 - "pipeline.ts"
Cohesion: 0.08
Nodes (47): applyUsage(), Budget, DEFAULT_TIME_SCALE, GovernorConfig, toMemoryRow(), projectReplaySnapshot(), publicFires(), retainReplaySnapshots() (+39 more)

### Community 27 - "world/src/actions.ts"
Cohesion: 0.10
Nodes (70): ActionT, Allow, fail(), fromWorld(), idleFor(), nearStation(), Plan, recoverResidentPosition() (+62 more)

### Community 28 - "api/index.ts"
Cohesion: 0.12
Nodes (31): defaultEdgeCache(), errorJson(), json(), safeEqual(), SECURITY_HEADERS, withCors(), cacheKey(), clientKey() (+23 more)

### Community 29 - "updates"
Cohesion: 0.18
Nodes (10): dependency-type, update-types, dev-dependencies, interval, updates, directory, groups, package-ecosystem (+2 more)

### Community 30 - "body/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json, references

### Community 31 - "contracts/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 32 - "organism/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json, references

### Community 33 - "shared/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 34 - "world/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json, references

### Community 35 - "Code of Conduct"
Cohesion: 0.33
Nodes (5): Code of Conduct, Enforcement, Expected behaviour, Not acceptable, Note on the Resident's content

### Community 36 - "Contributing"
Cohesion: 0.33
Nodes (6): Before you start, Contributing, License of contributions, Pull requests, Security first, Style

### Community 37 - "body/package.json"
Cohesion: 0.22
Nodes (10): devDependencies, @truman/contracts@workspace:*, @truman/world@workspace:*, @truman/contracts, @truman/world, main, name, private (+2 more)

### Community 38 - "organism/package.json"
Cohesion: 0.25
Nodes (8): dependencies, @truman/contracts@workspace:*, @truman/contracts, main, name, private, type, version

### Community 39 - "shared/package.json"
Cohesion: 0.33
Nodes (5): main, name, private, type, version

### Community 40 - "world/package.json"
Cohesion: 0.25
Nodes (8): dependencies, @truman/contracts@workspace:*, @truman/contracts, main, name, private, type, version

### Community 41 - "Security Policy"
Cohesion: 0.33
Nodes (6): For contributors, If you find a leaked secret, Out of scope, Reporting a vulnerability, Security Policy, What counts

### Community 42 - "Supabase: applying the migrations"
Cohesion: 0.33
Nodes (5): Later (not now), Path A (preferred): Supabase CLI, Path B (fallback): SQL editor, Supabase: applying the migrations, Verify (SQL editor, run each, read-only)

### Community 43 - "allowBuilds"
Cohesion: 0.40
Nodes (4): allowBuilds, esbuild, workerd, packages

### Community 44 - "WorldScene"
Cohesion: 0.15
Nodes (5): dist2D(), distToPolyline(), makeSeededRng(), WorldScene, WorldMap

### Community 46 - ".prettierrc.json"
Cohesion: 0.50
Nodes (3): endOfLine, printWidth, trailingComma

### Community 50 - "testkit.ts"
Cohesion: 0.10
Nodes (15): cfg, DEFAULT_GOVERNOR, LogWriter, BASE, BORN, MemoryRows, runMindTick(), Row (+7 more)

### Community 51 - "body/src/index.test.ts"
Cohesion: 0.11
Nodes (22): effectiveTemp(), CalibrationWorld, competentPolicy(), idlePolicy(), makeStubWorld(), Policy, PolicyChoice, randomPolicy() (+14 more)

### Community 52 - "organism.ts"
Cohesion: 0.05
Nodes (81): buildInterpreterPrompt(), appraise(), Appraised, REPEATABLE, clamp(), organismStep(), senseNow(), Senses (+73 more)

### Community 53 - "perception.ts"
Cohesion: 0.13
Nodes (29): ambientLines(), bearingDeg(), cap(), count(), directionPhrase(), distPhrase(), perceive(), Perception (+21 more)

### Community 54 - "log/index.ts"
Cohesion: 0.19
Nodes (11): categoryOf(), idOf(), LIFE_KINDS, Log, LogDraft, LogKindName, LogRef, MAX_ENTRIES_PER_TICK (+3 more)

### Community 55 - "llm/index.ts"
Cohesion: 0.10
Nodes (35): LiveTickOptions, ClientOptions, extractJson(), GenerateRequest, GenerateResult, FakeReply, GEMINI_DEFAULT_MODEL, GeminiProvider (+27 more)

### Community 56 - "Lab menus (technical)"
Cohesion: 0.20
Nodes (10): viewer-engineer agent, Supabase Postgres, Time model (timeline of timestamped events), Viewer (Vite + Three.js on Pages), Worker API (read-only, edge cached), Worker brain (Cloudflare Cron), Event (engine to viewer), Phase 1B Mind, web, public (+2 more)

### Community 57 - "worker/src/index.ts"
Cohesion: 0.17
Nodes (17): parseOrigins(), MyMemoryTranslator, Translator, WorkersAiTranslator, b64Bytes(), base64Forms(), clampTimeout(), Env (+9 more)

### Community 59 - "body-organism-engineer agent"
Cohesion: 0.33
Nodes (7): body-organism-engineer agent, Early-wake tick cap (MAX_EARLY_TICKS_DAY), Emotion atlas (spectators only), Physiology vector, Sensation text and unnamed urges, Early wake tick, Autonomic reflexes

### Community 63 - "translate.ts"
Cohesion: 0.12
Nodes (16): AiBinding, chunkText(), FetchLike, MAX_SOURCE_CHARS, MAX_TRANSLATE_CHARS, translateWithFallback(), WORKERS_AI_TRANSLATE_MODEL, BATCH_ITEMS_PER_RUN (+8 more)

### Community 64 - "tools/index.ts"
Cohesion: 0.12
Nodes (29): ALLOWED_EXACT_TYPES, DEFAULT_MAX_BYTES, DEFAULT_MAX_REDIRECTS, DEFAULT_TIMEOUT_MS, FetchGuardError, FetchGuardErrorCode, guardedFetch(), GuardedFetchOptions (+21 more)

### Community 65 - "climate.ts"
Cohesion: 0.15
Nodes (30): abundanceRamp(), ambientTempOutside(), annual(), baseOutsideTemp(), Clock, clockMinute(), dayIndex(), dayLengthHours() (+22 more)

### Community 66 - "modes.ts"
Cohesion: 0.13
Nodes (18): canEarlyTick(), clampTimeScale(), governorConfigFromEnv(), InMemoryLease, leaseFree(), LeaseRow, MAX_TIME_SCALE, MIN_TIME_SCALE (+10 more)

### Community 67 - "world.ts"
Cohesion: 0.16
Nodes (21): View, Environment, WORLD_CONFIG, burn(), burnRate(), fireHeat(), fireState(), nearestFire() (+13 more)

### Community 68 - "testkit.ts"
Cohesion: 0.11
Nodes (26): AMBIGUOUS_PLAIN_WORDS, BAR_PATTERNS, BAR_WORDS, BW, EMOTION_WORDS, esc(), framingRe(), GIVEN_NAMES (+18 more)

### Community 69 - "worldScene.ts"
Cohesion: 0.06
Nodes (50): SnapshotFeed, FIRE_APPEARANCE, FireProps, restPose(), intersectsSceneryCorridor(), SceneryCorridor, sceneryCorridors(), SceneryFootprint (+42 more)

### Community 70 - "prompts/index.ts"
Cohesion: 0.12
Nodes (25): buildPrompt(), BuiltPrompt, InputSchema, Lines, neutraliseMarkers(), PromptRole, ResidentPromptInput, section() (+17 more)

### Community 71 - "viewer/package.json"
Cohesion: 0.11
Nodes (20): dependencies, three@^0.174.0, @truman/contracts@workspace:*, @truman/world@workspace:*, devDependencies, @types/three@^0.174.0, vite@^6.2.0, @truman/contracts (+12 more)

### Community 72 - "llm.test.ts"
Cohesion: 0.25
Nodes (4): LlmClient, GEMINI_CATEGORIES, repairMessages(), WireRequest

### Community 73 - "newBody"
Cohesion: 0.16
Nodes (16): advanceBody(), catchUp(), needsFineStep(), newBody(), act(), hourEnv(), run(), scenarios (+8 more)

### Community 74 - "i18n/index.ts"
Cohesion: 0.11
Nodes (18): EN, I18nKey, ChromeTranslator, ChromeTranslatorApi, DICTS, getChromeTranslator(), memoryCache, stationLabel() (+10 more)

### Community 75 - "memory/index.ts"
Cohesion: 0.20
Nodes (18): affectResonance(), affectSnapshot, clamp(), keywordScore(), makeMemory(), MemoryItem, MemoryKind, NewMemoryDraft (+10 more)

### Community 76 - "el"
Cohesion: 0.17
Nodes (26): t(), toApiLang(), retryDelayMs(), Attrs, Child, clear(), el(), formatDateTime() (+18 more)

### Community 77 - "tick/index.ts"
Cohesion: 0.10
Nodes (17): FakeDb, DEFAULT_FETCH_TIMEOUT_MS, FetchLike, MAX_SUBREQUESTS, CommitResult, Db, LoadedState, TickPayload (+9 more)

### Community 78 - "ViewerApp"
Cohesion: 0.21
Nodes (4): ViewerApp, CameraMode, LabTab, LifeTab

### Community 79 - "Task 0 (verify free-tier limits)"
Cohesion: 0.14
Nodes (14): ops-budget agent, world-engineer agent, Symbolic perception (no server renderer), Free-tier services table, Task 0 (verify free-tier limits), Genesis (one-time), Phase 0 Foundations, Early death risk (+6 more)

### Community 80 - "api/client.ts"
Cohesion: 0.08
Nodes (29): createViewerApiClient(), newestFirst(), SearchParams, SnapshotFeedResult, StatusPayload, stripTrailingSlash(), TranslatedLogEntry, ViewerApiClient (+21 more)

### Community 81 - "dist"
Cohesion: 0.20
Nodes (31): campfireSite(), dist(), insideCabin(), nearestOnSegment(), blocked(), clearWalkSegment(), detour(), dijkstra() (+23 more)

### Community 82 - "worker/src/index.test.ts"
Cohesion: 0.14
Nodes (11): SupabaseDb, Config, flagOn(), gate(), GateDecision, cfg, mk(), CpuStats (+3 more)

### Community 83 - "snapshot/index.ts"
Cohesion: 0.12
Nodes (19): Lease, animationNames, createSnapshotPublisher(), isoDate(), publicEvents(), publicInventory(), SnapshotEventReader, SnapshotPublisher (+11 more)

### Community 84 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, composite, declaration, lib, noEmit, types, extends, include (+1 more)

### Community 85 - "Hard Rules (9)"
Cohesion: 0.29
Nodes (7): Hard Rules (9), No content censorship / Discoverable, not censored, Nothing is planned (no scripting), Infrastructure security, Things that would break $0, End states (pause, hibernate, death, open-ended), Death (permanent, no respawn)

### Community 86 - "liaison.md"
Cohesion: 0.33
Nodes (5): First, always, Hard rules you protect (flag any request that violates them, ask before changing), Style, Token economy (mandatory), What you do

### Community 87 - "body/src/actions.ts"
Cohesion: 0.29
Nodes (12): HAND_PLACES, performAction(), pushFlinch(), wakeReason(), draw(), drawRange(), hash32(), pick() (+4 more)

### Community 88 - "ops-budget.md"
Cohesion: 0.40
Nodes (4): Responsibilities, Rules, Task 0 (first job), Token economy (mandatory)

### Community 89 - "body-organism-engineer.md"
Cohesion: 0.50
Nodes (3): Non-negotiable, Responsibilities, Token economy (mandatory)

### Community 90 - "data-api-engineer.md"
Cohesion: 0.50
Nodes (3): Responsibilities, Rules, Token economy (mandatory)

### Community 91 - "qa-guardian.md"
Cohesion: 0.50
Nodes (3): Mandatory suites, Output, Token economy (mandatory)

### Community 92 - "viewer-engineer.md"
Cohesion: 0.50
Nodes (3): Responsibilities, Rules, Token economy (mandatory)

### Community 93 - "world-engineer.md"
Cohesion: 0.50
Nodes (3): Responsibilities, Rules, Token economy (mandatory)

### Community 96 - "ViewerBeat"
Cohesion: 0.19
Nodes (5): BEAT_INTERVAL_MS, getViewerToken(), TokenStore, ViewerBeat, ViewerBeatDeps

### Community 97 - "body.ts"
Cohesion: 0.34
Nodes (14): addCondition(), addWound(), clamp(), die(), edge(), fmtT(), isoAt(), mark() (+6 more)

### Community 98 - "api.test.ts"
Cohesion: 0.13
Nodes (11): memCache(), mk(), TOKEN, ApiEnv, EdgeCache, RateLimiter, ApiContext, DB_LIMIT_BYTES (+3 more)

### Community 101 - "body/src/types.ts"
Cohesion: 0.14
Nodes (16): ExecOutcome, ActionResult, AdvanceOptions, PolicyView, BodyState, Condition, ConditionName, DeathCause (+8 more)

### Community 102 - "body/src/config.ts"
Cohesion: 0.28
Nodes (8): NewBodyOptions, ALL_CAUSES, BodyConfig, DeepPartial, DEFAULT_BODY_CONFIG, makeBodyConfig(), merge(), WoundType

### Community 103 - "main.ts"
Cohesion: 0.20
Nodes (16): mount, Section, LivePlayback, livePlayhead(), liveTimelineBounds(), receiveLivePlayback(), REPLAYABLE_EVENT_KINDS, SNAPSHOT_REFRESH_MS (+8 more)

### Community 104 - "0007_viewer_presence.sql"
Cohesion: 0.83
Nodes (3): api_viewer_beat(), viewer_presence, viewer_presence_seen_idx

### Community 105 - "brain-engineer.md"
Cohesion: 0.33
Nodes (4): Responsibilities, Rules, Token economy (mandatory), LLMProvider

### Community 106 - "log_entries"
Cohesion: 0.15
Nodes (11): search_translations(), admin_hide(), api_search(), log_kind_id_idx, log_tick_idx, translation_lookup(), translation_put(), api_log() (+3 more)

### Community 107 - "api_list"
Cohesion: 0.20
Nodes (6): api_list(), decisions_tick_idx, organism_tick_idx, tool_calls_tick_idx, translation_source(), api_list()

### Community 108 - "0002_security_and_functions.sql"
Cohesion: 0.22
Nodes (9): events_append_only, events_no_truncate, log_entries_append_only, log_entries_no_truncate, resident_no_truncate, resident_permanent_death, tick_commit(), trg_log_append_only() (+1 more)

### Community 109 - "pages.ts"
Cohesion: 0.27
Nodes (10): pctRegex(), redactValue(), SnapshotWriter, cfErrorDetail(), CloudflareError, CloudflareResult, makePagesSnapshotWriter(), cf() (+2 more)

## Knowledge Gaps
- **45 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` (+40 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 643 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `testkit.ts` to `leak-scan.ts`, `hudHelpers.ts`, `package.json`, `pipeline.ts`, `world/src/actions.ts`, `body/src/index.test.ts`, `organism.ts`, `log/index.ts`, `llm/index.ts`, `translate.ts`, `tools/index.ts`, `climate.ts`, `modes.ts`, `world.ts`, `worldScene.ts`, `prompts/index.ts`, `newBody`, `i18n/index.ts`, `memory/index.ts`, `el`, `api/client.ts`, `dist`, `worker/src/index.test.ts`, `snapshot/index.ts`, `ViewerBeat`, `api.test.ts`, `shared/src/index.test.ts`, `main.ts`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _45 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Data Model Schema` be split into smaller, more focused modules?**
  _Cohesion score 0.07152496626180836 - nodes in this community are weakly interconnected._
- **Why does `ViewerApp` connect `ViewerApp` to `ViewerBeat`, `worldScene.ts`, `main.ts`, `i18n/index.ts`, `el`, `WorldScene`, `hudHelpers.ts`, `api/client.ts`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Should `world/src/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13227513227513227 - nodes in this community are weakly interconnected._
- **Why does `three` connect `worldScene.ts` to `viewer/package.json`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Should `leak-scan.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09365079365079365 - nodes in this community are weakly interconnected._