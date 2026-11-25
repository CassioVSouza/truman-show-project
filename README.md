# Truman Show Project

**A persistent AI "Resident" that lives in a low-poly 3D cabin, learns through its senses and the open web, and has a hidden embodied emotional life. Anyone can watch it live and search everything it thought and did. Nobody can interact with it. Total running cost: $0.**

> **Status: design complete, no code yet.** This repository currently holds the full design (docs 01-12), the typed contracts draft and the Postgres schema. Phase 0 scaffolding starts after the maintainer's go-ahead. Nothing here is claimed as built or tested until it is.

## What is it?

A single character wakes up in a cabin with a body (hunger, thirst, temperature, injuries, a life bar), a terminal that reaches the open web, and a memory. Every 10 minutes it decides what to do. A deterministic engine simulates the consequences. The public watches through a 3D viewer and can search every thought, action and journal entry. Death is permanent.

Core ideas:

- **Nothing is scripted.** No seeded goals, no planned finale, no revelation trigger. Story is whatever emerges.
- **Starts with nothing, can learn anything.** It has no name, no gender concept, no emotion words. Nothing caps what it can discover or do with what it learns, love included.
- **Feel, don't read.** The Resident never sees bars, numbers or emotion labels. It gets bodily sensations and urges, and builds its own interpretation.
- **The LLM proposes, code disposes.** The model emits typed actions; the engine validates and applies them. The model never sets state directly.
- **Read-only public.** Spectators cannot send input, which removes moderation, abuse and prompt-injection-from-visitors.
- **Everything is logged, append-only, and replayable.**
- **$0.** Free tiers only, with a governor that throttles before any quota is hit. Degrade, never bill.

## Architecture at a glance

| Layer | Choice |
|---|---|
| Brain | Free hosted LLM APIs (Gemini, Groq, Workers AI) behind a fallback adapter |
| Language | TypeScript everywhere |
| Compute | Cloudflare Workers (cron tick + read-only API) |
| Viewer | Vite + Three.js on Cloudflare Pages (`*.pages.dev`), EN + PT-BR UI |
| Database | Supabase Postgres, written only by the Worker; never reachable from browsers |
| Archive | GitHub Releases (monthly exports, old traces) |
| CI/CD | GitHub Actions |

Read [02 Architecture](docs/02-architecture.md) for the tick pipeline and diagrams.

## Documentation

Start with 01, then read in order. `docs/DECISIONS.md` is the log of maintainer decisions; the docs are the source of truth.

| # | Document | What it answers |
|---|---|---|
| 01 | [Vision and principles](docs/01-vision-and-principles.md) | Why this exists and the rules it never breaks |
| 02 | [Architecture](docs/02-architecture.md) | Components, tick pipeline, time model, security overview |
| 03 | [Contracts](docs/03-contracts.md) | Typed actions, events, API (code in `packages/contracts`) |
| 04 | [Data model](docs/04-data-model.sql) | Postgres schema |
| 05 | [Free-tier budget](docs/05-free-tier-budget.md) | Limits, quotas, governor |
| 06 | [Lifecycle and roadmap](docs/06-lifecycle-and-roadmap.md) | Phases, testing, definitions of done |
| 07 | [Risks and open questions](docs/07-risks-and-open-questions.md) | What can go wrong |
| 08 | [Embodied feelings](docs/08-embodied-feelings-and-understanding.md) | How feelings work without labels |
| 09 | [Logging, search, menus](docs/09-logging-search-and-frontend-menus.md) | Public views and the Lab |
| 10 | [Body, mind, survival, world](docs/10-body-mind-survival-and-world.md) | The simulation |
| 11 | [Persona and behaviour](docs/11-persona-and-behaviour.md) | The prompt contract |
| 12 | [Security and secrets](docs/12-security-and-secrets.md) | How keys stay safe in a public repo |
| - | [Decisions](docs/DECISIONS.md) | Owner decision log |

## Hard rules

These never change without the maintainer's explicit approval (also in [CLAUDE.md](CLAUDE.md)):

1. Cost stays $0; no paid or card-required services.
2. The Resident never sees hidden state (bars, numbers, drive names, emotion labels, "AI/model/simulation/prompt" framing). Prompts are built by one function covered by a leak test.
3. Nothing is scripted; and nothing limits what the Resident can learn.
4. No content filtering of the Resident or what it reads or writes. Security controls only protect infrastructure and keys.
5. Public is read-only; Supabase is never reachable from the browser.
6. Everything is logged append-only; `hide` flags, never deletes.
7. Death is permanent.
8. Secrets live only in Worker/GitHub secrets; never in chat, docs or git.
9. Tune rates and config only; never inject story to fix behaviour.

## Security

This is a public repository handling provider keys. Read [docs/12-security-and-secrets.md](docs/12-security-and-secrets.md) before contributing code. Report vulnerabilities privately; see [SECURITY.md](SECURITY.md). Never commit a secret, even a test one that looks real.

## Contributing

Contributions are welcome once Phase 0 lands; design feedback is welcome now. See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). The project is built with a small team of Claude Code agents (`.claude/agents`); human contributors follow the same rules and the same definition of done.

## Content notice

The Resident is intentionally unfiltered and reads the open web. Content it reads or writes may be unpleasant. Spectators watch; they cannot influence it. See doc 07 for platform-terms and takedown risks.

## License

[Apache License 2.0](LICENSE). See [NOTICE](NOTICE).
