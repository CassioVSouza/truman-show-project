# Graph Report - TrumanShowProject  (2026-11-26)

## Corpus Check
- 192 files · ~124,528 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 5, .toml 3, .example 1)

## Summary
- 1625 nodes · 3890 edges · 99 communities (83 shown, 16 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 52 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9e1beec9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Data Model Schema
- Contracts Types
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
- supabase.ts
- package.json
- 0001_schema.sql
- 0005_read_api.sql
- worker/package.json
- ci.yml
- compilerOptions
- deploy-worker
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
- viewer/package.json
- run.sh
- .prettierrc.json
- tsconfig.json
- tick/index.ts
- body/src/types.ts
- organism.ts
- perception.ts
- log/index.ts
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
- sensation.ts
- worker/src/index.test.ts
- WorldScene
- labViews.ts
- main.ts
- i18n/index.ts
- memory/index.ts
- t
- engine.ts
- ViewerApp
- map.ts
- calibration.ts
- body.ts
- body/src/index.test.ts
- appraise.ts
- compilerOptions
- organism/src/index.ts
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
- body/src/config.ts
- newBody
- brain-engineer.md

## God Nodes (most connected - your core abstractions)
1. `vitest` - 33 edges
2. `inner()` - 32 edges
3. `dist()` - 29 edges
4. `environmentAt()` - 27 edges
5. `ViewerApp` - 25 edges
6. `run()` - 23 edges
7. `perceive()` - 23 edges
8. `WorldScene` - 22 edges
9. `Plan` - 22 edges
10. `MemoryRows` - 22 edges

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

## Communities (99 total, 16 thin omitted)

### Community 0 - "Data Model Schema"
Cohesion: 0.07
Nodes (38): appraisals, beliefs, blueprints, deaths, decisions, dreams, environment, events (+30 more)

### Community 1 - "Contracts Types"
Cohesion: 0.07
Nodes (36): SearchParams, SnapshotFeedResult, ViewerApiConfig, DEMO_CONTEXT, DEMO_EVENTS, DEMO_GOVERNOR, DEMO_LISTS, DEMO_LOG_ENTRIES (+28 more)

### Community 2 - "Hidden-layer leak test"
Cohesion: 0.13
Nodes (18): liaison agent, ops-budget agent, qa-guardian agent, Team and Workflow, Unnamed and ungendered; English inside, Portuguese outside, Hidden-layer leak test, Prompt section order, Free-tier services table (+10 more)

### Community 3 - "Worker Brain & Infrastructure"
Cohesion: 0.17
Nodes (13): brain-engineer agent, Never exceed the free tier, No content censorship / Discoverable, not censored, Fetch guard, Infrastructure security, Interpreter (hidden LLM call 2), LLMProvider adapter and fallback, Tick pipeline (+5 more)

### Community 4 - "Body & Organism Design"
Cohesion: 0.13
Nodes (15): world-engineer agent, Feel, don't read, Components and packages, Symbolic perception (no server renderer), Resident-facing vs Hidden layers, Genesis (one-time), Early death risk, Appraisal (14 dimensions) (+7 more)

### Community 5 - "Log everything, append-only"
Cohesion: 0.17
Nodes (13): data-api-engineer agent, Hard Rules (9), Nothing is planned (no scripting), Read-only public, Admin routes (ADMIN_TOKEN), Public API (GET, edge-cached), Database growth and archiving, Things that would break $0 (+5 more)

### Community 6 - "leak-scan.ts"
Cohesion: 0.05
Nodes (60): MEMORY_CAP, buildPrompt(), InputSchema, Lines, neutraliseMarkers(), PromptRole, ResidentPromptInput, section() (+52 more)

### Community 7 - "Contracts Package Config"
Cohesion: 0.25
Nodes (8): dependencies, zod@^4.6.7, zod, main, name, private, type, version

### Community 8 - "Action & Decision Contract"
Cohesion: 0.33
Nodes (6): LLM proposes, code disposes, Action contract, DecideOutput { review?, action }, OutcomeReview, Intent, expectation, outcome review, lessons, Output discipline and model settings

### Community 15 - "supabase.ts"
Cohesion: 0.16
Nodes (7): DEFAULT_FETCH_TIMEOUT_MS, FetchLike, MAX_SUBREQUESTS, SupabaseDb, Config, Lease, mk()

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

### Community 22 - "deploy-worker"
Cohesion: 0.12
Nodes (15): environment, if, runs-on, steps, jobs, deploy-worker, name, on (+7 more)

### Community 23 - "12 - Security and Secrets (open-source edition)"
Cohesion: 0.17
Nodes (12): 10. Reporting vulnerabilities, 11. Owner checklist before the first public push, 12 - Security and Secrets (open-source edition), 1. Threat model, 2. Secret inventory, 3. Rules (hard), 4. Preventing leaks in the repo, 5. CI/CD safety (+4 more)

### Community 24 - "worker/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, lib, outDir, rootDir, types, extends, include, ../../tsconfig.base.json (+1 more)

### Community 25 - "Decisions Log"
Cohesion: 0.33
Nodes (6): The Resident, Body systems (health, nutrition, hydration, thermo, injury, illness), Decisions Log, Decisions Summary Table, Deviations from original Gemini plan, Truman Show Project

### Community 26 - "pipeline.ts"
Cohesion: 0.11
Nodes (33): applyUsage(), pickMode(), toMemoryRow(), ActionName, ALL_ACTIONS, FORMAT, MENU, menuLines() (+25 more)

### Community 27 - "world/src/actions.ts"
Cohesion: 0.14
Nodes (43): Plan, competentAction(), ACT(), Choice, Policy, run(), Actor, boilWater() (+35 more)

### Community 28 - "api/index.ts"
Cohesion: 0.06
Nodes (45): FakeRpc, memCache(), mk(), TOKEN, ApiEnv, defaultEdgeCache(), EdgeCache, errorJson() (+37 more)

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

### Community 50 - "tick/index.ts"
Cohesion: 0.09
Nodes (10): Db, runTick(), runTickInner(), tickLog(), TickResult, MemoryRows, MindTickDeps, EventInput (+2 more)

### Community 51 - "body/src/types.ts"
Cohesion: 0.14
Nodes (16): ExecOutcome, ActionResult, AdvanceOptions, PolicyView, BodyState, Condition, ConditionName, DeathCause (+8 more)

### Community 52 - "organism.ts"
Cohesion: 0.12
Nodes (28): Senses, BodySignals, DEFAULT_BASELINES, DEFAULT_DECAY_MIN, DEFAULT_ORGANISM_CONFIG, OrganismConfig, consolidateMemories(), NEUTRAL (+20 more)

### Community 53 - "perception.ts"
Cohesion: 0.10
Nodes (36): restSpot(), insideCabin(), ambientLines(), bearingDeg(), cap(), count(), directionPhrase(), distPhrase() (+28 more)

### Community 54 - "log/index.ts"
Cohesion: 0.13
Nodes (16): FakeDb, CommitResult, LoadedState, TickPayload, categoryOf(), idOf(), LIFE_KINDS, Log (+8 more)

### Community 55 - "llm/index.ts"
Cohesion: 0.08
Nodes (43): LiveTickOptions, ClientOptions, extractJson(), GenerateRequest, GenerateResult, LlmClient, FakeReply, GEMINI_DEFAULT_MODEL (+35 more)

### Community 56 - "Lab menus (technical)"
Cohesion: 0.12
Nodes (16): viewer-engineer agent, Everything is replayable, Supabase Postgres, Time model (timeline of timestamped events), Translation layer, Viewer (Vite + Three.js on Pages), Worker API (read-only, edge cached), Worker brain (Cloudflare Cron) (+8 more)

### Community 57 - "worker/src/index.ts"
Cohesion: 0.17
Nodes (17): parseOrigins(), MyMemoryTranslator, Translator, WorkersAiTranslator, b64Bytes(), base64Forms(), clampTimeout(), Env (+9 more)

### Community 59 - "body-organism-engineer agent"
Cohesion: 0.33
Nodes (7): body-organism-engineer agent, Early-wake tick cap (MAX_EARLY_TICKS_DAY), Emotion atlas (spectators only), Physiology vector, Sensation text and unnamed urges, Early wake tick, Autonomic reflexes

### Community 63 - "world.ts"
Cohesion: 0.15
Nodes (25): View, Environment, ActionResult, WORLD_CONFIG, WorldConfig, burn(), burnRate(), fireHeat() (+17 more)

### Community 64 - "tools/index.ts"
Cohesion: 0.12
Nodes (29): ALLOWED_EXACT_TYPES, DEFAULT_MAX_BYTES, DEFAULT_MAX_REDIRECTS, DEFAULT_TIMEOUT_MS, FetchGuardError, FetchGuardErrorCode, guardedFetch(), GuardedFetchOptions (+21 more)

### Community 65 - "climate.ts"
Cohesion: 0.20
Nodes (24): abundanceRamp(), ambientTempOutside(), annual(), baseOutsideTemp(), clockMinute(), dayIndex(), dayLengthHours(), daylightAt() (+16 more)

### Community 66 - "modes.ts"
Cohesion: 0.14
Nodes (15): Budget, canEarlyTick(), DEFAULT_GOVERNOR, governorConfigFromEnv(), InMemoryLease, leaseFree(), LeaseRow, Mode (+7 more)

### Community 67 - "world/src/index.ts"
Cohesion: 0.14
Nodes (22): Clock, DEF(), ITEM_DEFS, ItemDef, NodeDef, PerSeason, ps(), STARTER_KIT (+14 more)

### Community 68 - "testkit.ts"
Cohesion: 0.15
Nodes (13): cfg, GovernorConfig, FakeProvider, LogWriter, runMindTick(), Row, makeAgent(), NEUTRAL_APPRAISAL (+5 more)

### Community 69 - "sensation.ts"
Cohesion: 0.15
Nodes (26): calmBody, sense(), encodeMemoryBody(), makeTemperament(), newOrganism(), targets(), derivePhysiology(), clamp() (+18 more)

### Community 70 - "worker/src/index.test.ts"
Cohesion: 0.27
Nodes (8): flagOn(), gate(), GateDecision, cfg, CpuStats, measureCpu(), sampler(), WORKERS_FREE_CPU_MS

### Community 71 - "WorldScene"
Cohesion: 0.16
Nodes (4): WorldScene, TimelineState, TimelineBarState, Physiology

### Community 72 - "labViews.ts"
Cohesion: 0.14
Nodes (9): createViewerApiClient(), stripTrailingSlash(), ViewerApiClient, downloadBlob(), metricBar(), num(), renderLabTab(), renderLifeTab() (+1 more)

### Community 73 - "main.ts"
Cohesion: 0.14
Nodes (16): StatusPayload, mount, Section, SPEEDS, CameraMode, CharacterRig, SKY_PRESETS, CharacterPoseAnim (+8 more)

### Community 74 - "i18n/index.ts"
Cohesion: 0.16
Nodes (13): EN, I18nKey, ChromeTranslator, ChromeTranslatorApi, DICTS, getChromeTranslator(), memoryCache, stationLabel() (+5 more)

### Community 75 - "memory/index.ts"
Cohesion: 0.20
Nodes (18): affectResonance(), affectSnapshot, clamp(), keywordScore(), makeMemory(), MemoryItem, MemoryKind, NewMemoryDraft (+10 more)

### Community 76 - "t"
Cohesion: 0.29
Nodes (16): t(), Attrs, Child, clear(), el(), formatDateTime(), formatTime(), openContextModal() (+8 more)

### Community 77 - "engine.ts"
Cohesion: 0.19
Nodes (15): ActionT, Allow, executeAction(), fail(), fromWorld(), idleFor(), nearStation(), targetOf() (+7 more)

### Community 78 - "ViewerApp"
Cohesion: 0.27
Nodes (5): UiLang, ViewerApp, getTimelineBounds(), LabTab, LifeTab

### Community 79 - "map.ts"
Cohesion: 0.20
Nodes (16): Station, start(), waterSource(), build(), cache, generateMap(), nearestOnPolyline(), nearestOnSegment() (+8 more)

### Community 80 - "calibration.ts"
Cohesion: 0.17
Nodes (14): BodyAction, CalibrationWorld, makeStubWorld(), Policy, PolicyChoice, randomPolicy(), SimResult, simulatePolicy() (+6 more)

### Community 81 - "body.ts"
Cohesion: 0.33
Nodes (14): addCondition(), addWound(), clamp(), die(), edge(), effectiveTemp(), fmtT(), isoAt() (+6 more)

### Community 82 - "body/src/index.test.ts"
Cohesion: 0.16
Nodes (12): competentPolicy(), idlePolicy(), PACKAGE, awake, coldNight, hot, mild, HINT_BANDS (+4 more)

### Community 83 - "appraise.ts"
Cohesion: 0.19
Nodes (12): appraise(), Appraised, REPEATABLE, MindState, AgentOptions, Appraisal, InterpreterOutput, applyAppraisal() (+4 more)

### Community 84 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, composite, declaration, lib, noEmit, types, extends, include (+1 more)

### Community 85 - "organism/src/index.ts"
Cohesion: 0.18
Nodes (10): EMOTION_ATLAS, EmotionLabel, FEATURES, Proto, PACKAGE, EMOTION_EXTRA, findLeaks(), HIDDEN_NAMES (+2 more)

### Community 86 - "liaison.md"
Cohesion: 0.33
Nodes (5): First, always, Hard rules you protect (flag any request that violates them, ask before changing), Style, Token economy (mandatory), What you do

### Community 87 - "body/src/actions.ts"
Cohesion: 0.33
Nodes (10): HAND_PLACES, performAction(), pushFlinch(), painOf(), wakeReason(), draw(), drawRange(), pick() (+2 more)

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

### Community 96 - "body/src/config.ts"
Cohesion: 0.28
Nodes (8): NewBodyOptions, ALL_CAUSES, BodyConfig, DeepPartial, DEFAULT_BODY_CONFIG, makeBodyConfig(), merge(), WoundType

### Community 97 - "newBody"
Cohesion: 0.43
Nodes (6): newBody(), act(), hourEnv(), run(), scenarios, Activity

### Community 98 - "brain-engineer.md"
Cohesion: 0.33
Nodes (4): Responsibilities, Rules, Token economy (mandatory), LLMProvider

## Knowledge Gaps
- **45 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` (+40 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 556 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `leak-scan.ts` to `tools/index.ts`, `Contracts Types`, `modes.ts`, `newBody`, `testkit.ts`, `sensation.ts`, `worker/src/index.test.ts`, `climate.ts`, `i18n/index.ts`, `memory/index.ts`, `package.json`, `body/src/index.test.ts`, `perception.ts`, `log/index.ts`, `llm/index.ts`, `world/src/actions.ts`, `api/index.ts`, `world.ts`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _45 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Data Model Schema` be split into smaller, more focused modules?**
  _Cohesion score 0.07152496626180836 - nodes in this community are weakly interconnected._
- **Why does `three` connect `viewer/package.json` to `main.ts`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Should `Contracts Types` be split into smaller, more focused modules?**
  _Cohesion score 0.07399577167019028 - nodes in this community are weakly interconnected._
- **Why does `WorldScene` connect `WorldScene` to `main.ts`, `ViewerApp`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Should `Hidden-layer leak test` be split into smaller, more focused modules?**
  _Cohesion score 0.13071895424836602 - nodes in this community are weakly interconnected._