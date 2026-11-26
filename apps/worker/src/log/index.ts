// The single log writer. Everything that happens in a tick goes through here (doc 09), append-only, with provenance.
//
// HOW IT FITS (narrow on purpose):
//   const log = new LogWriter(scrub);                      // one per tick
//   const seen = log.add({ kind: "perception", text });   // returns a LogRef (opaque string)
//   const idea = log.add({ kind: "thought", text, causedBy: seen });
//   log.add({ kind: "action", text, data, causedBy: idea });
//   log.attach(payload);                                   // payload.log_entries gets everything, in order
//   const res = await db.commitTick(payload);              // ONE transaction (tick_commit RPC)
//   const id = idOf(res.log_ids, idea);                    // numeric id, usable as `causedBy` in a LATER tick
//
// RULES (enforced here and in SQL):
//  - append-only: there is no update or delete. Hiding is an admin flag on the stored row (admin_hide), never here.
//  - a cause must be added BEFORE its effect (`causedBy` is a ref from this writer, or a numeric id from an earlier tick).
//  - `category` is derived from the kind (life = what the Resident lived, lab = everything technical); it cannot be wrong.
//  - secrets are scrubbed from text and every string inside `data` (docs/12). Content is never filtered.
//  - brain code should depend on the `Log` interface below, not on the class.
import { LogKind } from "@truman/contracts";
import type { TickPayload } from "../db/types";

export type LogKindName = (typeof LogKind.options)[number];
/** Opaque handle for an entry added in this tick. Pass it as `causedBy` or as `log_ref` / `stimulus_ref` in a payload. */
export type LogRef = string;

export interface LogDraft {
  kind: LogKindName;
  /** Searchable text (what the entry says). */
  text: string;
  /** Structured details (intent, expectation, ids, ...). Must be JSON-serialisable. */
  data?: Record<string, unknown>;
  /** The entry that led to this one: a LogRef from this writer, or the numeric id of an entry from an earlier tick. */
  causedBy?: LogRef | number | null;
  /** Defaults to "en". */
  lang?: string;
  /** Defaults to the database clock. */
  ts?: Date | string;
}

/** The only thing the brain needs. */
export interface Log {
  add(draft: LogDraft): LogRef;
}

/** Kinds that belong to the Resident's life (doc 09). Everything else is lab. */
export const LIFE_KINDS: ReadonlySet<LogKindName> = new Set<LogKindName>([
  "thought",
  "idea",
  "action",
  "outcome_review",
  "lesson",
  "journal",
  "dream",
  "memory_write",
  "memory_recall",
  "discovery",
  "question",
  "belief",
  "goal",
  "feeling_description",
  "perception",
  "sensation",
]);

export const categoryOf = (kind: LogKindName): "life" | "lab" =>
  LIFE_KINDS.has(kind) ? "life" : "lab";

/** Hard cap per tick so one runaway loop cannot make a payload (and an RPC) enormous. */
export const MAX_ENTRIES_PER_TICK = 500;

type Scrub = (s: string) => string;

function scrubDeep(v: unknown, scrub: Scrub): unknown {
  if (typeof v === "string") return scrub(v);
  if (Array.isArray(v)) return v.map((x) => scrubDeep(x, scrub));
  if (v !== null && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[scrub(k)] = scrubDeep(x, scrub);
    return out;
  }
  return v;
}

export class LogWriter implements Log {
  private rows: Array<Record<string, unknown>> = [];
  private known = new Set<string>();

  constructor(private scrub: Scrub = (s) => s) {}

  add(draft: LogDraft): LogRef {
    const kind = LogKind.parse(draft.kind); // unknown kinds fail loudly in tests, not silently in the database
    if (this.rows.length >= MAX_ENTRIES_PER_TICK) {
      throw new Error(`log: more than ${MAX_ENTRIES_PER_TICK} entries in one tick`);
    }
    const ref = `e${this.rows.length + 1}`;
    const row: Record<string, unknown> = {
      ref,
      kind,
      category: categoryOf(kind),
      text: this.scrub(String(draft.text ?? "")),
      data: scrubDeep(JSON.parse(JSON.stringify(draft.data ?? {})), this.scrub),
      lang: draft.lang ?? "en",
    };
    if (draft.ts !== undefined) {
      row["ts"] = draft.ts instanceof Date ? draft.ts.toISOString() : draft.ts;
    }
    const cause = draft.causedBy;
    if (typeof cause === "string") {
      if (!this.known.has(cause)) {
        throw new Error(`log: unknown cause ${cause} (a cause must be added before its effect)`);
      }
      row["caused_by_ref"] = cause;
    } else if (typeof cause === "number") {
      if (!Number.isInteger(cause) || cause <= 0)
        throw new Error("log: causedBy id must be a positive integer");
      row["caused_by"] = cause;
    }
    this.known.add(ref);
    this.rows.push(row);
    return ref;
  }

  get size(): number {
    return this.rows.length;
  }

  /** Copy of the rows in commit order (cause before effect). */
  entries(): Array<Record<string, unknown>> {
    return this.rows.map((r) => ({ ...r }));
  }

  /** Appends this tick's entries to the payload that goes to the single tick_commit RPC. */
  attach(payload: TickPayload): TickPayload {
    payload.log_entries = [...(payload.log_entries ?? []), ...this.entries()];
    return payload;
  }
}

/** Numeric id of an entry after commit (for `causedBy` in a later tick). Throws if the ref was not committed. */
export function idOf(logIds: Record<string, number>, ref: LogRef): number {
  const id = logIds[ref];
  if (id === undefined) throw new Error(`log: ref ${ref} was not committed`);
  return id;
}
