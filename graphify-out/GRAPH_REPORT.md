# Graph Report - TrumanShowProject  (2026-11-25)

## Corpus Check
- 84 files · ~31,538 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 5, .toml 3, .example 1)

## Summary
- 608 nodes · 788 edges · 51 communities (39 shown, 12 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0ba9abd5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Data Model Schema
- Contracts Types
- Hidden-layer leak test
- Worker Brain & Infrastructure
- Body & Organism Design
- Lab menus (technical)
- leak.leak.test.ts
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
- Task 0 (verify free-tier limits)
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

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `log_entries` - 13 edges
3. `log_entries` - 13 edges
4. `SupabaseDb` - 12 edges
5. `vitest` - 12 edges
6. `12 - Security and Secrets (open-source edition)` - 12 edges
7. `pg_temp.assert()` - 10 edges
8. `Tick pipeline` - 10 edges
9. `scanPrompt()` - 9 edges
10. `Decisions Log` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Hard Rules (9)` --conceptually_related_to--> `No content censorship / Discoverable, not censored`  [EXTRACTED]
  CLAUDE.md → docs/01-vision-and-principles.md
- `Hard Rules (9)` --conceptually_related_to--> `Read-only public`  [EXTRACTED]
  CLAUDE.md → docs/01-vision-and-principles.md
- `Things that would break $0` --rationale_for--> `Hard Rules (9)`  [INFERRED]
  docs/05-free-tier-budget.md → CLAUDE.md
- `Decisions Summary Table` --references--> `Decisions Log`  [INFERRED]
  README.md → docs/DECISIONS.md
- `Truman Show Project` --references--> `Tick pipeline`  [INFERRED]
  README.md → docs/02-architecture.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Hidden state to Resident sensation pipeline** — docs_08_embodied_feelings_and_understanding_appraisal, docs_08_embodied_feelings_and_understanding_organism_state, docs_08_embodied_feelings_and_understanding_physiology_vector, docs_08_embodied_feelings_and_understanding_sensation_text, docs_08_embodied_feelings_and_understanding_emotion_atlas [EXTRACTED 1.00]
- **Free-tier cost control and degradation** — docs_05_free_tier_budget_governor_modes, docs_05_free_tier_budget_per_day_plan, docs_05_free_tier_budget_db_growth, docs_05_free_tier_budget_early_ticks, docs_05_free_tier_budget_task_0 [INFERRED 0.85]
- **Hidden-layer protection (contracts, leak test, QA, persona)** — docs_03_contracts_two_layers, docs_03_contracts_leak_test, docs_11_persona_and_behaviour_persona_prompt, _claude_agents_qa_guardian_qa_guardian, _claude_agents_brain_engineer_brain_engineer [INFERRED 0.85]

## Communities (51 total, 12 thin omitted)

### Community 0 - "Data Model Schema"
Cohesion: 0.07
Nodes (38): appraisals, beliefs, blueprints, deaths, decisions, dreams, environment, events (+30 more)

### Community 1 - "Contracts Types"
Cohesion: 0.07
Nodes (25): Action, base, DecideOutput, EmotionLabel, Event, InterpreterOutput, InventoryItem, LLMErrorKind (+17 more)

### Community 2 - "Hidden-layer leak test"
Cohesion: 0.24
Nodes (10): qa-guardian agent, Unnamed and ungendered; English inside, Portuguese outside, Hidden-layer leak test, Prompt section order, Phase 1A Living body, Testing strategy, Tuning knobs (config, not story), Starting tuning and 14-day calibration run (+2 more)

### Community 3 - "Worker Brain & Infrastructure"
Cohesion: 0.17
Nodes (13): brain-engineer agent, Never exceed the free tier, No content censorship / Discoverable, not censored, Fetch guard, Infrastructure security, Interpreter (hidden LLM call 2), LLMProvider adapter and fallback, Tick pipeline (+5 more)

### Community 4 - "Body & Organism Design"
Cohesion: 0.25
Nodes (8): Feel, don't read, Components and packages, Resident-facing vs Hidden layers, Appraisal (14 dimensions), Feel a body, never a number, Memory coupling and sleep consolidation, Organism state (hidden), Mind systems

### Community 5 - "Lab menus (technical)"
Cohesion: 0.07
Nodes (30): body-organism-engineer agent, data-api-engineer agent, viewer-engineer agent, Read-only public, Everything is replayable, Supabase Postgres, Time model (timeline of timestamped events), Translation layer (+22 more)

### Community 6 - "leak.leak.test.ts"
Cohesion: 0.06
Nodes (50): buildPrompt(), BuiltPrompt, InputSchema, Lines, neutraliseMarkers(), ResidentPromptInput, section(), UNTRUSTED_CLOSE (+42 more)

### Community 7 - "Contracts Package Config"
Cohesion: 0.25
Nodes (8): dependencies, zod@^3.23.0, zod, main, name, private, type, version

### Community 8 - "Action & Decision Contract"
Cohesion: 0.33
Nodes (6): LLM proposes, code disposes, Action contract, DecideOutput { review?, action }, OutcomeReview, Intent, expectation, outcome review, lessons, Output discipline and model settings

### Community 15 - "worker/src/index.test.ts"
Cohesion: 0.09
Nodes (28): FakeDb, DEFAULT_FETCH_TIMEOUT_MS, FetchLike, MAX_SUBREQUESTS, SupabaseDb, CommitResult, Db, LoadedState (+20 more)

### Community 16 - "package.json"
Cohesion: 0.06
Nodes (29): devDependencies, eslint@^9.0.0, @eslint/js@^9.0.0, prettier@^3.3.0, typescript@^5.6.0, typescript-eslint@^8.0.0, vitest@^2.1.0, engines (+21 more)

### Community 17 - "0001_schema.sql"
Cohesion: 0.07
Nodes (38): appraisals, beliefs, blueprints, deaths, decisions, dreams, environment, events (+30 more)

### Community 18 - "0002_security_and_functions.sql"
Cohesion: 0.12
Nodes (12): events_append_only, events_no_truncate, log_entries_append_only, log_entries_no_truncate, resident_no_truncate, resident_permanent_death, search_translations(), tick_commit() (+4 more)

### Community 19 - "worker/package.json"
Cohesion: 0.12
Nodes (20): dependencies, @truman/contracts@workspace:*, @truman/shared@workspace:*, zod@^3.23.0, devDependencies, @cloudflare/workers-types@^4.20250101.0, @types/node@^18.19.130, wrangler@^4.0.0 (+12 more)

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
Nodes (7): liaison agent, Hard Rules (9), Team and Workflow, Nothing is planned (no scripting), Things that would break $0, End states (pause, hibernate, death, open-ended), Death (permanent, no respawn)

### Community 27 - "Task 0 (verify free-tier limits)"
Cohesion: 0.29
Nodes (7): ops-budget agent, Free-tier services table, Task 0 (verify free-tier limits), Phase 0 Foundations, Remaining open items, Risk register (20 risks), Pending Decisions (Phase 0 go-ahead, keys, Task 0)

### Community 28 - "Resource economy and 14-day gentle start"
Cohesion: 0.29
Nodes (7): world-engineer agent, Symbolic perception (no server renderer), Genesis (one-time), Early death risk, Temperament, Resource economy and 14-day gentle start, Starter kit

### Community 29 - "updates"
Cohesion: 0.29
Nodes (6): interval, updates, directory, package-ecosystem, schedule, version

### Community 30 - "body/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json

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
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 35 - "Code of Conduct"
Cohesion: 0.33
Nodes (5): Code of Conduct, Enforcement, Expected behaviour, Not acceptable, Note on the Resident's content

### Community 36 - "Contributing"
Cohesion: 0.33
Nodes (6): Before you start, Contributing, License of contributions, Pull requests, Security first, Style

### Community 37 - "body/package.json"
Cohesion: 0.33
Nodes (5): main, name, private, type, version

### Community 38 - "organism/package.json"
Cohesion: 0.33
Nodes (5): main, name, private, type, version

### Community 39 - "shared/package.json"
Cohesion: 0.33
Nodes (5): main, name, private, type, version

### Community 40 - "world/package.json"
Cohesion: 0.33
Nodes (5): main, name, private, type, version

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

## Knowledge Gaps
- **44 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` (+39 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 303 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `package.json` to `leak.leak.test.ts`, `worker/src/index.test.ts`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _44 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Data Model Schema` be split into smaller, more focused modules?**
  _Cohesion score 0.07152496626180836 - nodes in this community are weakly interconnected._
- **Why does `Truman Show Project` connect `Decisions Log` to `Worker Brain & Infrastructure`, `Code of Conduct`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Should `Contracts Types` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Why does `Tick pipeline` connect `Worker Brain & Infrastructure` to `Decisions Log`, `Lab menus (technical)`, `Resource economy and 14-day gentle start`, `Body & Organism Design`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Should `Lab menus (technical)` be split into smaller, more focused modules?**
  _Cohesion score 0.07126436781609195 - nodes in this community are weakly interconnected._