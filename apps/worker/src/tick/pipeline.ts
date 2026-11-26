// The mind tick (doc 02): lease, governor, load, catch-up, sense, decide (LLM 1), engine, interpret (LLM 2 only
// for meaningful stimuli), organism update, ONE batched commit. No storage access except through Db + LogSink.
import { DecideOutput, type Action } from "@truman/contracts";
import { vitals } from "@truman/body";
import { emotionLabels } from "@truman/organism";
import type { z } from "zod";
import type { Db, TickPayload } from "../db/types";
import {
  applyUsage,
  gate,
  governorConfigFromEnv,
  pickMode,
  type Budget,
  type GovernorConfig,
  type Lease,
  type Mode,
} from "../governor";
import { LLMError, LlmClient, type LlmProvider } from "../llm";
import { ALL_ACTIONS, buildPrompt, menuLines, type ActionName } from "../prompts";
import { stubTools, type Tools } from "../tools";
import { appraise } from "./appraise";
import { executeAction, idleFor, type ExecOutcome } from "./engine";
import type { LogRef } from "../log";
import type { TickLog, TickRows } from "./ports";
import { cognition, organismStep, physiologyNow, senseNow } from "./senses";
import {
  HISTORY_CAP,
  LESSON_CAP,
  QUESTION_CAP,
  genesis,
  isoAt,
  readMind,
  type HistoryItem,
  type MindState,
} from "./state";

type ActionT = z.infer<typeof Action>;

export interface MindTickDeps {
  db: Db;
  /** The single log writer (apps/worker/src/log), one per tick. */
  log: TickLog;
  /** Typed rows other than log entries (events, decisions, traces, usage...). */
  rows: TickRows;
  providers: LlmProvider[];
  tools?: Tools;
  now?: () => Date;
  governor?: GovernorConfig;
  lease?: Lease;
  /** Scrubs secrets from error text before it is stored. */
  scrub?: (s: string) => string;
}

export interface MindTickResult {
  ran: boolean;
  reason: string;
  mode: Mode | "skipped";
  tick_id: number | null;
  /** What happened to the Resident this tick. */
  step: "decided" | "continuing" | "idle" | "degraded" | "dead" | "skipped";
  action: string | null;
  llm_calls: number;
}

/** First-person phrase for what the Resident chose (its own words are carried separately). */
export function describeChoice(a: ActionT): string {
  switch (a.type) {
    case "think":
      return "to think";
    case "move_to":
      return `to walk to ${a.station.replace(/_/g, " ")}`;
    case "look_at":
      return `to look closely at ${a.target}`;
    case "write_journal":
      return "to write in my journal";
    case "rest":
      return "to rest";
    case "web_search":
      return `to search the terminal for "${a.query}"`;
    case "read_page":
      return `to read ${a.url}`;
    case "eat":
      return `to eat ${a.item}`;
    case "drink":
      return `to drink from ${a.source}`;
    case "gather":
      return `to gather ${a.target}`;
    case "chop":
      return `to cut wood from ${a.target}`;
    case "fish":
      return "to fish";
    case "make_fire":
      return "to make a fire";
    case "tend_fire":
      return "to tend the fire";
    case "boil_water":
      return "to boil water";
    case "cook":
      return `to cook ${a.item}`;
    case "wear":
      return a.remove ? `to take off ${a.item}` : `to put on ${a.item}`;
    case "treat_wound":
      return "to bind my wound";
    case "use_item":
      return `to use ${a.item}`;
    case "repair_shelter":
      return "to mend the cabin";
  }
}

const historyLines = (m: MindState, n: number): string[] =>
  m.history
    .slice(-n)
    .map(
      (h) =>
        `I chose ${h.did}. I wanted: ${h.intent} I expected: ${h.expectation} What followed: ${h.outcome}`,
    );

const planLines = (m: MindState): string[] => [
  ...m.goals.map((g) => `A goal of mine: ${g}`),
  ...m.questions.map((q) => `A question I have: ${q}`),
  ...m.lessons.map((l) => `I learned: ${l}`),
  ...m.beliefs.map((b) => `I suspect: ${b}`),
];

const keepCitations = (xs: string[]): string[] =>
  xs.filter((c) => /^https?:\/\/\S+$/i.test(c) || /^memory:\d+$/.test(c));

const pushCap = (xs: string[], x: string | undefined, cap: number): string[] =>
  x && !xs.includes(x) ? [...xs, x].slice(-cap) : xs;

function skippedPayload(started: Date, ended: Date, reason: string, mode: string): TickPayload {
  return {
    tick: {
      started_at: started.toISOString(),
      ended_at: ended.toISOString(),
      mode,
      provider: null,
      ok: true,
      error: reason,
    },
    log_entries: [
      { kind: "system", category: "lab", text: `tick skipped: ${reason}`, data: { mode } },
    ],
  };
}

export async function runMindTick(deps: MindTickDeps): Promise<MindTickResult> {
  const now = deps.now ?? (() => new Date());
  const cfg = deps.governor ?? governorConfigFromEnv({});
  const started = now();
  const holder = `tick-${started.getTime()}`;
  if (deps.lease && !(await deps.lease.acquire(holder, started, cfg.leaseTtlMs)))
    return {
      ran: false,
      reason: "lease_held",
      mode: "skipped",
      tick_id: null,
      step: "skipped",
      action: null,
      llm_calls: 0,
    };
  let budgetBefore = null as Budget | null;
  try {
    return await inner(deps, started, now, cfg, (b) => (budgetBefore = b));
  } catch (e) {
    const scrub = deps.scrub ?? ((s: string) => s);
    const msg = scrub(e instanceof Error ? e.message : String(e)).slice(0, 300);
    try {
      const b: Budget | null = budgetBefore;
      await deps.db.commitTick({
        tick: {
          started_at: started.toISOString(),
          ended_at: now().toISOString(),
          mode: "failed",
          provider: null,
          ok: false,
          error: msg,
        },
        log_entries: [{ kind: "error", category: "lab", text: `tick failed: ${msg}`, data: {} }],
        ...(b ? { kv: { budget: applyUsage(b, { ok: false }) } } : {}),
      });
    } catch {
      /* the failure row itself failed: the caller logs the original */
    }
    throw e;
  } finally {
    await deps.lease?.release(holder).catch(() => undefined);
  }
}

async function inner(
  deps: MindTickDeps,
  started: Date,
  now: () => Date,
  cfg: GovernorConfig,
  noteBudget: (b: Budget) => void,
): Promise<MindTickResult> {
  const { db, rows: sink, log } = deps;
  const tools = deps.tools ?? stubTools;
  const state = await db.loadState();
  const g = gate(state.kv, state.resident);
  const plan = pickMode(state.kv, started, cfg);
  noteBudget(plan.budget);
  if (!g.run || plan.mode === "hibernating") {
    const reason = g.run ? "hibernating" : g.reason;
    const res = await db.commitTick(
      skippedPayload(started, now(), reason, g.run ? "hibernating" : "skipped"),
    );
    return {
      ran: false,
      reason,
      mode: g.run ? "hibernating" : "skipped",
      tick_id: res.tick_id,
      step: "skipped",
      action: null,
      llm_calls: 0,
    };
  }

  let mind = readMind(state.kv) ?? genesis(Number(state.kv["world_seed"]) || 1, started.getTime());
  const tNow = (started.getTime() - mind.born_ms) / 60000;
  const day = started.toISOString().slice(0, 10);
  const client = new LlmClient(deps.providers, {
    exhausted: plan.budget.exhausted,
    maxCalls: Math.max(0, Math.min(6, plan.llmCallsLeft)),
  });
  let step: MindTickResult["step"];
  let actionName: string | null = null;
  const wakeBox: { w: { in_min: number; reason: string } | null } = { w: null };
  const note = (ws: Array<{ in_min: number; reason: string }>) => {
    for (const x of ws)
      if (!wakeBox.w || x.in_min < wakeBox.w.in_min)
        wakeBox.w = { in_min: x.in_min, reason: x.reason };
  };
  let searches = 0;
  let fetches = 0;

  // ---- 4. body and organism catch-up to now (minute-resolution, includes any running macro-action) ----
  const t0 = mind.world.t;
  if (mind.body.alive && t0 < tNow) {
    const gap = tNow - t0;
    const r = idleFor(mind, gap, plan.mode === "idle" || !plan.allowDecide);
    mind = organismStep(r.mind, r.mind.world.t - t0);
    note(r.wake);
  }
  const busy = mind.body.alive && mind.world.t > tNow + 1e-6;
  const due = tNow - mind.last_decision_t >= plan.decisionIntervalMin - 1e-6;

  if (
    mind.body.alive &&
    !busy &&
    due &&
    plan.allowDecide &&
    !client.allOut &&
    plan.llmCallsLeft > 0 &&
    deps.providers.length > 0
  ) {
    // ---- 5-9 sense, decide, execute ----
    const senses = senseNow(mind);
    const cog = cognition(mind);
    const available = ALL_ACTIONS.filter(
      (a) => (a !== "web_search" || plan.allowSearch) && (a !== "read_page" || plan.allowFetch),
    );
    const prompt = buildPrompt({
      sensations: senses.sensations,
      handsKnow: senses.handsKnow,
      perception: senses.perception,
      history: historyLines(mind, cog.historyN),
      planAndLessons: planLines(mind),
      memories: [], // wave 2: memory recall
      lastResult: mind.last_result,
      availableActions: menuLines(available),
    });
    let decided: z.infer<typeof DecideOutput> | null = null;
    let failure: string | null = null;
    try {
      const r = await client.generate({
        role: "resident",
        system: prompt.system,
        messages: prompt.messages,
        schema: DecideOutput,
        temperature: cog.temperature,
        maxOutputTokens: cog.maxOutputTokens,
      });
      decided = r.data;
    } catch (e) {
      failure = e instanceof LLMError ? e.message : String(e);
    }

    if (!decided) {
      step = "degraded"; // all providers failed: engine-only tick, status degraded (doc 02)
      log.add({
        kind: "error",
        text: `decide failed, idle tick: ${failure}`,
        data: { degraded: true },
      });
    } else {
      step = "decided";
      const d = decided;
      const action = d.action;
      actionName = action.type;
      const seq = mind.action_seq + 1;
      log.add({ kind: "sensation", text: senses.sensations.join(" "), data: { action_seq: seq } });
      log.add({ kind: "perception", text: senses.perception.join(" "), data: { action_seq: seq } });

      // outcome review of the PREVIOUS action (omitted on the first tick)
      let reviewRef: LogRef | undefined;
      const pend = mind.pending;
      if (pend) {
        const rev = d.review;
        const rr = log.add({
          kind: "outcome_review",
          text: rev ? `${rev.what_happened} Because: ${rev.cause}` : "(no review given)",
          data: {
            reviews_action_seq: pend.seq,
            review: rev ? { ...rev, citations: keepCitations(rev.citations) } : null,
          },
        });
        reviewRef = rr;
        if (rev) {
          const child = (
            kind: "feeling_description" | "lesson" | "question" | "goal" | "belief",
            text: string,
          ) => log.add({ kind, text, data: { reviews_action_seq: pend.seq }, causedBy: rr });
          child("feeling_description", rev.feeling_description);
          if (rev.lesson) child("lesson", rev.lesson);
          for (const q of rev.new_questions) child("question", q);
          if (rev.goal_update) child("goal", rev.goal_update);
          if (rev.belief_update) child("belief", rev.belief_update.hypothesis);
          mind = {
            ...mind,
            lessons: pushCap(mind.lessons, rev.lesson, LESSON_CAP),
            questions: rev.new_questions.reduce(
              (qs, q) => pushCap(qs, q, QUESTION_CAP),
              mind.questions,
            ),
            goals: pushCap(mind.goals, rev.goal_update, QUESTION_CAP),
            beliefs: pushCap(mind.beliefs, rev.belief_update?.hypothesis, QUESTION_CAP),
          };
        }
        sink.decision({
          action: pend.action,
          intent: pend.intent,
          expectation: pend.expectation,
          outcome: pend.outcome,
          outcome_review: rev ?? null,
          prediction_error: pend.prediction_error,
        });
      }

      const thoughtRef = log.add({
        kind: "thought",
        text: action.thought,
        data: { action_seq: seq },
        causedBy: reviewRef,
      });
      for (const idea of action.ideas ?? [])
        log.add({ kind: "idea", text: idea, data: { action_seq: seq }, causedBy: thoughtRef });
      const actionRef = log.add({
        kind: "action",
        text: `${describeChoice(action)} (${action.intent})`,
        data: { action_seq: seq, action, intent: action.intent, expectation: action.expectation },
        causedBy: thoughtRef,
      });

      const menu = new Set<string>(available as ActionName[]);
      const ex = await executeAction(mind, action, tools, {
        search: plan.allowSearch,
        fetch: plan.allowFetch,
        menu,
      });
      mind = ex.mind;
      const out = ex.out;
      note(out.wake);
      if (out.tool) {
        const name = out.tool.name;
        if (name === "web_search") searches++;
        else fetches++;
        sink.toolCall({
          tool: name,
          input: { input: out.tool.input },
          status: out.tool.outcome.ok ? 200 : 0,
          bytes: out.tool.outcome.bytes,
          ok: out.tool.outcome.ok,
          error: out.tool.outcome.ok ? null : "stub",
        });
        sink.toolUsage({ day, tool: name, calls: 1 });
      }
      if (action.type === "write_journal")
        log.add({
          kind: "journal",
          text: action.text,
          data: { action_seq: seq },
          causedBy: actionRef,
        });
      const outcomeRef = log.add({
        kind: "perception",
        text: out.text,
        data: {
          action_seq: seq,
          ok: out.ok,
          minutes: out.minutes,
          facts: out.facts,
          interrupted: out.interrupted,
        },
        causedBy: actionRef,
      });

      mind = organismStep(mind, out.minutes);
      const ap = await appraise(
        mind,
        out,
        { action: describeChoice(action), intent: action.intent, expectation: action.expectation },
        plan.allowInterpreter && !client.allOut ? client : null,
      );
      mind = ap.mind;
      log.add({
        kind: "appraisal",
        text: `appraisal via ${ap.source}${ap.note ? ` (${ap.note})` : ""}`,
        data: {
          action_seq: seq,
          consequences: ap.consequences,
          prediction_error: ap.prediction_error,
        },
        causedBy: outcomeRef,
      });
      sink.appraisal({ stimulus_ref: outcomeRef, dims: ap.appraisal, source: ap.source });

      const item: HistoryItem = {
        seq,
        type: action.type,
        did: `${describeChoice(action)} (${action.thought})`,
        intent: action.intent,
        expectation: action.expectation,
        outcome: out.text,
        ok: out.ok,
      };
      mind = {
        ...mind,
        action_seq: seq,
        history: [...mind.history, item].slice(-HISTORY_CAP),
        pending: {
          seq,
          action: action as unknown as Record<string, unknown>,
          intent: action.intent,
          expectation: action.expectation,
          outcome: { text: out.text, ok: out.ok, facts: out.facts, minutes: out.minutes },
          prediction_error: ap.prediction_error,
        },
        prev_key: out.key,
        last_decision_t: tNow,
      };
      for (const v of out.viewer) sink.event({ v: 1, actor: "resident", ...v, log_ref: actionRef });
    }
  } else if (!mind.body.alive) {
    step = "dead";
  } else if (busy) {
    step = "continuing";
  } else {
    step = plan.mode === "idle" || !plan.allowDecide ? "idle" : "continuing";
  }

  // ---- death is permanent: one causal report, one status flip ----
  const justDied = !mind.body.alive && state.resident?.["status"] !== "dead";
  if (justDied) {
    step = "dead";
    const pend = mind.pending;
    if (pend) {
      sink.decision({
        action: pend.action,
        intent: pend.intent,
        expectation: pend.expectation,
        outcome: pend.outcome,
        outcome_review: null,
        prediction_error: pend.prediction_error,
      });
      mind = { ...mind, pending: null };
    }
    const rep = mind.body.death_report;
    const deathRef = log.add({
      kind: "system",
      text: `Death: ${mind.body.cause_of_death ?? "unknown"}`,
      data: { report: rep ?? null },
    });
    sink.event({
      v: 1,
      actor: "world",
      log_ref: deathRef,
      kind: "death",
      t_start: isoAt(mind, mind.world.t),
      t_end: isoAt(mind, mind.world.t),
      data: { cause: mind.body.cause_of_death ?? "unknown" },
    });
  }

  // ---- 12-13 Lab sample, traces, usage, ONE commit ----
  const physiology = physiologyNow(mind);
  mind = { ...mind, physiology };
  sink.organismSample({
    organism: mind.organism.state,
    physiology,
    emotion_top3: emotionLabels(mind.organism.state, 3),
  });
  for (const t of client.traces) {
    sink.llmTrace(t);
    log.add({
      kind: "llm_trace",
      text: `${t.role} via ${t.provider}: ${t.ok ? "ok" : (t.finish_reason ?? "failed")} (${t.tokens_in}/${t.tokens_out} tokens, ${t.latency_ms} ms)`,
      data: { provider: t.provider, model: t.model, ok: t.ok },
    });
  }
  for (const r of client.refusals)
    log.add({
      kind: "error",
      text: `refusal from ${r.provider}: ${r.reason}`,
      data: { refusal: true },
    });
  for (const [provider, u] of client.usage) sink.usage({ day, provider, ...u });
  const mode: Mode = plan.mode;
  log.add({
    kind: "governor",
    text: `mode ${mode}; step ${step}`,
    data: { mode, step, pressure: plan.pressure, llm_calls: client.calls },
  });

  const budget = applyUsage(plan.budget, {
    llm_calls: client.calls,
    search_calls: searches,
    fetch_calls: fetches,
    ok: true,
    exhausted: client.exhausted,
  });
  const lastProvider = client.traces.length
    ? (client.traces[client.traces.length - 1] as { provider: string }).provider
    : null;
  const dead = !mind.body.alive;
  const payload: TickPayload = {
    tick: {
      started_at: started.toISOString(),
      ended_at: now().toISOString(),
      mode,
      provider: lastProvider,
      ok: true,
      error: step === "degraded" ? "providers_failed" : null,
    },
    ...sink.drain(),
    kv: { mind, budget, ...(wakeBox.w ? { wake_request: wakeBox.w } : {}) },
    resident: {
      x: mind.pos.x,
      z: mind.pos.z,
      heading: mind.pos.heading,
      station: mind.station,
      status: dead ? "dead" : step === "degraded" || step === "idle" ? "degraded" : "running",
      organism: mind.organism.state,
      physiology,
      vitals: vitals(mind.body),
      skills: mind.skills,
      active_plan: { goals: mind.goals, questions: mind.questions },
      last_tick_at: started.toISOString(),
    },
  };
  log.attach(payload);
  const res = await db.commitTick(payload);
  return {
    ran: true,
    reason: step,
    mode,
    tick_id: res.tick_id,
    step,
    action: actionName,
    llm_calls: client.calls,
  };
}

export type { ExecOutcome };
