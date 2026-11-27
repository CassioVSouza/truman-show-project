# Graph Report - TrumanShowProject  (2026-11-26)

## Corpus Check
- 219 files · ~157,315 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 18 file(s) not represented in the graph (top: .toml 11, (none) 5, .example 1)

## Summary
- 1892 nodes · 4937 edges · 106 communities (88 shown, 18 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 58 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cc2f248f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Data Model Schema
- contracts/src/index.ts
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
- calibration.ts
- organism.ts
- perception.ts
- testkit.ts
- llm/index.ts
- Lab menus (technical)
- worker/src/index.ts
- pg_temp.assert
- body-organism-engineer agent
- map.ts
- tools/index.ts
- climate.ts
- modes.ts
- actions.test.ts
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
- appraise.ts
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
- body/src/index.test.ts
- shared/src/index.test.ts
- BodyState
- body/src/config.ts
- main.ts
- 0007_viewer_presence.sql
- brain-engineer.md

## God Nodes (most connected - your core abstractions)
1. `ViewerApp` - 49 edges
2. `vitest` - 45 edges
3. `dist()` - 45 edges
4. `inner()` - 41 edges
5. `el()` - 35 edges
6. `t()` - 34 edges
7. `WorldScene` - 34 edges
8. `environmentAt()` - 27 edges
9. `Event` - 26 edges
10. `MindState` - 25 edges

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

## Communities (106 total, 18 thin omitted)

### Community 0 - "Data Model Schema"
Cohesion: 0.07
Nodes (38): appraisals, beliefs, blueprints, deaths, decisions, dreams, environment, events (+30 more)

### Community 1 - "contracts/src/index.ts"
Cohesion: 0.10
Nodes (19): Action, base, DecideOutput, EmotionLabel, LLMErrorKind, LogPageResponse, OutcomeReview, RestPlacement (+11 more)

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
Nodes (21): cleanInput(), FAKE_APPRAISAL, FAKE_BODY, FAKE_EMOTION_TOP3, FAKE_ORGANISM, FAKE_PHYSIOLOGY, FAKE_SECRETS, hiddenKeyNames() (+13 more)

### Community 7 - "Contracts Package Config"
Cohesion: 0.25
Nodes (8): dependencies, zod@^4.6.7, zod, main, name, private, type, version

### Community 8 - "Action & Decision Contract"
Cohesion: 0.33
Nodes (6): LLM proposes, code disposes, Action contract, DecideOutput { review?, action }, OutcomeReview, Intent, expectation, outcome review, lessons, Output discipline and model settings

### Community 15 - "hudHelpers.ts"
Cohesion: 0.10
Nodes (30): UiLang, TimeOfDay, formatTime(), buildTimelineMarkers(), computeVitalTrends(), CountdownBadge, CountdownInput, DECISION_CADENCE_MS (+22 more)

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
Cohesion: 0.07
Nodes (53): applyUsage(), Budget, DEFAULT_TIME_SCALE, GovernorConfig, pickMode(), affectSnapshot, makeMemory(), MemoryItem (+45 more)

### Community 27 - "world/src/actions.ts"
Cohesion: 0.10
Nodes (59): ActionT, Allow, ExecOutcome, fail(), fromWorld(), Plan, targetOf(), competentAction() (+51 more)

### Community 28 - "api/index.ts"
Cohesion: 0.05
Nodes (49): FakeRpc, memCache(), mk(), TOKEN, ApiEnv, defaultEdgeCache(), EdgeCache, errorJson() (+41 more)

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
Cohesion: 0.14
Nodes (7): dist2D(), distToPolyline(), WorldScene, TimelineState, Physiology, Station, WorldMap

### Community 46 - ".prettierrc.json"
Cohesion: 0.50
Nodes (3): endOfLine, printWidth, trailingComma

### Community 50 - "testkit.ts"
Cohesion: 0.08
Nodes (24): GateDecision, cfg, DEFAULT_GOVERNOR, InMemoryLease, FakeProvider, LogWriter, budget, providers (+16 more)

### Community 51 - "calibration.ts"
Cohesion: 0.17
Nodes (14): effectiveTemp(), CalibrationWorld, makeStubWorld(), Policy, PolicyChoice, randomPolicy(), SimResult, simulatePolicy() (+6 more)

### Community 52 - "organism.ts"
Cohesion: 0.07
Nodes (68): Senses, BodySignals, EMOTION_ATLAS, EmotionLabel, FEATURES, Proto, DEFAULT_BASELINES, DEFAULT_DECAY_MIN (+60 more)

### Community 53 - "perception.ts"
Cohesion: 0.12
Nodes (30): ambientLines(), bearingDeg(), cap(), count(), directionPhrase(), distPhrase(), lookAt(), perceive() (+22 more)

### Community 54 - "testkit.ts"
Cohesion: 0.12
Nodes (20): FakeDb, DEFAULT_FETCH_TIMEOUT_MS, FetchLike, MAX_SUBREQUESTS, CommitResult, Db, LoadedState, TickPayload (+12 more)

### Community 55 - "llm/index.ts"
Cohesion: 0.12
Nodes (28): ClientOptions, GenerateRequest, GenerateResult, FakeReply, GEMINI_DEFAULT_MODEL, GeminiProvider, GeminiResponse, httpError() (+20 more)

### Community 56 - "Lab menus (technical)"
Cohesion: 0.20
Nodes (10): viewer-engineer agent, Supabase Postgres, Time model (timeline of timestamped events), Viewer (Vite + Three.js on Pages), Worker API (read-only, edge cached), Worker brain (Cloudflare Cron), Event (engine to viewer), Phase 1B Mind, web, public (+2 more)

### Community 57 - "worker/src/index.ts"
Cohesion: 0.09
Nodes (28): parseOrigins(), MyMemoryTranslator, Translator, WorkersAiTranslator, SupabaseDb, b64Bytes(), base64Forms(), clampTimeout() (+20 more)

### Community 59 - "body-organism-engineer agent"
Cohesion: 0.33
Nodes (7): body-organism-engineer agent, Early-wake tick cap (MAX_EARLY_TICKS_DAY), Emotion atlas (spectators only), Physiology vector, Sensation text and unnamed urges, Early wake tick, Autonomic reflexes

### Community 63 - "map.ts"
Cohesion: 0.30
Nodes (10): build(), cache, nearestOnPolyline(), polar(), round2(), hash32(), rand01(), rngFrom() (+2 more)

### Community 64 - "tools/index.ts"
Cohesion: 0.12
Nodes (28): ALLOWED_EXACT_TYPES, DEFAULT_MAX_BYTES, DEFAULT_MAX_REDIRECTS, DEFAULT_TIMEOUT_MS, FetchGuardError, FetchGuardErrorCode, guardedFetch(), GuardedFetchOptions (+20 more)

### Community 65 - "climate.ts"
Cohesion: 0.13
Nodes (37): abundanceRamp(), ambientTempOutside(), annual(), baseOutsideTemp(), Clock, clockMinute(), dayIndex(), dayLengthHours() (+29 more)

### Community 66 - "modes.ts"
Cohesion: 0.13
Nodes (16): canEarlyTick(), clampTimeScale(), governorConfigFromEnv(), leaseFree(), LeaseRow, MAX_TIME_SCALE, MIN_TIME_SCALE, Mode (+8 more)

### Community 67 - "actions.test.ts"
Cohesion: 0.11
Nodes (37): idleFor(), skills, start(), WORLD_CONFIG, burn(), burnRate(), fireHeat(), fireState() (+29 more)

### Community 68 - "testkit.ts"
Cohesion: 0.11
Nodes (26): AMBIGUOUS_PLAIN_WORDS, BAR_PATTERNS, BAR_WORDS, BW, EMOTION_WORDS, esc(), framingRe(), GIVEN_NAMES (+18 more)

### Community 69 - "worldScene.ts"
Cohesion: 0.11
Nodes (25): SnapshotFeed, FIRE_APPEARANCE, FireProps, restPose(), intersectsSceneryCorridor(), SceneryCorridor, sceneryCorridors(), SceneryFootprint (+17 more)

### Community 70 - "prompts/index.ts"
Cohesion: 0.13
Nodes (21): buildPrompt(), BuiltPrompt, InputSchema, Lines, neutraliseMarkers(), PromptRole, ResidentPromptInput, section() (+13 more)

### Community 71 - "viewer/package.json"
Cohesion: 0.11
Nodes (20): dependencies, three@^0.174.0, @truman/contracts@workspace:*, @truman/world@workspace:*, devDependencies, @types/three@^0.174.0, vite@^6.2.0, @truman/contracts (+12 more)

### Community 72 - "llm.test.ts"
Cohesion: 0.22
Nodes (5): extractJson(), LlmClient, req, schema, repairMessages()

### Community 73 - "newBody"
Cohesion: 0.16
Nodes (16): advanceBody(), catchUp(), needsFineStep(), newBody(), act(), hourEnv(), run(), scenarios (+8 more)

### Community 74 - "i18n/index.ts"
Cohesion: 0.13
Nodes (17): EN, I18nKey, ChromeTranslator, ChromeTranslatorApi, DICTS, getChromeTranslator(), memoryCache, stationLabel() (+9 more)

### Community 75 - "memory/index.ts"
Cohesion: 0.21
Nodes (16): affectResonance(), clamp(), keywordScore(), MEMORY_CAP, MemoryKind, NewMemoryDraft, pruneMemories(), recallMemories() (+8 more)

### Community 76 - "el"
Cohesion: 0.14
Nodes (28): t(), Attrs, Child, clear(), el(), formatDateTime(), FLAT_VITAL_TRENDS, formatDecisionCountdown() (+20 more)

### Community 77 - "tick/index.ts"
Cohesion: 0.11
Nodes (10): flagOn(), gate(), SnapshotPublisher, runTick(), runTickInner(), tickLog(), TickResult, MindTickDeps (+2 more)

### Community 78 - "ViewerApp"
Cohesion: 0.22
Nodes (4): ViewerApp, CameraMode, LabTab, LifeTab

### Community 79 - "Task 0 (verify free-tier limits)"
Cohesion: 0.14
Nodes (14): ops-budget agent, world-engineer agent, Symbolic perception (no server renderer), Free-tier services table, Task 0 (verify free-tier limits), Genesis (one-time), Phase 0 Foundations, Early death risk (+6 more)

### Community 80 - "api/client.ts"
Cohesion: 0.10
Nodes (20): createViewerApiClient(), SearchParams, SnapshotFeedResult, StatusPayload, stripTrailingSlash(), ViewerApiClient, ViewerApiConfig, DEMO_CONTEXT (+12 more)

### Community 81 - "dist"
Cohesion: 0.18
Nodes (35): campfireSite(), dryGround(), restHeading(), restSpot(), dist(), insideCabin(), nearestOnSegment(), blocked() (+27 more)

### Community 82 - "appraise.ts"
Cohesion: 0.36
Nodes (7): buildInterpreterPrompt(), appraise(), Appraised, REPEATABLE, Appraisal, InterpreterOutput, ruleAppraisal()

### Community 83 - "snapshot/index.ts"
Cohesion: 0.10
Nodes (24): Lease, LiveTickOptions, animationNames, createSnapshotPublisher(), isoDate(), publicEvents(), publicInventory(), SnapshotEventReader (+16 more)

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

### Community 96 - "ViewerBeat"
Cohesion: 0.19
Nodes (5): BEAT_INTERVAL_MS, getViewerToken(), TokenStore, ViewerBeat, ViewerBeatDeps

### Community 97 - "body.ts"
Cohesion: 0.17
Nodes (24): addCondition(), addWound(), clamp(), die(), edge(), fmtT(), isoAt(), mark() (+16 more)

### Community 98 - "body/src/index.test.ts"
Cohesion: 0.16
Nodes (12): competentPolicy(), idlePolicy(), PACKAGE, awake, coldNight, hot, mild, HINT_BANDS (+4 more)

### Community 101 - "BodyState"
Cohesion: 0.40
Nodes (5): AdvanceOptions, PolicyView, BodyState, View, Environment

### Community 102 - "body/src/config.ts"
Cohesion: 0.28
Nodes (8): NewBodyOptions, ALL_CAUSES, BodyConfig, DeepPartial, DEFAULT_BODY_CONFIG, makeBodyConfig(), merge(), WoundType

### Community 103 - "main.ts"
Cohesion: 0.18
Nodes (17): mount, Section, SPEEDS, LivePlayback, livePlayhead(), liveTimelineBounds(), receiveLivePlayback(), REPLAYABLE_EVENT_KINDS (+9 more)

### Community 104 - "0007_viewer_presence.sql"
Cohesion: 0.83
Nodes (3): api_viewer_beat(), viewer_presence, viewer_presence_seen_idx

### Community 105 - "brain-engineer.md"
Cohesion: 0.33
Nodes (4): Responsibilities, Rules, Token economy (mandatory), LLMProvider

## Knowledge Gaps
- **45 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` (+40 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 625 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `testkit.ts` to `leak-scan.ts`, `hudHelpers.ts`, `package.json`, `world/src/actions.ts`, `api/index.ts`, `organism.ts`, `testkit.ts`, `worker/src/index.ts`, `tools/index.ts`, `climate.ts`, `modes.ts`, `actions.test.ts`, `worldScene.ts`, `llm.test.ts`, `newBody`, `i18n/index.ts`, `memory/index.ts`, `api/client.ts`, `dist`, `snapshot/index.ts`, `ViewerBeat`, `body/src/index.test.ts`, `shared/src/index.test.ts`, `main.ts`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _45 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Data Model Schema` be split into smaller, more focused modules?**
  _Cohesion score 0.07152496626180836 - nodes in this community are weakly interconnected._
- **Why does `ViewerApp` connect `ViewerApp` to `ViewerBeat`, `worldScene.ts`, `main.ts`, `el`, `WorldScene`, `hudHelpers.ts`, `api/client.ts`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Should `contracts/src/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Why does `three` connect `worldScene.ts` to `viewer/package.json`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Should `leak-scan.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11491935483870967 - nodes in this community are weakly interconnected._