# Graph Report - TrumanShowProject  (2026-11-26)

## Corpus Check
- 155 files · ~97,528 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 5, .toml 3, .example 1)

## Summary
- 1342 nodes · 3112 edges · 72 communities (58 shown, 14 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 32 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a732a6bc`
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
- worker/src/index.test.ts
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
- MemoryRows
- body.ts
- organism.ts
- perception.ts
- log/index.ts
- llm/index.ts
- Lab menus (technical)
- worker/src/index.ts
- pg_temp.assert
- body-organism-engineer agent
- world.ts
- map.ts
- climate.ts
- modes.ts
- perception.test.ts
- testkit.ts
- api.test.ts
- tick/index.ts
- RateLimiter

## God Nodes (most connected - your core abstractions)
1. `dist()` - 29 edges
2. `inner()` - 27 edges
3. `environmentAt()` - 27 edges
4. `vitest` - 26 edges
5. `run()` - 23 edges
6. `perceive()` - 23 edges
7. `Plan` - 22 edges
8. `gather()` - 21 edges
9. `mapOf()` - 20 edges
10. `TickPayload` - 19 edges

## Surprising Connections (you probably didn't know these)
- `Decisions Summary Table` --references--> `Decisions Log`  [INFERRED]
  README.md → docs/DECISIONS.md
- `Truman Show Project` --references--> `Tick pipeline`  [INFERRED]
  README.md → docs/02-architecture.md
- `Hard Rules (9)` --conceptually_related_to--> `No content censorship / Discoverable, not censored`  [EXTRACTED]
  CLAUDE.md → docs/01-vision-and-principles.md
- `Things that would break $0` --rationale_for--> `Hard Rules (9)`  [INFERRED]
  docs/05-free-tier-budget.md → CLAUDE.md
- `appraise()` --calls--> `applyAppraisal()`  [EXTRACTED]
  apps/worker/src/tick/appraise.ts → packages/organism/src/organism.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Hidden state to Resident sensation pipeline** — docs_08_embodied_feelings_and_understanding_appraisal, docs_08_embodied_feelings_and_understanding_organism_state, docs_08_embodied_feelings_and_understanding_physiology_vector, docs_08_embodied_feelings_and_understanding_sensation_text, docs_08_embodied_feelings_and_understanding_emotion_atlas [EXTRACTED 1.00]
- **Free-tier cost control and degradation** — docs_05_free_tier_budget_governor_modes, docs_05_free_tier_budget_per_day_plan, docs_05_free_tier_budget_db_growth, docs_05_free_tier_budget_early_ticks, docs_05_free_tier_budget_task_0 [INFERRED 0.85]
- **Hidden-layer protection (contracts, leak test, QA, persona)** — docs_03_contracts_two_layers, docs_03_contracts_leak_test, docs_11_persona_and_behaviour_persona_prompt, _claude_agents_qa_guardian_qa_guardian, _claude_agents_brain_engineer_brain_engineer [INFERRED 0.85]

## Communities (72 total, 14 thin omitted)

### Community 0 - "Data Model Schema"
Cohesion: 0.07
Nodes (38): appraisals, beliefs, blueprints, deaths, decisions, dreams, environment, events (+30 more)

### Community 1 - "Contracts Types"
Cohesion: 0.07
Nodes (25): Action, base, DecideOutput, EmotionLabel, Event, InventoryItem, ListResponse, LLMErrorKind (+17 more)

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
Nodes (57): buildPrompt(), InputSchema, Lines, neutraliseMarkers(), PromptRole, ResidentPromptInput, section(), UNTRUSTED_CLOSE (+49 more)

### Community 7 - "Contracts Package Config"
Cohesion: 0.25
Nodes (8): dependencies, zod@^4.6.7, zod, main, name, private, type, version

### Community 8 - "Action & Decision Contract"
Cohesion: 0.33
Nodes (6): LLM proposes, code disposes, Action contract, DecideOutput { review?, action }, OutcomeReview, Intent, expectation, outcome review, lessons, Output discipline and model settings

### Community 15 - "worker/src/index.test.ts"
Cohesion: 0.10
Nodes (19): DEFAULT_FETCH_TIMEOUT_MS, FetchLike, MAX_SUBREQUESTS, SupabaseDb, b64Bytes(), base64Forms(), clampTimeout(), Config (+11 more)

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
Nodes (28): applyUsage(), Mode, pickMode(), LogRef, executeAction(), targetOf(), ActionT, describeChoice() (+20 more)

### Community 27 - "world/src/actions.ts"
Cohesion: 0.11
Nodes (57): ActionT, Allow, ExecOutcome, fail(), fromWorld(), Plan, ViewerEvent, competentAction() (+49 more)

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
Cohesion: 0.50
Nodes (3): name, private, version

### Community 46 - ".prettierrc.json"
Cohesion: 0.50
Nodes (3): endOfLine, printWidth, trailingComma

### Community 50 - "MemoryRows"
Cohesion: 0.09
Nodes (4): Log, MemoryRows, EventInput, TickRows

### Community 51 - "body.ts"
Cohesion: 0.05
Nodes (83): idleFor(), ActionResult, HAND_PLACES, performAction(), pushFlinch(), addCondition(), addWound(), advanceBody() (+75 more)

### Community 52 - "organism.ts"
Cohesion: 0.06
Nodes (74): clamp(), cognition, organismStep(), physiologyNow(), senseNow(), Senses, bodySignals(), skillHints() (+66 more)

### Community 53 - "perception.ts"
Cohesion: 0.13
Nodes (29): fireHeat(), fireState(), ambientLines(), cap(), count(), distPhrase(), lookAt(), perceive() (+21 more)

### Community 54 - "log/index.ts"
Cohesion: 0.16
Nodes (14): FakeDb, CommitResult, LoadedState, TickPayload, categoryOf(), idOf(), LIFE_KINDS, LogDraft (+6 more)

### Community 55 - "llm/index.ts"
Cohesion: 0.06
Nodes (52): ClientOptions, extractJson(), GenerateRequest, GenerateResult, LlmClient, FakeProvider, FakeReply, GEMINI_DEFAULT_MODEL (+44 more)

### Community 56 - "Lab menus (technical)"
Cohesion: 0.12
Nodes (16): viewer-engineer agent, Everything is replayable, Supabase Postgres, Time model (timeline of timestamped events), Translation layer, Viewer (Vite + Three.js on Pages), Worker API (read-only, edge cached), Worker brain (Cloudflare Cron) (+8 more)

### Community 57 - "worker/src/index.ts"
Cohesion: 0.15
Nodes (15): parseOrigins(), AiBinding, chunkText(), FetchLike, MAX_TRANSLATE_CHARS, MyMemoryTranslator, translateWithFallback(), Translator (+7 more)

### Community 59 - "body-organism-engineer agent"
Cohesion: 0.33
Nodes (7): body-organism-engineer agent, Early-wake tick cap (MAX_EARLY_TICKS_DAY), Emotion atlas (spectators only), Physiology vector, Sensation text and unnamed urges, Early wake tick, Autonomic reflexes

### Community 63 - "world.ts"
Cohesion: 0.12
Nodes (31): Clock, DEF(), ITEM_DEFS, ItemDef, NODE_DEFS, PerSeason, ps(), STARTER_KIT (+23 more)

### Community 64 - "map.ts"
Cohesion: 0.18
Nodes (19): nearStation(), restSpot(), build(), cache, dist(), insideCabin(), nearestOnPolyline(), nearestOnSegment() (+11 more)

### Community 65 - "climate.ts"
Cohesion: 0.18
Nodes (28): abundanceRamp(), ambientTempOutside(), annual(), baseOutsideTemp(), clockMinute(), dayIndex(), dayLengthHours(), daylightAt() (+20 more)

### Community 66 - "modes.ts"
Cohesion: 0.14
Nodes (14): Budget, canEarlyTick(), DEFAULT_GOVERNOR, governorConfigFromEnv(), InMemoryLease, Lease, leaseFree(), LeaseRow (+6 more)

### Community 67 - "perception.test.ts"
Cohesion: 0.21
Nodes (11): start(), describeInventory(), invAdd(), sameProps(), starterInventory(), generateMap(), bearingDeg(), directionPhrase() (+3 more)

### Community 68 - "testkit.ts"
Cohesion: 0.19
Nodes (11): GovernorConfig, LogWriter, runMindTick(), Row, makeAgent(), NEUTRAL_APPRAISAL, NEUTRAL_REVIEW, SimDb (+3 more)

### Community 69 - "api.test.ts"
Cohesion: 0.14
Nodes (10): FakeRpc, memCache(), mk(), TOKEN, Rpc, DB_LIMIT_BYTES, sizeMode, sizeReport() (+2 more)

### Community 70 - "tick/index.ts"
Cohesion: 0.26
Nodes (9): Db, flagOn(), gate(), GateDecision, runTickInner(), tickLog(), TickResult, MindTickDeps (+1 more)

### Community 71 - "RateLimiter"
Cohesion: 0.22
Nodes (4): ApiEnv, EdgeCache, RateLimiter, ApiContext

## Knowledge Gaps
- **44 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` (+39 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 473 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `leak-scan.ts` to `map.ts`, `climate.ts`, `modes.ts`, `perception.test.ts`, `testkit.ts`, `api.test.ts`, `worker/src/index.test.ts`, `package.json`, `body.ts`, `organism.ts`, `log/index.ts`, `llm/index.ts`, `world/src/actions.ts`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _44 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Data Model Schema` be split into smaller, more focused modules?**
  _Cohesion score 0.07152496626180836 - nodes in this community are weakly interconnected._
- **Why does `TickRows` connect `MemoryRows` to `pipeline.ts`, `tick/index.ts`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Should `Contracts Types` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `Hidden-layer leak test` be split into smaller, more focused modules?**
  _Cohesion score 0.13071895424836602 - nodes in this community are weakly interconnected._
- **Should `Body & Organism Design` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._