# 12 - Security and Secrets (open-source edition)

This repository is public. Anyone can read every file and every commit, forever. The design therefore assumes **the repo is hostile territory for secrets**: nothing sensitive may ever be committed, and every control below exists to make that mistake hard, detectable and recoverable.

Scope note: these controls protect **infrastructure and keys only**. They never filter what the Resident reads or writes (hard rule 4).

## 1. Threat model

| Threat | Example | Main defence |
|---|---|---|
| Secret committed by accident | `.env`, service key pasted in a doc | gitignore, pre-commit scan, CI scan, GitHub push protection |
| Secret leaked via chat/logs/issues | key pasted in an agent chat or bug report | never-in-chat rule, log redaction, rotate-on-exposure |
| Hostile pull request | fork PR that tries to read secrets in CI | no secrets on fork PRs, no `pull_request_target` checkout, least-privilege tokens |
| Prompt injection from the web | page tells the Resident to reveal keys | the Resident never holds secrets and has no shell (see section 6) |
| SSRF through the fetch tool | Resident fetches cloud metadata or internal URLs | fetch guard (doc 02) blocks private/loopback/link-local ranges and redirects to them |
| Public API abuse | scraping, floods | read-only GET, edge cache, rate limits, no input from spectators |
| Admin takeover | guessed or leaked `ADMIN_TOKEN` | long random token, constant-time compare, rate limit, rotation |
| Supply-chain attack | malicious dependency or action | lockfile, minimal deps, pinned actions, dependency alerts |
| Quota exhaustion (cost) | leaked LLM key burned by a stranger | free-tier keys only, no billing attached, quotas, rotate |

## 2. Secret inventory

Every secret has exactly one home. If it is not in this table, it is not allowed.

| Secret | Used by | Lives in | Never in |
|---|---|---|---|
| `SUPABASE_SERVICE_KEY` | Worker (only writer) | Cloudflare Worker secret | git, browser, viewer bundle, GitHub Actions unless a job truly needs it |
| `SUPABASE_URL` | Worker | Worker var (not secret, but kept out of docs examples) | viewer bundle |
| `GEMINI_API_KEY`, `GROQ_API_KEY` | Worker LLM adapter | Worker secrets | git, logs, prompts |
| `TAVILY_API_KEY` | Worker web tool | Worker secret | git, logs, prompts |
| `ADMIN_TOKEN` | Worker admin routes | Worker secret (owner keeps a copy in a password manager) | git, chat, URL query strings |
| `CLOUDFLARE_API_TOKEN` | deploy workflow | GitHub Actions environment secret | Worker, git |
| `CLOUDFLARE_ACCOUNT_ID` | deploy workflow | GitHub Actions environment secret | git |
| Release upload credential | archive workflow | the built-in `GITHUB_TOKEN` with `contents: write` for that job only (no personal access token) | git |

Local development: `apps/worker/.dev.vars` (Wrangler) and `.env`, both gitignored. `.env.example` lists variable names with empty or obviously fake values; it is the only env-like file that may be committed.

## 3. Rules (hard)

1. **Never in chat.** Never paste a key, token or connection string into an agent chat, issue, PR, discussion or doc. If it happens: treat the secret as burned, rotate it immediately, then continue. Agents must refuse to echo or store secrets they are shown.
2. **Never in git.** No real secret in any file, test fixture, comment, screenshot, notebook or commit message. Fixtures use obviously fake values (`test-key-not-real`).
3. **Never in the browser.** The viewer bundle contains no keys. Supabase is unreachable from browsers (RLS closed, Worker only).
4. **Never in a prompt.** Prompts are built by one function with a leak test; secrets are not in its inputs.
5. **Least privilege.** One token per purpose, scoped to this project's resources only, shortest useful lifetime.
6. **Rotate on exposure, then clean.** Rotation comes first; history rewriting is secondary because forks and caches keep copies.
7. **No paid billing attached** to any provider account used by this project (hard rule 1). A leaked key then cannot generate a bill.

## 4. Preventing leaks in the repo

- `.gitignore` blocks `.env*`, `.dev.vars`, `*.pem`, `*.key`, key files, local DB dumps, `graphify-out/cache`, and wrangler state.
- `.gitleaks.toml` defines the scan rules and a tiny allowlist for fake fixtures.
- Local: `.githooks/pre-commit` runs gitleaks on staged changes. Enable once with `git config core.hooksPath .githooks`.
- CI: `.github/workflows/secret-scan.yml` scans every push and pull request, full history on a schedule.
- GitHub settings the owner turns on (free on public repos): **secret scanning**, **push protection**, **private vulnerability reporting**, Dependabot alerts and security updates.
- Branch protection on `main`: PRs required, required status checks (typecheck, tests, leak test, secret scan), no force pushes.
- 2FA on every account that can touch the repo, Cloudflare, Supabase or the LLM providers.

## 5. CI/CD safety

- Workflows declare `permissions:` explicitly and default to `contents: read`.
- Pull requests from forks run **without secrets**. Never use `pull_request_target` to check out and run fork code.
- Deploy runs only on `main`, from a protected GitHub **Environment** holding the Cloudflare token.
- Third-party actions are pinned to a full commit SHA, not a tag. Dependabot keeps them current.
- No `curl | sh`. Build tools come from the lockfile.
- Logs: never `echo` secrets; rely on GitHub masking only as a backstop, not a plan.
- Artifacts and release assets are public: never include `.dev.vars`, env dumps or unredacted traces.

## 6. Runtime safety (Worker)

- The Resident has no shell, no env access and no secrets in context. The Worker adds API keys to provider requests server-side.
- **Log and trace redaction:** before anything is written to the append-only log or archived to a public Release, known secret patterns (key prefixes, long tokens, `Authorization` headers, connection strings) and the live values of this project's secrets are replaced with `[REDACTED]`. This protects keys; it does not filter the Resident's content.
- Admin routes: `Authorization: Bearer` header only (never a query string), constant-time comparison, strict rate limit, audit-logged. Optional hardening: put `/admin/*` behind Cloudflare Access (free tier).
- Public routes: GET only, no cookies, strict CORS, cached at the edge, input validation on every parameter.
- Error responses never include stack traces, SQL, or env values.
- Fetch guard: only `http(s)`, resolves DNS and rejects private, loopback, link-local and metadata IPs (including after redirects), size and time caps.
- Supabase: RLS enabled on every table with no public policy; the service key is held only by the Worker.

## 7. Public-repo data hygiene

- Logs, journals and archives are public by design. No personal data of the owner or third parties may enter the system: no real emails, phone numbers, addresses, or account identifiers in config, prompts, fixtures or the world.
- The owner's email and handles stay out of committed files (use the GitHub noreply address for commits if desired).
- Agent tooling output (`graphify-out/`, caches, session notes) is excluded from git except what is deliberately published.

## 8. Supply chain

- Lockfile committed; installs use the lockfile (`npm ci`).
- Few dependencies; review any new one (maintainers, downloads, install scripts) before adding.
- Dependabot for npm and GitHub Actions; `npm audit` in CI (advisory, not blocking on dev-only findings).
- Releases of this project are built in CI from tagged commits.

## 9. If a secret leaks (runbook)

1. **Rotate/revoke** the secret at the provider immediately. Do not wait to understand scope.
2. Update the new value in Worker/GitHub secrets only.
3. Check provider usage logs for abuse; check the Resident's log for gaps.
4. Remove the secret from the repo (new commit). Rewriting history is optional and never a substitute for step 1.
5. Note the incident (date, what, how fixed, how prevented) in `docs/DECISIONS.md` without including the value.
6. Add or tighten the rule that would have caught it.

## 10. Reporting vulnerabilities

See [SECURITY.md](../SECURITY.md): private reporting through GitHub, never public issues.

## 11. Owner checklist before the first public push

- [ ] Run `gitleaks detect` over the working tree (nothing found).
- [ ] `git config core.hooksPath .githooks`.
- [ ] Repo created with secret scanning, push protection, private vulnerability reporting enabled.
- [ ] Branch protection on `main`.
- [ ] Cloudflare token scoped to this account/resources; Supabase service key only in Worker secrets.
- [ ] No billing method attached to any provider (hard rule 1).
- [ ] 2FA on all accounts.
- [ ] Confirm `.env`, `.dev.vars` are untracked (`git ls-files | grep -E "\.env|dev\.vars"` returns nothing).
