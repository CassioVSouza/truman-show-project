# Graph Report - TrumanShowProject  (2026-11-25)

## Corpus Check
- Corpus is ~14,148 words - fits in a single context window. You may not need a graph.

## Summary
- 183 nodes · 217 edges · 15 communities (9 shown, 6 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Data Model Schema
- Contracts Types
- Hard Rules & Team
- Worker Brain & Infrastructure
- Body & Organism Design
- Data Logging & API
- Viewer & Timeline
- Contracts Package Config
- Action & Decision Contract
- Self-Discovery Phases
- Survival Macro-Actions
- Innate Survival Skills
- MVP Scope
- Server Truth
- Later Roadmap Phases

## God Nodes (most connected - your core abstractions)
1. `log_entries` - 13 edges
2. `Tick pipeline` - 10 edges
3. `Hard Rules (9)` - 8 edges
4. `Decisions Log` - 8 edges
5. `Hidden-layer leak test` - 8 edges
6. `Organism state (hidden)` - 8 edges
7. `Task 0 (verify free-tier limits)` - 5 edges
8. `Log everything, append-only` - 5 edges
9. `Lab menus (technical)` - 5 edges
10. `Body systems (health, nutrition, hydration, thermo, injury, illness)` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Hard Rules (9)` --conceptually_related_to--> `Read-only public`  [EXTRACTED]
  CLAUDE.md → docs/01-vision-and-principles.md
- `Things that would break $0` --rationale_for--> `Hard Rules (9)`  [INFERRED]
  docs/05-free-tier-budget.md → CLAUDE.md
- `Truman Show Project` --references--> `Tick pipeline`  [INFERRED]
  README.md → docs/02-architecture.md
- `Decisions Summary Table` --references--> `Decisions Log`  [INFERRED]
  README.md → docs/DECISIONS.md
- `Hard Rules (9)` --conceptually_related_to--> `No content censorship / Discoverable, not censored`  [EXTRACTED]
  CLAUDE.md → docs/01-vision-and-principles.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Hidden state to Resident sensation pipeline** — docs_08_embodied_feelings_and_understanding_appraisal, docs_08_embodied_feelings_and_understanding_organism_state, docs_08_embodied_feelings_and_understanding_physiology_vector, docs_08_embodied_feelings_and_understanding_sensation_text, docs_08_embodied_feelings_and_understanding_emotion_atlas [EXTRACTED 1.00]
- **Hidden-layer protection (contracts, leak test, QA, persona)** — docs_03_contracts_two_layers, docs_03_contracts_leak_test, docs_11_persona_and_behaviour_persona_prompt, _claude_agents_qa_guardian_qa_guardian, _claude_agents_brain_engineer_brain_engineer [INFERRED 0.85]
- **Free-tier cost control and degradation** — docs_05_free_tier_budget_governor_modes, docs_05_free_tier_budget_per_day_plan, docs_05_free_tier_budget_db_growth, docs_05_free_tier_budget_early_ticks, docs_05_free_tier_budget_task_0 [INFERRED 0.85]

## Communities (15 total, 6 thin omitted)

### Community 0 - "Data Model Schema"
Cohesion: 0.07
Nodes (38): appraisals, beliefs, blueprints, deaths, decisions, dreams, environment, events (+30 more)

### Community 1 - "Contracts Types"
Cohesion: 0.06
Nodes (29): Action, Appraisal, base, BodyState, DecideOutput, EmotionLabel, Event, InterpreterOutput (+21 more)

### Community 2 - "Hard Rules & Team"
Cohesion: 0.08
Nodes (31): liaison agent, ops-budget agent, qa-guardian agent, Hard Rules (9), Team and Workflow, No content censorship / Discoverable, not censored, Nothing is planned (no scripting), The Resident (+23 more)

### Community 3 - "Worker Brain & Infrastructure"
Cohesion: 0.10
Nodes (21): brain-engineer agent, world-engineer agent, Never exceed the free tier, Fetch guard, Interpreter (hidden LLM call 2), LLMProvider adapter and fallback, Symbolic perception (no server renderer), Supabase Postgres (+13 more)

### Community 4 - "Body & Organism Design"
Cohesion: 0.14
Nodes (15): body-organism-engineer agent, Feel, don't read, Components and packages, Resident-facing vs Hidden layers, Early-wake tick cap (MAX_EARLY_TICKS_DAY), Appraisal (14 dimensions), Feel a body, never a number, Emotion atlas (spectators only) (+7 more)

### Community 5 - "Data Logging & API"
Cohesion: 0.18
Nodes (12): data-api-engineer agent, Read-only public, Everything is replayable, Admin routes (ADMIN_TOKEN), LogEntry (canonical, append-only), Public API (GET, edge-cached), Database growth and archiving, Platform terms exposure risk (+4 more)

### Community 6 - "Viewer & Timeline"
Cohesion: 0.22
Nodes (9): viewer-engineer agent, Time model (timeline of timestamped events), Translation layer, Viewer (Vite + Three.js on Pages), Worker API (read-only, edge cached), Event (engine to viewer), Phase 1B Mind, web, public, Lab menus (technical) (+1 more)

### Community 7 - "Contracts Package Config"
Cohesion: 0.25
Nodes (8): dependencies, zod@^3.23.0, main, name, private, type, version, zod

### Community 8 - "Action & Decision Contract"
Cohesion: 0.33
Nodes (6): LLM proposes, code disposes, Action contract, DecideOutput { review?, action }, OutcomeReview, Intent, expectation, outcome review, lessons, Output discipline and model settings

## Knowledge Gaps
- **38 isolated node(s):** `Deviations from original Gemini plan`, `Server is the only truth`, `LLM proposes, code disposes`, `Nothing is planned (no scripting)`, `Unnamed and ungendered; English inside, Portuguese outside` (+33 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 92 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Tick pipeline` connect `Worker Brain & Infrastructure` to `Hard Rules & Team`, `Body & Organism Design`, `Data Logging & API`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **What connects `Deviations from original Gemini plan`, `Server is the only truth`, `LLM proposes, code disposes` to the rest of the system?**
  _38 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Data Model Schema` be split into smaller, more focused modules?**
  _Cohesion score 0.07152496626180836 - nodes in this community are weakly interconnected._
- **Why does `Decisions Log` connect `Hard Rules & Team` to `Body & Organism Design`, `Data Logging & API`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Should `Contracts Types` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Why does `Organism state (hidden)` connect `Body & Organism Design` to `Hard Rules & Team`, `Worker Brain & Infrastructure`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Should `Hard Rules & Team` be split into smaller, more focused modules?**
  _Cohesion score 0.08387096774193549 - nodes in this community are weakly interconnected._