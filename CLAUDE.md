# Truman Show Project

Read `README.md` first, then the numbered docs in `docs/`. `docs/DECISIONS.md` is the log of owner decisions; the docs are the source of truth, not memory.

## Hard rules (never violate; ask the owner before changing)
1. Cost stays **$0**. No paid services; no card-required services without explicit approval.
2. The Resident never sees hidden state: no bars, numbers, drive names, emotion labels, "AI/model/simulation/prompt" framing. It has no name and no gender concept. Prompts are built by one function and covered by a leak test.
3. Nothing is scripted: no seeded goals/questions/story, no planned finale, no revelation trigger. The Resident starts with nothing but has no limit on what it can learn or do with its learning; never cap or forbid a topic or ability.
4. No content filtering of the Resident or what it reads/writes. Security controls only protect infrastructure and keys.
5. Public is read-only; Lab menus are public; Supabase is never reachable from the browser (RLS closed, Worker only).
6. Everything is logged append-only; `hide` flags, never deletes.
7. Death is permanent.
8. Secrets live only in Worker/GitHub secrets; never in chat, docs or git. The repo is public (Apache-2.0): follow `docs/12-security-and-secrets.md`; if a secret is ever exposed, rotate first.
9. Tune rates and config only; never inject story to fix behaviour.

## Team (`.claude/agents`)
`liaison` (owner's contact), `world-engineer`, `body-organism-engineer`, `brain-engineer`, `data-api-engineer`, `viewer-engineer`, `qa-guardian`, `ops-budget`.

## Workflow
Owner talks to `liaison`. Liaison writes briefs; specialists implement with tests; `qa-guardian` verifies before a phase is called done; `ops-budget` owns limits, CI and deploys. Do not claim built/tested without running it.

## Status
Design complete (docs 01-11). No code scaffolded yet. Next: owner go-ahead, then Task 0 (verify free-tier limits) and Phase 0.
