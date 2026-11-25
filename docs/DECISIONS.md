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

## Not yet decided / pending
- Go-ahead to scaffold Phase 0.
- Account keys wiring (via secrets, never chat).
- Task 0 results (verified free-tier limits) may change config.
