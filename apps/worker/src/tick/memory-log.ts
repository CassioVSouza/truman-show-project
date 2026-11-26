import type { TickPayload } from "../db/types";
import type { LlmTraceRow } from "../llm";
import type { EventInput, TickRows } from "./ports";

/** In-memory TickRows for tests (and any Db that takes a TickPayload). Log entries use LogWriter, not this. */
export class MemoryRows implements TickRows {
  events: EventInput[] = [];
  decisions: Array<Record<string, unknown>> = [];
  memories: Array<Record<string, unknown>> = [];
  appraisals: Array<Record<string, unknown>> = [];
  samples: Array<Record<string, unknown>> = [];
  traces: LlmTraceRow[] = [];
  toolCalls: Array<Record<string, unknown>> = [];
  usageRows: Array<Record<string, unknown>> = [];
  toolUsageRows: Array<Record<string, unknown>> = [];

  event(e: EventInput): void {
    this.events.push(e);
  }
  decision(r: Record<string, unknown>): void {
    this.decisions.push(r);
  }
  memory(r: Record<string, unknown>): void {
    this.memories.push(r);
  }
  appraisal(r: Record<string, unknown>): void {
    this.appraisals.push(r);
  }
  organismSample(r: Record<string, unknown>): void {
    this.samples.push(r);
  }
  llmTrace(r: LlmTraceRow): void {
    this.traces.push(r);
  }
  toolCall(r: Record<string, unknown>): void {
    this.toolCalls.push(r);
  }
  usage(r: Record<string, unknown>): void {
    this.usageRows.push(r);
  }
  toolUsage(r: Record<string, unknown>): void {
    this.toolUsageRows.push(r);
  }

  drain(): Omit<TickPayload, "tick" | "kv" | "resident" | "log_entries"> {
    const out: Omit<TickPayload, "tick" | "kv" | "resident" | "log_entries"> = {};
    if (this.events.length) out.events = this.events.map((e) => ({ ...e }));
    if (this.decisions.length) out.decisions = this.decisions;
    if (this.memories.length) out.memories = this.memories;
    if (this.appraisals.length) out.appraisals = this.appraisals;
    if (this.samples.length) out.organism_samples = this.samples;
    if (this.traces.length)
      out.llm_traces = this.traces as unknown as Array<Record<string, unknown>>;
    if (this.toolCalls.length) out.tool_calls = this.toolCalls;
    if (this.usageRows.length) out.usage = this.usageRows;
    if (this.toolUsageRows.length) out.tool_usage = this.toolUsageRows;
    return out;
  }
}
