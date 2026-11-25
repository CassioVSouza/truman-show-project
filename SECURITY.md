# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Use GitHub's **private vulnerability reporting** (the "Report a vulnerability" button under the repository's *Security* tab). Include what you found, how to reproduce it, and the impact. You will get an acknowledgement as soon as the maintainer can, and credit in the fix unless you prefer otherwise.

## What counts

- Anything that could expose a secret, token or key.
- Ways to reach Supabase or admin routes without authorization.
- Fetch-guard bypasses (SSRF), prompt-injection paths that reach secrets or infrastructure.
- CI/CD weaknesses (secrets exposed to forks, unpinned or over-privileged workflows).

## Out of scope

The Resident's own thoughts, searches and writings are intentionally unfiltered (see `docs/01-vision-and-principles.md`, principle 16). Content the Resident reads or produces is not a vulnerability; only threats to infrastructure and keys are.

## If you find a leaked secret

Tell us privately as above. Do not test it. The maintainer will rotate it first.

## For contributors

Never commit real secrets, even "temporarily". See `docs/12-security-and-secrets.md`.
