import type { CommitResult, Db, LoadedState, TickPayload } from "./types";

/** In-memory Db for tests and CI ($0). Records every call so tests can assert batching. */
export class FakeDb implements Db {
  loads = 0;
  commits: TickPayload[] = [];
  constructor(public state: LoadedState = { resident: { id: 1, status: "running" }, kv: {} }) {}
  async loadState(): Promise<LoadedState> {
    this.loads++;
    return this.state;
  }
  async commitTick(payload: TickPayload): Promise<CommitResult> {
    this.commits.push(payload);
    return { tick_id: this.commits.length, log_ids: {} };
  }
}
