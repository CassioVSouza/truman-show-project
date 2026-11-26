# Truman Show Project

Read [CLAUDE.md](CLAUDE.md) for the canonical project rules and team workflow. Start with [README.md](README.md), then consult the numbered project docs and [docs/DECISIONS.md](docs/DECISIONS.md) for current status, scope, and owner approvals.

## Codex team

The project agents live in [.codex/agents](.codex/agents). Each agent reads its corresponding definition in [.claude/agents](.claude/agents) for ownership, required reading, and acceptance criteria.

When the owner asks Codex to coordinate work as liaison, the primary session reads [.claude/agents/liaison.md](.claude/agents/liaison.md) and delegates approved work to the matching Codex specialists. Give each specialist a brief with the goal, constraints, and acceptance test. Ask `qa-guardian` to verify a phase before calling it done. The `liaison` subagent handles briefs, decisions, and status work and returns delegation recommendations to the primary session.

Use Codex file and search tools or the shell for repository reads, the patch tool for edits, and the shell for local checks. Use native web search for provider documentation and current limits when available. In Codex CLI, start with `codex --search` when live provider research is needed. Subagents use the parent session's tools and permissions.
