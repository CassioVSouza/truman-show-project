# Graph Report - TrumanShowProject  (2026-11-26)

## Corpus Check
- 198 files · ~130,199 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 5, .toml 3, .example 1)

## Summary
- 1684 nodes · 4067 edges · 101 communities (82 shown, 19 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 54 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- 04-data-model.sql
- api/client.ts
- Hidden-layer leak test
- Tick pipeline
- Organism state (hidden)
- Hard Rules (9)
- vitest
- contracts/package.json
- DecideOutput { review?, action }
- Self-discovery (natural)
- Survival macro-actions
- Survival skills at birth
- MVP scope and later phases
- Server is the only truth
- Phases 2-6 (Depth, Making, Senses, Honesty, Polish)
- worker/src/index.test.ts
- package.json
- 0001_schema.sql
- 0005_read_api.sql
- worker/package.json
- ci.yml
- compilerOptions
- env
- 12 - Security and Secrets (open-source edition)
- worker/tsconfig.json
- Truman Show Project
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
- viewer/package.json
- run.sh
- .prettierrc.json
- tsconfig.json
- viewer/README.md
- MemoryRows
- body.ts
- organism.ts
- perception.ts
- testkit.ts
- llm/index.ts
- Lab menus (technical)
- worker/src/index.ts
- pg_temp.assert
- body-organism-engineer agent
- world.ts
- tools/index.ts
- climate.ts
- modes.ts
- world/src/index.ts
- leak-scan.ts
- state.ts
- prompts/index.ts
- WorldScene
- labViews.ts
- main.ts
- i18n/index.ts
- memory/index.ts
- t
- tick/index.ts
- ViewerApp
- perception.test.ts
- contracts/src/index.ts
- api.test.ts
- senses.ts
- snapshot/index.ts
- compilerOptions
- translate.ts
- liaison.md
- RateLimiter
- ops-budget.md
- body-organism-engineer.md
- data-api-engineer.md
- qa-guardian.md
- viewer-engineer.md
- world-engineer.md
- Truman Show Project (Antigravity)
- ASSETS.md
- TickRows
- env.ts
- brain-engineer.md
- shared/src/index.test.ts

## God Nodes (most connected - your core abstractions)
1. `vitest` - 35 edges
2. `inner()` - 33 edges
3. `ViewerApp` - 30 edges
4. `dist()` - 29 edges
5. `environmentAt()` - 27 edges
6. `t()` - 24 edges
7. `el()` - 24 edges
8. `run()` - 23 edges
9. `perceive()` - 23 edges
10. `WorldScene` - 22 edges

## Surprising Connections (you probably didn't know these)
- `Rules` --references--> `FakeProvider`  [INFERRED]
  .agents/agents/brain-engineer.md → apps/worker/src/llm/fake.ts
- `Responsibilities` --references--> `LLMProvider`  [INFERRED]
  .agents/agents/brain-engineer.md → packages/contracts/src/index.ts
- `Decisions Summary Table` --references--> `Decisions Log`  [INFERRED]
  README.md → docs/DECISIONS.md
- `Truman Show Project` --references--> `Tick pipeline`  [INFERRED]
  README.md → docs/02-architecture.md
- `Hard Rules (9)` --conceptually_related_to--> `No content censorship / Discoverable, not censored`  [EXTRACTED]
  CLAUDE.md → docs/01-vision-and-principles.md

## Import Cycles
- 2-file cycle: `apps/worker/src/tools/index.ts -> apps/worker/src/tools/web.ts -> apps/worker/src/tools/index.ts`

## Hyperedges (group relationships)
- **Hidden state to Resident sensation pipeline** — docs_08_embodied_feelings_and_understanding_appraisal, docs_08_embodied_feelings_and_understanding_organism_state, docs_08_embodied_feelings_and_understanding_physiology_vector, docs_08_embodied_feelings_and_understanding_sensation_text, docs_08_embodied_feelings_and_understanding_emotion_atlas [EXTRACTED 1.00]
- **Free-tier cost control and degradation** — docs_05_free_tier_budget_governor_modes, docs_05_free_tier_budget_per_day_plan, docs_05_free_tier_budget_db_growth, docs_05_free_tier_budget_early_ticks, docs_05_free_tier_budget_task_0 [INFERRED 0.85]
- **Hidden-layer protection (contracts, leak test, QA, persona)** — docs_03_contracts_two_layers, docs_03_contracts_leak_test, docs_11_persona_and_behaviour_persona_prompt, _claude_agents_qa_guardian_qa_guardian, _claude_agents_brain_engineer_brain_engineer [INFERRED 0.85]

## Communities (101 total, 19 thin omitted)

### Community 0 - "04-data-model.sql"
Cohesion: 0.07
Nodes (38): appraisals, beliefs, blueprints, deaths, decisions, dreams, environment, events (+30 more)

### Community 1 - "api/client.ts"
Cohesion: 0.14
Nodes (23): SearchParams, SnapshotFeed, ViewerApiConfig, DEMO_CONTEXT, DEMO_EVENTS, DEMO_GOVERNOR, DEMO_LISTS, DEMO_LOG_ENTRIES (+15 more)

### Community 2 - "Hidden-layer leak test"
Cohesion: 0.13
Nodes (18): liaison agent, ops-budget agent, qa-guardian agent, Team and Workflow, Unnamed and ungendered; English inside, Portuguese outside, Hidden-layer leak test, Prompt section order, Free-tier services table (+10 more)

### Community 3 - "Tick pipeline"
Cohesion: 0.17
Nodes (13): brain-engineer agent, Never exceed the free tier, No content censorship / Discoverable, not censored, Fetch guard, Infrastructure security, Interpreter (hidden LLM call 2), LLMProvider adapter and fallback, Tick pipeline (+5 more)

### Community 4 - "Organism state (hidden)"
Cohesion: 0.13
Nodes (15): world-engineer agent, Feel, don't read, Components and packages, Symbolic perception (no server renderer), Resident-facing vs Hidden layers, Genesis (one-time), Early death risk, Appraisal (14 dimensions) (+7 more)

### Community 5 - "Hard Rules (9)"
Cohesion: 0.17
Nodes (13): data-api-engineer agent, Hard Rules (9), Nothing is planned (no scripting), Read-only public, Admin routes (ADMIN_TOKEN), Public API (GET, edge-cached), Database growth and archiving, Things that would break $0 (+5 more)

### Community 6 - "vitest"
Cohesion: 0.10
Nodes (24): DEFAULT_GOVERNOR, FAKE_APPRAISAL, FAKE_BODY, FAKE_EMOTION_TOP3, FAKE_ORGANISM, FAKE_PHYSIOLOGY, FAKE_SECRETS, hiddenKeyNames() (+16 more)

### Community 7 - "contracts/package.json"
Cohesion: 0.25
Nodes (8): dependencies, zod@^4.6.7, zod, main, name, private, type, version

### Community 8 - "DecideOutput { review?, action }"
Cohesion: 0.33
Nodes (6): LLM proposes, code disposes, Action contract, DecideOutput { review?, action }, OutcomeReview, Intent, expectation, outcome review, lessons, Output discipline and model settings

### Community 15 - "worker/src/index.test.ts"
Cohesion: 0.11
Nodes (12): SupabaseDb, Config, cfg, mk(), FakeProvider, CpuStats, measureCpu(), sampler() (+4 more)

### Community 16 - "package.json"
Cohesion: 0.10
Nodes (24): devDependencies, eslint@^10.15.0, @eslint/js@^10.0.1, prettier@^3.3.0, typescript@^6.0.3, typescript-eslint@^8.0.0, vitest@^4.1.11, engines (+16 more)

### Community 17 - "0001_schema.sql"
Cohesion: 0.07
Nodes (38): appraisals, beliefs, blueprints, deaths, decisions, dreams, environment, events (+30 more)

### Community 18 - "0005_read_api.sql"
Cohesion: 0.05
Nodes (30): events_append_only, events_no_truncate, log_entries_append_only, log_entries_no_truncate, resident_no_truncate, resident_permanent_death, search_translations(), tick_commit() (+22 more)

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

### Community 25 - "Truman Show Project"
Cohesion: 0.33
Nodes (6): The Resident, Body systems (health, nutrition, hydration, thermo, injury, illness), Decisions Log, Decisions Summary Table, Deviations from original Gemini plan, Truman Show Project

### Community 26 - "pipeline.ts"
Cohesion: 0.18
Nodes (20): applyUsage(), Mode, affectSnapshot, makeMemory(), toMemoryRow(), menuLines(), ActionT, describeChoice() (+12 more)

### Community 27 - "world/src/actions.ts"
Cohesion: 0.11
Nodes (56): ActionT, Allow, executeAction(), fail(), fromWorld(), idleFor(), nearStation(), Plan (+48 more)

### Community 28 - "api/index.ts"
Cohesion: 0.13
Nodes (27): defaultEdgeCache(), errorJson(), json(), safeEqual(), SECURITY_HEADERS, withCors(), cacheKey(), clientKey() (+19 more)

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

### Community 44 - "viewer/package.json"
Cohesion: 0.11
Nodes (21): dependencies, three@^0.174.0, @truman/contracts@workspace:*, @truman/world@workspace:*, devDependencies, @types/three@^0.174.0, vite@^6.2.0, @truman/contracts (+13 more)

### Community 46 - ".prettierrc.json"
Cohesion: 0.50
Nodes (3): endOfLine, printWidth, trailingComma

### Community 50 - "MemoryRows"
Cohesion: 0.18
Nodes (3): LlmTraceRow, MemoryRows, EventInput

### Community 51 - "body.ts"
Cohesion: 0.05
Nodes (82): ExecOutcome, ActionResult, HAND_PLACES, performAction(), pushFlinch(), addCondition(), addWound(), advanceBody() (+74 more)

### Community 52 - "organism.ts"
Cohesion: 0.06
Nodes (71): buildInterpreterPrompt(), appraise(), Appraised, REPEATABLE, Appraisal, BodySignals, InterpreterOutput, EMOTION_ATLAS (+63 more)

### Community 53 - "perception.ts"
Cohesion: 0.12
Nodes (35): restSpot(), waterSource(), insideCabin(), nearestOnPolyline(), nearestOnSegment(), ambientLines(), cap(), count() (+27 more)

### Community 54 - "testkit.ts"
Cohesion: 0.08
Nodes (33): FakeDb, DEFAULT_FETCH_TIMEOUT_MS, FetchLike, MAX_SUBREQUESTS, CommitResult, Db, LoadedState, TickPayload (+25 more)

### Community 55 - "llm/index.ts"
Cohesion: 0.10
Nodes (32): ClientOptions, extractJson(), GenerateRequest, GenerateResult, LlmClient, FakeReply, GEMINI_DEFAULT_MODEL, GeminiProvider (+24 more)

### Community 56 - "Lab menus (technical)"
Cohesion: 0.12
Nodes (16): viewer-engineer agent, Everything is replayable, Supabase Postgres, Time model (timeline of timestamped events), Translation layer, Viewer (Vite + Three.js on Pages), Worker API (read-only, edge cached), Worker brain (Cloudflare Cron) (+8 more)

### Community 57 - "worker/src/index.ts"
Cohesion: 0.23
Nodes (12): parseOrigins(), WorkersAiTranslator, readConfig(), redact(), fetch(), runLiveTick(), scheduled(), SnapshotWriter (+4 more)

### Community 59 - "body-organism-engineer agent"
Cohesion: 0.33
Nodes (7): body-organism-engineer agent, Early-wake tick cap (MAX_EARLY_TICKS_DAY), Emotion atlas (spectators only), Physiology vector, Sensation text and unnamed urges, Early wake tick, Autonomic reflexes

### Community 63 - "world.ts"
Cohesion: 0.13
Nodes (29): View, Environment, WORLD_CONFIG, WorldConfig, burn(), burnRate(), fireHeat(), fireState() (+21 more)

### Community 64 - "tools/index.ts"
Cohesion: 0.11
Nodes (30): FetchLike, ALLOWED_EXACT_TYPES, DEFAULT_MAX_BYTES, DEFAULT_MAX_REDIRECTS, DEFAULT_TIMEOUT_MS, FetchGuardError, FetchGuardErrorCode, guardedFetch() (+22 more)

### Community 65 - "climate.ts"
Cohesion: 0.19
Nodes (26): createSnapshotPublisher(), publicInventory(), abundanceRamp(), ambientTempOutside(), annual(), baseOutsideTemp(), Clock, clockMinute() (+18 more)

### Community 66 - "modes.ts"
Cohesion: 0.17
Nodes (13): Env, Budget, canEarlyTick(), governorConfigFromEnv(), leaseFree(), LeaseRow, ModePlan, num() (+5 more)

### Community 67 - "world/src/index.ts"
Cohesion: 0.13
Nodes (25): Weather, DEF(), ITEM_DEFS, ItemDef, NODE_DEFS, NodeDef, PerSeason, ps() (+17 more)

### Community 68 - "leak-scan.ts"
Cohesion: 0.11
Nodes (26): AMBIGUOUS_PLAIN_WORDS, BAR_PATTERNS, BAR_WORDS, BW, EMOTION_WORDS, esc(), framingRe(), GIVEN_NAMES (+18 more)

### Community 69 - "state.ts"
Cohesion: 0.25
Nodes (7): genesis(), HISTORY_CAP, HistoryItem, LESSON_CAP, PendingDecision, QUESTION_CAP, newOrganism()

### Community 70 - "prompts/index.ts"
Cohesion: 0.16
Nodes (18): buildPrompt(), BuiltPrompt, InputSchema, Lines, neutraliseMarkers(), PromptMessage, PromptRole, ResidentPromptInput (+10 more)

### Community 71 - "WorldScene"
Cohesion: 0.15
Nodes (8): CameraMode, CharacterRig, SKY_PRESETS, WorldScene, CharacterPoseAnim, TimelineState, TimeOfDay, WorldMap

### Community 72 - "labViews.ts"
Cohesion: 0.14
Nodes (8): createViewerApiClient(), stripTrailingSlash(), ViewerApiClient, downloadBlob(), metricBar(), num(), renderLabTab(), ListResponse

### Community 73 - "main.ts"
Cohesion: 0.22
Nodes (7): SnapshotFeedResult, StatusPayload, mount, Section, SPEEDS, runSearch(), SearchResponse

### Community 74 - "i18n/index.ts"
Cohesion: 0.18
Nodes (12): EN, I18nKey, ChromeTranslator, ChromeTranslatorApi, DICTS, getChromeTranslator(), memoryCache, stationLabel() (+4 more)

### Community 75 - "memory/index.ts"
Cohesion: 0.20
Nodes (17): affectResonance(), clamp(), keywordScore(), MEMORY_CAP, MemoryItem, MemoryKind, NewMemoryDraft, pruneMemories() (+9 more)

### Community 76 - "t"
Cohesion: 0.21
Nodes (20): t(), UiLang, Attrs, Child, clear(), el(), formatDateTime(), formatTime() (+12 more)

### Community 77 - "tick/index.ts"
Cohesion: 0.17
Nodes (12): flagOn(), gate(), GovernorConfig, SnapshotPublisher, runTick(), runTickInner(), tickLog(), TickResult (+4 more)

### Community 78 - "ViewerApp"
Cohesion: 0.26
Nodes (3): ViewerApp, LabTab, LifeTab

### Community 79 - "perception.test.ts"
Cohesion: 0.28
Nodes (7): start(), generateMap(), bearingDeg(), directionPhrase(), BANNED, cases, createWorld()

### Community 80 - "contracts/src/index.ts"
Cohesion: 0.10
Nodes (19): Action, base, DecideOutput, EmotionLabel, InventoryItem, LLMErrorKind, LogPageResponse, OutcomeReview (+11 more)

### Community 81 - "api.test.ts"
Cohesion: 0.16
Nodes (8): FakeRpc, memCache(), mk(), TOKEN, Rpc, DB_LIMIT_BYTES, sizeMode, sizeReport()

### Community 82 - "senses.ts"
Cohesion: 0.22
Nodes (12): Lease, clamp(), cognition, organismStep(), physiologyNow(), senseNow(), Senses, startResident() (+4 more)

### Community 83 - "snapshot/index.ts"
Cohesion: 0.16
Nodes (11): ActionName, FORMAT, MENU, animationNames, isoDate(), publicEvents(), SnapshotEventReader, SnapshotSource (+3 more)

### Community 84 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, composite, declaration, lib, noEmit, types, extends, include (+1 more)

### Community 85 - "translate.ts"
Cohesion: 0.16
Nodes (8): AiBinding, chunkText(), FetchLike, MAX_TRANSLATE_CHARS, MyMemoryTranslator, translateWithFallback(), Translator, WORKERS_AI_TRANSLATE_MODEL

### Community 86 - "liaison.md"
Cohesion: 0.33
Nodes (5): First, always, Hard rules you protect (flag any request that violates them, ask before changing), Style, Token economy (mandatory), What you do

### Community 87 - "RateLimiter"
Cohesion: 0.20
Nodes (5): ApiEnv, EdgeCache, RateLimiter, ApiContext, StartResult

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

### Community 97 - "env.ts"
Cohesion: 0.31
Nodes (7): b64Bytes(), base64Forms(), clampTimeout(), MAX_FETCH_TIMEOUT_MS, MIN_FETCH_TIMEOUT_MS, pctRegex(), redactValue()

### Community 98 - "brain-engineer.md"
Cohesion: 0.33
Nodes (4): Responsibilities, Rules, Token economy (mandatory), LLMProvider

## Knowledge Gaps
- **45 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` (+40 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 581 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `tools/index.ts`, `api/client.ts`, `modes.ts`, `shared/src/index.test.ts`, `climate.ts`, `prompts/index.ts`, `i18n/index.ts`, `memory/index.ts`, `worker/src/index.test.ts`, `package.json`, `api.test.ts`, `perception.test.ts`, `body.ts`, `organism.ts`, `testkit.ts`, `llm/index.ts`, `world/src/actions.ts`, `world.ts`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _45 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `04-data-model.sql` be split into smaller, more focused modules?**
  _Cohesion score 0.07152496626180836 - nodes in this community are weakly interconnected._
- **Why does `three` connect `viewer/package.json` to `WorldScene`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Should `api/client.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13793103448275862 - nodes in this community are weakly interconnected._
- **Why does `t()` connect `t` to `labViews.ts`, `main.ts`, `i18n/index.ts`, `ViewerApp`, `worker/src/index.test.ts`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Should `Hidden-layer leak test` be split into smaller, more focused modules?**
  _Cohesion score 0.13071895424836602 - nodes in this community are weakly interconnected._