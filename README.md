# Truman Show Project

**A persistent AI "Resident" that lives in a low-poly 3D cabin, learns through its senses and the open web, and has a hidden embodied emotional life. Anyone can watch it live and search everything it thought and did. Nobody can interact with it.**

> **Status (work in progress).** Built and tested locally: Phase 0 (monorepo, contracts, Supabase schema, Worker skeleton, CI), Phase 1A (world, body and organism engines, 14-day policy simulation), and Phase 1B Waves 1–2 (LLM fallback, tick pipeline, memory, web tools, logs, read-only API, and 3D viewer). In Wave 3, the static snapshot publisher and viewer integration passed local checks, and a synthetic Cloudflare Pages upload verified the hosting path. Production deployment, the first live run, and the 72-hour unattended test are pending.

## What is it?

A single character wakes up in a cabin with a body (hunger, thirst, temperature, injuries, a life bar), a terminal that reaches the open web, and a memory. Every 10 minutes it decides what to do. A deterministic engine simulates the consequences. The public watches through a 3D viewer and can search every thought, action and journal entry. Death is permanent.

Core ideas:

- **Nothing is scripted.** No seeded goals, no planned finale, no revelation trigger. Story is whatever emerges.
- **Starts with nothing, can learn anything.** It has no name, no gender concept, no emotion words. Nothing caps what it can discover or do with what it learns, love included.
- **Feel, don't read.** The Resident never sees bars, numbers or emotion labels. It gets bodily sensations and urges, and builds its own interpretation.
- **The LLM proposes, code disposes.** The model emits typed actions; the engine validates and applies them. The model never sets state directly.
- **Read-only public.** Spectators cannot send input, which removes moderation, abuse and prompt-injection-from-visitors.
- **Everything is logged, append-only, and replayable.**
- **Degrade, don't fail.** A governor throttles activity before any provider quota is hit.

## Architecture at a glance

| Layer | Choice |
|---|---|
| Brain | Hosted LLM APIs (Gemini, Groq, Workers AI) behind a fallback adapter |
| Language | TypeScript everywhere |
| Compute | Cloudflare Workers (cron tick + read-only API) |
| Viewer | Vite + Three.js on Cloudflare Pages (`*.pages.dev`), EN + PT-BR UI |
| Database | Supabase Postgres, written only by the Worker; never reachable from browsers |
| Archive | GitHub Releases (monthly exports, old traces) |
| CI/CD | GitHub Actions |

Read [02 Architecture](docs/02-architecture.md) for the tick pipeline and diagrams.

## Run it locally

What works today is the engine (world, body, organism), the Worker (tick pipeline, memory, web tools, read-only API), and the 3D viewer. The viewer runs on built-in demo data by default. For a live feed, set `VITE_SNAPSHOT_BASE` to the origin serving `live.json` and `VITE_API_BASE` to the Worker origin for search, context, and Lab.

**Requirements:** Node 22 or newer, pnpm 12 (`corepack enable` then `corepack prepare pnpm@12.23.0 --activate`), git. Docker is needed only for the database tests.

**1. Install and check (no keys needed)**

```bash
git clone https://github.com/CassioVSouza/truman-show-project.git
cd truman-show-project
pnpm install
pnpm typecheck
pnpm lint
pnpm test          # all unit and simulation tests
pnpm leak-test     # proves the Resident's prompts never contain hidden state
pnpm --filter @truman/viewer dev   # open the 3D viewer locally (uses demo data without a Worker)
```

Tests use a fake LLM provider, so they never call a real service.

**2. Database tests (optional, needs Docker)**

```bash
bash supabase/tests/run.sh
```

This applies every migration to a throwaway local Postgres and runs the SQL tests.

**3. Run the Worker locally (needs keys)**

1. Create a Supabase project and apply the migrations in order. See [supabase/README.md](supabase/README.md).
2. Copy `.env.example` to `apps/worker/.dev.vars` (gitignored) and fill in the values.
3. Start it:

   ```bash
   cd apps/worker
   pnpm dev
   ```

   `wrangler dev --test-scheduled` serves the API on a local port. You can trigger a tick by opening `/__scheduled` on that port.

**Keys and variables**

| Name | Needed | What it is |
|---|---|---|
| `SUPABASE_URL` | Yes | Base URL of your Supabase project (no `/rest/v1/`, no trailing slash) |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service-role key. Worker only, never in a browser |
| `ADMIN_TOKEN` | For admin routes | At least 16 random characters. Admin routes are off without it |
| `GEMINI_API_KEY` | For real LLM calls | Google AI Studio key (primary provider) |
| `GROQ_API_KEY` | For real LLM calls | Groq key (fallback provider) |
| `TAVILY_API_KEY` | For web search | Search provider key (falls back to Wikipedia search if omitted) |
| `ALLOWED_ORIGINS` | For the API | Comma-separated list of origins allowed to call the API (CORS) |

Optional tuning variables (daily caps, tick length, model names) are listed in `apps/worker/src/env.ts`.

**Secrets rule:** keys go in `apps/worker/.dev.vars` locally, and in Cloudflare Worker secrets (`wrangler secret put NAME`) and GitHub environment secrets in production. Never put a key in a file that is committed, in an issue, or in chat. See [docs/12-security-and-secrets.md](docs/12-security-and-secrets.md).

## Documentation

Start with 01, then read in order. `docs/DECISIONS.md` is the log of maintainer decisions; the docs are the source of truth.

| # | Document | What it answers |
|---|---|---|
| 01 | [Vision and principles](docs/01-vision-and-principles.md) | Why this exists and the rules it never breaks |
| 02 | [Architecture](docs/02-architecture.md) | Components, tick pipeline, time model, security overview |
| 03 | [Contracts](docs/03-contracts.md) | Typed actions, events, API (code in `packages/contracts`) |
| 04 | [Data model](docs/04-data-model.sql) | Postgres schema |
| 05 | [Limits and quotas](docs/05-free-tier-budget.md) | Provider limits and the governor |
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

1. The Resident never sees hidden state (bars, numbers, drive names, emotion labels, "AI/model/simulation/prompt" framing). Prompts are built by one function covered by a leak test.
2. Nothing is scripted; and nothing limits what the Resident can learn.
3. No content filtering of the Resident or what it reads or writes. Security controls only protect infrastructure and keys.
4. Public is read-only; Supabase is never reachable from the browser.
5. Everything is logged append-only; `hide` flags, never deletes.
6. Death is permanent.
7. Secrets live only in Worker/GitHub secrets; never in chat, docs or git.
8. Tune rates and config only; never inject story to fix behaviour.

## Security

This is a public repository handling provider keys. Read [docs/12-security-and-secrets.md](docs/12-security-and-secrets.md) before contributing code. Report vulnerabilities privately; see [SECURITY.md](SECURITY.md). Never commit a secret, even a test one that looks real.

## Contributing

Contributions and design feedback are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). The project is built with a small team of Claude Code agents (`.claude/agents`); human contributors follow the same rules and the same definition of done.

## Content notice

The Resident is intentionally unfiltered and reads the open web. Content it reads or writes may be unpleasant. Spectators watch; they cannot influence it. See doc 07 for platform-terms and takedown risks.

## License

[Apache License 2.0](LICENSE). See [NOTICE](NOTICE).
