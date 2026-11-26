# Graph Report - TrumanShowProject  (2026-11-26)

## Corpus Check
- 200 files · ~136,977 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 18 file(s) not represented in the graph (top: .toml 11, (none) 5, .example 1)

## Summary
- 1714 nodes · 4173 edges · 99 communities (81 shown, 18 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 54 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1bf6dc3b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Data Model Schema
- api/client.ts
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
- TickPayload
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
- tick/index.ts
- body.ts
- sensation.ts
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
- testkit.ts
- el
- Task 0 (verify free-tier limits)
- organism/src/index.test.ts
- labViews.ts
- MindState
- i18n/index.ts
- memory/index.ts
- main.ts
- tick/index.ts
- ViewerApp
- Task 0 (verify free-tier limits)
- llm/client.ts
- map.ts
- organism.ts
- snapshot/index.ts
- compilerOptions
- Hard Rules (9)
- liaison.md
- ops-budget.md
- body-organism-engineer.md
- data-api-engineer.md
- qa-guardian.md
- viewer-engineer.md
- world-engineer.md
- Truman Show Project (Antigravity)
- ASSETS.md
- TickRows
- brain-engineer.md
- vitest

## God Nodes (most connected - your core abstractions)
1. `vitest` - 36 edges
2. `ViewerApp` - 34 edges
3. `inner()` - 33 edges
4. `WorldScene` - 32 edges
5. `el()` - 30 edges
6. `dist()` - 29 edges
7. `environmentAt()` - 27 edges
8. `t()` - 26 edges
9. `run()` - 23 edges
10. `perceive()` - 23 edges

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

## Communities (99 total, 18 thin omitted)

### Community 0 - "Data Model Schema"
Cohesion: 0.07
Nodes (38): appraisals, beliefs, blueprints, deaths, decisions, dreams, environment, events (+30 more)

### Community 1 - "api/client.ts"
Cohesion: 0.07
Nodes (36): SearchParams, SnapshotFeed, ViewerApiConfig, DEMO_CONTEXT, DEMO_EVENTS, DEMO_GOVERNOR, DEMO_LISTS, DEMO_LOG_ENTRIES (+28 more)

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
Cohesion: 0.11
Nodes (22): ResidentPromptInput, cleanInput(), FAKE_APPRAISAL, FAKE_BODY, FAKE_EMOTION_TOP3, FAKE_ORGANISM, FAKE_PHYSIOLOGY, FAKE_SECRETS (+14 more)

### Community 7 - "Contracts Package Config"
Cohesion: 0.25
Nodes (8): dependencies, zod@^4.6.7, zod, main, name, private, type, version

### Community 8 - "Action & Decision Contract"
Cohesion: 0.33
Nodes (6): LLM proposes, code disposes, Action contract, DecideOutput { review?, action }, OutcomeReview, Intent, expectation, outcome review, lessons, Output discipline and model settings

### Community 15 - "TickPayload"
Cohesion: 0.15
Nodes (8): DEFAULT_FETCH_TIMEOUT_MS, FetchLike, MAX_SUBREQUESTS, SupabaseDb, Config, env, started, wiring()

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

### Community 25 - "Decisions Log"
Cohesion: 0.21
Nodes (10): liaison agent, Codex team, Truman Show Project, Team and Workflow, The Resident, Body systems (health, nutrition, hydration, thermo, injury, illness), Decisions Log, Decisions Summary Table (+2 more)

### Community 26 - "pipeline.ts"
Cohesion: 0.10
Nodes (35): Budget, MEMORY_CAP, toMemoryRow(), ActionName, ALL_ACTIONS, FORMAT, MENU, menuLines() (+27 more)

### Community 27 - "world/src/actions.ts"
Cohesion: 0.13
Nodes (50): ActionT, Allow, ExecOutcome, fail(), fromWorld(), Plan, ViewerEvent, competentAction() (+42 more)

### Community 28 - "api/index.ts"
Cohesion: 0.06
Nodes (46): FakeRpc, memCache(), mk(), TOKEN, ApiEnv, defaultEdgeCache(), EdgeCache, errorJson() (+38 more)

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
Cohesion: 0.06
Nodes (31): dependencies, three@^0.174.0, @truman/contracts@workspace:*, @truman/world@workspace:*, devDependencies, @types/three@^0.174.0, vite@^6.2.0, @truman/contracts (+23 more)

### Community 46 - ".prettierrc.json"
Cohesion: 0.50
Nodes (3): endOfLine, printWidth, trailingComma

### Community 51 - "body.ts"
Cohesion: 0.06
Nodes (81): ActionResult, HAND_PLACES, performAction(), pushFlinch(), addCondition(), addWound(), advanceBody(), AdvanceOptions (+73 more)

### Community 52 - "sensation.ts"
Cohesion: 0.15
Nodes (24): sense(), makeTemperament(), newOrganism(), targets(), derivePhysiology(), physiologySources(), clamp(), hash32() (+16 more)

### Community 53 - "perception.ts"
Cohesion: 0.10
Nodes (38): executeAction(), idleFor(), nearStation(), targetOf(), renderReflexEvents(), restSpot(), insideCabin(), ambientLines() (+30 more)

### Community 54 - "testkit.ts"
Cohesion: 0.18
Nodes (13): FakeDb, CommitResult, Db, LoadedState, TickPayload, Row, clone(), makeAgent() (+5 more)

### Community 55 - "llm/index.ts"
Cohesion: 0.12
Nodes (25): LiveTickOptions, FakeProvider, FakeReply, GEMINI_DEFAULT_MODEL, GeminiProvider, GeminiResponse, httpError(), REFUSAL_FINISH (+17 more)

### Community 56 - "Lab menus (technical)"
Cohesion: 0.20
Nodes (10): viewer-engineer agent, Supabase Postgres, Time model (timeline of timestamped events), Viewer (Vite + Three.js on Pages), Worker API (read-only, edge cached), Worker brain (Cloudflare Cron), Event (engine to viewer), Phase 1B Mind, web, public (+2 more)

### Community 57 - "worker/src/index.ts"
Cohesion: 0.17
Nodes (17): parseOrigins(), MyMemoryTranslator, Translator, WorkersAiTranslator, b64Bytes(), base64Forms(), clampTimeout(), Env (+9 more)

### Community 59 - "body-organism-engineer agent"
Cohesion: 0.33
Nodes (7): body-organism-engineer agent, Early-wake tick cap (MAX_EARLY_TICKS_DAY), Emotion atlas (spectators only), Physiology vector, Sensation text and unnamed urges, Early wake tick, Autonomic reflexes

### Community 63 - "world.ts"
Cohesion: 0.18
Nodes (20): View, Environment, WORLD_CONFIG, WorldConfig, burn(), burnRate(), fireHeat(), fireState() (+12 more)

### Community 64 - "tools/index.ts"
Cohesion: 0.12
Nodes (29): ALLOWED_EXACT_TYPES, DEFAULT_MAX_BYTES, DEFAULT_MAX_REDIRECTS, DEFAULT_TIMEOUT_MS, FetchGuardError, FetchGuardErrorCode, guardedFetch(), GuardedFetchOptions (+21 more)

### Community 65 - "climate.ts"
Cohesion: 0.12
Nodes (35): abundanceRamp(), ambientTempOutside(), annual(), baseOutsideTemp(), clockMinute(), dayIndex(), dayLengthHours(), daylightAt() (+27 more)

### Community 66 - "modes.ts"
Cohesion: 0.13
Nodes (16): applyUsage(), canEarlyTick(), DEFAULT_GOVERNOR, InMemoryLease, Lease, leaseFree(), LeaseRow, ModePlan (+8 more)

### Community 67 - "world/src/index.ts"
Cohesion: 0.13
Nodes (25): start(), Clock, ITEM_DEFS, ItemDef, STARTER_KIT, PACKAGE, advanceInventory(), describeInventory() (+17 more)

### Community 68 - "testkit.ts"
Cohesion: 0.11
Nodes (26): AMBIGUOUS_PLAIN_WORDS, BAR_PATTERNS, BAR_WORDS, BW, EMOTION_WORDS, esc(), framingRe(), GIVEN_NAMES (+18 more)

### Community 69 - "el"
Cohesion: 0.29
Nodes (15): stationLabel(), t(), clear(), el(), formatDateTime(), downloadBlob(), kvGroup(), kvRow() (+7 more)

### Community 70 - "Task 0 (verify free-tier limits)"
Cohesion: 0.16
Nodes (19): buildPrompt(), BuiltPrompt, InputSchema, Lines, neutraliseMarkers(), PromptMessage, PromptRole, section() (+11 more)

### Community 71 - "organism/src/index.test.ts"
Cohesion: 0.13
Nodes (16): EMOTION_ATLAS, EmotionLabel, FEATURES, Proto, PACKAGE, calmBody, EMOTION_EXTRA, findLeaks() (+8 more)

### Community 72 - "labViews.ts"
Cohesion: 0.18
Nodes (5): createViewerApiClient(), stripTrailingSlash(), ViewerApiClient, runSearch(), SearchResponse

### Community 73 - "MindState"
Cohesion: 0.18
Nodes (14): buildInterpreterPrompt(), SnapshotSource, appraise(), Appraised, REPEATABLE, MindState, AgentOptions, Appraisal (+6 more)

### Community 74 - "i18n/index.ts"
Cohesion: 0.14
Nodes (15): EN, I18nKey, ChromeTranslator, ChromeTranslatorApi, DICTS, getChromeTranslator(), memoryCache, toApiLang() (+7 more)

### Community 75 - "memory/index.ts"
Cohesion: 0.20
Nodes (18): affectResonance(), affectSnapshot, clamp(), keywordScore(), makeMemory(), MemoryItem, MemoryKind, NewMemoryDraft (+10 more)

### Community 76 - "main.ts"
Cohesion: 0.12
Nodes (22): SnapshotFeedResult, StatusPayload, UiLang, mount, Section, SPEEDS, evaluateTimeline(), FireVisualState (+14 more)

### Community 77 - "tick/index.ts"
Cohesion: 0.16
Nodes (15): flagOn(), gate(), GateDecision, Mode, cfg, mk(), CpuStats, measureCpu() (+7 more)

### Community 78 - "ViewerApp"
Cohesion: 0.26
Nodes (3): ViewerApp, LabTab, LifeTab

### Community 79 - "Task 0 (verify free-tier limits)"
Cohesion: 0.14
Nodes (14): ops-budget agent, world-engineer agent, Symbolic perception (no server renderer), Free-tier services table, Task 0 (verify free-tier limits), Genesis (one-time), Phase 0 Foundations, Early death risk (+6 more)

### Community 80 - "llm/client.ts"
Cohesion: 0.22
Nodes (8): ClientOptions, extractJson(), GenerateRequest, GenerateResult, LlmClient, LlmRole, LlmTraceRow, ProviderUsage

### Community 81 - "map.ts"
Cohesion: 0.32
Nodes (10): build(), cache, nearestOnPolyline(), nearestOnSegment(), polar(), round2(), hash32(), rand01() (+2 more)

### Community 82 - "organism.ts"
Cohesion: 0.16
Nodes (22): Senses, BodySignals, DEFAULT_BASELINES, DEFAULT_DECAY_MIN, DEFAULT_ORGANISM_CONFIG, OrganismConfig, NEUTRAL, RULES (+14 more)

### Community 83 - "snapshot/index.ts"
Cohesion: 0.14
Nodes (21): pctRegex(), redactValue(), animationNames, createSnapshotPublisher(), isoDate(), publicEvents(), publicInventory(), SnapshotEventReader (+13 more)

### Community 84 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, composite, declaration, lib, noEmit, types, extends, include (+1 more)

### Community 85 - "Hard Rules (9)"
Cohesion: 0.29
Nodes (7): Hard Rules (9), No content censorship / Discoverable, not censored, Nothing is planned (no scripting), Infrastructure security, Things that would break $0, End states (pause, hibernate, death, open-ended), Death (permanent, no respawn)

### Community 86 - "liaison.md"
Cohesion: 0.33
Nodes (5): First, always, Hard rules you protect (flag any request that violates them, ask before changing), Style, Token economy (mandatory), What you do

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

### Community 96 - "TickRows"
Cohesion: 0.11
Nodes (7): GovernorConfig, SnapshotPublisher, MindTickDeps, TickLog, TickRows, SimOptions, Tools

### Community 98 - "brain-engineer.md"
Cohesion: 0.33
Nodes (4): Responsibilities, Rules, Token economy (mandatory), LLMProvider

### Community 99 - "vitest"
Cohesion: 0.10
Nodes (15): cfg, categoryOf(), idOf(), LIFE_KINDS, Log, LogDraft, LogKindName, LogRef (+7 more)

## Knowledge Gaps
- **45 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` (+40 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 583 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `api/client.ts`, `leak-scan.ts`, `TickPayload`, `package.json`, `pipeline.ts`, `world/src/actions.ts`, `api/index.ts`, `body.ts`, `testkit.ts`, `llm/index.ts`, `world.ts`, `tools/index.ts`, `climate.ts`, `modes.ts`, `world/src/index.ts`, `Task 0 (verify free-tier limits)`, `organism/src/index.test.ts`, `i18n/index.ts`, `memory/index.ts`, `tick/index.ts`, `snapshot/index.ts`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _45 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Data Model Schema` be split into smaller, more focused modules?**
  _Cohesion score 0.07152496626180836 - nodes in this community are weakly interconnected._
- **Why does `WorldScene` connect `WorldScene` to `main.ts`, `ViewerApp`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Should `api/client.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07474747474747474 - nodes in this community are weakly interconnected._
- **Should `leak-scan.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10967741935483871 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09538461538461539 - nodes in this community are weakly interconnected._