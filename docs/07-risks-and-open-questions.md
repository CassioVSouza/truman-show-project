# 07 - Risks and Open Questions

## Decisions recorded
Unnamed/ungendered Resident, English inner life, PT-BR presentation. Open web day one. Nothing scripted. Three-minute scheduled ticks within the governor. **Feelings are hidden body state rendered as sensations only (doc 08).** **Supabase Postgres.** **Everything logged and searchable, technical content in a separate Lab menu (doc 09).** **No content filtering of the Resident.** Low-poly. No scaffolding yet. Persona/behaviour instructions to come from you.

**Added in this revision:** full body and survival simulation with life bar, hunger, thirst, temperature, injury, illness (bars visible to spectators, hidden from the Resident); starting skills and starter kit; resource economy with seasons and a 14-day gentle-start ramp; reflexes and early-wake ticks; death is real. Free `*.pages.dev`, Portuguese search over cached translations, public Lab, GitHub Releases for archives (all confirmed).

## Risks
| # | Risk | Mitigation |
|---|---|---|
| 1 | Free-tier limits change | Provider adapter, governor, Task 0 verification |
| 2 | Supabase free DB (~500 MB) vs logging everything | Trace archiving to GitHub Releases, downsampling, size governor (doc 09) |
| 3 | Supabase pauses after inactivity | Ticks keep it active; health check alerts on failed ticks |
| 4 | Model weights know the real world ("blank slate" is leaky) | Prompt framing and citation rule only; no promise of true ignorance |
| 5 | Model labels sensations with emotion words, may be wrong | Intended: its own interpretation. Never corrected by the system |
| 6 | Hidden layer leaking into prompts | One prompt builder + CI leak test |
| 7 | Small models produce repetitive behaviour with nothing scripted | Body mechanics (restlessness, habituation, information hunger, boredom-like novelty deficit) and dreams, never injected story |
| 8 | Interpreter calls cost quota | Rule tables for mundane events, only meaningful stimuli use the LLM |
| 9 | **Provider-side safety refusals**: hosted APIs (Gemini, Groq, Workers AI) have their own policies that I cannot disable. A refusal or account strike is possible | Least-restrictive provider settings, refusal -> next provider, refusals logged visibly in Lab. If this becomes frequent, the realistic fix is a less-restricted open-weights model hosted by you (not free) |
| 10 | **Platform terms**: Cloudflare, Supabase and the LLM APIs have acceptable-use policies; unfiltered open-web content shown publicly can lead to suspension or takedown, and some content is illegal to host or retrieve regardless of intent | Not filtered by design per your decision. Kept: admin `hide` (flag, not delete), full logs for audit, and the archive/export so you can move hosts. Decide your own tolerance; this is the main operational exposure |
| 11 | Worker CPU/subrequest limits | Lean ticks, batched transaction writes |
| 12 | Search endpoint egress abuse | Edge cache + rate limit, no direct Supabase access |
| 13 | Translation limits and quality | Cache per entry, EN fallback |
| 14 | Asset licensing | CC0 assets only, tracked in `ASSETS.md` |
| 15 | The Resident can experience negative states (fear, pain, loneliness) by design | Intended and visible in the Lab; no mitigation |
| 16 | **Early death**: decision intervals, quota throttling and a small free model may cause the Resident to miss basic survival needs | Starter kit, gentle-start ramp, reflexes, early-wake ticks, innate know-how, calibration test (doc 10 s.8). Residual risk accepted; tune rates, not scripts |
| 17 | Minute-resolution body/world catch-up exceeds Worker CPU limits | Closed-form/coarse stepping for long gaps, batch writes, equivalence tests |
| 18 | Early-wake ticks and survival decisions burn the LLM quota | `MAX_EARLY_TICKS_DAY`, rule-table appraisal, long macro-actions |
| 19 | Calibration numbers are guesses | All config; watch first week and adjust rates (this is tuning, not story) |
| 20 | GitHub Releases as an archive: per-asset size limit, and a public repo makes archives public | Monthly split assets; accepted since logs are public anyway |
| 21 | **Public repo leaks a key** (committed, pasted in chat/issue, or exposed via fork CI) | Doc 12: gitignore, gitleaks pre-commit + CI, push protection, no secrets on fork PRs, log redaction, rotate-first runbook |

## Confirmed (closed)
Death is permanent (no respawn, no rescue, memorial/replay). Difficulty: gentle first 14 days then plain, ~14 days per season. Body rates as in doc 10. 6 dried food portions. Persona and behaviour = doc 11 (consolidated from your instructions).

## Remaining open items
None blocking the design. Before Phase 0 starts I will only need: (a) go-ahead to scaffold, (b) the keys/accounts wired in later (Supabase, Cloudflare, Gemini, Groq, Tavily, GitHub), never pasted into chat; they go into Worker secrets and GitHub secrets.
Task 0 (verify every free-tier limit against current provider pages) is the first work item and may force config changes.
