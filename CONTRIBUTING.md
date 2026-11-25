# Contributing

Thank you for helping. Read [README.md](README.md), then the docs in `docs/`. `docs/DECISIONS.md` records maintainer decisions; do not re-litigate them in a PR, open a discussion instead.

## Before you start

- Open an issue or discussion for anything non-trivial so work is not duplicated.
- Check the **hard rules** in the README. A PR that breaks one will be closed. The most common ways to break them:
  - adding a paid or card-required service;
  - putting a bar, number, drive name or emotion label (or "AI/model/simulation/prompt" wording) in anything the Resident sees;
  - scripting a goal, question, event or ending;
  - filtering what the Resident reads or writes;
  - letting the browser reach Supabase, or adding any spectator input;
  - deleting log rows instead of flagging them.

## Security first

- Never commit secrets, tokens, `.env` files or real connection strings. Use fake values (`test-key-not-real`).
- Enable the pre-commit scan: `git config core.hooksPath .githooks` (needs `gitleaks`).
- Report vulnerabilities privately (see [SECURITY.md](SECURITY.md)).
- If you accidentally expose a secret: tell the maintainer, rotate it first, then clean up. See docs/12 section 9.

## Pull requests

- Small, focused, with tests. Anything touching prompts must pass the hidden-layer leak test.
- Do not claim "tested" without running the tests; paste the command and result.
- Tune rates and config to fix behaviour; never inject story.
- Update the relevant doc in the same PR. Docs are the source of truth.
- CI must pass: typecheck, tests, leak test, secret scan.
- PRs from forks run without secrets; do not depend on them.

## Style

TypeScript, strict mode. Pure, deterministic code where the docs say so (seeded RNG, no I/O in `packages/*`). Keep dependencies minimal and justify new ones.

## License of contributions

By contributing you agree your work is licensed under the Apache License 2.0 (see [LICENSE](LICENSE)). Add no code you do not have the right to contribute.
