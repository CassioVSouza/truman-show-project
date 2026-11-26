# 06 - Lifecycle and Roadmap

## A. Lifecycle

### Beginning: Genesis (one-time)
1. Verify free-tier limits; create Supabase project, Cloudflare, LLM keys, GitHub repo (accounts exist).
2. Run migrations (`docs/04-data-model.sql`), enable RLS everywhere.
3. Generate world from `world_seed` (cabin, forest, river, mirror pool, finite edge).
4. Draw **temperament** from the seed (sensitivities, baselines, decay constants). Insert resident: waking in bed, full health, mildly rested, moderately fed and hydrated, **starting skills and starter kit** (doc 10), world resources seeded with the gentle-start abundance ramp. **No name, gender, goals, questions or narrative text are seeded.** The first decision is made from body sensations, perception and empty memory.
5. First `status` event; cron starts.

### Middle: the living loop
Tick pipeline every 10 min (doc 02). Rhythms emerge from the body: fatigue and rest need drive sleep; sleep triggers dream synthesis and emotional consolidation; information hunger and restlessness drive research; expression pressure drives journaling; social deprivation builds in solitude and shapes what it reads and writes. Weekly job: consolidate memories, archive traces. Daily: budget reset, health check, digest.

`phase` (`unaware | questioning | revealed`) is a descriptive label derived from its own beliefs for the viewer; never a trigger.

### End states
| End | How |
|---|---|
| Pause | `/admin/pause` |
| Hibernate | `/admin/kill` or hard failure streak (state preserved, resumable) |
| Death | Health reaches 0 (starvation, dehydration, exposure, injury, illness, poison). Causal death report logged, world frozen, viewer switches to memorial/replay. Default: no respawn, no rescue (your decision pending, doc 07) |
| Open-ended | No planned finale. Life continues until death, you stop it, or the free tier becomes unsustainable |
| Archive / replay | `/admin/export`; the viewer can switch to replay mode driven by the archive so the story stays watchable at $0 forever |

## B. Roadmap

**Phase 0 - Foundations**: verify limits (Task 0); monorepo; contracts; Supabase migration; Worker skeleton; CI incl. the **hidden-layer leak test**. *Done:* tests green, empty tick writes a log entry to Supabase.

**Phase 1 - Vertical slice (target), split in two milestones**
**1A - Living body (no web yet, FakeProvider-testable)**: world engine (map, stations, perception, day/night, seasons, weather, temperature), resource nodes and regrowth, starter kit, inventory, skills; body engine (metabolism, hydration, thermoregulation, injury, illness, health, death, reflexes); organism v1; sensation templating; survival actions; 14-day policy simulation test (competent survives, random usually dies day 4-6, idle dies ~day 2). *Done:* tests pass and a text-only run shows coherent days.
**1B - Mind, web, public**: items 3-10 below.

1. World engine: map, stations, waypoints, perception, day/night.
2. **Organism v1**: core affect + 7 chemistry analogues + 7 drives, temperament, decay/habituation, physiology (21 channels), sensation + urge templating, plus survival channels from doc 10.
3. LLM adapter (Gemini then Groq, traces, refusal fallback).
4. Tick pipeline with `think, move_to, web_search, read_page, write_journal, rest, look_at`; intent/expectation; outcome review; Interpreter + rule-based appraisal.
5. Logging for everything (`log_entries`) + causal links.
6. Memory v1 (FTS, recency, importance, affective recall), lessons, questions.
7. Governor modes.
8. Read-only API incl. `/api/search`, `/api/context`, Lab routes, translation cache.
9. Viewer: low-poly cabin, free rigged GLB character (CC0), timeline player, body panel (heartbeat/breath animation), **Life menus, Lab menus, global search, EN/PT-BR**.
10. Deploy Worker + Pages + Supabase; 72 h soak test.
*Done:* 72 h unattended, budgets respected, every thought/action/idea searchable with its cause chain, hidden layer never leaks into prompts, viewer shows live mid-action state.

**Phase 2 - Depth**: emotion atlas (50+ states) in Lab, affective memory reactivation, sleep consolidation + dreams, goal tree emerging from reflection, pgvector memory, trace archiving to GitHub Releases, replay mode.

**Phase 3 - Making things**: materials + property-based validator, procedural items, craft, tool wear, small game/hunting, real weather option (Open-Meteo), hygiene, easel, instruments (Tone.js).

**Phase 4 - Senses**: image vision for web images, symbolic hearing events, face/people imagery driving social appraisal.

**Phase 5 - World honesty/self-model**: mirror pool, world edge, consistency audit so discoverable facts are accurate.

**Phase 6 - Polish**: SEO/OG, daily highlights, accessibility, finale-free archive tooling.

## C. Testing
- Contracts fixtures; **leak test** (no hidden field names or atlas labels in any Resident prompt).
- Organism: deterministic unit tests (stimulus -> state -> physiology -> sensation text), decay and habituation properties.
- LLM: `FakeProvider`, record/replay, chaos (bad JSON, 429, refusals).
- Pipeline: simulated 7 days asserting budgets and no corruption.
- Security: fetch-guard tests (private IPs, redirects, huge bodies).
- Survival: calibration runs (doc 10 section 8), reflex determinism, death report completeness, body catch-up over long gaps matches minute-by-minute stepping.
- Logging: every pipeline step produces an entry; hide flag never deletes.
