# Decisions Log (maintained by the liaison agent)

Newest at the bottom. Format: decision, reason, docs affected.

| # | Decision | Reason / source | Docs |
|---|---|---|---|
| 1 | Brain = free hosted LLM APIs (Gemini, Groq, Workers AI) behind a fallback adapter | Oracle ARM/own PC rejected; $0 and 24/7 | 02, 05 |
| 2 | TypeScript everywhere | Single language | 02 |
| 3 | MVP is a vertical slice; public is read-only | Owner | 06 |
| 4 | Cloudflare Workers + Pages, Supabase Postgres, GitHub Releases for archives | Free tiers; owner chose Supabase and Releases | 02, 05 |
| 5 | Resident: no name, no gender concept, English inner life; UI in EN + PT-BR (free translation, cached) | Owner | 01, 02, 11 |
| 6 | Open web from day one; no content filtering of the Resident | Owner (infra security stays) | 02, 07 |
| 7 | Nothing scripted: no seeded goals/questions, no planned finale, no revelation trigger; `phase` is a label | Owner ("everything natural") | 01, 06 |
| 8 | 1 decision per 10 min, governor throttles only under quota pressure | Owner | 05 |
| 9 | Feelings = hidden body/organism state; Resident gets sensations and urges only, never labels/bars/numbers | Owner | 08 |
| 10 | Every action has intent + expectation; outcome review, causal links, lessons | Owner | 03, 08 |
| 11 | Log everything, global search (EN + PT over cached translations), technical views in a separate public Lab | Owner | 09 |
| 12 | Full body/survival simulation (life bar, hunger, thirst, temperature, injury, illness); bars visible to spectators only | Owner | 10 |
| 13 | Starting survival skills, starter kit (6 dried portions), renewable resources, seasons, 14-day gentle ramp | Owner | 10 |
| 14 | Death permanent; no respawn or rescue; memorial/replay | Owner | 06, 10 |
| 15 | Low-poly style; `*.pages.dev` domain | Owner | 01, 05 |
| 16 | Persona/behaviour consolidated in doc 11 | Owner | 11 |
| 17 | Agent team created: liaison + 7 specialists in `.claude/agents` | Owner | `.claude/agents` |
| 18 | Resident starts with nothing but has no limit on what it can learn or do with its learning (e.g. it may discover love); unnamed concepts are discoverable, never forbidden | Owner | 01, 08 |
| 19 | Open-source project under Apache-2.0, English-only README/docs; strong docs and strict secret handling (doc 12, SECURITY.md, gitleaks, no secrets in git/chat) | Owner | 12, README |
| 20 | Go-ahead for Task 0 only (verify free-tier limits against current provider pages; research, no code). 2026-11-25 | Owner | 05, 06, 07 |
| 21 | `liaison` is also the orchestrator: it runs the specialist agents itself (Agent tool) when started as the main session agent; only for owner-approved work. 2026-11-25 | Owner | `.claude/agents/liaison.md`, CLAUDE.md |
| 22 | Task 0 findings, owner takes recommended path (2026-11-25): (a) measure Worker CPU/subrequests in Phase 0; fallback is heavy compute in a GitHub Actions cron; batch DB writes into one RPC per tick. (b) Public data served as static snapshot files, not 4 s polling through the Worker. (c) Accept that the Gemini free tier may use prompts/outputs (Resident text is public anyway); keep Groq and Workers AI as fallbacks. `MAX_SEARCH_DAY` = 30 | Owner | 02, 05, 09 |
| 23 | Snapshot hosting for the public live feed: test Cloudflare Pages direct-upload in Phase 0 (check the 500 builds/month cap) and decide after. Public Supabase bucket is ruled out (hard rule 5). GitHub-hosted files are the fallback. 2026-11-25 | Owner (recommended path) | 02, 05, 09 |
| 24 | Go-ahead for Phase 0 (foundations). Parts needing accounts/keys wait for the owner to wire secrets. 2026-11-25 | Owner | 06 |
| 25 | Own Supabase project (ref suadfgpoprtormoomqyw; base URL non-secret). The first URL given belonged to another project (ReplayEdition) and is never used. Rule 6 reading: `log_entries` and `events` strictly append-only; `decisions`, `memories` etc. stay updatable (outcomes filled later), every change still logged. Default applied 2026-11-25 because the owner did not object | Owner / liaison default | 04, 12 |
| 26 | Go-ahead to deploy the Phase 0 Worker (empty tick, no LLM/search calls) to the owner's Cloudflare account and measure real CPU/subrequests. 2026-11-25 | Owner | 02, 05, 06 |

## Not yet decided / pending
- Account keys wiring (via secrets, never chat).
- Before wiring memory: leak scanner (names/gender/emotion words) must scan only templated prompt parts, not Resident-authored text (e.g. "he said"). Strict schema stays the real guarantee.
- Phase 0 status 2026-11-26: Worker deployed (cron 10 min); real tick wrote `ticks` rows (mode skipped, no_resident); CPU 2 ms, 3 subrequests (inferred). Migrations 0001-0004 on cloud (0003 closed anon execute hole, 0004 service_role grants). Confirmed on cloud: tick 3 wrote `log_entries` row 1 (kind tick), CPU 1 ms, wall 1258 ms. Failed-tick/skipped SQL tests added. qa-guardian final pass: no blockers other than that confirmation. Remaining: commit/push (owner go-ahead). Phase 0 code and real-service steps DONE; Phase 1 needs its own go-ahead.
- GitHub 2026-11-25: Phase 0 pushed (commit 36f44d7), CI green. Owner reports: production Environment secrets set, main protection set, Actions token read-only, private vulnerability reporting on (owner-reported, not independently verified). Dependabot PR #1 (gitleaks-action 3.0.0) merge approved by owner, pending ops-budget verification. Dependabot npm update jobs failing, cause unknown.
- Snapshot hosting: decision 23 sets the plan; final choice after the Phase 0 test.
- Task 0 follow-up DONE 2026-11-25: Worker limits, Groq, Jina, Supabase egress verified from official pages. Still unverified: Gemini per-model RPM/RPD (read in AI Studio at setup), m2m100 on Free plan, Jina free-tier licence, Workers AI replacement models. Groq Llama 3.x retired; Groq free is ~1K RPD / 8K TPM (small prompts only).
- Task 0 DONE 2026-11-25 (docs/05, "Verified limits"; mostly from search summaries, not the pages themselves). `MAX_SEARCH_DAY` 40 -> 30. Owner must decide on these findings:
  1. Worker Free = 10 ms CPU per tick and 50 subrequests per invocation; heavy compute may need a GitHub Actions cron. Phase 0 must measure it.
  2. Worker has 100k requests/day shared with viewers; public data should be static snapshots, not 4 s polling through the Worker (changes docs 02/05/09).
  3. Gemini free tier lets Google use prompts/outputs; accept it, or lead with other providers.
