// Deterministic consequences of an action (doc 02 step 9): world effect -> body effect -> clocks in sync.
// Everything here is engine truth; the Resident only receives `text` (plain words, no numbers).
import type { z } from "zod";
import type { Action } from "@truman/contracts";
import {
  advance,
  advanceInventory,
  boilWater,
  chop,
  cook,
  dist,
  drink,
  eat,
  environmentAt,
  fish,
  gather,
  lookAt,
  makeFire,
  mapOf,
  moveTo,
  perceive,
  repairShelter,
  tendFire,
  useItem,
  wear,
  type ActionResult as WorldResult,
  type Actor,
  type Facts,
} from "@truman/world";
import {
  advanceBody,
  bodyEnvironmentFromWorld,
  catchUp,
  performAction,
  wakeReason,
  type BodyAction,
  type ReflexEvent,
  type WakeRequest,
} from "@truman/body";
import { renderReflexEvents, type RoutineEvent } from "@truman/organism";
import type { Tools, ToolOutcome } from "../tools";
import { isoAt, type MindState } from "./state";

type ActionT = z.infer<typeof Action>;

export interface ViewerEvent {
  kind: string;
  t_start: string;
  t_end: string;
  data: Record<string, unknown>;
}

export interface ExecOutcome {
  ok: boolean;
  /** Resident-facing plain words for what followed. */
  text: string;
  minutes: number;
  facts: Facts;
  reflex: ReflexEvent[];
  wake: WakeRequest[];
  interrupted: string | null;
  tool: { name: "web_search" | "read_page"; input: string; outcome: ToolOutcome } | null;
  /** Rule-table appraisal key for routine events. */
  routine: RoutineEvent;
  /** True when the Interpreter should look at it (a tool result, or a close look that revealed something). */
  meaningful: boolean;
  stimulus: string;
  viewer: ViewerEvent[];
  died: boolean;
  /** Habituation key. */
  key: string;
}

export interface Allow {
  search: boolean;
  fetch: boolean;
  /** Names on the menu this tick; anything else is a failed attempt. */
  menu: ReadonlySet<string>;
}

function nearStation(m: MindState, p: { x: number; z: number }): MindState["station"] {
  const st = mapOf(m.world).stations;
  let best: MindState["station"] = null;
  let bd = 2.5;
  for (const [id, at] of Object.entries(st)) {
    const d = dist(p, at);
    if (d < bd) {
      bd = d;
      best = id as MindState["station"];
    }
  }
  return best;
}

/** Awake (or asleep when `sleep` and sleepy), quietly idle for `minutes`. Chunked so conditions can change. */
export function idleFor(
  m: MindState,
  minutes: number,
  sleep = false,
): { mind: MindState; reflex: ReflexEvent[]; wake: WakeRequest[] } {
  let mind = m;
  const reflex: ReflexEvent[] = [];
  const wake: WakeRequest[] = [];
  const coarse = minutes > 240;
  const chunk = coarse ? 120 : 60;
  let left = minutes;
  while (left > 1e-6 && mind.body.alive) {
    const seg = Math.min(left, chunk);
    const from = mind.world.t;
    const env = bodyEnvironmentFromWorld(environmentAt(mind.world, mind.pos));
    let body = mind.body;
    if (sleep && body.sleep_pressure > 0.5) {
      const r = performAction(body, { type: "sleep", minutes: seg }, env, mind.skills);
      if (r.state.t - from > 1e-6) {
        body = r.state;
        reflex.push(...r.events);
        wake.push(...r.wake);
      }
    }
    if (body.t - from < 1e-6) {
      const act = { asleep: false, effort: 1 };
      const r = coarse ? catchUp(body, env, act, seg) : advanceBody(body, env, act, seg);
      body = r.state;
      reflex.push(...r.events);
      wake.push(...r.wake);
    }
    const to = Math.max(body.t, from + 1e-3);
    const world = advance(mind.world, to);
    mind = { ...mind, body, world, inventory: advanceInventory(mind.inventory, world, from, to) };
    left -= to - from;
  }
  return { mind, reflex, wake };
}

interface Plan {
  r: WorldResult | null;
  body: BodyAction;
  text: string;
  minutes: number;
  ok: boolean;
  facts: Facts;
  routine: RoutineEvent;
}

const fail = (text: string, minutes = 1): Plan => ({
  r: null,
  body: { type: "rest", minutes },
  text,
  minutes,
  ok: false,
  facts: {},
  routine: "action_failed",
});

function fromWorld(r: WorldResult, kind: string, ok: RoutineEvent): Plan {
  const mins = Math.max(1, r.minutes);
  const f = r.facts;
  if (!r.ok)
    return {
      r,
      body: { type: "rest", minutes: mins },
      text: r.text,
      minutes: mins,
      ok: false,
      facts: f,
      routine: "action_failed",
    };
  let body: BodyAction;
  switch (kind) {
    case "eat":
      body = {
        type: "eat",
        satiety: Number(f.satiety ?? 0),
        reserve: Number(f.reserve ?? 0),
        hydration: Number(f.hydration ?? 0),
        toxic: Number(f.toxic ?? 0),
        minutes: mins,
      };
      break;
    case "drink":
      body = {
        type: "drink",
        hydration: Number(f.hydration ?? 0),
        contamination: Number(f.contamination ?? 0),
        boiled: !!f.boiled,
        minutes: mins,
      };
      break;
    case "make_fire":
    case "tend_fire":
    case "boil_water":
    case "cook":
      body = {
        type: "handle_fire",
        minutes: mins,
        burnRisk: Number(f.burn_risk ?? 0.08),
        skill: kind === "make_fire" ? "fire_making" : "fire_tending",
      };
      break;
    case "wear":
      body = { type: "wear", insulationDelta: Number(f.insulationDelta ?? 0) };
      break;
    case "chop":
      body = {
        type: "work",
        kind: "chop",
        minutes: mins,
        effort: 2.5,
        injuryRisk: 0.12,
        skill: "woodcutting",
      };
      break;
    case "gather":
    case "fish":
      body = {
        type: "work",
        kind,
        minutes: mins,
        effort: 1.8,
        injuryRisk: 0.04,
        skill: typeof f.skill === "string" ? f.skill : undefined,
      };
      break;
    default:
      body = { type: "work", kind, minutes: mins, effort: 1.5 };
  }
  return { r, body, text: r.text, minutes: mins, ok: true, facts: f, routine: ok };
}

function plan(m: MindState, a: Actor, action: ActionT): Plan {
  const w = m.world;
  switch (action.type) {
    case "think":
      return {
        r: null,
        body: { type: "rest", minutes: 3 },
        text: "You think.",
        minutes: 3,
        ok: true,
        facts: {},
        routine: "quiet",
      };
    case "look_at": {
      const text = lookAt(w, m.pos, action.target);
      return {
        r: null,
        body: { type: "rest", minutes: 2 },
        text,
        minutes: 2,
        ok: true,
        facts: {},
        routine: "quiet",
      };
    }
    case "write_journal": {
      const mins = Math.min(30, 3 + Math.ceil(action.text.length / 80));
      return {
        r: null,
        body: { type: "rest", minutes: mins },
        text: "You write in your journal.",
        minutes: mins,
        ok: true,
        facts: {},
        routine: "quiet",
      };
    }
    case "web_search":
    case "read_page":
      return {
        r: null,
        body: { type: "rest", minutes: 4 },
        text: "You use the terminal.",
        minutes: 4,
        ok: true,
        facts: {},
        routine: "quiet",
      };
    case "move_to": {
      const r = moveTo(w, a, action.station);
      return fromWorld(r, "move_to", "walk");
    }
    case "rest": {
      const env = environmentAt(w, m.pos);
      const minutes = action.hours * 60;
      const sleeps =
        env.time_of_day === "night" || m.body.sleep_pressure >= 0.35 || m.body.stamina < 60;
      return {
        r: null,
        body: sleeps ? { type: "sleep", minutes } : { type: "rest", minutes },
        text: sleeps ? "You lie down and sleep." : "You rest for a while.",
        minutes,
        ok: true,
        facts: { slept: sleeps },
        routine: sleeps ? "sleep" : "rest",
      };
    }
    case "eat":
      return fromWorld(eat(w, a, action.item), "eat", "eat");
    case "drink":
      return fromWorld(drink(w, a, action.source), "drink", "drink");
    case "gather":
      return fromWorld(gather(w, a, action.target, action.minutes), "gather", "action_succeeded");
    case "chop":
      return fromWorld(chop(w, a, action.target), "chop", "action_succeeded");
    case "fish":
      return fromWorld(fish(w, a), "fish", "action_succeeded");
    case "make_fire":
      return fromWorld(makeFire(w, a), "make_fire", "make_fire");
    case "tend_fire":
      return fromWorld(tendFire(w, a), "tend_fire", "warm_by_fire");
    case "boil_water":
      return fromWorld(boilWater(w, a), "boil_water", "action_succeeded");
    case "cook":
      return fromWorld(cook(w, a, action.item), "cook", "action_succeeded");
    case "wear":
      return fromWorld(wear(w, a, action.item, action.remove ?? false), "wear", "action_succeeded");
    case "use_item":
      return fromWorld(useItem(w, a, action.item, action.target), "use_item", "action_succeeded");
    case "repair_shelter":
      return fromWorld(repairShelter(w, a), "repair_shelter", "action_succeeded");
    case "treat_wound": {
      const untreated = m.body.wounds.some((x) => !x.treated);
      return {
        r: null,
        body: { type: "treat_wound", woundId: action.wound_id, quality: 0.8, minutes: 10 },
        text: untreated ? "You clean and bind the wound." : "You find no wound that needs it.",
        minutes: 10,
        ok: untreated,
        facts: {},
        routine: untreated ? "action_succeeded" : "action_failed",
      };
    }
    default:
      return fail("You cannot do that.");
  }
}

const targetOf = (a: ActionT): string => {
  const x = a as Record<string, unknown>;
  const t = x["station"] ?? x["target"] ?? x["item"] ?? x["source"] ?? "";
  return `${a.type}:${String(t).toLowerCase()}`;
};

/** Runs one Resident action to completion. Time advances by the action's duration (a macro-action). */
export async function executeAction(
  m: MindState,
  action: ActionT,
  tools: Tools,
  allow: Allow,
): Promise<{ mind: MindState; out: ExecOutcome }> {
  const t0 = m.world.t;
  const key = targetOf(action);
  const actor: Actor = {
    pos: { x: m.pos.x, z: m.pos.z },
    inventory: m.inventory,
    skills: m.skills,
  };
  const onMenu = allow.menu.has(action.type);
  let p: Plan = onMenu ? plan(m, actor, action) : fail("You cannot do that right now.");
  let tool: ExecOutcome["tool"] = null;
  let lastResult: string | null = null;

  // tools (stubs in wave 1): the result is untrusted text for the NEXT prompt
  if (onMenu && (action.type === "web_search" || action.type === "read_page")) {
    const permitted = action.type === "web_search" ? allow.search : allow.fetch;
    const input = action.type === "web_search" ? action.query : action.url;
    if (!permitted) p = fail("The terminal does not respond.", 2);
    else {
      const outcome = await (action.type === "web_search"
        ? tools.webSearch(input)
        : tools.readPage(input));
      tool = { name: action.type, input, outcome };
      lastResult = outcome.text;
      p = {
        ...p,
        ok: outcome.ok,
        text: outcome.ok ? "You read what the terminal shows." : "The terminal gives no answer.",
        routine: outcome.ok ? "action_succeeded" : "action_failed",
      };
    }
  }

  const w0 = p.r && p.r.ok ? p.r.world : m.world;
  const a1: Actor = p.r && p.r.ok ? p.r.actor : actor;
  const env = bodyEnvironmentFromWorld(environmentAt(w0, a1.pos));
  const res = performAction(m.body, p.body, env, a1.skills);
  const world = advance(w0, Math.max(res.state.t, w0.t));
  let body = res.state;
  const inv = advanceInventory(a1.inventory, world, w0.t, world.t);
  if (body.alive && body.t < world.t) {
    const pad = advanceBody(
      body,
      bodyEnvironmentFromWorld(environmentAt(world, a1.pos)),
      { asleep: false, effort: 1 },
      world.t - body.t,
    );
    body = pad.state;
    res.events.push(...pad.events);
    res.wake.push(...pad.wake);
  }
  const minutes = world.t - t0;

  let heading = m.pos.heading;
  const walk = p.r?.walk;
  if (walk && walk.points.length >= 2) {
    const q = walk.points[walk.points.length - 1]!;
    const prev = walk.points[walk.points.length - 2]!;
    if (Math.hypot(q.x - prev.x, q.z - prev.z) > 1e-6)
      heading = Math.atan2(q.x - prev.x, q.z - prev.z);
  }
  let mind: MindState = {
    ...m,
    world,
    body,
    inventory: inv,
    skills: res.skills,
    pos: { x: a1.pos.x, z: a1.pos.z, heading },
    last_result: lastResult,
  };
  mind = { ...mind, station: nearStation(mind, mind.pos) };
  if (action.type === "move_to") mind = { ...mind, station: action.station };

  // body sensations of reflexes/sudden events, in body language only
  const reflexLines = renderReflexEvents(res.events, mind.organism.temperament, world.t);
  const woke = p.body.type === "sleep" && res.interrupted && wakeReason(body) !== null;
  let text = p.text;
  if (p.body.type === "sleep") text += woke ? " You wake before you meant to." : " You wake.";
  if (reflexLines.length) text += ` ${reflexLines.join(" ")}`;
  if (!body.alive) text += " Everything goes dark.";

  const sickened = res.outcome["sickened"] !== undefined;
  const hurt = res.events.some((e) => e.kind === "injury");
  const routine: RoutineEvent = sickened ? "sickened" : hurt ? "minor_injury" : p.routine;

  const lookPlain = action.type === "look_at" ? perceive(m.world, m.pos).text : "";
  const meaningful =
    (tool !== null && tool.outcome.ok) ||
    (action.type === "look_at" && p.ok && p.text !== lookPlain);

  const viewer: ViewerEvent[] = [];
  const span = (kind: string, data: Record<string, unknown>, a = t0, b = world.t) =>
    viewer.push({ kind, t_start: isoAt(m, a), t_end: isoAt(m, Math.max(a, b)), data });
  span("thought", { text: action.thought }, t0, t0 + 0.5);
  if (walk && walk.points.length >= 2)
    span("walk", { waypoints: walk.points.map((q) => ({ x: q.x, z: q.z })), speed: walk.speed });
  if (action.type === "write_journal") span("anim", { name: "write", station: "journal_table" });
  if (tool) span("anim", { name: "read" });
  if (p.body.type === "rest" && action.type === "rest") span("anim", { name: "rest" });
  if (p.body.type === "sleep") {
    span("sleep_start", {});
    span("sleep_end", {}, world.t, world.t);
  }
  if (p.ok && (action.type === "eat" || action.type === "drink"))
    span("consume", {
      item: String(p.facts.item ?? p.facts.source ?? action.type),
      kind: action.type,
    });
  if (p.ok && p.facts.gathered !== undefined && Number(p.facts.gathered) > 0)
    span("gather", {
      target: String(p.facts.kind ?? "plants"),
      gained: [{ item: String(p.facts.item), qty: Number(p.facts.gathered) }],
    });
  if (!body.alive) span("death", { cause: body.cause_of_death ?? "unknown" }, world.t, world.t);

  return {
    mind,
    out: {
      ok: p.ok,
      text,
      minutes,
      facts: p.facts,
      reflex: res.events,
      wake: res.wake,
      interrupted: res.interrupted,
      tool,
      routine,
      meaningful,
      stimulus: tool ? tool.outcome.text.slice(0, 4000) : p.text,
      viewer,
      died: !body.alive,
      key,
    },
  };
}
