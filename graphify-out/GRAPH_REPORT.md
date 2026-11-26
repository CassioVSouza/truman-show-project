# Graph Report - TrumanShowProject  (2026-11-25)

## Corpus Check
- 120 files · ~70,922 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 5, .toml 3, .example 1)

## Summary
- 987 nodes · 2049 edges · 68 communities (52 shown, 16 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b308b512`
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
- 0002_security_and_functions.sql
- worker/package.json
- ci.yml
- compilerOptions
- deploy-worker
- 12 - Security and Secrets (open-source edition)
- worker/tsconfig.json
- Decisions Log
- Hard Rules (9)
- world/src/actions.ts
- Resource economy and 14-day gentle start
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
- body.ts
- organism.ts
- perception.ts
- leak.leak.test.ts
- build.ts
- Lab menus (technical)
- hidden.ts
- pg_temp.assert
- body-organism-engineer agent
- world/src/index.ts
- world.ts
- climate.ts
- map.ts
- perception.test.ts

## God Nodes (most connected - your core abstractions)
1. `dist()` - 27 edges
2. `run()` - 23 edges
3. `environmentAt()` - 21 edges
4. `gather()` - 19 edges
5. `weatherAt()` - 19 edges
6. `perceive()` - 19 edges
7. `makeFire()` - 17 edges
8. `vitest` - 16 edges
9. `mapOf()` - 16 edges
10. `compilerOptions` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Decisions Summary Table` --references--> `Decisions Log`  [INFERRED]
  README.md → docs/DECISIONS.md
- `Truman Show Project` --references--> `Tick pipeline`  [INFERRED]
  README.md → docs/02-architecture.md
- `Hard Rules (9)` --conceptually_related_to--> `Read-only public`  [EXTRACTED]
  CLAUDE.md → docs/01-vision-and-principles.md
- `Things that would break $0` --rationale_for--> `Hard Rules (9)`  [INFERRED]
  docs/05-free-tier-budget.md → CLAUDE.md
- `brain-engineer agent` --references--> `Hidden-layer leak test`  [EXTRACTED]
  .claude/agents/brain-engineer.md → docs/03-contracts.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Hidden state to Resident sensation pipeline** — docs_08_embodied_feelings_and_understanding_appraisal, docs_08_embodied_feelings_and_understanding_organism_state, docs_08_embodied_feelings_and_understanding_physiology_vector, docs_08_embodied_feelings_and_understanding_sensation_text, docs_08_embodied_feelings_and_understanding_emotion_atlas [EXTRACTED 1.00]
- **Free-tier cost control and degradation** — docs_05_free_tier_budget_governor_modes, docs_05_free_tier_budget_per_day_plan, docs_05_free_tier_budget_db_growth, docs_05_free_tier_budget_early_ticks, docs_05_free_tier_budget_task_0 [INFERRED 0.85]
- **Hidden-layer protection (contracts, leak test, QA, persona)** — docs_03_contracts_two_layers, docs_03_contracts_leak_test, docs_11_persona_and_behaviour_persona_prompt, _claude_agents_qa_guardian_qa_guardian, _claude_agents_brain_engineer_brain_engineer [INFERRED 0.85]

## Communities (68 total, 16 thin omitted)

### Community 0 - "Data Model Schema"
Cohesion: 0.07
Nodes (38): appraisals, beliefs, blueprints, deaths, decisions, dreams, environment, events (+30 more)

### Community 1 - "Contracts Types"
Cohesion: 0.07
Nodes (24): Action, base, DecideOutput, EmotionLabel, Event, InterpreterOutput, InventoryItem, LLMErrorKind (+16 more)

### Community 2 - "Hidden-layer leak test"
Cohesion: 0.13
Nodes (18): liaison agent, ops-budget agent, qa-guardian agent, Team and Workflow, Unnamed and ungendered; English inside, Portuguese outside, Hidden-layer leak test, Prompt section order, Free-tier services table (+10 more)

### Community 3 - "Worker Brain & Infrastructure"
Cohesion: 0.22
Nodes (10): brain-engineer agent, Never exceed the free tier, Fetch guard, Interpreter (hidden LLM call 2), LLMProvider adapter and fallback, Tick pipeline, LLMProvider interface and errors, Governor modes (+2 more)

### Community 4 - "Body & Organism Design"
Cohesion: 0.25
Nodes (8): Feel, don't read, Components and packages, Resident-facing vs Hidden layers, Appraisal (14 dimensions), Feel a body, never a number, Memory coupling and sleep consolidation, Organism state (hidden), Mind systems

### Community 5 - "Log everything, append-only"
Cohesion: 0.18
Nodes (12): data-api-engineer agent, Read-only public, Everything is replayable, Admin routes (ADMIN_TOKEN), LogEntry (canonical, append-only), Public API (GET, edge-cached), Database growth and archiving, Platform terms exposure risk (+4 more)

### Community 6 - "leak-scan.ts"
Cohesion: 0.12
Nodes (24): AMBIGUOUS_PLAIN_WORDS, BAR_PATTERNS, BAR_WORDS, BW, EMOTION_WORDS, esc(), framingRe(), GIVEN_NAMES (+16 more)

### Community 7 - "Contracts Package Config"
Cohesion: 0.25
Nodes (8): dependencies, zod@^4.6.7, zod, main, name, private, type, version

### Community 8 - "Action & Decision Contract"
Cohesion: 0.33
Nodes (6): LLM proposes, code disposes, Action contract, DecideOutput { review?, action }, OutcomeReview, Intent, expectation, outcome review, lessons, Output discipline and model settings

### Community 15 - "worker/src/index.test.ts"
Cohesion: 0.08
Nodes (34): FakeDb, DEFAULT_FETCH_TIMEOUT_MS, FetchLike, MAX_SUBREQUESTS, SupabaseDb, CommitResult, Db, LoadedState (+26 more)

### Community 16 - "package.json"
Cohesion: 0.08
Nodes (26): devDependencies, eslint@^10.15.0, @eslint/js@^10.0.1, prettier@^3.3.0, typescript@^6.0.3, typescript-eslint@^8.0.0, vitest@^4.1.11, engines (+18 more)

### Community 17 - "0001_schema.sql"
Cohesion: 0.07
Nodes (38): appraisals, beliefs, blueprints, deaths, decisions, dreams, environment, events (+30 more)

### Community 18 - "0002_security_and_functions.sql"
Cohesion: 0.18
Nodes (10): events_append_only, events_no_truncate, log_entries_append_only, log_entries_no_truncate, resident_no_truncate, resident_permanent_death, search_translations(), tick_commit() (+2 more)

### Community 19 - "worker/package.json"
Cohesion: 0.12
Nodes (20): dependencies, @truman/contracts@workspace:*, @truman/shared@workspace:*, zod@^4.6.7, devDependencies, @cloudflare/workers-types@^4.20250101.0, @types/node@^18.19.130, wrangler@^4.0.0 (+12 more)

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

### Community 26 - "Hard Rules (9)"
Cohesion: 0.29
Nodes (7): Hard Rules (9), No content censorship / Discoverable, not censored, Nothing is planned (no scripting), Infrastructure security, Things that would break $0, End states (pause, hibernate, death, open-ended), Death (permanent, no respawn)

### Community 27 - "world/src/actions.ts"
Cohesion: 0.14
Nodes (40): ACT(), Choice, Policy, run(), View, Environment, Actor, boilWater() (+32 more)

### Community 28 - "Resource economy and 14-day gentle start"
Cohesion: 0.22
Nodes (9): world-engineer agent, Symbolic perception (no server renderer), Genesis (one-time), Early death risk, Provider-side safety refusals risk, Risk register (20 risks), Temperament, Resource economy and 14-day gentle start (+1 more)

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
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json

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
Nodes (10): devDependencies, @truman/contracts@workspace:*, @truman/world@workspace:*, @truman/contracts, main, name, private, type (+2 more)

### Community 38 - "organism/package.json"
Cohesion: 0.33
Nodes (5): main, name, private, type, version

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

### Community 51 - "body.ts"
Cohesion: 0.06
Nodes (80): ActionResult, BodyAction, HAND_PLACES, performAction(), pushFlinch(), addCondition(), addWound(), advanceBody() (+72 more)

### Community 52 - "organism.ts"
Cohesion: 0.06
Nodes (70): EMOTION_ATLAS, EmotionLabel, emotionLabels(), FEATURES, Proto, DEFAULT_BASELINES, DEFAULT_DECAY_MIN, DEFAULT_ORGANISM_CONFIG (+62 more)

### Community 53 - "perception.ts"
Cohesion: 0.12
Nodes (37): restSpot(), waterSource(), fireHeat(), fireState(), dist(), insideCabin(), nearestOnPolyline(), ambientLines() (+29 more)

### Community 54 - "leak.leak.test.ts"
Cohesion: 0.16
Nodes (11): cleanInput(), FAKE_SECRETS, hiddenKeyNames(), PROMPT_MARKERS, rules, SRC, walk(), EMOTION_LABELS (+3 more)

### Community 55 - "build.ts"
Cohesion: 0.23
Nodes (10): buildPrompt(), BuiltPrompt, InputSchema, Lines, neutraliseMarkers(), ResidentPromptInput, section(), UNTRUSTED_CLOSE (+2 more)

### Community 56 - "Lab menus (technical)"
Cohesion: 0.18
Nodes (11): viewer-engineer agent, Supabase Postgres, Time model (timeline of timestamped events), Translation layer, Viewer (Vite + Three.js on Pages), Worker API (read-only, edge cached), Worker brain (Cloudflare Cron), Event (engine to viewer) (+3 more)

### Community 57 - "hidden.ts"
Cohesion: 0.18
Nodes (10): FAKE_APPRAISAL, FAKE_BODY, FAKE_EMOTION_TOP3, FAKE_ORGANISM, FAKE_PHYSIOLOGY, hiddenValueStrings(), Appraisal, BodyState (+2 more)

### Community 59 - "body-organism-engineer agent"
Cohesion: 0.33
Nodes (7): body-organism-engineer agent, Early-wake tick cap (MAX_EARLY_TICKS_DAY), Emotion atlas (spectators only), Physiology vector, Sensation text and unnamed urges, Early wake tick, Autonomic reflexes

### Community 63 - "world/src/index.ts"
Cohesion: 0.12
Nodes (26): Facts, DEF(), ITEM_DEFS, ItemDef, NODE_DEFS, NodeDef, PerSeason, ps() (+18 more)

### Community 64 - "world.ts"
Cohesion: 0.15
Nodes (21): ActionResult, WORLD_CONFIG, WorldConfig, burn(), burnRate(), dijkstra(), nearestWaypoint(), planWalk() (+13 more)

### Community 65 - "climate.ts"
Cohesion: 0.22
Nodes (22): abundanceRamp(), ambientTempOutside(), annual(), baseOutsideTemp(), Clock, clockMinute(), dayIndex(), dayLengthHours() (+14 more)

### Community 66 - "map.ts"
Cohesion: 0.28
Nodes (11): Station, build(), cache, nearestOnSegment(), polar(), round2(), WorldMap, hash32() (+3 more)

### Community 67 - "perception.test.ts"
Cohesion: 0.38
Nodes (5): start(), generateMap(), BANNED, cases, createWorld()

## Knowledge Gaps
- **44 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` (+39 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 374 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `package.json` to `world.ts`, `climate.ts`, `perception.test.ts`, `worker/src/index.test.ts`, `body.ts`, `organism.ts`, `leak.leak.test.ts`, `world/src/actions.ts`?**
  _High betweenness centrality (0.181) - this node is a cross-community bridge._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _44 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Data Model Schema` be split into smaller, more focused modules?**
  _Cohesion score 0.07152496626180836 - nodes in this community are weakly interconnected._
- **Why does `Truman Show Project` connect `Decisions Log` to `Worker Brain & Infrastructure`, `Code of Conduct`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Should `Contracts Types` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
- **Should `Hidden-layer leak test` be split into smaller, more focused modules?**
  _Cohesion score 0.13071895424836602 - nodes in this community are weakly interconnected._
- **Should `leak-scan.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12333333333333334 - nodes in this community are weakly interconnected._